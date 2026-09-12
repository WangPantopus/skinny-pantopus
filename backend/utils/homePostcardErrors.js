const MESSAGES = {
  POSTCARD_REVIEW_INVALID: 'Check the residency review and try again.',
  POSTCARD_REVIEW_AUTHORITY_REQUIRED: 'Current household review permission is required.',
  POSTCARD_REVIEW_NOT_FOUND: 'This residency review is no longer available.',
  POSTCARD_REVIEW_SELF_FORBIDDEN: 'You cannot challenge your own residency.',
  POSTCARD_REVIEW_CHANGED: 'This residency or its review window has changed. Refresh the household before continuing.',
  POSTCARD_VERIFICATION_INVALID: 'Enter the code from this postcard and try again.',
  POSTCARD_VERIFICATION_NOT_FOUND: 'This code attempt has not been found. Retry the original attempt or cancel it before entering another code.',
  POSTCARD_VERIFICATION_CONFLICT: 'This attempt has different details. Recover the original code attempt.',
  POSTCARD_NOT_DISPATCHED: 'This saved postcard request has not started mailing. Resume the request first.',
  POSTCARD_WRONG_CODE: 'That code does not match this postcard. Check the code and try again.',
  POSTCARD_REQUEST_INVALID: 'Check the mailing address and apartment before continuing.',
  POSTCARD_ACCOUNT_UNAVAILABLE: 'Sign in again to recover this request.',
  POSTCARD_REQUEST_NOT_FOUND: 'This request has not been found. Retry its original details or cancel it before starting again.',
  POSTCARD_REQUEST_CONFLICT: 'This request has different details. Recover its original request.',
  HOME_NOT_FOUND: 'This Home is no longer available. Check your residency status.',
  POSTCARD_HOME_UNAVAILABLE: 'Mail verification is unavailable for this Home right now.',
  POSTCARD_RESIDENCY_REQUEST_REQUIRED: 'Submit your residency request before requesting a verification code.',
  POSTCARD_ACCESS_REVIEW_REQUIRED: 'Your access needs household review. A mail code cannot restore it.',
  POSTCARD_REVIEW_ALREADY_RECORDED: 'Your verification is already recorded. Check your current residency status.',
  OWNERSHIP_FLOW_REQUIRED: 'Use ownership verification to manage your ownership request.',
  POSTCARD_ADDRESS_CHANGED: 'The Home address changed. Confirm the address and apartment again before making a new request.',
  POSTCARD_COUNTRY_UNAVAILABLE: 'Mail verification is not available for this country yet.',
  POSTCARD_ADDRESS_LIMIT: 'The mail request limit for this address has been reached. Try again later.',
  POSTCARD_USER_LIMIT: 'Your mail request limit has been reached. Try again later.',
  POSTCARD_NO_LONGER_AVAILABLE: 'This postcard can no longer be used. Check your current verification status.',
  POSTCARD_CODE_KEY_UNAVAILABLE: 'Mail verification is unavailable right now. Your saved request is preserved; retry later.',
  POSTCARD_EXPIRED: 'This code has expired. Confirm the address before requesting another postcard.',
  POSTCARD_LOCKED: 'This code has no attempts remaining. Confirm the address before requesting another postcard.',
};
const STATUS_CODES = [400, 403, 404, 409, 410, 422, 429, 503];
function failure(code = 'POSTCARD_REQUEST_UNAVAILABLE', statusCode = 503) {
  return Object.assign(new Error(MESSAGES[code] || 'Could not confirm the postcard request. Keep its original details and retry.'), { code, statusCode });
}
module.exports = { MESSAGES, STATUS_CODES, failure };
