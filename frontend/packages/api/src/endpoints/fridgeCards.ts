// ============================================================
// FRIDGE CARDS — the 911-ready household card (Wave 1, #2)
//
// A verified home manager freezes a card — the exact verified address
// (server-derived) plus the facts the household chose: members and
// allergies, meds, pets, shutoffs, contacts — behind an unguessable
// code. Whoever holds the link (babysitter, house-sitter, the printout
// on the fridge) sees it while it is active; revocation pulls the
// content entirely. It is NOT delivered to 911 dispatch.
//
// Cards are HOUSEHOLD documents: any member of the home can list them.
// ============================================================

import { get, post } from '../client';

export type FridgeCardSectionKey = 'household' | 'medical' | 'pets' | 'utilities' | 'contacts' | 'notes';
export type FridgeCardStatus = 'active' | 'revoked';

export interface FridgeCardItem {
  label: string;
  note: string;
}

export interface FridgeCardSection {
  key: FridgeCardSectionKey;
  items: FridgeCardItem[];
}

export interface FridgeCardContent {
  /** Server-derived from the verified home — never client input. */
  address: { line1: string; city_state_zip: string };
  sections: FridgeCardSection[];
}

export interface FridgeCard {
  id: string;
  home_id: string;
  label: string | null;
  status: FridgeCardStatus;
  card_code: string;
  card_url: string;
  content: FridgeCardContent;
  issued_at: string;
  revoked_at: string | null;
  view_count: number;
  last_viewed_at: string | null;
}

/** Public card fetch result — content only while active. */
export interface FridgeCardPublic {
  valid: boolean;
  status?: FridgeCardStatus;
  label?: string | null;
  content?: FridgeCardContent;
  issued_at?: string;
  revoked_at?: string | null;
}

/** POST /api/homes/:id/fridge-cards — issue (verified home managers only). */
export async function issueFridgeCard(
  homeId: string,
  sections: FridgeCardSection[],
  label?: string,
): Promise<FridgeCard> {
  const res = await post<{ card: FridgeCard }>(`/api/homes/${homeId}/fridge-cards`, { sections, label });
  return res.card;
}

/** GET /api/homes/:id/fridge-cards — the home's cards, any member. */
export async function listFridgeCards(homeId: string): Promise<FridgeCard[]> {
  const res = await get<{ cards: FridgeCard[] }>(`/api/homes/${homeId}/fridge-cards`);
  return res.cards;
}

/** POST .../:cardId/revoke — pulls the card's public content immediately. */
export async function revokeFridgeCard(homeId: string, cardId: string): Promise<FridgeCard> {
  const res = await post<{ card: FridgeCard }>(`/api/homes/${homeId}/fridge-cards/${cardId}/revoke`);
  return res.card;
}

/** GET /api/public/fridge-cards/:code — the anonymous card page. */
export async function getPublicFridgeCard(code: string): Promise<FridgeCardPublic> {
  return get<FridgeCardPublic>(`/api/public/fridge-cards/${encodeURIComponent(code)}`);
}
