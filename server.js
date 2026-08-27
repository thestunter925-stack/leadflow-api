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


/* =====================================================
   SECURITY
===================================================== */

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


/* =====================================================
   BODY PARSER
===================================================== */

app.use(
  express.json({
    limit: "1mb"
  })
);


/* =====================================================
   API RATE LIMIT
===================================================== */

const apiLimiter =
  rateLimit({
    windowMs:
      15 * 60 * 1000,

    limit: 300,

    standardHeaders: true,

    legacyHeaders: false,

    message: {
      success: false,
      message:
        "Too many requests. Please try again later."
    }
  });


app.use(
  "/api",
  apiLimiter
);


/* =====================================================
   HOME
===================================================== */

app.get(
  "/",
  (req, res) => {

    res.json({

      success: true,

      service:
        "LeadFlow AI Backend",

      status:
        "online",

      version:
        "1.0.0"

    });

  }
);


/* =====================================================
   HEALTH CHECK
===================================================== */

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

        time:
          database.time

      });

    } catch (error) {

      console.error(
        "Health check failed:",
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


/* =====================================================
   APPLICATION ROUTES
===================================================== */

app.use(
  "/api",
  routes
);


/* =====================================================
   404 HANDLER
===================================================== */

app.use(
  (req, res) => {

    res.status(404).json({

      success: false,

      message:
        "Endpoint not found."

    });

  }
);


/* =====================================================
   GLOBAL ERROR HANDLER
===================================================== */

app.use(
  (error, req, res, next) => {

    console.error(
      "Unhandled server error:",
      error
    );

    res.status(500).json({

      success: false,

      message:
        "Internal server error."

    });

  }
);


/* =====================================================
   START
===================================================== */

async function startServer() {

  try {

    await checkDatabase();

    console.log(
      "PostgreSQL connection successful."
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
      "Server startup failed."
    );

    console.error(
      error.message
    );

    process.exit(1);

  }

}


startServer();