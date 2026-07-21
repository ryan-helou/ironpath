import type { Pool as PgPool } from "pg";

// ---------------------------------------------------------------------------
// Storage layer. Uses Railway Postgres when DATABASE_URL is set; otherwise an
// in-memory store so the app runs locally / in preview with no database.
// Each user row carries a JSONB `data` blob = { profile, plan } (the app state).
// ---------------------------------------------------------------------------

export interface UserRow {
  id: string;
  username: string;
  passwordHash: string;
  data: AppState;
}

export interface AppState {
  profile?: unknown;
  plan?: unknown;
  updatedAtISO?: string;
}

export interface Store {
  init(): Promise<void>;
  getUserByUsername(username: string): Promise<UserRow | null>;
  getUserById(id: string): Promise<UserRow | null>;
  createUser(username: string, passwordHash: string): Promise<UserRow>;
  getData(userId: string): Promise<AppState>;
  setData(userId: string, data: AppState): Promise<void>;
}

function newId(): string {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
  );
}

// ---- Postgres ----

class PgStore implements Store {
  private pool: PgPool;
  private ready: Promise<void> | null = null;

  constructor(pool: PgPool) {
    this.pool = pool;
  }

  init(): Promise<void> {
    if (!this.ready) {
      this.ready = this.pool
        .query(
          `CREATE TABLE IF NOT EXISTS users (
             id TEXT PRIMARY KEY,
             username TEXT NOT NULL,
             username_lower TEXT UNIQUE NOT NULL,
             password_hash TEXT NOT NULL,
             data JSONB NOT NULL DEFAULT '{}'::jsonb,
             created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
             updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
           )`,
        )
        .then(() => undefined);
    }
    return this.ready;
  }

  async getUserByUsername(username: string): Promise<UserRow | null> {
    await this.init();
    const r = await this.pool.query(
      "SELECT id, username, password_hash, data FROM users WHERE username_lower = $1",
      [username.toLowerCase()],
    );
    if (!r.rows[0]) return null;
    const row = r.rows[0];
    return { id: row.id, username: row.username, passwordHash: row.password_hash, data: row.data ?? {} };
  }

  async getUserById(id: string): Promise<UserRow | null> {
    await this.init();
    const r = await this.pool.query(
      "SELECT id, username, password_hash, data FROM users WHERE id = $1",
      [id],
    );
    if (!r.rows[0]) return null;
    const row = r.rows[0];
    return { id: row.id, username: row.username, passwordHash: row.password_hash, data: row.data ?? {} };
  }

  async createUser(username: string, passwordHash: string): Promise<UserRow> {
    await this.init();
    const id = newId();
    await this.pool.query(
      "INSERT INTO users (id, username, username_lower, password_hash, data) VALUES ($1,$2,$3,$4,$5)",
      [id, username, username.toLowerCase(), passwordHash, {}],
    );
    return { id, username, passwordHash, data: {} };
  }

  async getData(userId: string): Promise<AppState> {
    await this.init();
    const r = await this.pool.query("SELECT data FROM users WHERE id = $1", [userId]);
    return r.rows[0]?.data ?? {};
  }

  async setData(userId: string, data: AppState): Promise<void> {
    await this.init();
    await this.pool.query("UPDATE users SET data = $1, updated_at = now() WHERE id = $2", [data, userId]);
  }
}

// ---- in-memory fallback ----

class MemoryStore implements Store {
  private users = new Map<string, UserRow>(); // keyed by id
  private byName = new Map<string, string>(); // lower -> id

  async init(): Promise<void> {}
  async getUserByUsername(username: string): Promise<UserRow | null> {
    const id = this.byName.get(username.toLowerCase());
    return id ? this.users.get(id) ?? null : null;
  }
  async getUserById(id: string): Promise<UserRow | null> {
    return this.users.get(id) ?? null;
  }
  async createUser(username: string, passwordHash: string): Promise<UserRow> {
    const id = newId();
    const row: UserRow = { id, username, passwordHash, data: {} };
    this.users.set(id, row);
    this.byName.set(username.toLowerCase(), id);
    return row;
  }
  async getData(userId: string): Promise<AppState> {
    return this.users.get(userId)?.data ?? {};
  }
  async setData(userId: string, data: AppState): Promise<void> {
    const u = this.users.get(userId);
    if (u) u.data = data;
  }
}

// ---- singleton selection (survives dev HMR via globalThis) ----

const g = globalThis as unknown as { __ipStore?: Store; __ipPool?: PgPool };

function needSSL(url: string): boolean {
  if (/sslmode=require/.test(url)) return true;
  if (process.env.PGSSL === "true") return true;
  // external Railway proxy hosts need SSL; internal *.railway.internal does not
  return /\.rlwy\.net|proxy\.rlwy/.test(url);
}

export function getStore(): Store {
  if (g.__ipStore) return g.__ipStore;
  const url = process.env.DATABASE_URL;
  if (url) {
    // require lazily so local runs without pg native issues still work
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Pool } = require("pg") as typeof import("pg");
    const pool =
      g.__ipPool ??
      new Pool({
        connectionString: url,
        ssl: needSSL(url) ? { rejectUnauthorized: false } : undefined,
        max: 5,
      });
    g.__ipPool = pool;
    g.__ipStore = new PgStore(pool);
  } else {
    g.__ipStore = new MemoryStore();
  }
  return g.__ipStore;
}

export function usingDatabase(): boolean {
  return !!process.env.DATABASE_URL;
}
