require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || '103.182.211.219',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'techno_elevate',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'TestAdmin',
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL client error', err);
});

module.exports = pool;
