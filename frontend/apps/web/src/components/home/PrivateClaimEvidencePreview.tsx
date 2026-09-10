'use client';

import { useState } from 'react';

export type EvidencePreview =
  | { kind: 'text'; text: string }
  | { kind: 'pdf' | 'image'; bytes: Blob; extension: string };

function readFile(bytes: Blob, text: true): Promise<string>;
function readFile(bytes: Blob, text: false): Promise<ArrayBuffer>;
function readFile(bytes: Blob, text: boolean): Promise<string | ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read this document. Open it again.'));
    reader.onload = () => reader.result === null
      ? reject(new Error('This document is empty.')) : resolve(reader.result);
    if (text) reader.readAsText(bytes, 'UTF-8');
    else reader.readAsArrayBuffer(bytes);
  });
}

/** Never put arbitrary uploaded content into a same-origin HTML browsing context. */
export async function prepareEvidencePreview(bytes: Blob): Promise<EvidencePreview> {
  if (!bytes.size || bytes.size > 25 * 1024 * 1024) throw new Error('This document must be between 1 byte and 25 MB.');
  const mime = bytes.type.split(';')[0].trim().toLowerCase();
  const extensions: Record<string, string> = {
    'application/pdf': 'pdf', 'text/plain': 'txt', 'image/jpeg': 'jpg', 'image/png': 'png',
    'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif',
  };
  if (!extensions[mime]) throw new Error('This document type cannot be safely previewed.');
  const data = new Uint8Array(await readFile(bytes, false));
  const starts = (signature: number[], offset = 0) => signature.every((value, index) => data[offset + index] === value);
  const ascii = (value: string, offset = 0) => starts([...value].map(char => char.charCodeAt(0)), offset);
  const valid = mime === 'text/plain' ? !data.includes(0)
    : mime === 'application/pdf' ? ascii('%PDF-')
      : mime === 'image/jpeg' ? starts([255, 216, 255])
        : mime === 'image/png' ? starts([137, 80, 78, 71, 13, 10, 26, 10])
          : mime === 'image/webp' ? ascii('RIFF') && ascii('WEBP', 8)
            : ascii('ftyp', 4) && ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].some(brand => ascii(brand, 8));
  if (!valid) throw new Error('The document content does not match its file type.');
  if (mime === 'text/plain') return { kind: 'text', text: await readFile(bytes, true) };
  return { kind: mime === 'application/pdf' ? 'pdf' : 'image', bytes: bytes.slice(0, bytes.size, mime), extension: extensions[mime] };
}

export default function PrivateClaimEvidencePreview({ preview, url }: { preview: EvidencePreview; url: string | null }) {
  const [imageFailed, setImageFailed] = useState(false);
  if (preview.kind === 'text') return <pre title="Private claim evidence" className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded border p-3 text-sm">{preview.text}</pre>;
  if (!url) return null;
  return <div className="space-y-2">
    {preview.kind === 'pdf' ? <object data={url} type="application/pdf" title="Private claim evidence" className="h-80 w-full rounded border">
      <p>The PDF preview is unavailable in this browser. Download the document below to inspect it.</p>
    </object> : imageFailed ? <p>This browser could not display the image. Download it below to inspect it.</p>
      // These are authenticated, validated in-memory bytes, not an optimizable public image URL.
      // eslint-disable-next-line @next/next/no-img-element
      : <img src={url} title="Private claim evidence" alt="Private claim evidence" className="max-h-80 max-w-full rounded border object-contain" onError={() => setImageFailed(true)} />}
    <p className="text-xs">If the preview is unavailable, <a href={url} download={`claim-evidence.${preview.extension}`} className="underline">download this document</a> to inspect it. Only confirm verification after inspecting the document.</p>
  </div>;
}
