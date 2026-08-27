const crypto = require("crypto");

const {
  query
} = require("./db");

const {
  findUserById,
  publicUser
} = require("./auth");


/* =====================================================
   SESSION SETTINGS
===================================================== */

const SESSION_DAYS = 7;

const SESSION_MS =
  SESSION_DAYS *
  24 *
  60 *
  60 *
  1000;


/* =====================================================
   HASH TOKEN
===================================================== */

function hashToken(
  token
) {

  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

}


/* =====================================================
   CREATE SESSION
===================================================== */

async function createSession(
  userId
) {

  const token =
    crypto.randomBytes(48)
      .toString("hex");

  const tokenHash =
    hashToken(token);

  const expiresAt =
    new Date(
      Date.now() +
      SESSION_MS
    );

  await query(
    `
    INSERT INTO sessions (
      user_id,
      token_hash,
      expires_at
    )
    VALUES (
      $1,
      $2,
      $3
    )
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


/* =====================================================
   GET USER FROM TOKEN
===================================================== */

async function getUserFromToken(
  token
) {

  if (
    !token ||
    typeof token !== "string"
  ) {

    return null;

  }

  const tokenHash =
    hashToken(token);

  const result =
    await query(
      `
      SELECT
        user_id
      FROM sessions
      WHERE
        token_hash = $1
        AND expires_at > NOW()
      LIMIT 1
      `,
      [tokenHash]
    );

  if (
    !result.rows.length
  ) {

    return null;

  }

  const user =
    await findUserById(
      result.rows[0].user_id
    );

  if (!user) {

    return null;

  }

  return publicUser(
    user
  );

}


/* =====================================================
   DELETE SESSION
===================================================== */

async function deleteSession(
  token
) {

  if (
    !token
  ) {

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


/* =====================================================
   AUTH MIDDLEWARE
===================================================== */

async function requireAuth(
  req,
  res,
  next
) {

  try {

    const header =
      req.headers.authorization ||
      "";

    if (
      !header.startsWith(
        "Bearer "
      )
    ) {

      return res.status(401).json({

        success: false,

        message:
          "Authentication required."

      });

    }

    const token =
      header
        .substring(7)
        .trim();

    if (!token) {

      return res.status(401).json({

        success: false,

        message:
          "Authentication required."

      });

    }

    const user =
      await getUserFromToken(
        token
      );

    if (!user) {

      return res.status(401).json({

        success: false,

        message:
          "Session expired or invalid."

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

    res.status(500).json({

      success: false,

      message:
        "Authentication service unavailable."

    });

  }

}


/* =====================================================
   OWNER MIDDLEWARE
===================================================== */

function requireOwner(
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


/* =====================================================
   CLEAN EXPIRED SESSIONS
===================================================== */

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