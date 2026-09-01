/**
 * Residency Letter Service (Phase 1, #11)
 *
 * Issues, lists, serves, revokes, and publicly verifies SERVER-ATTESTED
 * residency letters for T4 residents (verified occupancy). The letter is
 * a single-page PDF rendered here with pdfkit; everything printed is
 * frozen on the ResidencyLetter row (migration 157) together with the
 * exact issued PDF (base64 + sha256), so downloads are byte-identical to
 * what was issued and revocation is meaningful.
 *
 * Trust model:
 *   issue    — route enforces T4; the service re-derives the printed
 *              name/address from the database, never from client input
 *              (the only client-supplied text is `purpose`, length-capped
 *              and single-line).
 *   verify   — the letter carries an unguessable `letter_code`
 *              (XXXX-XXXX-XXXX-XXXX from a 30-char alphabet ≈ 78 bits);
 *              anyone holding the letter can confirm it is genuine and
 *              not revoked via GET /api/public/residency-letters/:code.
 *              The endpoint returns exactly what is printed on the paper
 *              — never more.
 *   privacy  — letters are personal documents: list/download/revoke are
 *              scoped to the ISSUING user. Household members do not see
 *              each other's letters.
 */

const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');

const PURPOSE_MAX_LEN = 140;
const DEFAULT_PURPOSE = 'General verification of residency';

// ── Letter code ──────────────────────────────────────────────
// 16 chars from a 30-char alphabet (no I/L/O/U/0/1 lookalikes) ≈ 78 bits.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';
function generateLetterCode() {
  const bytes = crypto.randomBytes(16);
  let raw = '';
  for (let i = 0; i < 16; i += 1) raw += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return raw.match(/.{4}/g).join('-');
}
/** Forgiving normalization for user-typed codes (case, dashes, spaces). */
function normalizeLetterCode(input) {
  const raw = String(input || '').toUpperCase().replace(/[^A-Z2-9]/g, '');
  if (raw.length !== 16) return null;
  return raw.match(/.{4}/g).join('-');
}

function webBaseUrl() {
  return (process.env.PUBLIC_WEB_URL || process.env.APP_URL || 'https://pantopus.com').trim().replace(/\/+$/, '');
}
function verifyUrlFor(code) {
  return `${webBaseUrl()}/verify-residency/${code}`;
}

// ── Printed facts (server-derived, never client input) ──────
function residentNameFromUser(user) {
  const first = (user.first_name || '').trim();
  const last = (user.last_name || '').trim();
  if (first || last) return [first, last].filter(Boolean).join(' ');
  if ((user.name || '').trim()) return user.name.trim();
  return user.username || 'Pantopus resident';
}

// Street line incl. unit — a residency letter is the one surface where the
// FULL address is the point (the resident is generating it about themselves;
// the address_precision toggle governs outsider surfaces, not this).
function addressLine1FromHome(home) {
  const full = String(home.address || '');
  const street = (full.split(',')[0] || '').trim() || full;
  const unit = String(home.address2 || '').trim();
  return unit ? `${street} ${unit}` : street;
}

function sanitizePurpose(purpose) {
  const p = String(purpose || '').replace(/\s+/g, ' ').trim().slice(0, PURPOSE_MAX_LEN);
  return p || DEFAULT_PURPOSE;
}

function cityStateZip(rec) {
  const cityState = [rec.city, rec.state].filter(Boolean).join(', ');
  return [cityState, rec.zipcode].filter(Boolean).join(' ');
}

// ── PDF rendering (pdfkit, built-in Helvetica — no font assets) ──
const INK = '#111827';
const MUTED = '#6b7280';
const FAINT = '#9ca3af';
const BORDER = '#e5e7eb';
const GREEN = '#15803d';
const BRAND = '#0284c7';

function renderLetterPdf({ residentName, addressLine1, cityZip, purpose, letterCode, issuedAtIso, letterId }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: 64, bottom: 56, left: 64, right: 64 },
      info: {
        Title: 'Pantopus Verified Residency Letter',
        Author: 'Pantopus',
        CreationDate: new Date(issuedAtIso),
      },
    });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const width = right - left;
    const issuedDate = new Date(issuedAtIso).toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
    });

    // Header — brand left, tag right, rule under.
    doc.font('Helvetica-Bold').fontSize(19).fillColor(BRAND).text('Pantopus', left, 64);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(FAINT)
      .text('VERIFIED RESIDENCY', left, 70, { width, align: 'right', characterSpacing: 1.2 });
    doc.moveTo(left, 96).lineTo(right, 96).lineWidth(1).strokeColor(BORDER).stroke();

    // Date + salutation + statement.
    doc.font('Helvetica').fontSize(10).fillColor(MUTED).text(issuedDate, left, 116);
    doc.font('Helvetica-Bold').fontSize(13).fillColor(INK).text('To whom it may concern,', left, 140);
    doc.moveDown(0.6);
    doc.font('Helvetica').fontSize(11).fillColor(INK).lineGap(3);
    doc.text('This letter certifies that ', { continued: true });
    doc.font('Helvetica-Bold').text(residentName, { continued: true });
    doc.font('Helvetica').text(
      ' is a verified resident of the address below. Residency was confirmed through the Pantopus address-verification process, and this attestation was current when the letter was issued.',
    );

    // Address box.
    const boxTop = doc.y + 14;
    const boxH = 64;
    doc.roundedRect(left, boxTop, width, boxH, 8).lineWidth(1).strokeColor(BORDER).stroke();
    doc.font('Helvetica-Bold').fontSize(8).fillColor(FAINT)
      .text('VERIFIED ADDRESS', left + 16, boxTop + 12, { characterSpacing: 1 });
    doc.font('Helvetica-Bold').fontSize(13).fillColor(INK)
      .text(addressLine1, left + 16, boxTop + 26, { width: width - 32 });
    doc.font('Helvetica').fontSize(11).fillColor(INK)
      .text(cityZip, left + 16, doc.y + 1, { width: width - 32 });

    // Purpose.
    doc.font('Helvetica').fontSize(11).fillColor(MUTED).text('Issued for:  ', left, boxTop + boxH + 18, { continued: true });
    doc.font('Helvetica-Bold').fillColor(INK).text(purpose);

    // Verification box.
    const vTop = doc.y + 22;
    const vH = 92;
    doc.roundedRect(left, vTop, width, vH, 8).lineWidth(1).strokeColor(BORDER).stroke();
    doc.font('Helvetica-Bold').fontSize(8).fillColor(FAINT)
      .text('VERIFY THIS LETTER', left + 16, vTop + 12, { characterSpacing: 1 });
    doc.font('Helvetica-Bold').fontSize(16).fillColor(INK)
      .text(letterCode, left + 16, vTop + 26, { characterSpacing: 1.5 });
    doc.font('Helvetica').fontSize(10).fillColor(MUTED)
      .text(`Enter this code at ${verifyUrlFor('').replace(/\/$/, '')} — or open:`, left + 16, vTop + 50, { width: width - 32 });
    doc.font('Helvetica').fontSize(10).fillColor(BRAND)
      .text(verifyUrlFor(letterCode), left + 16, doc.y + 2, { width: width - 32, link: verifyUrlFor(letterCode) });

    // Attestation line.
    doc.font('Helvetica-Bold').fontSize(11).fillColor(GREEN)
      .text('Address verified through Pantopus', left, vTop + vH + 20);

    // Footer — disclaimer + letter identifiers.
    const footY = doc.page.height - doc.page.margins.bottom - 64;
    doc.moveTo(left, footY).lineTo(right, footY).lineWidth(0.5).strokeColor(BORDER).stroke();
    doc.font('Helvetica').fontSize(8).fillColor(FAINT).lineGap(2)
      .text(
        'This letter attests that the named person completed Pantopus address verification for the address shown, as of the issue date. '
        + 'It reflects verification status at issuance and can be revoked by the resident; verify the code above for current status. '
        + 'It is not a government-issued document.',
        left, footY + 10, { width },
      );
    doc.font('Helvetica').fontSize(8).fillColor(FAINT)
      .text(`Letter ${letterId} · Issued ${issuedAtIso}`, left, doc.y + 4, { width });

    doc.end();
  });
}

// ── Serialization (issuer-facing) ────────────────────────────
function serializeLetter(row) {
  return {
    id: row.id,
    home_id: row.home_id,
    status: row.status,
    purpose: row.purpose,
    resident_name: row.resident_name,
    address: {
      line1: row.address_line1,
      city: row.city,
      state: row.state,
      zipcode: row.zipcode,
    },
    letter_code: row.letter_code,
    verify_url: verifyUrlFor(row.letter_code),
    issued_at: row.issued_at,
    revoked_at: row.revoked_at,
    pdf_sha256: row.pdf_sha256,
  };
}

// ── Lifecycle ────────────────────────────────────────────────

/**
 * Issue a letter for the (already T4-gated) resident of a home.
 * @returns {Promise<object>} The serialized letter record.
 */
async function issueLetter({ homeId, userId, purpose }) {
  const [{ data: home, error: homeErr }, { data: user, error: userErr }] = await Promise.all([
    supabaseAdmin.from('Home').select('id, address, address2, city, state, zipcode').eq('id', homeId).maybeSingle(),
    supabaseAdmin.from('User').select('id, first_name, last_name, name, username').eq('id', userId).maybeSingle(),
  ]);
  if (homeErr || !home) throw new Error('Home not found');
  if (userErr || !user) throw new Error('User not found');

  const id = crypto.randomUUID();
  const letterCode = generateLetterCode();
  const issuedAtIso = new Date().toISOString();
  const facts = {
    residentName: residentNameFromUser(user),
    addressLine1: addressLine1FromHome(home),
    cityZip: cityStateZip(home),
    purpose: sanitizePurpose(purpose),
    letterCode,
    issuedAtIso,
    letterId: id,
  };

  const pdf = await renderLetterPdf(facts);
  const row = {
    id,
    home_id: homeId,
    user_id: userId,
    letter_code: letterCode,
    resident_name: facts.residentName,
    address_line1: facts.addressLine1,
    city: home.city || null,
    state: home.state || null,
    zipcode: home.zipcode || null,
    purpose: facts.purpose,
    status: 'issued',
    issued_at: issuedAtIso,
    pdf_sha256: crypto.createHash('sha256').update(pdf).digest('hex'),
    pdf_base64: pdf.toString('base64'),
  };

  const { data: saved, error } = await supabaseAdmin.from('ResidencyLetter').insert(row).select().single();
  if (error) {
    logger.error('residencyLetter: insert failed', { homeId, userId, error: error.message });
    throw new Error('Could not save the letter');
  }
  logger.info('residencyLetter: issued', { letterId: saved.id, homeId, userId });
  return serializeLetter(saved);
}

/** The caller's letters for a home, newest first. */
async function listLetters({ homeId, userId }) {
  const { data, error } = await supabaseAdmin
    .from('ResidencyLetter')
    .select('id, home_id, status, purpose, resident_name, address_line1, city, state, zipcode, letter_code, issued_at, revoked_at, pdf_sha256')
    .eq('home_id', homeId)
    .eq('user_id', userId)
    .order('issued_at', { ascending: false });
  if (error) {
    logger.error('residencyLetter: list failed', { homeId, userId, error: error.message });
    throw new Error('Could not load letters');
  }
  return (data || []).map(serializeLetter);
}

/** The exact issued PDF — issuer only. Returns null when not found/not yours. */
async function getLetterPdf({ homeId, userId, letterId }) {
  const { data, error } = await supabaseAdmin
    .from('ResidencyLetter')
    .select('id, user_id, home_id, status, pdf_base64, issued_at')
    .eq('id', letterId)
    .eq('home_id', homeId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return { buffer: Buffer.from(data.pdf_base64, 'base64'), status: data.status, issuedAt: data.issued_at };
}

/** Revoke — issuer only. Returns the updated record, or null when not found/not yours. */
async function revokeLetter({ homeId, userId, letterId }) {
  const { data, error } = await supabaseAdmin
    .from('ResidencyLetter')
    .update({ status: 'revoked', revoked_at: new Date().toISOString() })
    .eq('id', letterId)
    .eq('home_id', homeId)
    .eq('user_id', userId)
    .eq('status', 'issued')
    .select()
    .maybeSingle();
  if (error) {
    logger.error('residencyLetter: revoke failed', { letterId, error: error.message });
    throw new Error('Could not revoke the letter');
  }
  return data ? serializeLetter(data) : null;
}

/**
 * Public verification by code. Returns exactly what the paper shows —
 * confirms genuineness + current status, never reveals anything extra.
 */
async function verifyByCode(code) {
  const normalized = normalizeLetterCode(code);
  if (!normalized) return { valid: false };

  const { data, error } = await supabaseAdmin
    .from('ResidencyLetter')
    .select('id, status, resident_name, address_line1, city, state, zipcode, purpose, issued_at, revoked_at, verify_count')
    .eq('letter_code', normalized)
    .maybeSingle();
  if (error || !data) return { valid: false };

  // Telemetry (best-effort; the read result is what matters).
  supabaseAdmin
    .from('ResidencyLetter')
    .update({ verify_count: (data.verify_count || 0) + 1, last_verified_at: new Date().toISOString() })
    .eq('id', data.id)
    .then(({ error: updErr }) => {
      if (updErr) logger.warn('residencyLetter: verify_count update failed', { error: updErr.message });
    });

  return {
    valid: true,
    status: data.status,
    resident_name: data.resident_name,
    address: {
      line1: data.address_line1,
      city: data.city,
      state: data.state,
      zipcode: data.zipcode,
    },
    purpose: data.purpose,
    issued_at: data.issued_at,
    revoked_at: data.revoked_at,
  };
}

module.exports = {
  issueLetter,
  listLetters,
  getLetterPdf,
  revokeLetter,
  verifyByCode,
  // Exported for testing.
  generateLetterCode,
  normalizeLetterCode,
  residentNameFromUser,
  addressLine1FromHome,
  sanitizePurpose,
};
