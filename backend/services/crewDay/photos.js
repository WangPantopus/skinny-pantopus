'use strict';

/**
 * Crew Day photos (02-contract.md §2 "Photos"): completion photos from the crew and problem photos from the household,
 * stored without their metadata (services/photoMetadata.js: no location, camera or time; HEIC becomes JPEG) in the
 * existing private completion bucket (GIG_COMPLETION_BUCKET) under crew-day/<crew_day_id>/<booking_id>/, and read
 * only through short-lived signed URLs by that household, the crew and the operator.
 */

const crypto = require('crypto');

const supabaseAdmin = require('../../config/supabaseAdmin');
const logger = require('../../utils/logger');
const { removePhotoMetadata, PhotoNotCleanedError } = require('../photoMetadata');
const { CrewDayError } = require('./rules');

const SIGNED_URL_SECONDS = 60 * 60;
const EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png' };
const PURPOSES = ['done', 'problem'];
let checkedBucket = null;

function unavailable() {
  return new CrewDayError(503, 'UNAVAILABLE', "Photos can't be saved right now. Please try again in a minute.");
}

/** The private bucket, checked once per process to be private. */
async function bucket() {
  const name = (process.env.GIG_COMPLETION_BUCKET || '').trim();
  if (!/^[a-z0-9][a-z0-9-]{2,62}$/.test(name)) throw unavailable();
  if (checkedBucket !== name) {
    const result = await supabaseAdmin.storage.getBucket(name).catch(() => null);
    if (!result || result.error || result.data?.public !== false) {
      logger.error('crewDay.photos.bucket_unavailable', { bucket: name, error: result?.error?.message });
      throw unavailable();
    }
    checkedBucket = name;
  }
  return supabaseAdmin.storage.from(name);
}

function prefixFor(booking, purpose) {
  return `crew-day/${booking.crew_day_id}/${booking.id}/${purpose}-`;
}

/** Stores one photo for a booking and answers its path. */
async function store({ booking, purpose, buffer }) {
  if (!PURPOSES.includes(purpose)) throw new CrewDayError(422, 'VALIDATION', 'Say what the photo is for.', { field: 'purpose' });
  let cleaned;
  try {
    cleaned = await removePhotoMetadata(buffer);
  } catch (error) {
    if (error instanceof PhotoNotCleanedError) throw new CrewDayError(error.status, error.code, error.message);
    throw error;
  }
  const extension = EXTENSIONS[cleaned.mimetype];
  if (!extension) throw new CrewDayError(415, 'PHOTO_TYPE', 'Send a JPEG, PNG or HEIC photo.');
  const path = `${prefixFor(booking, purpose)}${crypto.randomUUID()}.${extension}`;
  const target = await bucket();
  const { error } = await target.upload(path, cleaned.buffer, { contentType: cleaned.mimetype, cacheControl: '0', upsert: false });
  if (error) {
    logger.error('crewDay.photos.upload_failed', { bookingId: booking.id, error: error.message });
    throw unavailable();
  }
  return path;
}

/** Paths a booking may list for a purpose: its own, uploaded for that purpose. */
function validPaths(booking, purpose, paths, { min = 0, max }) {
  if (!Array.isArray(paths)) return null;
  const unique = [...new Set(paths.map(String))];
  if (unique.length < min || unique.length > max) return null;
  return unique.every((p) => p.startsWith(prefixFor(booking, purpose)) && /^[\w/.-]+$/.test(p)) ? unique : null;
}

/** Signed URLs for stored paths (an hour), in order; a path that can't be signed is left out. */
async function signedUrls(paths = []) {
  if (!paths.length) return [];
  try {
    const target = await bucket();
    const { data, error } = await target.createSignedUrls(paths, SIGNED_URL_SECONDS);
    if (error) throw error;
    return (data || []).filter((d) => d.signedUrl).map((d) => ({ path: d.path, url: d.signedUrl }));
  } catch (error) {
    logger.warn('crewDay.photos.sign_failed', { error: error.message });
    return [];
  }
}

module.exports = { store, validPaths, signedUrls, PURPOSES };
