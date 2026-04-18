import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from './schema'

const globalForDb = globalThis as unknown as { _db?: ReturnType<typeof makeDb> }

function makeDb() {
  // Parse URL manually: strip sslmode, force IPv4 (Render can't reach Supabase over IPv6)
  const u = new URL(process.env.DATABASE_URL!)
  const pool = new Pool({
    host: u.hostname,
    port: Number(u.port) || 5432,
    database: u.pathname.slice(1),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    family: 4, // force IPv4
  })
  return drizzle(pool, { schema })
}

export const db = globalForDb._db ?? makeDb()
if (process.env.NODE_ENV !== 'production') globalForDb._db = db

export type DB = typeof db
