// /middleware/validate.js
const Joi = require('joi');
const logger = require('../utils/logger');

function toLabel(field) {
  if (!field) return 'This field';
  const map = {
    firstName: 'First name',
    middleName: 'Middle name',
    lastName: 'Last name',
    dateOfBirth: 'Date of birth',
    phoneNumber: 'Phone number',
    accountType: 'Account type',
    zipcode: 'ZIP code',
  };
  if (map[field]) return map[field];
  return field
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function friendlyMessage(detail) {
  const field = detail.path.join('.');
  const label = toLabel(field);
  const limit = detail.context?.limit;

  switch (detail.type) {
    case 'any.required':
      return `${label} is required.`;
    case 'string.empty':
      return `${label} cannot be empty.`;
    case 'string.email':
      return 'Please enter a valid email address.';
    case 'string.min':
      return `${label} must be at least ${limit} characters.`;
    case 'string.max':
      return `${label} must be at most ${limit} characters.`;
    case 'string.pattern.base':
      if (field === 'username') {
        return 'Username can only contain letters, numbers, and underscores.';
      }
      if (field === 'phoneNumber') {
        return 'Phone number must be in international format (example: +15551234567).';
      }
      return `${label} format is invalid.`;
    case 'date.base':
      return `${label} must be a valid date.`;
    case 'date.max':
      return `${label} cannot be in the future.`;
    case 'object.unknown':
      return `${label} is not a supported field.`;
    case 'any.only': {
      const allowed = detail.context?.valids;
      if (allowed && allowed.length > 0) {
        return `${label} is not a valid option. Please choose from: ${allowed.join(', ')}.`;
      }
      return `${label} has an invalid value.`;
    }
    default:
      return detail.message.replace(/"/g, '');
  }
}

// Never echo (or log) the value of a field that carries a credential: a
// password that is one character too long, an over-length resume grant, an OAuth
// code or a DPoP/step-up signature would otherwise land verbatim in the 400
// body AND in the warn-level log line. Matched against the LAST path segment so
// `device.keyBacking` stays visible while `password` / `grant` / `idToken` do not.
const SENSITIVE_FIELD_RE = /^(?:.*(?:password|passcode|token|secret|signature|credential|authorization)|code|otp|pin|grant|challenge)$/i;

function isSensitiveField(path) {
  const leaf = String(path[path.length - 1] ?? '');
  return SENSITIVE_FIELD_RE.test(leaf);
}

/** A few Joi defaults quote the offending value inside the message text. */
function scrubValue(message, value) {
  if (typeof value !== 'string' || value.length < 3) return message;
  return message.split(value).join('[redacted]');
}

module.exports = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, {
    abortEarly: false,
    allowUnknown: false,
    stripUnknown: true,
  });

  if (error) {
    const details = error.details.map((detail) => {
      const sensitive = isSensitiveField(detail.path);
      const message = friendlyMessage(detail);
      return {
        field: detail.path.join('.'),
        message: sensitive ? scrubValue(message, detail.context?.value) : message,
        code: detail.type,
        rejectedValue: sensitive ? '[redacted]' : detail.context?.value,
      };
    });

    logger.warn('Request validation failed', {
      method: req.method,
      path: req.originalUrl,
      bodyKeys: Object.keys(req.body || {}),
      details,
    });

    return res.status(400).json({
      error: 'Validation failed',
      message: 'Please correct the highlighted fields.',
      details,
    });
  }

  req.body = value;
  next();
};
