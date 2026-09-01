# Upload, File Storage, and Attachment Security Interview Notes

Date: 2026-05-14

This document answers the upload and file-storage questions from the perspective of the current Pantopus repository. It is intentionally written in an interview style: it explains what the system does today, why the shape exists, where the risks are, and what I would change if I were hardening it for production.

The short version is that Pantopus has two upload surfaces because it is in the middle of a migration:

- `/api/files` is the older file-library and storage-management surface.
- `/api/upload` is the newer product-media upload surface, backed primarily by S3.
- S3 is the canonical object store for new media. CloudFront is a CDN URL layer in front of S3. Supabase remains canonical for auth, Postgres metadata, and legacy storage paths.
- The newer S3 upload path has stronger MIME validation and EXIF stripping than the legacy file path.
- Private-file protection is implemented well for chat attachments, but not yet consistently enforced for every S3-backed private object.
- Malware scanning is planned but not implemented.
- Orphan cleanup is partial; physical object-store garbage collection is not complete.

## Code Map

Primary files:

- `backend/app.js`
  - Mounts `/api/files` and `/api/upload`.
  - Imports `fileRoutes` from `backend/routes/files.js`.
  - Imports `uploadRoutes` from `backend/routes/upload.js`.
- `backend/routes/files.js`
  - Older file-management router.
  - Handles profile pictures, portfolio files, home files, generic upload, quota, and delete.
  - Uses a mix of Supabase Storage helpers and S3.
- `backend/routes/upload.js`
  - Newer S3 upload router.
  - Handles profile pictures, persona media, gig media, chat media, post media, comment media, listing media, mail attachments, home task media, ownership evidence, review media, business media, AI media, and Live Photo pairs.
  - Contains the newer MIME validation and EXIF-stripping middleware.
- `backend/services/s3Service.js`
  - Central S3 helper.
  - Defines allowed MIME categories, max sizes, key generation, public URL construction, S3 upload/delete, and presigned downloads.
- `backend/routes/chats.js`
  - Validates `fileIds` before attaching files to chat messages.
  - Serves private chat files through an authenticated proxy that redirects to a short-lived signed S3 URL.
- `backend/database/schema.sql`
  - Defines `File`, `FileQuota`, `FileAccessLog`, `FileThumbnail`, quota functions, soft-delete function, and cleanup functions.
- `backend/tests/unit/uploadExifStrip.test.js`
  - Unit tests for the EXIF strip path and the intentional GIF exemption.
- `backend/tests/unit/chatRoutes.test.js`
  - Includes tests that reject attaching non-owned chat files.

## 1. Why are there both `/api/upload` and `/api/files` paths with overlapping upload behavior?

There are two paths because the product evolved from a generic file-storage abstraction into multiple product-specific media workflows.

`/api/files` is the older abstraction. It thinks in terms of "files owned by a user" and exposes CRUD-style behavior:

- `POST /api/files/profile-picture`
- `POST /api/files/portfolio`
- `GET /api/files/portfolio`
- `POST /api/files/home/:homeId`
- `GET /api/files/home/:homeId`
- `POST /api/files/upload`
- `DELETE /api/files/:id`
- `GET /api/files/quota`

That router still contains Supabase Storage helpers:

- `uploadToSupabase(buffer, filePath, bucketName, contentType)`
- `getPublicUrl(bucketName, filePath)`
- `getSignedUrl(bucketName, filePath, expiresIn)`
- `deleteFromSupabase(bucketName, filePath)`

It also has S3 usage in newer parts of the same file, especially portfolio and generic uploads. That is why the path feels mixed: it started as a Supabase Storage file API and then had S3 added to pieces of it.

`/api/upload` is the newer product-media API. It thinks less like a general file library and more like "attach this media to a specific product entity":

- `POST /api/upload/gig-media/:gigId`
- `POST /api/upload/chat-media/:roomId`
- `POST /api/upload/post-media/:postId`
- `POST /api/upload/comment-media/:commentId`
- `POST /api/upload/listing-media/:listingId`
- `POST /api/upload/ownership-evidence/:homeId/:claimId`
- `POST /api/upload/business-media/:businessId`
- `POST /api/upload/persona-media/:personaId`
- `POST /api/upload/live-photo`

The overlap exists because clients are still using both surfaces. For example:

- Profile picture upload exists in both `/api/files/profile-picture` and `/api/upload/profile-picture`.
- The shared frontend API package has both `endpoints/files.ts` and `endpoints/upload.ts`.
- Mail voice postscript still uses `/api/files/upload`.
- Newer feed, chat, listing, persona, business, and ownership-evidence media flows use `/api/upload`.

In an interview, I would describe this as a compatibility boundary during a storage migration. I would not pretend it is fully clean. The correct architectural cleanup is:

1. Keep `/api/files` for file-record lifecycle: quota, listing owned files, deletion, metadata, and maybe download.
2. Keep `/api/upload` for entity-specific multipart commands.
3. Move all upload validation, MIME detection, EXIF stripping, scan-state handling, and storage writes behind a shared upload service.
4. Make all object storage go through S3 for new files.
5. Deprecate Supabase Storage routes after all clients are migrated.

The key interview point is that duplicate route families are not automatically bad if they are transitional and intentional. They become risky when validation, privacy, and lifecycle behavior diverge between them. In this repo, they have diverged, so consolidation should be a hardening priority.

## 2. Which storage backend is canonical: S3, CloudFront, Supabase Storage, or a mix?

The canonical storage backend for new media is S3.

CloudFront is not a storage backend. It is a delivery layer. In `s3Service.getPublicUrl(key)`, the service returns:

- `${CLOUDFRONT_URL}/${key}` when a CloudFront URL is configured.
- `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}` otherwise.

Supabase is still canonical for:

- Auth and sessions.
- Postgres metadata.
- The `File` table and related app records.
- RLS and application data.
- Some legacy Supabase Storage paths in `/api/files`.

Supabase Storage is therefore a legacy object-store path, not the target canonical path for new media.

The current reality is a mix:

- New media routes mostly write to S3 through `backend/services/s3Service.js`.
- Some `/api/files` routes still use Supabase Storage directly.
- Some `/api/files` routes already use S3.
- The database stores metadata in `File` rows or product-specific tables such as `GigMedia`, `HomeTaskMedia`, and arrays on `Post` or `Listing`.

The production design should be:

- S3 is the only object store for uploaded binary content.
- CloudFront is the CDN in front of S3.
- Supabase/Postgres is the metadata and authorization store.
- Supabase Storage is read-only legacy until migration is complete.
- All URLs returned to clients come from a central policy:
  - public content: CDN URL is allowed.
  - private content: authenticated API proxy or signed URL only.

## 3. How do you validate file content versus declared MIME type?

The newer `/api/upload` path validates content using the `file-type` package.

Flow:

1. Multer parses the multipart upload into memory.
2. The file filter checks that the declared MIME is in the allowed list from `s3Service`.
3. `enforceFileSizeLimits` checks category-specific file size.
4. `validateAndStripUploads` calls `validateFileMime(file)`.
5. `validateFileMime` calls `fileTypeFromBuffer(file.buffer)` and compares detected MIME with `file.mimetype`.
6. Exact MIME matches are accepted.
7. ZIP-based Office files are allowed when detected as `application/zip` but declared as `.docx` or `.xlsx`.
8. HEIC and HEIF variants are treated as compatible.
9. Mismatches are rejected with `400`.

This is a reasonable baseline because declared MIME and file extension are user-controlled. The actual content bytes are harder to spoof accidentally and give us a better signal.

There are important caveats:

- If `file-type` throws, the current implementation logs a warning and allows the upload.
- If `file-type` returns undefined, the current implementation logs a warning and allows the upload.
- That permissive behavior helps with plain text and obscure formats, but it is not a strong security posture for arbitrary binary content.
- The legacy `/api/files` path validates by declared MIME and extension, not consistently by magic bytes.
- Ownership evidence has an additional hand-rolled magic-byte validation and a SHA-256 content hash for duplicate detection.

For an interview, I would say the current system has two levels:

- General newer path: `file-type` byte detection.
- High-trust evidence path: additional magic-byte and content-hash checks.

For production hardening, I would extract a single `UploadValidationService` with policies like:

```text
validateUpload(file, policy):
  - require buffer
  - normalize declared MIME
  - enforce allowed MIME by route policy
  - enforce extension compatibility
  - detect MIME from bytes
  - fail closed for binary files when detection is unavailable
  - allow explicit text-like exceptions only when route policy allows them
  - compute content hash
  - return normalized metadata
```

I would also avoid allowing route-specific ad hoc MIME checks to drift from the central policy.

## 4. How do you strip EXIF consistently across all upload paths?

The intended canonical EXIF path is in `backend/routes/upload.js`.

`stripImageMetadata(file)` does this:

1. Requires `sharp`.
2. Skips non-images.
3. Skips GIF.
4. Runs:

```js
sharp(file.buffer)
  .rotate()
  .toBuffer()
```

`rotate()` applies EXIF orientation before metadata is discarded. The output buffer replaces the original file buffer, and `file.size` is updated.

The middleware `validateAndStripUploads` runs after Multer and size validation. It applies:

1. MIME validation.
2. EXIF/metadata stripping.

This is good because the server does not rely on mobile or web clients to strip metadata. The frontend also randomizes upload filenames for media in `frontend/packages/api/src/endpoints/upload.ts`, which helps prevent picker-supplied filenames from leaking location or identity hints. But client-side filename randomization is defense-in-depth; the server-side stripping is the authoritative control.

However, EXIF stripping is not yet consistent across every path.

Strong paths:

- Most `/api/upload/*` endpoints that use `upload.single('file')` or `upload.array('files')` and include `validateAndStripUploads`.
- Unit tests cover JPEG EXIF removal, PNG handling, non-image no-op, and GIF skip.

Weaker or divergent paths:

- `/api/files/*` does not call the shared `validateAndStripUploads` middleware.
- Some `/api/files` image paths re-encode via `sharp`, which usually strips metadata, but this is incidental and not expressed as a shared security invariant.
- `/api/files/upload` generic upload does not explicitly strip EXIF for image uploads.
- `/api/upload/live-photo` skips the shared middleware because `upload.fields()` returns `req.files` as an object, and the endpoint currently does its own type and size validation. That means Live Photo still images are not guaranteed to go through the EXIF strip helper.

The correct hardening plan:

1. Extract `validateAndStripUploads` into a reusable middleware/service outside `routes/upload.js`.
2. Make it support `req.file`, array-style `req.files`, and field-object `req.files`.
3. Apply it to `/api/files` and `/api/upload/live-photo`.
4. Add route-level tests that assert every image-accepting endpoint either strips metadata or explicitly rejects formats that cannot be stripped safely.
5. Consider preserving output format explicitly in `sharp` so PNG/WEBP behavior is predictable.

## 5. Are GIFs intentionally exempt from EXIF processing?

Yes. GIFs are intentionally exempt in `stripImageMetadata`.

The reason is practical: sharp can re-encode GIFs in a way that loses animation. The code comments say the route skips GIF because sharp re-encodes animated GIFs and can lose animation. The unit test says the same thing: animated GIF skips stripping to preserve animation.

That is an explicit product/security tradeoff:

- Benefit: animated GIFs keep working.
- Risk: GIF metadata or embedded comment/application blocks may survive.

For most social-media-style uploads, that may be acceptable. For privacy-sensitive surfaces, such as identity, ownership evidence, home documents, business verification, or private chat, I would prefer one of these policies:

- Do not allow GIFs.
- Convert GIFs to a static safe preview and store the original only privately.
- Use a GIF-aware metadata sanitizer.
- Permit GIFs only on public entertainment/media surfaces, not identity or evidence surfaces.

The current implementation allows `image/gif` globally in S3 allowed image types, so the route policy is broader than the privacy-sensitive ideal.

## 6. How are private files protected from public CloudFront URLs?

The best implemented private-file protection is for chat attachments.

Chat upload flow:

1. `POST /api/upload/chat-media/:roomId` verifies the uploader is an active `ChatParticipant`.
2. It uploads the object to S3.
3. It creates a `File` row with:
   - `user_id`
   - `file_path`
   - `visibility: private`
   - `file_type: chat_file`
   - `metadata.room_id`
4. It then updates `file_url` to `/api/chat/files/:fileId`.
5. Clients attach the `File.id` to messages.

Chat download flow:

1. `GET /api/chat/files/:fileId` requires auth.
2. It loads the `File` row.
3. It rejects missing/deleted files.
4. It reads `metadata.room_id`.
5. It verifies the requester is an active participant in the room.
6. It generates a 15-minute presigned S3 URL.
7. It redirects to that signed URL.

That is the correct application-layer pattern for private files: clients see stable app URLs, while S3 URLs are short-lived and issued only after authorization.

The risk is that `s3Service.uploadToS3` always returns `getPublicUrl(key)`, and `getPublicUrl` uses CloudFront or raw S3 URL construction. That is fine for public media, but not sufficient for private media if the bucket or CloudFront distribution is publicly readable.

For private content, the system must guarantee all of the following:

- S3 bucket blocks public access.
- No public object ACL is applied.
- CloudFront uses Origin Access Control or equivalent to read from S3.
- Private paths are not publicly cacheable without signed cookies or signed URLs.
- Private records store app proxy URLs, not public CDN URLs.
- Response serializers never leak raw private object URLs.

Today, chat approximates that at the app layer, but the object-store layer needs stricter policy separation. Some private-ish flows return or store public-looking URLs:

- `mail-attachments` returns S3/CloudFront URLs.
- `ai-media` returns public URLs.
- ownership evidence stores `metadata.file_url`.
- legacy `/api/files/home/:homeId` private files may store long-lived signed Supabase URLs.

The production answer should be:

- Public bucket/prefix for public media only.
- Private bucket/prefix for private media.
- `uploadPublicObject` and `uploadPrivateObject` should be different service calls.
- Private object writes should never return `getPublicUrl`.
- Private object reads should go through a signed URL/proxy service.
- CloudFront should not make private prefixes public.

## 7. How do you handle malware scanning?

The current codebase does not implement malware scanning for uploaded user files.

I found:

- MIME validation.
- Size limits.
- EXIF stripping.
- Rate limiting on `/api/upload`.
- Some content hashing on ownership evidence.
- Authorization checks around attaching files.

I did not find:

- ClamAV integration.
- Vendor AV scanning.
- Quarantine prefix.
- Scan status enum beyond generic `processing_status`.
- Async scan worker.
- "clean only" promotion.
- Tests for malware scan failure.

The docs mention malware scanning as a planned hardening item for chat files, but it is not implemented in the upload pipeline.

The production design I would propose:

1. Upload object to `quarantine/{userId}/...`, not to a public/readable prefix.
2. Create metadata row:
   - `processing_status = 'processing'`
   - `scan_status = 'pending'` or store in `metadata.scan`.
   - `visibility` set according to route policy, but not readable yet.
3. Send scan job to a worker.
4. Worker downloads object and runs ClamAV or a managed scanner.
5. If clean:
   - move/copy to canonical prefix.
   - update row to `processing_status = 'completed'`, `scan_status = 'clean'`.
   - make app URL available.
6. If infected:
   - keep quarantined or delete object.
   - set `processing_status = 'failed'`, `scan_status = 'infected'`.
   - prevent all reads.
   - alert security/ops for high-risk cases.
7. If scan errors:
   - fail closed for risky categories.
   - optionally allow low-risk text/image with retry policy only if business accepts that risk.

For route behavior:

- Chat message attachment should reject files that are not clean.
- Public post/listing media should not publish until clean.
- Evidence documents should be accepted as "received" but unavailable to reviewers until clean.
- Admin surfaces should show scan status.

## 8. What are max file sizes per category and why?

Current S3 category limits in `s3Service`:

- Images: 10 MB.
- Videos: 100 MB.
- Documents: 25 MB.

Legacy `/api/files` also defines:

- Audio: 5 MB.

Live Photo endpoint defines:

- Still image: 10 MB.
- Companion video: 15 MB.

Multer has a global max of 100 MB and max 10 files for the standard upload parsers. Then route middleware applies category-specific caps.

Reasons:

- The backend uses Multer memory storage, so large files directly increase Node process memory pressure.
- Images are usually resized/re-encoded, so a 10 MB source cap is enough for mobile/web photos while limiting CPU and memory cost.
- Videos are expensive but need a larger cap because gig proof, listing videos, and post media can be short clips.
- Documents need enough space for PDFs and evidence but should be lower than video because document uploads are higher risk.
- Audio postscripts are short recordings, so 5 MB is appropriate.
- Live Photo videos are companion clips, not full videos, so 15 MB is enough and cheaper than the general 100 MB video cap.

There are also account-level quota controls:

- Default storage limit: 1 GB.
- Default max files: 1000.
- Daily upload cap: 100 uploads.
- Default bandwidth limit appears to be 5 GB/month in `FileQuota`.

Risk and improvement:

- `/api/upload` enforces per-category limits consistently for most endpoints.
- `/api/upload/ownership-evidence` does its own size check and skips `enforceFileSizeLimits`, which is fine but duplicate.
- `/api/upload/live-photo` does its own size check and skips shared validation.
- `/api/files` has its own duplicate constants.

I would centralize all limits in one policy map:

```text
profile_image: image only, 10 MB, strip EXIF, re-encode webp
post_media_image: image, 10 MB, strip EXIF, public after scan
post_media_video: video, 100 MB, scan, public after scan
chat_attachment: image/doc/video policy, private, scan required
ownership_evidence: image/doc, private, scan required, content hash required
voice_postscript: audio, 5 MB, private, scan optional depending on format
live_photo_image: image, 10 MB, strip EXIF
live_photo_video: mp4/mov, 15 MB, scan
```

That lets route behavior stay consistent and auditable.

## 9. How do you prevent users from attaching files they do not own?

The strongest pattern is to avoid trusting client-supplied file IDs.

Most `/api/upload` routes work like this:

1. Authenticate the user.
2. Verify the user has permission on the parent entity.
3. Upload the file.
4. Attach the uploaded file to that entity in the same route.

Examples:

- Gig media: verify `Gig.user_id === req.user.id`.
- Listing media: verify `Listing.user_id === req.user.id`.
- Post media: verify `Post.user_id === req.user.id`.
- Comment media: verify `PostComment.user_id === req.user.id`.
- Persona media: verify `PublicPersona.user_id === req.user.id`.
- Business media: verify `checkBusinessPermission(..., 'profile.edit')`.
- Chat media upload: verify active `ChatParticipant`.
- Home task media: verify active `HomeOccupancy`.
- Ownership evidence: verify `HomeOwnershipClaim.claimant_user_id === req.user.id`.

When the client does send file IDs, the server must resolve them through ownership and context checks. Chat does this:

- It loads all requested `File` rows.
- It requires each row to have `user_id` equal to the sender.
- It requires `is_deleted = false`.
- It requires `file_type = 'chat_file'`.
- It rejects the whole request if any file is invalid or not owned.

There is a unit test for rejecting non-owned chat files.

Known gaps:

- Business verification accepts `file_id` but does not appear to verify that the file belongs to the submitting user or is valid for that business.
- Home documents accept optional `file_id` and storage metadata without validating that the file belongs to the caller or was uploaded for that home.
- Business catalog items accept `image_file_id` and `gallery_file_ids`, and the route spreads `req.body` into database writes without first resolving those file IDs to owned/public/business-authorized files.
- Generic delete by S3 key in `/api/upload/file` checks whether the key contains `/${userId}/`, which is weaker than DB-backed ownership checks and can fail for routes whose key format does not include user ID in that exact position.

The hardening pattern should be a single helper:

```text
assertAttachableFiles({
  actorUserId,
  fileIds,
  allowedFileTypes,
  requiredVisibility,
  context
})
```

It should enforce:

- every requested ID exists;
- every file is not deleted;
- every file is owned by the actor or belongs to an entity the actor may administer;
- every file type is allowed for the target;
- private files cannot be attached to public entities unless explicitly promoted/sanitized;
- file metadata context matches the target when relevant, such as `room_id`, `home_id`, `business_id`, or `claim_id`.

For public business catalog images, I would also require either:

- the file is public and owned by the business/actor, or
- the file was uploaded through the business-media/catalog-media route and carries matching metadata.

## 10. How do you garbage-collect orphaned files?

Today, garbage collection is partial.

What exists:

- Some routes delete S3 objects if the database insert/update fails.
- Some delete routes remove S3 objects and database records for specific media tables.
- `soft_delete_file(p_file_id, p_user_id)` marks a `File` row deleted and decrements quota.
- `cleanup_old_deleted_files(days_old)` deletes old soft-deleted `File` rows.
- Foreign keys clean up related metadata rows such as thumbnails/access logs when a `File` row is deleted.

What is missing:

- No scheduled job appears to call `cleanup_old_deleted_files`.
- `cleanup_old_deleted_files` deletes database rows only; it does not delete the underlying S3 or Supabase Storage object.
- Media stored directly in arrays, such as `Post.media_urls` and `Listing.media_urls`, is harder to reconcile.
- Some product-specific media tables store S3 keys, such as `GigMedia.file_key`, but there is no global object-store reconciliation job.
- Uploads that succeed in S3 but fail after app-level update can still orphan objects in routes that do not roll back every uploaded key.
- Supabase Storage legacy objects and S3 objects need different deletion clients.

The robust production GC design:

1. On every upload, create a durable metadata record before or immediately after object write.
2. Store:
   - storage provider,
   - bucket,
   - object key,
   - owning user,
   - owning entity,
   - visibility,
   - created time,
   - scan status,
   - deletion state.
3. Use DB transactions where possible for metadata changes.
4. For object writes that cannot be transactional, use a compensating cleanup queue.
5. Add an object GC job:
   - list S3 prefixes by age;
   - compare to live DB references;
   - delete unreferenced quarantine objects after a short TTL;
   - delete unreferenced public/private objects after a longer retention window;
   - skip recently uploaded objects to avoid races.
6. Add a deleted-file sweeper:
   - find `File.is_deleted = true` older than retention window;
   - delete physical object;
   - delete thumbnails/variants;
   - delete metadata row;
   - record audit metrics.
7. Add product-specific reconcilers:
   - `GigMedia`
   - `HomeTaskMedia`
   - `HomeVerificationEvidence`
   - `Post.media_urls`
   - `Listing.media_urls`
   - `Review.media_urls`
   - `BusinessProfile.logo_file_id/banner_file_id`
   - `BusinessCatalogItem.image_file_id/gallery_file_ids`
8. Make GC observable:
   - dry-run mode;
   - count objects scanned;
   - count objects deleted;
   - bytes reclaimed;
   - errors by provider;
   - safety threshold to abort if deletion count spikes.

## System Strengths

The current design has several good foundations:

- S3 upload logic is centralized enough to identify the target direction.
- Newer routes have route-specific authorization before upload.
- Newer routes use byte-level MIME validation.
- Newer routes strip image metadata server-side.
- GIF exemption is intentional and tested.
- Chat private-file serving uses the right proxy/signed-URL shape.
- Chat file attachment validates ownership.
- Ownership evidence has content hashing and duplicate detection.
- Quotas exist at the database level.
- Many upload routes roll back S3 objects on DB insert failure.

## Main Risks

The main risks are:

1. Split validation paths.
   - `/api/upload` and `/api/files` do not share one validator.

2. Split storage paths.
   - S3 is target canonical, but Supabase Storage still exists in legacy routes.

3. Private URL leakage.
   - `getPublicUrl` is used broadly, and private S3 object policy is not encoded in the service API.

4. No malware scanning.
   - Files can become accessible after MIME validation and metadata stripping only.

5. Incomplete EXIF consistency.
   - Live Photo and legacy file routes can bypass the shared strip middleware.

6. Incomplete file-ID ownership checks.
   - Some routes accept `file_id` or file ID arrays without resolving ownership/attachability.

7. Incomplete physical GC.
   - Soft-deleted DB rows and failed writes do not guarantee object-store cleanup.

8. Schema and route drift.
   - Route-specific file types and schema constraints need regular reconciliation.

## Recommended Refactor

I would do this as a series of small, low-risk steps.

### Step 1: Introduce a central upload policy service

Create something like:

```text
backend/services/uploadPolicyService.js
backend/services/uploadValidationService.js
backend/services/fileStorageService.js
```

Responsibilities:

- allowed MIME types by upload purpose;
- max file size by upload purpose;
- public/private destination;
- required scanner policy;
- EXIF behavior;
- output format behavior;
- content hash behavior;
- attachability rules.

### Step 2: Separate public and private storage APIs

Current `s3.uploadToS3` returns a public URL regardless of the route intent.

Replace with:

```text
uploadPublicObject(...)
uploadPrivateObject(...)
getPublicCdnUrl(...)
getSignedDownloadUrl(...)
getAppFileUrl(...)
```

The private upload API should return an object key and file ID, not a public URL.

### Step 3: Apply shared validation everywhere

Apply the same validation and EXIF middleware to:

- `/api/upload/*`
- `/api/upload/live-photo`
- `/api/files/*`
- route-specific condition-photo uploads
- any future direct multipart endpoints

### Step 4: Add scanner state

Extend metadata with:

```text
scan_status: pending | clean | infected | error
scan_provider
scan_completed_at
scan_error
quarantine_key
canonical_key
```

Or add explicit columns if the query patterns need indexes.

### Step 5: Fix file-ID attach gaps

Before any route writes a user-supplied file ID into another table, it should call one helper that proves:

- ownership;
- visibility compatibility;
- file type compatibility;
- target context compatibility.

### Step 6: Build GC and reconciliation

Add scheduled jobs:

- quarantine expiry sweeper;
- soft-deleted file object sweeper;
- orphan S3 object reconciler;
- legacy Supabase Storage reconciler;
- media-array reference checker.

### Step 7: Deprecate Supabase Storage uploads

Keep read compatibility if needed, but stop writing new objects to Supabase Storage. Once migration is complete, remove the legacy helpers.

## Interview-Style Summary Answer

If asked to summarize this in an interview, I would say:

Pantopus currently has both `/api/files` and `/api/upload` because the codebase is migrating from a legacy generic file API to a newer S3-backed, product-specific media API. S3 is the canonical storage direction for new uploads, CloudFront is only the CDN layer, and Supabase remains canonical for auth and Postgres metadata. Supabase Storage is legacy and should be phased out.

The newer upload path validates declared MIME against file bytes using `file-type`, enforces per-category size limits, and strips image metadata with sharp. GIFs are intentionally exempt to avoid destroying animation. The older file path does not consistently share that validation, which is the main reason I would extract a central upload validation service.

Private chat files are protected through an authenticated app URL that checks room membership and redirects to a short-lived signed S3 URL. That is the right pattern, but it needs to become the universal private-file pattern. Private S3/CloudFront access must also be enforced at the bucket/distribution layer, not just by hiding URLs in database rows.

Malware scanning is not implemented today. I would add quarantine-first uploads, asynchronous scanning, scan status on metadata rows, and promotion to readable storage only after clean results. I would also centralize file-ID attachment checks so no user can attach another user's file by guessing a UUID. Finally, I would add a real object-store garbage collector because the current cleanup mostly handles database soft deletes and route-local rollback, not full physical-object reconciliation.

