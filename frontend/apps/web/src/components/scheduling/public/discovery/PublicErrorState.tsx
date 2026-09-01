"use client";

// Error + retry for the public discovery pages when the server-side page read
// fails unexpectedly (5xx / network). Retry re-runs the server render via
// router.refresh(). Calm, centered, mirrors the W0 state chrome.

import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";

export default function PublicErrorState({
  message = "We couldn't load this page. Please try again.",
}: {
  message?: string;
}) {
  const router = useRouter();
  return (
    <main className="flex min-h-screen items-center justify-center bg-app px-6 py-16 text-app">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-app-error-bg">
          <AlertTriangle className="h-7 w-7 text-app-error" aria-hidden />
        </div>
        <h1 className="text-lg font-bold text-app-text-strong">
          Something went wrong
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-app-text-secondary">
          {message}
        </p>
        <button
          type="button"
          onClick={() => router.refresh()}
          className="mt-6 rounded-lg border border-app-border bg-app-surface px-4 py-2 text-sm font-semibold text-app-text hover:bg-app-hover"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
