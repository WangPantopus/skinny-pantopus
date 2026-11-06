import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Poll, PollOption } from "@pantopus/types";
import {
  buildShareMetadata,
  fetchPublicPoll,
  getStoreDownloadCta,
  summarizeText,
} from "@/lib/publicShare";
import PollResponse from "@/components/scheduling/home/find-a-time/PollResponse";

// F6 — Member Poll Response (public). Server component for SEO + generateMetadata
// (mirrors support-trains/[id]); the interactive voting lives in the PollResponse
// client component. Public route, outside the (app) auth group.

export const dynamic = "force-dynamic";

type PollPayload = {
  poll?: Poll | null;
  options?: PollOption[] | null;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const result = await fetchPublicPoll(id);
  const poll = (result.data as PollPayload | null)?.poll;

  if (!poll) {
    return {
      title: "Poll Not Available | Pantopus",
      description: "This scheduling poll could not be found.",
    };
  }

  return buildShareMetadata({
    title: poll.title || "Find a time",
    description: summarizeText(
      poll.description || "Mark which times work for you on Pantopus.",
      160,
      "Mark which times work for you on Pantopus.",
    ),
    path: `/poll/${id}`,
  });
}

export default async function PublicPollPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await fetchPublicPoll(id);
  const payload = result.data as PollPayload | null;
  const poll = payload?.poll ?? null;
  const options = payload?.options ?? [];

  if (!poll && result.status === 404) {
    notFound();
  }

  const userAgent = (await headers()).get("user-agent") || "";
  const storeCta = getStoreDownloadCta(userAgent);

  if (!poll) {
    return (
      <main className="min-h-screen bg-app text-app">
        <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 text-center">
          <p className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-app-text-secondary">
            Scheduling Poll
          </p>
          <h1 className="mt-6 text-2xl font-semibold tracking-tight text-app">
            This poll isn&apos;t available
          </h1>
          <p className="mt-3 text-sm leading-7 text-app-text-secondary">
            The link may have expired or been removed.
          </p>
          <Link
            href="/"
            className="mt-8 rounded-full border border-app px-5 py-2.5 text-sm font-semibold text-app hover:bg-surface-muted"
          >
            Back to Pantopus
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-app text-app">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 py-6 sm:px-6">
        <div className="mb-5 flex items-center justify-between">
          <Link
            href="/"
            className="text-sm font-semibold text-app hover:opacity-80"
          >
            Pantopus
          </Link>
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-app-text-secondary">
            Find a time
          </span>
        </div>

        <PollResponse pollId={id} poll={poll} options={options} />

        {storeCta ? (
          <div className="mt-8 border-t border-app pt-5 text-center">
            <p className="text-xs text-app-text-secondary">
              Coordinate household plans in the app.
            </p>
            <a
              href={storeCta.href}
              className="mt-3 inline-block rounded-full border border-app px-4 py-2 text-sm font-semibold text-app hover:bg-surface-muted"
            >
              {storeCta.label}
            </a>
          </div>
        ) : null}
      </div>
    </main>
  );
}
