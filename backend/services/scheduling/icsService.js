// ============================================================
// Calendarly — minimal RFC 5545 VEVENT (.ics) generator for invitee add-to-calendar.
// Dependency-free. Stable UID per booking so reschedules (METHOD:REQUEST + higher SEQUENCE)
// update the invitee's calendar entry and cancels (METHOD:CANCEL) remove it, rather than
// duplicating. Times are emitted as UTC (Z) instants.
// ============================================================

const PRODID = '-//Pantopus//Calendarly//EN';

function pad(n) {
  return String(n).padStart(2, '0');
}

/** Date -> 20260706T090000Z */
function toIcsUtc(date) {
  const d = date instanceof Date ? date : new Date(date);
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

/** Escape a TEXT value per RFC 5545 (backslash, semicolon, comma, newlines). */
function escapeText(value) {
  return String(value == null ? '' : value)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * Sanitize a value in PARAMETER position (e.g. ORGANIZER;CN=...). TEXT-style backslash
 * escaping does NOT apply there: parsers either render the backslashes literally or split the
 * property on the raw ; , : anyway. Per RFC 5545 §3.2 a param value may not contain CTLs or
 * DQUOTE at all (strip them — also closes header/line injection via CR/LF), and a value
 * containing : ; , must be double-quoted.
 */
function escapeParam(value) {
  const cleaned = String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f"]/g, '');
  return /[;:,]/.test(cleaned) ? `"${cleaned}"` : cleaned;
}

/** CAL-ADDRESS values (mailto:) — strip CTLs so a hostile address can't break/inject lines. */
function sanitizeCalAddress(email) {
  return String(email == null ? '' : email).replace(/[\u0000-\u001f\u007f]/g, '');
}

/** Fold a content line to <=75 octets per RFC 5545 (continuation lines start with a space). */
function foldLine(line) {
  if (Buffer.byteLength(line, 'utf8') <= 75) return line;
  const out = [];
  let current = '';
  for (const ch of line) {
    // keep multibyte chars whole
    if (Buffer.byteLength(current + ch, 'utf8') > 75) {
      out.push(current);
      current = ' ' + ch; // continuation lines are prefixed with a single space
    } else {
      current += ch;
    }
  }
  if (current) out.push(current);
  return out.join('\r\n');
}

/**
 * Build a complete .ics document for a booking.
 * @param {Object} args
 * @param {string} args.uid           stable id (e.g. booking id)
 * @param {Date|string} args.start
 * @param {Date|string} args.end
 * @param {string} args.summary
 * @param {string} [args.description]
 * @param {string} [args.location]
 * @param {string} [args.organizerEmail]
 * @param {string} [args.organizerName]
 * @param {string} [args.attendeeEmail]
 * @param {'REQUEST'|'CANCEL'} [args.method='REQUEST']
 * @param {number} [args.sequence=0]
 * @param {Date|string} [args.now]    DTSTAMP (defaults to current time)
 */
function buildIcs({
  uid,
  start,
  end,
  summary,
  description,
  location,
  organizerEmail,
  organizerName,
  attendeeEmail,
  method = 'REQUEST',
  sequence = 0,
  now,
}) {
  const status = method === 'CANCEL' ? 'CANCELLED' : 'CONFIRMED';
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'CALSCALE:GREGORIAN',
    `METHOD:${method}`,
    'BEGIN:VEVENT',
    `UID:${uid}@pantopus.com`,
    `SEQUENCE:${Number.isFinite(sequence) ? sequence : 0}`,
    `DTSTAMP:${toIcsUtc(now || new Date())}`,
    `DTSTART:${toIcsUtc(start)}`,
    `DTEND:${toIcsUtc(end)}`,
    `SUMMARY:${escapeText(summary)}`,
  ];
  if (description) lines.push(`DESCRIPTION:${escapeText(description)}`);
  if (location) lines.push(`LOCATION:${escapeText(location)}`);
  if (organizerEmail) {
    // CN sits in PARAM position — TEXT escaping (escapeText) is wrong there; see escapeParam.
    const cn = organizerName ? `;CN=${escapeParam(organizerName)}` : '';
    lines.push(`ORGANIZER${cn}:mailto:${sanitizeCalAddress(organizerEmail)}`);
  }
  if (attendeeEmail) {
    lines.push(`ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${sanitizeCalAddress(attendeeEmail)}`);
  }
  lines.push(`STATUS:${status}`);
  lines.push('END:VEVENT');
  lines.push('END:VCALENDAR');

  return lines.map(foldLine).join('\r\n') + '\r\n';
}

module.exports = { buildIcs, toIcsUtc, escapeText, escapeParam };
