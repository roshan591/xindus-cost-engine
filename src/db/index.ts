import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from './schema'

const globalForDb = globalThis as unknown as { _db?: ReturnType<typeof makeDb> }

function makeDb() {
  // Parse URL manually to handle %40-encoded passwords correctly
  const u = new URL(process.env.DATABASE_URL!)
  const client = postgres({
    host: u.hostname,
    port: Number(u.port) || 5432,
    database: u.pathname.slice(1),
    username: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: 'require',
  })
  return drizzle(client, { schema })
}

export const db = globalForDb._db ?? makeDb()
if (process.env.NODE_ENV !== 'production') globalForDb._db = db

export type DB = typeof db
