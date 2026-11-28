import type { MetadataRoute } from 'next';
import { API_BASE_URL } from '@pantopus/utils';
import { isLaunchCutPath } from '@/lib/featureFlags';
import { fetchPublicCardDesigns, openThankYou, publicShelvesOn } from '@/lib/publicShare';
import { GUIDE_PAGES } from '@/lib/site/guidePages';
import { GUIDES } from '@/lib/site/guides';
import { PILLAR_PAGES } from '@/lib/site/pillarPages';

// The pages search engines may read, at the address every page's canonical link uses. robots.ts points to this file
// in production only; staging and local builds tell search engines to stay out, whatever is listed here.
//
// The county and city pages come from the backend's list (backend/services/countyGuide), kept an hour, so a release is listed
// within the hour. Built per request so a backend that can't answer leaves the county pages out of one answer only.
export const dynamic = 'force-dynamic';

const SITE_URL = 'https://pantopus.com';

// Public pages anyone can read, signed in or not (robots.ts keeps the private paths out).
const PUBLIC_PAGES = [
  '/', '/start', '/tax-check', '/cards', '/download', '/pricing', '/help', '/register', '/login',
  '/about', '/about/data-sources', '/contact', '/privacy', '/terms', '/child-safety', '/delete-account',
];

// The day each guide's facts were last read again (its own `checked` date, printed on the page): the one "last
// changed" date the site can state truthfully. Other pages carry none; a date that only says "today" teaches a search
// engine to ignore the field.
const GUIDE_CHECKED = new Map(GUIDES.map((guide) => [`/guides/${guide.slug}`, guide.checked]));

type GuideIndex = {
  states: { slug: string }[];
  counties: { state: string; slug: string }[];
  cities?: { state: string; county: string; slug: string }[];
};

async function countyPages(): Promise<string[]> {
  try {
    const res = await fetch(`${API_BASE_URL.replace(/\/+$/, '')}/api/public/county-guide`, {
      next: { revalidate: 3600 },
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return [];
    const index = (await res.json()) as GuideIndex;
    if (!index?.states?.length) return [];
    return [
      '/property-records',
      ...index.states.map((state) => `/property-records/${state.slug}`),
      ...index.counties.map((county) => `/property-records/${county.state}/${county.slug}`),
      ...(index.cities || []).map((city) => `/property-records/${city.state}/${city.county}/${city.slug}`),
    ];
  } catch {
    return [];
  }
}

// Every Christmas card's page and, with the shelves on, each collection's page: from the one answer /cards itself
// reads (cached a minute), never a call per card. The backend answers 404 while Christmas cards are off.
// A card's entry names its picture too, so the card can be found in a picture search.
async function cardPages(): Promise<{ paths: string[]; pictures: Map<string, string> }> {
  const { data } = await fetchPublicCardDesigns();
  if (!data?.designs?.length) return { paths: [], pictures: new Map() };
  // Thank-you cards (Wave 5): a collection's pages and its cards' pages only while the server lists it as open.
  const thanks = openThankYou(data);
  const collections = [
    ...(publicShelvesOn(data) ? (data.collections ?? []).map((c) => `/cards/collection/${c.slug}`) : []),
    ...thanks.collections.map((c) => `/cards/collection/${c.slug}`),
  ];
  const cards = [...data.designs, ...thanks.designs].filter((d) => d.slug);
  return {
    paths: [...cards.map((d) => `/cards/${d.slug}`), ...collections],
    pictures: new Map(cards.map((d) => [`/cards/${d.slug}`, `${SITE_URL}/holiday-cards/${d.id}.jpg`])),
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [cards, counties] = await Promise.all([cardPages(), countyPages()]);
  const pages = [
    ...PUBLIC_PAGES,
    ...PILLAR_PAGES.map((page) => page.path),
    ...GUIDE_PAGES.map((page) => page.path),
    ...cards.paths,
    ...counties,
  ];
  // A page listed twice (a pillar page also named in PUBLIC_PAGES) is listed once; a switched-off feature's pages,
  // which redirect home, not at all.
  return [...new Set(pages)]
    .filter((path) => !isLaunchCutPath(path))
    .map((path) => {
      const checked = GUIDE_CHECKED.get(path);
      const picture = cards.pictures.get(path);
      return { url: `${SITE_URL}${path}`, ...(checked ? { lastModified: checked } : {}), ...(picture ? { images: [picture] } : {}) };
    });
}
