// ============================================================
// The share pictures of a Christmas card (launch key card_table), drawn here on
// the device, so nothing private leaves it. The layouts are sample/share.html's,
// in its 540-wide space, drawn at 2x. Link previews aren't drawn: they are files
// on the site, because Facebook reads them from the page.
// ============================================================

import { firstNameOf, isVerseReference, PAPER_SERIF, postmarkDay, TABLE_ART, tableTint, cardTrimmedPicture } from './cardArt';
import { cardHand, cardPen } from './cardFont';
import { measureNote, penWords, type NoteFit } from './CardPaper';
import { drawableSignature, signaturePath, SIGNATURE_INK, SIGNATURE_LINE, SIGNATURE_ON_CARD, SIGNATURE_STROKE, SIGNATURE_W } from './cardSignature';
import type { CardSignature } from '@pantopus/api';

export type ShareFormat = 'story' | 'post' | 'link';

export type ShareCard = {
  design: string;
  number?: number | null;
  caption: string | null;
  paper: string;
  table?: string | null;
  year: number;
  sealed: boolean;
};

export type ShareDetails = {
  card: ShareCard;
  /** What's printed on the small postmark. */
  mailedOn?: string | null;
  note: string;
  fromName: string;
  /** Signed beside FROM (design plan 8.2): drawn as on the card, only where the back shows with the note. */
  signature?: CardSignature | null;
};

const SCALE = 2;
const PEN = `${cardPen.style.fontFamily}, ui-serif, Georgia, serif`;
const HAND = `${cardHand.style.fontFamily}, ui-serif, Georgia, serif`;
const SERIF = PAPER_SERIF;
const SIZES = { story: [540, 960], post: [540, 675] } as const;
const POSTMARK_LINES = 'M58 21q6-8 12 0t12 0t12 0M58 30q6-8 12 0t12 0t12 0M58 39q6-8 12 0t12 0t12 0';

type Ctx = CanvasRenderingContext2D;

const loaded = new Map<string, Promise<HTMLImageElement>>();

/** A picture, trying again before giving up: a weak connection is no reason to lose it. */
function image(src: string): Promise<HTMLImageElement> {
  const known = loaded.get(src);
  if (known) return known;
  const attempt = (tries: number): Promise<HTMLImageElement> => new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error(`Couldn't load ${src}`));
    el.src = src;
  }).catch((err) => {
    if (tries <= 0) throw err;
    return new Promise<void>((wait) => { window.setTimeout(wait, 500); }).then(() => attempt(tries - 1));
  });
  const promise = attempt(2);
  loaded.set(src, promise);
  promise.catch(() => loaded.delete(src));
  return promise;
}

const artImage = (name: string) => image(`${TABLE_ART}${name}`);

function canvasOf(width: number, height: number): [HTMLCanvasElement, Ctx] {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(width * SCALE));
  canvas.height = Math.max(1, Math.ceil(height * SCALE));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser couldn\'t draw the picture.');
  ctx.scale(SCALE, SCALE);
  return [canvas, ctx];
}

function tile(ctx: Ctx, picture: HTMLImageElement, size: number): CanvasPattern {
  const pattern = ctx.createPattern(picture, 'repeat');
  if (!pattern) throw new Error('This browser couldn\'t draw the picture.');
  pattern.setTransform(new DOMMatrix().scale(size / picture.naturalWidth));
  return pattern;
}

function roundedRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** A canvas shadow ignores the drawing's turn and scale; a CSS one turns with its element. */
function setShadow(ctx: Ctx, x: number, y: number, blur: number, color: string, turn = 0) {
  const angle = (turn * Math.PI) / 180;
  ctx.shadowOffsetX = (x * Math.cos(angle) - y * Math.sin(angle)) * SCALE;
  ctx.shadowOffsetY = (x * Math.sin(angle) + y * Math.cos(angle)) * SCALE;
  ctx.shadowBlur = blur * SCALE;
  ctx.shadowColor = color;
}

function clearShadow(ctx: Ctx) {
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
}

/** Where the baseline falls in a line box that starts at `top`, as CSS line-height places it. */
function baselineIn(ctx: Ctx, top: number, lineHeight: number, fontSize: number): number {
  const m = ctx.measureText('Hg');
  const ascent = m.fontBoundingBoxAscent ?? fontSize * 0.8;
  const descent = m.fontBoundingBoxDescent ?? fontSize * 0.2;
  return top + ((lineHeight - (ascent + descent)) / 2) + ascent;
}

function spacedWidth(ctx: Ctx, text: string, spacing: number): number {
  return Array.from(text).reduce((sum, ch) => sum + ctx.measureText(ch).width + spacing, 0);
}

/** Letter-spaced text, one letter at a time: not every browser's canvas has letterSpacing. */
function spacedText(ctx: Ctx, text: string, x: number, y: number, spacing: number, centered = false) {
  let at = centered ? x - (spacedWidth(ctx, text, spacing) / 2) : x;
  for (const ch of Array.from(text)) {
    ctx.fillText(ch, at, y);
    at += ctx.measureText(ch).width + spacing;
  }
}

/** The picture printed on the card, with the same slight lift the card on the table has. Safari's canvas has no filter. */
function gradedPicture(picture: HTMLImageElement, width: number, height: number): HTMLCanvasElement {
  const [canvas, ctx] = canvasOf(width, height);
  const scale = Math.max(width / picture.naturalWidth, height / picture.naturalHeight);
  const w = picture.naturalWidth * scale;
  const h = picture.naturalHeight * scale;
  ctx.drawImage(picture, (width - w) / 2, (height - h) / 2, w, h);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = pixels;
  const contrast = 1.03;
  const s = 1.04;
  const clampByte = (value: number) => (value < 0 ? 0 : value > 255 ? 255 : value);
  for (let i = 0; i < data.length; i += 4) {
    const r = ((data[i] - 127.5) * contrast) + 127.5;
    const g = ((data[i + 1] - 127.5) * contrast) + 127.5;
    const b = ((data[i + 2] - 127.5) * contrast) + 127.5;
    data[i] = clampByte(((0.213 + (0.787 * s)) * r) + ((0.715 - (0.715 * s)) * g) + ((0.072 - (0.072 * s)) * b));
    data[i + 1] = clampByte(((0.213 - (0.213 * s)) * r) + ((0.715 + (0.285 * s)) * g) + ((0.072 - (0.072 * s)) * b));
    data[i + 2] = clampByte(((0.213 - (0.213 * s)) * r) + ((0.715 - (0.715 * s)) * g) + ((0.072 + (0.928 * s)) * b));
  }
  ctx.putImageData(pixels, 0, 0);
  return canvas;
}

function paperFinish(ctx: Ctx, paperArt: HTMLImageElement, w: number, h: number, u: number) {
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = 0.7;
  ctx.fillStyle = tile(ctx, paperArt, u * 60);
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
  // The edges darken a little, as an inner shadow: a frame just outside, whose shadow falls inward.
  ctx.save();
  setShadow(ctx, 0, 0, u * 2.6, 'rgba(110, 80, 30, 0.2)');
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.rect(-w, -h, w * 3, h * 3);
  ctx.rect(0, 0, w, h);
  ctx.fill('evenodd');
  ctx.restore();
}

/** The paper itself: its two shadows, then everything on it, clipped to its corners. */
function cardSheet(ctx: Ctx, paper: string, width: number, x: number, y: number, turn: number, draw: (u: number, h: number) => void) {
  const u = width / 100;
  const height = u * 120;
  ctx.save();
  ctx.translate(x + (width / 2), y + (height / 2));
  ctx.rotate((turn * Math.PI) / 180);
  ctx.translate(-width / 2, -height / 2);
  ctx.fillStyle = paper;
  for (const [ox, oy, blur, alpha] of [[1.6, 3.2, 9, 0.45], [0.6, 1.1, 2, 0.42]]) {
    ctx.save();
    setShadow(ctx, u * ox, u * oy, u * blur, `rgba(0, 0, 0, ${alpha})`, turn);
    roundedRect(ctx, 0, 0, width, height, u * 0.7);
    ctx.fill();
    ctx.restore();
  }
  roundedRect(ctx, 0, 0, width, height, u * 0.7);
  ctx.clip();
  draw(u, height);
  ctx.restore();
}

function drawPostmark(ctx: Ctx, u: number, day: string, year: number) {
  ctx.save();
  ctx.translate(u * 87.5, u * 112.2);
  ctx.rotate((-3 * Math.PI) / 180);
  ctx.translate(-u * 10, -u * 6);
  ctx.scale(u / 5, u / 5);
  ctx.strokeStyle = 'rgba(178, 65, 58, 0.86)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(36, 30, 22, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.arc(36, 30, 18.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 1.6;
  ctx.stroke(new Path2D(POSTMARK_LINES));
  ctx.fillStyle = '#b2413a';
  ctx.textAlign = 'center';
  ctx.font = '700 7.6px Georgia, serif';
  ctx.fillText(day, 36, 28);
  ctx.font = '700 8.5px Georgia, serif';
  ctx.fillText(String(year), 36, 40);
  ctx.restore();
}

function cardFront(ctx: Ctx, details: ShareDetails, art: Art, width: number, x: number, y: number, turn: number) {
  const { card } = details;
  cardSheet(ctx, card.paper, width, x, y, turn, (u, h) => {
    const photoW = u * 96.6;
    const photoH = u * 103;
    ctx.drawImage(gradedPicture(art.picture, photoW, photoH), u * 1.7, u * 1.7, photoW, photoH);
    ctx.strokeStyle = 'rgba(70, 50, 20, 0.25)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect((u * 1.7) - 0.25, (u * 1.7) - 0.25, photoW + 0.5, photoH + 0.5);

    const caption = card.caption || '';
    const size = u * Math.min(4.8, 70 / Math.max(1, caption.length * 0.53));
    ctx.fillStyle = '#1d2b63';
    // A verse reference prints in the card's serif, italic, so the colon reads (design plan 1.12).
    ctx.font = isVerseReference(caption) ? `italic ${size}px ${SERIF}` : `${size}px ${HAND}`;
    ctx.fillText(caption, u * 4.2, baselineIn(ctx, u * 107.4, size, size));

    const yearSize = u * 2.2;
    ctx.fillStyle = '#2b2622';
    ctx.font = `${yearSize}px ${SERIF}`;
    spacedText(ctx, `CHRISTMAS, ${card.year}`, u * 4.2, baselineIn(ctx, u * 114.2, yearSize, yearSize), yearSize * 0.42);

    drawPostmark(ctx, u, postmarkDay(details.mailedOn || new Date().toISOString()), card.year);
    paperFinish(ctx, art.paper, width, h, u);
  });
}

type PlacedWord = { text: string; x: number; width: number; line: number; shift: number; turn: number; ink: number };

/** Where each word of the note falls, wrapped as the card wraps it: a word too long for a line breaks at the edge. */
function layOutNote(ctx: Ctx, note: string, number: number | null | undefined, lineWidth: number): { words: PlacedWord[]; rtl: boolean[] } {
  const words: PlacedWord[] = [];
  const rtl: boolean[] = [];
  const space = ctx.measureText(' ').width;
  let line = 0;
  for (const paragraph of penWords(note, number)) {
    const firstWord = paragraph.find((part) => part.word.trim())?.word ?? '';
    const backwards = /^[^\p{L}]*[֐-ࣿיִ-﷿ﹰ-﻿]/u.test(firstWord);
    let x = 0;
    rtl[line] = backwards;
    for (const part of paragraph) {
      if (!part.word.trim()) { if (part.word === ' ' && x > 0) x += space; continue; }
      let rest = part.word;
      const broken = ctx.measureText(rest).width > lineWidth;
      while (rest) {
        let piece = rest;
        let width = ctx.measureText(piece).width;
        if (width > lineWidth) {
          // Longer than a whole line: as much of it as fits, the rest on the next.
          const letters = Array.from(rest);
          let count = letters.length;
          while (count > 1 && ctx.measureText(letters.slice(0, count).join('')).width > lineWidth) count -= 1;
          piece = letters.slice(0, count).join('');
          width = ctx.measureText(piece).width;
        }
        if (x > 0 && x + width > lineWidth) {
          line += 1;
          rtl[line] = backwards;
          x = 0;
        }
        words.push({ text: piece, x, width, line, shift: part.shift, turn: part.turn, ink: part.ink });
        // A word that had to break keeps its lines to itself, as an inline-block does on the card.
        x = broken ? lineWidth : x + width;
        rest = rest.slice(piece.length);
      }
    }
    line += 1;
  }
  return { words, rtl };
}

function cardBack(ctx: Ctx, details: ShareDetails, art: Art, fit: NoteFit, width: number, x: number, y: number, turn: number) {
  const { card, note } = details;
  cardSheet(ctx, card.paper, width, x, y, turn, (u, h) => {
    if (fit.rules) {
      ctx.fillStyle = 'rgba(74, 84, 118, 0.2)';
      for (let i = 1; i <= 11; i += 1) ctx.fillRect(u * 8, (u * (9 + (7.6 * i))) - 1, u * 84, 1);
    }

    // The note, each word a little off the line.
    const fontSize = u * fit.size;
    const lineHeight = u * fit.line;
    const left = u * 8;
    const lineWidth = u * 85;
    ctx.save();
    ctx.beginPath();
    ctx.rect(left - (u * 2), u * 9, lineWidth + (u * 4), u * 83.6);
    ctx.clip();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = '#1b2a5c';
    ctx.font = `${fontSize}px ${PEN}`;
    const { words, rtl } = layOutNote(ctx, note, card.number, lineWidth);
    const firstBaseline = baselineIn(ctx, 0, lineHeight, fontSize);
    for (const word of words) {
      const top = (u * 9) + (word.line * lineHeight);
      const wordX = rtl[word.line] ? left + lineWidth - word.x - word.width : left + word.x;
      ctx.save();
      ctx.globalAlpha = word.ink;
      ctx.translate(wordX + (word.width / 2), top + (lineHeight / 2) + (word.shift * fontSize));
      ctx.rotate((word.turn * Math.PI) / 180);
      ctx.direction = rtl[word.line] ? 'rtl' : 'ltr';
      ctx.textAlign = 'left';
      ctx.fillText(word.text, -word.width / 2, firstBaseline - (lineHeight / 2));
      ctx.restore();
    }
    ctx.restore();

    // FROM and the first name share a baseline.
    const nameSize = u * 6.4;
    const fromSize = u * 2.3;
    ctx.font = `${nameSize}px ${PEN}`;
    const rowBaseline = baselineIn(ctx, u * 97, nameSize, nameSize);
    ctx.font = `${fromSize}px ${SERIF}`;
    ctx.fillStyle = '#6a5f52';
    spacedText(ctx, 'FROM', u * 8, rowBaseline, fromSize * 0.24);
    const nameX = (u * 8) + spacedWidth(ctx, 'FROM', fromSize * 0.24) + (u * 2);
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = '#1b2a5c';
    const signed = drawableSignature(details.signature);
    if (signed) {
      // The signature's box: 48% of the card wide where the name starts, its line on the baseline.
      const k = (u * 100 * SIGNATURE_ON_CARD) / SIGNATURE_W;
      ctx.translate(nameX, rowBaseline - (SIGNATURE_LINE * k));
      ctx.scale(k, k);
      ctx.strokeStyle = SIGNATURE_INK;
      ctx.lineWidth = SIGNATURE_STROKE;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke(new Path2D(signaturePath(signed)));
    } else {
      ctx.font = `${nameSize}px ${PEN}`;
      ctx.fillText(firstNameOf(details.fromName), nameX, rowBaseline);
    }
    ctx.restore();

    const footSize = u * 1.9;
    ctx.font = `${footSize}px ${SERIF}`;
    ctx.fillStyle = '#8a7f70';
    spacedText(ctx, `PANTOPUS POST · CHRISTMAS ${card.year}`, width / 2, baselineIn(ctx, h - (u * 3.2) - footSize, footSize, footSize), footSize * 0.3, true);

    paperFinish(ctx, art.paper, width, h, u);
  });
}

/** A group of art, drawn off to one side, then laid on the table with one shadow under the whole of it. */
function envelopeGroup(ctx: Ctx, width: number, x: number, top: number, turn: number, extraTop: number, shadow: [number, number, number, string], draw: (group: Ctx, height: number) => void) {
  const height = (width * 1392) / 1200;
  const [canvas, group] = canvasOf(width, height + extraTop);
  group.translate(0, extraTop);
  draw(group, height);
  ctx.save();
  ctx.translate(x + (width / 2), top + (height / 2));
  ctx.rotate((turn * Math.PI) / 180);
  setShadow(ctx, shadow[0], shadow[1], shadow[2], shadow[3], turn);
  ctx.drawImage(canvas, -width / 2, (-height / 2) - extraTop, width, height + extraTop);
  ctx.restore();
}

/** The open envelope lying behind: inside lining, flap up, pocket. */
function openEnvelope(ctx: Ctx, art: Art, width: number, x: number, top: number, turn: number) {
  const flap = (width * 512) / 1200;
  envelopeGroup(ctx, width, x, top, turn, flap, [2, 5, 7, 'rgba(0, 0, 0, 0.5)'], (group, height) => {
    group.drawImage(art.flapIn, 0, -flap, width, flap);
    group.drawImage(art.inside, 0, 0, width, height);
    group.drawImage(art.pocketShadow, 0, 0, width, height);
    group.drawImage(art.pocket, 0, 0, width, height);
  });
}

function shutEnvelope(ctx: Ctx, art: Art, width: number, x: number, top: number, turn: number, sealWidth: number) {
  const flap = (width * 512) / 1200;
  envelopeGroup(ctx, width, x, top, turn, 0, [3, 8, 11, 'rgba(0, 0, 0, 0.55)'], (group, height) => {
    group.drawImage(art.pocket, 0, 0, width, height);
    group.drawImage(art.flapShadow, 0, 0, width, height);
    group.drawImage(art.flapOut, 0, 0, width, flap);
    const sealHeight = (sealWidth * art.wax.naturalHeight) / art.wax.naturalWidth;
    group.drawImage(art.wax, (width - sealWidth) / 2, (flap * 0.96) - (sealWidth * 0.5), sealWidth, sealHeight);
  });
}

/** The small paper slip: the name, in the mail's own world. It's how people find us, so it's in every picture. */
function paperSlip(ctx: Ctx, art: Art, x: number, y: number, turn: number, textWidth: number, h: number, nameSize: number, lineSize: number) {
  const left = h * 0.36;
  const w = textWidth + left;
  ctx.save();
  ctx.translate(x + (w / 2), y + (h / 2));
  ctx.rotate((turn * Math.PI) / 180);
  ctx.translate(-w / 2, -h / 2);
  ctx.save();
  setShadow(ctx, 1, 2, 5, 'rgba(0, 0, 0, 0.45)', turn);
  ctx.fillStyle = '#f4ead6';
  roundedRect(ctx, 0, 0, w, h, 1.5);
  ctx.fill();
  ctx.restore();
  ctx.save();
  roundedRect(ctx, 0, 0, w, h, 1.5);
  ctx.clip();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = tile(ctx, art.paper, 220);
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  const nameBox = nameSize * 1.1;
  const lineBox = lineSize * 1.25;
  const top = (h - (nameBox + lineBox)) / 2;
  ctx.fillStyle = '#3a2f26';
  ctx.font = `600 ${nameSize}px ${SERIF}`;
  spacedText(ctx, 'PANTOPUS POST', left, baselineIn(ctx, top, nameBox, nameSize), nameSize * 0.24);
  ctx.fillStyle = '#5b4d3f';
  ctx.font = `${lineSize}px ${SERIF}`;
  spacedText(ctx, 'Send one at pantopus.com/cards', left, baselineIn(ctx, top + nameBox, lineBox, lineSize), lineSize * 0.03);
  ctx.restore();
}

function doNotOpen(ctx: Ctx, left: number, top: number, fontSize: number) {
  const lines = ['DO NOT OPEN', 'UNTIL CHRISTMAS'];
  const spacing = fontSize * 0.11;
  ctx.save();
  ctx.font = `700 ${fontSize}px ${SERIF}`;
  const inner = Math.max(...lines.map((line) => spacedWidth(ctx, line, spacing)));
  const w = inner + (fontSize * 1.8) + 6;
  const lineBox = fontSize * 1.2;
  const h = (lineBox * 2) + (fontSize * 1.1) + 6;
  ctx.translate(left + (w / 2), top + (h / 2));
  ctx.rotate((-7 * Math.PI) / 180);
  ctx.translate(-w / 2, -h / 2);
  ctx.strokeStyle = '#ecd7a4';
  ctx.lineWidth = 1;
  roundedRect(ctx, 0.5, 0.5, w - 1, h - 1, 5.5);
  ctx.stroke();
  roundedRect(ctx, 2.5, 2.5, w - 5, h - 5, 3.5);
  ctx.stroke();
  ctx.fillStyle = '#ecd7a4';
  lines.forEach((line, i) => {
    spacedText(ctx, line, w / 2, baselineIn(ctx, 3 + (fontSize * 0.55) + (i * lineBox), lineBox, fontSize), spacing, true);
  });
  ctx.restore();
}

/** The one grey cloth, multiplied by the picture's colour. */
function tableCloth(ctx: Ctx, art: Art, tint: string, width: number, height: number) {
  const outW = width + 20;
  const outH = height + 20;
  const scale = Math.max(outW / art.cloth.naturalWidth, outH / art.cloth.naturalHeight);
  const w = art.cloth.naturalWidth * scale;
  const h = art.cloth.naturalHeight * scale;
  ctx.drawImage(art.cloth, (width - w) / 2, (height - h) / 2, w, h);
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

/** Morning light, the darker edges and the fine grain lie over everything. */
function tableLight(ctx: Ctx, art: Art, width: number, height: number) {
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  ctx.globalAlpha = 0.95;
  ctx.drawImage(art.light, -60, -60, width + 120, height + 120);
  ctx.restore();

  ctx.save();
  ctx.translate(width * 0.46, height * 0.4);
  ctx.scale(width * 1.2, height * 0.9);
  const vignette = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  vignette.addColorStop(0.44, 'rgba(6, 3, 4, 0)');
  vignette.addColorStop(1, 'rgba(6, 3, 4, 0.48)');
  ctx.fillStyle = vignette;
  ctx.fillRect(-2, -2, 4, 4);
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.34;
  ctx.fillStyle = tile(ctx, art.grain, 128);
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

type Art = {
  picture: HTMLImageElement;
  cloth: HTMLImageElement;
  light: HTMLImageElement;
  grain: HTMLImageElement;
  paper: HTMLImageElement;
  flapIn: HTMLImageElement;
  flapOut: HTMLImageElement;
  flapShadow: HTMLImageElement;
  inside: HTMLImageElement;
  pocket: HTMLImageElement;
  pocketShadow: HTMLImageElement;
  wax: HTMLImageElement;
};

async function loadArt(design: string, sealed: boolean): Promise<Art> {
  const [cloth, light, grain, paper, flapIn, flapOut, flapShadow, inside, pocket, pocketShadow, wax] = await Promise.all(
    ['table-cloth.webp', 'light.webp', 'grain.png', 'paper.webp', 'env-flap-in.webp', 'env-flap-out.webp', 'env-flap-shadow.webp',
      'env-inside.webp', 'env-pocket.webp', 'env-pocket-shadow.webp', 'wax-gold.webp'].map(artImage),
  );
  // A sealed card must not give its picture away: it isn't even fetched for this.
  const picture = sealed ? wax : await image(cardTrimmedPicture(design));
  return { picture, cloth, light, grain, paper, flapIn, flapOut, flapShadow, inside, pocket, pocketShadow, wax };
}

async function loadFonts() {
  await Promise.all([
    document.fonts?.load(`48px ${PEN}`, 'Dear friend').catch(() => {}),
    document.fonts?.load(`48px ${HAND}`, 'Come finish').catch(() => {}),
  ]);
}

/**
 * Story or Post as a JPEG. With `withNote`, the back of the card and the sender's first name are in it; without, neither is.
 * A sealed card is always the shut envelope, whatever is asked.
 */
export async function drawSharePicture(details: ShareDetails, format: 'story' | 'post', withNote: boolean): Promise<Blob> {
  const { card } = details;
  const [art] = await Promise.all([loadArt(card.design, card.sealed), loadFonts()]);
  const [width, height] = SIZES[format];
  const [canvas, ctx] = canvasOf(width, height);
  const story = format === 'story';
  const showNote = withNote && !card.sealed && Boolean(details.note.trim());

  // A bigger card (design plan 1.11): 800 of 1080 px in a Story, 760 in a Post. A Story keeps everything but the slip out
  // of Instagram's top 250 and bottom 340 px (here 125 and 170, drawn at half size).
  tableCloth(ctx, art, tableTint(card.table), width, height);
  if (card.sealed) {
    shutEnvelope(ctx, art, story ? 460 : 410, story ? 40 : 65, story ? 190 : 62, story ? -2.4 : -2.2, story ? 136 : 122);
    doNotOpen(ctx, story ? 96 : 118, story ? 506 : 352, story ? 21 : 18);
    if (story) paperSlip(ctx, art, 122, 776, -1.6, 296, 54, 13.5, 13.5);
    else paperSlip(ctx, art, 139, 606, -1.2, 262, 46, 12, 12);
  } else if (showNote) {
    const fit = measureNote(details.note);
    if (story) {
      openEnvelope(ctx, art, 372, 84, 300, 4);
      cardFront(ctx, details, art, 360, 16, 138, -4);
      cardBack(ctx, details, art, fit, 360, 164, 346, 3.2);
      paperSlip(ctx, art, 26, 806, -2.2, 250, 50, 12, 12.5);
    } else {
      openEnvelope(ctx, art, 300, 120, 150, 2.5);
      cardFront(ctx, details, art, 272, 6, 104, -3.2);
      cardBack(ctx, details, art, fit, 272, 262, 116, 2.8);
      paperSlip(ctx, art, 139, 612, -1.2, 262, 46, 12, 12);
    }
  } else if (story) {
    openEnvelope(ctx, art, 400 * 1.012, 68, 298, 2.4);
    cardFront(ctx, details, art, 400, 70, 302, -2.6);
    paperSlip(ctx, art, 122, 806, -1.6, 296, 54, 13.5, 13.5);
  } else {
    openEnvelope(ctx, art, 380 * 1.012, 78, 112, 3);
    cardFront(ctx, details, art, 380, 80, 110, -2.6);
    paperSlip(ctx, art, 139, 612, -1.2, 262, 46, 12, 12);
  }
  tableLight(ctx, art, width, height);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('This browser couldn\'t make the picture.'));
    }, 'image/jpeg', 0.92);
  });
}
