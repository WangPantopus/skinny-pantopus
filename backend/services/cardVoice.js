/**
 * A card's voice greeting as the server checks it (memories contract section 3; the founder chose no converter on
 * November 3, after the voice test): one AAC-LC sound track in an ordinary or fragmented MP4 (what the iPhone and Android
 * recorders and Chrome and Safari's MediaRecorder make), read from the file's own boxes, never its declared type. WebM,
 * Ogg, MP3, video and anything damaged are refused. Its length comes from the boxes too, adding a fragmented file's
 * sample durations (browsers leave the top-level duration empty), and is what the apps show (`duration_ms`).
 *
 * Stored as it came, except that metadata boxes (udta, meta: an encoder's tags, a phone's place or date) are blanked in
 * place: renamed `free` with their bytes zeroed, so every size and offset stays and every player skips them.
 */

const MAX_MS = 60 * 1000;
// A recorder stopped at 60 s can end on the next AAC frame (about 23 ms) or two.
const TOLERANCE_MS = 500;

const unreadable = (detail) => Object.assign(new Error('We couldn’t read this recording. Record it again.'),
  { status: 415, code: 'CARD_VOICE_UNREADABLE', refusal: true, detail });
const tooLong = () => Object.assign(new Error('Keep your greeting to 60 seconds.'),
  { status: 413, code: 'CARD_VOICE_TOO_LONG', refusal: true });

/** The boxes between `start` and `end`, each { type, at, body, end }; `whole` false when a box is damaged. */
function boxes(buffer, start, end) {
  const found = [];
  let at = start;
  while (at + 8 <= end) {
    let size = buffer.readUInt32BE(at);
    const type = buffer.toString('latin1', at + 4, at + 8);
    let body = at + 8;
    if (size === 1) {
      if (at + 16 > end) break;
      const large = buffer.readBigUInt64BE(at + 8);
      if (large > BigInt(Number.MAX_SAFE_INTEGER)) break;
      size = Number(large);
      body = at + 16;
    } else if (size === 0) {
      size = end - at;
    }
    if (size < body - at || at + size > end) break;
    found.push({ type, at, body, end: at + size });
    at += size;
  }
  return { list: found, whole: at === end };
}
const kids = (buffer, box) => boxes(buffer, box.body, box.end).list;
const kid = (buffer, box, type) => (box ? kids(buffer, box).find((b) => b.type === type) || null : null);

/** A descriptor's length (ISO 14496-1: up to four bytes, seven bits each). */
function descriptorLength(buffer, at, end) {
  let length = 0;
  for (let i = 0; i < 4 && at < end; i += 1) {
    const byte = buffer[at];
    at += 1;
    length = (length << 7) | (byte & 0x7f);
    if (!(byte & 0x80)) return { length, at };
  }
  return null;
}

/** Whether an esds box describes AAC-LC (MPEG-4 audio object type 2, or MPEG-2 AAC LC). */
function isAacLc(buffer, esds) {
  let at = esds.body + 4; // version and flags
  const end = esds.end;
  if (buffer[at] !== 0x03) return false;
  let d = descriptorLength(buffer, at + 1, end);
  if (!d) return false;
  at = d.at + 2; // ES_ID
  const flags = buffer[at];
  at += 1;
  if (flags & 0x80) at += 2; // streamDependenceFlag
  if (flags & 0x40) at += 1 + buffer[at]; // URL_Flag
  if (flags & 0x20) at += 2; // OCRstreamFlag
  if (buffer[at] !== 0x04) return false;
  d = descriptorLength(buffer, at + 1, end);
  if (!d) return false;
  at = d.at;
  const objectType = buffer[at];
  if (objectType === 0x67) return true; // MPEG-2 AAC LC
  if (objectType !== 0x40) return false;
  at += 13; // objectTypeIndication, streamType, bufferSizeDB (3), maxBitrate (4), avgBitrate (4)
  if (buffer[at] !== 0x05) return false;
  d = descriptorLength(buffer, at + 1, end);
  if (!d || d.at >= end) return false;
  return (buffer[d.at] >> 3) === 2; // audioObjectType 2: AAC-LC
}

/** The sound track's sample entry (mp4a) and its AAC check. */
function soundEntry(buffer, stsd) {
  const first = boxes(buffer, stsd.body + 8, stsd.end).list[0]; // version/flags and entry count
  if (!first || first.type !== 'mp4a' || first.end - first.body < 28) return null;
  const version = buffer.readUInt16BE(first.body + 8);
  const childrenAt = first.body + 28 + (version === 1 ? 16 : version === 2 ? 36 : 0);
  const children = boxes(buffer, childrenAt, first.end).list;
  const wave = children.find((b) => b.type === 'wave'); // QuickTime keeps it one level down
  const esds = children.find((b) => b.type === 'esds') || (wave ? kid(buffer, wave, 'esds') : null);
  return { esds, channels: buffer.readUInt16BE(first.body + 16), sampleRate: buffer.readUInt32BE(first.body + 24) >>> 16 };
}

/** Sum of an stts box's sample durations. */
function sttsTotal(buffer, stts) {
  if (!stts) return 0;
  const count = buffer.readUInt32BE(stts.body + 4);
  let total = 0;
  for (let i = 0, at = stts.body + 8; i < count && at + 8 <= stts.end; i += 1, at += 8) {
    total += buffer.readUInt32BE(at) * buffer.readUInt32BE(at + 4);
  }
  return total;
}

/** Sum of the sample durations in every fragment (moof/traf/trun) of track `trackId`. */
function fragmentsTotal(buffer, top, trackId, trexDefault) {
  let total = 0;
  for (const moof of top.filter((b) => b.type === 'moof')) {
    for (const traf of kids(buffer, moof).filter((b) => b.type === 'traf')) {
      const tfhd = kid(buffer, traf, 'tfhd');
      if (!tfhd || buffer.readUInt32BE(tfhd.body + 4) !== trackId) continue;
      const tfFlags = buffer.readUInt32BE(tfhd.body) & 0xffffff;
      let at = tfhd.body + 8;
      if (tfFlags & 0x01) at += 8;
      if (tfFlags & 0x02) at += 4;
      const defaultDuration = tfFlags & 0x08 ? buffer.readUInt32BE(at) : trexDefault;
      for (const trun of kids(buffer, traf).filter((b) => b.type === 'trun')) {
        const flags = buffer.readUInt32BE(trun.body) & 0xffffff;
        const count = buffer.readUInt32BE(trun.body + 4);
        let p = trun.body + 8;
        if (flags & 0x001) p += 4;
        if (flags & 0x004) p += 4;
        const each = ((flags & 0x100) ? 4 : 0) + ((flags & 0x200) ? 4 : 0) + ((flags & 0x400) ? 4 : 0) + ((flags & 0x800) ? 4 : 0);
        if (p + count * each > trun.end) throw unreadable('short trun');
        for (let i = 0; i < count; i += 1, p += each) total += (flags & 0x100) ? buffer.readUInt32BE(p) : defaultDuration;
      }
    }
  }
  return total;
}

/** Blanks every udta and meta box under `box` (and below its tracks): renamed free, bytes zeroed. Answers how many. */
function blankMetadata(buffer, box) {
  let blanked = 0;
  for (const child of kids(buffer, box)) {
    if (child.type === 'udta' || child.type === 'meta') {
      buffer.write('free', child.at + 4, 'latin1');
      buffer.fill(0, child.body, child.end);
      blanked += 1;
    } else if (['trak', 'mdia', 'minf'].includes(child.type)) {
      blanked += blankMetadata(buffer, child);
    }
  }
  return blanked;
}

/**
 * Checks a voice greeting in place (blanking its metadata boxes): { durationMs, channels, sampleRate }. Throws
 * CARD_VOICE_UNREADABLE (not one AAC-LC track in an MP4, or damaged) or CARD_VOICE_TOO_LONG (over 60 seconds).
 */
function checkVoice(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 32) throw unreadable('too short');
  const top = boxes(buffer, 0, buffer.length);
  if (!top.whole || top.list[0]?.type !== 'ftyp') throw unreadable('not an MP4');
  const moov = top.list.find((b) => b.type === 'moov');
  if (!moov || !top.list.some((b) => b.type === 'mdat')) throw unreadable('no movie');
  const tracks = kids(buffer, moov).filter((b) => b.type === 'trak');
  if (tracks.length !== 1) throw unreadable('not one track');
  const [trak] = tracks;
  const mdia = kid(buffer, trak, 'mdia');
  const hdlr = kid(buffer, mdia, 'hdlr');
  if (!hdlr || buffer.toString('latin1', hdlr.body + 8, hdlr.body + 12) !== 'soun') throw unreadable('not sound');
  const mdhd = kid(buffer, mdia, 'mdhd');
  const tkhd = kid(buffer, trak, 'tkhd');
  const stbl = kid(buffer, kid(buffer, mdia, 'minf'), 'stbl');
  const stsd = kid(buffer, stbl, 'stsd');
  if (!mdhd || !tkhd || !stsd) throw unreadable('no track header');
  const entry = soundEntry(buffer, stsd);
  if (!entry?.esds || !isAacLc(buffer, entry.esds)) throw unreadable('not AAC-LC');
  const v1 = buffer[mdhd.body] === 1;
  const timescale = buffer.readUInt32BE(mdhd.body + (v1 ? 20 : 12));
  if (!timescale) throw unreadable('no timescale');
  const trackId = buffer.readUInt32BE(tkhd.body + (buffer[tkhd.body] === 1 ? 20 : 12));
  const mvex = kid(buffer, moov, 'mvex');
  let units = sttsTotal(buffer, kid(buffer, stbl, 'stts'));
  if (mvex) {
    const trex = kids(buffer, mvex).find((b) => b.type === 'trex' && buffer.readUInt32BE(b.body + 4) === trackId);
    units += fragmentsTotal(buffer, top.list, trackId, trex ? buffer.readUInt32BE(trex.body + 12) : 0);
  }
  if (!units) {
    // An ordinary file with no sample table times: the track's own duration.
    units = v1 ? Number(buffer.readBigUInt64BE(mdhd.body + 24)) : buffer.readUInt32BE(mdhd.body + 16);
  }
  const durationMs = Math.round((units / timescale) * 1000);
  if (!durationMs) throw unreadable('empty');
  if (durationMs > MAX_MS + TOLERANCE_MS) throw tooLong();
  blankMetadata(buffer, moov);
  for (const box of top.list.filter((b) => b.type === 'udta' || b.type === 'meta')) {
    buffer.write('free', box.at + 4, 'latin1');
    buffer.fill(0, box.body, box.end);
  }
  return { durationMs, channels: entry.channels, sampleRate: entry.sampleRate };
}

module.exports = { checkVoice, MAX_MS, TOLERANCE_MS };
