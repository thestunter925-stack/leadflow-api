const crypto = require("crypto");
const { query } = require("./db");


/* ============================================
   SESSION CONFIG
============================================ */

const SESSION_HOURS = 24 * 7;


/* ============================================
   CREATE SESSION
============================================ */

async function createSession(userId) {

  const token =
    crypto.randomBytes(48).toString("hex");

  const expiresAt =
    new Date(
      Date.now() +
      SESSION_HOURS *
      60 *
      60 *
      1000
    );

  /*
    Store only a hash of the session token
    in the database.
  */

  const tokenHash =
    crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

  await query(
    `
    CREATE TABLE IF NOT EXISTS sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

      user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

      token_hash TEXT UNIQUE NOT NULL,

      expires_at TIMESTAMPTZ NOT NULL,

      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    `
  );

  await query(
    `
    INSERT INTO sessions (
      user_id,
      token_hash,
      expires_at
    )
    VALUES ($1, $2, $3)
    `,
    [
      userId,
      tokenHash,
      expiresAt
    ]
  );

  return {
    token,
    expiresAt
  };

}


/* ============================================
   HASH SESSION TOKEN
============================================ */

function hashToken(token) {

  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

}


/* ============================================
   GET USER FROM SESSION
============================================ */

async function getUserFromToken(token) {

  if (!token) {
    return null;
  }

  const tokenHash =
    hashToken(token);

  const result =
    await query(
      `
      SELECT
        u.id,
        u.email,
        u.role,
        u.plan,
        u.trial_started_at,
        u.trial_expires_at,
        u.premium_started_at,
        u.premium_expires_at
      FROM sessions s
      JOIN users u
        ON u.id = s.user_id
      WHERE
        s.token_hash = $1
        AND s.expires_at > NOW()
      LIMIT 1
      `,
      [tokenHash]
    );

  return result.rows[0] || null;

}


/* ============================================
   DELETE SESSION
============================================ */

async function deleteSession(token) {

  if (!token) {
    return;
  }

  const tokenHash =
    hashToken(token);

  await query(
    `
    DELETE FROM sessions
    WHERE token_hash = $1
    `,
    [tokenHash]
  );

}


/* ============================================
   AUTH MIDDLEWARE
============================================ */

async function requireAuth(
  req,
  res,
  next
) {

  try {

    const header =
      req.headers.authorization || "";

    let token = null;

    if (
      header.startsWith("Bearer ")
    ) {

      token =
        header.substring(7).trim();

    }

    /*
      Also support an HTTP-only cookie
      if the server later enables cookies.
    */

    if (
      !token &&
      req.cookies
    ) {

      token =
        req.cookies.session || null;

    }

    const user =
      await getUserFromToken(token);

    if (!user) {

      return res.status(401).json({

        success: false,

        message:
          "Authentication required."

      });

    }

    req.user =
      user;

    req.sessionToken =
      token;

    next();

  } catch (error) {

    console.error(
      "Authentication error:",
      error
    );

    return res.status(500).json({

      success: false,

      message:
        "Authentication service unavailable."

    });

  }

}


/* ============================================
   OWNER MIDDLEWARE
============================================ */

async function requireOwner(
  req,
  res,
  next
) {

  if (
    !req.user ||
    req.user.role !== "owner"
  ) {

    return res.status(403).json({

      success: false,

      message:
        "Owner authorization required."

    });

  }

  next();

}


/* ============================================
   CLEAN EXPIRED SESSIONS
============================================ */

async function cleanExpiredSessions() {

  await query(
    `
    DELETE FROM sessions
    WHERE expires_at <= NOW()
    `
  );

}


module.exports = {

  createSession,

  getUserFromToken,

  deleteSession,

  requireAuth,

  requireOwner,

  cleanExpiredSessions

};