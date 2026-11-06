/**
 * Videos are stored without their location, camera or title tags, and without re-encoding: the picture and sound stay
 * the same bytes in the same places. The capture time in the movie and track headers stays too.
 *
 * Metadata is overwritten where it sits. A box of it becomes an empty box of the same length under the container's own
 * name for unused space (`free` in MP4 and MOV, `JUNK` in AVI, `Void` in WebM), so nothing moves and every sample
 * offset stays valid. Each container keeps what playing needs, listed below; everything else in it goes, so a tag we've
 * never heard of goes too. Tracks other than picture, sound and timecode go as well, with their samples zeroed: action
 * cameras, drones and dashcams write GPS there. A file that can't be walked this way is refused (UnreadableVideoError).
 *
 * The walk reads only headers and the metadata itself, through `read(position, length)`, and plans its edits before any
 * is made, so the same code cleans a buffer or a file on disk, and reports on a stored object without downloading it.
 */
const fsp = require('node:fs/promises');

class UnreadableVideoError extends Error {}

const unreadable = (reason) => new UnreadableVideoError(reason);

// What one file may make us do. Honest videos stay far below these; a crafted one could otherwise fill memory and hold
// the event loop. A data track has at most a chunk per frame, and a video under the size limit is minutes long.
const MAX_BOXES = 1000 * 1000;
const MAX_EDITS = 300 * 1000;
const MAX_CHUNKS = 200 * 1000;
const MAX_OPEN_CLUSTER_ELEMENTS = 2 * 1000 * 1000;

class Plan {
  constructor(size) {
    this.size = size;
    this.edits = [];
    this.boxes = 0;
  }

  count() {
    this.boxes += 1;
    if (this.boxes > MAX_BOXES) throw unreadable('Too many boxes');
  }

  add(edit) {
    if (this.edits.length >= MAX_EDITS) throw unreadable('Too many edits');
    this.edits.push(edit);
  }

  write(at, bytes) {
    this.add({ at, bytes });
  }

  zero(at, end, samples = false) {
    if (end > at) this.add({ at, length: end - at, samples });
  }
}

// ============ MP4 AND MOV ============

// What stays in each box we look inside. Their children are looked at in turn; anything not listed is metadata.
const KEEPS = {
  moov: new Set(['mvhd', 'trak', 'mvex', 'iods', 'pssh', 'clip', 'ctab']),
  trak: new Set(['tkhd', 'tapt', 'clip', 'matt', 'edts', 'tref', 'txas', 'load', 'imap', 'mdia', 'trgr']),
  mdia: new Set(['mdhd', 'elng', 'hdlr', 'minf']),
  minf: new Set(['vmhd', 'smhd', 'hmhd', 'nmhd', 'sthd', 'gmhd', 'hdlr', 'dinf', 'stbl']),
};
const TOP_LEVEL_KEEPS = new Set(['ftyp', 'styp', 'moov', 'mdat', 'moof', 'mfra', 'sidx', 'ssix', 'prft']);
// Unused space keeps its name but not its contents: dashcams write GPS into `free`, and editors leave an old `moov`.
const UNUSED = new Set(['free', 'skip', 'wide']);
const FIRST_BOXES = new Set([...UNUSED, 'ftyp', 'styp', 'moov', 'mdat', 'pnot', 'uuid', 'sidx']);
const SAMPLE_TABLES = new Set(['stco', 'co64', 'stsz', 'stz2', 'stsc']);
const PLAYABLE_TRACKS = new Set(['vide', 'soun']);
const KEPT_TRACKS = new Set([...PLAYABLE_TRACKS, 'auxv', 'pict', 'tmcd']);
// Inside a fragment nothing is listed: its boxes vary by writer, and only these two hold metadata.
const FRAGMENT_METADATA = new Set(['meta', 'udta']);

/** The box at `at`, in a parent ending at `limit`. Its end is clamped to the parent's, as players do; null if bad. */
function readBox(bytes, at, limit) {
  if (limit - at < 8) return null;
  let size = bytes.readUInt32BE(at);
  const type = bytes.toString('latin1', at + 4, at + 8);
  let body = at + 8;
  if (size === 1) {
    if (limit - at < 16) return null;
    const large = bytes.readBigUInt64BE(at + 8);
    if (large > BigInt(Number.MAX_SAFE_INTEGER)) return null;
    size = Number(large);
    body = at + 16;
  } else if (size === 0) {
    size = limit - at; // "to the end of the parent"
  }
  if (size < body - at) return null;
  return { type, start: at, body, end: Math.min(at + size, limit), overruns: at + size > limit };
}

function* childBoxes(bytes, parent) {
  let at = parent.body;
  while (at < parent.end) {
    const box = readBox(bytes, at, parent.end);
    if (!box) {
      // QuickTime may close a box with a few zero bytes. More than that is a damaged file.
      if (parent.end - at >= 8) throw unreadable(`Bad box in ${parent.type}`);
      return;
    }
    yield box;
    at = box.end;
  }
}

function findBox(bytes, parent, path) {
  let box = parent;
  for (const type of path) {
    let found = null;
    for (const child of childBoxes(bytes, box)) {
      if (child.type === type) {
        found = child;
        break;
      }
    }
    if (!found) return null;
    box = found;
  }
  return box;
}

function blankBox(plan, base, box) {
  const header = Buffer.alloc(box.body - box.start);
  const size = box.end - box.start;
  if (header.length === 16) {
    header.writeUInt32BE(1, 0);
    header.writeBigUInt64BE(BigInt(size), 8);
  } else {
    header.writeUInt32BE(size > 0xffffffff ? 0 : size, 0);
  }
  header.write('free', 4, 'latin1');
  plan.write(base + box.start, header);
  plan.zero(base + box.body, base + box.end);
}

/**
 * Where a track's samples are, as [start, end] file positions, one range per chunk. Null if its tables contradict
 * themselves, in which case we can't say the track's data is gone.
 */
function trackChunks(bytes, trak) {
  const stbl = findBox(bytes, trak, ['mdia', 'minf', 'stbl']);
  if (!stbl) return [];
  const tables = {};
  for (const box of childBoxes(bytes, stbl)) {
    if (SAMPLE_TABLES.has(box.type)) tables[box.type] = box;
  }
  const offsets = tables.stco || tables.co64;
  const sizes = tables.stsz || tables.stz2;
  const { stsc } = tables;
  if (!offsets) return [];
  if (!sizes || !stsc) return null;
  if (sizes.end - sizes.body < 12 || stsc.end - stsc.body < 8 || offsets.end - offsets.body < 8) return null;

  const wide = offsets.type === 'co64';
  const chunkCount = bytes.readUInt32BE(offsets.body + 4);
  if (chunkCount > MAX_CHUNKS || offsets.body + 8 + chunkCount * (wide ? 8 : 4) > offsets.end) return null;

  const fixedSize = tables.stsz ? bytes.readUInt32BE(sizes.body + 4) : 0;
  const sampleCount = bytes.readUInt32BE(sizes.body + 8);
  const fieldBits = tables.stz2 ? bytes[sizes.body + 7] : 32;
  if (![4, 8, 16, 32].includes(fieldBits)) return null;
  if (!fixedSize && sizes.body + 12 + Math.ceil((sampleCount * fieldBits) / 8) > sizes.end) return null;
  const sampleSize = (index) => {
    const at = sizes.body + 12;
    if (fieldBits === 32) return bytes.readUInt32BE(at + index * 4);
    if (fieldBits === 16) return bytes.readUInt16BE(at + index * 2);
    if (fieldBits === 8) return bytes[at + index];
    const byte = bytes[at + Math.floor(index / 2)];
    return index % 2 ? byte & 0x0f : byte >> 4;
  };

  const runCount = bytes.readUInt32BE(stsc.body + 4);
  if (stsc.body + 8 + runCount * 12 > stsc.end) return null;

  const chunks = [];
  let run = -1;
  let samplesPerChunk = 0;
  let sample = 0;
  for (let chunk = 0; chunk < chunkCount; chunk += 1) {
    while (run + 1 < runCount && bytes.readUInt32BE(stsc.body + 8 + (run + 1) * 12) <= chunk + 1) {
      run += 1;
      samplesPerChunk = bytes.readUInt32BE(stsc.body + 8 + run * 12 + 4);
    }
    const samples = Math.min(samplesPerChunk, sampleCount - sample);
    let length = samples * fixedSize;
    if (!fixedSize) for (let i = 0; i < samples; i += 1) length += sampleSize(sample + i);
    sample += samples;
    const at = offsets.body + 8 + chunk * (wide ? 8 : 4);
    const start = wide ? Number(bytes.readBigUInt64BE(at)) : bytes.readUInt32BE(at);
    if (length) chunks.push([start, start + length]);
  }
  return sample === sampleCount ? chunks : null;
}

function cleanMovieBox(bytes, base, parent, plan, movie) {
  const keeps = KEEPS[parent.type];
  for (const box of childBoxes(bytes, parent)) {
    plan.count();
    if (box.type === 'cmov') throw unreadable('Compressed movie header');
    if (box.type === 'mvex') movie.fragmented = true;
    if (UNUSED.has(box.type)) plan.zero(base + box.body, base + box.end);
    else if (!keeps.has(box.type)) blankBox(plan, base, box);
    else if (box.type === 'trak') cleanTrack(bytes, base, box, plan, movie);
    else if (KEEPS[box.type]) cleanMovieBox(bytes, base, box, plan, movie);
  }
}

function cleanTrack(bytes, base, trak, plan, movie) {
  const hdlr = findBox(bytes, trak, ['mdia', 'hdlr']);
  const handler = hdlr && hdlr.end - hdlr.body >= 12 ? bytes.toString('latin1', hdlr.body + 8, hdlr.body + 12) : '';
  if (KEPT_TRACKS.has(handler)) {
    if (PLAYABLE_TRACKS.has(handler)) movie.playable += 1;
    cleanMovieBox(bytes, base, trak, plan, movie);
    return;
  }
  const chunks = trackChunks(bytes, trak);
  if (!chunks) throw unreadable('A data track with damaged sample tables');
  if (movie.droppedChunks.length + chunks.length > MAX_CHUNKS) throw unreadable('Too many chunks');
  movie.droppedTracks += 1;
  for (const chunk of chunks) movie.droppedChunks.push(chunk);
  blankBox(plan, base, trak);
}

function cleanFragment(bytes, base, parent, plan) {
  for (const box of childBoxes(bytes, parent)) {
    plan.count();
    if (FRAGMENT_METADATA.has(box.type)) blankBox(plan, base, box);
    else if (UNUSED.has(box.type)) plan.zero(base + box.body, base + box.end);
    else if (box.type === 'traf' && parent.type === 'moof') cleanFragment(bytes, base, box, plan);
  }
}

/** Bytes after the last box aren't a box (Samsung and Insta360 append their data there): they become one empty box. */
function blankTail(plan, at) {
  const length = plan.size - at;
  if (length >= 8) {
    const header = Buffer.alloc(8);
    header.writeUInt32BE(length > 0xffffffff ? 0 : length, 0);
    header.write('free', 4, 'latin1');
    plan.write(at, header);
    plan.zero(at + 8, plan.size);
  } else {
    plan.zero(at, plan.size);
  }
}

/** Zeroes the samples of tracks we removed, wherever they fall inside `mdat`. */
function zeroDroppedSamples(plan, movie) {
  for (const [start, end] of movie.droppedChunks) {
    let low = 0;
    let high = movie.mdats.length - 1;
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      const [mdatStart, mdatEnd] = movie.mdats[middle];
      if (start >= mdatEnd) low = middle + 1;
      else if (start < mdatStart) high = middle - 1;
      else {
        plan.zero(start, Math.min(end, mdatEnd), true);
        break;
      }
    }
  }
}

async function planMovie(read, plan) {
  const movie = { playable: 0, fragmented: false, droppedTracks: 0, droppedChunks: [], mdats: [], sawMovie: false };
  let at = 0;
  while (at < plan.size) {
    plan.count();
    const box = readBox(await read(at, 16), 0, plan.size - at); // its positions are relative to `at`
    if (!box) {
      blankTail(plan, at);
      break;
    }
    if (box.type === 'moov' || box.type === 'moof') {
      if (box.overruns) throw unreadable(`Truncated ${box.type}`);
      const bytes = await read(at, box.end);
      if (box.type === 'moov') {
        movie.sawMovie = true;
        cleanMovieBox(bytes, at, box, plan, movie);
      } else {
        movie.fragmented = true;
        cleanFragment(bytes, at, box, plan);
      }
    } else if (box.type === 'mdat') {
      movie.mdats.push([at + box.body, at + box.end]);
    } else if (UNUSED.has(box.type)) {
      plan.zero(at + box.body, at + box.end);
    } else if (!TOP_LEVEL_KEEPS.has(box.type)) {
      blankBox(plan, at, box);
    }
    at += box.end;
  }
  if (!movie.sawMovie) throw unreadable('No movie header');
  if (!movie.playable) throw unreadable('No picture or sound');
  if (movie.droppedTracks && movie.fragmented) throw unreadable('A data track in a fragmented file');
  zeroDroppedSamples(plan, movie);
}

// ============ WEBM ============

const EBML_HEADER = 0x1a45dfa3;
const SEGMENT = 0x18538067;
const SEEK_HEAD = 0x114d9b74;
const SEEK = 0x4dbb;
const SEEK_ID = 0x53ab;
const INFO = 0x1549a966;
const TITLE = 0x7ba9;
const TRACKS = 0x1654ae6b;
const CLUSTER = 0x1f43b675;
const CUES = 0x1c53bb6b;
const CHAPTERS = 0x1043a770;
const VOID = 0xec;
const CRC32 = 0xbf;
const SEGMENT_KEEPS = new Set([SEEK_HEAD, INFO, TRACKS, CLUSTER, CUES, CHAPTERS]);
const CLUSTER_CHILDREN = new Set([0xe7, 0x5854, 0xa7, 0xab, 0xa3, 0xa0, 0xaf, VOID, CRC32]);

/** The element at `at`: its id, where its body starts, and its size (null when it's open-ended). Null if malformed. */
function readElement(bytes, at) {
  const first = bytes[at];
  if (!first) return null;
  const idLength = Math.clz32(first) - 23;
  if (idLength > 4 || at + idLength >= bytes.length) return null;
  let id = 0;
  for (let i = 0; i < idLength; i += 1) id = id * 256 + bytes[at + i];

  const sizeAt = at + idLength;
  const sizeFirst = bytes[sizeAt];
  if (!sizeFirst) return null;
  const sizeLength = Math.clz32(sizeFirst) - 23;
  if (sizeAt + sizeLength > bytes.length) return null;
  const mask = 0xff >> sizeLength;
  let size = sizeFirst & mask;
  let open = size === mask;
  for (let i = 1; i < sizeLength; i += 1) {
    size = size * 256 + bytes[sizeAt + i];
    open = open && bytes[sizeAt + i] === 0xff;
  }
  if (!open && !Number.isSafeInteger(size)) return null;
  return { id, body: sizeAt + sizeLength, size: open ? null : size };
}

function voidElement(plan, start, end) {
  const total = end - start;
  let sizeLength = 1;
  while (total - 1 - sizeLength > 2 ** (7 * sizeLength) - 2) sizeLength += 1;
  const header = Buffer.alloc(1 + sizeLength);
  header[0] = VOID;
  let size = total - 1 - sizeLength;
  for (let i = sizeLength; i >= 1; i -= 1) {
    header[i] = size % 256;
    size = Math.floor(size / 256);
  }
  header[1] |= 0x80 >> (sizeLength - 1);
  plan.write(start, header);
  plan.zero(start + header.length, end);
}

/** Blanks the children `shouldBlank` picks, and the master's checksum if that changes it. */
async function blankChildren(read, plan, start, end, shouldBlank) {
  const bytes = await read(start, end - start);
  const children = [];
  for (let at = 0; at < bytes.length;) {
    plan.count();
    const child = readElement(bytes, at);
    if (!child || child.size === null) throw unreadable('Bad element in a master element');
    const last = Math.min(child.body + child.size, bytes.length);
    children.push({ id: child.id, at, body: child.body, end: last });
    at = last;
  }
  const blanked = children.filter((child) => shouldBlank(child, bytes));
  for (const child of children) {
    if (blanked.length && child.id === CRC32) voidElement(plan, start + child.at, start + child.end);
    else if (child.id === VOID) plan.zero(start + child.body, start + child.end);
  }
  for (const child of blanked) voidElement(plan, start + child.at, start + child.end);
}

function seeksToRemovedElement(child, bytes) {
  if (child.id !== SEEK) return false;
  for (let at = child.body; at < child.end;) {
    const inner = readElement(bytes, at);
    if (!inner || inner.size === null) return true;
    if (inner.id === SEEK_ID) {
      let target = 0;
      const end = Math.min(inner.body + inner.size, child.end);
      for (let i = inner.body; i < end; i += 1) target = target * 256 + bytes[i];
      return !SEGMENT_KEEPS.has(target);
    }
    at = inner.body + inner.size;
  }
  return true;
}

/** Walks a cluster of unknown size, as a browser's recorder writes it, to where the next element after it starts. */
async function skipOpenCluster(read, plan, start, end) {
  let at = start;
  for (let seen = 0; at < end; seen += 1) {
    if (seen > MAX_OPEN_CLUSTER_ELEMENTS) throw unreadable('Too many elements in a cluster');
    const element = readElement(await read(at, 12), 0);
    if (!element) {
      if (end - at >= 12) throw unreadable('Bad element in a cluster');
      plan.zero(at, end); // a recording cut off partway through a header
      return end;
    }
    if (!CLUSTER_CHILDREN.has(element.id)) return at;
    if (element.size === null) throw unreadable('Open-ended element in a cluster');
    at += element.body + element.size;
  }
  return end;
}

async function planSegment(read, plan, start, end, webm) {
  let at = start;
  while (at < end) {
    plan.count();
    const element = readElement(await read(at, 12), 0);
    if (!element) {
      if (end - at >= 12) throw unreadable('Bad element in a segment');
      plan.zero(at, end); // a recording cut off partway through a header
      return end;
    }
    if (element.id === EBML_HEADER || element.id === SEGMENT) return at; // another stream, after an open-ended segment
    const body = at + element.body;
    if (element.size === null) {
      if (element.id !== CLUSTER) throw unreadable('Open-ended element in a segment');
      at = await skipOpenCluster(read, plan, body, end);
    } else {
      const last = Math.min(body + element.size, end);
      if (element.id === TRACKS) webm.tracks = true;
      if (element.id === SEEK_HEAD) await blankChildren(read, plan, body, last, seeksToRemovedElement);
      else if (element.id === INFO) await blankChildren(read, plan, body, last, (child) => child.id === TITLE);
      else if (element.id === VOID) plan.zero(body, last);
      else if (!SEGMENT_KEEPS.has(element.id)) voidElement(plan, at, last);
      at = last;
    }
  }
  return end;
}

async function planWebm(read, plan) {
  const webm = { tracks: false };
  let at = 0;
  while (at < plan.size) {
    plan.count();
    const element = readElement(await read(at, 12), 0);
    if (element?.id === EBML_HEADER && element.size !== null) {
      at += element.body + element.size;
    } else if (element?.id === SEGMENT) {
      const body = at + element.body;
      const end = element.size === null ? plan.size : Math.min(body + element.size, plan.size);
      at = await planSegment(read, plan, body, end, webm);
    } else {
      plan.zero(at, plan.size); // past the last segment nothing reads it
      break;
    }
  }
  if (!webm.tracks) throw unreadable('No tracks');
}

// ============ AVI ============

const AVI_KEEPS = {
  'AVI ': new Set(['LIST hdrl', 'LIST movi', 'idx1']),
  AVIX: new Set(['LIST movi']),
  hdrl: new Set(['avih', 'LIST strl', 'LIST odml']),
  strl: new Set(['strh', 'strf', 'indx', 'vprp']),
};
const AVI_PLAYABLE_STREAMS = new Set(['vids', 'auds']);

async function planAviList(read, plan, start, end, form, avi) {
  const keeps = AVI_KEEPS[form];
  let at = start;
  while (at < end) {
    plan.count();
    if (end - at < 8) {
      plan.zero(at, end);
      break;
    }
    const head = await read(at, 12);
    const id = head.toString('latin1', 0, 4);
    const length = head.readUInt32LE(4);
    const body = at + 8;
    const last = Math.min(body + length + (length & 1), end);
    const inner = id === 'LIST' && head.length >= 12 ? head.toString('latin1', 8, 12) : null;
    if (id === 'JUNK') {
      plan.zero(body, last);
    } else if (!keeps.has(inner ? `LIST ${inner}` : id)) {
      const header = Buffer.from('JUNK\0\0\0\0', 'latin1');
      header.writeUInt32LE(last - body, 4);
      plan.write(at, header);
      plan.zero(body, last);
    } else if (inner && AVI_KEEPS[inner]) {
      await planAviList(read, plan, body + 4, last, inner, avi);
    } else if (id === 'strh') {
      // A stream of anything but picture and sound (subtitles, data) sits among the frames, where we don't look.
      if (!AVI_PLAYABLE_STREAMS.has(head.toString('latin1', 8, 12))) throw unreadable('A data stream');
      avi.streams += 1;
    }
    at = last;
  }
}

async function planAvi(read, plan) {
  const avi = { streams: 0 };
  let at = 0;
  while (plan.size - at >= 12) {
    const head = await read(at, 12);
    const form = head.toString('latin1', 8, 12);
    if (head.toString('latin1', 0, 4) !== 'RIFF' || (form !== 'AVI ' && form !== 'AVIX')) break;
    const length = head.readUInt32LE(4);
    const end = !length || at + 8 + length > plan.size ? plan.size : at + 8 + length + (length & 1);
    await planAviList(read, plan, at + 12, Math.min(end, plan.size), form, avi);
    at = Math.min(end, plan.size);
  }
  plan.zero(at, plan.size); // past the last RIFF nothing reads it
  if (!avi.streams) throw unreadable('No streams');
}

// ============ ANY VIDEO ============

async function planCleaning(read, size) {
  const plan = new Plan(size);
  const head = await read(0, 12);
  const text = (from, to) => head.toString('latin1', from, to);
  if (head.length >= 4 && head.readUInt32BE(0) === EBML_HEADER) await planWebm(read, plan);
  else if (text(0, 4) === 'RIFF' && text(8, 12) === 'AVI ') await planAvi(read, plan);
  else if (FIRST_BOXES.has(text(4, 8))) await planMovie(read, plan);
  else throw unreadable('Not an MP4, MOV, WebM or AVI');
  return plan;
}

/**
 * Removes the metadata from a video's bytes, in place: the buffer keeps its length and its picture and sound.
 * Throws UnreadableVideoError when the file can't be cleaned.
 */
async function removeVideoMetadata(buffer) {
  const plan = await planCleaning((at, length) => buffer.subarray(at, at + length), buffer.length);
  for (const edit of plan.edits) {
    if (edit.bytes) edit.bytes.copy(buffer, edit.at);
    else buffer.fill(0, edit.at, edit.at + edit.length);
  }
  return buffer;
}

/** A `read` over `fetchRange(position, length)` that asks for a window at a time, however small the reads are. */
function windowedReader(fetchRange, size, windowBytes) {
  let start = 0;
  let window = Buffer.alloc(0);
  return async (at, length) => {
    if (at >= size) return Buffer.alloc(0);
    const end = Math.min(at + length, size);
    if (at < start || end > start + window.length) {
      window = await fetchRange(at, Math.min(Math.max(end - at, windowBytes), size - at));
      start = at;
    }
    return window.subarray(at - start, end - start);
  };
}

/** The same as removeVideoMetadata for a file on disk, which it reads a little of and overwrites in place. */
async function removeVideoFileMetadata(filePath, { signal } = {}) {
  const handle = await fsp.open(filePath, 'r+');
  try {
    const { size } = await handle.stat();
    const fetchRange = async (position, length) => {
      const bytes = Buffer.allocUnsafe(length);
      const { bytesRead } = await handle.read(bytes, 0, length, position);
      return bytes.subarray(0, bytesRead);
    };
    const plan = await planCleaning(windowedReader(fetchRange, size, 64 * 1024), size);
    signal?.throwIfAborted();
    const zeros = Buffer.alloc(64 * 1024);
    for (const edit of plan.edits) {
      if (edit.bytes) {
        await handle.write(edit.bytes, 0, edit.bytes.length, edit.at);
      } else {
        for (let at = edit.at, end = edit.at + edit.length; at < end;) {
          const { bytesWritten } = await handle.write(zeros, 0, Math.min(zeros.length, end - at), at);
          at += bytesWritten;
        }
      }
    }
  } finally {
    await handle.close();
  }
}

const LOCATION_TEXT = /location|GPS(?:Lat|Long|Coord|Pos)|freeGPS|[+-]\d{1,2}\.\d{2,}[+-]\d{1,3}\.\d{2,}/i;
// Tags, and the codecs of tracks made for GPS or able to carry it as text (drones and dashcams caption their footage).
const LOCATION_TAGS = /\0[\s\S]{3}(?:\xa9xyz|loci|gps |gps0|GPS |gpmd|camm|rtmd|djmd|tx3g|wvtt)|LOCA[\s\S]{3}\0/;

/**
 * What a stored video holds that cleaning would remove, read through `fetchRange(position, length)` without changing
 * it: `{ metadata, location }`. `location` means a known location tag, or a track that can hold one, is among it.
 */
async function inspectVideo(fetchRange, size) {
  const read = windowedReader(fetchRange, size, 1024 * 1024);
  const plan = await planCleaning(read, size);
  let metadata = false;
  let location = false;
  for (const edit of plan.edits) {
    if (edit.samples) continue; // their track is in the plan too, which is what names what they are
    const bytes = await read(edit.at, edit.bytes ? edit.bytes.length : edit.length);
    if (edit.bytes ? !bytes.equals(edit.bytes) : bytes.some((byte) => byte !== 0)) {
      metadata = true;
      const text = bytes.toString('latin1');
      if (LOCATION_TEXT.test(text) || LOCATION_TAGS.test(text)) location = true;
    }
  }
  return { metadata, location };
}

module.exports = { UnreadableVideoError, removeVideoMetadata, removeVideoFileMetadata, inspectVideo };
