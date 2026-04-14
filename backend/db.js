require('dotenv').config();
const { Pool } = require('pg');

const isProduction = process.env.NODE_ENV === 'production';

const pool = new Pool({
  host:     process.env.DB_HOST     || '103.182.211.219',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'techno_elevate',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || 'TestAdmin',

  // Connection pool tuning
  max:                    parseInt(process.env.DB_POOL_MAX || '20'),   // max simultaneous DB connections
  min:                    parseInt(process.env.DB_POOL_MIN || '2'),    // keep warm connections alive
  idleTimeoutMillis:      parseInt(process.env.DB_IDLE_MS  || '30000'), // release idle connections after 30s
  connectionTimeoutMillis: parseInt(process.env.DB_CONN_TIMEOUT || '3000'), // fail fast if DB unreachable

  // SSL for production (set DB_SSL=true in .env on cloud/managed Postgres)
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected client error — connection lost:', err.message);
});

pool.on('connect', () => {
  if (!isProduction) console.log('[DB] New client connected to pool');
});

// Health-check helper used by /api/ping
pool.healthCheck = async () => {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
    return true;
  } finally {
    client.release();
  }
};

module.exports = pool;
