/**
 * File-based adapters — real persistence with zero dependencies, so state
 * survives restarts today (no cloud creds needed). Same ports as the in-memory
 * and (future) Firestore adapters, so swapping is one line.
 *
 * Events are an append-only JSONL file — that file literally IS the portable,
 * cloud-agnostic event log from the zero-loss-migration design. Copy it anywhere
 * and `replayInto` a different store.
 */
import { appendFile, readFile, writeFile, mkdir, rename, readdir } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import type { DomainEvent, EventStore, StoredUser, UserStore } from "./types.ts";

let seq = 0;
const nextId = () => `evt_${Date.now().toString(36)}_${(seq++).toString(36)}`;

async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

export class FileEventStore implements EventStore {
  #file: string;
  #ready: Promise<void>;
  constructor(dir: string) {
    this.#file = join(dir, "events.jsonl");
    this.#ready = ensureDir(dir);
  }
  async append(e: Omit<DomainEvent, "id" | "ts">): Promise<DomainEvent> {
    await this.#ready;
    const event: DomainEvent = { ...e, id: nextId(), ts: new Date().toISOString() };
    await appendFile(this.#file, JSON.stringify(event) + "\n");
    return event;
  }
  async #read(): Promise<DomainEvent[]> {
    await this.#ready;
    try {
      const raw = await readFile(this.#file, "utf8");
      return raw.split("\n").filter(Boolean).map((l) => JSON.parse(l) as DomainEvent);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw err;
    }
  }
  async byUser(userId: string): Promise<DomainEvent[]> {
    return (await this.#read()).filter((e) => e.userId === userId);
  }
  async all(): Promise<DomainEvent[]> {
    return this.#read();
  }
  async load(events: DomainEvent[]): Promise<void> {
    await this.#ready;
    await appendFile(this.#file, events.map((e) => JSON.stringify(e)).join("\n") + (events.length ? "\n" : ""));
  }
}

/**
 * One file PER USER (not one shared map), so a write only ever touches the
 * writing user's file. This removes the cross-user read-modify-write race where
 * two concurrent users' updates could clobber each other. Writes are atomic
 * (temp file + rename). Filenames are sanitised + hashed to prevent path
 * traversal and collisions.
 */
export class FileUserStore implements UserStore {
  #dir: string;
  #ready: Promise<void>;
  constructor(dir: string) {
    this.#dir = join(dir, "users");
    this.#ready = ensureDir(this.#dir);
  }
  #path(userId: string): string {
    const safe = userId.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40);
    const hash = createHash("sha1").update(userId).digest("hex").slice(0, 12);
    return join(this.#dir, `${safe}-${hash}.json`);
  }
  async get(userId: string): Promise<StoredUser | null> {
    await this.#ready;
    try {
      return JSON.parse(await readFile(this.#path(userId), "utf8")) as StoredUser;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
  }
  async put(user: StoredUser): Promise<void> {
    await this.#ready;
    const file = this.#path(user.userId);
    const tmp = `${file}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(user, null, 2));
    await rename(tmp, file);
  }
  async all(): Promise<StoredUser[]> {
    await this.#ready;
    const files = await readdir(this.#dir).catch(() => [] as string[]);
    const out: StoredUser[] = [];
    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      try {
        out.push(JSON.parse(await readFile(join(this.#dir, f), "utf8")) as StoredUser);
      } catch {
        /* skip a partially-written/corrupt file */
      }
    }
    return out;
  }
}
