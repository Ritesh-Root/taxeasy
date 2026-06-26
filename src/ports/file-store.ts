/**
 * File-based adapters — real persistence with zero dependencies, so state
 * survives restarts today (no cloud creds needed). Same ports as the in-memory
 * and (future) Firestore adapters, so swapping is one line.
 *
 * Events are an append-only JSONL file — that file literally IS the portable,
 * cloud-agnostic event log from the zero-loss-migration design. Copy it anywhere
 * and `replayInto` a different store.
 */
import { appendFile, readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { join } from "node:path";
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

export class FileUserStore implements UserStore {
  #file: string;
  #ready: Promise<void>;
  constructor(dir: string) {
    this.#file = join(dir, "users.json");
    this.#ready = ensureDir(dir);
  }
  async #read(): Promise<Record<string, StoredUser>> {
    await this.#ready;
    try {
      return JSON.parse(await readFile(this.#file, "utf8")) as Record<string, StoredUser>;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return {};
      throw err;
    }
  }
  async #write(all: Record<string, StoredUser>): Promise<void> {
    // Atomic: write a temp file then rename, so a crash can't truncate the store.
    const tmp = `${this.#file}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(all, null, 2));
    await rename(tmp, this.#file);
  }
  async get(userId: string): Promise<StoredUser | null> {
    return (await this.#read())[userId] ?? null;
  }
  async put(user: StoredUser): Promise<void> {
    const all = await this.#read();
    all[user.userId] = user;
    await this.#write(all);
  }
  async all(): Promise<StoredUser[]> {
    return Object.values(await this.#read());
  }
}
