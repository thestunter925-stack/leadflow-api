const express = require("express");

const {
  query
} = require("./db");

const {
  requireAuth,
  requireOwner
} = require("./session");

const router =
  express.Router();


/* =====================================================
   ACCOUNT
===================================================== */

router.get(
  "/account",
  requireAuth,
  async (req, res) => {

    res.json({
      success: true,
      user: req.user
    });

  }
);


/* =====================================================
   USAGE
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

      let hoursRemaining = 0;

      if (
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
            ) /
            3600000
          );

      }

      res.json({

        success: true,

        unlimited:
          owner,

        hoursRemaining:
          owner
            ? null
            : Math.round(
                hoursRemaining
              ),

        prospectsRemaining:
          owner
            ? null
            : Math.max(
                0,
                10 -
                usage.prospect_searches
              ),

        ...usage

      });

    } catch (error) {

      console.error(
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

    } catch {

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
        `,
        [
          req.user.id,
          req.params.id
        ]
      );

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

      res.json({

        success: true,

        message:
          "Prospect saved."

      });

    } catch {

      res.status(400).json({

        success: false,

        message:
          "Unable to save prospect."

      });

    }

  }
);


/* =====================================================
   UPDATE LEAD STATUS
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
        req.body.status || ""
      ).toLowerCase();

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

    } catch {

      res.status(400).json({

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

    const {
      leadId
    } = req.body;

    if (!leadId) {

      return res.status(400).json({

        success: false,

        message:
          "leadId is required."

      });

    }

    /*
      AI provider will be connected here.
      Do not expose an AI API key in index.html.
    */

    res.status(501).json({

      success: false,

      message:
        "AI provider is not connected yet."

    });

  }
);


/* =====================================================
   OWNER DASHBOARD
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
          SELECT COUNT(*) AS count
          FROM users
          `
        );

      const prospects =
        await query(
          `
          SELECT COUNT(*) AS count
          FROM prospects
          `
        );

      const payments =
        await query(
          `
          SELECT
            COUNT(*) AS count,
            COALESCE(
              SUM(amount),
              0
            ) AS total
          FROM payments
          WHERE status = 'paid'
          `
        );

      res.json({

        success: true,

        users:
          Number(
            users.rows[0].count
          ),

        prospects:
          Number(
            prospects.rows[0].count
          ),

        payments:
          Number(
            payments.rows[0].count
          ),

        revenue:
          Number(
            payments.rows[0].total
          )

      });

    } catch {

      res.status(500).json({

        success: false,

        message:
          "Unable to load owner statistics."

      });

    }

  }
);


/* =====================================================
   OWNER USERS
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

    } catch {

      res.status(500).json({

        success: false,

        message:
          "Unable to load users."

      });

    }

  }
);


/* =====================================================
   EXPORT
===================================================== */

module.exports =
  router;