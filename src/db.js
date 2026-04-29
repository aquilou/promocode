const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id             SERIAL PRIMARY KEY,
      email          TEXT UNIQUE NOT NULL,
      name           TEXT,
      password_hash  TEXT,
      google_id      TEXT UNIQUE,
      email_verified BOOLEAN     DEFAULT false,
      plan           TEXT        DEFAULT 'free',
      created_at     TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS tokens (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT        NOT NULL,
      type       TEXT        NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used       BOOLEAN     DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS odoo_configs (
      id           SERIAL PRIMARY KEY,
      user_id      INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
      url          TEXT        NOT NULL,
      database     TEXT        NOT NULL,
      login        TEXT        NOT NULL,
      api_key_enc  TEXT        NOT NULL,
      connected_at TIMESTAMPTZ DEFAULT NOW(),
      last_sync    TIMESTAMPTZ
    );
  `);
  console.log('DB lista');
}

module.exports = { pool, init };
