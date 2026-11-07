# One-home lookups on county sites: research for the founder's yes or no

November 7, 2026. Decision D2 ([decisions.md](decisions.md)) asked for research only, no build without a yes: when
someone adds their own home where a county publishes only a lookup website, should the server read that one property's
page? This document answers with the platforms counties use, what their terms and robots rules say, how one read
differs from bulk scraping in law and in practice, each state's records law, what a build would cost to run and keep,
and what people would gain. It ends with one recommendation. Counts only; no addresses or owner names.

**How it was researched:** no county lookup page was driven by script or browser, not even once. Only terms pages,
robots.txt files, platform and vendor documentation, a public directory's county listings (read at its robots.txt's
10-second pace, never following the county links), court opinions and the Reporters Committee's state law guides.

**This is a non-lawyer's reading, not legal advice.** A lawyer should read the cases and the specific terms before any
build.

## The recommendation

**No. Don't build server-side reads of county lookup pages, not even one page for a person's own home, unless that
county or its site's vendor says yes in writing.**

- **The terms say no where most of these people live.** The vendors that run most county lookup sites ban automated
  access in their published terms: Schneider Geospatial (Beacon and qPublic) bans robots, scrapers and scripts, and
  reserves criminal and civil remedies; Tyler Technologies bans bots, scrapers and even "any manual process" to monitor or
  copy pages; BS&A calls scraping a criminal act; DEVNET's sites tell every robot to stay off property pages. Large
  counties that run their own sites say the same (Cook, Maryland's SDAT, Collier and others, in
  [public-records-requests.md](public-records-requests.md)).
- **One page per person doesn't change the permission question.** Courts look at whether access was authorized, not
  how much was taken. A service acting for its own users, with their logins, still lost once the site said no
  (*Facebook v. Power Ventures*, 9th Cir. 2016), and repeated access with knowledge of a site's terms can bind the reader to them (*Register.com v.
  Verio*, 2d Cir. 2004). Pantopus now knows these terms. Volume only changes how fast a site notices and how much harm a
  court would weigh.
- **It would make Pantopus depend on thousands of sites it doesn't run**, behind bot blocks, with layouts that change,
  for facts the person can read and confirm themselves in one tap.

**What to do instead, already within D2:**

1. **Link and confirm** (a small WP9 build): in Add Home and Property details, open the county's own page for that
   address in the person's browser, and let them confirm year built, size, bedrooms and baths with one tap. The person
   reads the page; Pantopus never fetches it. It reaches every lookup-only county, about **112.4M people (94.6M-122.3M)**, at no
   legal risk, and the facts count as household-confirmed, never as county records.
2. **Ask in writing:** one letter to each vendor (Schneider, Tyler, DEVNET, Catalis and the others below) and one line in
   every county letter: may Pantopus read one property's page, at a low rate, when that property's resident asks? DEVNET's
   product page already describes developer API access to property record data (wEdge Web Services); a vendor or county
   yes turns this into an ordinary connector.
3. **The file routes first:** they reach more people with less risk ([statewide-inventory.md](statewide-inventory.md),
   [other-routes.md](other-routes.md), [public-records-requests.md](public-records-requests.md)).

If the founder says yes anyway, the only defensible version is a written-permission list: a county enters it only when
it or its vendor agrees, and Pantopus stops on any objection.

## Who runs the lookup sites

Which system runs each county's assessor lookup, from the [NETR Online public records directory](https://publicrecords.netronline.com/):
its county pages list each county's assessor link, and the link's host names the platform. The directory was read at its
robots.txt pace (one page every 11 seconds, under its 10-second crawl delay); the county links themselves were never
opened. Two passes: of the 128 largest counties outside storage, the 84 that still need a lookup for building facts
were read in full; a population-weighted sample of 180 of the remaining 2,118 such counties (seed
20261107) stands in for the rest, each sampled county representing about 0.5M people. The frame is the
2,202 counties (130.6M) with no stored record and no statewide building-fact file; the county survey's
sample says 79-88% of those have no free county file either. Shares from the sample carry a margin of several points.

- **Counties' own sites serve 53% of these people**, mostly the large counties, each with its own terms.
- **Platforms that ban automation in writing** (Schneider, Tyler, BS&A, Catalis) serve 16%; **DEVNET's
  robots rules bar property pages** for another 3%; **firewalls refuse scripts** outright on
  5% (actDataScout, Tennessee's site).
- **No rule found** (Aumentum, Vision, Megabyte, Spatialest): 3%.
- Smaller regional vendors (Arkansas County Data, Alabama's tax vendors, Delta, CountyGovServices, Capture CAMA and
  others) serve the rest; their terms weren't read.

| Platform | Counties read | People (estimate) | Share | What its terms or robots rules say |
|---|---:|---:|---:|---|
| County's own site | 140 | 69.3M | 53.0% | Of the 45 largest read: 5 tell robots to stay off the lookup path (4 bar everything), 6 refused even the robots.txt request, 17 have no robots rules; terms sit inside the sites and weren't read |
| No assessor link listed | 31 | 15.4M | 11.8% | — |
| Schneider qPublic | 18 | 9.2M | 7.0% | bans robots, scrapers and scripts (Software Terms) |
| Tyler | 13 | 6.5M | 5.0% | bans bots, scrapers and manual copying (Terms of Use) |
| DEVNET wEdge | 8 | 3.7M | 2.8% | robots.txt bars property pages |
| Schneider Beacon | 7 | 3.5M | 2.7% | bans robots, scrapers and scripts (Software Terms) |
| Tennessee Comptroller | 7 | 3.5M | 2.7% | firewall refuses scripts; state files are the route |
| Not in directory | 5 | 3.2M | 2.4% | — |
| actDataScout | 6 | 3.0M | 2.3% | firewall refuses scripts |
| BS&A | 5 | 2.2M | 1.7% | calls scraping a criminal act (Terms of Use) |
| Megabyte | 3 | 1.3M | 1.0% | no rule found (no robots.txt) |
| Delta Computer Systems | 2 | 1.0M | 0.8% | No robots.txt; terms not found |
| Alabama tax vendors (TAGS, alproptax) | 2 | 1.0M | 0.8% | altags: no robots.txt; alproptax: robots allow; terms not found |
| xSoft | 2 | 1.0M | 0.8% | robots allow; terms not found |
| Vision | 2 | 1.0M | 0.8% | no rule found (no robots.txt) |
| SmartCAMA | 2 | 1.0M | 0.7% | robots.txt redirects; terms not read |
| CountyGovServices | 2 | 0.9M | 0.7% | No robots.txt; terms not found |
| Arkansas County Data | 2 | 0.8M | 0.6% | Cloudflare; same content signals as Beacon; terms not read |
| NE Revaluation | 1 | 0.7M | 0.5% | No robots.txt; terms not found |
| Spatialest | 2 | 0.6M | 0.5% | robots allow; no terms found |
| True Automation / Harris | 1 | 0.5M | 0.4% | Not read |
| Thomson Reuters Aumentum | 1 | 0.5M | 0.3% | no rule found |
| CAI AxisGIS | 1 | 0.4M | 0.3% | Not read |
| Capture CAMA | 1 | 0.4M | 0.3% | No robots.txt; terms not found |

## What each platform's terms and robots rules say

Read November 7, 2026. Robots rules were read from each host's robots.txt; terms from the vendor's own legal pages. A
county's deployment can add its own disclaimer page; those weren't opened, because they sit inside the lookup sites.

| Platform | Robots.txt | Published terms on automated access | Bot protection seen |
|---|---|---|---|
| Schneider Geospatial: Beacon, qPublic | [Allows ordinary crawlers](https://beacon.schneidercorp.com/robots.txt); blocks AI crawlers by name; Cloudflare content signals allow search, forbid AI training, use for reference | [Software Terms](https://www.schneidergis.com/legal-information/software-terms): robots, screen scraping, data mining tools and scripts are prohibited; detection ends access and can ban IP addresses; criminal and civil remedies reserved. Content belongs to Schneider or the governments that supply it | Cloudflare in front of both |
| Tyler Technologies (iasWorld public access, EagleWeb, others) | Varies by county host | [Terms of Use](https://www.tylertech.com/terms): no code, data mining software, robot, bot, spider or scraper, or any manual process, to monitor or copy pages or data reached through its services | — |
| DEVNET wEdge | [Every robot told to stay off](https://lancasterpa.devnetwedge.com/robots.txt) /parcel, /view, /taxbill, /mobile_home and property images (same on [Kane IL](https://kaneil.devnetwedge.com/robots.txt)) | No terms page found on [devnetinc.com](https://www.devnetinc.com/wedge/); the product page describes developer API access | — |
| BS&A Software (Michigan) | [Allows ordinary crawlers](https://bsaonline.com/robots.txt), blocks AI crawlers, same Cloudflare signals | [Terms of Use](https://www.bsasoftware.com/terms-of-use/): scraping or recreating data from its service is called a criminal act to be prosecuted; data comes from each municipality under licensing agreements | Cloudflare |
| Catalis (GovernmentWindow, Patriot Properties, CAMA) | GovernmentWindow [disallows every URL with a query string](https://benhillcountyga.governmentwindow.com/robots.txt), which is where property pages live | [Terms of Use](https://www.catalisgov.com/terms-of-use/): no copying, distributing or reproducing content without written permission (site-wide) | A CAPTCHA page sits in front of a GovernmentWindow tax search linked from the directory |
| Thomson Reuters Aumentum (PublicAccessNow, Manatron) | [Allows ordinary crawlers](https://pwc.publicaccessnow.com/robots.txt) except portal files | Not found | — |
| Vision Government Solutions | [No robots.txt](https://gis.vgsi.com/robots.txt) (404) | Not found on vgsi.com; towns post their own disclaimers | — |
| actDataScout | [Even robots.txt refused](https://www.actdatascout.com/robots.txt) to a script (Azure web application firewall, 403) | Couldn't read | Firewall refuses scripts outright |
| Tennessee Comptroller's assessment site | [robots.txt refused](https://assessment.cot.tn.gov/robots.txt) (403) | The Comptroller's county files are the sanctioned route | Gateway refuses scripts |
| Maryland SDAT | [robots.txt refused](https://sdat.dat.maryland.gov/robots.txt) (Cloudflare block) | Terms bar automatic or robotic collection | Cloudflare |
| Megabyte (California) | [No robots.txt](https://common1.mptsweb.com/robots.txt) | Not found | — |
| Spatialest | [Allows everything](https://property.spatialest.com/robots.txt) | Not found | — |
| Sidwell Portico | [Same Cloudflare signals as Beacon](https://portico.mygisonline.com/robots.txt) | Not found | Cloudflare |
| Counties' own sites | Of the 45 largest in the census: 5 tell robots to stay off the lookup page's path (4 of them bar the whole site), 17 have no robots rules | Many ban automated access: Cook, Maryland, Collier, Manatee, Clark WA, Washoe ([public-records-requests.md](public-records-requests.md)) | 6 of the 45 refused even a request for robots.txt |

Two things stand out. The platforms that serve most lookup-only counties forbid automation in writing, and several
block scripts before any terms are read. And where no ban was found (Vision, Spatialest, Megabyte, Aumentum), the absence
of a rule isn't permission: the county still owns the content, and its own disclaimer page wasn't read.

## One home versus bulk scraping

The question is whether reading one property's page, only when its own resident adds the home, is different from bulk
scraping. In practice a little; in law, mostly not.

**Federal computer law.** The Supreme Court reads "without authorization" as a gates-up-or-down question: can this
person enter this part of the system at all (*Van Buren v. United States*, 593 U.S. 374 (2021),
[opinion](https://www.law.cornell.edu/supremecourt/text/19-783)). The Ninth Circuit then held that scraping pages open to
the public, with no login, likely isn't "without authorization" under the federal statute (*hiQ Labs v. LinkedIn*, 31
F.4th 1180 (9th Cir. 2022), [opinion](https://cdn.ca9.uscourts.gov/datastore/opinions/2022/04/18/17-16783.pdf)). So a
public county page is, on its face, not a federal crime to read by script, one page or a million. But the same court
held that a service reading Facebook on its own users' behalf broke federal and California computer law once Facebook
sent a cease-and-desist letter and blocked its IP addresses (*Facebook v. Power Ventures*, 844 F.3d 1058 (9th Cir.
2016), [opinion](https://cdn.ca9.uscourts.gov/datastore/opinions/2016/12/09/13-17102.pdf)). That is the closest case to
"one page for the resident who asked": acting for the user didn't help once the site said no. Power used its users' own
logins, and a county page needs none, so the lesson is about reading on after a no, not about passwords. Several county
sites say no in advance and block scripts; Pantopus would be reading through a no.

**Contract.** A site's posted terms can bind a reader who keeps coming back knowing them: Verio took the day's data
every day while seeing the terms each time, and was bound (*Register.com v. Verio*, 356 F.3d 393 (2d Cir. 2004),
[opinion](https://law.resource.org/pub/us/case/reporter/F3/356/356.F3d.393.00-9596.html)). One read per new home is
still repeated access by one company, now with knowledge of the terms. Against that, a California court held Meta's
terms didn't reach scraping while logged out, by someone who wasn't a user (*Meta v. Bright Data*, N.D. Cal. January 23,
2024, per [a law firm's summary](https://www.jdsupra.com/legalnews/major-decision-affects-law-of-scraping-1470808/); the
order itself wasn't read). Schneider's and Tyler's terms are written to cover anyone using their sites, not only account
holders, and Bright Data was a federal trial ruling, not an appeal.

**Trespass to computers.** The Ninth Circuit noted that sites "are not without resort" when the federal law doesn't
apply: state claims such as trespass to chattels may remain (*hiQ*, above). Those generally need harm to the system. One
read per new home would cause none worth measuring; bulk scraping can. This is where volume really matters.

**Copyright.** Facts aren't protected (*Feist v. Rural*, 499 U.S. 340 (1991),
[opinion](https://www.law.cornell.edu/supremecourt/text/499/340)). The Seventh Circuit refused to let a CAMA software
vendor use its copyright to keep municipalities' property data, the "number and type of rooms" among it, from a data
company (*Assessment Technologies v. WIREdata*, 350 F.3d 640 (7th Cir. 2003),
[opinion](https://law.resource.org/pub/us/case/reporter/F3/350/350.F3d.640.03-2061.html)). So the facts on a county page
are free to use; the question is only how you get them.

**State records laws** (table below) give a right to copies by request, nearly everywhere and often to anyone, and
several courts have ordered property data handed over in bulk. They don't give a right to run scripts against a county's
website, and none overrides a site's terms. They do show the cleaner path: ask for the file.

**State computer-crime laws.** Every state has one, usually turning on access "without authorization" or "without
permission". Cook County's site tells readers that unauthorized data collection can bring criminal penalties. After a
written ban or a block, a script reading through it is exposed under these laws as Power Ventures was under
California's.

**Privacy.** Lookup pages show owner names and mailing addresses; some states let certain people hide their records from
county websites (Georgia does for law enforcement officers, O.C.G.A. 50-18-78), and Texas and Florida withhold protected
people's records. A server read would pull those pages into Pantopus before dropping the names, and couldn't tell when a
record was hidden later.

**In practice**, one page per new home differs from bulk in load (negligible) and in how fast a site notices (slower).
It doesn't differ in what the terms say, in the blocks that stop a script on the first request, or in the need for a
parser per platform and a check per county.

## State law: a non-lawyer's reading

From the [Reporters Committee's Open Government Guide](https://www.rcfp.org/open-government-guide/) (each state's
sections on who may request, purpose and use, electronic records and record categories), read November 7, 2026, with
the cases and statutes it cites. Territories' laws weren't read.

| State | Who may ask | Limits on use | Points about property data | What it means here |
|---|---|---|---|---|
| AL | Residents only (Ala. Code 36-12-40) | None (*Walsh v. Barnes*, 1989) | Assessor's maps open to inspection (40-7-41); AG: computer data in the assessor's office is as open as paper | A request needs an Alabama resident; the website's terms still govern scripts |
| AK | Anyone | None in the Act | — | Request route open |
| AZ | Anyone (A.R.S. 39-121) | Commercial use allowed but must be stated (39-121.03); misuse can be stopped by the governor | Maricopa and Pinal attach sublicense terms to their files | State the commercial purpose on every request |
| AR | Arkansas citizens, including companies doing business there (25-19-105) | None (AG 84-127) | Tax appraisals are open (26-26-1307) | Needs an in-state requester |
| CA | Anyone (Gov. Code 7922.510) | None; a county can't attach license limits to GIS base maps (*Santa Clara*, 2009) | Characteristics sold at cost (R&T 408.3); AG 04-1105: assessor parcel maps disclosable electronically | File route strong; cost can be high |
| CO | Anyone | None, except criminal justice records | Electronic copies in the format kept (2017 law) | Request route open |
| CT | Anyone | No case | Electronic copy at the agency's cost (1-212(b)); *Assessor, Town of Franklin v. FOIC* (1998) | Request route open |
| DE | Delaware citizens (29 Del. C. 10001) | None | — | Needs an in-state requester |
| DC | Anyone | Commercial use doesn't bar access (*Dunhill*, 1980) | — | Request route open |
| FL | Anyone (119.01) | Purpose irrelevant | Some preliminary assessor worksheets aren't public records | Request route strong |
| GA | Anyone | None since 1993 | Format as kept or standard export (50-18-71(f)); law enforcement officers may have their information removed from county property websites (50-18-78) | Request route strong; a page read by script can't tell which records were hidden later |
| HI | Anyone | None in the Act | OIP once withheld GIS data a private source gave in confidence (OIP 97-9) | Request route open |
| ID | Anyone | No mailing or phone lists from records (74-120) | State parcel terms repeat 74-120 | Keep owner names out, as planned |
| IL | Anyone | Must disclose a commercial purpose if asked (5 ILCS 140/3.1) | Township assessors hold cards; Cook's site warns scrapers of criminal and civil exposure | State the purpose |
| IN | Anyone (IC 5-14-3-3) | Agency rule may limit commercial use of data issued on disk or tape (5-14-3-3(e)) | DLGF's state files exist | Ask DLGF whether such a rule applies |
| IA | Anyone (22.2) | None; may publish | Most assessors on Beacon | Request route open |
| KS | Anyone (45-218) | Names and addresses not to be used to sell to those people (45-220(c)(2)) | Tax assessment records open (AG 1991-145); state hosts 93 counties' CAMA | Sign the certification |
| KY | Residents enforceable; others discretionary (61.872) | Commercial purpose certified and priced higher (61.874) | Property tax records generally open | In-state requester, commercial fee |
| LA | Anyone of majority age (44:31) | None; selling tax rolls doesn't change their status (AG 90-330) | Computer assessment and sales records are public (AG 87-301); format as kept (*Zillow v. Bealer*) | Request route open; format may be the assessor's |
| ME | Anyone | Any purpose | Copy in the medium kept | Request route open |
| MD | Anyone | Some statutory limits | SDAT's site bars robotic collection | Use SDAT's open data, as stored |
| MA | Anyone (c. 66 10(a)) | None | Assessors carry the burden of justifying a refusal (*Attorney General v. Assessors of Woburn*, 1978) | Request route open |
| MI | Anyone | Use irrelevant | Tax data at a contractor is public (*MacKenzie*, 2001); fees per statute (*Cole*, 2004) | Request route open; BS&A's site bans scraping |
| MN | Anyone (13.03) | None; commercially valuable data may carry a fee | — | Request route open |
| MS | Anyone (25-61-5) | None | Copy in the format requested if kept (25-61-10(2)) | Request route open |
| MO | Anyone | Generally none | Electronic services optional | Request route open |
| MT | Anyone (2-6-1006) | No distribution lists of persons (2-6-1017) | State publishes CAMA | Already open |
| NE | Anyone (84-712) | None | Requester chooses the form (84-712(3)) | Request route strong |
| NV | Anyone (239.0107) | None | Medium of choice (239.010(4)) | Request route open |
| NH | Citizens in the statute; courts apply it broadly | None (*Lamy*, 2005) | Property tax cards public; city ordered to copy its computer tape (*Menge*, 1973) | Strong precedent for bulk copies |
| NJ | Citizens of New Jersey (47:1A-1); AG reads it to allow others | None | Municipal tax records are government records | Request route open |
| NM | Anyone | None | Counties may charge for online GIS access (14-3-18(G)) | Request route open |
| NY | Anyone | None in FOIL | Inventory data withheld from a commercial requester (*Comps v. Islip*, 2006); sale reports confidential (RPTL 574) | State roll is open data; inventory data may need a privacy-safe ask |
| NC | Anyone (132-6) | GIS requesters may be made to promise no resale (132-10) | Media of choice (132-6.2) | Request route open; GIS promise possible |
| ND | Anyone | Some statutory limits | City assessment rolls open (40-19-03) | Request route open |
| OH | Anyone (149.43) | None | Medium of choice | Request route strong |
| OK | Anyone | Commercial requests may cost more (24A.5(3)); no copying tract indexes for sale (24A.5(5)) | Native format (appeals court, 2024) | Request route open |
| OR | Anyone (192.314) | None | Electronic form if available (192.324) | Request route open |
| PA | U.S. legal residents (67.102) | None in the old act | Property assessment lists and GIS may be priced at market value (67.1307(b)(4)) | Fees can be high |
| RI | Anyone | Old commercial-advantage ban held unconstitutional (*R.I. Ass'n of Realtors v. Whitehouse*, 1999) and repealed in 2012 | Media of choice (38-2-3) | Request route open |
| SC | Anyone (30-4-30) | Commercial solicitation limits for some lists | Counties may copyright and restrict "specially-created" GIS data (*Seago*, 2008) | Expect license terms on GIS |
| SD | Anyone interested (1-27-1) | Resale limits on some state lists | No format choice (1-27-4) | Request route open |
| TN | Tennessee citizens only | None | Comptroller publishes most counties anyway | Use the Comptroller's files |
| TX | Anyone (552) | None | Appraisal districts' private-entity sale and characteristic data is excepted (552.149); protected owners' accounts withheld (Tax Code 25.025) | Use districts' exports |
| UT | Anyone | Court may limit use of private records | Database access can satisfy a request (*Maese*, 2012) | Request route open |
| VT | Anyone (*Finberg*, 1992) | Purpose irrelevant | Electronic copy if kept that way (316(i)) | Request route open |
| VA | Virginia citizens (2.2-3704); limit upheld (*McBurney*, 2013) | Commercial use fine (*Associated Tax Service*, 1988) | Database copies required | Needs an in-state requester; VGIN's files avoid it |
| WA | Anyone | No lists of individuals for commercial purposes (42.56.070(9)) | King's and Spokane's downloads ask for an attestation | No names, as planned (D8) |
| WV | Anyone; out-of-state commercial vendors included (*Hurlbert*, 2014) | None | Vendor won access to CAMA files (*Hurlbert*) | Request route strong |
| WI | Anyone (19.35) | Must follow use limits set by law | — | Request route open |
| WY | Anyone | None | Alternative formats unless impractical (16-4-202) | Request route open |
| PR | Not read | Not read | CRIM sells map products | Couldn't confirm; ask CRIM |
| GU, VI, AS, MP | Not read | Not read | — | Couldn't confirm |

## What a build would cost in reliability and upkeep

Using the package's own planning rates ([cost-and-rights.md](cost-and-rights.md#2-what-replacing-attom-costs): $105 an
hour engineering, $80 GIS; three engineer-days per new source and four GIS hours a quarter to keep it):

| Piece | Count | To build | To keep, per year |
|---|---:|---:|---:|
| A reader per vendor platform above 0.5% of people | 16 | $40,320 | $20,480 |
| A reader per county that runs its own site | about 736 | $1,854,720 | $942,080 |
| Setting up and testing each vendor county (2 hours), checking it yearly (1 hour) | about 1,466 | $307,860 | $153,930 |
| **Total** | | **$2,202,900** | **$1,116,490** |

For comparison, the whole public-records route was modeled at $47,500 to build and $30,480 a year. A lookup reader for
every lookup-only county would cost about 46 times that to build and 37 times as much each year, before
any legal work, and most of it would read sites whose terms forbid it. Even the vendor platforms alone, the cheapest slice,
are 16 separate readers to build and watch.

**Reliability.** Every read depends on a site Pantopus doesn't run. It can't sit in Add Home's path (the founder's rule:
answer without making people wait), so it would be a background job with retries, and the facts would arrive later or
not at all. Bot protection (Cloudflare on Beacon, qPublic, BS&A and Portico; firewalls on actDataScout, Tennessee's and
Maryland's sites) answers a server with a challenge it can't pass. Vendors redesign pages (Beacon and qPublic share one
look across hundreds of counties, so one redesign breaks them all at once). Sites have maintenance windows and outages
nobody announces to Pantopus. And the identity check (the right home or unit, never a neighbor's) has to work against
each site's own search, which often returns several matches.

**Compared with link and confirm:** the person's own browser passes the bot checks, the county's page is the source, a
redesign breaks nothing in Pantopus, and the cost is one small screen change on three apps.

## What people would gain

Lookup pages usually show what the county's CAMA system holds: year built, size, stories, often bedrooms and baths,
assessed value and the last sale. Where the county publishes no file, that's the only public online source of those
facts. A server read would put them on Add Home without the person lifting a finger; link and confirm puts the same
facts there after one look and one tap, marked as the household's own confirmation. The gain of a server read over link
and confirm is one tap per home.

## The recommendation, and the counties it would reach

**Recommendation: say no to server-side reads, and yes to two things instead: link and confirm, built by WP9, and a
written ask to each vendor and county.** If a county or vendor says yes in writing, its pages become an ordinary
connector with its own rights row, and that county moves off this list.

**The counties it would reach:** about **112.4M people (range 94.6M-122.3M), 33% of Americans**,
live where a county lookup page is the only public online source of building facts once storage, statewide files and
known county files are counted. Link and confirm reaches all of them, at no legal risk, in every state. A server read
would reach the same people only where terms allow it, which, by the census above, is a small minority of them, and only
until a site objects. The frame below is the 2,202 counties (130.6M) without a stored record or statewide
building-fact file; the survey's sample says 79-88% of their people have no free county file.

| State | Counties without a building-fact route | People in them |
|---|---:|---:|
| California | 45 | 9.7M |
| Georgia | 157 | 9.6M |
| Pennsylvania | 62 | 8.3M |
| Ohio | 83 | 7.4M |
| Michigan | 81 | 7.1M |
| Missouri | 114 | 5.5M |
| Indiana | 90 | 5.4M |
| Virginia | 106 | 5.3M |
| Illinois | 98 | 5.2M |
| Alabama | 67 | 5.2M |
| Tennessee | 92 | 5.1M |
| South Carolina | 45 | 4.9M |
| Louisiana | 64 | 4.6M |
| Wisconsin | 70 | 4.4M |
| Kentucky | 119 | 3.8M |
| New York | 23 | 3.3M |
| Arkansas | 75 | 3.1M |
| Mississippi | 82 | 2.9M |
| Washington | 34 | 2.7M |
| Iowa | 98 | 2.7M |
| 18 other states and DC | 597 | 24.4M |

## What I couldn't confirm

- Each county deployment's own terms or disclaimer page: they sit inside the lookup sites, which this research didn't open.
- Terms for Vision, Aumentum, Megabyte, Spatialest and DEVNET (none found on their company sites).
- What each platform's pages show, field by field; only vendor descriptions were read.
- The Meta v. Bright Data order itself (a law firm's summary only), and every state's computer-crime statute.
- Territories' records laws.
- The platform for counties the directory doesn't list or labels unclearly (14.2% of people in the frame).

## Sources

All read November 7, 2026 (UTC). Platform terms and robots files are linked in the table above. Cases: *Van Buren*
([Cornell LII](https://www.law.cornell.edu/supremecourt/text/19-783)); *hiQ v. LinkedIn*
([Ninth Circuit](https://cdn.ca9.uscourts.gov/datastore/opinions/2022/04/18/17-16783.pdf)); *Facebook v. Power Ventures*
([Ninth Circuit](https://cdn.ca9.uscourts.gov/datastore/opinions/2016/12/09/13-17102.pdf)); *Register.com v. Verio*
([Public.Resource.Org](https://law.resource.org/pub/us/case/reporter/F3/356/356.F3d.393.00-9596.html)); *Assessment
Technologies v. WIREdata* ([Public.Resource.Org](https://law.resource.org/pub/us/case/reporter/F3/350/350.F3d.640.03-2061.html));
*Feist* ([Cornell LII](https://www.law.cornell.edu/supremecourt/text/499/340)); *McBurney v. Young*
([Cornell LII](https://www.law.cornell.edu/supremecourt/text/12-17)); *Meta v. Bright Data*
([JD Supra summary](https://www.jdsupra.com/legalnews/major-decision-affects-law-of-scraping-1470808/)). State law:
[Reporters Committee Open Government Guide](https://www.rcfp.org/open-government-guide/), every state's page. Platform
census: [NETR Online public records directory](https://publicrecords.netronline.com/) county pages, read under its
[robots.txt](https://publicrecords.netronline.com/robots.txt) (10-second crawl delay; directories allowed) and its
[terms](https://publicrecords.netronline.com/user/auth/terms_of_Service) (no rule on automated reading). DEVNET:
[wEdge product page](https://www.devnetinc.com/wedge/). Population and storage as in
[statewide-inventory.md](statewide-inventory.md).
