require("dotenv").config();

const { Pool } = require("pg");

const databaseUrl =
  process.env.DATABASE_URL;

if (!databaseUrl) {
  console.warn(
    "WARNING: DATABASE_URL is not configured."
  );
}

const pool = new Pool({
  connectionString: databaseUrl,

  ssl:
    process.env.NODE_ENV === "production"
      ? {
          rejectUnauthorized: false
        }
      : false,

  max: 10,

  idleTimeoutMillis: 30000,

  connectionTimeoutMillis: 10000
});


pool.on(
  "error",
  (error) => {

    console.error(
      "Unexpected PostgreSQL error:",
      error
    );

  }
);


async function query(
  text,
  params = []
) {

  return pool.query(
    text,
    params
  );

}


async function checkDatabase() {

  const result =
    await pool.query(
      "SELECT NOW() AS time"
    );

  return result.rows[0];

}


async function closeDatabase() {

  await pool.end();

}


module.exports = {

  pool,

  query,

  checkDatabase,

  closeDatabase

};