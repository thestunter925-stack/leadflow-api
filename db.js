const { Pool } = require("pg");

const connectionString =
  process.env.DATABASE_URL;

if (!connectionString) {
  console.warn(
    "DATABASE_URL is not configured."
  );
}

const pool = new Pool({
  connectionString,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false
});

pool.on("error", (error) => {
  console.error(
    "Unexpected database error:",
    error
  );
});

async function query(text, params) {
  return pool.query(text, params);
}

async function checkDatabase() {
  const result = await pool.query(
    "SELECT NOW() AS time"
  );

  return result.rows[0];
}

module.exports = {
  pool,
  query,
  checkDatabase
};