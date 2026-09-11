// Current SQL snapshot; amounts are decimal major units in one currency.
const supabaseAdmin = require('../config/supabaseAdmin');

const unavailable = () => Object.assign(new Error('Current bill comparisons could not be loaded. Retry to check current information.'), {
  code: 'HOME_BILLS_UNAVAILABLE', statusCode: 503,
});
function currencyCode(value = 'USD') {
  if (typeof value !== 'string' || !/^[A-Za-z]{3}$/.test(value.trim())) {
    throw Object.assign(new Error('Choose a three-letter currency code.'), { code: 'HOME_BILLS_INVALID', statusCode: 400 });
  }
  return value.trim().toUpperCase();
}
const money = value => typeof value === 'number' && Number.isFinite(value) && value >= 0
  && Number.isSafeInteger(Math.round(value * 100));
const month = value => typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
function validPeer(row, currency) {
  return row && typeof row.bill_type === 'string' && month(row.month) && row.currency === currency
    && Number.isInteger(row.household_count) && row.household_count >= 3
    && (row.household_count >= 10 ? money(row.avg_amount) && money(row.median_amount)
      : row.avg_amount === null && row.median_amount === null);
}
async function getHomeBillComparison(homeId, actorId, requestedCurrency) {
  const currency = currencyCode(requestedCurrency);
  let result;
  try { result = await supabaseAdmin.rpc('get_home_bill_comparison', { p_home_id: homeId, p_actor_id: actorId, p_currency: currency }); }
  catch (_) { throw unavailable(); }
  if (!result || result.error || !result.data || typeof result.data.ok !== 'boolean') throw unavailable();
  const data = result.data;
  if (!data.ok) {
    if (data.code === 'HOME_BILLS_DENIED') throw Object.assign(new Error('Current permission to view these bill comparisons is unavailable.'), { code: data.code, statusCode: 403 });
    if (data.code === 'HOME_BILLS_INVALID') throw Object.assign(new Error('Invalid bill comparison request.'), { code: data.code, statusCode: 400 });
    throw unavailable();
  }
  if (data.home_id !== homeId || data.currency !== currency || data.calculation_version !== 2
    || typeof data.can_view_finance !== 'boolean' || typeof data.bill_benchmark_opt_in !== 'boolean'
    || !Array.isArray(data.available_currencies) || !data.available_currencies.every(c => typeof c === 'string' && /^[A-Z]{3}$/.test(c))
    || !Array.isArray(data.own_months) || !data.own_months.every(r => r && typeof r.bill_type === 'string' && month(r.month) && money(r.amount))
    || !Array.isArray(data.peer_months) || !data.peer_months.every(r => validPeer(r, currency))
    || (!data.can_view_finance && (data.own_months.length || data.available_currencies.length))) throw unavailable();
  return data;
}
async function getPeerBillMonths(geohash, requestedCurrency) {
  const currency = currencyCode(requestedCurrency);
  let result;
  try { result = await supabaseAdmin.rpc('read_bill_peer_months', { p_geohash: geohash, p_currency: currency }); }
  catch (_) { throw unavailable(); }
  if (!result || result.error || !Array.isArray(result.data) || !result.data.every(row => validPeer(row, currency))) throw unavailable();
  return result.data;
}
function asBillTrendData(snapshot) {
  const billsByType = Object.create(null), benchmarks = Object.create(null);
  for (const row of snapshot.own_months) {
    const type = billsByType[row.bill_type] ||= { months: [], amounts: [] };
    type.months.push(row.month); type.amounts.push(row.amount);
  }
  for (const row of snapshot.peer_months) {
    if (row.household_count >= 10) {
      if (!benchmarks[row.bill_type] || benchmarks[row.bill_type].insufficient_data) {
        benchmarks[row.bill_type] = { months: [], avg_amounts: [], household_count: row.household_count };
      }
      const type = benchmarks[row.bill_type];
      type.months.push(row.month); type.avg_amounts.push(row.avg_amount);
      type.household_count = Math.min(type.household_count, row.household_count);
    } else if (!benchmarks[row.bill_type] || benchmarks[row.bill_type].insufficient_data) {
      benchmarks[row.bill_type] = { insufficient_data: true, needed: 10-row.household_count, message: 'Not enough households for comparison yet' };
    }
  }
  return { bills_by_type: billsByType, benchmarks, bill_benchmark_opt_in: snapshot.bill_benchmark_opt_in,
    currency: snapshot.currency, available_currencies: snapshot.available_currencies,
    as_of: snapshot.as_of, calculation_version: snapshot.calculation_version, format_version: 2, period_basis: snapshot.period_basis };
}

// Older native clients take the first month as newest and interpret peer
// amounts as cents. Give them current personal USD totals, newest first,
// without a comparison they could misinterpret. Never revive the old cache.
function asLegacyBillTrendData(snapshot) {
  const data = asBillTrendData(snapshot);
  for (const series of Object.values(data.bills_by_type)) {
    series.months.reverse(); series.amounts.reverse();
  }
  return { ...data, benchmarks: {}, format_version: 1, comparison_unavailable_reason: 'client_update_required' };
}

module.exports = { currencyCode, getHomeBillComparison, getPeerBillMonths, asBillTrendData, asLegacyBillTrendData };
