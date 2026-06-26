/**
 * Ports (hexagonal architecture) — the agent depends ONLY on these interfaces,
 * never on a concrete database/cloud. Firestore, Postgres, S3, etc. are adapters
 * that implement them. This is what makes "migrate to another server with zero
 * data loss" a property of the system, not a hope.
 *
 * Source of truth = the append-only EventStore. All other state (profiles, the
 * user model) is a PROJECTION that can be rebuilt by replaying events. Migration
 * is therefore: export events → replay into the new adapter → verify.
 */

/** An immutable domain event. The log of these IS the database. */
export interface DomainEvent {
  readonly id: string;
  readonly userId: string;
  readonly type: string;
  readonly ts: string;
  readonly data: Record<string, unknown>;
}

export interface EventStore {
  append(event: Omit<DomainEvent, "id" | "ts">): Promise<DomainEvent>;
  /** All events for one user, in order. */
  byUser(userId: string): Promise<DomainEvent[]>;
  /** Full ordered log — used for export/migration. */
  all(): Promise<DomainEvent[]>;
  /** Bulk load (used when replaying an exported log into a fresh store). */
  load(events: DomainEvent[]): Promise<void>;
}

export interface UserStore {
  get(userId: string): Promise<StoredUser | null>;
  put(user: StoredUser): Promise<void>;
  all(): Promise<StoredUser[]>;
}

/** Opaque binary store for bills/PDFs (Firebase Storage / S3 / GCS adapter). */
export interface DocStore {
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<{ bytes: Uint8Array; contentType: string } | null>;
}

export type OnboardingStep = "profession" | "turnover" | "mode" | "consent" | "done";
export interface OnboardingState {
  step: OnboardingStep;
  complete: boolean;
}

/** Persisted user record = profile + the adaptive model (see user-model.ts). */
export interface StoredUser {
  userId: string;
  profile: UserProfileData;
  model: UserModelData;
  onboarding?: OnboardingState;
  updatedAt: string;
}

export interface UserProfileData {
  profession?: string;
  grossReceipts?: number;
  incomeType?: "SALARY" | "PROFESSION" | "BUSINESS" | "OTHER";
  mostlyDigital?: boolean;
  regime?: "new" | "old";
  consent?: Partial<Record<"income" | "gst" | "bank" | "bills" | "notices", boolean>>;
}

export interface UserModelData {
  language: "en" | "hi" | "hinglish";
  verbosity: "brief" | "normal" | "detailed";
  techLevel: "low" | "medium" | "high";
  segment?: "professional" | "trader" | "service_smb" | "gig" | "creator";
  /** Free-form facts the agent has learned, e.g. "owns ultrasound machine". */
  knownFacts: string[];
  messageCount: number;
}
