// ============================================================
// UNLISTED on the web (Wave 4) + the money-first preview lead.
//
// Almost every invariant here is about what the page must NOT say,
// because the reader is disproportionately likely to be someone hiding
// from a specific person and every failure mode is overclaiming:
//
//   * the three state answers are three DIFFERENT claims — a program,
//     "we checked and there is none", and "we did not check". Collapsing
//     the third into the second tells someone in danger that no help
//     exists when we simply did not look;
//   * the state program leads, above the broker list, always;
//   * `method_note` renders verbatim — without it the page implies a
//     scan it never performed;
//   * each broker's caveat travels whole, and `typical_days === 0` is
//     "not stated", never "0 days";
//   * a FAILED removals read (null) must never render as an empty
//     checklist — that is a confident claim we cannot make;
//   * the money lead is the server's figure or nothing at all.
// ============================================================

import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as api from '@pantopus/api';
import type { PlaceIntelligence } from '@pantopus/types';
import UnlistedView from '@/components/place/unlisted/UnlistedView';
import IdentityDetail from '@/components/place/detail/IdentityDetail';
import StartFunnel from '@/components/place/StartFunnel';
import { leaveNow } from '@/lib/quickExit';

const push = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: jest.fn(), prefetch: jest.fn() }),
  useParams: () => ({}),
  usePathname: () => '/unlisted',
}));

jest.mock('@/components/ui/toast-store', () => ({
  toast: { success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn() },
}));

jest.mock('@/lib/publicShare', () => ({
  getStoreDownloadCta: () => ({ href: 'https://example.com/app', label: 'Get the app' }),
}));

// The real navigation is exercised directly further down; here it is
// stubbed so clicking Quick exit doesn't try to navigate jsdom.
jest.mock('@/lib/quickExit', () => ({
  ...jest.requireActual('@/lib/quickExit'),
  leaveNow: jest.fn(),
}));

const getPublicUnlisted = api.unlisted.getPublicUnlisted as jest.Mock;
const getHomeUnlisted = api.unlisted.getHomeUnlisted as jest.Mock;
const setRemovalStatus = api.unlisted.setRemovalStatus as jest.Mock;
const getPreview = api.place.getPublicPlacePreview as jest.Mock;
const autocomplete = api.geo.autocompleteWithAbort as jest.Mock;
const getMailboxCheck = api.mailboxCheck.getMailboxCheck as jest.Mock;

// ── Fixtures ────────────────────────────────────────────────

// The caveat is the whole point of a broker entry: a flow verified only
// to step one is exactly what the person needs to know before starting.
const BROKER_NOTE =
  'A 5-step wizard that starts by pasting your own profile URL. IMPORTANT CAVEAT: only step 1 of 5 was verified — the later steps may still ask for email or phone verification.';

const BROKER = {
  id: 'whitepages',
  name: 'Whitepages',
  category: 'people_search',
  exposes: ['home_address', 'relatives'],
  opt_out_url: 'https://www.whitepages.com/suppression-requests',
  method: 'web_form' as const,
  requires_id: false,
  requires_email: false,
  // 0 means the site publishes NO processing time — not "instant".
  typical_days: 0,
  note: BROKER_NOTE,
  source_url: 'https://www.whitepages.com/suppression-requests',
  verified_at: '2026-08-27',
};

// Mirrors backend/services/unlistedService.js. The second clause used to
// claim the registry was exhaustive; it is not, and this fixture pinned
// the overclaim as required copy across three platforms.
const METHOD_NOTE =
  'We do not look your address up on these sites — searching them would hand them your address. These are the 19 sites we have verified a working removal path for — there are more we have not got to yet.';

const PROGRAM_EXISTS = {
  exists: true,
  name: 'Safe at Home',
  url: 'https://www.sos.ca.gov/registries/safe-home',
  eligibility: 'Victims of domestic violence, sexual assault, stalking, and human trafficking.',
  source_url: 'https://www.sos.ca.gov/registries/safe-home',
  verified_at: '2026-08-27',
};

const PROGRAM_VERIFIED_NONE = {
  exists: false,
  name: '',
  url: '',
  eligibility:
    'Alabama operates no substitute-address confidentiality program; its only address protection is a Domestic Violence Voter Affirmation that omits the address from public voter lists.',
  source_url: 'https://www.sos.alabama.gov/',
  verified_at: '2026-08-27',
};

function profile(stateProgram: unknown, state = 'CA') {
  return {
    state,
    state_program: stateProgram,
    groups: [{ category: 'people_search', label: 'People-search sites', brokers: [BROKER] }],
    broker_count: 1,
    exposure_labels: {
      home_address: 'Home address',
      relatives: 'Relatives and household members',
    },
    method_note: METHOD_NOTE,
    registry_verified_at: '2026-08-27',
  };
}

function publicPayload(stateProgram: unknown, state = 'CA') {
  return {
    status: 'ready',
    tier: 'preview',
    place: { city: 'Sacramento', state },
    unlisted: profile(stateProgram, state),
    disclaimer: 'We did not save this address.',
  };
}

async function lookUpAddress() {
  render(<UnlistedView />);
  fireEvent.change(screen.getByLabelText(/your address/i), {
    target: { value: '1421 SE Oak St, Portland, OR' },
  });
  fireEvent.click(screen.getByRole('button', { name: /show me what to do/i }));
  await screen.findByText(METHOD_NOTE);
}

beforeEach(() => {
  jest.clearAllMocks();
  getMailboxCheck.mockResolvedValue(null);
});

// ── 1. The three state answers ──────────────────────────────

describe('the state program — three different answers, worded three different ways', () => {
  it('a real program leads with its name, who qualifies, and the official link', async () => {
    getPublicUnlisted.mockResolvedValue(publicPayload(PROGRAM_EXISTS));
    await lookUpAddress();

    expect(screen.getByText('Safe at Home')).toBeInTheDocument();
    expect(screen.getByText(PROGRAM_EXISTS.eligibility)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /official CA program page/i });
    expect(link).toHaveAttribute('href', PROGRAM_EXISTS.url);
  });

  it('puts the program ABOVE the broker list — it outranks every opt-out link', async () => {
    getPublicUnlisted.mockResolvedValue(publicPayload(PROGRAM_EXISTS));
    await lookUpAddress();

    const program = screen.getByText('Safe at Home');
    const broker = screen.getByText('Whitepages');
    // DOCUMENT_POSITION_FOLLOWING — the broker comes after the program.
    expect(program.compareDocumentPosition(broker) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('a verified-none state says we CHECKED, and says what the state offers instead', async () => {
    getPublicUnlisted.mockResolvedValue(publicPayload(PROGRAM_VERIFIED_NONE, 'AL'));
    await lookUpAddress();

    expect(screen.getByText(/AL has no substitute-address program/i)).toBeInTheDocument();
    expect(screen.getByText(/We checked the published program sources/i)).toBeInTheDocument();
    // The eligibility field carries the consolation fact; it must render.
    expect(screen.getByText(PROGRAM_VERIFIED_NONE.eligibility)).toBeInTheDocument();
    // And it must NOT be phrased as an unchecked state.
    expect(screen.queryByText(/have not confirmed a program/i)).not.toBeInTheDocument();
  });

  it('a NULL program says we have not confirmed one — never that the state has none', async () => {
    getPublicUnlisted.mockResolvedValue(publicPayload(null, 'ZZ'));
    await lookUpAddress();

    expect(screen.getByText(/We have not confirmed a program for ZZ/i)).toBeInTheDocument();
    expect(screen.getByText(/That is not the same as there being none/i)).toBeInTheDocument();
    // The claim we are not entitled to make.
    expect(screen.queryByText(/has no substitute-address program/i)).not.toBeInTheDocument();
  });
});

// ── 2. The honesty line and the caveats ─────────────────────

describe('what the page refuses to imply', () => {
  it('renders method_note verbatim — without it the page implies a scan', async () => {
    getPublicUnlisted.mockResolvedValue(publicPayload(PROGRAM_EXISTS));
    await lookUpAddress();
    const note = screen.getByText(METHOD_NOTE);
    // Verbatim, visible, and not clamped or tucked behind a disclosure.
    expect(note).toBeInTheDocument();
    expect(note.textContent).toBe(METHOD_NOTE);
    expect(note.className).not.toMatch(/line-clamp|truncate|max-h-|sr-only|hidden/);
    expect(note.closest('details')).toBeNull();
    // And beside the list it is about — above the first broker.
    const broker = screen.getByText('Whitepages');
    expect(note.compareDocumentPosition(broker) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("renders each broker's caveat in full rather than trimming it as clutter", async () => {
    getPublicUnlisted.mockResolvedValue(publicPayload(PROGRAM_EXISTS));
    await lookUpAddress();
    const note = screen.getByText(BROKER_NOTE);
    expect(note).toBeInTheDocument();
    // jsdom compares textContent, so a full string would still "pass"
    // while a CSS clamp hid the caveat that is the whole value of the
    // entry. Assert the clamp is absent, not just the text.
    expect(note.className).not.toMatch(/line-clamp|truncate|max-h-|text-ellipsis/);
    expect(note.closest('div')?.className ?? '').not.toMatch(/line-clamp|truncate|max-h-|text-ellipsis/);
  });

  it('says "no processing time stated" for typical_days === 0, never "0 days"', async () => {
    getPublicUnlisted.mockResolvedValue(publicPayload(PROGRAM_EXISTS));
    await lookUpAddress();
    expect(screen.getByText(/no processing time stated/i)).toBeInTheDocument();
    expect(screen.queryByText(/0 days/i)).not.toBeInTheDocument();
  });

  it('offers a quick exit, labelled for what it actually does', async () => {
    getPublicUnlisted.mockResolvedValue(publicPayload(PROGRAM_EXISTS));
    render(<UnlistedView />);
    fireEvent.click(screen.getByRole('button', { name: /quick exit/i }));
    expect(leaveNow).toHaveBeenCalled();
    // It must not claim to do more than it does.
    expect(screen.getByText(/cannot erase your browsing history/i)).toBeInTheDocument();
  });

  it('the quick exit uses replace(), so the page leaves no back-stack entry', () => {
    // jsdom's `window.location` is unforgeable, hence the injectable
    // target; `assign` here would put this page one Back press away.
    const actual = jest.requireActual('@/lib/quickExit');
    const target = { replace: jest.fn(), assign: jest.fn() };
    actual.leaveNow(target);
    expect(target.replace).toHaveBeenCalledWith(actual.QUICK_EXIT_URL);
    expect(target.assign).not.toHaveBeenCalled();
  });

  it('never says the address was found anywhere', async () => {
    getPublicUnlisted.mockResolvedValue(publicPayload(PROGRAM_EXISTS));
    await lookUpAddress();
    expect(screen.queryByText(/\byour address was found\b|\bwe found\b|\byou are listed\b/i)).not.toBeInTheDocument();
  });
});

// ── 3. The claimed home — progress, and the failed read ─────

function intel(): PlaceIntelligence {
  return {
    place: { label: '1421 SE Oak St, Portland', line1: '1421 SE Oak St', city: 'Portland', state: 'OR', postal_code: '97214' },
    tier: 'T3',
    region_supported: true,
    generated_at: '2026-08-27T00:00:00Z',
    groups: [],
  } as unknown as PlaceIntelligence;
}

async function openUnlistedLeaf() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <IdentityDetail intelligence={intel()} homeId="home-1" residentName="Sam Reed" />
    </QueryClientProvider>,
  );
  fireEvent.click(await screen.findByText(/Unlisted — take your address back/i));
  await screen.findByText(METHOD_NOTE);
}

describe('the claimed home surface', () => {
  it('is available without verification — a just-claimed home is exactly who needs it', async () => {
    getHomeUnlisted.mockResolvedValue({ ...profile(PROGRAM_EXISTS, 'OR'), removals: [] });
    await openUnlistedLeaf();
    // Rendered from a T3 (claimed, unverified) intelligence payload.
    expect(screen.getByText('Safe at Home')).toBeInTheDocument();
  });

  it('shows the per-broker progress control and records a step', async () => {
    getHomeUnlisted.mockResolvedValue({ ...profile(PROGRAM_EXISTS, 'OR'), removals: [] });
    setRemovalStatus.mockResolvedValue({
      broker_id: 'whitepages', status: 'requested', requested_at: '2026-08-27T00:00:00Z', confirmed_at: null,
    });
    await openUnlistedLeaf();

    // An EMPTY array is "nothing done yet" — a checklist is honest here.
    expect(screen.getByText(/1 site to work through/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^I asked$/i }));
    await waitFor(() => expect(setRemovalStatus).toHaveBeenCalledWith('home-1', 'whitepages', 'requested'));
  });

  it('reflects a saved status back on the broker', async () => {
    getHomeUnlisted.mockResolvedValue({
      ...profile(PROGRAM_EXISTS, 'OR'),
      removals: [{ broker_id: 'whitepages', status: 'confirmed', requested_at: null, confirmed_at: '2026-08-27T00:00:00Z' }],
    });
    await openUnlistedLeaf();
    expect(screen.getByText(/1 of 1 confirmed removed/i)).toBeInTheDocument();
    expect(screen.getByText('Confirmed removed')).toBeInTheDocument();
  });

  it('a FAILED removals read (null) is never rendered as an empty checklist', async () => {
    // null !== [] : the read failed, so we do not know what they have done.
    getHomeUnlisted.mockResolvedValue({ ...profile(PROGRAM_EXISTS, 'OR'), removals: null });
    await openUnlistedLeaf();

    expect(screen.getByText(/couldn't read your progress just now/i)).toBeInTheDocument();
    // No confident zero-progress claim…
    expect(screen.queryByText(/to work through/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/0 of 1 confirmed/i)).not.toBeInTheDocument();
    // …and no status controls or chips pretending to know the state.
    expect(screen.queryByRole('button', { name: /^I asked$/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Not started')).not.toBeInTheDocument();
    // The list itself still renders — the removal paths are still useful.
    expect(screen.getByText('Whitepages')).toBeInTheDocument();
  });

  it('never implies Pantopus removes anything on the resident’s behalf', async () => {
    getHomeUnlisted.mockResolvedValue({ ...profile(PROGRAM_EXISTS, 'OR'), removals: [] });
    await openUnlistedLeaf();
    expect(screen.getByText(/Pantopus does not submit anything on your behalf/i)).toBeInTheDocument();
  });

  it('never asserts the resident IS republished anywhere — we never looked', async () => {
    // The list describes what these SITES publish. Any heading of the
    // form "where YOUR address gets republished" would claim a listing
    // we deliberately never checked for, which is the one thing
    // `method_note` exists to deny.
    getHomeUnlisted.mockResolvedValue({ ...profile(PROGRAM_EXISTS, 'OR'), removals: [] });
    await openUnlistedLeaf();

    expect(screen.getByText(/Sites that republish county records/i)).toBeInTheDocument();
    expect(screen.queryByText(/where your address gets republished/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/\byour address was found\b|\bwe found\b|\byou are listed\b|\byou appear on\b/i),
    ).not.toBeInTheDocument();
  });

  it('an unverified state stays "not confirmed" here too — never "no program"', async () => {
    // The same rule as the public page, asserted on the surface a
    // frightened resident is most likely to reach from the app.
    getHomeUnlisted.mockResolvedValue({ ...profile(null, 'ZZ'), removals: [] });
    await openUnlistedLeaf();

    expect(screen.getByText(/We have not confirmed a program for ZZ/i)).toBeInTheDocument();
    expect(screen.queryByText(/has no substitute-address program/i)).not.toBeInTheDocument();
  });
});

// ── 4. The money lead on the anonymous preview ──────────────

const SUGGESTION = {
  suggestion_id: 's1',
  primary_text: '4080 NE Tacoma Ct',
  secondary_text: 'Camas, WA 98607',
  label: '4080 NE Tacoma Ct, Camas, WA 98607',
  center: { lat: 45.6087, lng: -122.389 },
  kind: 'address',
};

const PREVIEW = {
  status: 'ready',
  tier: 'preview',
  region: 'US',
  place: { address: '4080 NE Tacoma Ct', city: 'Camas', state: 'WA', zipcode: '98607' },
  free: {
    flood: { status: 'ready', zone: 'X', description: 'Minimal flood risk', source: 'FEMA' },
    density: { status: 'ready', bucket: 'forming', label: 'Your block is starting to form', source: 'Pantopus' },
    area: { status: 'ready', median_year_built: 2004, median_home_value: 646200, note: '', source: 'Census' },
  },
  locked: [],
  disclaimer: 'A free, one-time look.',
};

const MONEY_LEAD = {
  kind: 'flood_premium' as const,
  headline: 'Flood policies near here run $1,240–$2,980 a year',
  detail: 'Across 214 real NFIP policies in this census tract. A benchmark, not a quote.',
  low: 1240,
  high: 2980,
  scope: 'census tract',
  source: 'FEMA · OpenFEMA NFIP policies',
};

async function runPreview() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <StartFunnel />
    </QueryClientProvider>,
  );
  autocomplete.mockResolvedValue({ suggestions: [SUGGESTION] });
  fireEvent.change(screen.getByPlaceholderText(/enter your address/i), { target: { value: '4080 NE Tacoma' } });
  fireEvent.mouseDown(await screen.findByText('4080 NE Tacoma Ct'));
  fireEvent.click(screen.getByRole('button', { name: /see your place/i }));
}

describe('the money-first preview lead', () => {
  it('leads with the server’s figure, above the tiles', async () => {
    getPreview.mockResolvedValue({ ...PREVIEW, money_lead: MONEY_LEAD });
    await runPreview();

    const headline = await screen.findByText(MONEY_LEAD.headline);
    expect(screen.getByText(MONEY_LEAD.detail)).toBeInTheDocument();
    // Scope is stated — it is a tract benchmark, never "your home".
    expect(screen.getByText(/census tract-level, not this home/i)).toBeInTheDocument();
    // And it sits above the free tiles.
    const tile = screen.getByText(/zone x/i);
    expect(headline.compareDocumentPosition(tile) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('falls back to the tiles when money_lead is null — no gap, no placeholder', async () => {
    getPreview.mockResolvedValue({ ...PREVIEW, money_lead: null });
    await runPreview();

    // The original hero carries the page exactly as before.
    expect(await screen.findByText(/Here's what's public about your address/i)).toBeInTheDocument();
    expect(screen.getByText(/zone x/i)).toBeInTheDocument();
    // Nothing stands in for the missing figure.
    expect(screen.queryByText(/a year|a month/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/not available|unavailable figure/i)).not.toBeInTheDocument();
  });

  it('never synthesizes a figure the server did not send', async () => {
    getPreview.mockResolvedValue({ ...PREVIEW });
    await runPreview();
    const hero = await screen.findByText(/Here's what's public about your address/i);
    expect(within(hero.closest('div') as HTMLElement).queryByText(/\$\d/)).not.toBeInTheDocument();
  });
});

// Regression: a state_program whose `exists` field is absent must NOT
// render as a confident "your state has none". JSON.stringify drops
// undefined, so a stateDisclosure row missing acp_exists produces
// exactly this shape — and a falsy check printed a sourced denial off a
// field nobody ever read. Both native clients guard it; web did not.
describe('an unreadable `exists` is unconfirmed, not a denial', () => {
  const PROGRAM_UNREADABLE = {
    // `exists` deliberately absent, as the wire would deliver it.
    name: '',
    url: '',
    eligibility: '',
    source_url: 'https://example.gov/x',
    verified_at: '2026-08-27',
  };

  it('falls through to "we have not confirmed", never to "has no program"', async () => {
    (api.unlisted.getPublicUnlisted as jest.Mock).mockResolvedValue(
      publicPayload(PROGRAM_UNREADABLE, 'WY'),
    );
    await lookUpAddress();

    expect(screen.getByText(/have not confirmed/i)).toBeInTheDocument();
    expect(screen.queryByText(/no substitute-address program/i)).not.toBeInTheDocument();
  });
});

// ── "We could not place that" ≠ "you are not in the U.S." ────
//
// The server used to return `unsupported_region` for every geocoder
// failure — an outage, a missing key, an address it could not parse —
// so a Mapbox blip told every US visitor at once that the product had
// nothing for them, and withheld the entire national removal list,
// which never needed the address in the first place.
describe('an address we could not place', () => {
  const COULD_NOT_PLACE = {
    status: 'could_not_place',
    tier: 'preview',
    message: 'We could not tell which state that is',
    place: { city: null, state: null },
    unlisted: profile(null, null as unknown as string),
    disclaimer: 'We did not save this address.',
  };

  it('is never dressed as a geographic denial', async () => {
    (api.unlisted.getPublicUnlisted as jest.Mock).mockResolvedValue(COULD_NOT_PLACE);
    await lookUpAddress();

    expect(screen.getByText(/could not tell which state that is/i)).toBeInTheDocument();
    // The exact laundering that shipped.
    expect(screen.queryByText(/U\.S\.-only/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/nothing accurate to give you outside the U\.S\./i)).not.toBeInTheDocument();
  });

  it('still renders the whole removal list underneath', async () => {
    (api.unlisted.getPublicUnlisted as jest.Mock).mockResolvedValue(COULD_NOT_PLACE);
    await lookUpAddress();

    expect(screen.getByText('Whitepages')).toBeInTheDocument();
    expect(screen.getByText(METHOD_NOTE)).toBeInTheDocument();
    // And the state answer degrades to "not checked", never "none".
    expect(screen.queryByText(/no substitute-address program/i)).not.toBeInTheDocument();
  });
});


// ── The preview's two non-ready answers, on /start ──────────
//
// /api/public/place is the highest-traffic anonymous surface, and it
// collapsed every geocoder failure into the U.S.-only hand-off long
// after the two sibling routes were split. During an outage that told
// every US visitor at once that the product was not for them, and
// offered nothing to do about it.
describe('the start funnel distinguishes the two non-ready answers', () => {
  it('an unreadable address offers a retry, not a geographic denial', async () => {
    getPreview.mockResolvedValue({
      status: 'could_not_place',
      tier: 'preview',
      region: null,
      message: 'We could not find that address — try adding the city and state',
    });
    await runPreview();

    expect(await screen.findByText(/couldn.t find that address/i)).toBeInTheDocument();
    expect(screen.getByText(/adding the city and state/i)).toBeInTheDocument();
    expect(screen.queryByText(/U\.S\.-only/i)).not.toBeInTheDocument();
  });

  it('a genuinely non-US address still gets the U.S.-only hand-off', async () => {
    getPreview.mockResolvedValue({
      status: 'unsupported_region', tier: 'preview', region: null, message: 'Home features are U.S.-only for now',
    });
    await runPreview();

    expect(await screen.findByText(/U\.S\.-only for now/i)).toBeInTheDocument();
    expect(screen.queryByText(/couldn.t find that address/i)).not.toBeInTheDocument();
  });
});
