const express = require("express");
const Joi = require("joi");
const verifyToken = require("../middleware/verifyToken");
const validate = require("../middleware/validate");
const rateLimit = require("express-rate-limit");
const stamps = require("../services/mailStamps");
const router = express.Router();
router.use(
  verifyToken,
  rateLimit({
    windowMs: 60000,
    limit: (req) => (req.method === "GET" ? 90 : 20),
    keyGenerator: (req) => req.user.id,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);
// Existing receipts and balances remain recoverable when new sales are switched off.
const run = (fn) => async (req, res) => {
  try {
    res.json(await fn(req));
  } catch (e) {
    res.status(e.status || 503).json({
      error: e.status ? e.message : "Stamps are unavailable. Please try again.",
      code: "STAMP_PURCHASE_UNAVAILABLE",
    });
  }
};
router.get(
  "/",
  run(async (req) => ({
    ...(await stamps.balance(req.user.id)),
    books: stamps.BOOKS,
    // Books stay listed after sales end so the apps can still finish an interrupted purchase.
    sales_open: await stamps.salesOpen(req.user.id),
    // Whether cards cost stamps for this person now; the Stamps wallet shows only then.
    enabled: stamps.enabled(req.user.id),
    history: req.query.history === "1" ? await stamps.history(req.user.id) : undefined,
    used_total: req.query.history === "1" ? await stamps.usedTotal(req.user.id) : undefined,
    account_token: req.user.id,
    google_account: stamps.googleAccount(req.user.id),
  })),
);
router.use("/checkout", (req, res, next) => {
  if (!stamps.enabled(req.user.id)) return res.status(404).json({ error: "Not found" });
  if (req.user.accountType === "business") {
    return res.status(403).json({
      error: "Stamp books are for personal accounts.",
      code: "STAMP_PERSONAL_ACCOUNT_REQUIRED",
    });
  }
  next();
});
router.post(
  "/checkout",
  validate(
    Joi.object({
      product_id: Joi.string()
        .valid(...stamps.BOOKS.map((b) => b.id))
        .required(),
      request_id: Joi.string().uuid().required(),
    }),
  ),
  run((req) =>
    stamps.checkout(req.user.id, req.body.product_id, req.body.request_id),
  ),
);
router.post(
  "/confirm",
  validate(
    Joi.object({
      provider: Joi.string().valid("stripe", "apple", "google").required(),
      reference: Joi.string().max(4096).required(),
      product_id: Joi.string().valid(...stamps.BOOKS.map((b) => b.id)),
    }),
  ),
  run((req) =>
    stamps.confirm(
      req.body.provider,
      req.body.reference,
      req.user.id,
      req.body.product_id,
    ),
  ),
);
module.exports = router;
