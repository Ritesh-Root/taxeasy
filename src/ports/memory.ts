/**
 * In-memory adapters — for tests and local dev. They implement the SAME ports a
 * Firestore/Postgres adapter will, so the agent code is identical in every
 * environment. `exportLog` / `replayInto` demonstrate the zero-loss migration
 * path: dump the event log anywhere, replay it into a fresh store, rebuild state.
 */
import type {
  DomainEvent,
  EventStore,
  StoredUser,
  UserStore,
  DocStore,
} from "./types.ts";

let seq = 0;
const nextId = () => `evt_${Date.now().toString(36)}_${(seq++).toString(36)}`;

export class InMemoryEventStore implements EventStore {
  #events: DomainEvent[] = [];

  async append(e: Omit<DomainEvent, "id" | "ts">): Promise<DomainEvent> {
    const event: DomainEvent = { ...e, id: nextId(), ts: new Date().toISOString() };
    this.#events.push(event);
    return event;
  }
  async byUser(userId: string): Promise<DomainEvent[]> {
    return this.#events.filter((e) => e.userId === userId);
  }
  async all(): Promise<DomainEvent[]> {
    return [...this.#events];
  }
  async load(events: DomainEvent[]): Promise<void> {
    this.#events.push(...events);
  }
}

export class InMemoryUserStore implements UserStore {
  #users = new Map<string, StoredUser>();
  async get(userId: string): Promise<StoredUser | null> {
    return this.#users.get(userId) ?? null;
  }
  async put(user: StoredUser): Promise<void> {
    this.#users.set(user.userId, structuredClone(user));
  }
  async all(): Promise<StoredUser[]> {
    return [...this.#users.values()];
  }
}

export class InMemoryDocStore implements DocStore {
  #docs = new Map<string, { bytes: Uint8Array; contentType: string }>();
  async put(key: string, bytes: Uint8Array, contentType: string): Promise<void> {
    this.#docs.set(key, { bytes, contentType });
  }
  async get(key: string) {
    return this.#docs.get(key) ?? null;
  }
}

/** Export the entire event log to a portable, cloud-agnostic JSON string. */
export async function exportLog(store: EventStore): Promise<string> {
  return JSON.stringify(await store.all());
}

/** Replay an exported log into a (fresh) store — the migration primitive. */
export async function replayInto(store: EventStore, exported: string): Promise<number> {
  const events = JSON.parse(exported) as DomainEvent[];
  await store.load(events);
  return events.length;
}
