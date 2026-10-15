import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

// This file is strictly internal. 
// Do not export the pool or db instance directly to other packages.

if (!process.env['DATABASE_URL']) {
  throw new Error('DATABASE_URL is not set');
}

const rawUrl = process.env['DATABASE_URL'] || '';
const cleanUrl = rawUrl.replace(/([?&])sslmode=[^&]*(&?)/, (match, p1, p2) => {
  return p1 === '?' && p2 ? '?' : '';
});

const pool = new Pool({
  connectionString: cleanUrl,
  ssl: {
    rejectUnauthorized: false,
  },
});

export const db = drizzle(pool, { schema });
export type DbClient = typeof db;
