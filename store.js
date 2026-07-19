/**
 * TEMPORARY in-memory data store.
 *
 * This exists only so the payment flow below has somewhere to read/write
 * status to while you test it. It is NOT persistent — restarting the server
 * wipes all data.
 *
 * Before going live, replace this file with real database calls
 * (the original spec calls for PostgreSQL + Prisma). The function
 * signatures below are written so that swap is a drop-in replacement:
 * keep the same function names and shapes, change the internals.
 */

const payments = new Map(); // key: invoice_id, value: payment record

function createPaymentRecord({ invoiceId, loanId, employeePhone, amount }) {
  const record = {
    invoiceId,
    loanId,
    employeePhone,
    amount,
    status: "PENDING", // PENDING -> COMPLETE | FAILED
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  payments.set(invoiceId, record);
  return record;
}

function updatePaymentStatus(invoiceId, status, extra = {}) {
  const record = payments.get(invoiceId);
  if (!record) return null;
  const updated = { ...record, status, ...extra, updatedAt: new Date().toISOString() };
  payments.set(invoiceId, updated);
  return updated;
}

function getPayment(invoiceId) {
  return payments.get(invoiceId) || null;
}

module.exports = { createPaymentRecord, updatePaymentStatus, getPayment };
