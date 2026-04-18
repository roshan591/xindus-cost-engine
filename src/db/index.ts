import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from './schema'

const globalForDb = globalThis as unknown as { _db?: ReturnType<typeof makeDb> }

function makeDb() {
  const client = postgres(process.env.DATABASE_URL!, {
    max: 1,
    ssl: { rejectUnauthorized: false },
    prepare: false, // required for Supabase transaction-mode pooler
  })
  return drizzle(client, { schema })
}

export const db = globalForDb._db ?? makeDb()
if (process.env.NODE_ENV !== 'production') globalForDb._db = db

export type DB = typeof db
