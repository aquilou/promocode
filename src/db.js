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
    CREATE TABLE IF NOT EXISTS profiles (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
      name        TEXT        NOT NULL,
      handle      TEXT        NOT NULL,
      initials    TEXT        NOT NULL,
      type        TEXT        NOT NULL DEFAULT 'influencer',
      platform    TEXT        NOT NULL DEFAULT 'Instagram',
      followers   TEXT        DEFAULT '0',
      engagement  TEXT        DEFAULT '0%',
      bio         TEXT        DEFAULT '',
      email       TEXT        DEFAULT '',
      status      TEXT        NOT NULL DEFAULT 'active',
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS campaigns (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
      name        TEXT        NOT NULL,
      type        TEXT        NOT NULL DEFAULT 'propia',
      status      TEXT        NOT NULL DEFAULT 'active',
      start_date  DATE,
      end_date    DATE,
      ecommerce   TEXT        DEFAULT 'Odoo',
      budget      NUMERIC(12,2) DEFAULT 0,
      description TEXT        DEFAULT '',
      color       TEXT        DEFAULT '#9e825a',
      color_bg    TEXT        DEFAULT 'rgba(158,130,90,.15)',
      icon        TEXT        DEFAULT '📢',
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS codes (
      id              SERIAL PRIMARY KEY,
      user_id         INTEGER REFERENCES users(id) ON DELETE CASCADE,
      profile_id      INTEGER REFERENCES profiles(id) ON DELETE SET NULL,
      campaign_id     INTEGER REFERENCES campaigns(id) ON DELETE SET NULL,
      code            TEXT        NOT NULL,
      type            TEXT        NOT NULL DEFAULT 'Influencer',
      platform        TEXT        DEFAULT 'Instagram',
      discount        TEXT        NOT NULL DEFAULT '10%',
      uses            INTEGER     DEFAULT 0,
      max_uses        INTEGER     DEFAULT 500,
      conv_rate       NUMERIC(5,2) DEFAULT 0,
      sales           NUMERIC(12,2) DEFAULT 0,
      avg_ticket      NUMERIC(10,2) DEFAULT 0,
      ecommerce       TEXT        DEFAULT 'Odoo',
      expires_at      DATE,
      status          TEXT        NOT NULL DEFAULT 'active',
      odoo_program_id INTEGER,
      created_at      TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, code)
    );
  `);
  console.log('DB lista');
}

module.exports = { pool, init };
