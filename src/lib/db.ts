import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.');
}

// Neon's HTTP driver: one query per request, no pooled connection to manage.
// State-transition safety comes from single atomic UPDATE ... WHERE ... RETURNING
// statements (see actions.ts), not from client-side transactions.
export const sql = neon(process.env.DATABASE_URL);
