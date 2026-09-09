// Unit-level stand-in for the service-only admission RPC. Real transaction,
// rollback, role and competing-connection behavior is covered by SQL contracts.
const { randomUUID } = require('crypto');
module.exports = (p, table) => {
  const attempts = table('AddressVerificationAttempt');
  const now = new Date();
  const existing = attempts.find((a) => a.user_id === p.p_user_id && a.address_id === p.p_address_id
    && a.method === 'mail_code' && ['created', 'sent', 'delivered_unknown'].includes(a.status)
    && new Date(a.expires_at) > now);
  if (existing) return { data: { reused: true, attempt_id: existing.id }, error: null };
  if (!table('HomeAddress').some((a) => a.id === p.p_address_id)) {
    return { data: { error: 'ADDRESS_NOT_FOUND' }, error: null };
  }
  const policy = p.p_policy;
  const recent = (days) => attempts.filter((a) => new Date(a.created_at) >= new Date(now - days * 86400000));
  const userCount = recent(policy.user_window_hours / 24).filter((a) => a.user_id === p.p_user_id).length;
  const addressAttempts = recent(policy.address_window_days).filter((a) => a.address_id === p.p_address_id);
  const code = userCount >= policy.user_rate_limit ? 'USER_RATE_LIMIT'
    : addressAttempts.length >= policy.address_rate_limit ? 'ADDRESS_RATE_LIMIT'
      : addressAttempts.filter((a) => a.user_id === p.p_user_id).length >= policy.user_address_rate_limit ? 'USER_ADDRESS_RATE_LIMIT' : null;
  if (code) return { data: { error: code }, error: null };
  if (table('MailVerificationJob').some((j) => j.id === p.p_job_id)) {
    return { data: null, error: { code: '23505', message: 'Duplicate mail job' } };
  }
  const attempt = {
    id: randomUUID(), user_id: p.p_user_id, address_id: p.p_address_id,
    method: 'mail_code', status: 'created', risk_tier: 'low',
    expires_at: new Date(now.getTime() + policy.code_expiry_days * 86400000).toISOString(),
    created_at: now.toISOString(), updated_at: now.toISOString(),
  };
  const cooldown = new Date(now.getTime() + policy.cooldown_hours * 3600000).toISOString();
  const job = {
    id: p.p_job_id, attempt_id: attempt.id, vendor: 'pending', vendor_status: 'pending',
    vendor_job_id: null, template_id: p.p_template_id,
    metadata: { address_id: p.p_address_id, unit: p.p_unit },
    created_at: now.toISOString(), updated_at: now.toISOString(),
  };
  attempts.push(attempt);
  table('AddressVerificationToken').push({
    id: randomUUID(), attempt_id: attempt.id, code_hash: p.p_code_hash,
    max_attempts: policy.max_attempts, attempt_count: 0, resend_count: 0,
    cooldown_until: cooldown, used_at: null, created_at: now.toISOString(),
  });
  table('MailVerificationJob').push(job);
  return { data: { reused: false, attempt, job, cooldown_until: cooldown }, error: null };
};
