const crypto = require("crypto");
const { query } = require("./db");


/* ============================================
   PASSWORD HASHING
============================================ */

function hashPassword(password) {

  const salt =
    crypto.randomBytes(16).toString("hex");

  const hash =
    crypto
      .scryptSync(password, salt, 64)
      .toString("hex");

  return `${salt}:${hash}`;
}


function verifyPassword(
  password,
  storedPassword
) {

  const parts =
    String(storedPassword).split(":");

  if (parts.length !== 2) {
    return false;
  }

  const [salt, storedHash] =
    parts;

  const hash =
    crypto
      .scryptSync(password, salt, 64)
      .toString("hex");

  return crypto.timingSafeEqual(
    Buffer.from(hash, "hex"),
    Buffer.from(storedHash, "hex")
  );

}


/* ============================================
   EMAIL VALIDATION
============================================ */

function validEmail(email) {

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    .test(String(email));

}


/* ============================================
   FIND USER
============================================ */

async function findUserByEmail(email) {

  const result =
    await query(
      `
      SELECT *
      FROM users
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1
      `,
      [email]
    );

  return result.rows[0] || null;

}


/* ============================================
   CREATE USER
============================================ */

async function createUser(
  email,
  password
) {

  if (!validEmail(email)) {

    throw new Error(
      "Invalid email address."
    );

  }

  if (
    typeof password !== "string" ||
    password.length < 8
  ) {

    throw new Error(
      "Password must contain at least 8 characters."
    );

  }

  const existing =
    await findUserByEmail(email);

  if (existing) {

    throw new Error(
      "An account with this email already exists."
    );

  }

  const passwordHash =
    hashPassword(password);

  const result =
    await query(
      `
      INSERT INTO users (
        email,
        password_hash,
        role,
        plan,
        trial_started_at,
        trial_expires_at
      )
      VALUES (
        LOWER($1),
        $2,
        'user',
        'trial',
        NOW(),
        NOW() + INTERVAL '10 hours'
      )
      RETURNING
        id,
        email,
        role,
        plan,
        trial_started_at,
        trial_expires_at,
        created_at
      `,
      [
        email.trim(),
        passwordHash
      ]
    );

  const user =
    result.rows[0];

  await query(
    `
    INSERT INTO user_usage (
      user_id
    )
    VALUES ($1)
    `,
    [user.id]
  );

  return user;

}


/* ============================================
   AUTHENTICATE USER
============================================ */

async function authenticateUser(
  email,
  password
) {

  const user =
    await findUserByEmail(
      String(email).trim()
    );

  if (!user) {

    throw new Error(
      "Invalid email or password."
    );

  }

  const valid =
    verifyPassword(
      password,
      user.password_hash
    );

  if (!valid) {

    throw new Error(
      "Invalid email or password."
    );

  }

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    plan: user.plan,
    trialExpiresAt:
      user.trial_expires_at,
    premiumExpiresAt:
      user.premium_expires_at
  };

}


/* ============================================
   OWNER CHECK
============================================ */

function isOwner(user) {

  return Boolean(
    user &&
    user.role === "owner"
  );

}


module.exports = {

  hashPassword,

  verifyPassword,

  validEmail,

  findUserByEmail,

  createUser,

  authenticateUser,

  isOwner

};