import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from './schema'

const globalForDb = globalThis as unknown as { _db?: ReturnType<typeof makeDb> }

function makeDb() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  })
  return drizzle(pool, { schema })
}

export const db = globalForDb._db ?? makeDb()
if (process.env.NODE_ENV !== 'production') globalForDb._db = db

export type DB = typeof db
