// ============================================================
// UNLISTED — "get my address off the internet" (Wave 4)
//
// Two halves of one contract:
//   GET  /api/public/unlisted?address=…            anonymous (T0)
//   GET  /api/homes/:id/unlisted                   claimed home + progress
//   PUT  /api/homes/:id/unlisted/removals/:brokerId
//
// WHAT THIS IS NOT: a scan. We never query a people-search site with
// someone's address — doing so would disclose that address to the exact
// company they are trying to leave. Nothing in these types asserts that
// a person IS listed anywhere, and no such field may ever be added.
// `method_note` carries that sentence from the server and the UI must
// render it verbatim; without it the page implies a lookup it never
// performed.
//
// The anonymous half persists NOTHING — the address resolves to a state
// and the profile returned is identical for everyone in that state (it
// is law and a public registry, not anything about the person).
// ============================================================

import { get, put } from '../client';

/** How a broker wants the opt-out submitted. */
export type UnlistedRemovalMethod =
  | 'web_form'
  | 'email'
  | 'phone'
  | 'mail'
  | 'account_required';

/** Where the resident has got to with one broker. Their bookkeeping, not our claim. */
export type UnlistedRemovalStatus = 'todo' | 'requested' | 'confirmed' | 'relisted';

export const UNLISTED_REMOVAL_STATUSES: readonly UnlistedRemovalStatus[] = [
  'todo',
  'requested',
  'confirmed',
  'relisted',
] as const;

export interface UnlistedBroker {
  /** Stable kebab-case slug — removal rows key on it. */
  id: string;
  name: string;
  category: string;
  /** Tokens resolved through `exposure_labels`. */
  exposes: string[];
  opt_out_url: string;
  method: UnlistedRemovalMethod;
  requires_id: boolean;
  requires_email: boolean;
  /**
   * Stated processing time. ZERO MEANS UNSTATED, not instant — render
   * it as "no time stated", never as "0 days".
   */
  typical_days: number;
  /**
   * The caveat the person actually needs: a form behind bot protection,
   * a flow where only step one was verified, a site that relists you.
   * Render it in full — truncating it away is the whole value.
   */
  note: string;
  source_url: string;
  verified_at: string;
}

export interface UnlistedBrokerGroup {
  category: string;
  label: string;
  brokers: UnlistedBroker[];
}

/**
 * The state's Address Confidentiality Program — a legal substitute
 * address that fixes the exposure at the SOURCE. It outranks every
 * opt-out link on the page and must be rendered above them.
 *
 * `exists: false` means we CHECKED and the state runs none; `eligibility`
 * then carries what it does offer instead. A missing StateProgram (null
 * on the profile) is a different claim entirely — see `state_program`.
 */
export interface UnlistedStateProgram {
  /**
   * OPTIONAL on purpose. `true` = we verified a program, `false` = we
   * verified there is none, and ABSENT = we could not read it — which
   * must render as "unconfirmed", exactly like a null state_program.
   * Typing this as a plain boolean let `undefined` fall through a
   * falsy check into a confident "your state has none".
   */
  exists?: boolean;
  name: string;
  url: string;
  /** One sentence: who qualifies — or, when `exists` is false, what the state offers instead. */
  eligibility: string;
  source_url: string;
  verified_at: string;
}

export interface UnlistedProfile {
  state: string | null;
  /**
   * NULL MEANS WE DID NOT CHECK THIS STATE. It must never be collapsed
   * with `{ exists: false }` — telling someone in danger that no help
   * exists when we simply did not look is the worst failure this page
   * can have.
   */
  state_program: UnlistedStateProgram | null;
  groups: UnlistedBrokerGroup[];
  broker_count: number;
  /** exposure token -> human label. */
  exposure_labels: Record<string, string>;
  /**
   * The honesty line. MUST be rendered visibly near the broker list,
   * verbatim — it is the sentence that says we did not look anyone up.
   */
  method_note: string;
  registry_verified_at: string | null;
}

export interface UnlistedRemoval {
  broker_id: string;
  status: UnlistedRemovalStatus;
  requested_at: string | null;
  confirmed_at: string | null;
}

/**
 * The claimed-home profile. `removals` is:
 *   Removal[]  — the resident's progress (`[]` = nothing done yet)
 *   null       — THE READ FAILED. An empty checklist is a confident
 *                claim we cannot make when we could not read the rows,
 *                so the UI must say so rather than render zero progress.
 */
export interface UnlistedHomeProfile extends UnlistedProfile {
  removals: UnlistedRemoval[] | null;
}

export interface PublicUnlisted {
  /**
   * `could_not_place` is NOT `unsupported_region`, and the difference is
   * the whole point: one means we could not read a state out of what was
   * typed, the other means the address resolved somewhere we have no law
   * for. Collapsing them told US residents the product was not for them.
   *
   * `could_not_place` still carries the full `unlisted` profile — every
   * removal path is national and never needed the address — with
   * `state_program: null`, which renders as "not confirmed", never as
   * "your state has none".
   */
  status: 'ready' | 'could_not_place' | 'unsupported_region';
  tier: 'preview';
  /** Present on `could_not_place` and `unsupported_region`. */
  message?: string;
  /**
   * State only. `city` is always null on the anonymous route: resolving
   * one would mean a third-party geocode, and the page promises the
   * typed address is not sent anywhere.
   */
  place?: { city: string | null; state: string | null };
  unlisted?: UnlistedProfile;
  disclaimer?: string;
}

/**
 * GET /api/public/unlisted?address=… — no account, and NOTHING is
 * persisted. Only the state is used; the address is not stored, not
 * logged with the result, and not sent to any third party.
 */
export async function getPublicUnlisted(address: string): Promise<PublicUnlisted> {
  return get<PublicUnlisted>('/api/public/unlisted', { address });
}

/**
 * GET /api/homes/:id/unlisted — the state profile plus THIS caller's
 * own progress. Home access only (not verification): someone who just
 * claimed their address is exactly who needs this.
 */
export async function getHomeUnlisted(homeId: string): Promise<UnlistedHomeProfile> {
  const res = await get<{ unlisted: UnlistedHomeProfile }>(`/api/homes/${homeId}/unlisted`);
  return res.unlisted;
}

/**
 * PUT /api/homes/:id/unlisted/removals/:brokerId — record a step the
 * resident took on the broker's own site. Pantopus never submits an
 * opt-out on anyone's behalf; this is their bookkeeping.
 *
 * 400 `UNKNOWN_BROKER` / `BAD_STATUS` on a bad input.
 */
export async function setRemovalStatus(
  homeId: string,
  brokerId: string,
  status: UnlistedRemovalStatus,
): Promise<UnlistedRemoval> {
  const res = await put<{ removal: UnlistedRemoval }>(
    `/api/homes/${homeId}/unlisted/removals/${encodeURIComponent(brokerId)}`,
    { status },
  );
  return res.removal;
}
