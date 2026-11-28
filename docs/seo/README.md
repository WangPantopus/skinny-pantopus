# Search: how people find Pantopus

The founder's direction, November 23, 2026: people should reach Pantopus wherever they search, for every part of the
app (Place, Today, Pulse, Moments, Mail, Christmas cards, chat, Plans, Support Train and whatever comes next). When a
feature is switched on, its search work is part of switching it on: Gigs, the Marketplace and every later one.

This page says what is set up, what each part of the app has, and the checklist for a feature being switched on.
Change it in the same pull request that changes what search engines can read.

## What is set up

Read from `dev` and from the live site on November 23, 2026; kept up to date by the search build since.

| Piece | Where | What it does |
|---|---|---|
| robots.txt | `frontend/apps/web/src/app/robots.ts` | Only production's primary deployment may be read; staging, previews and local builds answer `Disallow: /`. Production keeps signed-in pages and link-token pages out (`PRIVATE_PATHS`), allows the share pictures under `/api/og/` (the longer rule wins over `Disallow: /api/`) and names the sitemap. |
| Sitemap | `frontend/apps/web/src/app/sitemap.ts` | The pages in `PUBLIC_PAGES`, the pillar pages (`src/lib/site/pillarPages.ts`) and guide pages (`src/lib/site/guidePages.ts`), every card and collection page (from the one cached answer `/cards` reads), and every state and county page from the backend's list (`GET /api/public/county-guide`, `backend/services/countyGuide`). A switched-off feature's paths (`isLaunchCutPath`) are left out. A guide's entry carries its `checked` date as the day it last changed, and a card's entry names its picture; no other entry states a date. |
| Page tags | Each page's `metadata` or `generateMetadata`; `publicPageMetadata` in `src/lib/site/pageMetadata.ts` for the public pages | Title, description, canonical link at `https://pantopus.com`, share card. `publicPageMetadata({ path, title, description })` writes "<title> \| Pantopus", `index, follow`, Open Graph and a large Twitter card. A page reached by a private link says `robots: { index: false }`. The sign-in pages are client components, so their tags come from a `layout.tsx` beside each: `/login` and `/register` are indexable with their own titles; the password and email steps say `unlistedPageMetadata(title)` (`index: false`). Every public page's title ends with "Pantopus". |
| Tags in `<head>` for crawlers | `htmlLimitedBots` in `frontend/apps/web/next.config.js` | On a page rendered per request (`/start`, the card pages, `/property-records`, shared posts, profiles and plans), Next sends the title, description, canonical and robots tags inside `<body>` whenever they are ready after the page's first bytes, and it does that for Googlebot too. The list names Googlebot, Bing, the AI assistants' fetchers and anything that calls itself a bot, crawler or spider: they get the tags in `<head>`. A person's browser loads as before. |
| Shared links | `buildShareMetadata` in `frontend/apps/web/src/lib/publicShare.ts` | The tags for a shared post, profile, plan, booking page, task or listing, with Safari's app banner. |
| The default | `src/app/layout.tsx`, `src/lib/siteTitle.ts` | The title and description a page inherits when it names none. There is no title template: signed-in pages already end their titles "· Pantopus". |
| Share pictures | `/api/og/home`, `/api/og/place`, `/api/og/page?path=<path>`; `opengraph-image.tsx` and `twitter-image.tsx` beside each page in `(public)/` | The drawn share cards for the homepage, an address preview, each pillar, topic and guide page (the file convention: `/<page>/opengraph-image…`), and the other public pages (its heading and line from `src/lib/site/shareCards.ts` or a `share` on a pillar or guide entry; any other path is a 404). A query, not a path segment: `next.config.js` rewrites `/api/:path*` to the backend before any dynamic route under `/api`. |
| Links to the main sections | `src/lib/site/footerLinks.ts`; `app/_components/HomeFooter.tsx` (the homepage and the pillar, topic and guide pages), `components/site/SiteFooter.tsx` (the company, policy, property-record and lookup pages), the line under the Christmas cards | One list of the main sections (each part's page, Sign up, Sign in, Get the app, Pricing, Help, the lookup, the company pages), linked from every public page under the same short words. A search engine picks the links it shows under a site's result ("sitelinks") from links like these; a page that should be one of them goes in this list. |
| Structured data | `src/lib/site/jsonLd.ts`; `(public)/**`; `(site)/cards/**`; `(site)/property-records/**` | The homepage: `Organization`, `WebSite` and the iOS and Android `MobileApplication`s (no `sameAs`, no ratings). `/about`: a breadcrumb. Pillar and topic pages: breadcrumb and `FAQPage` from the questions they show. `/guides`: `ItemList`; each guide: `Article` and its questions. Card pages: `ItemList` on `/cards` and each collection, `CreativeWork` on each card with its own description, and a breadcrumb on each card and collection. `/download`: the two apps (`appsLd`), a breadcrumb and its questions; `/pricing` and `/help`: a breadcrumb and their questions. County pages: breadcrumb and questions. |
| App links | `public/.well-known/apple-app-site-association`, `assetlinks.json` | A shared link opens the app when it is installed. |
| For AI assistants | `src/app/llms.txt/route.ts` | `/llms.txt`: what Pantopus is in the homepage's words and every public page, with the pillar and guide pages from `src/lib/site`. |
| Launch cuts | `src/middleware.ts`, `isLaunchCutPath` in `src/lib/featureFlags.ts` | A switched-off feature's public addresses redirect to `/`, so search engines hold nothing for it. |

## What each part of the app has

| Part | Pages a search engine can read |
|---|---|
| Place | `/place`, `/start` (the address lookup), `/tax-check`, `/property-records` with its state and county pages |
| Today, Pulse, Moments, Plans, Support Train, chat | `/today`, `/pulse`, `/moments`, `/plans`, `/support-train`, `/chat` |
| Mail and Christmas cards | `/mail`, `/cards`, `/cards/<card>`, `/cards/collection/<name>` (while Christmas cards are on); the thank-you cards' `/cards/<card>` and `/cards/collection/<name>` pages, in the sitemap and as the last shelf on `/cards`, only while the server's public list (`thank_you` on `GET /api/mailbox/cards/designs`) says a collection is `open` |
| Topics and guides | `/social-network`, `/home-buying`, `/home-management`, `/home-safety`; `/guides` and ten `/guides/<slug>` |
| The account and the app | `/register` (Sign up), `/login` (Sign in), `/download` (Get the app), `/pricing`, `/help` |
| The company | `/about`, `/about/data-sources`, `/contact`, `/privacy`, `/terms`, `/child-safety`, `/delete-account`, `/llms.txt` |
| People's own content | A shared post (`/posts/<id>`) or profile (`/<username>`) can be read when a link leads to it; none is listed in the sitemap. Plans, cards in the mail, Support Trains and every link-token page are closed. |
| Gigs, Marketplace, business pages, booking pages, personas | Nothing while their keys are off: their addresses redirect to `/`. |

## When a feature is switched on

For a launch-cut key going on ([launch-scope flags](../launch-scope-flags-2026-10-01.md)) and for any new feature
people can reach. Do it in the pull requests that switch the feature on, so it goes to staging with the feature and
reaches search engines when the founder promotes.

1. **Its own page.** A public page at its own address that says what the feature is in the words people type into a
   search box, with its own title, description, canonical link, share picture, the questions people ask (with their
   structured data) and the app buttons. Add the address to `PERSONAL_RESERVED_USERNAMES`
   (`backend/utils/personalUsername.js`) so nobody can take it as a username, after checking nobody has.
2. **Its public content.** Decide which of its pages are for search engines (a public listing, an open task) and
   which never are (anything reached by a private link, anything that shows a home). The first kind says
   `robots: { index: true }`, has a canonical link and structured data of its kind; the second says `index: false`,
   and a link-token path also goes in `PRIVATE_PATHS`.
3. **The sitemap.** Add its pages to `PUBLIC_PAGES`. A list of content comes from one cached backend answer, the way
   the county pages do, never from a call per item.
4. **The middleware.** With the key on, its public addresses answer; with the key off, they still redirect.
5. **Links in.** The homepage (its top bar, a section, the footer) and the pages of related parts link to it. A page
   nothing links to is rarely found. A pillar or guide page listed in `src/lib/site` is in every footer at once; any
   other main page goes in `src/lib/site/footerLinks.ts`, and `/help` links it.
6. **The words elsewhere.** The homepage and `/about` name it. If it costs money, `/pricing` says what, from the
   figure in the code.
7. **The stores.** New App Store and Play text that names it: description, subtitle or short description, keywords,
   screenshots. Draft the text in the pull request; the consoles are the founder's.
8. **This page.** Update the two tables above and the row below.

What each switched-off feature will need:

| Key | Its search work |
|---|---|
| `open_gigs` | `/gigs` and `/gigs/<id>` exist with share tags. A page for what Gigs is; whether open tasks are listed for search engines (a task shows a place name, never an address); structured data; a page per kind of help and city only once real tasks fill it. |
| `marketplace` | `/listing/<id>` exists with share tags; there is no public browse page (browsing is signed in). Product structured data (name, price, picture, whether it is still for sale); a sold or removed listing answers "gone"; a page per category and city only once real listings fill it. |
| `business_directory` | Business pages at `/b/<username>`: local business structured data from what the business chose to show; pages by city and category once filled. |
| `public_scheduling` | Booking pages at `/book/<slug>`: readable for a business that wants a public page; one-off and token links stay closed. |
| `beacon`, `personas` | Public pages at `/persona/<handle>`: profile structured data. |
| `household_extras`, `mail_extras`, `gift_funds`, the card keys | Inside the app: the Today, Mail, Christmas cards and Support Train pages and the store text name what was added. |
| `CARD_EVERYDAY` (server) | The year-round thank-you collection's pages appear and leave with the server's `open`; when it is on for good, the store text and `/cards`' own title and description name thank-you cards too. |

## Rules that hold

- No page per address and no address in any link. Search engines index states, counties and cities, never a home.
- Staging, previews and local builds are never readable by search engines.
- A page per city, county or category exists only when something real fills it. No padded pages.
- Every figure on a public page names its source and its date.
- New public words use neither "neighbor" nor "Neighborhood" (the founder, November 7 and 16).
- Nothing switched off is made public to win a search.
- Never redirect `www.pantopus.com`. The apps share links there (`https://www.pantopus.com/posts/<id>`) and both
  claim it for app links, which a redirect on `/.well-known/` breaks (`next.config.js`, the `headers()` note). Both
  hosts answer every page; each page's canonical link names `https://pantopus.com`, which is what search engines index.

## The founder's steps

Only the founder signs in to these. Each step says where to click.

1. **Promote `dev` to production.** Nothing in `dev` reaches a search engine before that.
2. **Google Search Console** (search.google.com/search-console, the property `pantopus.com`; it has been verified as
   a Domain property since March 24, 2026, and the sitemap was submitted on November 24).
   - Left menu, "Sitemaps": `https://pantopus.com/sitemap.xml` should read "Success" with a recent "Last read" date.
     If it reads an error, type `sitemap.xml` under "Add a new sitemap" and press Submit.
   - The search bar at the top ("Inspect any URL"): paste one address, press Enter, wait for the answer, press
     "Request indexing". Google allows about ten a day. In this order: `https://pantopus.com/`, then `/register`,
     `/login`, `/download`, `/pricing`, `/help`, `/about`, `/cards`, `/start`, `/property-records`, `/guides`, then
     any pillar page that still reads "URL is not on Google".
   - Left menu, "Pages" (under Indexing), once a week: how many pages are indexed, and why the others are not.
     "Discovered – currently not indexed" and "Crawled – currently not indexed" are usual for a young site and clear
     over weeks. "Alternate page with proper canonical tag" is right for `www.pantopus.com` addresses.
   - Left menu, "Performance": the searches that showed Pantopus, with the query `pantopus` first.
   - There is no setting for the links under a result (sitelinks). Google removed its last one in 2016.
3. **Bing Webmaster Tools** (bing.com/webmasters; the site was imported from Search Console). "Sitemaps": the same
   sitemap reads "Success". "URL Submission": paste the same addresses, all at once. Bing's index also feeds
   DuckDuckGo, Yahoo and ChatGPT's search.
4. **The brand's own profiles.** A search engine learns that "Pantopus" is this company from profiles that name it
   and link to `https://pantopus.com`. Create the ones you will keep (a LinkedIn company page first, then Instagram,
   Facebook, X, YouTube, TikTok), each with the name "Pantopus", the same logo, the homepage's one line, and the
   website. Then give a session the addresses: they go in the homepage's `Organization` as `sameAs`
   (`src/lib/site/jsonLd.ts`) and in the footer. None is listed until it exists.
5. **GitHub.** The public repository's "Website" field (the gear beside "About" on the repository's page) reads
   `https://pantopus-staging.vercel.app`. Change it to `https://pantopus.com`.
6. **The App Store and Google Play listings.** Both store pages show for a search of "Pantopus". Send the new text
   (#4732) for review, and check that each listing's website is `https://pantopus.com`.
7. **Google Business Profile** (business.google.com). Google gives one only to a business that meets customers in
   person, at its place or theirs; a company whose product is only an app does not qualify, and a profile made
   anyway can be suspended. If Pantopus has an office that receives people at stated hours: "Add your business",
   the name "Pantopus", the category "Software company", the real address, phone, website and hours, then the code
   Google posts or phones. If it has none, skip this step. Never a made-up address.
8. **Links from other sites.** The largest thing outside the code. Each real page that names Pantopus and links to
   `https://pantopus.com` counts: your own LinkedIn profile, a Product Hunt launch, a Crunchbase entry, a local
   paper's story, a partner's page. Never paid links and never link exchanges.

### The links under a result (sitelinks)

Google chooses them by itself, and nobody can ask for them, pay for them or mark them up. It shows them when it is
sure one site is the answer to the search (a brand's name), and it picks pages it finds important and distinct. What
makes them likely, all of it in place once this is promoted and indexed:

- `pantopus.com` is the first result for "Pantopus", and enough people search the name.
- The main pages are indexed, each with its own title, one clear heading and words of its own.
- Every page links to those main pages under the same short words ("Sign up", "Sign in", "Pricing", "Help", "Get
  the app", each part's name).
- The addresses are short and say what the page is (`/pricing`, `/help`, `/download`).

It usually takes some weeks after the pages are indexed, and a small site may get the one-line kind (four links in
a row) before the large kind.

## How to check a page

- The page's source in production: its `<title>`, description, `rel="canonical"`, `robots` and any
  `application/ld+json` block.
- `https://pantopus.com/robots.txt` and `https://pantopus.com/sitemap.xml`.
- Asked as Googlebot (`curl -A 'Googlebot/2.1' <address>`), the title, description and canonical link sit before
  `</head>`. A page rendered per request can send them inside `<body>` to anything missing from `htmlLimitedBots`.
- Search Console's URL inspection for whether Google holds the page, and its Rich Results Test for structured data.

## Gaps, as of November 25, 2026

Facts for whoever builds next. Remove a line when it is fixed.

- Search engines still hold old copies: "Pantopus - Your real-world network" at `www.pantopus.com`. They clear as
  each page is read again (the founder's step 2).
- Search Console on November 24: one page indexed, six clicks from web search in three months. The sitemap, the
  pillar, guide and county pages reached production on November 24 and 25.
- "Pantopus" is also the name of a sea spider (Pantopoda), so the bare word has other answers until the brand's
  profiles and links exist (the founder's steps 4 and 8).
- `/start` and `/tax-check` hold about 120 words each before the lookup starts.
- The Play listing describes posting tasks and paid services. The App Store text names neither Mail, Christmas
  cards, Moments nor property records. New text for both is in #4732, which waits for the founder.
- No company social account is known, so the homepage's `Organization` has no `sameAs`.
- The apps have no rating in their structured data (none is invented), so Google shows no app rich result.
- The Christmas card tiles on `/cards` keep an empty `alt` because each tile's caption is its link's words; the
  card's own page labels its picture, and the sitemap names each card's picture.
- `/pricing` prints the stamp prices from `backend/services/mailStamps.js` by hand; a comment there says so.
