require("dotenv").config();

const { pool } = require("./db");

const schema = `
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'user'
    CHECK (role IN ('user', 'owner')),
  plan VARCHAR(20) NOT NULL DEFAULT 'trial'
    CHECK (plan IN ('trial', 'premium')),
  trial_started_at TIMESTAMPTZ,
  trial_expires_at TIMESTAMPTZ,
  premium_started_at TIMESTAMPTZ,
  premium_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_usage (
  user_id UUID PRIMARY KEY
    REFERENCES users(id)
    ON DELETE CASCADE,
  prospect_searches INTEGER NOT NULL DEFAULT 0,
  prospects_viewed INTEGER NOT NULL DEFAULT 0,
  saved_leads INTEGER NOT NULL DEFAULT 0,
  outreach_generated INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL
    REFERENCES users(id)
    ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prospects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  website TEXT,
  country TEXT,
  industry TEXT,
  company_size TEXT,
  decision_maker_name TEXT,
  decision_maker_title TEXT,
  linkedin_url TEXT,
  company_linkedin_url TEXT,
  source_url TEXT,
  verification_status VARCHAR(30)
    NOT NULL DEFAULT 'unverified',
  status VARCHAR(30)
    NOT NULL DEFAULT 'new',
  fit_score INTEGER,
  qualification_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS saved_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL
    REFERENCES users(id)
    ON DELETE CASCADE,
  prospect_id UUID NOT NULL
    REFERENCES prospects(id)
    ON DELETE CASCADE,
  lead_status VARCHAR(30) NOT NULL DEFAULT 'new',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, prospect_id)
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL
    REFERENCES users(id)
    ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  provider_customer_id TEXT,
  provider_subscription_id TEXT UNIQUE,
  plan VARCHAR(50) NOT NULL,
  amount INTEGER NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  status VARCHAR(30) NOT NULL DEFAULT 'created',
  started_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL
    REFERENCES users(id)
    ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  provider_payment_id TEXT UNIQUE,
  provider_order_id TEXT,
  amount INTEGER NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  status VARCHAR(30) NOT NULL DEFAULT 'created',
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS outreach_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL
    REFERENCES users(id)
    ON DELETE CASCADE,
  prospect_id UUID
    REFERENCES prospects(id)
    ON DELETE SET NULL,
  channel VARCHAR(30) NOT NULL DEFAULT 'linkedin',
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email
ON users(email);

CREATE INDEX IF NOT EXISTS idx_prospects_country
ON prospects(country);

CREATE INDEX IF NOT EXISTS idx_prospects_industry
ON prospects(industry);

CREATE INDEX IF NOT EXISTS idx_prospects_status
ON prospects(status);

CREATE INDEX IF NOT EXISTS idx_saved_leads_user
ON saved_leads(user_id);

CREATE INDEX IF NOT EXISTS idx_payments_user
ON payments(user_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user
ON subscriptions(user_id);

CREATE INDEX IF NOT EXISTS idx_sessions_token
ON sessions(token_hash);

CREATE INDEX IF NOT EXISTS idx_sessions_user
ON sessions(user_id);
`;


async function migrate() {

  try {

    console.log(
      "Starting LeadFlow AI database migration..."
    );

    if (!process.env.DATABASE_URL) {

      throw new Error(
        "DATABASE_URL is not configured."
      );

    }

    await pool.query(schema);

    console.log(
      "Database migration completed successfully."
    );

  } catch (error) {

    console.error(
      "Database migration failed:",
      error
    );

    process.exitCode = 1;

  } finally {

    await pool.end();

  }

}


migrate();