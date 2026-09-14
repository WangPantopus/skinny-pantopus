// ============================================================
// UPLOAD ENDPOINTS — S3-based file uploads
// Profile pictures, gig media, home task media
// ============================================================

import apiClient, { get, del } from '../client';
import { assertHomeTaskSession, taskSessionHeaders, rethrowTaskSessionError, type HomeTaskSessionScope } from '../taskSessionScope';

/**
 * P2.12 / audience-profile §6.4 — randomize the multipart filename
 * so the picker-supplied name (often IMG_3271_at_my_house.jpg with
 * camera-derived prefixes / GPS bread-crumb path components on
 * Android) never reaches Pantopus's S3 keys, access logs, or DB
 * file_name columns. The original extension is preserved so the
 * server's extension-based routing (image vs video vs HEIC) still
 * works.
 *
 * Not crypto-grade randomness — Math.random + Date.now is enough
 * to defeat correlation against the picker's name. The server's
 * sharp pipeline strips EXIF independently (see
 * backend/routes/upload.js:stripImageMetadata), so randomizing the
 * filename here closes the matching half of the §6.4 invariant.
 */
function randomUploadName(prefix: string, hint: string | null | undefined): string {
  let ext = 'bin';
  if (hint) {
    const fromExt = String(hint).match(/\.([a-zA-Z0-9]{1,5})(?:\?|$)/);
    if (fromExt) {
      ext = fromExt[1].toLowerCase();
    } else if (hint.includes('/')) {
      // hint looks like a MIME type (image/jpeg, video/mp4, …).
      const mime = hint.toLowerCase();
      if (mime === 'image/png') ext = 'png';
      else if (mime === 'image/heic' || mime === 'image/heif') ext = 'heic';
      else if (mime === 'image/webp') ext = 'webp';
      else if (mime === 'image/gif') ext = 'gif';
      else if (mime === 'video/mp4') ext = 'mp4';
      else if (mime === 'video/quicktime') ext = 'mov';
      else if (mime.startsWith('image/')) ext = 'jpg';
      else if (mime.startsWith('video/')) ext = 'mp4';
    }
  }
  if (!/^[a-z0-9]{1,5}$/.test(ext)) ext = 'bin';
  const r1 = Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0');
  const r2 = Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0');
  const t = Date.now().toString(16).slice(-6);
  return `${prefix}-${t}${r1}${r2}.${ext}`;
}

function isUriFile(file: any): boolean {
  return Boolean(file && typeof file === 'object' && typeof file.uri === 'string');
}

function normalizeMime(file: any, fallback = 'application/octet-stream'): string {
  const rawType = file?.type || file?.mimeType;
  return typeof rawType === 'string' && rawType.includes('/')
    ? rawType
    : (file?.mimeType || fallback);
}

function isMediaMime(mime: string): boolean {
  return mime.startsWith('image/') || mime.startsWith('video/');
}

function nameForUpload(prefix: string, file: any, mime: string): string {
  const original = file?.fileName || file?.name;
  if (isMediaMime(mime)) return randomUploadName(prefix, mime || original);
  return original || randomUploadName(prefix, mime);
}

async function appendMultipartFile(
  formData: FormData,
  field: string,
  file: any,
  prefix: string,
  fallbackMime = 'application/octet-stream',
) {
  if (isUriFile(file)) {
    const mime = normalizeMime(file, fallbackMime);
    formData.append(field, {
      uri: file.uri,
      name: nameForUpload(prefix, file, mime),
      type: mime,
    } as any);
    return;
  }

  if (typeof File !== 'undefined' && file instanceof File && isMediaMime(file.type || fallbackMime)) {
    const renamed = new File([file], randomUploadName(prefix, file.name || file.type), {
      type: file.type,
      lastModified: file.lastModified,
    });
    formData.append(field, renamed as any);
    return;
  }

  formData.append(field, file as any);
}

async function appendMultipartFiles(formData: FormData, files: any[], prefix: string) {
  for (const file of files) {
    await appendMultipartFile(formData, 'files', file, prefix);
  }
}

/**
 * Upload profile picture
 *
 * P2.12 — multipart filename is randomized; original `file.name`
 * never reaches the server.
 */
export async function uploadProfilePicture(file: File | any): Promise<{
  message: string;
  url: string;
  key: string;
  user: { id: string; profile_picture_url: string };
}> {
  const formData = new FormData();
  await appendMultipartFile(formData, 'file', file, 'profile', 'image/jpeg');

  const response = await apiClient.post('/api/upload/profile-picture', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

/**
 * Upload media files for a gig (up to 10)
 */
export async function uploadGigMedia(
  gigId: string,
  files: File[]
): Promise<{
  message: string;
  media: Array<{
    id: string;
    file_url: string;
    file_key: string;
    file_name: string;
    file_type: string;
    mime_type: string;
    file_size: number;
    thumbnail_url: string | null;
  }>;
}> {
  const formData = new FormData();
  await appendMultipartFiles(formData, files as any[], 'gig-media');

  const response = await apiClient.post(`/api/upload/gig-media/${gigId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

/**
 * Upload media files for gig Q&A (questions/answers)
 */
export async function uploadGigQuestionMedia(
  gigId: string,
  files: File[]
): Promise<{
  message: string;
  media: Array<{
    file_url: string;
    file_key: string;
    file_name: string;
    file_type: string;
    mime_type: string;
    file_size: number;
    thumbnail_url: string | null;
  }>;
}> {
  const formData = new FormData();
  await appendMultipartFiles(formData, files as any[], 'gig-question-media');

  const response = await apiClient.post(`/api/upload/gig-question-media/${gigId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

/**
 * Upload completion proof files for a gig
 */
export async function uploadGigCompletionMedia(
  gigId: string,
  files: File[]
): Promise<{
  message: string;
  media: Array<{
    file_url: string;
    file_key: string;
    file_name: string;
    file_type: string;
    mime_type: string;
    file_size: number;
    thumbnail_url: string | null;
  }>;
}> {
  const formData = new FormData();
  await appendMultipartFiles(formData, files as any[], 'gig-completion-media');

  const response = await apiClient.post(`/api/upload/gig-completion-media/${gigId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

/**
 * Get media for a gig
 */
export async function getGigMedia(gigId: string): Promise<{
  media: Array<{
    id: string;
    file_url: string;
    file_name: string;
    file_type: string;
    mime_type: string;
    thumbnail_url: string | null;
  }>;
}> {
  return get(`/api/upload/gig-media/${gigId}`);
}

/**
 * Delete a gig media file
 */
export async function deleteGigMedia(gigId: string, mediaId: string): Promise<{ message: string }> {
  return del(`/api/upload/gig-media/${gigId}/${mediaId}`);
}

export interface HomeTaskMedia {
  id: string;
  home_id: string;
  task_id: string;
  uploaded_by: string;
  file_name: string;
  file_type: string;
  mime_type: string;
  file_size: number;
  created_at: string;
  state: 'reserved' | 'ready' | 'retired' | 'legacy';
  available: boolean;
  cleanup_pending?: boolean;
  availability_code?: string;
}

/** One durable upload ID per file; callers retain these IDs for partial retries. */
export async function uploadHomeTaskMedia(
  homeId: string,
  taskId: string,
  files: File[],
  uploadIds: string[] = files.map(() => crypto.randomUUID()),
  scope?: HomeTaskSessionScope,
  requireCurrent: () => void = () => {},
): Promise<{ media: HomeTaskMedia[] }> {
  if (files.length !== uploadIds.length || files.length > 10) throw new Error('Choose up to ten attachments.');
  if (scope) { if (scope.home_id !== homeId) throw new Error('The Home changed. Reopen the task.'); await assertHomeTaskSession(scope, taskId); }
  const media: HomeTaskMedia[] = [];
  for (let index = 0; index < files.length; index++) {
    const id = uploadIds[index];
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new Error('Invalid upload ID.');
    const formData = new FormData();
    formData.append('upload_id', id);
    // Retain filename privacy while keeping the exact name stable on retries.
    const ext = files[index].name.match(/\.([a-zA-Z0-9]{1,5})$/)?.[1]?.toLowerCase() || 'bin';
    formData.append('file', files[index], `task-attachment-${id}.${ext}`);
    // A session preflight can outlive the form that authorized this upload.
    // Check its lifetime after every await and immediately before dispatch.
    requireCurrent();
    const response = await apiClient.post<{ media: HomeTaskMedia[] }>(
      `/api/upload/home-task-media/${homeId}/${taskId}`, formData,
      { headers: { 'Content-Type': 'multipart/form-data', ...taskSessionHeaders(scope) } },
    ).catch(rethrowTaskSessionError);
    requireCurrent();
    if (scope) await assertHomeTaskSession(scope, taskId);
    requireCurrent();
    const item = response.data.media?.[0];
    if (response.data.media?.length !== 1 || item.id !== id || item.home_id !== homeId || item.task_id !== taskId
      || item.state !== 'ready' || item.available !== true) throw new Error('The attachment was not confirmed. Retry it.');
    media.push(item);
  }
  return { media };
}

/**
 * Upload attachments for a chat room (documents/images).
 */
export async function uploadChatMedia(
  roomId: string,
  files: File[]
): Promise<{
  message: string;
  media: Array<{
    id: string;
    file_url: string;
    original_filename: string;
    mime_type: string;
    file_size: number;
    file_type: string;
  }>;
}> {
  const formData = new FormData();
  await appendMultipartFiles(formData, files as any[], 'chat-media');

  // Must explicitly set multipart/form-data so axios doesn't use the default
  // application/json content-type which causes multer to skip file parsing.
  const response = await apiClient.post(`/api/upload/chat-media/${roomId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

/**
 * Upload ownership evidence document for a claim.
 * Used on mobile with React Native FormData (uri-based file objects).
 */
export async function uploadOwnershipEvidence(
  homeId: string,
  claimId: string,
  file: any, // File on web, { uri, name, type } on mobile
  evidenceType: string,
  uploadId: string = crypto.randomUUID(),
  sessionScope?: string,
): Promise<{
  message: string;
  evidence: {
    id: string;
    evidence_type: string;
    status: string;
    home_id: string;
    claim_id: string;
    available: boolean;
    file_name: string;
  };
}> {
  const formData = new FormData();

  // React Native FormData requires uri-based file objects with explicit shape.
  await appendMultipartFile(formData, 'file', file, 'evidence');

  formData.append('evidence_type', evidenceType);
  formData.append('upload_id', uploadId);

  const response = await apiClient.post(
    `/api/upload/ownership-evidence/${homeId}/${claimId}`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data', ...(sessionScope ? { 'x-pantopus-session-scope': sessionScope } : {}) } }
  );
  const evidence = response.data?.evidence;
  if (evidence?.id !== uploadId || evidence.home_id !== homeId || evidence.claim_id !== claimId
    || evidence.evidence_type !== evidenceType || !['pending', 'verified'].includes(evidence.status) || evidence.available !== true) {
    throw new Error('Could not confirm the exact document upload. Retry the same file.');
  }
  return response.data;
}

/** Current safe metadata; byte delivery always rechecks exact task access. */
export async function getHomeTaskMedia(homeId: string, taskId: string, scope?: HomeTaskSessionScope): Promise<{ media: HomeTaskMedia[]; can_upload: boolean }> {
  if (scope) { if (scope.home_id !== homeId) throw new Error('The Home changed. Reopen the task.'); await assertHomeTaskSession(scope, taskId); }
  const result = await get<{ media: HomeTaskMedia[]; can_upload: boolean }>(`/api/upload/home-task-media/${homeId}/${taskId}`, undefined, { headers: taskSessionHeaders(scope) }).catch(rethrowTaskSessionError);
  if (scope) await assertHomeTaskSession(scope, taskId);
  if (!Array.isArray(result.media) || typeof result.can_upload !== 'boolean'
    || result.media.some(item => item.home_id !== homeId || item.task_id !== taskId)) throw new Error('Could not verify the attachments. Retry.');
  return result;
}

export async function downloadHomeTaskMedia(homeId: string, taskId: string, mediaId: string, scope?: HomeTaskSessionScope): Promise<Blob> {
  if (scope) { if (scope.home_id !== homeId) throw new Error('The Home changed. Reopen the task.'); await assertHomeTaskSession(scope, taskId); }
  const response = await apiClient.get<Blob>(`/api/upload/home-task-media/${homeId}/${taskId}/${mediaId}/download`, { responseType: 'blob', headers: taskSessionHeaders(scope) }).catch(rethrowTaskSessionError);
  if (scope) await assertHomeTaskSession(scope, taskId);
  return response.data;
}

export async function deleteHomeTaskMedia(homeId: string, taskId: string, mediaId: string, scope?: HomeTaskSessionScope): Promise<{ media: HomeTaskMedia }> {
  if (scope) { if (scope.home_id !== homeId) throw new Error('The Home changed. Reopen the task.'); await assertHomeTaskSession(scope, taskId); }
  const result = await del<{ media: HomeTaskMedia }>(`/api/upload/home-task-media/${homeId}/${taskId}/${mediaId}`, undefined, { headers: taskSessionHeaders(scope) }).catch(rethrowTaskSessionError);
  if (scope) await assertHomeTaskSession(scope, taskId);
  if (result.media?.id !== mediaId || result.media.home_id !== homeId || result.media.task_id !== taskId
    || result.media.state !== 'retired' || result.media.cleanup_pending !== false) throw new Error('Removal was not confirmed. Retry it.');
  return result;
}

/**
 * Upload a Live Photo pair (still image + companion video clip).
 * Returns URLs for both files plus an optional thumbnail.
 */
export async function uploadLivePhoto(
  imageFile: { uri: string; name?: string; type?: string },
  videoFile: { uri: string; name?: string; type?: string },
): Promise<{
  imageUrl: string;
  liveVideoUrl: string;
  thumbnailUrl: string | null;
}> {
  const formData = new FormData();
  await appendMultipartFile(formData, 'image', imageFile, 'live-still', 'image/jpeg');
  await appendMultipartFile(formData, 'video', videoFile, 'live-video', 'video/quicktime');

  const response = await apiClient.post('/api/upload/live-photo', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

/**
 * Upload media files for a post (images/videos only).
 */
export async function uploadPostMedia(
  postId: string,
  files: any[]
): Promise<{
  message: string;
  media_urls: string[];
  media_types: string[];
  media_thumbnails: string[];
  media_live_urls: string[];
}> {
  const formData = new FormData();
  await appendMultipartFiles(formData, files, 'post-media');

  const response = await apiClient.post(`/api/upload/post-media/${postId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

/**
 * Upload image files for a post comment.
 */
export async function uploadCommentMedia(
  commentId: string,
  files: any[]
): Promise<{
  message: string;
  attachments: Array<{
    id: string;
    comment_id?: string | null;
    file_url: string;
    original_filename: string;
    mime_type: string;
    file_size: number;
    file_type?: string;
    created_at?: string;
  }>;
}> {
  const formData = new FormData();
  await appendMultipartFiles(formData, files, 'comment-media');

  const response = await apiClient.post(`/api/upload/comment-media/${commentId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

/**
 * Upload media files for a listing.
 */
export async function uploadListingMedia(
  listingId: string,
  files: any[]
): Promise<{
  message: string;
  media_urls: string[];
  media_types: string[];
}> {
  const formData = new FormData();
  await appendMultipartFiles(formData, files, 'listing');

  const response = await apiClient.post(`/api/upload/listing-media/${listingId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

/**
 * Remove one listing media item by index.
 */
export async function deleteListingMedia(
  listingId: string,
  index: number
): Promise<{ message: string; media_urls: string[]; media_types: string[] }> {
  const response = await apiClient.delete(`/api/upload/listing-media/${listingId}`, { data: { index } });
  return response.data;
}

/**
 * Upload files to use as mailbox attachments.
 */
export async function uploadMailAttachments(
  files: any[]
): Promise<{
  message: string;
  attachments: Array<{
    url: string;
    key: string;
    name: string;
    mime_type: string;
    size: number;
  }>;
}> {
  const formData = new FormData();
  await appendMultipartFiles(formData, files, 'mail');

  const response = await apiClient.post('/api/upload/mail-attachments', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

/**
 * Upload images for AI assistant chat.
 * Returns public URLs to pass to the AI chat endpoint.
 */
export async function uploadAIMedia(
  files: any[]
): Promise<{
  message: string;
  images: Array<{
    url: string;
    key: string;
    name: string;
    mime_type: string;
    size: number;
  }>;
}> {
  const formData = new FormData();
  await appendMultipartFiles(formData, files, 'ai-chat');

  const response = await apiClient.post('/api/upload/ai-media', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

/**
 * Upload business logo or banner image.
 */
export async function uploadBusinessMedia(
  businessId: string,
  file: any,
  type: 'logo' | 'banner'
): Promise<{
  message: string;
  url: string;
  key: string;
}> {
  const formData = new FormData();
  await appendMultipartFile(formData, 'file', file, `business-${type}`, 'image/jpeg');

  const response = await apiClient.post(
    `/api/upload/business-media/${businessId}?type=${type}`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  );
  return response.data;
}

/**
 * Upload Audience Profile avatar or banner image.
 */
export async function uploadPersonaMedia(
  personaId: string,
  file: any,
  type: 'avatar' | 'banner'
): Promise<{
  message: string;
  url: string;
  key: string;
  persona: {
    id: string;
    handle: string;
    avatar_url: string | null;
    banner_url: string | null;
  };
}> {
  const formData = new FormData();
  // P2.12 — randomize filename so the picker's IMG_xxxx never reaches
  // S3 / DB file_name / access logs. Persona avatar + banner are the
  // most-leveraged identity surface; the firewall starts here.
  const namePrefix = `persona-${type}`;
  await appendMultipartFile(formData, 'file', file, namePrefix, 'image/jpeg');

  const response = await apiClient.post(
    `/api/upload/persona-media/${personaId}?type=${type}`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  );
  return response.data;
}

/**
 * Upload media (photos/files) to attach to a review.
 * Max 5 files. Only the review author can upload.
 */
export async function uploadReviewMedia(
  reviewId: string,
  files: any[]
): Promise<{
  message: string;
  media_urls: string[];
}> {
  const formData = new FormData();
  await appendMultipartFiles(formData, files, 'review');

  const response = await apiClient.post(`/api/upload/review-media/${reviewId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}
