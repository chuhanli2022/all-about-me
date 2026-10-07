import { env } from 'cloudflare:workers';
export function database(){const db=(env as unknown as {DB:D1Database}).DB;if(!db)throw new Error('Game storage is temporarily unavailable. Please try again.');return db;}
export function bucket(){const b=(env as unknown as {BUCKET:R2Bucket}).BUCKET;if(!b)throw new Error('Photo storage is temporarily unavailable.');return b;}
