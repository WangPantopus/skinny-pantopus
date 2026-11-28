// ============================================================
// Structured data for the Christmas card pages (SEO build, SPEC §5): what search engines read about /cards, each
// collection and each card. Data only: the pages print it in a <script type="application/ld+json"> and draw nothing
// new. Built from the same answer the page draws (fetchPublicCardDesigns), at the same address the page's canonical
// link uses (APP_WEB_URL), so it never names a card or a collection the page doesn't show.
// ============================================================

import { APP_WEB_URL } from '@pantopus/utils';
import type { PublicCardDesigns } from '@/lib/publicShare';

type Design = PublicCardDesigns['designs'][number] & { kind?: 'thank_you' };
type Collection = NonNullable<PublicCardDesigns['collections']>[number];

const abs = (path: string) => `${APP_WEB_URL}${path}`;

const PUBLISHER = { '@type': 'Organization', name: 'Pantopus', url: abs('/') };

/** JSON for a <script type="application/ld+json">, with `<` escaped so no caption can close the script. */
export function cardsJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

/** The cards in the order /cards draws them: shelf by shelf while the shelves are on, else the designs' order. */
export function cardsInPageOrder(designs: Design[], collections: Collection[], shelves: boolean): Design[] {
  if (!shelves) return designs;
  const byId = new Map(designs.map((d) => [d.id, d]));
  return collections.flatMap((c) => c.designs.flatMap((id) => byId.get(id) ?? []));
}

/** An ItemList of cards, each to its own page: /cards, or one collection. */
export function cardListLd({ name, path, designs }: { name: string; path: string; designs: Design[] }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    url: abs(path),
    numberOfItems: designs.length,
    itemListElement: designs.map((d, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: abs(`/cards/${d.slug}`),
      name: d.caption,
    })),
  };
}

/** `text` cut at a word, with an ellipsis, when it is longer than `max` characters. */
function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max).replace(/[\s,;:.]+\S*$/, '')}…`;
}

/** Another card with the same words on it (two of the verse cards share a verse): its title and description add the card's number. */
export function hasTwin(design: Design, designs: Design[]): boolean {
  return designs.some((other) => other.id !== design.id && other.caption === design.caption);
}

/**
 * One card's description for search engines: the card's own words (a verse card's reference and the start of its
 * verse), the collection it is in, and how it is sent. Each card's is its own, where every card once shared one line.
 */
export function cardDescription(design: Design, collection: Collection | null, twin = false): string {
  const words = design.verse ? `${design.caption}: “${clip(design.verse, 50)}”` : `“${design.caption}”`;
  const from = collection ? ` from the ${collection.name} collection` : '';
  // A verse card's own words fill the line; the others also say how the card arrives.
  return `${words} A ${design.kind === 'thank_you' ? 'thank-you card' : 'Christmas card'}${from}${twin ? ` (card ${design.number})` : ''} to send online on Pantopus.${design.verse ? '' : ' It arrives with their morning mail.'}`;
}

/** One collection's description: how many cards it holds, and its own line. */
export function collectionDescription(collection: Collection, thanks = false): string {
  const count = collection.designs.length;
  return `${collection.name}: ${count} ${thanks ? 'thank-you' : 'Christmas'} ${count === 1 ? 'card' : 'cards'} to send online on Pantopus.${collection.line ? ` ${collection.line}` : ''}`;
}

/** The trail to a card or a collection: Pantopus › Christmas cards › its collection (while the shelves are on) › the card. */
export function cardTrailLd(steps: { name: string; path: string }[], rootName = 'Christmas cards') {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [{ name: 'Pantopus', path: '/' }, { name: rootName, path: '/cards' }, ...steps].map((step, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: step.name,
      item: step.path === '/' ? APP_WEB_URL : abs(step.path),
    })),
  };
}

/** What one card is: a Christmas card by Pantopus, its picture, and the collection it belongs to. */
export function cardLd({ design, collection, shelves, twin = false }: { design: Design; collection: Collection | null; shelves: boolean; twin?: boolean }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: design.caption,
    description: cardDescription(design, collection, twin),
    url: abs(`/cards/${design.slug}`),
    image: abs(`/holiday-cards/${design.id}.jpg`),
    thumbnailUrl: abs(`/holiday-cards/${design.id}-thumb.jpg`),
    genre: design.kind === 'thank_you' ? 'Thank-you card' : 'Christmas card',
    inLanguage: 'en',
    publisher: PUBLISHER,
    ...(collection
      ? {
          isPartOf: {
            '@type': 'Collection',
            name: collection.name,
            // A collection has a page of its own only while the shelves are on.
            ...(shelves && collection.slug ? { url: abs(`/cards/collection/${collection.slug}`) } : {}),
          },
        }
      : {}),
  };
}

/** The collection a card is in, by the collections' own lists. */
export function collectionOf(design: Design, collections: Collection[]): Collection | null {
  return collections.find((c) => c.designs.includes(design.id)) ?? null;
}
