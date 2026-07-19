# CALE Staff Loans — Payment Server

This is the real backend that makes the KSh 200 processing fee actually
appear as an M-Pesa PIN prompt on an employee's phone, using IntaSend as
the payment provider (they handle the Safaricom Daraja integration for you,
so you don't need your own Paybill/Till or Daraja developer account to start).

## What you need before this can go live

1. **An IntaSend account** — sign up at https://intasend.com, complete
   business verification (ID, business registration documents). This
   review typically takes 1–3 days.
2. **API keys** — once approved, go to Settings → API Keys in your
   IntaSend dashboard. Copy your **Publishable Key** and **Secret Key**.
   Start with the **test/sandbox** keys.
3. **A place to run this server** — see Deployment below.

## Local setup (for testing before you deploy)

```bash
cd cale-backend
npm install
cp .env.example .env
# open .env and paste in your IntaSend sandbox keys
npm start
```

The server starts on `http://localhost:4000`.

### Testing the webhook locally

IntaSend needs a public URL to send payment confirmations to — it can't
reach `localhost`. While testing locally, use a tunnel like ngrok:

```bash
ngrok http 4000
```

Copy the `https://xxxx.ngrok.app` URL it gives you, and in your IntaSend
dashboard (Settings → Webhooks), register:

```
https://xxxx.ngrok.app/api/payment/webhook
```

## Deployment (for real, permanent use)

Any Node.js host works. Two easy free-tier-friendly options:

**Render.com**
1. Push this `cale-backend` folder to a GitHub repo.
2. In Render, "New Web Service" → connect the repo.
3. Build command: `npm install` · Start command: `npm start`.
4. Add your `.env` values under Environment.
5. Once deployed, copy the live URL (e.g. `https://cale-payments.onrender.com`)
   and register `https://cale-payments.onrender.com/api/payment/webhook`
   in your IntaSend dashboard.

**Railway.app** — same idea, arguably the simplest one-click deploy from GitHub.

## Testing the flow end-to-end (sandbox)

1. Start the server with your sandbox keys.
2. Send a test request:
   ```bash
   curl -X POST http://localhost:4000/api/payment/initiate \
     -H "Content-Type: application/json" \
     -d '{"phone":"0712345678","amount":200,"loanId":"test-loan-1"}'
   ```
3. IntaSend's sandbox will simulate a PIN prompt (no real phone needed in
   test mode — check their sandbox docs for the test confirmation flow).
4. Watch your server logs — you should see `Payment ... -> COMPLETE` once
   the webhook fires.

## Going live

1. Swap your sandbox keys in `.env` for your **live** IntaSend keys.
2. Set `INTASEND_TEST_MODE=false`.
3. Re-register your webhook URL under the live keys section of the
   IntaSend dashboard (test and live webhooks are configured separately).
4. Do one real KSh 200 test payment yourself before rolling out to staff.

## Important notes

- This uses an **in-memory store** (`store.js`) as a placeholder so the
  flow works out of the box. Restarting the server wipes payment records.
  Before real use, replace it with your actual database (PostgreSQL /
  Prisma per the original product spec) — the function names in
  `store.js` are written so that swap is a drop-in replacement.
- IntaSend's exact API response field names can shift between versions —
  the first time you test, log `response.data` from `payment.js` and
  confirm the field names (`invoice_id`, `state`, etc.) match what's in
  the code, and adjust if your dashboard shows different naming.
- Refunds (for declined loan applications) are a separate IntaSend/
  Daraja B2C API call, not covered in this file yet — say the word and
  I'll add that route too.
