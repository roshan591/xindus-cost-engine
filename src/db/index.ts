import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from './schema'

const globalForDb = globalThis as unknown as { _db?: ReturnType<typeof makeDb> }

function makeDb() {
  // Strip sslmode from URL to avoid conflict with explicit ssl option
  const url = process.env.DATABASE_URL!.replace(/[?&]sslmode=[^&]*/g, '').replace(/[?&]$/, '')
  const client = postgres(url, {
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
