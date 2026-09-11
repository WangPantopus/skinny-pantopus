// HTTP/service tests use this deterministic RPC boundary. Real transaction,
// rollback, grants and cross-connection ordering live in the SQL contracts.
const { randomUUID } = require('crypto');

module.exports = (name, args, getTable) => {
  const methods = getTable('PaymentMethod');
  const removals = getTable('PaymentMethodRemoval');
  const response = (data) => ({ data: structuredClone(data), error: null });
  const denied = () => response({ error: 'NOT_FOUND' });
  const owner = getTable('User').find((u) => u.id === args.p_user_id);

  if (name === 'bind_payment_customer') {
    if (!owner) return denied();
    owner.stripe_customer_id ||= args.p_customer_id;
    return response({ customer_id: owner.stripe_customer_id });
  }

  if (name === 'save_payment_method') {
    if (!owner || owner.stripe_customer_id !== args.p_customer_id) return denied();
    if (removals.some((r) => r.stripe_payment_method_id === args.p_method_id)) return response({ error: 'REMOVED' });
    let method = methods.find((m) => m.stripe_payment_method_id === args.p_method_id);
    if (method && (method.user_id !== owner.id || method.stripe_customer_id !== args.p_customer_id)) return denied();
    if (!method) {
      method = {
        id: randomUUID(), user_id: owner.id, stripe_customer_id: args.p_customer_id,
        stripe_payment_method_id: args.p_method_id, created_at: new Date().toISOString(), is_default: false,
      };
      methods.push(method);
    }
    const isDefault = method.is_default || !methods.some((m) => m.user_id === owner.id && m.is_default === true);
    Object.assign(method, args.p_details, { is_default: isDefault });
    return response({ payment_method: method });
  }
  if (name === 'set_default_payment_method') {
    const method = methods.find((m) => m.id === args.p_method_id && m.user_id === args.p_user_id);
    if (!owner || !method || removals.some((r) => r.stripe_payment_method_id === method.stripe_payment_method_id)) return denied();
    methods.filter((m) => m.user_id === owner.id).forEach((m) => { m.is_default = m.id === method.id; });
    return response({ payment_method: method });
  }
  if (name === 'begin_payment_method_removal') {
    if (!owner) return denied();
    let removal = removals.find((r) => r.method_id === args.p_method_id && r.user_id === owner.id);
    if (!removal) {
      const method = methods.find((m) => m.id === args.p_method_id && m.user_id === owner.id);
      if (!method) return denied();
      removal = {
        method_id: method.id, user_id: owner.id, stripe_customer_id: method.stripe_customer_id,
        stripe_payment_method_id: method.stripe_payment_method_id, completed_at: null,
      };
      removals.push(removal);
    }
    return response({ removal });
  }
  if (name === 'complete_payment_method_removal') {
    const method = methods.find((m) => m.stripe_payment_method_id === args.p_method_id);
    let removal = removals.find((r) => r.stripe_payment_method_id === args.p_method_id);
    if (!removal) {
      removal = {
        stripe_payment_method_id: args.p_method_id, user_id: method?.user_id || null,
        method_id: method?.id || null, stripe_customer_id: method?.stripe_customer_id || null,
      };
      removals.push(removal);
    }
    removal.completed_at ||= new Date().toISOString();
    if (method) methods.splice(methods.indexOf(method), 1);
    if (removal.user_id && !methods.some((m) => m.user_id === removal.user_id && m.is_default)) {
      const fallback = methods.filter((m) => m.user_id === removal.user_id &&
        !removals.some((r) => r.stripe_payment_method_id === m.stripe_payment_method_id))
        .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '') || b.id.localeCompare(a.id))[0];
      if (fallback) fallback.is_default = true;
    }
    return response({ completed: true });
  }
  return { data: null, error: { message: 'Unknown payment method RPC' } };
};
