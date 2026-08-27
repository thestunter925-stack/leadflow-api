require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const {
  createUser,
  authenticateUser
} = require("./auth");

const {
  createSession,
  deleteSession,
  requireAuth
} = require("./session");

const {
  checkDatabase
} = require("./db");


const app = express();

const PORT =
  process.env.PORT || 3000;


/* ============================================
   SECURITY / MIDDLEWARE
============================================ */

app.use(
  helmet()
);

app.use(
  cors({
    origin:
      process.env.FRONTEND_URL || true,

    credentials: true
  })
);

app.use(
  express.json({
    limit: "1mb"
  })
);


/* ============================================
   HEALTH
============================================ */

app.get("/", (req, res) => {

  res.json({

    success: true,

    service:
      "LeadFlow AI Backend",

    status:
      "online"

  });

});


app.get(
  "/api/health",
  async (req, res) => {

    try {

      const database =
        await checkDatabase();

      res.json({

        success: true,

        api:
          "online",

        database:
          "connected",

        serverTime:
          database.time

      });

    } catch (error) {

      console.error(
        "Database health error:",
        error
      );

      res.status(503).json({

        success: false,

        api:
          "online",

        database:
          "unavailable"

      });

    }

  }
);


/* ============================================
   SIGNUP
============================================ */

app.post(
  "/api/auth/signup",
  async (req, res) => {

    try {

      const {
        email,
        password
      } = req.body;

      if (!email || !password) {

        return res.status(400).json({

          success: false,

          message:
            "Email and password are required."

        });

      }

      const user =
        await createUser(
          email,
          password
        );

      const session =
        await createSession(
          user.id
        );

      res.status(201).json({

        success: true,

        user,

        token:
          session.token,

        expiresAt:
          session.expiresAt

      });

    } catch (error) {

      console.error(
        "Signup error:",
        error
      );

      res.status(400).json({

        success: false,

        message:
          error.message ||
          "Unable to create account."

      });

    }

  }
);


/* ============================================
   LOGIN
============================================ */

app.post(
  "/api/auth/login",
  async (req, res) => {

    try {

      const {
        email,
        password
      } = req.body;

      if (!email || !password) {

        return res.status(400).json({

          success: false,

          message:
            "Email and password are required."

        });

      }

      const user =
        await authenticateUser(
          email,
          password
        );

      const session =
        await createSession(
          user.id
        );

      res.json({

        success: true,

        user,

        token:
          session.token,

        expiresAt:
          session.expiresAt

      });

    } catch (error) {

      console.error(
        "Login error:",
        error
      );

      res.status(401).json({

        success: false,

        message:
          "Invalid email or password."

      });

    }

  }
);


/* ============================================
   LOGOUT
============================================ */

app.post(
  "/api/auth/logout",
  requireAuth,
  async (req, res) => {

    try {

      await deleteSession(
        req.sessionToken
      );

      res.json({

        success: true,

        message:
          "Logged out successfully."

      });

    } catch (error) {

      console.error(
        "Logout error:",
        error
      );

      res.status(500).json({

        success: false,

        message:
          "Unable to logout."

      });

    }

  }
);


/* ============================================
   CURRENT USER
============================================ */

app.get(
  "/api/me",
  requireAuth,
  (req, res) => {

    res.json({

      success: true,

      user:
        req.user

    });

  }
);


/* ============================================
   USAGE
============================================ */

app.get(
  "/api/usage",
  requireAuth,
  async (req, res) => {

    try {

      const {
        query
      } = require("./db");

      const result =
        await query(
          `
          SELECT
            prospect_searches,
            prospects_viewed,
            saved_leads,
            outreach_generated
          FROM user_usage
          WHERE user_id = $1
          `,
          [req.user.id]
        );

      const usage =
        result.rows[0] || {

          prospect_searches: 0,

          prospects_viewed: 0,

          saved_leads: 0,

          outreach_generated: 0

        };

      const unlimited =
        req.user.role ===
        "owner";

      res.json({

        success: true,

        unlimited,

        prospectsRemaining:
          unlimited
            ? null
            : Math.max(
                0,
                10 -
                usage.prospect_searches
              ),

        hoursRemaining:
          unlimited
            ? null
            : calculateHoursRemaining(
                req.user
              ),

        ...usage

      });

    } catch (error) {

      console.error(
        "Usage error:",
        error
      );

      res.status(500).json({

        success: false,

        message:
          "Unable to load usage."

      });

    }

  }
);


/* ============================================
   PROSPECTS
============================================ */

app.get(
  "/api/leads",
  requireAuth,
  async (req, res) => {

    try {

      const {
        query
      } = require("./db");

      const result =
        await query(
          `
          SELECT *
          FROM prospects
          ORDER BY created_at DESC
          LIMIT 100
          `
        );

      res.json({

        success: true,

        leads:
          result.rows

      });

    } catch (error) {

      console.error(
        "Lead error:",
        error
      );

      res.status(500).json({

        success: false,

        message:
          "Unable to load prospects."

      });

    }

  }
);


/* ============================================
   SEARCH PLACEHOLDER
============================================ */

app.post(
  "/api/leads/search",
  requireAuth,
  (req, res) => {

    res.status(501).json({

      success: false,

      message:
        "A legitimate prospect data provider has not been connected yet."

    });

  }
);


/* ============================================
   PAYMENT PLACEHOLDER
============================================ */

app.post(
  "/api/payment/create",
  requireAuth,
  (req, res) => {

    res.status(501).json({

      success: false,

      message:
        "Payment provider integration is not configured yet."

    });

  }
);


/* ============================================
   PAYMENT STATUS
============================================ */

app.get(
  "/api/payment/status",
  requireAuth,
  (req, res) => {

    res.json({

      success: true,

      premium:
        req.user.role === "owner" ||
        req.user.plan === "premium",

      user:
        req.user

    });

  }
);


/* ============================================
   404
============================================ */

app.use(
  (req, res) => {

    res.status(404).json({

      success: false,

      message:
        "API endpoint not found."

    });

  }
);


/* ============================================
   ERROR HANDLER
============================================ */

app.use(
  (error, req, res, next) => {

    console.error(
      "Server error:",
      error
    );

    res.status(500).json({

      success: false,

      message:
        "Internal server error."

    });

  }
);


/* ============================================
   TRIAL HOURS
============================================ */

function calculateHoursRemaining(
  user
) {

  if (
    !user.trial_expires_at
  ) {

    return 0;

  }

  const difference =
    new Date(
      user.trial_expires_at
    ).getTime() -
    Date.now();

  return Math.max(
    0,
    Math.round(
      difference /
      (1000 * 60 * 60)
    )
  );

}


/* ============================================
   START
============================================ */

app.listen(
  PORT,
  () => {

    console.log(
      `LeadFlow AI Backend running on port ${PORT}`
    );

  }
);