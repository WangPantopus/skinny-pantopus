# Christmas card voice test

November 2–3, 2026 · run alongside step 1 of the [implementation plan](christmas-card-memories-plan-2026-11-02.md) · contract: [section 3](christmas-card-memories-contract-2026-11-02.md#3-media-sizes)

The plan ships voice only if every recorder can make one format that every reader plays. This test recorded a real greeting with each of the four recorders, played every recording to its end on each of the four readers, and wrote down what came out.

**Result:**
- All four recorders make AAC-LC in MP4, the plan's stored form.
- All four readers play every one of those recordings to the end.
- No converter is needed.

Two details shape how voice is built: the browsers write *fragmented* MP4, and the iPhone can't play WebM at all.

## How it was run

- **Sound.** A spoken greeting from the Mac's speakers, picked up by its real microphone (a Logitech MX Brio camera). Each file's loudness was measured (`ffmpeg volumedetect`) to show it holds sound.
- **Recorders.**
  - Chrome 156 and Safari 27.0.1 on the Mac use `MediaRecorder`, asking for `audio/mp4;codecs=mp4a.40.2` first.
  - The iPhone simulator (iOS 27) uses `AVAudioRecorder`, and the Android emulator (Android 14) uses `MediaRecorder`, both at the plan's settings: AAC, M4A, mono, 44.1 kHz, 48 kbps.
  - The apps have no recorder yet, so the phone recordings came from two small throwaway test apps using those same system recorders. They are kit `streams/CMR/voice`, never merged.
- **Readers.**
  - Chrome and desktop Safari: an `<audio>` element, plus a Web Audio decode.
  - The iPhone: `AVPlayer` streaming, plus `AVAudioPlayer` on the downloaded file, as an account-scoped cache would play it.
  - Android: Media3 ExoPlayer (the app's own player), plus `MediaPlayer`.
  - Each clip played muted to its end; the test checked how far it got and how long that took.
- **Files.** Each was inspected with `ffprobe`, and its MP4 boxes were listed.

## What each recorder made

| Recorder | Format | Container | Sound |
| --- | --- | --- | --- |
| Chrome 156, Mac | AAC-LC, 48 kHz, mono, about 49 kbps (7.7 s, 52 KB) | **Fragmented MP4**: one fragment per second with a one-second timeslice, one fragment without one | Speech, peak −13.8 dB |
| Safari 27.0.1, Mac | AAC-LC, 48 kHz, mono, about 51 kbps (7.4 s, 50 KB) | **Fragmented MP4**, one fragment per second | Speech, quieter, peak −28.8 dB |
| iPhone app (`AVAudioRecorder`) | AAC-LC, 44.1 kHz, mono, about 46 kbps (8.3 s) | Ordinary MP4, with a 55 KB padding box (105 KB in all) | Sound, peak −28.1 dB |
| Android app (`MediaRecorder`) | AAC-LC, 44.1 kHz, mono, 48 kbps (8.0 s, 51 KB) | Ordinary MP4 | **Silence**: the emulator got no microphone input (below) |

Also recorded, as contrasts:
- Chrome forced to WebM makes Opus in WebM, with no duration in the file.
- Safari in the iPhone simulator recorded nothing: 0 bytes for MP4 and for WebM. `MediaRecorder` doesn't work in the simulator, while the native recorder on the same simulator heard the microphone.

## What each reader played

Every AAC recording played to its end on every reader. Only the reported length differed:

| File | Chrome | Safari | iPhone (AVPlayer and AVAudioPlayer) | Android (ExoPlayer and MediaPlayer) |
| --- | --- | --- | --- | --- |
| Chrome, one-second fragments | Plays, 7.7 s | Plays, 7.7 s | Plays, 7.7 s | Plays all 7.7 s, but reports its length as **1.0 s** (ExoPlayer) and **0.02 s** (MediaPlayer) |
| Chrome, one fragment | Plays | Plays | Plays | Plays, 7.7 s reported |
| Chrome, remuxed into an ordinary MP4 (no re-encoding) | Plays | Plays | Plays | Plays, 7.7 s reported |
| Safari, one-second fragments | Plays, 7.4 s | Plays, 7.3 s | Plays, 7.3 s | Plays, 7.3 s (ExoPlayer); MediaPlayer reports no length and plays all of it |
| iPhone app | Plays, 8.3 s | Plays, 8.2 s | Plays, 8.2 s | Plays, 8.3 s |
| Android app | Plays, 8.0 s | Plays, 8.0 s | Plays, 8.0 s | Plays, 8.0 s |
| Chrome WebM (contrast) | Plays | Plays | **Doesn't open** (AVPlayer "Cannot Open"; AVAudioPlayer unsupported file type) | Plays; MediaPlayer reports no length |

## What this means

- **One format works everywhere: AAC-LC in MP4.** The iPhone app and Android record it natively, and both browsers record it when asked. No converter is needed for these four.
- **Never store WebM.** The iPhone can't play it, so a browser that only records WebM or Ogg (Firefox) can't be used to record.
- **Don't trust a player's reported length.** Browser files are fragmented, and Android's players misreport the length of Chrome's chunked recording, although they play all of it. The server already returns `duration_ms` with each voice clip (contract section 2), and the apps should show that.
- **Record in one piece on the web.** Call `MediaRecorder.start()` with no timeslice. Chrome's one-fragment file is read correctly everywhere.
- **The server must read fragmented MP4** to check the 60-second limit: add the fragments' sample durations, since the top-level duration can be empty. It's a few dozen lines of box parsing, or a small library.
- **Size.** The iPhone recorder adds a fixed 55 KB padding box per file. That's about 15% on a 60-second clip, which stays well under the plan's 5 MiB input limit. A remux would drop it.

## Options

**The founder chose option 1, no converter, on November 3.** The other options are kept here for the record; option 2 stays the fallback if real phones show a problem.

1. **No converter (chosen).**
   - The server checks that each upload is AAC-LC in MP4, at most 60 seconds and 5 MiB, by reading its boxes, and stores it as it came.
   - The web records in one piece.
   - The apps show the server's `duration_ms`.
   - Record shows only where the browser says it can make AAC in MP4 (`MediaRecorder.isTypeSupported`): Chrome and Safari in this test. Firefox users can play voices but not record them.
   - **Cost:** the box check and the web rule. Nothing new goes in the backend image.
2. **A remux on the server.** As option 1, but each upload is rewritten into one ordinary MP4: fragments joined, padding dropped, playable from the start. It's a container rewrite with no re-encoding, so there's no quality loss and little processor time.
   - **Cost:** an MP4 remuxer in the backend, either a JavaScript library or ffmpeg pinned in the image.
   - It's worth adding only if real phones show a problem with browser files that the reported-length fix doesn't cover.
3. **A converter on the server.** ffmpeg in the backend image re-encodes anything, including Firefox's Opus, into AAC-LC M4A at 48 kbps, so every browser can record.
   - **Cost:** a native binary to keep patched and a bigger image.
   - Each upload takes processor time, and the plan's limits on size, duration, time and concurrency apply.
   - It also adds a second place where quality can go wrong.
4. **Voice off this season.** Not needed on this result. It stays the fallback if step 7 runs out of time before the ~December 1 store builds.

## Not tested here

- **Real phones.** Neither phone microphone and neither phone speaker was tested: the iPhone recording came from the simulator, and the Android recording from the emulator.
- **Real sound from the Android emulator.** Its recording was silent because the emulator got no input from the Mac's microphone (macOS microphone access for the emulator). The format is right, and every reader played the file, but a real Android phone should be checked before switch-on.
- **Safari on a real iPhone.** The simulator's Safari can't record at all.
- **Other browsers.** Chrome on Android, Edge and Firefox weren't run. Firefox can't record AAC, as noted above.
- **Interruptions.** A phone call or a backgrounded app mid-recording belongs to the step 7 checks.
