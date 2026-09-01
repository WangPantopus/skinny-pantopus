// ============================================================
// UPLOAD ROUTES — AWS S3-based file uploads
// Profile pictures, gig media, home task media
// ============================================================

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const rateLimit = require('express-rate-limit');
const supabaseAdmin = require('../config/supabaseAdmin');
const { S3_BUCKET } = require('../config/aws');
const verifyToken = require('../middleware/verifyToken');
const logger = require('../utils/logger');
const s3 = require('../services/s3Service');
const imageResizeService = require('../services/marketplace/imageResizeService');
const { calculateAndStoreCompleteness } = require('../utils/businessCompleteness');
const { requirePersonaEnabled } = require('../utils/featureFlags');
const { writeIdentityAuditLog } = require('../utils/identityAudit');

// Rate limit: 30 uploads per 15 minutes per IP
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'Too many upload requests. Please try again later.',
});

// Try to load sharp for image processing
let sharp;
try {
  sharp = require('sharp');
} catch (err) {
  logger.warn('Sharp not installed — image thumbnails disabled');
}

// ============ MIME VALIDATION & EXIF STRIPPING ============

// Lazy-load ESM-only file-type module
let _fileTypeFromBuffer;
async function getFileTypeFromBuffer() {
  if (!_fileTypeFromBuffer) {
    const mod = await import('file-type');
    _fileTypeFromBuffer = mod.fileTypeFromBuffer;
  }
  return _fileTypeFromBuffer;
}

// ZIP-based Office formats share the same magic bytes as generic ZIP
const ZIP_BASED_MIMES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

/**
 * Validate that the file buffer's actual content matches the claimed MIME type.
 * Returns { valid: true } or { valid: false, detected, declared }.
 * On detection errors (e.g. file-type throws), allows upload and returns { valid: true }.
 */
async function validateFileMime(file) {
  if (!file || !Buffer.isBuffer(file.buffer)) {
    return { valid: false, detected: null, declared: file?.mimetype, reason: 'missing_buffer' };
  }

  let detected;
  try {
    const fileTypeFromBuffer = await getFileTypeFromBuffer();
    detected = await fileTypeFromBuffer(file.buffer);
  } catch (err) {
    // file-type can throw on edge cases (e.g. tiny buffers, certain formats)
    logger.warn('MIME detection threw — allowing upload', {
      originalname: file.originalname,
      declared: file.mimetype,
      error: err.message,
    });
    return { valid: true };
  }

  if (!detected) {
    // file-type can't identify the file (e.g. plain text) — allow but log
    logger.warn('MIME detection returned undefined — allowing upload', {
      declared: file.mimetype,
      originalname: file.originalname,
    });
    return { valid: true };
  }

  const declaredMime = file.mimetype;
  const detectedMime = detected.mime;

  // Exact match
  if (detectedMime === declaredMime) return { valid: true };

  // ZIP-based Office formats: detected as application/zip but declared as docx/xlsx
  if (detectedMime === 'application/zip' && ZIP_BASED_MIMES.has(declaredMime)) {
    return { valid: true };
  }

  // HEIF/HEIC variants: file-type may detect image/heif vs declared image/heic or vice versa
  const heicVariants = new Set(['image/heic', 'image/heif']);
  if (heicVariants.has(detectedMime) && heicVariants.has(declaredMime)) {
    return { valid: true };
  }

  return { valid: false, detected: detectedMime, declared: declaredMime };
}

/**
 * Strip EXIF/metadata from image buffers using sharp.
 * Applies EXIF orientation via .rotate() then strips all metadata.
 * Mutates file.buffer in place. Never throws.
 */
async function stripImageMetadata(file) {
  try {
    if (!sharp) return;
    if (!file || !file.buffer || !file.mimetype || !file.mimetype.startsWith('image/')) return;
    // Skip GIF — sharp re-encodes animated GIFs, losing animation
    if (file.mimetype === 'image/gif') return;

    const stripped = await sharp(file.buffer)
      .rotate()    // Apply EXIF orientation then discard EXIF
      .toBuffer();
    file.buffer = stripped;
    file.size = stripped.length;
  } catch (err) {
    logger.warn('Failed to strip image metadata — using original', {
      originalname: file?.originalname,
      error: err.message,
    });
  }
}

/**
 * Middleware: validate MIME types and strip EXIF for all uploaded files.
 * Must run AFTER multer and AFTER enforceFileSizeLimits.
 */
async function validateAndStripUploads(req, res, next) {
  const files = req.files || (req.file ? [req.file] : []);
  if (files.length === 0) return next();

  try {
    for (const file of files) {
      if (!file || !file.buffer) {
        return res.status(400).json({ error: 'Invalid file: no data received' });
      }

      // 1. MIME validation
      const result = await validateFileMime(file);
      if (!result.valid) {
        if (result.reason === 'missing_buffer') {
          return res.status(400).json({ error: 'Invalid file: no data received' });
        }
        logger.warn('MIME type mismatch rejected', {
          originalname: file.originalname,
          declared: result.declared,
          detected: result.detected,
        });
        return res.status(400).json({
          error: `File "${file.originalname}" content does not match its declared type (declared: ${result.declared}, detected: ${result.detected})`,
        });
      }

      // 2. EXIF stripping for images (never throw — catch inside stripImageMetadata)
      await stripImageMetadata(file);
    }
    next();
  } catch (err) {
    logger.error('File validation error', { error: err.message, stack: err.stack });
    res.status(500).json({ error: 'File validation failed' });
  }
}

// ============ MULTER CONFIG ============

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024, files: 10 },
  fileFilter: (req, file, cb) => {
    if (s3.isAllowedType(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed: ${file.mimetype}`), false);
    }
  },
});

/**
 * Middleware to enforce per-category file size limits after multer accepts the file.
 * Multer's global limit is 100MB (video max), but images should be capped at 10MB
 * and documents at 25MB.
 */
function enforceFileSizeLimits(req, res, next) {
  const files = req.files || (req.file ? [req.file] : []);
  for (const file of files) {
    const category = s3.categorizeFile(file.mimetype);
    const maxSize = category ? s3.MAX_FILE_SIZES[category] : s3.MAX_FILE_SIZES.document;
    if (maxSize && file.size > maxSize) {
      return res.status(413).json({
        error: `File "${file.originalname}" exceeds the ${Math.round(maxSize / 1024 / 1024)}MB limit for ${category || 'this'} file type`,
      });
    }
  }
  next();
}

// ============ HELPERS ============

async function generateThumbnail(buffer, mimetype) {
  if (!sharp || !mimetype.startsWith('image/')) return null;
  try {
    const thumbBuffer = await sharp(buffer)
      .resize(400, 400, { fit: 'cover' })
      .webp({ quality: 80 })
      .toBuffer();
    return thumbBuffer;
  } catch {
    return null;
  }
}

function resolveStoredMediaUrl(url, key) {
  const cleanUrl = typeof url === 'string' ? url.trim() : '';
  const cleanKey = typeof key === 'string' ? key.trim() : '';

  if (/^https?:\/\//i.test(cleanUrl)) return cleanUrl;
  if (cleanKey) return s3.getPublicUrl(cleanKey);
  if (cleanUrl) return s3.getPublicUrl(cleanUrl.replace(/^\/+/, ''));
  return '';
}

// ============ PROFILE PICTURE ============

/**
 * POST /api/upload/profile-picture
 * Upload or replace user profile picture
 */
router.post('/profile-picture', uploadLimiter, verifyToken, upload.single('file'), enforceFileSizeLimits, validateAndStripUploads, async (req, res) => {
  try {
    const userId = req.user.id;
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file provided' });

    if (!file.mimetype.startsWith('image/')) {
      return res.status(400).json({ error: 'Profile picture must be an image' });
    }

    // Process image (resize if sharp available)
    let processedBuffer = file.buffer;
    if (sharp) {
      try {
        processedBuffer = await sharp(file.buffer)
          .resize(800, 800, { fit: 'cover' })
          .webp({ quality: 85 })
          .toBuffer();
      } catch {
        processedBuffer = file.buffer;
      }
    }

    // Upload to S3
    const { url, key } = await s3.uploadProfilePicture(
      processedBuffer,
      file.originalname,
      userId,
      sharp ? 'image/webp' : file.mimetype
    );

    // Delete old profile picture from S3 if it has an S3 key
    const { data: currentUser } = await supabaseAdmin
      .from('User')
      .select('profile_picture_url')
      .eq('id', userId)
      .single();

    // Update user record
    const { data: updatedUser, error } = await supabaseAdmin
      .from('User')
      .update({
        profile_picture_url: url,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select('id, profile_picture_url')
      .single();

    if (error) {
      // Rollback: delete uploaded file
      await s3.deleteFromS3(key);
      return res.status(500).json({ error: 'Failed to update profile picture' });
    }

    logger.info('Profile picture uploaded via S3', { userId, key });

    res.json({
      message: 'Profile picture uploaded successfully',
      url,
      key,
      user: updatedUser,
    });
  } catch (err) {
    logger.error('Profile picture upload error', { error: err.message });
    res.status(500).json({ error: err.message || 'Failed to upload profile picture' });
  }
});

// ============ PERSONA MEDIA (avatar / banner) ============

/**
 * POST /api/upload/persona-media/:personaId
 * Upload avatar or banner for a Beacon.
 * Query param: type = "avatar" | "banner"
 */
router.post('/persona-media/:personaId', requirePersonaEnabled, uploadLimiter, verifyToken, upload.single('file'), enforceFileSizeLimits, validateAndStripUploads, async (req, res) => {
  try {
    const userId = req.user.id;
    const { personaId } = req.params;
    const mediaType = req.query.type || req.body.type;

    if (!['avatar', 'banner'].includes(mediaType)) {
      return res.status(400).json({ error: 'type must be "avatar" or "banner"' });
    }

    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file provided' });

    if (!file.mimetype.startsWith('image/')) {
      return res.status(400).json({ error: 'Beacon media must be an image' });
    }

    const { data: persona, error: personaErr } = await supabaseAdmin
      .from('PublicPersona')
      .select('id, user_id, handle, avatar_url, banner_url, status')
      .eq('id', personaId)
      .single();

    if (personaErr || !persona) {
      return res.status(404).json({ error: 'Beacon not found' });
    }

    if (persona.user_id !== userId) {
      return res.status(403).json({ error: 'You do not have permission to edit this Beacon' });
    }

    let processedBuffer = file.buffer;
    let finalMimeType = file.mimetype;
    if (sharp) {
      try {
        const resize =
          mediaType === 'avatar'
            ? sharp(file.buffer).resize(800, 800, { fit: 'cover' })
            : sharp(file.buffer).resize(1600, 600, { fit: 'cover' });
        processedBuffer = await resize.webp({ quality: 85 }).toBuffer();
        finalMimeType = 'image/webp';
      } catch {
        processedBuffer = file.buffer;
      }
    }

    const ext = finalMimeType === 'image/webp'
      ? 'webp'
      : (path.extname(file.originalname || '').replace('.', '') || 'jpg').toLowerCase();
    const key = `persona-media/${persona.id}/${mediaType}-${Date.now()}-${require('crypto').randomBytes(4).toString('hex')}.${ext}`;
    const { url } = await s3.uploadToS3(processedBuffer, key, finalMimeType);

    const updateField = mediaType === 'avatar' ? 'avatar_url' : 'banner_url';
    const { data: updatedPersona, error: updateErr } = await supabaseAdmin
      .from('PublicPersona')
      .update({
        [updateField]: url,
        updated_at: new Date().toISOString(),
      })
      .eq('id', persona.id)
      .select('id, handle, avatar_url, banner_url')
      .single();

    if (updateErr) {
      await s3.deleteFromS3(key);
      return res.status(500).json({ error: `Failed to update ${mediaType}` });
    }

    await writeIdentityAuditLog({
      actorUserId: userId,
      targetUserId: userId,
      personaId: persona.id,
      action: `persona.${mediaType}_uploaded`,
      targetType: 'PublicPersona',
      targetId: persona.id,
      metadata: { media_type: mediaType },
      req,
    });

    logger.info('Persona media uploaded', { personaId: persona.id, mediaType, key });

    return res.json({
      message: `${mediaType} uploaded successfully`,
      url,
      key,
      persona: updatedPersona,
    });
  } catch (err) {
    logger.error('Persona media upload error', { error: err.message });
    return res.status(500).json({ error: err.message || 'Failed to upload Beacon media' });
  }
});


// ============ GIG MEDIA ============

/**
 * POST /api/upload/gig-media/:gigId
 * Upload media files for a gig (up to 10)
 */
router.post('/gig-media/:gigId', uploadLimiter, verifyToken, upload.array('files', 10), enforceFileSizeLimits, validateAndStripUploads, async (req, res) => {
  try {
    const userId = req.user.id;
    const { gigId } = req.params;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    // Verify gig ownership
    const { data: gig, error: gigErr } = await supabaseAdmin
      .from('Gig')
      .select('id, user_id')
      .eq('id', gigId)
      .single();

    if (gigErr || !gig) {
      return res.status(404).json({ error: 'Gig not found' });
    }
    if (gig.user_id !== userId) {
      return res.status(403).json({ error: 'Only the gig owner can upload media' });
    }

    // Check current media count
    const { count } = await supabaseAdmin
      .from('GigMedia')
      .select('id', { count: 'exact', head: true })
      .eq('gig_id', gigId);

    if ((count || 0) + files.length > 10) {
      return res.status(400).json({ error: `Maximum 10 media files per gig. Currently: ${count || 0}` });
    }

    const uploadedMedia = [];

    for (const file of files) {
      const { url, key } = await s3.uploadGigMedia(
        file.buffer,
        file.originalname,
        userId,
        gigId,
        file.mimetype
      );
      const category = s3.categorizeFile(file.mimetype) || 'document';

      // Generate thumbnail for images
      let thumbnailUrl = null;
      const thumbBuffer = await generateThumbnail(file.buffer, file.mimetype);
      if (thumbBuffer) {
        const thumbKey = key.replace(/(\.[^.]+)$/, '_thumb.webp');
        const thumbResult = await s3.uploadToS3(thumbBuffer, thumbKey, 'image/webp');
        thumbnailUrl = thumbResult.url;
      }

      // Save to database
      const { data: mediaRecord, error: insertErr } = await supabaseAdmin
        .from('GigMedia')
        .insert({
          gig_id: gigId,
          uploaded_by: userId,
          file_url: url,
          file_key: key,
          file_name: file.originalname,
          file_type: category,
          mime_type: file.mimetype,
          file_size: file.size,
          thumbnail_url: thumbnailUrl,
          display_order: (count || 0) + uploadedMedia.length,
        })
        .select()
        .single();

      if (insertErr) {
        logger.error('GigMedia insert error', { error: insertErr.message });
        // Clean up S3
        await s3.deleteFromS3(key);
        continue;
      }

      uploadedMedia.push(mediaRecord);
    }

    // Also update the Gig.attachments text[] with the new URLs
    const newUrls = uploadedMedia.map(m => m.file_url);
    const { data: currentGig } = await supabaseAdmin
      .from('Gig')
      .select('attachments')
      .eq('id', gigId)
      .single();

    const existingAttachments = currentGig?.attachments || [];
    await supabaseAdmin
      .from('Gig')
      .update({
        attachments: [...existingAttachments, ...newUrls],
        updated_at: new Date().toISOString(),
      })
      .eq('id', gigId);

    logger.info('Gig media uploaded', { gigId, count: uploadedMedia.length });

    res.json({
      message: `${uploadedMedia.length} file(s) uploaded successfully`,
      media: uploadedMedia,
    });
  } catch (err) {
    logger.error('Gig media upload error', { error: err.message });
    res.status(500).json({ error: err.message || 'Failed to upload gig media' });
  }
});

/**
 * GET /api/upload/gig-media/:gigId
 * Get all media for a gig
 */
router.get('/gig-media/:gigId', async (req, res) => {
  try {
    const { gigId } = req.params;
    const { data, error } = await supabaseAdmin
      .from('GigMedia')
      .select('*')
      .eq('gig_id', gigId)
      .order('display_order', { ascending: true });

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch gig media' });
    }
    const media = (data || []).map((row) => ({
      ...row,
      file_url: resolveStoredMediaUrl(row.file_url, row.file_key),
      thumbnail_url: row.thumbnail_url
        ? resolveStoredMediaUrl(row.thumbnail_url, '')
        : null,
    }));

    res.json({ media });
  } catch (err) {
    logger.error('Gig media fetch error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch gig media' });
  }
});

/**
 * DELETE /api/upload/gig-media/:gigId/:mediaId
 * Delete a gig media file
 */
router.delete('/gig-media/:gigId/:mediaId', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { gigId, mediaId } = req.params;

    // Verify ownership
    const { data: media, error: fetchErr } = await supabaseAdmin
      .from('GigMedia')
      .select('*, Gig!inner(user_id)')
      .eq('id', mediaId)
      .eq('gig_id', gigId)
      .single();

    if (fetchErr || !media) {
      return res.status(404).json({ error: 'Media not found' });
    }

    // Only gig owner can delete
    if (media.Gig?.user_id !== userId) {
      // Fallback check
      const { data: gig } = await supabaseAdmin.from('Gig').select('user_id').eq('id', gigId).single();
      if (!gig || gig.user_id !== userId) {
        return res.status(403).json({ error: 'Not authorized' });
      }
    }

    // Delete from S3
    await s3.deleteFromS3(media.file_key);

    // Delete from DB
    await supabaseAdmin.from('GigMedia').delete().eq('id', mediaId);

    // Update Gig.attachments array
    const { data: currentGig } = await supabaseAdmin.from('Gig').select('attachments').eq('id', gigId).single();
    if (currentGig?.attachments) {
      const updated = currentGig.attachments.filter(u => u !== media.file_url);
      await supabaseAdmin.from('Gig').update({ attachments: updated }).eq('id', gigId);
    }

    res.json({ message: 'Media deleted successfully' });
  } catch (err) {
    logger.error('Gig media delete error', { error: err.message });
    res.status(500).json({ error: 'Failed to delete media' });
  }
});

/**
 * POST /api/upload/chat-media/:roomId
 * Upload chat attachments (documents/images) and return File records.
 */
router.post('/chat-media/:roomId', uploadLimiter, verifyToken, upload.array('files', 5), enforceFileSizeLimits, validateAndStripUploads, async (req, res) => {
  try {
    const userId = req.user.id;
    const { roomId } = req.params;
    const files = req.files || [];

    if (files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    const { data: participant } = await supabaseAdmin
      .from('ChatParticipant')
      .select('id')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle();

    if (!participant) {
      return res.status(403).json({ error: 'Not authorized to upload files to this room' });
    }

    const uploaded = [];
    for (const file of files) {
      const { url, key } = await s3.uploadGeneral(
        file.buffer,
        file.originalname,
        userId,
        `chat/${roomId}`,
        file.mimetype
      );

      const ext = (path.extname(file.originalname || '').replace('.', '') || '').toLowerCase();
      const category = s3.categorizeFile(file.mimetype) || 'document';

      // Insert with a temporary file_url, then update it to the authenticated
      // proxy path once we have the generated id. Clients will fetch files
      // through GET /api/chat/files/:fileId which verifies room membership
      // and returns a short-lived signed S3 URL.
      const { data: saved, error: saveErr } = await supabaseAdmin
        .from('File')
        .insert({
          user_id: userId,
          filename: key.split('/').pop() || file.originalname,
          original_filename: file.originalname,
          file_path: key,
          file_url: url,
          file_size: file.size,
          mime_type: file.mimetype,
          file_extension: ext,
          file_type: 'chat_file',
          visibility: 'private',
          processing_status: 'completed',
          metadata: {
            room_id: roomId,
            category,
            uploaded_via: 'chat',
          }
        })
        .select('id, file_url, original_filename, mime_type, file_size, file_type')
        .single();

      if (saved && !saveErr) {
        // Replace the public URL with the authenticated proxy path
        const proxyUrl = `/api/chat/files/${saved.id}`;
        await supabaseAdmin
          .from('File')
          .update({ file_url: proxyUrl })
          .eq('id', saved.id);
        saved.file_url = proxyUrl;
      }

      if (saveErr) {
        await s3.deleteFromS3(key);
        return res.status(500).json({ error: 'Failed to save uploaded file metadata' });
      }

      uploaded.push(saved);
    }

    res.json({
      message: `${uploaded.length} file(s) uploaded`,
      media: uploaded,
    });
  } catch (err) {
    logger.error('Chat media upload error', { error: err.message });
    res.status(500).json({ error: err.message || 'Failed to upload chat files' });
  }
});

/**
 * POST /api/upload/gig-question-media/:gigId
 * Upload files used in gig Q&A (questions/answers).
 * Returns file URLs so callers can attach them to GigQuestion records.
 */
router.post('/gig-question-media/:gigId', uploadLimiter, verifyToken, upload.array('files', 10), enforceFileSizeLimits, validateAndStripUploads, async (req, res) => {
  try {
    const userId = req.user.id;
    const { gigId } = req.params;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    // Ensure gig exists.
    const { data: gig, error: gigErr } = await supabaseAdmin
      .from('Gig')
      .select('id')
      .eq('id', gigId)
      .single();

    if (gigErr || !gig) {
      return res.status(404).json({ error: 'Gig not found' });
    }

    const uploadedFiles = [];
    for (const file of files) {
      const { url, key } = await s3.uploadGigMedia(
        file.buffer,
        file.originalname,
        userId,
        gigId,
        file.mimetype
      );
      const category = s3.categorizeFile(file.mimetype) || 'document';

      let thumbnailUrl = null;
      const thumbBuffer = await generateThumbnail(file.buffer, file.mimetype);
      if (thumbBuffer) {
        const thumbKey = key.replace(/(\.[^.]+)$/, '_thumb.webp');
        const thumbResult = await s3.uploadToS3(thumbBuffer, thumbKey, 'image/webp');
        thumbnailUrl = thumbResult.url;
      }

      uploadedFiles.push({
        file_url: url,
        file_key: key,
        file_name: file.originalname,
        file_type: category,
        mime_type: file.mimetype,
        file_size: file.size,
        thumbnail_url: thumbnailUrl,
      });
    }

    return res.json({
      message: `${uploadedFiles.length} file(s) uploaded successfully`,
      media: uploadedFiles,
    });
  } catch (err) {
    logger.error('Gig question media upload error', { error: err.message });
    return res.status(500).json({ error: err.message || 'Failed to upload files' });
  }
});

/**
 * POST /api/upload/gig-completion-media/:gigId
 * Upload proof files for completion submissions (assigned worker or gig owner).
 */
router.post('/gig-completion-media/:gigId', uploadLimiter, verifyToken, upload.array('files', 10), enforceFileSizeLimits, validateAndStripUploads, async (req, res) => {
  try {
    const actorUserId = req.user.id;
    const { gigId } = req.params;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    const { data: gig, error: gigErr } = await supabaseAdmin
      .from('Gig')
      .select('id, user_id, accepted_by')
      .eq('id', gigId)
      .single();

    if (gigErr || !gig) return res.status(404).json({ error: 'Gig not found' });

    const isOwner = String(gig.user_id) === String(actorUserId);
    const isWorker = gig.accepted_by && String(gig.accepted_by) === String(actorUserId);
    if (!isOwner && !isWorker) {
      return res.status(403).json({ error: 'Only the assigned worker or owner can upload completion files' });
    }

    const uploadedFiles = [];
    for (const file of files) {
      const { url, key } = await s3.uploadGigMedia(
        file.buffer,
        file.originalname,
        actorUserId,
        gigId,
        file.mimetype
      );
      const category = s3.categorizeFile(file.mimetype) || 'document';

      let thumbnailUrl = null;
      const thumbBuffer = await generateThumbnail(file.buffer, file.mimetype);
      if (thumbBuffer) {
        const thumbKey = key.replace(/(\.[^.]+)$/, '_thumb.webp');
        const thumbResult = await s3.uploadToS3(thumbBuffer, thumbKey, 'image/webp');
        thumbnailUrl = thumbResult.url;
      }

      uploadedFiles.push({
        file_url: url,
        file_key: key,
        file_name: file.originalname,
        file_type: category,
        mime_type: file.mimetype,
        file_size: file.size,
        thumbnail_url: thumbnailUrl,
      });
    }

    return res.json({
      message: `${uploadedFiles.length} file(s) uploaded successfully`,
      media: uploadedFiles,
    });
  } catch (err) {
    logger.error('Gig completion media upload error', { error: err.message });
    return res.status(500).json({ error: err.message || 'Failed to upload files' });
  }
});

// ============ POST MEDIA (FEED) ============

/**
 * POST /api/upload/comment-media/:commentId
 * Upload image files for a post comment (up to 4).
 */
router.post('/comment-media/:commentId', uploadLimiter, verifyToken, upload.array('files', 4), enforceFileSizeLimits, validateAndStripUploads, async (req, res) => {
  try {
    const userId = req.user.id;
    const { commentId } = req.params;
    const files = req.files || [];

    if (files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    const { data: comment, error: commentErr } = await supabaseAdmin
      .from('PostComment')
      .select('id, user_id, post_id')
      .eq('id', commentId)
      .single();

    if (commentErr || !comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    if (String(comment.user_id) !== String(userId)) {
      return res.status(403).json({ error: 'Only the comment author can upload media' });
    }

    const { data: existingFiles } = await supabaseAdmin
      .from('File')
      .select('id')
      .eq('comment_id', commentId)
      .eq('is_deleted', false);

    const existingCount = (existingFiles || []).length;
    if (existingCount + files.length > 4) {
      return res.status(400).json({ error: `Maximum 4 images per comment. Currently: ${existingCount}` });
    }

    const attachments = [];
    for (const file of files) {
      const category = s3.categorizeFile(file.mimetype);
      if (category !== 'image') {
        return res.status(400).json({ error: 'Comment media only supports images' });
      }

      const { url, key } = await s3.uploadGeneral(
        file.buffer,
        file.originalname,
        userId,
        `comments/${commentId}`,
        file.mimetype
      );

      const ext = (path.extname(file.originalname || '').replace('.', '') || '').toLowerCase();
      const { data: saved, error: saveErr } = await supabaseAdmin
        .from('File')
        .insert({
          user_id: userId,
          filename: key.split('/').pop() || file.originalname,
          original_filename: file.originalname,
          file_path: key,
          file_url: url,
          file_size: file.size,
          mime_type: file.mimetype,
          file_extension: ext,
          file_type: 'post_image',
          visibility: 'public',
          processing_status: 'completed',
          post_id: comment.post_id,
          comment_id: commentId,
          metadata: {
            uploaded_via: 'post_comment',
            comment_id: commentId,
            post_id: comment.post_id,
          },
        })
        .select('id, comment_id, file_url, original_filename, mime_type, file_size, file_type, created_at')
        .single();

      if (saveErr) {
        await s3.deleteFromS3(key);
        logger.error('Comment media save error', { error: saveErr.message, commentId });
        return res.status(500).json({ error: 'Failed to save uploaded comment media' });
      }

      attachments.push(saved);
    }

    return res.json({
      message: `${attachments.length} image(s) uploaded successfully`,
      attachments,
    });
  } catch (err) {
    logger.error('Comment media upload error', { error: err.message, commentId: req.params.commentId });
    return res.status(500).json({ error: err.message || 'Failed to upload comment media' });
  }
});

/**
 * POST /api/upload/post-media/:postId
 * Upload media files for a feed post (images/videos only, up to 9)
 */
router.post('/post-media/:postId', uploadLimiter, verifyToken, upload.array('files', 9), enforceFileSizeLimits, validateAndStripUploads, async (req, res) => {
  try {
    const userId = req.user.id;
    const { postId } = req.params;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    const { data: postRecord, error: postErr } = await supabaseAdmin
      .from('Post')
      .select('id, user_id, media_urls, media_types, media_thumbnails, media_live_urls')
      .eq('id', postId)
      .single();

    if (postErr || !postRecord) {
      logger.error('Post lookup failed for media upload', { postId, error: postErr?.message });
      return res.status(404).json({ error: 'Post not found' });
    }
    if (String(postRecord.user_id) !== String(userId)) {
      return res.status(403).json({ error: 'Only the post creator can upload media' });
    }

    const existingCount = (postRecord.media_urls || []).length;
    if (existingCount + files.length > 9) {
      return res.status(400).json({ error: `Maximum 9 media files per post. Currently: ${existingCount}` });
    }

    const uploadedUrls = [];
    const uploadedTypes = [];
    const thumbnailUrls = [];

    for (const file of files) {
      const category = s3.categorizeFile(file.mimetype);
      if (category !== 'image' && category !== 'video') {
        return res.status(400).json({ error: 'Post media only supports images and videos' });
      }

      const { url, key } = await s3.uploadGeneral(
        file.buffer,
        file.originalname,
        userId,
        `posts/${postId}`,
        file.mimetype
      );

      uploadedUrls.push(url);
      uploadedTypes.push(category === 'video' ? 'video' : 'image');

      // Generate resized variants (non-blocking on failure)
      let thumbnailUrl = '';
      if (category === 'image') {
        try {
          const variants = await imageResizeService.processListingImage(file.buffer, key);
          if (variants && variants.thumb) {
            thumbnailUrl = variants.thumb;
          }
        } catch (resizeErr) {
          logger.warn('Post image resize failed, continuing', { postId, error: resizeErr.message });
        }
      }
      thumbnailUrls.push(thumbnailUrl);
    }

    const newMediaUrls = [...(postRecord.media_urls || []), ...uploadedUrls];
    const newMediaTypes = [...(postRecord.media_types || []), ...uploadedTypes];
    // Pad media_live_urls so parallel arrays stay aligned
    const existingLiveUrls = postRecord.media_live_urls || [];
    const newMediaLiveUrls = [...existingLiveUrls, ...uploadedUrls.map(() => '')];

    const updatePayload = {
      media_urls: newMediaUrls,
      media_types: newMediaTypes,
      media_live_urls: newMediaLiveUrls,
      updated_at: new Date().toISOString(),
    };

    const newMediaThumbnails = [...(postRecord.media_thumbnails || []), ...thumbnailUrls];
    updatePayload.media_thumbnails = newMediaThumbnails;

    const { error: updateErr } = await supabaseAdmin
      .from('Post')
      .update(updatePayload)
      .eq('id', postId);

    if (updateErr) {
      logger.error('Post media update error', { error: updateErr.message, postId });
      return res.status(500).json({ error: 'Failed to update post media' });
    }

    return res.json({
      message: `${uploadedUrls.length} file(s) uploaded successfully`,
      media_urls: newMediaUrls,
      media_types: newMediaTypes,
      media_thumbnails: newMediaThumbnails,
      media_live_urls: newMediaLiveUrls,
    });
  } catch (err) {
    logger.error('Post media upload error', { error: err.message });
    return res.status(500).json({ error: err.message || 'Failed to upload media' });
  }
});


// ============ LISTING MEDIA (MARKETPLACE) ============

/**
 * POST /api/upload/listing-media/:listingId
 * Upload media files for a marketplace listing (up to 10)
 */
router.post('/listing-media/:listingId', uploadLimiter, verifyToken, upload.array('files', 10), enforceFileSizeLimits, validateAndStripUploads, async (req, res) => {
  try {
    const userId = req.user.id;
    const { listingId } = req.params;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    // Verify listing ownership
    const { data: listing, error: listingErr } = await supabaseAdmin
      .from('Listing')
      .select('id, user_id, media_urls, media_types, media_thumbnails')
      .eq('id', listingId)
      .single();

    if (listingErr || !listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    if (listing.user_id !== userId) {
      return res.status(403).json({ error: 'Only the listing owner can upload media' });
    }

    const existingCount = (listing.media_urls || []).length;
    if (existingCount + files.length > 10) {
      return res.status(400).json({ error: `Maximum 10 media files per listing. Currently: ${existingCount}` });
    }

    const uploadedUrls = [];
    const uploadedTypes = [];
    const thumbnailUrls = [];

    for (const file of files) {
      const { url, key } = await s3.uploadListingMedia(
        file.buffer,
        file.originalname,
        userId,
        listingId,
        file.mimetype
      );

      uploadedUrls.push(url);
      uploadedTypes.push(s3.categorizeFile(file.mimetype) || 'image');

      // Generate resized variants (non-blocking on failure)
      if (s3.categorizeFile(file.mimetype) === 'image') {
        try {
          const variants = await imageResizeService.processListingImage(file.buffer, key);
          if (variants && variants.thumb) {
            thumbnailUrls.push(variants.thumb);
          }
        } catch (resizeErr) {
          logger.warn('Image resize failed, continuing', { listingId, error: resizeErr.message });
        }
      }
    }

    // Update listing media arrays
    const newMediaUrls = [...(listing.media_urls || []), ...uploadedUrls];
    const newMediaTypes = [...(listing.media_types || []), ...uploadedTypes];

    const updatePayload = {
      media_urls: newMediaUrls,
      media_types: newMediaTypes,
      updated_at: new Date().toISOString(),
    };

    // Update thumbnails if any were generated
    if (thumbnailUrls.length > 0) {
      const existingThumbs = listing.media_thumbnails || [];
      updatePayload.media_thumbnails = [...existingThumbs, ...thumbnailUrls];
    }

    const { error: updateErr } = await supabaseAdmin
      .from('Listing')
      .update(updatePayload)
      .eq('id', listingId);

    if (updateErr) {
      logger.error('Listing media update error', { error: updateErr.message });
      return res.status(500).json({ error: 'Failed to update listing media' });
    }

    logger.info('Listing media uploaded', { listingId, count: uploadedUrls.length, thumbnails: thumbnailUrls.length });

    res.json({
      message: `${uploadedUrls.length} file(s) uploaded successfully`,
      media_urls: newMediaUrls,
      media_types: newMediaTypes,
    });
  } catch (err) {
    logger.error('Listing media upload error', { error: err.message });
    res.status(500).json({ error: err.message || 'Failed to upload listing media' });
  }
});

/**
 * DELETE /api/upload/listing-media/:listingId
 * Remove a media URL from a listing by index
 */
router.delete('/listing-media/:listingId', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { listingId } = req.params;
    const { index } = req.body;

    if (index === undefined || index === null) {
      return res.status(400).json({ error: 'Media index is required' });
    }

    const { data: listing, error: fetchErr } = await supabaseAdmin
      .from('Listing')
      .select('user_id, media_urls, media_types')
      .eq('id', listingId)
      .single();

    if (fetchErr || !listing) return res.status(404).json({ error: 'Listing not found' });
    if (listing.user_id !== userId) return res.status(403).json({ error: 'Not authorized' });

    const urls = [...(listing.media_urls || [])];
    const types = [...(listing.media_types || [])];

    if (index < 0 || index >= urls.length) {
      return res.status(400).json({ error: 'Invalid media index' });
    }

    // Try to extract S3 key from URL and delete
    const urlToDelete = urls[index];
    try {
      const urlObj = new URL(urlToDelete);
      const key = urlObj.pathname.startsWith('/') ? urlObj.pathname.slice(1) : urlObj.pathname;
      if (key) await s3.deleteFromS3(key);
    } catch { /* URL parsing failed, skip S3 delete */ }

    urls.splice(index, 1);
    types.splice(index, 1);

    await supabaseAdmin
      .from('Listing')
      .update({ media_urls: urls, media_types: types, updated_at: new Date().toISOString() })
      .eq('id', listingId);

    res.json({ message: 'Media removed', media_urls: urls, media_types: types });
  } catch (err) {
    logger.error('Listing media delete error', { error: err.message });
    res.status(500).json({ error: 'Failed to delete media' });
  }
});

// ============ MAIL ATTACHMENTS ============

/**
 * POST /api/upload/mail-attachments
 * Upload attachment files and return URLs to include in /api/mailbox/send payload.
 */
router.post('/mail-attachments', uploadLimiter, verifyToken, upload.array('files', 5), enforceFileSizeLimits, validateAndStripUploads, async (req, res) => {
  try {
    const userId = req.user.id;
    const files = req.files || [];

    if (files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    const uploaded = [];
    for (const file of files) {
      const { url, key } = await s3.uploadGeneral(
        file.buffer,
        file.originalname,
        userId,
        `mailbox/${userId}`,
        file.mimetype
      );

      uploaded.push({
        url,
        key,
        name: file.originalname,
        mime_type: file.mimetype,
        size: file.size,
      });
    }

    return res.json({
      message: `${uploaded.length} file(s) uploaded`,
      attachments: uploaded,
    });
  } catch (err) {
    logger.error('Mail attachment upload error', { error: err.message });
    return res.status(500).json({ error: err.message || 'Failed to upload attachments' });
  }
});


// ============ HOME TASK MEDIA ============

/**
 * POST /api/upload/home-task-media/:homeId/:taskId
 * Upload media files for a home task
 */
router.post('/home-task-media/:homeId/:taskId', uploadLimiter, verifyToken, upload.array('files', 10), enforceFileSizeLimits, validateAndStripUploads, async (req, res) => {
  try {
    const userId = req.user.id;
    const { homeId, taskId } = req.params;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    // Verify home membership
    const { data: occ, error: occErr } = await supabaseAdmin
      .from('HomeOccupancy')
      .select('id')
      .eq('home_id', homeId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (occErr || !occ) {
      return res.status(403).json({ error: 'Not a member of this home' });
    }

    // Verify task exists
    const { data: task, error: taskErr } = await supabaseAdmin
      .from('HomeTask')
      .select('id')
      .eq('id', taskId)
      .eq('home_id', homeId)
      .single();

    if (taskErr || !task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const uploadedMedia = [];

    for (const file of files) {
      const { url, key, category } = await s3.uploadHomeTaskMedia(
        file.buffer,
        userId,
        homeId,
        taskId,
        file.originalname,
        file.mimetype
      );

      // Generate thumbnail for images
      let thumbnailUrl = null;
      const thumbBuffer = await generateThumbnail(file.buffer, file.mimetype);
      if (thumbBuffer) {
        const thumbKey = key.replace(/(\.[^.]+)$/, '_thumb.webp');
        const thumbResult = await s3.uploadToS3(thumbBuffer, thumbKey, 'image/webp');
        thumbnailUrl = thumbResult.url;
      }

      const { data: mediaRecord, error: insertErr } = await supabaseAdmin
        .from('HomeTaskMedia')
        .insert({
          task_id: taskId,
          home_id: homeId,
          uploaded_by: userId,
          file_url: url,
          file_key: key,
          file_name: file.originalname,
          file_type: category,
          mime_type: file.mimetype,
          file_size: file.size,
          thumbnail_url: thumbnailUrl,
        })
        .select()
        .single();

      if (insertErr) {
        logger.error('HomeTaskMedia insert error', { error: insertErr.message });
        await s3.deleteFromS3(key);
        continue;
      }

      uploadedMedia.push(mediaRecord);
    }

    logger.info('Home task media uploaded', { homeId, taskId, count: uploadedMedia.length });

    res.json({
      message: `${uploadedMedia.length} file(s) uploaded`,
      media: uploadedMedia,
    });
  } catch (err) {
    logger.error('Home task media upload error', { error: err.message });
    res.status(500).json({ error: err.message || 'Failed to upload' });
  }
});

/**
 * GET /api/upload/home-task-media/:homeId/:taskId
 * Get media for a home task
 */
router.get('/home-task-media/:homeId/:taskId', verifyToken, async (req, res) => {
  try {
    const { homeId, taskId } = req.params;

    const { data, error } = await supabaseAdmin
      .from('HomeTaskMedia')
      .select('*')
      .eq('task_id', taskId)
      .eq('home_id', homeId)
      .order('created_at', { ascending: true });

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch task media' });
    }

    res.json({ media: data || [] });
  } catch (err) {
    logger.error('Home task media fetch error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch task media' });
  }
});


// ============ OWNERSHIP EVIDENCE ============

/**
 * POST /api/upload/ownership-evidence/:homeId/:claimId
 * Upload a document as ownership verification evidence (deed, tax bill, etc.)
 * Stores in S3 and creates/updates HomeVerificationEvidence record.
 */
router.post('/ownership-evidence/:homeId/:claimId', uploadLimiter, verifyToken, upload.single('file'), validateAndStripUploads, async (req, res) => {
  try {
    const userId = req.user.id;
    const { homeId, claimId } = req.params;
    const { evidence_type } = req.body;
    const file = req.file;

    if (!file) return res.status(400).json({ error: 'No file provided' });

    // Only images and documents (PDF, etc.) are allowed for evidence
    if (!file.mimetype.startsWith('image/') && !s3.ALLOWED_DOC_TYPES.includes(file.mimetype)) {
      return res.status(400).json({ error: 'Only images or documents (PDF, DOCX, etc.) are allowed as evidence' });
    }

    // File size cap: 25 MB for docs, 10 MB for images
    const maxSize = file.mimetype.startsWith('image/') ? s3.MAX_FILE_SIZES.image : s3.MAX_FILE_SIZES.document;
    if (file.size > maxSize) {
      return res.status(400).json({ error: `File too large. Max ${Math.round(maxSize / 1024 / 1024)} MB.` });
    }

    const validEvidenceTypes = ['deed', 'closing_disclosure', 'tax_bill', 'utility_bill', 'lease', 'escrow_attestation', 'title_match', 'idv'];
    if (evidence_type && !validEvidenceTypes.includes(evidence_type)) {
      return res.status(400).json({ error: `Invalid evidence_type. Must be one of: ${validEvidenceTypes.join(', ')}` });
    }

    // Verify user has a pending claim for this home
    const { data: claim, error: claimErr } = await supabaseAdmin
      .from('HomeOwnershipClaim')
      .select('id, claimant_user_id, state, claim_phase_v2')
      .eq('id', claimId)
      .eq('home_id', homeId)
      .single();

    if (claimErr || !claim) {
      return res.status(404).json({ error: 'Ownership claim not found' });
    }
    if (claim.claimant_user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to upload evidence for this claim' });
    }
    const uploadableClaimStates = ['submitted', 'pending_review', 'draft', 'needs_more_info', 'rejected'];
    const uploadableClaimPhases = ['initiated', 'evidence_submitted', 'under_review', 'challenged'];
    const canUploadEvidence =
      uploadableClaimStates.includes(claim.state) ||
      uploadableClaimPhases.includes(claim.claim_phase_v2);

    if (!canUploadEvidence) {
      return res.status(400).json({ error: 'Evidence can only be uploaded for active claims' });
    }

    // BUG 1C: Content hash for integrity verification and deduplication
    const crypto = require('crypto');
    const contentHash = crypto.createHash('sha256').update(file.buffer).digest('hex');

    // BUG 1C: Validate MIME type matches file content (magic bytes)
    const magicBytes = file.buffer.subarray(0, 8);
    const hex = magicBytes.toString('hex').toLowerCase();
    const declaredMime = file.mimetype;

    const MAGIC_SIGNATURES = {
      '25504446':       'application/pdf',        // %PDF
      'ffd8ff':         'image/jpeg',              // JPEG
      '89504e47':       'image/png',               // PNG
      '47494638':       'image/gif',               // GIF
      '504b0304':       'application/zip',         // ZIP/DOCX/XLSX
    };

    let detectedMime = null;
    for (const [sig, mime] of Object.entries(MAGIC_SIGNATURES)) {
      if (hex.startsWith(sig)) { detectedMime = mime; break; }
    }

    // ZIP-based formats (DOCX, XLSX) declare specific MIME types but have ZIP magic bytes
    const zipMimes = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    if (detectedMime === 'application/zip' && zipMimes.includes(declaredMime)) {
      detectedMime = declaredMime; // Allow ZIP-based Office formats
    }

    if (detectedMime && detectedMime !== declaredMime) {
      logger.warn('MIME type mismatch detected', {
        homeId, claimId, declared: declaredMime, detected: detectedMime, fileName: file.originalname,
      });
      return res.status(400).json({
        error: 'File content does not match the declared file type. Please upload a valid document.',
      });
    }

    // BUG 1C: Check for duplicate evidence (same content hash on same claim)
    const { data: duplicateEvidence } = await supabaseAdmin
      .from('HomeVerificationEvidence')
      .select('id')
      .eq('claim_id', claimId)
      .contains('metadata', { content_hash: contentHash })
      .maybeSingle();

    if (duplicateEvidence) {
      return res.status(409).json({ error: 'This document has already been uploaded for this claim.' });
    }

    // Upload to S3
    const { url, key } = await s3.uploadGeneral(
      file.buffer,
      file.originalname,
      userId,
      `ownership-evidence/${homeId}/${claimId}`,
      file.mimetype
    );

    // Create HomeVerificationEvidence record (status must be pending | verified | failed per DB constraint)
    const { data: evidence, error: evidenceErr } = await supabaseAdmin
      .from('HomeVerificationEvidence')
      .insert({
        claim_id: claimId,
        evidence_type: evidence_type || 'deed',
        provider: 'manual',
        status: 'pending',
        storage_ref: key,
        metadata: {
          file_url: url,
          file_name: file.originalname,
          file_size: file.size,
          mime_type: file.mimetype,
          content_hash: contentHash,
        },
      })
      .select('id, evidence_type, status, created_at')
      .single();

    if (evidenceErr) {
      // Rollback S3 upload
      await s3.deleteFromS3(key);
      logger.error('HomeVerificationEvidence insert error', { error: evidenceErr.message });
      return res.status(500).json({ error: 'Failed to save evidence record' });
    }

    logger.info('Ownership evidence uploaded', {
      homeId,
      claimId,
      evidenceId: evidence.id,
      bucket: S3_BUCKET,
      key,
      hint: `In S3 console, open bucket "${S3_BUCKET}" and look for prefix "ownership-evidence/"`,
    });

    res.json({
      message: 'Evidence uploaded successfully',
      evidence: {
        id: evidence.id,
        evidence_type: evidence.evidence_type,
        status: evidence.status,
        file_url: url,
        file_name: file.originalname,
      },
    });
  } catch (err) {
    logger.error('Ownership evidence upload error', { error: err.message });
    res.status(500).json({ error: err.message || 'Failed to upload evidence' });
  }
});


// ============ GENERIC DELETE ============

/**
 * DELETE /api/upload/file
 * Delete any uploaded file by S3 key (requires ownership check)
 */
router.delete('/file', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { key, table, recordId } = req.body;
    if (!key) return res.status(400).json({ error: 'S3 key is required' });

    // Ownership check: S3 keys are generated with the userId in the path.
    // Verify the key contains the authenticated user's ID to prevent deleting
    // other users' files.
    if (!key.includes(`/${userId}/`)) {
      return res.status(403).json({ error: 'Not authorized to delete this file' });
    }

    await s3.deleteFromS3(key);

    // If a table + recordId is provided, also delete the DB record
    // Only allow deletion from known media/file tables to prevent arbitrary data deletion
    const ALLOWED_TABLES = ['GigMedia', 'ListingMedia', 'ReviewMedia', 'PostMedia', 'ChatAttachment'];
    if (table && recordId) {
      if (!ALLOWED_TABLES.includes(table)) {
        return res.status(400).json({ error: `Table '${table}' is not allowed for file deletion` });
      }
      await supabaseAdmin.from(table).delete().eq('id', recordId);
    }

    res.json({ message: 'File deleted' });
  } catch (err) {
    logger.error('File delete error', { error: err.message });
    res.status(500).json({ error: 'Failed to delete file' });
  }
});


// ============ REVIEW MEDIA UPLOAD ============

/**
 * POST /api/upload/review-media/:reviewId
 * Upload photos/files to attach to a review.
 * Only the review author can upload. Max 5 files.
 */
router.post('/review-media/:reviewId', uploadLimiter, verifyToken, upload.array('files', 5), enforceFileSizeLimits, validateAndStripUploads, async (req, res) => {
  try {
    const userId = req.user.id;
    const { reviewId } = req.params;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    // Verify the review exists and belongs to the user
    const { data: review, error: reviewErr } = await supabaseAdmin
      .from('Review')
      .select('id, reviewer_id, media_urls')
      .eq('id', reviewId)
      .single();

    if (reviewErr || !review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    if (String(review.reviewer_id) !== String(userId)) {
      return res.status(403).json({ error: 'Only the review author can upload media' });
    }

    const uploadedUrls = [];

    for (const file of files) {
      const category = s3.categorizeFile(file.mimetype);
      if (category !== 'image' && category !== 'document') {
        continue; // Skip unsupported types silently
      }

      const { url } = await s3.uploadGeneral(
        file.buffer,
        file.originalname,
        userId,
        `reviews/${reviewId}`,
        file.mimetype
      );

      uploadedUrls.push(url);
    }

    if (uploadedUrls.length === 0) {
      return res.status(400).json({ error: 'No valid files were uploaded' });
    }

    // Append to existing media_urls
    const existingUrls = review.media_urls || [];
    const newMediaUrls = [...existingUrls, ...uploadedUrls];

    const { error: updateErr } = await supabaseAdmin
      .from('Review')
      .update({
        media_urls: newMediaUrls,
        updated_at: new Date().toISOString(),
      })
      .eq('id', reviewId);

    if (updateErr) {
      logger.error('Review media update error', { error: updateErr.message, reviewId });
      return res.status(500).json({ error: 'Failed to update review with media' });
    }

    logger.info('Review media uploaded', {
      reviewId,
      userId,
      count: uploadedUrls.length,
    });

    return res.json({
      message: `${uploadedUrls.length} file(s) uploaded successfully`,
      media_urls: newMediaUrls,
    });
  } catch (err) {
    logger.error('Review media upload error', { error: err.message });
    res.status(500).json({ error: err.message || 'Failed to upload review media' });
  }
});

// ============ BUSINESS MEDIA (logo / banner) ============

const {
  checkBusinessPermission,
} = require('../utils/businessPermissions');

/**
 * POST /api/upload/business-media/:businessId
 * Upload logo or banner for a business profile.
 * Query param: type = "logo" | "banner"
 */
router.post('/business-media/:businessId', uploadLimiter, verifyToken, upload.single('file'), enforceFileSizeLimits, validateAndStripUploads, async (req, res) => {
  try {
    const userId = req.user.id;
    const { businessId } = req.params;
    const mediaType = req.query.type || req.body.type; // "logo" or "banner"

    if (!['logo', 'banner'].includes(mediaType)) {
      return res.status(400).json({ error: 'type must be "logo" or "banner"' });
    }

    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file provided' });

    if (!file.mimetype.startsWith('image/')) {
      return res.status(400).json({ error: 'Business media must be an image' });
    }

    // Permission check
    const access = await checkBusinessPermission(businessId, userId, 'profile.edit');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'You do not have permission to edit this business profile' });
    }

    // Process image
    let processedBuffer = file.buffer;
    let finalMimeType = file.mimetype;
    if (sharp) {
      try {
        if (mediaType === 'logo') {
          processedBuffer = await sharp(file.buffer)
            .resize(800, 800, { fit: 'cover' })
            .webp({ quality: 85 })
            .toBuffer();
        } else {
          // Banner: 16:9 aspect, max 1600px wide
          processedBuffer = await sharp(file.buffer)
            .resize(1600, 900, { fit: 'cover' })
            .webp({ quality: 85 })
            .toBuffer();
        }
        finalMimeType = 'image/webp';
      } catch {
        processedBuffer = file.buffer;
      }
    }

    // Upload to S3
    const folder = `business-media/${businessId}`;
    const ext = finalMimeType === 'image/webp' ? 'webp' : file.originalname.split('.').pop();
    const key = `${folder}/${mediaType}-${Date.now()}-${require('crypto').randomBytes(4).toString('hex')}.${ext}`;
    const { url } = await s3.uploadToS3(processedBuffer, key, finalMimeType);

    // Create a File record so we have a UUID for the foreign key
    const { data: fileRecord, error: fileErr } = await supabaseAdmin
      .from('File')
      .insert({
        user_id: userId,
        filename: key.split('/').pop(),
        original_filename: file.originalname,
        file_path: key,
        file_url: url,
        file_size: processedBuffer.length,
        mime_type: finalMimeType,
        file_extension: ext,
        file_type: 'other',
        visibility: 'public',
        processing_status: 'completed',
      })
      .select('id')
      .single();

    if (fileErr) {
      await s3.deleteFromS3(key);
      logger.error('Failed to create File record for business media', { error: fileErr.message });
      return res.status(500).json({ error: `Failed to update ${mediaType}` });
    }

    // Update BusinessProfile with the File UUID
    const updateField = mediaType === 'logo' ? 'logo_file_id' : 'banner_file_id';
    const { error: updateErr } = await supabaseAdmin
      .from('BusinessProfile')
      .update({
        [updateField]: fileRecord.id,
        updated_at: new Date().toISOString(),
      })
      .eq('business_user_id', businessId);

    if (updateErr) {
      await supabaseAdmin.from('File').delete().eq('id', fileRecord.id);
      await s3.deleteFromS3(key);
      return res.status(500).json({ error: `Failed to update ${mediaType}` });
    }

    // Also update the corresponding User column so the frontend can display it
    if (mediaType === 'logo') {
      await supabaseAdmin
        .from('User')
        .update({
          profile_picture_url: url,
          updated_at: new Date().toISOString(),
        })
        .eq('id', businessId);
    } else if (mediaType === 'banner') {
      await supabaseAdmin
        .from('User')
        .update({
          cover_photo_url: url,
          updated_at: new Date().toISOString(),
        })
        .eq('id', businessId);
    }

    // Recalculate completeness (logo/banner affect the score)
    calculateAndStoreCompleteness(businessId).catch((err) => {
      logger.error('Post-media-upload completeness calculation failed', { businessId, error: err.message });
    });

    logger.info('Business media uploaded', { businessId, mediaType, key });

    res.json({
      message: `${mediaType} uploaded successfully`,
      url,
      key,
    });
  } catch (err) {
    logger.error('Business media upload error', { error: err.message });
    res.status(500).json({ error: err.message || 'Failed to upload business media' });
  }
});

// ============ AI CHAT MEDIA ============

/**
 * POST /api/upload/ai-media
 * Upload images for AI assistant chat (up to 5 images).
 * Returns public URLs to pass to the AI chat endpoint.
 */
router.post('/ai-media', uploadLimiter, verifyToken, upload.array('files', 5), enforceFileSizeLimits, validateAndStripUploads, async (req, res) => {
  try {
    const userId = req.user.id;
    const files = req.files || [];

    if (files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    // Only allow images for AI vision
    const nonImages = files.filter((f) => !f.mimetype.startsWith('image/'));
    if (nonImages.length > 0) {
      return res.status(400).json({ error: 'Only image files are allowed for AI chat' });
    }

    const uploaded = [];
    for (const file of files) {
      const { url, key } = await s3.uploadGeneral(
        file.buffer,
        file.originalname,
        userId,
        `ai-chat/${userId}`,
        file.mimetype
      );

      uploaded.push({
        url,
        key,
        name: file.originalname,
        mime_type: file.mimetype,
        size: file.size,
      });
    }

    return res.json({
      message: `${uploaded.length} image(s) uploaded`,
      images: uploaded,
    });
  } catch (err) {
    logger.error('AI media upload error', { error: err.message });
    return res.status(500).json({ error: err.message || 'Failed to upload images' });
  }
});

// ============ LIVE PHOTO (STILL + VIDEO PAIR) ============

const LIVE_PHOTO_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/heic', 'image/heif']);
const LIVE_PHOTO_VIDEO_TYPES = new Set(['video/quicktime', 'video/mp4']);
const LIVE_PHOTO_IMAGE_MAX = 10 * 1024 * 1024;  // 10 MB
const LIVE_PHOTO_VIDEO_MAX = 15 * 1024 * 1024;  // 15 MB

/**
 * POST /api/upload/live-photo
 *
 * Accepts two files:
 *   - "image" (JPEG/HEIC/PNG, ≤ 10 MB) — the still frame
 *   - "video" (MOV/MP4, ≤ 15 MB)       — the companion Live Photo clip
 *
 * Uploads both to S3 with linked keys:
 *   posts/{userId}/{ts}_{rand}.jpg
 *   posts/{userId}/{ts}_{rand}_live.{ext}
 *
 * Runs the existing thumbnail pipeline on the still image.
 *
 * Returns { imageUrl, liveVideoUrl, thumbnailUrl }
 */
router.post(
  '/live-photo',
  uploadLimiter,
  verifyToken,
  upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'video', maxCount: 1 },
  ]),
  // Note: enforceFileSizeLimits and validateAndStripUploads expect req.files
  // to be an array, but upload.fields() returns an object. This endpoint does
  // its own type + size validation below, so we skip those middlewares.
  async (req, res) => {
    try {
      const userId = req.user.id;

      const imageFile = req.files?.image?.[0];
      const videoFile = req.files?.video?.[0];

      if (!imageFile || !videoFile) {
        return res.status(400).json({ error: 'Both "image" and "video" files are required' });
      }

      // ── Type validation ──
      if (!LIVE_PHOTO_IMAGE_TYPES.has(imageFile.mimetype)) {
        return res.status(400).json({
          error: `Still image must be JPEG, PNG, or HEIC (got ${imageFile.mimetype})`,
        });
      }
      if (!LIVE_PHOTO_VIDEO_TYPES.has(videoFile.mimetype)) {
        return res.status(400).json({
          error: `Live Photo video must be MOV or MP4 (got ${videoFile.mimetype})`,
        });
      }

      // ── Size validation ──
      if (imageFile.size > LIVE_PHOTO_IMAGE_MAX) {
        return res.status(413).json({
          error: `Still image exceeds 10 MB limit (${Math.round(imageFile.size / 1024 / 1024)} MB)`,
        });
      }
      if (videoFile.size > LIVE_PHOTO_VIDEO_MAX) {
        return res.status(413).json({
          error: `Live Photo video exceeds 15 MB limit (${Math.round(videoFile.size / 1024 / 1024)} MB)`,
        });
      }

      // ── Generate linked S3 keys ──
      // Use a shared base so the two files are visually linked in S3.
      const crypto = require('crypto');
      const ts = Date.now();
      const rand = crypto.randomBytes(8).toString('hex');
      const base = `posts/${userId}/${ts}_${rand}`;

      const imageExt = imageFile.mimetype === 'image/png' ? '.png' : '.jpg';
      const videoExt = videoFile.mimetype === 'video/mp4' ? '.mp4' : '.mov';

      const imageKey = `${base}${imageExt}`;
      const videoKey = `${base}_live${videoExt}`;

      // ── Upload both to S3 in parallel ──
      const [imageResult, videoResult] = await Promise.all([
        s3.uploadToS3(imageFile.buffer, imageKey, imageFile.mimetype),
        s3.uploadToS3(videoFile.buffer, videoKey, videoFile.mimetype),
      ]);

      // ── Thumbnail generation (non-blocking — best-effort) ──
      let thumbnailUrl = null;
      const thumbBuffer = await generateThumbnail(imageFile.buffer, imageFile.mimetype);
      if (thumbBuffer) {
        try {
          const thumbKey = `${base}_thumb.webp`;
          const thumbResult = await s3.uploadToS3(thumbBuffer, thumbKey, 'image/webp');
          thumbnailUrl = thumbResult.url;
        } catch (thumbErr) {
          logger.warn('Live photo thumbnail upload failed (non-blocking)', { error: thumbErr.message });
        }
      }

      logger.info('Live Photo pair uploaded', {
        userId,
        imageKey,
        videoKey,
        imageSize: imageFile.size,
        videoSize: videoFile.size,
      });

      res.json({
        imageUrl: imageResult.url,
        liveVideoUrl: videoResult.url,
        thumbnailUrl,
      });
    } catch (err) {
      logger.error('Live photo upload error', { error: err.message, userId: req.user?.id });
      res.status(500).json({ error: err.message || 'Failed to upload Live Photo' });
    }
  }
);

module.exports = router;
// P2.12 — exported for direct unit testing of the EXIF strip pipeline.
// The middleware (validateAndStripUploads) wraps stripImageMetadata
// for every multipart upload so the same code path runs in production.
module.exports.stripImageMetadata = stripImageMetadata;
