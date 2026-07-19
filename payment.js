const express = require("express");
const axios = require("axios");
const { createPaymentRecord, updatePaymentStatus, getPayment } = require("../store");

const router = express.Router();

const INTASEND_BASE_URL = process.env.INTASEND_TEST_MODE === "true"
  ? "https://sandbox.intasend.com/api/v1"
  : "https://payment.intasend.com/api/v1";

/**
 * POST /api/payment/initiate
 * Body: { phone: "0712345678", amount: 200, loanId: "loan_123" }
 *
 * Triggers a real STK push to the employee's phone. They will see the
 * M-Pesa PIN prompt within a few seconds of this call succeeding.
 */
router.post("/initiate", async (req, res) => {
  try {
    const { phone, amount, loanId } = req.body;

    if (!phone || !amount) {
      return res.status(400).json({ error: "phone and amount are required" });
    }

    // IntaSend expects phone numbers in international format, e.g. 254712345678
    const normalizedPhone = phone.replace(/^0/, "254").replace(/\D/g, "");

    const response = await axios.post(
      `${INTASEND_BASE_URL}/payment/mpesa-stk-push/`,
      {
        amount,
        phone_number: normalizedPhone,
        api_ref: loanId || `CALE-${Date.now()}`,
        // Shown to some IntaSend flows / receipts
        narrative: "CALE Staff Loans - Processing Fee",
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.INTASEND_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    // IntaSend returns an invoice object with an "invoice_id" (naming can vary
    // by API version — check the response shape in your dashboard/logs the
    // first time you test this, and adjust the field name below if needed).
    const invoiceId = response.data?.invoice?.invoice_id || response.data?.id;

    if (!invoiceId) {
      return res.status(502).json({ error: "Unexpected response from IntaSend", raw: response.data });
    }

    createPaymentRecord({ invoiceId, loanId, employeePhone: normalizedPhone, amount });

    return res.json({
      success: true,
      invoiceId,
      message: "STK push sent. Ask the employee to check their phone.",
    });
  } catch (err) {
    console.error("STK push failed:", err.response?.data || err.message);
    return res.status(500).json({
      error: "Could not initiate STK push",
      detail: err.response?.data || err.message,
    });
  }
});

/**
 * GET /api/payment/status/:invoiceId
 * The frontend polls this every couple seconds while showing
 * "Waiting for confirmation…" until status flips to COMPLETE or FAILED.
 */
router.get("/status/:invoiceId", (req, res) => {
  const record = getPayment(req.params.invoiceId);
  if (!record) return res.status(404).json({ error: "Unknown invoice" });
  return res.json(record);
});

/**
 * POST /api/payment/webhook
 * IntaSend calls this URL automatically once the employee enters their
 * M-Pesa PIN and the payment succeeds or fails. Register this exact URL
 * (WEBHOOK_BASE_URL + /api/payment/webhook) in your IntaSend dashboard
 * under Settings > Webhooks.
 */
router.post("/webhook", (req, res) => {
  try {
    const event = req.body;
    // Field names below reflect IntaSend's typical webhook payload shape —
    // confirm against a real webhook log the first time you test, since
    // providers occasionally rename fields between API versions.
    const invoiceId = event.invoice_id || event.id;
    const state = (event.state || event.status || "").toUpperCase();

    if (!invoiceId) {
      console.warn("Webhook received with no invoice id:", event);
      return res.status(400).json({ error: "Missing invoice id" });
    }

    const status = state === "COMPLETE" || state === "COMPLETED" ? "COMPLETE" : "FAILED";
    const updated = updatePaymentStatus(invoiceId, status, { raw: event });

    console.log(`Payment ${invoiceId} -> ${status}`);

    // TODO: when this flips to COMPLETE, also update the related loan
    // application's status in your real database, e.g.:
    // await db.loanApplication.update({ where: { id: updated.loanId }, data: { feeStatus: "RECEIVED" } });

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("Webhook handling error:", err.message);
    return res.status(500).json({ error: "Webhook processing failed" });
  }
});

module.exports = router;
