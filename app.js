require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const routes = require("./routes");
const { checkDatabase } = require("./db");

const app = express();

const PORT = Number(
  process.env.PORT || 3000
);


/* =========================================
   SECURITY
========================================= */

app.disable("x-powered-by");

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


/* =========================================
   JSON
========================================= */

app.use(
  express.json({
    limit: "1mb"
  })
);


/* =========================================
   RATE LIMIT
========================================= */

const limiter =
  rateLimit({
    windowMs:
      15 * 60 * 1000,

    limit: 300,

    standardHeaders: true,

    legacyHeaders: false,

    message: {
      success: false,
      message:
        "Too many requests. Try again later."
    }
  });

app.use(
  "/api",
  limiter
);


/* =========================================
   HOME
========================================= */

app.get(
  "/",
  (req, res) => {

    res.json({
      success: true,
      name: "LeadFlow AI",
      status: "online"
    });

  }
);


/* =========================================
   HEALTH CHECK
========================================= */

app.get(
  "/api/health",
  async (req, res) => {

    try {

      const database =
        await checkDatabase();

      res.json({

        success: true,

        api: "online",

        database: "connected",

        time:
          database.time

      });

    } catch (error) {

      console.error(
        "Database health error:",
        error
      );

      res.status(503).json({

        success: false,

        api: "online",

        database:
          "unavailable"

      });

    }

  }
);


/* =========================================
   APPLICATION ROUTES
========================================= */

app.use(
  "/api",
  routes
);


/* =========================================
   404
========================================= */

app.use(
  (req, res) => {

    res.status(404).json({

      success: false,

      message:
        "Endpoint not found."

    });

  }
);


/* =========================================
   ERROR HANDLER
========================================= */

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


/* =========================================
   START
========================================= */

async function start() {

  try {

    await checkDatabase();

    console.log(
      "PostgreSQL connected."
    );

    app.listen(
      PORT,
      () => {

        console.log(
          `LeadFlow AI running on port ${PORT}`
        );

      }
    );

  } catch (error) {

    console.error(
      "Could not connect to PostgreSQL."
    );

    console.error(
      error.message
    );

    process.exit(1);

  }

}


start();