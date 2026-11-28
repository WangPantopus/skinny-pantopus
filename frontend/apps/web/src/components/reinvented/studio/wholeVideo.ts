// See the picture first (PHASE-5 A; coord/CONTRACT.md 10c), for a video. A video keeps its own file and goes up with its
// `placement` on the canvas; it is only made again here when something must be drawn into it (words or drawing: the
// 9:16 canvas, its backdrop, the video placed on it, the marks over it) or when the author trimmed it. What comes out is
// handed, untouched, to today's upload path (momentMedia's prepareMedia with an untouched picture), which splits a long
// video into parts and makes its stills as it does today.

import type { VideoLimits } from '@pantopus/api/endpoints/moments';
import { canvasOf, paintOverlay, type Artwork } from '@/components/moments/momentArtwork';
import { paintPicture, type Backdrop } from './whole';

/** The part of a video to keep, in seconds from its first frame. */
export interface Trim {
  from: number;
  to: number;
}

/**
 * `file` made again: trimmed to `trim` (when given), and with `drawn` (when given) drawn as the 9:16 canvas, 720 x 1280
 * as today's drawn videos are, the video placed on its backdrop and the words and drawing over it.
 */
export async function composeVideo(
  file: File,
  opts: {
    drawn?: { art: Artwork; backdrop: Backdrop | null } | null;
    trim?: Trim | null;
    limits: VideoLimits;
    signal: AbortSignal;
    progress(fraction: number): void;
  },
): Promise<File> {
  opts.signal.throwIfAborted();
  const mb = await import('mediabunny');
  const input = new mb.Input({ formats: mb.ALL_FORMATS, source: new mb.BlobSource(file) });
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new Error('Choose a file with a video track.');
    const start = await input.getFirstTimestamp();
    const length = (await input.computeDuration()) - start;
    if (!Number.isFinite(length) || length <= 0) throw new Error('This video has no readable duration.');
    const from = opts.trim ? Math.max(0, Math.min(opts.trim.from, length)) : 0,
      to = opts.trim ? Math.max(from, Math.min(opts.trim.to, length)) : length;
    if (to - from <= 0.05) throw new Error('Keep a longer part of this video.');
    const sw = await track.getDisplayWidth(),
      sh = await track.getDisplayHeight();
    const drawn = opts.drawn;
    const source = drawn ? canvasOf(sw, sh) : null,
      output = drawn ? canvasOf(720, 1280) : null;
    const target = new mb.BufferTarget(),
      writer = new mb.Output({ format: new mb.Mp4OutputFormat({ fastStart: 'in-memory' }), target });
    const conversion = await mb.Conversion.init({
      input,
      output: writer,
      tracks: 'primary',
      tags: {},
      showWarnings: false,
      ...(opts.trim ? { trim: { start: start + from, end: start + to } } : {}),
      video: {
        codec: 'avc',
        // As today's drawn videos: about six-eighths of what fills the size limit over the part's length, at most 4 Mbit/s.
        bitrate: Math.min(4_000_000, Math.floor((opts.limits.max_bytes * 6) / Math.min(to - from, opts.limits.max_seconds))),
        ...(drawn && source && output
          ? {
              width: Math.min(1280, sw),
              forceTranscode: true,
              processedWidth: 720,
              processedHeight: 1280,
              process: (sample: InstanceType<typeof mb.VideoSample>) => {
                sample.drawWithFit(source.ctx, { fit: 'contain' });
                paintPicture(output.ctx, source.canvas, sw, sh, drawn.art, drawn.backdrop);
                paintOverlay(output.ctx, drawn.art);
                return output.canvas;
              },
            }
          : {}),
      },
      audio: { codec: 'aac' },
    });
    if (
      !conversion.isValid ||
      conversion.discardedTracks.some((t) => t.track.type === 'audio' || t.track.type === 'video')
    )
      throw new Error(
        'This browser cannot export this video with its sound. Try an H.264 MP4 with AAC audio, or use another browser.',
      );
    conversion.onProgress = (f) => opts.progress(f);
    const cancel = () => {
      void conversion.cancel().catch(() => {});
    };
    opts.signal.addEventListener('abort', cancel, { once: true });
    try {
      opts.signal.throwIfAborted();
      await conversion.execute();
    } finally {
      opts.signal.removeEventListener('abort', cancel);
    }
    if (!target.buffer) throw new Error('The video could not be exported.');
    return new File([target.buffer], (file.name.replace(/\.[^.]+$/, '') || 'video') + '.mp4', { type: 'video/mp4' });
  } finally {
    input.dispose();
  }
}
