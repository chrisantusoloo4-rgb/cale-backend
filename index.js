require("dotenv").config();
const express = require("express");
const cors = require("cors");
const paymentRoutes = require("./routes/payment");

const app = express();

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim());
app.use(cors({ origin: allowedOrigins.length ? allowedOrigins : "*" }));
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ status: "ok", service: "CALE Staff Loans payment server" });
});

app.use("/api/payment", paymentRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`CALE Staff Loans payment server running on port ${PORT}`);
  console.log(`Mode: ${process.env.INTASEND_TEST_MODE === "true" ? "SANDBOX (test money)" : "LIVE (real money)"}`);
});
