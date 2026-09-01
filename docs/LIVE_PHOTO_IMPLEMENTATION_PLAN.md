# Live Photo Support — Implementation Plan

## Overview

Enable users to post Live Photos (iPhone-style: still image + ~1.5-3s video clip) in Feed/Pulse. On long-press/hover, the still crossfades into the video and plays automatically, mimicking the native iOS Live Photo experience.

---

## Current State

| Component | Status |
|-----------|--------|
| Feed media grid (mobile) | `PostMediaGrid.tsx` — Image-only, `TouchableOpacity` with `onPress` |
| Feed media grid (web) | `FeedMediaImage.tsx` — Next.js `<Image>`, no video |
| Image picker (mobile) | `expo-image-picker` — returns single URI, no Live Photo pair |
| Upload pipeline | S3 + multer, supports video/* MIME (MOV/MP4 up to 100MB) |
| DB schema | `media_urls[]`, `media_types[]`, `media_thumbnails[]` — no Live Photo URL column |
| Video player library | **None installed** (no expo-av, expo-video, react-native-video) |
| Haptics | **Not installed** (no expo-haptics) |

---

## Phase 1: Video Playback Foundation (Prerequisite)
**Effort: 3-4 days | Priority: MUST DO FIRST**

This is the biggest blocker and also the most reusable piece — it unlocks video posts in general, not just Live Photos.

### 1A. Install video playback libraries

**Mobile:**
- Install `expo-av` (mature, well-supported, handles both audio/video)
- Install `expo-haptics` (for the tactile feedback on long-press)
- Update `app.json` / EAS config if needed for native modules

**Web:**
- No extra library needed — HTML5 `<video>` element is sufficient
- Will wrap in a custom component for consistency

### 1B. Create `<VideoPlayer>` components

**Mobile** — `frontend/apps/mobile/src/components/media/VideoPlayer.tsx`
- Thin wrapper around `expo-av`'s `<Video>` component
- Props: `uri`, `posterUri`, `shouldPlay`, `isLooping`, `isMuted`, `style`
- Handles loading states (poster image shown until buffered)

**Web** — `frontend/apps/web/src/components/media/VideoPlayer.tsx`
- Wrapper around `<video>` element
- Same prop interface for consistency
- Preload: `metadata` by default, `auto` when activated

---

## Phase 2: Database & API Layer
**Effort: 1-2 days**

### 2A. Database migration — `media_live_urls` column

New migration: `supabase/migrations/YYYYMMDD_post_media_live_urls.sql`

```sql
ALTER TABLE "public"."Post"
  ADD COLUMN IF NOT EXISTS "media_live_urls" text[];
```

**Design rationale:**
`media_live_urls` is a parallel array to `media_urls`. For index `i`:
- `media_urls[i]` = the still image URL (always present)
- `media_live_urls[i]` = the companion MOV/MP4 URL (null/empty if not a Live Photo)
- `media_types[i]` = `'live_photo'` when a Live Photo, otherwise `'image'` or `'video'`

This keeps the existing feed queries working unchanged — they already render `media_urls` as images. Live Photo logic is purely additive.

### 2B. Update Post type

In `frontend/packages/types/src/post.ts`, add to `Post` interface:
```ts
media_live_urls?: string[];
```

### 2C. Update backend post creation

In `backend/routes/posts.js`:
- Accept `mediaLiveUrls: string[]` in the Joi schema
- Store into `media_live_urls` column
- Accept `'live_photo'` as a valid `media_types` value
- Return `media_live_urls` in feed queries and `normalizeMediaUrls()` helper

### 2D. Update feed database functions

In `schema.sql` / feed query functions:
- Include `media_live_urls` in SELECT for `get_neighborhood_feed()` and related feed queries
- No index needed (array column, not queried/filtered)

---

## Phase 3: Upload Pipeline — Live Photo Pair Upload
**Effort: 2-3 days**

### 3A. New upload endpoint (or extend existing)

`POST /api/upload/live-photo` (or extend `/api/upload/media`)

- Accepts **two files per Live Photo slot**: one image + one MOV/MP4
- Backend validates:
  - Image: JPEG/HEIC/PNG (≤ 10MB)
  - Video: MOV/MP4 (≤ 15MB — Live Photos are only ~1.5-3s, so small)
- Both uploaded to S3 with linked keys:
  ```
  posts/{userId}/{uuid}.jpg       ← still
  posts/{userId}/{uuid}_live.mov  ← companion video
  ```
- Returns: `{ imageUrl, liveVideoUrl, thumbnailUrl }`

### 3B. Video transcoding (optional, recommended)

- MOV from iPhone → transcode to MP4 (H.264) for web compatibility
- Can use `ffmpeg` on server or defer to AWS MediaConvert / Lambda
- **MVP approach:** Accept MOV as-is for mobile; for web, Safari handles MOV natively, Chrome needs MP4
- **Post-MVP:** Add an async transcoding step that produces an MP4 variant

### 3C. Thumbnail generation for video

- Extract first frame from MOV as a still thumbnail (using `ffmpeg` or sharp on the image)
- For Live Photos, the still image IS the thumbnail, so this is already handled
- Store in `media_thumbnails[i]`

---

## Phase 4: Media Picker — Detecting & Extracting Live Photos
**Effort: 3-4 days (hardest mobile-native piece)**

### 4A. Mobile — Detect Live Photos in picker

**Option A (Recommended): `expo-media-library`**
- Already available in Expo ecosystem
- Use `MediaLibrary.getAssetInfoAsync(asset)` to check `mediaSubtypes`
- If `mediaSubtypes` includes `'livePhoto'`, it's a Live Photo
- Extract both files:
  - Still: `asset.uri` (the image)
  - Video: Use `MediaLibrary.getAssetInfoAsync()` → `localUri` for the paired MOV
- **Limitation:** May need Expo config plugin for `PHAsset` access

**Option B: Native module (fallback)**
- Use `react-native-live-photo` or custom Expo config plugin
- Direct access to `PHLivePhoto` APIs
- More reliable extraction but requires native build

**Recommended approach:** Start with Option A. If `expo-media-library` can't reliably extract the MOV companion, fall back to a custom config plugin.

### 4B. Mobile — Update `PostComposerModal`

- After picking an image, check if it's a Live Photo
- If yes, show a "LIVE" badge on the thumbnail in the composer
- Upload both files (still + MOV) when posting
- Store result in `mediaLiveUrls[i]`

### 4C. Web — Live Photo upload from file input

- Web browsers don't expose Live Photo pairs from `<input type="file">`
- **Two options:**
  1. User manually uploads both files (still + video) — poor UX
  2. Accept `.livp` files (Live Photo bundles) and unpack on server — technically possible but rare
- **MVP:** Web users can view Live Photos but can only create them from mobile
- **Post-MVP:** Allow manual pairing (upload image + short video clip)

---

## Phase 5: Feed Display — Live Photo Playback
**Effort: 4-5 days (most user-facing work)**

### 5A. Mobile — `<LivePhotoMedia>` component

New component: `frontend/apps/mobile/src/components/media/LivePhotoMedia.tsx`

**Behavior:**
1. Default: Show still image (same as current)
2. Show a small "LIVE" badge in the corner (like Apple)
3. On long-press (300ms delay):
   - Trigger `expo-haptics` impact feedback (medium)
   - Crossfade from still image to video (150ms opacity transition)
   - Play video from beginning, unmuted
   - Slight "zoom-in" animation (scale 1.0 → 1.05, like iOS)
4. On release:
   - Pause video
   - Crossfade back to still image
   - Scale back to 1.0
5. On regular tap: Open full-screen media viewer (existing behavior)

**Implementation:**
```
<Pressable onLongPress={startLivePlayback} onPressOut={stopLivePlayback} onPress={openViewer}>
  <Image source={{ uri: stillUrl }} /> {/* Always mounted, controls opacity */}
  <Video ref={videoRef} source={{ uri: liveVideoUrl }} />  {/* Layered on top */}
</Pressable>
```

### 5B. Web — `<LivePhotoMedia>` component

New component: `frontend/apps/web/src/components/media/LivePhotoMedia.tsx`

**Behavior:**
1. Default: Show still image
2. "LIVE" badge in corner
3. On hover (desktop) or long-press (touch):
   - Crossfade to `<video>` element
   - Autoplay, muted (browser autoplay policy)
   - Optional: unmute on click
4. On mouse leave / press release:
   - Pause and crossfade back to still

**Implementation:**
- Use CSS transitions for crossfade (`opacity`, `transform`)
- Preload video on hover start (set `preload="auto"`)
- `<video>` with `playsInline`, `muted`, `loop`

### 5C. Update `PostMediaGrid` (mobile)

In `PostMediaGrid.tsx`:
- Accept `mediaLiveUrls?: string[]` and `mediaTypes?: string[]` props
- For each media item at index `i`:
  - If `mediaTypes[i] === 'live_photo'` AND `mediaLiveUrls[i]` exists → render `<LivePhotoMedia>`
  - Otherwise → render current `<Image>` as-is
- Pass through `onPress` for the full-screen viewer

### 5D. Update `PostCard` web grid

In web `PostCard.tsx`:
- Check `post.media_types[i]` for `'live_photo'`
- Render `<LivePhotoMedia>` instead of `<FeedMediaImage>` when applicable

### 5E. Full-screen media viewer

- Update the full-screen image viewer (opened on tap) to support Live Photo playback
- Show "LIVE" badge
- Long-press plays the video overlay
- This is an enhancement to the existing viewer — **defer to post-MVP** if needed

---

## Phase 6: Polish & Edge Cases
**Effort: 2-3 days**

### 6A. "LIVE" badge component
- Small pill badge: white text on semi-transparent dark background
- Positioned top-left of the media cell
- Shows a small concentric-circle icon (like Apple's Live Photo indicator)
- Animates (pulse) briefly when video is playing

### 6B. Feed performance
- **Preloading:** Do NOT preload Live Photo videos in the feed — only load when user long-presses
- **Memory:** Unload video when cell scrolls off-screen (use `onViewableItemsChanged` on FlatList)
- **Caching:** `expo-av` handles caching; for web, rely on browser cache
- **Bandwidth:** Live Photo MOVs are small (2-5MB), but still only load on demand

### 6C. Backward compatibility
- Old clients that don't understand `media_live_urls` will show the still image (graceful degradation)
- `media_urls[i]` always contains the still — nothing breaks

### 6D. Android support
- Android doesn't have native Live Photos, but Google Pixel has "Motion Photos" (similar concept)
- **MVP:** Android users can VIEW Live Photos posted by iPhone users (long-press plays the video)
- **Post-MVP:** Detect Motion Photos from Android gallery and extract the embedded video

---

## Implementation Order (Recommended)

| Step | Phase | What | Est. Days |
|------|-------|------|-----------|
| 1 | 1A | Install `expo-av`, `expo-haptics` | 0.5 |
| 2 | 1B | Create `<VideoPlayer>` wrapper components | 1 |
| 3 | 2A-2D | DB migration + API changes + types | 1.5 |
| 4 | 3A | Upload endpoint for Live Photo pairs | 1.5 |
| 5 | 5A | Mobile `<LivePhotoMedia>` component | 2 |
| 6 | 5B | Web `<LivePhotoMedia>` component | 1.5 |
| 7 | 5C-5D | Update feed grids (both platforms) | 1 |
| 8 | 4A-4B | Mobile picker: detect & extract Live Photos | 3 |
| 9 | 6 | Polish, badges, performance, edge cases | 2 |
| | | **Total** | **~14 days** |

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| `expo-media-library` can't extract MOV from Live Photos | High — blocks capture | Fall back to Expo config plugin or native module |
| MOV not playable on Chrome/Android | Medium — affects web/Android display | Transcode to MP4 on upload (ffmpeg) |
| Video preloading hurts feed scroll perf | Medium — poor UX | Lazy-load only on long-press; unload off-screen |
| Large MOV files slow upload | Low — Live Photos are 2-5MB | Already within 100MB limit; compress if needed |
| No haptics on Android | Low — UX difference | Use `Vibration` API as fallback |

---

## MVP Scope (Minimum Viable)

For a first release, I'd recommend:

1. **Install expo-av + expo-haptics** (Phase 1)
2. **DB + API for `media_live_urls`** (Phase 2)
3. **Upload endpoint accepting paired files** (Phase 3A)
4. **Mobile `<LivePhotoMedia>` display component** (Phase 5A)
5. **Web `<LivePhotoMedia>` display component** (Phase 5B)
6. **Update feed grids** (Phase 5C-5D)

This gives you the display infrastructure. The picker (Phase 4) can follow — initially, you can test with manually uploaded Live Photo pairs.

---

## Files That Will Be Created/Modified

### New Files
- `supabase/migrations/YYYYMMDD_post_media_live_urls.sql`
- `frontend/apps/mobile/src/components/media/VideoPlayer.tsx`
- `frontend/apps/mobile/src/components/media/LivePhotoMedia.tsx`
- `frontend/apps/mobile/src/components/media/LivePhotoBadge.tsx`
- `frontend/apps/web/src/components/media/VideoPlayer.tsx`
- `frontend/apps/web/src/components/media/LivePhotoMedia.tsx`
- `frontend/apps/web/src/components/media/LivePhotoBadge.tsx`

### Modified Files
- `frontend/apps/mobile/package.json` — add expo-av, expo-haptics
- `frontend/packages/types/src/post.ts` — add `media_live_urls` to `Post`
- `backend/routes/posts.js` — accept/return `media_live_urls`, add `'live_photo'` type
- `backend/routes/upload.js` — live photo pair upload endpoint (or new route file)
- `frontend/apps/mobile/src/components/feed/PostMediaGrid.tsx` — render LivePhotoMedia
- `frontend/apps/mobile/src/components/feed/PostCard.tsx` — pass live photo props
- `frontend/apps/web/src/components/feed/PostCard.tsx` — render LivePhotoMedia
- `frontend/apps/mobile/src/components/feed/PostComposerModal.tsx` — Live Photo picker
- `frontend/apps/web/src/components/feed/composer/MediaUpload.tsx` — (post-MVP)
- `backend/database/schema.sql` — updated Post table definition
