'use client';

import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy, PDFDocumentLoadingTask, RenderTask } from 'pdfjs-dist';
import { createPortal } from 'react-dom';
import LivePhotoTile from '../feed/LivePhotoTile';
import { useChatMedia } from '@/hooks/useChatMedia';

interface ImageLightboxProps {
  currentUserId?: string | null;
  roomId?: string;
  imageUrl: string | null;
  title?: string;
  mimeType?: string;
  liveUrl?: string;
  onClose: () => void;
}

export default function ImageLightbox({ imageUrl, currentUserId, roomId, title, mimeType, liveUrl, onClose }: ImageLightboxProps) {
  const media = useChatMedia(imageUrl, currentUserId, roomId);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!imageUrl) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [imageUrl, onClose]);

  if (!mounted || !imageUrl) return null;

  // Rendered into document.body, as the feed's post panel and the home slide panel are: inside the app's <main> (its
  // own stacking context) the viewer stayed under the header and sidebar, and the header covered its close button.
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80"
      role="dialog"
      aria-modal="true"
      aria-label="Attachment viewer"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors z-10"
        aria-label="Close attachment"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Title */}
      {title && (
        <div className="absolute top-4 left-4 text-white text-sm bg-black/50 px-3 py-1.5 rounded-lg z-10">
          {title}
        </div>
      )}

      {!media.url ? <div role="status" className="rounded-lg bg-white p-4 text-gray-900" onClick={event => event.stopPropagation()}>
        {media.loading ? 'Loading attachment…' : <>This attachment is unavailable. <button type="button" className="underline" onClick={media.retry}>Retry</button></>}
      </div> : mimeType === 'application/pdf' ? (
        <ChatPdfPreview key={media.url} url={imageUrl} savedUrl={media.url} title={title} />
      ) : liveUrl ? (
        <div onClick={e => e.stopPropagation()}>
          <LivePhotoTile stillUrl={media.url} videoUrl={liveUrl} privateMedia fit="contain" showsReplayPill showsDot={false} className="h-[85vh] w-[90vw]" />
        </div>
      ) : (
      /* Native img: arbitrary chat URLs; avoids next/image dev sizing warnings in lightbox. */
      <img
        src={media.url}
        onError={media.rejectMedia}
        alt={title || 'Image preview'}
        className="rounded-lg shadow-2xl"
        style={{
          width: 'auto',
          height: 'auto',
          maxWidth: '90vw',
          maxHeight: '90vh',
          objectFit: 'contain',
        }}
        onClick={e => e.stopPropagation()}
      />
      )}
    </div>,
    document.body,
  );
}


/** Render pixels, never uploaded HTML, scripts, links, forms or embedded files. */
function ChatPdfPreview({ url, savedUrl, title }: { url: string; savedUrl: string; title?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [rendering, setRendering] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    let loadingTask: PDFDocumentLoadingTask | undefined;
    let disposed = false;
    const load = async () => {
      try {
        // Only this same-origin, authorized endpoint may supply a private PDF.
        // Reject redirects so no storage URL or unrelated origin reaches the viewer.
        const source = new URL(url, window.location.origin);
        if (source.origin !== window.location.origin || !/^\/api\/chat\/files\/[0-9a-f-]+$/i.test(source.pathname)) {
          throw new Error('Unsupported document address');
        }
        const response = await fetch(savedUrl.startsWith('blob:') ? savedUrl : source, {
          credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: controller.signal,
        });
        if (!response.ok || response.headers.get('content-type')?.split(';')[0].trim() !== 'application/pdf') {
          throw new Error('PDF unavailable');
        }
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (bytes.length > 25 * 1024 * 1024 || new TextDecoder().decode(bytes.subarray(0, 5)) !== '%PDF-') {
          throw new Error('Invalid PDF');
        }
        const pdfjs = await import('pdfjs-dist');
        if (disposed) return;
        pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
        loadingTask = pdfjs.getDocument({
          data: bytes, enableXfa: false,
          maxImageSize: 16_000_000, canvasMaxAreaInBytes: 16 * 1024 * 1024,
        });
        // Password entry and embedded actions belong in a dedicated document app.
        loadingTask.onPassword = () => {
          if (!disposed) setError('This PDF needs a password. Download it to open it.');
          void loadingTask?.destroy();
        };
        const loaded = await loadingTask.promise;
        if (!disposed) setDocument(loaded);
      } catch {
        if (!disposed) setError(current => current ?? 'This PDF could not be previewed. You can download it instead.');
      }
    };
    void load();
    return () => {
      disposed = true;
      controller.abort();
      void loadingTask?.destroy();
    };
  }, [url, savedUrl]);

  useEffect(() => {
    if (!document || !canvasRef.current) return;
    let disposed = false;
    let renderTask: RenderTask | undefined;
    setRendering(true);
    const render = async () => {
      try {
        const pdfPage = await document.getPage(page);
        if (disposed || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const original = pdfPage.getViewport({ scale: 1 });
        // Bound both dimensions and pixel count for unusually large pages.
        const scale = Math.min(2, 1600 / original.width, 2000 / original.height);
        const viewport = pdfPage.getViewport({ scale });
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        renderTask = pdfPage.render({ canvas, viewport, annotationMode: 0 });
        await renderTask.promise;
        if (!disposed) setRendering(false);
      } catch {
        if (!disposed) setError('This PDF could not be previewed. You can download it instead.');
      }
    };
    void render();
    return () => { disposed = true; renderTask?.cancel(); };
  }, [document, page]);

  return (
    <div className="flex h-[85vh] w-[min(90vw,1100px)] flex-col overflow-hidden rounded-lg bg-white text-gray-900" onClick={e => e.stopPropagation()}>
      <div className="flex flex-wrap items-center justify-center gap-4 border-b p-3">
        <button type="button" disabled={!document || page <= 1} onClick={() => { setRendering(true); setPage(value => value - 1); }} className="disabled:opacity-40">Previous page</button>
        <span aria-live="polite">{document ? `Page ${page} of ${document.numPages}` : 'PDF document'}</span>
        <button type="button" disabled={!document || page >= document.numPages} onClick={() => { setRendering(true); setPage(value => value + 1); }} className="disabled:opacity-40">Next page</button>
        <a href={savedUrl} download={title || 'document.pdf'} className="underline">Download PDF</a>
      </div>
      <div className="relative flex-1 overflow-auto bg-gray-100 p-3">
        {error ? <p role="alert">{error}</p> : <>
          {rendering && <p role="status">Loading PDF…</p>}
          <canvas ref={canvasRef} role="img" aria-label={`${title || 'PDF document'}, page ${page}`} className={`mx-auto h-auto max-w-full bg-white ${rendering ? 'invisible' : ''}`} />
        </>}
      </div>
    </div>
  );
}
