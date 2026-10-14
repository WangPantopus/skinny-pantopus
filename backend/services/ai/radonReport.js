/**
 * A radon test result read from a photo or PDF of the lab's report, for the Today
 * radon card's "When was it tested?" sheet to fill in.
 *
 * The report is read in memory and never stored: it carries the household's name
 * and address, and nothing needs it once the result is read. Nothing is saved here
 * either. The person checks the result and test date and saves them with the
 * sheet's own Save, which records the answer as it always has (a done radon task
 * with `tested_on` and `result_pci`).
 */
const { jpegBlock } = require('./photos');

// 1 pCi/L is 37 Bq/m³.
const BQ_PER_PCI = 37;
// Past any home's reading: a misread number, not a result.
const MAX_PCI = 10000;
// Home radon testing began in the mid-1980s; an earlier date is a misreading.
const EARLIEST_TEST_DAY = '1985-01-01';
// Claude takes a PDF of up to 32 MB in a request; a lab report is a page or two.
const MAX_REPORT_BYTES = 10 * 1024 * 1024;

const noon = (day) => new Date(`${day}T12:00:00.000Z`);
const isCalendarDay = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(noon(value).getTime()) && noon(value).toISOString().slice(0, 10) === value;

/** Today's date (YYYY-MM-DD) in `timeZone`. */
function todayIn(timeZone, now = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

/**
 * The report as a Claude content block: a PDF as a document, anything else as a
 * photo re-encoded to JPEG. Null when it is neither (an iPhone's HEIC, a corrupt file).
 */
async function reportBlock(bytes) {
  if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > MAX_REPORT_BYTES) return null;
  if (bytes.subarray(0, 5).toString('latin1') === '%PDF-') {
    return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: bytes.toString('base64') } };
  }
  return jpegBlock(bytes);
}

const dateFormat = (options) => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...options });
const longDay = (day) => dateFormat({ month: 'long', day: 'numeric', year: 'numeric' }).format(noon(day));
const monthDay = (day) => dateFormat({ month: 'long', day: 'numeric' }).format(noon(day));
/** 2.1, 4, 4.05: at most two decimals, as people write them. */
const plain = (value) => String(Math.round(value * 100) / 100);

/** "Short-term test, October 1 to October 3, 2026: 2.1 pCi/L. From RiverLab." */
function summaryOf({ value, belowLimit, convertedFrom, start, end, kind, lab }) {
  const test = { short_term: 'Short-term test', long_term: 'Long-term test' }[kind] || 'Radon test';
  let when = '';
  if (start && end && start !== end) {
    when = start.slice(0, 4) === end.slice(0, 4) ? `${monthDay(start)} to ${longDay(end)}` : `${longDay(start)} to ${longDay(end)}`;
  } else if (end || start) {
    when = longDay(end || start);
  }
  let level = `${plain(value)} pCi/L`;
  if (belowLimit) level = `below ${level}, the lowest level it measures`;
  if (convertedFrom !== null) level += ` (${plain(convertedFrom)} Bq/m³ on the report)`;
  const from = lab ? ` From ${lab}.` : '';
  return `${test}${when ? `, ${when}` : ''}: ${level}.${from}`;
}

/**
 * What the radon sheet fills in from a reading of a report: the result in pCi/L
 * (converted when the report gives Bq/m³), the day the test ended, and a sentence
 * saying what was read. `value_pci` is null when there is no result to fill in.
 */
function sheetFields(reading, today) {
  const raw = Number.isFinite(reading.result_value) && reading.result_value >= 0 ? reading.result_value : null;
  // A number without a printed unit is not guessed at.
  const unit = ['pCi/L', 'Bq/m3'].includes(reading.result_unit) ? reading.result_unit : null;
  let value = raw !== null && unit ? raw : null;
  const convertedFrom = value !== null && unit === 'Bq/m3' ? value : null;
  if (convertedFrom !== null) value = Math.round((convertedFrom / BQ_PER_PCI) * 100) / 100;
  if (value !== null && value > MAX_PCI) value = null;

  const day = (value) => (isCalendarDay(value) && value >= EARLIEST_TEST_DAY && value <= today ? value : null);
  const start = day(reading.test_start_date);
  const end = day(reading.test_end_date);
  const kind = ['short_term', 'long_term'].includes(reading.test_kind) ? reading.test_kind : null;
  const lab = typeof reading.lab === 'string' && reading.lab.trim() ? reading.lab.trim().slice(0, 120) : null;
  const belowLimit = value !== null && reading.below_limit === true;
  return {
    value_pci: value,
    below_limit: belowLimit,
    // The sheet keeps one test date: the day the test ended, when its result was in.
    tested_on: end || start,
    test_kind: kind,
    summary: value === null ? null : summaryOf({ value, belowLimit, convertedFrom, start, end, kind, lab }),
  };
}

module.exports = { reportBlock, sheetFields, todayIn, BQ_PER_PCI, MAX_REPORT_BYTES };
