const express = require('express');
const router = express.Router();
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const supabase = require('../config/supabase');
const supabaseAdmin = require('../config/supabaseAdmin');
const verifyToken = require('../middleware/verifyToken');
const validate = require('../middleware/validate');
const Joi = require('joi');
const logger = require('../utils/logger');
const { checkHomePermission } = require('../utils/homePermissions');
const s3 = require('../services/s3Service');

// Try to load sharp for image processing
let sharp;
try {
  sharp = require('sharp');
} catch (err) {
  logger.warn('Sharp not installed - image processing disabled');
}

// ============ CONFIGURATION ============

const FILE_TYPES = {
  IMAGE: {
    mimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif'],
    extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif'],
    maxSize: 10 * 1024 * 1024, // 10MB
    bucket: 'public'
  },
  VIDEO: {
    mimeTypes: ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'],
    extensions: ['.mp4', '.mov', '.avi', '.webm'],
    maxSize: 100 * 1024 * 1024, // 100MB
    bucket: 'public'
  },
  DOCUMENT: {
    mimeTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'],
    extensions: ['.pdf', '.doc', '.docx', '.txt'],
    maxSize: 25 * 1024 * 1024, // 25MB
    bucket: 'private'
  },
  AUDIO: {
    mimeTypes: ['audio/webm', 'audio/mp4', 'audio/x-m4a', 'audio/m4a', 'audio/wav', 'audio/mpeg', 'audio/aac'],
    extensions: ['.webm', '.m4a', '.mp4', '.wav', '.mp3', '.aac'],
    maxSize: 5 * 1024 * 1024, // 5MB
    bucket: 'private'
  }
};

const THUMBNAIL_SIZES = {
  small: { width: 150, height: 150 },
  medium: { width: 400, height: 400 },
  large: { width: 800, height: 800 }
};

// ============ VALIDATION SCHEMAS ============

const uploadProfilePictureSchema = Joi.object({
  description: Joi.string().max(500).optional()
});

const uploadPortfolioSchema = Joi.object({
  category: Joi.string().max(100).optional(), // e.g., 'plumbing', 'photography', 'cooking'
  title: Joi.string().max(255).optional(),
  description: Joi.string().max(1000).optional(),
  tags: Joi.array().items(Joi.string()).optional(),
  displayOrder: Joi.number().integer().min(0).optional()
});

const uploadHomeFileSchema = Joi.object({
  fileType: Joi.string().valid('home_photo', 'home_video', 'home_document').required(),
  visibility: Joi.string().valid('public', 'private').default('public'),
  title: Joi.string().max(255).optional(),
  description: Joi.string().max(1000).optional(),
  category: Joi.string().max(100).optional() // e.g., 'wifi_info', 'house_rules', 'maintenance_receipt'
});

// ============ MULTER CONFIGURATION ============

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = file.mimetype.toLowerCase();
  
  let isAllowed = false;
  for (const [category, config] of Object.entries(FILE_TYPES)) {
    if (config.mimeTypes.includes(mime) && config.extensions.includes(ext)) {
      isAllowed = true;
      req.fileCategory = category;
      break;
    }
  }
  
  if (!isAllowed) {
    return cb(new Error(`File type not allowed: ${mime} (${ext})`), false);
  }
  
  cb(null, true);
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max
    files: 10
  }
});

// ============ HELPER FUNCTIONS ============

const generateFilename = (originalFilename, userId) => {
  const ext = path.extname(originalFilename).toLowerCase();
  const timestamp = Date.now();
  const random = crypto.randomBytes(8).toString('hex');
  return `${userId}_${timestamp}_${random}${ext}`;
};

const getFileCategory = (mimeType) => {
  if (mimeType.startsWith('image/')) return 'IMAGE';
  if (mimeType.startsWith('video/')) return 'VIDEO';
  if (mimeType === 'application/pdf' || mimeType.includes('document') || mimeType === 'text/plain') return 'DOCUMENT';
  if (mimeType.startsWith('audio/')) return 'AUDIO';
  return null;
};

const validateFileSize = (fileSize, category) => {
  const config = FILE_TYPES[category];
  if (!config) return { valid: false, error: 'Unknown file category' };
  
  if (fileSize > config.maxSize) {
    return {
      valid: false,
      error: `File size (${(fileSize / 1024 / 1024).toFixed(2)}MB) exceeds limit (${(config.maxSize / 1024 / 1024).toFixed(2)}MB)`
    };
  }
  
  return { valid: true };
};

const checkStorageQuota = async (userId, fileSize) => {
  const { data, error } = await supabaseAdmin.rpc('can_upload_file', {
    p_user_id: userId,
    p_file_size: fileSize
  });
  
  if (error) {
    logger.error('Error checking quota', { error: error.message, userId });
    throw new Error('Failed to check storage quota');
  }
  
  if (!data.canUpload) {
    throw new Error(data.reason || 'Storage quota exceeded');
  }
  
  return data;
};

const uploadToSupabase = async (buffer, filePath, bucketName, contentType) => {
  const { data, error } = await supabaseAdmin.storage
    .from(bucketName)
    .upload(filePath, buffer, {
      contentType: contentType,
      upsert: false
    });
  
  if (error) {
    logger.error('Supabase upload error', { error: error.message, filePath, bucketName });
    throw new Error(`Upload failed: ${error.message}`);
  }
  
  return data;
};

const getPublicUrl = (bucketName, filePath) => {
  const { data } = supabaseAdmin.storage
    .from(bucketName)
    .getPublicUrl(filePath);
  
  return data.publicUrl;
};

const getSignedUrl = async (bucketName, filePath, expiresIn = 3600) => {
  const { data, error } = await supabaseAdmin.storage
    .from(bucketName)
    .createSignedUrl(filePath, expiresIn);
  
  if (error) {
    throw new Error(`Failed to create signed URL: ${error.message}`);
  }
  
  return data.signedUrl;
};

const processImage = async (buffer, filename) => {
  if (!sharp) {
    return { processed: buffer, thumbnails: {}, metadata: null };
  }
  
  try {
    const metadata = await sharp(buffer).metadata();
    
    const processed = await sharp(buffer)
      .resize(4096, 4096, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
    
    const thumbnails = {};
    for (const [sizeName, dimensions] of Object.entries(THUMBNAIL_SIZES)) {
      thumbnails[sizeName] = await sharp(buffer)
        .resize(dimensions.width, dimensions.height, { fit: 'cover' })
        .webp({ quality: 80 })
        .toBuffer();
    }
    
    return {
      processed,
      thumbnails,
      metadata: {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format
      }
    };
  } catch (err) {
    logger.error('Image processing error', { error: err.message, filename });
    return { processed: buffer, thumbnails: {}, metadata: null };
  }
};

const deleteFromSupabase = async (bucketName, filePath) => {
  const { error } = await supabaseAdmin.storage
    .from(bucketName)
    .remove([filePath]);
  
  if (error) {
    logger.error('Supabase delete error', { error: error.message, filePath, bucketName });
    throw new Error(`Delete failed: ${error.message}`);
  }
};

// ============ USER PROFILE PICTURE ROUTES ============

/**
 * POST /api/files/profile-picture
 * Upload user profile picture
 */
router.post('/profile-picture', verifyToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }
    
    const userId = req.user.id;
    const file = req.file;
    
    // Must be an image
    const category = getFileCategory(file.mimetype);
    if (category !== 'IMAGE') {
      return res.status(415).json({ error: 'Profile picture must be an image' });
    }
    
    const sizeValidation = validateFileSize(file.size, category);
    if (!sizeValidation.valid) {
      return res.status(413).json({ error: sizeValidation.error });
    }
    
    await checkStorageQuota(userId, file.size);
    
    const filename = generateFilename(file.originalname, userId);
    const ext = path.extname(file.originalname).toLowerCase();
    const folderPath = `profiles/${userId}`;
    const filePath = `${folderPath}/${filename}`;
    
    // Process image
    const { processed, thumbnails, metadata } = await processImage(file.buffer, filename);
    
    // Upload main image
    await uploadToSupabase(processed, filePath, 'public', file.mimetype);
    
    const fileUrl = getPublicUrl('public', filePath);
    
    // Upload thumbnails
    const thumbnailUrls = {};
    for (const [sizeName, thumbBuffer] of Object.entries(thumbnails)) {
      const thumbFilename = `thumb_${sizeName}_${filename.replace(ext, '.webp')}`;
      const thumbPath = `${folderPath}/thumbnails/${thumbFilename}`;
      
      try {
        await uploadToSupabase(thumbBuffer, thumbPath, 'public', 'image/webp');
        thumbnailUrls[sizeName] = getPublicUrl('public', thumbPath);
      } catch (err) {
        logger.warn('Thumbnail upload failed', { error: err.message, sizeName });
      }
    }
    
    // Save to database
    const { data: savedFile, error: dbError } = await supabaseAdmin
      .from('File')
      .insert({
        user_id: userId,
        filename: filename,
        original_filename: file.originalname,
        file_path: filePath,
        file_url: fileUrl,
        file_size: processed.length,
        mime_type: file.mimetype,
        file_extension: ext,
        file_type: 'profile_picture',
        visibility: 'public',
        metadata: {
          width: metadata?.width,
          height: metadata?.height,
          thumbnails: thumbnailUrls
        },
        processing_status: 'completed'
      })
      .select()
      .single();
    
    if (dbError) {
      await deleteFromSupabase('public', filePath);
      logger.error('Database insert error', { error: dbError.message, userId });
      return res.status(500).json({ error: 'Failed to save file record' });
    }
    
    // Update user's profile_picture_url (assuming you add this column to User table)
    await supabaseAdmin
      .from('User')
      .update({ 
        profile_picture_url: fileUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);
    
    logger.info('Profile picture uploaded', { fileId: savedFile.id, userId });
    
    res.status(201).json({
      message: 'Profile picture uploaded successfully',
      file: {
        id: savedFile.id,
        url: fileUrl,
        thumbnails: thumbnailUrls,
        width: metadata?.width,
        height: metadata?.height
      }
    });
    
  } catch (err) {
    logger.error('Profile picture upload error', { error: err.message });
    res.status(500).json({ error: 'Failed to upload profile picture', message: err.message });
  }
});

/**
 * POST /api/files/portfolio
 * Upload portfolio/skills showcase file
 */
router.post('/portfolio', verifyToken, upload.single('file'), validate(uploadPortfolioSchema), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }
    
    const { category, title, description, tags, displayOrder } = req.body;
    const userId = req.user.id;
    const file = req.file;
    
    const fileCategory = getFileCategory(file.mimetype);
    if (!fileCategory) {
      return res.status(415).json({ error: 'Unsupported file type' });
    }
    
    const sizeValidation = validateFileSize(file.size, fileCategory);
    if (!sizeValidation.valid) {
      return res.status(413).json({ error: sizeValidation.error });
    }
    
    await checkStorageQuota(userId, file.size);

    const ext = path.extname(file.originalname).toLowerCase();

    let processedBuffer = file.buffer;
    let imageMetadata = null;
    let thumbnailUrls = {};

    // Process if image
    if (fileCategory === 'IMAGE') {
      const { processed, thumbnails, metadata } = await processImage(file.buffer, file.originalname);
      processedBuffer = processed;
      imageMetadata = metadata;

      // Upload thumbnails to S3
      for (const [sizeName, thumbBuffer] of Object.entries(thumbnails)) {
        try {
          const thumbResult = await s3.uploadToS3(
            thumbBuffer,
            s3.generateS3Key(`portfolio/thumbnails/${sizeName}`, file.originalname.replace(ext, '.webp'), userId),
            'image/webp'
          );
          thumbnailUrls[sizeName] = thumbResult.url;
        } catch (err) {
          logger.warn('Thumbnail upload failed', { error: err.message });
        }
      }
    }

    // Determine file type based on category and mime type
    let fileType = 'portfolio_image';
    if (fileCategory === 'VIDEO') fileType = 'portfolio_video';
    if (fileCategory === 'DOCUMENT') fileType = 'portfolio_document';
    if (file.originalname.toLowerCase().includes('resume') || file.originalname.toLowerCase().includes('cv')) {
      fileType = 'resume';
    }
    if (file.originalname.toLowerCase().includes('cert')) {
      fileType = 'certification';
    }

    // Upload to S3
    const { url: fileUrl, key: s3Key } = await s3.uploadToS3(
      processedBuffer,
      s3.generateS3Key('portfolio', file.originalname, userId),
      file.mimetype
    );

    const visibility = fileCategory === 'DOCUMENT' ? 'private' : 'public';

    // Save to database
    const { data: savedFile, error: dbError } = await supabaseAdmin
      .from('File')
      .insert({
        user_id: userId,
        filename: path.basename(s3Key),
        original_filename: file.originalname,
        file_path: s3Key,
        file_url: fileUrl,
        file_size: processedBuffer.length,
        mime_type: file.mimetype,
        file_extension: ext,
        file_type: fileType,
        file_context: category || null,
        visibility: visibility,
        display_order: displayOrder || 0,
        metadata: {
          title: title || null,
          description: description || null,
          tags: tags || [],
          width: imageMetadata?.width,
          height: imageMetadata?.height,
          thumbnails: thumbnailUrls
        },
        processing_status: 'completed'
      })
      .select()
      .single();

    if (dbError) {
      await s3.deleteFromS3(s3Key);
      logger.error('Database insert error', { error: dbError.message, userId });
      return res.status(500).json({ error: 'Failed to save file record' });
    }

    logger.info('Portfolio file uploaded', { fileId: savedFile.id, userId, fileType });

    res.status(201).json({
      message: 'Portfolio file uploaded successfully',
      file: {
        id: savedFile.id,
        url: fileUrl,
        type: fileType,
        thumbnails: thumbnailUrls,
        metadata: savedFile.metadata
      }
    });
    
  } catch (err) {
    logger.error('Portfolio upload error', { error: err.message });
    res.status(500).json({ error: 'Failed to upload portfolio file', message: err.message });
  }
});

/**
 * GET /api/files/portfolio
 * Get current user's portfolio files
 */
router.get('/portfolio', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { category } = req.query;
    
    let query = supabaseAdmin
      .from('File')
      .select('*')
      .eq('user_id', userId)
      .in('file_type', ['portfolio_image', 'portfolio_video', 'portfolio_document', 'resume', 'certification'])
      .eq('is_deleted', false)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (category) {
      query = query.eq('file_context', category);
    }

    const { data: files, error } = await query;
    
    if (error) {
      logger.error('Error fetching portfolio', { error: error.message, userId });
      return res.status(500).json({ error: 'Failed to fetch portfolio files' });
    }
    
    res.json({ files: files || [] });
    
  } catch (err) {
    logger.error('Portfolio fetch error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch portfolio' });
  }
});

/**
 * GET /api/files/portfolio/:userId
 * Get another user's public portfolio files
 */
router.get('/portfolio/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const { data: files, error } = await supabaseAdmin
      .from('File')
      .select('*')
      .eq('user_id', userId)
      .in('file_type', ['portfolio_image', 'portfolio_video', 'portfolio_document', 'resume', 'certification'])
      .eq('visibility', 'public')
      .eq('is_deleted', false)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false });
    
    if (error) {
      logger.error('Error fetching user portfolio', { error: error.message, userId });
      return res.status(500).json({ error: 'Failed to fetch portfolio' });
    }
    
    res.json({ files: files || [] });
    
  } catch (err) {
    logger.error('Portfolio fetch error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch portfolio' });
  }
});

// ============ HOME FILE ROUTES ============

/**
 * POST /api/files/home/:homeId
 * Upload file to home profile
 */
router.post('/home/:homeId', verifyToken, upload.single('file'), validate(uploadHomeFileSchema), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }
    
    const { homeId } = req.params;
    const { fileType, visibility, title, description, category } = req.body;
    const userId = req.user.id;
    const file = req.file;
    
    // Check if user has access to this home
    const { data: home, error: homeError } = await supabase
      .from('Home')
      .select(`
        owner_id,
        occupants:HomeOccupancy!home_id(user_id)
      `)
      .eq('id', homeId)
      .single();

    if (homeError || !home) {
      return res.status(404).json({ error: 'Home not found' });
    }

    const fileUploadAccess = await checkHomePermission(homeId, userId, 'docs.upload');
    const isOwner = fileUploadAccess.isOwner;
    const isOccupant = home.occupants.some(occ => occ.user_id === userId);

    if (!isOwner && !isOccupant) {
      return res.status(403).json({ error: 'You do not have access to this home' });
    }

    // Only owner can upload to home profile
    if (!isOwner && (fileType === 'home_photo' || visibility === 'public')) {
      return res.status(403).json({ error: 'Only home owner can upload public files' });
    }
    
    const fileCategory = getFileCategory(file.mimetype);
    if (!fileCategory) {
      return res.status(415).json({ error: 'Unsupported file type' });
    }
    
    const sizeValidation = validateFileSize(file.size, fileCategory);
    if (!sizeValidation.valid) {
      return res.status(413).json({ error: sizeValidation.error });
    }
    
    await checkStorageQuota(userId, file.size);
    
    const filename = generateFilename(file.originalname, userId);
    const ext = path.extname(file.originalname).toLowerCase();
    const folderPath = `homes/${homeId}/${visibility}`;
    const filePath = `${folderPath}/${filename}`;
    
    let processedBuffer = file.buffer;
    let imageMetadata = null;
    let thumbnailUrls = {};
    
    if (fileCategory === 'IMAGE') {
      const { processed, thumbnails, metadata } = await processImage(file.buffer, filename);
      processedBuffer = processed;
      imageMetadata = metadata;
      
      for (const [sizeName, thumbBuffer] of Object.entries(thumbnails)) {
        const thumbFilename = `thumb_${sizeName}_${filename.replace(ext, '.webp')}`;
        const thumbPath = `${folderPath}/thumbnails/${thumbFilename}`;
        
        try {
          const bucketName = visibility === 'public' ? 'public' : 'private';
          await uploadToSupabase(thumbBuffer, thumbPath, bucketName, 'image/webp');
          thumbnailUrls[sizeName] = getPublicUrl(bucketName, thumbPath);
        } catch (err) {
          logger.warn('Thumbnail upload failed', { error: err.message });
        }
      }
    }
    
    const bucketName = visibility === 'public' ? 'public' : 'private';
    await uploadToSupabase(processedBuffer, filePath, bucketName, file.mimetype);
    
    let fileUrl;
    if (bucketName === 'private') {
      fileUrl = await getSignedUrl(bucketName, filePath, 3600 * 24 * 7);
    } else {
      fileUrl = getPublicUrl(bucketName, filePath);
    }
    
    const { data: savedFile, error: dbError } = await supabaseAdmin
      .from('File')
      .insert({
        user_id: userId,
        home_id: homeId,
        filename: filename,
        original_filename: file.originalname,
        file_path: filePath,
        file_url: fileUrl,
        file_size: processedBuffer.length,
        mime_type: file.mimetype,
        file_extension: ext,
        file_type: fileType,
        file_context: category || null,
        visibility: visibility,
        metadata: {
          title: title || null,
          description: description || null,
          width: imageMetadata?.width,
          height: imageMetadata?.height,
          thumbnails: thumbnailUrls
        },
        processing_status: 'completed'
      })
      .select()
      .single();
    
    if (dbError) {
      await deleteFromSupabase(bucketName, filePath);
      logger.error('Database insert error', { error: dbError.message, userId });
      return res.status(500).json({ error: 'Failed to save file record' });
    }
    
    // If it's a home photo and it's the first one, set as home profile picture
    if (fileType === 'home_photo' && visibility === 'public') {
      const { data: existingPhotos } = await supabase
        .from('File')
        .select('id')
        .eq('home_id', homeId)
        .eq('file_type', 'home_photo')
        .eq('visibility', 'public')
        .limit(1);
      
      if (!existingPhotos || existingPhotos.length === 1) {
        await supabaseAdmin
          .from('Home')
          .update({ 
            profile_picture_url: fileUrl,
            updated_at: new Date().toISOString()
          })
          .eq('id', homeId);
      }
    }
    
    logger.info('Home file uploaded', { fileId: savedFile.id, homeId, fileType });
    
    res.status(201).json({
      message: 'File uploaded to home successfully',
      file: {
        id: savedFile.id,
        url: fileUrl,
        type: fileType,
        visibility: visibility,
        thumbnails: thumbnailUrls
      }
    });
    
  } catch (err) {
    logger.error('Home file upload error', { error: err.message });
    res.status(500).json({ error: 'Failed to upload home file', message: err.message });
  }
});

/**
 * GET /api/files/home/:homeId
 * Get home's files
 */
router.get('/home/:homeId', verifyToken, async (req, res) => {
  try {
    const { homeId } = req.params;
    const userId = req.user.id;
    const { visibility = 'public' } = req.query;
    
    // Check access
    const { data: home, error: homeError } = await supabase
      .from('Home')
      .select(`
        owner_id,
        occupants:HomeOccupancy!home_id(user_id)
      `)
      .eq('id', homeId)
      .single();

    if (homeError || !home) {
      return res.status(404).json({ error: 'Home not found' });
    }

    const fileViewAccess = await checkHomePermission(homeId, userId, 'docs.view');
    const isOwner = fileViewAccess.isOwner;
    const isOccupant = home.occupants.some(occ => occ.user_id === userId);

    // Only owner/occupants can see private files
    if (visibility === 'private' && !isOwner && !isOccupant) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const { data: files, error } = await supabase
      .from('File')
      .select('*')
      .eq('home_id', homeId)
      .eq('visibility', visibility)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });
    
    if (error) {
      logger.error('Error fetching home files', { error: error.message, homeId });
      return res.status(500).json({ error: 'Failed to fetch home files' });
    }
    
    res.json({ files: files || [] });
    
  } catch (err) {
    logger.error('Home files fetch error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch home files' });
  }
});

// ============ GENERAL FILE ROUTES (from original) ============

/**
 * POST /api/files/upload
 * Generic file upload — used for voice postscripts and other standalone uploads.
 * Returns { message, file: { id, url } }
 */
router.post('/upload', verifyToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const userId = req.user.id;
    const file = req.file;
    const fileType = req.body.file_type || 'general';
    const visibility = req.body.visibility || 'private';

    const fileCategory = getFileCategory(file.mimetype);
    if (!fileCategory) {
      return res.status(415).json({ error: 'Unsupported file type' });
    }

    const sizeValidation = validateFileSize(file.size, fileCategory);
    if (!sizeValidation.valid) {
      return res.status(413).json({ error: sizeValidation.error });
    }

    await checkStorageQuota(userId, file.size);

    const ext = path.extname(file.originalname).toLowerCase();
    const folder = fileType === 'voice_postscript' ? 'voice-postscripts' : 'uploads';

    const { url: fileUrl, key: s3Key } = await s3.uploadToS3(
      file.buffer,
      s3.generateS3Key(folder, file.originalname, userId),
      file.mimetype
    );

    const { data: savedFile, error: dbError } = await supabaseAdmin
      .from('File')
      .insert({
        user_id: userId,
        filename: path.basename(s3Key),
        original_filename: file.originalname,
        file_path: s3Key,
        file_url: fileUrl,
        file_size: file.size,
        mime_type: file.mimetype,
        file_extension: ext,
        file_type: fileType,
        visibility: visibility,
        processing_status: 'completed',
      })
      .select()
      .single();

    if (dbError) {
      await s3.deleteFromS3(s3Key);
      logger.error('Database insert error (upload)', { error: dbError.message, userId });
      return res.status(500).json({ error: 'Failed to save file record' });
    }

    logger.info('File uploaded', { fileId: savedFile.id, userId, fileType });

    res.status(201).json({
      message: 'File uploaded successfully',
      file: { id: savedFile.id, url: fileUrl },
    });
  } catch (err) {
    logger.error('File upload error', { error: err.message });
    res.status(500).json({ error: 'Failed to upload file', message: err.message });
  }
});

/**
 * DELETE /api/files/:id
 * Delete a file
 */
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const { data, error } = await supabase.rpc('soft_delete_file', {
      p_file_id: id,
      p_user_id: userId
    });
    
    if (error || !data.success) {
      return res.status(data?.error === 'Not authorized' ? 403 : 404).json({ 
        error: data?.error || 'Failed to delete file' 
      });
    }
    
    logger.info('File deleted', { fileId: id, userId });
    
    res.json({ message: 'File deleted successfully' });
    
  } catch (err) {
    logger.error('File delete error', { error: err.message, fileId: req.params.id });
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

/**
 * GET /api/files/quota
 * Get user's storage quota
 */
router.get('/quota', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const { data, error } = await supabaseAdmin.rpc('get_or_create_user_quota', {
      p_user_id: userId
    });
    
    if (error) {
      logger.error('Error fetching quota', { error: error.message, userId });
      return res.status(500).json({ error: 'Failed to fetch quota' });
    }
    
    res.json({ quota: data[0] || {} });
    
  } catch (err) {
    logger.error('Quota fetch error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch quota' });
  }
});

module.exports = router;