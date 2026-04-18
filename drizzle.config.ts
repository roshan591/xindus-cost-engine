import { defineConfig } from 'drizzle-kit'

const url = process.env.DATABASE_URL!
// Supabase requires SSL; append sslmode if not already present
const dbUrl = url && !url.includes('sslmode') ? `${url}?sslmode=require` : url

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: dbUrl },
})
