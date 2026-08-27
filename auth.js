const crypto = require("crypto");

const {
  query
} = require("./db");


/* =====================================================
   PASSWORD HASHING
===================================================== */

function hashPassword(password) {

  const salt =
    crypto.randomBytes(16);

  const hash =
    crypto.scryptSync(
      password,
      salt,
      64
    );

  return [
    salt.toString("hex"),
    hash.toString("hex")
  ].join(":");

}


/* =====================================================
   PASSWORD VERIFICATION
===================================================== */

function verifyPassword(
  password,
  storedPassword
) {

  try {

    const parts =
      String(
        storedPassword
      ).split(":");

    if (
      parts.length !== 2
    ) {

      return false;

    }

    const salt =
      Buffer.from(
        parts[0],
        "hex"
      );

    const storedHash =
      Buffer.from(
        parts[1],
        "hex"
      );

    const hash =
      crypto.scryptSync(
        password,
        salt,
        64
      );

    return (
      hash.length ===
        storedHash.length &&
      crypto.timingSafeEqual(
        hash,
        storedHash
      )
    );

  } catch {

    return false;

  }

}


/* =====================================================
   EMAIL VALIDATION
===================================================== */

function validEmail(
  email
) {

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    .test(
      String(email)
        .trim()
        .toLowerCase()
    );

}


/* =====================================================
   FIND USER
===================================================== */

async function findUserByEmail(
  email
) {

  const result =
    await query(
      `
      SELECT *
      FROM users
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1
      `,
      [
        String(email)
          .trim()
          .toLowerCase()
      ]
    );

  return (
    result.rows[0] ||
    null
  );

}


/* =====================================================
   FIND USER BY ID
===================================================== */

async function findUserById(
  userId
) {

  const result =
    await query(
      `
      SELECT
        id,
        email,
        role,
        plan,
        trial_started_at,
        trial_expires_at,
        premium_started_at,
        premium_expires_at,
        created_at
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [userId]
    );

  return (
    result.rows[0] ||
    null
  );

}


/* =====================================================
   CREATE USER
===================================================== */

async function createUser(
  email,
  password
) {

  const cleanEmail =
    String(email)
      .trim()
      .toLowerCase();

  if (
    !validEmail(
      cleanEmail
    )
  ) {

    throw new Error(
      "Enter a valid email address."
    );

  }

  if (
    typeof password !==
      "string" ||
    password.length < 8
  ) {

    throw new Error(
      "Password must contain at least 8 characters."
    );

  }

  const existing =
    await findUserByEmail(
      cleanEmail
    );

  if (existing) {

    throw new Error(
      "An account with this email already exists."
    );

  }

  const passwordHash =
    hashPassword(
      password
    );

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
        $1,
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
        premium_started_at,
        premium_expires_at,
        created_at
      `,
      [
        cleanEmail,
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
    ON CONFLICT (user_id)
    DO NOTHING
    `,
    [user.id]
  );

  return user;

}


/* =====================================================
   AUTHENTICATE USER
===================================================== */

async function authenticateUser(
  email,
  password
) {

  const cleanEmail =
    String(email)
      .trim()
      .toLowerCase();

  const user =
    await findUserByEmail(
      cleanEmail
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

    id:
      user.id,

    email:
      user.email,

    role:
      user.role,

    plan:
      user.plan,

    trial_started_at:
      user.trial_started_at,

    trial_expires_at:
      user.trial_expires_at,

    premium_started_at:
      user.premium_started_at,

    premium_expires_at:
      user.premium_expires_at

  };

}


/* =====================================================
   OWNER CHECK
===================================================== */

function isOwner(
  user
) {

  return Boolean(
    user &&
    user.role === "owner"
  );

}


/* =====================================================
   PUBLIC USER OBJECT
===================================================== */

function publicUser(
  user
) {

  if (!user) {
    return null;
  }

  return {

    id:
      user.id,

    email:
      user.email,

    role:
      user.role,

    plan:
      user.plan,

    trial_started_at:
      user.trial_started_at,

    trial_expires_at:
      user.trial_expires_at,

    premium_started_at:
      user.premium_started_at,

    premium_expires_at:
      user.premium_expires_at,

    created_at:
      user.created_at

  };

}


module.exports = {

  hashPassword,

  verifyPassword,

  validEmail,

  findUserByEmail,

  findUserById,

  createUser,

  authenticateUser,

  isOwner,

  publicUser

};