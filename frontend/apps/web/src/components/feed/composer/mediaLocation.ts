import { useEffect, useState } from 'react';

/**
 * Where an attachment was taken, read from its own metadata in the browser, before upload (the server cleans uploads),
 * as the iOS and Android composers do. It anchors the place picker's "Photo location" and goes with a Place post
 * (`mediaLocations`) as evidence that the author was there, the device's word like a GPS fix. Only a draft for a Place
 * feed sends it, and the server keeps no list of the points.
 */
export interface MediaLocation {
  latitude: number;
  longitude: number;
  /** The GPS time stamp, else the camera's capture time, else a video's creation time. */
  capturedAt: string | null;
}

const JPEG_HEAD_BYTES = 1024 * 1024;
const MAX_TOP_LEVEL_BOXES = 64;
const MAX_MOOV_BYTES = 32 * 1024 * 1024;
const SECONDS_1904_TO_1970 = 2082844800;
const APPLE_LOCATION_KEY = 'com.apple.quicktime.location.ISO6709';

async function bytes(file: Blob, start: number, end: number): Promise<DataView> {
  return new DataView(await file.slice(start, end).arrayBuffer());
}

function ascii(view: DataView, start: number, length: number): string {
  let out = '';
  for (let i = 0; i < length; i += 1) out += String.fromCharCode(view.getUint8(start + i));
  return out;
}

function located(latitude: number, longitude: number, capturedAt: string | null): MediaLocation | null {
  const valid = Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
  // 0, 0 is where a missing fix lands, not a photo from the Gulf of Guinea.
  return valid && (latitude !== 0 || longitude !== 0) ? { latitude, longitude, capturedAt } : null;
}

function isoTime(value: string): string | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

// ─── Photos: EXIF ────────────────────────────────────────────

/** An EXIF block: the GPS directory's point and time, else the camera's capture time. */
function readExif(view: DataView): MediaLocation | null {
  const order = ascii(view, 0, 2);
  if (order !== 'II' && order !== 'MM') return null;
  const little = order === 'II';
  const u16 = (at: number) => view.getUint16(at, little);
  const u32 = (at: number) => view.getUint32(at, little);

  // A directory: each tag and the offset of its 12-byte entry (tag, type, count, then the value or where it is).
  const directory = (at: number) => {
    const entries = new Map<number, number>();
    for (let i = 0; i < u16(at); i += 1) entries.set(u16(at + 2 + i * 12), at + 2 + i * 12);
    return entries;
  };
  const text = (entry: number | undefined) => {
    if (entry == null) return '';
    const length = u32(entry + 4);
    return ascii(view, length > 4 ? u32(entry + 8) : entry + 8, length).split('\0')[0].trim();
  };
  // Up to three fractions (degrees, minutes, seconds or hours, minutes, seconds); a 0/0 counts as nothing.
  const fractions = (entry: number | undefined) => {
    if (entry == null) return null;
    const at = u32(entry + 8);
    return Array.from({ length: Math.min(3, u32(entry + 4)) }, (_, i) => u32(at + i * 8) / (u32(at + i * 8 + 4) || 1));
  };
  const degrees = (parts: number[] | null, negative: boolean) => {
    if (!parts?.length) return Number.NaN;
    const value = parts[0] + (parts[1] ?? 0) / 60 + (parts[2] ?? 0) / 3600;
    return negative ? -value : value;
  };

  const top = directory(u32(4));
  const gpsPointer = top.get(0x8825);
  if (gpsPointer == null) return null;
  const gps = directory(u32(gpsPointer + 8));

  const latitude = degrees(fractions(gps.get(2)), text(gps.get(1)) === 'S');
  const longitude = degrees(fractions(gps.get(4)), text(gps.get(3)) === 'W');

  // The GPS block's own time is UTC ("2026:11:02" and 18, 4, 31).
  const gpsDay = text(gps.get(29)).replace(/:/g, '-');
  const gpsClock = fractions(gps.get(7));
  let capturedAt = gpsDay && gpsClock?.length === 3
    ? isoTime(`${gpsDay}T${gpsClock.map((part) => String(Math.floor(part)).padStart(2, '0')).join(':')}Z`)
    : null;
  // The camera's time ("2026:11:02 11:04:31") is in its recorded offset ("-07:00"), else this device's zone.
  const exifPointer = top.get(0x8769);
  if (!capturedAt && exifPointer != null) {
    const exif = directory(u32(exifPointer + 8));
    const original = text(exif.get(0x9003));
    const offset = text(exif.get(0x9011));
    if (original) {
      capturedAt = isoTime(`${original.replace(/^(\d+):(\d+):/, '$1-$2-').replace(' ', 'T')}${/^[+-]\d\d:\d\d$/.test(offset) ? offset : ''}`);
    }
  }
  return located(latitude, longitude, capturedAt);
}

function readJpeg(view: DataView): MediaLocation | null {
  let at = 2;
  while (at + 4 <= view.byteLength) {
    if (view.getUint8(at) !== 0xff) return null;
    const marker = view.getUint8(at + 1);
    if (marker === 0xff) {
      at += 1; // A fill byte.
      continue;
    }
    if (marker === 0xda || marker === 0xd9) return null; // The image data: no metadata comes after it.
    const length = view.getUint16(at + 2);
    if (marker === 0xe1 && ascii(view, at + 4, 6) === 'Exif\0\0') {
      return readExif(new DataView(view.buffer, view.byteOffset + at + 10, length - 8));
    }
    at += 2 + length;
  }
  return null;
}

// ─── HEIC, AVIF, MOV, MP4: boxes ─────────────────────────────

type Box = { type: string; start: number; end: number };

/** The box at `at` with its payload's range, or null when it doesn't fit before `limit`. */
function boxAt(view: DataView, at: number, limit: number): Box | null {
  let size = view.getUint32(at);
  let header = 8;
  if (size === 1) {
    size = view.getUint32(at + 8) * 2 ** 32 + view.getUint32(at + 12);
    header = 16;
  } else if (size === 0) {
    size = limit - at;
  }
  return size < header || at + size > limit ? null : { type: ascii(view, at + 4, 4), start: at + header, end: at + size };
}

function childBoxes(view: DataView, start: number, end: number): Box[] {
  const boxes: Box[] = [];
  let at = start;
  while (at + 8 <= end) {
    const box = boxAt(view, at, end);
    if (!box) break;
    boxes.push(box);
    at = box.end;
  }
  return boxes;
}

/** A HEIC or AVIF `meta` box: which item is the EXIF block, and where it is in the file. */
function exifExtent(view: DataView, meta: Box): { offset: number; length: number } | null {
  const children = childBoxes(view, meta.start + 4, meta.end);
  const iinf = children.find((box) => box.type === 'iinf');
  const iloc = children.find((box) => box.type === 'iloc');
  if (!iinf || !iloc) return null;

  const firstInfe = iinf.start + (view.getUint8(iinf.start) === 0 ? 6 : 8);
  const exifItem = childBoxes(view, firstInfe, iinf.end).find((box) => {
    if (box.type !== 'infe') return false;
    return ascii(view, box.start + (view.getUint8(box.start) >= 3 ? 10 : 8), 4) === 'Exif';
  });
  if (!exifItem) return null;
  const exifId = view.getUint8(exifItem.start) >= 3 ? view.getUint32(exifItem.start + 4) : view.getUint16(exifItem.start + 4);

  const version = view.getUint8(iloc.start);
  const offsetSize = view.getUint8(iloc.start + 4) >> 4;
  const lengthSize = view.getUint8(iloc.start + 4) & 15;
  const baseSize = view.getUint8(iloc.start + 5) >> 4;
  const indexSize = version > 0 ? view.getUint8(iloc.start + 5) & 15 : 0;
  const uint = (at: number, size: number) => {
    if (size === 0) return 0;
    return size === 8 ? view.getUint32(at) * 2 ** 32 + view.getUint32(at + 4) : view.getUint32(at);
  };
  let at = iloc.start + 6;
  const itemCount = version < 2 ? view.getUint16(at) : view.getUint32(at);
  at += version < 2 ? 2 : 4;
  for (let i = 0; i < itemCount; i += 1) {
    const id = version < 2 ? view.getUint16(at) : view.getUint32(at);
    at += version < 2 ? 2 : 4;
    if (version > 0) at += 2; // The construction method: only a file offset is read here.
    at += 2; // The data reference.
    const base = uint(at, baseSize);
    at += baseSize;
    const extents = view.getUint16(at);
    at += 2;
    if (id === exifId) {
      return extents > 0
        ? { offset: base + uint(at + indexSize, offsetSize), length: uint(at + indexSize + offsetSize, lengthSize) }
        : null;
    }
    at += extents * (indexSize + offsetSize + lengthSize);
  }
  return null;
}

async function readHeic(file: Blob, box: Box): Promise<MediaLocation | null> {
  const meta = await bytes(file, box.start, box.end);
  const extent = exifExtent(meta, { type: 'meta', start: 0, end: meta.byteLength });
  if (!extent) return null;
  const item = await bytes(file, extent.offset, extent.offset + extent.length);
  // The item opens with how far on the EXIF block starts.
  const start = 4 + item.getUint32(0);
  return readExif(new DataView(item.buffer, item.byteOffset + start, item.byteLength - start));
}

/** "+41.8781-087.6298+000.000/": latitude, then longitude; anything after them doesn't matter. */
function iso6709(value: string): { latitude: number; longitude: number } | null {
  const match = /^\s*([+-]\d+(?:\.\d+)?)([+-]\d+(?:\.\d+)?)/.exec(value);
  return match ? { latitude: Number(match[1]), longitude: Number(match[2]) } : null;
}

/** The location Apple's cameras write: a `keys` list in a `meta` box, and in `ilst` the value at that key's number. */
function appleLocation(view: DataView, meta: Box): string | null {
  // In QuickTime `meta` has no version field before its boxes.
  const start = ascii(view, meta.start + 4, 4) === 'hdlr' ? meta.start : meta.start + 4;
  const children = childBoxes(view, start, meta.end);
  const keys = children.find((box) => box.type === 'keys');
  const ilst = children.find((box) => box.type === 'ilst');
  if (!keys || !ilst) return null;
  let at = keys.start + 8;
  for (let number = 1; number <= view.getUint32(keys.start + 4); number += 1) {
    const size = view.getUint32(at);
    if (size < 8) return null;
    if (ascii(view, at + 8, size - 8) === APPLE_LOCATION_KEY) {
      const item = childBoxes(view, ilst.start, ilst.end).find((box) => view.getUint32(box.start - 4) === number);
      const data = item && childBoxes(view, item.start, item.end).find((box) => box.type === 'data');
      return data ? ascii(view, data.start + 8, data.end - data.start - 8) : null;
    }
    at += size;
  }
  return null;
}

/** A video's `moov` box: `©xyz` (Android and most cameras), `loci` or Apple's key, and the movie's creation time. */
function readMovie(view: DataView): MediaLocation | null {
  const boxes = childBoxes(view, 0, view.byteLength);
  const udta = boxes.find((box) => box.type === 'udta');
  let point: { latitude: number; longitude: number } | null = null;
  for (const box of [...boxes, ...(udta ? childBoxes(view, udta.start, udta.end) : [])]) {
    if (box.type === '\u00a9xyz') point = iso6709(ascii(view, box.start + 4, view.getUint16(box.start)));
    if (box.type === 'meta') point = iso6709(appleLocation(view, box) ?? '');
    if (box.type === 'loci') {
      // After the version and language: a name ending in a zero, a role byte, then longitude and latitude as 16.16.
      let at = box.start + 6;
      while (view.getUint8(at) !== 0) at += 1;
      point = { longitude: view.getInt32(at + 2) / 65536, latitude: view.getInt32(at + 6) / 65536 };
    }
    if (point) break;
  }
  if (!point) return null;

  const mvhd = boxes.find((box) => box.type === 'mvhd');
  // Seconds since 1904, in 32 or 64 bits (the low half is enough until 2040). A clock never set reads as nothing.
  const seconds = mvhd ? view.getUint32(mvhd.start + (view.getUint8(mvhd.start) === 1 ? 8 : 4)) : 0;
  const capturedAt = seconds > SECONDS_1904_TO_1970 ? new Date((seconds - SECONDS_1904_TO_1970) * 1000).toISOString() : null;
  return located(point.latitude, point.longitude, capturedAt);
}

async function readMedia(file: File): Promise<MediaLocation | null> {
  if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) return null;
  const head = await bytes(file, 0, 2);
  if (head.getUint8(0) === 0xff && head.getUint8(1) === 0xd8) return readJpeg(await bytes(file, 0, JPEG_HEAD_BYTES));

  // A top-level `meta` is a HEIC or AVIF still, a `moov` a movie. Other formats' first bytes read as a box too big to fit.
  let at = 0;
  for (let i = 0; i < MAX_TOP_LEVEL_BOXES && at + 8 <= file.size; i += 1) {
    const box = boxAt(await bytes(file, at, at + 16), 0, file.size - at);
    if (!box) return null;
    const payload = { type: box.type, start: at + box.start, end: at + box.end };
    if (box.type === 'meta') return readHeic(file, payload);
    if (box.type === 'moov') {
      return payload.end - payload.start > MAX_MOOV_BYTES ? null : readMovie(await bytes(file, payload.start, payload.end));
    }
    at = payload.end;
  }
  return null;
}

// ─── The composer's side ─────────────────────────────────────

const reads = new WeakMap<File, Promise<MediaLocation | null>>();
const NONE: MediaLocation[] = [];

/** Every located attachment's point, in attachment order. A file that can't be read simply has none. */
export async function readMediaLocations(files: File[]): Promise<MediaLocation[]> {
  const points = await Promise.all(files.map((file) => {
    let read = reads.get(file);
    if (!read) {
      read = readMedia(file).catch(() => null);
      reads.set(file, read);
    }
    return read;
  }));
  return points.filter((point): point is MediaLocation => point != null);
}

/** The attachments' points, as state. The list keeps its identity until a point really changes. */
export function useMediaLocations(files: File[]): MediaLocation[] {
  const [points, setPoints] = useState(NONE);
  useEffect(() => {
    if (files.length === 0) {
      setPoints(NONE);
      return;
    }
    let current = true;
    void readMediaLocations(files).then((next) => {
      if (current) setPoints((was) => (JSON.stringify(was) === JSON.stringify(next) ? was : next));
    });
    return () => {
      current = false;
    };
  }, [files]);
  return points;
}

/** The attachment taken nearest a point: what the Place check is asked about. */
export function nearestMediaLocation(points: MediaLocation[], latitude: number, longitude: number): MediaLocation | undefined {
  const squaredDegrees = (point: MediaLocation) => {
    const dLat = point.latitude - latitude;
    const dLng = (point.longitude - longitude) * Math.cos((latitude * Math.PI) / 180);
    return dLat * dLat + dLng * dLng;
  };
  return points.reduce<MediaLocation | undefined>(
    (nearest, point) => (!nearest || squaredDegrees(point) < squaredDegrees(nearest) ? point : nearest),
    undefined,
  );
}
