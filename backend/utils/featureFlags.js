const DISABLED_VALUES = ['0', 'false', 'off', 'disabled'];

function enabled(name, defaultValue = true) {
  const value = process.env[name];
  if (value == null || value === '') return defaultValue;
  return !DISABLED_VALUES.includes(String(value).toLowerCase());
}

function isIdentityFirewallEnabled() {
  return enabled('IDENTITY_FIREWALL_ENABLED');
}

function isPersonaEnabled() {
  return isIdentityFirewallEnabled() && enabled('PERSONA_ENABLED');
}

function isPersonaBroadcastEnabled() {
  return isPersonaEnabled() && enabled('PERSONA_BROADCAST_ENABLED');
}

function disabledResponse(res) {
  return res.status(404).json({ error: 'Not found' });
}

function requireIdentityFirewallEnabled(_req, res, next) {
  if (!isIdentityFirewallEnabled()) return disabledResponse(res);
  return next();
}

function requirePersonaEnabled(_req, res, next) {
  if (!isPersonaEnabled()) return disabledResponse(res);
  return next();
}

function requirePersonaBroadcastEnabled(_req, res, next) {
  if (!isPersonaBroadcastEnabled()) return disabledResponse(res);
  return next();
}

module.exports = {
  isIdentityFirewallEnabled,
  isPersonaEnabled,
  isPersonaBroadcastEnabled,
  requireIdentityFirewallEnabled,
  requirePersonaEnabled,
  requirePersonaBroadcastEnabled,
};
