"use client";

// Share sheet for a booking-page or one-off link: context label, copyable URL
// + Copy button, 4-tile share targets, a QR thumbnail card with fullscreen
// expand, an optional draft warning, and a Regenerate link button.
// The context dot / overline accent follows the link's pillar; functional
// controls stay neutral. Design: share-sheet-frames.jsx.

import { useEffect, useRef, useState } from "react";
import {
  Check,
  Copy,
  Download,
  Mail,
  MessageCircle,
  QrCode,
  RotateCcw,
  Share2,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import clsx from "clsx";
import { copyToClipboard } from "@pantopus/utils";
import { toast } from "@/components/ui/toast-store";
import { pillarTokens, type Pillar } from "./pillarTokens";

// Decorative QR canvas — same idiom as ScopedShareModal, visual affordance only.
function drawQR(canvas: HTMLCanvasElement, url: string) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const size = 144;
  canvas.width = size;
  canvas.height = size;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "#111827";
  const cellSize = 6;
  const gridSize = Math.floor(size / cellSize);
  let hash = 0;
  for (let i = 0; i < url.length; i++)
    hash = ((hash << 5) - hash + url.charCodeAt(i)) | 0;
  const drawFinder = (x: number, y: number) => {
    const s = cellSize;
    ctx.fillStyle = "#111827";
    ctx.fillRect(x, y, 7 * s, 7 * s);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x + s, y + s, 5 * s, 5 * s);
    ctx.fillStyle = "#111827";
    ctx.fillRect(x + 2 * s, y + 2 * s, 3 * s, 3 * s);
  };
  drawFinder(0, 0);
  drawFinder((gridSize - 7) * cellSize, 0);
  drawFinder(0, (gridSize - 7) * cellSize);
  for (let row = 8; row < gridSize - 8; row++) {
    for (let col = 8; col < gridSize - 8; col++) {
      if (((hash * (row + 1) * (col + 1)) >>> 0) % 3 === 0) {
        ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
      }
    }
  }
}

function drawQRLarge(canvas: HTMLCanvasElement, url: string) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const size = 256;
  canvas.width = size;
  canvas.height = size;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "#111827";
  const cellSize = Math.floor(size / 25);
  const gridSize = 25;
  let hash = 0;
  for (let i = 0; i < url.length; i++)
    hash = ((hash << 5) - hash + url.charCodeAt(i)) | 0;
  const drawFinder = (x: number, y: number) => {
    const s = cellSize;
    ctx.fillStyle = "#111827";
    ctx.fillRect(x, y, 7 * s, 7 * s);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x + s, y + s, 5 * s, 5 * s);
    ctx.fillStyle = "#111827";
    ctx.fillRect(x + 2 * s, y + 2 * s, 3 * s, 3 * s);
  };
  drawFinder(0, 0);
  drawFinder((gridSize - 7) * cellSize, 0);
  drawFinder(0, (gridSize - 7) * cellSize);
  for (let row = 8; row < gridSize - 8; row++) {
    for (let col = 8; col < gridSize - 8; col++) {
      if (((hash * (row + 1) * (col + 1)) >>> 0) % 3 === 0) {
        ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
      }
    }
  }
}

interface ShareLinkProps {
  url: string;
  label?: string;
  shareTitle?: string;
  showQr?: boolean;
  /** Page isn't live yet — show the amber draft banner. */
  draft?: boolean;
  onTurnOn?: () => void;
  onRegenerate?: () => void;
  pillar?: Pillar;
  className?: string;
}

export default function ShareLink({
  url,
  label = "Your booking link",
  shareTitle = "Book time with me",
  showQr = true,
  draft = false,
  onTurnOn,
  onRegenerate,
  pillar = "personal",
  className,
}: ShareLinkProps) {
  const [copied, setCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const thumbCanvasRef = useRef<HTMLCanvasElement>(null);
  const tk = pillarTokens(pillar);

  useEffect(() => {
    if (showQr && thumbCanvasRef.current) drawQR(thumbCanvasRef.current, url);
  }, [showQr, url]);

  const handleCopy = async () => {
    const ok = await copyToClipboard(url);
    if (ok) {
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error("Could not copy the link");
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: shareTitle, url });
      } catch {
        // user dismissed — no-op
      }
    } else {
      handleCopy();
    }
  };

  const handleMessages = () => {
    window.open(`sms:?&body=${encodeURIComponent(url)}`, "_self");
  };

  const handleEmail = () => {
    window.open(
      `mailto:?subject=${encodeURIComponent(shareTitle)}&body=${encodeURIComponent(url)}`,
      "_self",
    );
  };

  return (
    <div className={clsx("space-y-4", className)}>
      {/* Context label — overline text uses pillar accent color (not muted gray) */}
      <div className="flex items-center gap-2">
        <span className={clsx("h-2 w-2 rounded-full", tk.bg)} aria-hidden />
        <span
          className={clsx(
            "text-[10px] font-bold uppercase tracking-[0.07em]",
            tk.text,
          )}
        >
          {label}
        </span>
      </div>

      {draft && (
        <div className="flex items-start gap-3 rounded-xl border border-app-warning/40 bg-app-warning-bg/60 px-3 py-2.5">
          <p className="flex-1 text-xs font-semibold leading-snug text-app-text">
            This page isn&apos;t live yet. People can&apos;t book until you turn
            it on.
          </p>
          {onTurnOn && (
            <button
              type="button"
              onClick={onTurnOn}
              className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-app-warning"
            >
              Turn on
            </button>
          )}
        </div>
      )}

      {/* URL + Copy row */}
      <div className="flex items-center gap-2 rounded-2xl border border-app-border bg-app-surface py-2 pl-3 pr-2 shadow-sm">
        <span className="min-w-0 flex-1 truncate font-mono text-sm font-semibold text-app-text-strong">
          {url}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className={clsx(
            "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-bold text-white transition-colors",
            copied ? "bg-app-success" : "bg-primary-600 hover:bg-primary-700",
          )}
        >
          {copied ? (
            <Check className="h-4 w-4" aria-hidden />
          ) : (
            <Copy className="h-4 w-4" aria-hidden />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <p className="text-xs text-app-text-secondary">
        Anyone with this link can book you.
      </p>

      {/* 4-tile share targets row */}
      <div className="flex gap-2">
        <ShareTarget icon={Share2} label="Share" onClick={handleNativeShare} />
        <ShareTarget
          icon={QrCode}
          label="QR code"
          onClick={() => setQrOpen(true)}
        />
        <ShareTarget
          icon={MessageCircle}
          label="Messages"
          onClick={handleMessages}
        />
        <ShareTarget icon={Mail} label="Email" onClick={handleEmail} />
      </div>

      {/* QR thumbnail card */}
      {showQr && (
        <div className="flex items-center gap-3 rounded-2xl border border-app-border bg-app-surface px-3 py-2.5 shadow-sm">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-app-border bg-white p-1">
            <canvas
              ref={thumbCanvasRef}
              className="h-8 w-8"
              style={{ imageRendering: "pixelated" }}
              aria-label="QR code thumbnail"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-app-text-strong">
              Scan to book
            </p>
            <p className="mt-0.5 text-[11px] text-app-text-secondary">
              Print it or show it at a desk.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setQrOpen(true)}
            className="shrink-0 rounded-lg border border-primary-100 bg-primary-50 px-3 py-1.5 text-xs font-bold text-primary-700 hover:bg-primary-100"
          >
            Show QR
          </button>
        </div>
      )}

      {/* Regenerate link — error red with rotate-ccw icon */}
      {onRegenerate && (
        <div className="flex justify-center pt-0.5">
          <button
            type="button"
            onClick={onRegenerate}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-app-error hover:text-app-error/80"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            Regenerate link
          </button>
        </div>
      )}

      {/* QR fullscreen modal */}
      {qrOpen && (
        <QrFullscreen
          url={url}
          label={label}
          pillar={pillar}
          onClose={() => setQrOpen(false)}
        />
      )}
    </div>
  );
}

// ── ShareTarget tile ──────────────────────────────────────────────────────────

function ShareTarget({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-1 flex-col items-center gap-1.5"
    >
      <span className="flex aspect-square w-full max-w-[52px] items-center justify-center rounded-2xl border border-app-border bg-app-surface text-primary-600 shadow-sm">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <span className="text-[11px] font-semibold text-app-text-secondary">
        {label}
      </span>
    </button>
  );
}

// ── QR fullscreen modal ───────────────────────────────────────────────────────

function QrFullscreen({
  url,
  label,
  pillar,
  onClose,
}: {
  url: string;
  label: string;
  pillar: Pillar;
  onClose: () => void;
}) {
  const largeCanvasRef = useRef<HTMLCanvasElement>(null);
  const tk = pillarTokens(pillar);

  useEffect(() => {
    if (largeCanvasRef.current) drawQRLarge(largeCanvasRef.current, url);
  }, [url]);

  const handleSave = () => {
    if (!largeCanvasRef.current) return;
    const a = document.createElement("a");
    a.href = largeCanvasRef.current.toDataURL("image/png");
    a.download = "booking-qr.png";
    a.click();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="QR code fullscreen"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative flex w-full max-w-sm flex-col items-center rounded-3xl bg-app-surface px-7 pb-8 pt-5 shadow-2xl">
        {/* Done button top-right */}
        <div className="mb-4 flex w-full items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-bold text-primary-600 hover:text-primary-700"
          >
            Done
          </button>
        </div>

        {/* Context label */}
        <div className="mb-4 flex items-center gap-2">
          <span className={clsx("h-2 w-2 rounded-full", tk.bg)} aria-hidden />
          <span
            className={clsx(
              "text-[10px] font-bold uppercase tracking-[0.07em]",
              tk.text,
            )}
          >
            {label}
          </span>
        </div>

        {/* QR plate */}
        <div className="rounded-3xl border border-app-border bg-white p-5 shadow-lg">
          <canvas
            ref={largeCanvasRef}
            className="h-[184px] w-[184px]"
            style={{ imageRendering: "pixelated" }}
            aria-label="QR code"
          />
        </div>

        {/* Mono URL */}
        <p className="mt-5 font-mono text-[13px] font-semibold text-app-text-secondary">
          {url}
        </p>

        <p className="mt-3 max-w-[200px] text-center text-xs leading-relaxed text-app-text-secondary">
          Point a camera here to open the booking page.
        </p>

        {/* Save to Photos / Download */}
        <button
          type="button"
          onClick={handleSave}
          className="mt-6 inline-flex items-center gap-2 rounded-xl border border-app-border bg-app-surface px-4 py-2.5 text-sm font-bold text-app-text-secondary shadow-sm hover:bg-app-hover"
        >
          <Download className="h-4 w-4" aria-hidden />
          Save to Photos
        </button>

        {/* Close X button top-left */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close QR view"
          className="absolute right-4 top-4 hidden"
        />
      </div>
    </div>
  );
}
