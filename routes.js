const express = require("express");

const {
  query
} = require("./db");

const {
  createUser,
  authenticateUser,
  publicUser
} = require("./auth");

const {
  createSession,
  deleteSession,
  requireAuth,
  requireOwner
} = require("./session");

const router = express.Router();


/* =====================================================
   AUTH — CREATE ACCOUNT
===================================================== */

router.post(
  "/auth/signup",
  async (req, res) => {

    try {

      const {
        email,
        password
      } = req.body || {};

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

        user:
          publicUser(user),

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


/* =====================================================
   AUTH — LOGIN
===================================================== */

router.post(
  "/auth/login",
  async (req, res) => {

    try {

      const {
        email,
        password
      } = req.body || {};

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

        user:
          publicUser(user),

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


/* =====================================================
   AUTH — LOGOUT
===================================================== */

router.post(
  "/auth/logout",
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


/* =====================================================
   CURRENT USER
===================================================== */

router.get(
  "/me",
  requireAuth,
  (req, res) => {

    res.json({

      success: true,

      user:
        req.user

    });

  }
);


/* =====================================================
   USAGE / TRIAL
===================================================== */

router.get(
  "/usage",
  requireAuth,
  async (req, res) => {

    try {

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

      const owner =
        req.user.role === "owner";

      let hoursRemaining =
        null;

      if (
        !owner &&
        req.user.trial_expires_at
      ) {

        hoursRemaining =
          Math.max(
            0,
            (
              new Date(
                req.user.trial_expires_at
              ).getTime() -
              Date.now()
            ) / 3600000
          );

      }

      res.json({

        success: true,

        unlimited:
          owner,

        hoursRemaining:

          owner
            ? null
            : Math.ceil(
                hoursRemaining || 0
              ),

        prospectsRemaining:

          owner
            ? null
            : Math.max(
                0,
                10 -
                usage.prospect_searches
              ),

        prospectSearches:
          usage.prospect_searches,

        prospectsViewed:
          usage.prospects_viewed,

        savedLeads:
          usage.saved_leads,

        outreachGenerated:
          usage.outreach_generated

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


/* =====================================================
   PROSPECTS
===================================================== */

router.get(
  "/leads",
  requireAuth,
  async (req, res) => {

    try {

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
        "Leads error:",
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


/* =====================================================
   SINGLE PROSPECT
===================================================== */

router.get(
  "/leads/:id",
  requireAuth,
  async (req, res) => {

    try {

      const result =
        await query(
          `
          SELECT *
          FROM prospects
          WHERE id = $1
          `,
          [req.params.id]
        );

      if (!result.rows[0]) {

        return res.status(404).json({

          success: false,

          message:
            "Prospect not found."

        });

      }

      res.json({

        success: true,

        lead:
          result.rows[0]

      });

    } catch (error) {

      res.status(400).json({

        success: false,

        message:
          "Invalid prospect ID."

      });

    }

  }
);


/* =====================================================
   SAVE PROSPECT
===================================================== */

router.post(
  "/leads/:id/save",
  requireAuth,
  async (req, res) => {

    try {

      const lead =
        await query(
          `
          SELECT id
          FROM prospects
          WHERE id = $1
          `,
          [req.params.id]
        );

      if (!lead.rows[0]) {

        return res.status(404).json({

          success: false,

          message:
            "Prospect not found."

        });

      }

      const saved =
        await query(
          `
          INSERT INTO saved_leads (
            user_id,
            prospect_id
          )
          VALUES ($1, $2)
          ON CONFLICT (
            user_id,
            prospect_id
          )
          DO NOTHING
          RETURNING id
          `,
          [
            req.user.id,
            req.params.id
          ]
        );

      if (saved.rows.length) {

        await query(
          `
          UPDATE user_usage
          SET
            saved_leads =
              saved_leads + 1,
            updated_at =
              NOW()
          WHERE user_id = $1
          `,
          [req.user.id]
        );

      }

      res.json({

        success: true,

        saved:
          true

      });

    } catch (error) {

      console.error(
        "Save lead error:",
        error
      );

      res.status(500).json({

        success: false,

        message:
          "Unable to save prospect."

      });

    }

  }
);


/* =====================================================
   LEAD STATUS
===================================================== */

router.patch(
  "/leads/:id/status",
  requireAuth,
  async (req, res) => {

    const allowed = [

      "new",
      "contacted",
      "replied",
      "meeting",
      "won",
      "lost"

    ];

    const status =
      String(
        req.body?.status || ""
      )
      .toLowerCase()
      .trim();

    if (
      !allowed.includes(status)
    ) {

      return res.status(400).json({

        success: false,

        message:
          "Invalid lead status."

      });

    }

    try {

      const result =
        await query(
          `
          UPDATE prospects
          SET
            status = $1,
            updated_at = NOW()
          WHERE id = $2
          RETURNING *
          `,
          [
            status,
            req.params.id
          ]
        );

      if (!result.rows[0]) {

        return res.status(404).json({

          success: false,

          message:
            "Prospect not found."

        });

      }

      res.json({

        success: true,

        lead:
          result.rows[0]

      });

    } catch (error) {

      console.error(
        "Status update error:",
        error
      );

      res.status(500).json({

        success: false,

        message:
          "Unable to update lead."

      });

    }

  }
);


/* =====================================================
   OUTREACH
===================================================== */

router.post(
  "/outreach/generate",
  requireAuth,
  async (req, res) => {

    try {

      const {
        leadId
      } = req.body || {};

      if (!leadId) {

        return res.status(400).json({

          success: false,

          message:
            "leadId is required."

        });

      }

      const result =
        await query(
          `
          SELECT *
          FROM prospects
          WHERE id = $1
          `,
          [leadId]
        );

      if (!result.rows[0]) {

        return res.status(404).json({

          success: false,

          message:
            "Prospect not found."

        });

      }

      /*
       * AI provider will be connected here.
       * API keys must remain on the backend.
       */

      res.status(501).json({

        success: false,

        message:
          "AI outreach provider is not configured yet."

      });

    } catch (error) {

      console.error(
        "Outreach error:",
        error
      );

      res.status(500).json({

        success: false,

        message:
          "Unable to generate outreach."

      });

    }

  }
);


/* =====================================================
   PAYMENT — CREATE CHECKOUT
===================================================== */

router.post(
  "/payment/create",
  requireAuth,
  async (req, res) => {

    /*
     * A real payment gateway must be connected
     * before accepting real money.
     *
     * Never trust a frontend payment-success flag.
     */

    res.status(501).json({

      success: false,

      message:
        "Payment gateway is not configured."

    });

  }
);


/* =====================================================
   PAYMENT — STATUS
===================================================== */

router.get(
  "/payment/status",
  requireAuth,
  async (req, res) => {

    try {

      const result =
        await query(
          `
          SELECT
            plan,
            premium_started_at,
            premium_expires_at
          FROM users
          WHERE id = $1
          `,
          [req.user.id]
        );

      const user =
        result.rows[0];

      res.json({

        success: true,

        premium:
          user?.plan ===
          "premium",

        plan:
          user?.plan || "trial",

        premiumStartedAt:
          user?.premium_started_at ||
          null,

        premiumExpiresAt:
          user?.premium_expires_at ||
          null

      });

    } catch (error) {

      console.error(
        "Payment status error:",
        error
      );

      res.status(500).json({

        success: false,

        message:
          "Unable to check payment status."

      });

    }

  }
);


/* =====================================================
   PAYMENT WEBHOOK
===================================================== */

router.post(
  "/payment/webhook",
  async (req, res) => {

    /*
     * IMPORTANT:
     * Do not activate Premium from the
     * browser. A payment provider webhook
     * must be signature-verified here.
     */

    res.status(501).json({

      success: false,

      message:
        "Verified payment webhook is not configured."

    });

  }
);


/* =====================================================
   OWNER — STATISTICS
===================================================== */

router.get(
  "/owner/stats",
  requireAuth,
  requireOwner,
  async (req, res) => {

    try {

      const users =
        await query(
          `
          SELECT COUNT(*)::int AS count
          FROM users
          `
        );

      const prospects =
        await query(
          `
          SELECT COUNT(*)::int AS count
          FROM prospects
          `
        );

      const payments =
        await query(
          `
          SELECT
            COUNT(*)::int AS count,
            COALESCE(
              SUM(amount),
              0
            )::int AS total
          FROM payments
          WHERE status = 'paid'
          `
        );

      res.json({

        success: true,

        users:
          users.rows[0].count,

        prospects:
          prospects.rows[0].count,

        payments:
          payments.rows[0].count,

        revenue:
          payments.rows[0].total

      });

    } catch (error) {

      console.error(
        "Owner statistics error:",
        error
      );

      res.status(500).json({

        success: false,

        message:
          "Unable to load owner statistics."

      });

    }

  }
);


/* =====================================================
   OWNER — USERS
===================================================== */

router.get(
  "/owner/users",
  requireAuth,
  requireOwner,
  async (req, res) => {

    try {

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
          ORDER BY created_at DESC
          LIMIT 500
          `
        );

      res.json({

        success: true,

        users:
          result.rows

      });

    } catch (error) {

      console.error(
        "Owner users error:",
        error
      );

      res.status(500).json({

        success: false,

        message:
          "Unable to load users."

      });

    }

  }
);


module.exports =
  router;