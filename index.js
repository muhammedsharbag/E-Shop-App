const path = require("path");
const bodyParser = require('body-parser');

const express = require("express");
const dotenv = require("dotenv");
const morgan = require("morgan");

dotenv.config({ path: "config.env" });
const compression = require('compression')
const cors = require("cors")
const ApiError = require("./utils/apiError");
const globalError = require("./middlewares/errorMiddleware");
const dbConnection = require("./config/database");
const mountRoutes  = require("./routes/mountRoutes");
const { webhookCheckout } = require("./services/orderService");

dbConnection();

// express app
const app = express();
// Middlewares
app.use(express.json());
//enable all domains to access your application
app.use(cors());
app.options('*',cors())
// compress all responses
app.use(compression())
//checkout webhook
app.post(
  '/webhook-checkout',
  express.raw({ type: 'application/json' }), // This middleware is ONLY for the webhook route
  webhookCheckout
);

app.use(express.static(path.join(__dirname, "uploads")));
const logFormat = process.env.NODE_ENV === "production" ? "combined" : "dev";
app.use(morgan(logFormat));
if (process.env.NODE_ENV === "development") {
  console.log("Logging mode: development");
} else {
  console.log("Logging mode: production");
}
mountRoutes(app);
app.all("*", (req, res, next) => {
  next(new ApiError(`Can't find this route: ${req.originalUrl}`, 400));
});

// Global error handling middleware for express
app.use(globalError);
//Configuration Port
const PORT = process.env.PORT || 8000;
const server = app.listen(PORT, () => {
  console.log(`App running running on port ${PORT}`);
});

// Handle rejection outside express
process.on("unhandledRejection", (err) => {
  console.error(`UnhandledRejection Errors: ${err.name} | ${err.message}`);
  server.close(() => {
    console.error(`Shutting down....`);
    process.exit(1);
  });
});
