# Public-records requests: real county data where no free file exists

November 6, 2026. Decision D2 ([decisions.md](decisions.md)): real public-records requests start with the 41 large counties
that have no free building file, and Pantopus buys a county's file when it is a one-time fee of $500 or less. Anything
higher is a separate ask. The founder sends every request and pays every fee; nothing here has been sent or bought.

This isn't legal advice. Prices and routes were read on county pages on November 6; several schedules are old, so each
row says what to confirm. The rights check in [cost-and-rights.md](cost-and-rights.md#4-rights-register) still applies to
every file before its first release: buying a file doesn't by itself allow showing it to people.

## The finding

The county survey counted these 41 as having no free building facts. Reading their own pages changes the picture: about a
quarter have a published route at a low price, and at least one of them publishes the file free.

- **Free, needs a rights read and a connector:** San Bernardino CA posts a property characteristics ZIP with names and
  addresses withheld, marked as kept for the county's internal use. Ada ID offers free GIS downloads with use limits. Cobb
  GA's tabular file was listed as free on its FTP site in an old policy.
- **Within the $500 limit:** Clark NV, Johnson KS, San Mateo CA, Ventura CA, Lancaster PA, Greenville SC, Kern CA,
  Sedgwick KS.
- **Above it:** Fresno, Alameda and Stanislaus publish prices from $12,000 to $25,500 for the whole county. Alameda also
  sells one property's facts, which matters if a record is bought only when a home joins (see below).

## The letter

The same letter works everywhere: fill in the brackets from the table. It asks for facts about buildings and never for
owner names, which avoids the rules on lists of individuals in several states (Washington's, for one) and the privacy
ground New York's courts accepted for withholding inventory data.

```text
Subject: Public records request: property characteristics data, [County]

To the [Assessor's office / records officer]:

Under [state law], I request an electronic copy of the following records for all
parcels in [County], in CSV or any common database format:

- parcel number, property address and unit number
- land use or property class, and lot size
- year built, stories, living area, bedrooms, full and partial bathrooms
- garage or parking, roof, exterior walls, heating and cooling
- assessed and market values, with the tax year
- last sale date and price, where they are public
- the data dictionary and code tables

Please leave out owner names and mailing addresses. We don't need them.

Pantopus is a neighborhood app. We would show these facts to the household living
at each property, with your office named as the source and the date of the data.
We won't sell the file or publish it as a list. [If this state requires it: This is
a commercial purpose under [statute].]

Please tell me:
1. the cost, before doing any work if it is more than $500;
2. how often the file is updated, and whether we can receive updates;
3. whether any license terms limit showing these facts to a property's residents.

If this file already exists as a product you sell, please send the order form instead.

Thank you,
[Name], Pantopus
[Mailing address, email, phone]
```

## Address files to ask for at the same time

The address registry (WP6) has little cleared data for these publishers, so add the address or parcel-point file to their letter:
Nevada: Clark County, Las Vegas, Washoe. Hawaii: Honolulu, Hawaii County, Maui. New Hampshire: GRANIT. South Carolina: the state
file, Greenville, Horry. Michigan: the state structure points, Wayne, Macomb, Kent. Georgia: Gwinnett, Cobb, Atlanta. Pennsylvania:
Philadelphia, Allegheny, Chester. Missouri: the state file, Jackson. Puerto Rico: Junta de Planificacion and CRIM.

## Rules by state

| State | Counties here | Law | Watch for |
|---|---|---|---|
| California | Orange, San Bernardino, Santa Clara, Alameda, Sacramento, Fresno, Kern, Ventura, San Mateo, Stanislaus | Public Records Act; Revenue and Taxation Code 408.3 | 408.3 makes property characteristics open to any party for a fee reflecting the actual cost, so prices can be high. Some counties add a no-resale agreement |
| Tennessee | Shelby, Knox | Public Records Act | Limited to Tennessee citizens: needs an in-state requester, or use the county's sale route |
| Kentucky | Jefferson | Open Records Act | Limited to Kentucky residents, with exceptions; commercial use is priced separately (KRS 61.874) |
| Alabama | Jefferson | Open Records Act | Limited to residents: needs an in-state requester |
| Arizona | Pima | Public Records Law | State the commercial purpose (A.R.S. 39-121.03); misuse carries penalties |
| Washington | Spokane | Public Records Act | No commercial use of lists of individuals; Spokane's download needs an attestation (founder's call, D8) |
| New York | Suffolk, Nassau | Freedom of Information Law | The assessment roll is public, but courts have upheld withholding inventory data from a commercial requester (*Comps, Inc. v. Town of Islip*). Ask for the roll and say that no owner names are wanted |
| Illinois | DuPage, Will, Kane | Freedom of Information Act | State the commercial purpose; property record cards usually sit with township assessors |
| Kansas | Johnson, Sedgwick | Open Records Act | Sale prices aren't public; don't use the data to build a mailing list |
| Idaho | Ada | Public Records Act | No resale or redistribution of the GIS data; no mailing lists |
| Michigan | Wayne, Macomb, Kent | Freedom of Information Act | Assessing is by city and township; the county may hold only part of it |
| Wisconsin | Milwaukee, Dane | Open Records Law | Assessing is municipal: the big city publishes, and the rest is asked town by town |
| Georgia | Fulton, Gwinnett, Cobb | Open Records Act | Gwinnett has an online portal |
| Pennsylvania | Bucks, Delaware, Lancaster | Right-to-Know Law | Use the state's standard form or the county's |
| Others | Clark NV, Honolulu HI, St. Louis MO, Suffolk MA, Providence RI, Greenville SC | Each state's records law | Rhode Island assesses by city and town; Suffolk MA is Boston plus three small cities |

## The 41 counties, in the order to act

"Route" is the page or office found on November 6. "Confirm" means the page didn't show it, or the schedule is old.

### First: within the limit or free

| County | People | What exists | Price found | Route |
|---|---:|---|---:|---|
| Clark NV | 2.40M | Residential extract with bedrooms, baths, square feet, stories and roof; sales back to about 1994; refreshed weekly | $300 a month for the data site, one-month access offered; the fee schedule dates from July 2024. **The cheapest large county here.** Read its Data Notice | Signed letter or data request form, Assessor's data files page; (702) 455-3882 |
| San Bernardino CA | 2.21M | Property characteristics ZIP, annual; names and addresses withheld | Free download; fields to confirm from its layout file. "Internal use" notice: read it, and ask in writing if unclear | arc.sbcounty.gov/property-information |
| Ventura CA | 0.84M | Annual characteristics for the secured roll | About $465 (2021-22 schedule, confirm). Its agreement bars reselling the data in the format received | Assessor's office; non-disclosure agreement on its site |
| San Mateo CA | 0.74M | Property characteristics and sales history | $305 each (confirm) | smcacre.gov/assessor/assessment-data-fees |
| Johnson KS | 0.63M | Whole property-record file, SQL, no ownership, updated February and June | $100 a year | jocogov.org, Appraiser, Data Requests and Pricing |
| Greenville SC | 0.57M | County GIS data set with parcels | $500 one-time; check that building facts are in it | gcgis.org, GIS Data Products Order Form |
| Lancaster PA | 0.56M | Structure file (year built, area, style) and last sale | $500 package, $50 basic; monthly packages, so confirm one-time | lancastercountypa.gov, Property Assessment Data for Sale |
| Sedgwick KS | 0.54M | Characteristics through open records | Custom query: $15 set-up plus $12 per quarter hour | sedgwickcounty.org/kora; Appraiser 316-660-9261 |
| Ada ID | 0.54M | Free GIS with commercial and land tables; residential facts were empty when measured | Free; no resale or redistribution, so ask whether showing facts to a resident is allowed | adacounty.id.gov, Assessor Data |
| Kern CA | 0.92M | GIS data set (land) and assessment roll extracts | $220 for GIS; ask whether the extract holds characteristics | kerncounty.com, Assessor's GIS Data and Assessor Forms |
| Cobb GA | 0.79M | Tabular parcel data | Free on FTP in an old policy; fields unopened | gis.cobbcounty.org, GIS Data Sales sheet; cobbassessor.org |

### Next: a route, price unknown

| County | People | Route | Note |
|---|---:|---|---|
| Orange CA | 3.17M | Mail: Orange County Assessor, 500 S. Main St., Suite 103, Orange, CA 92868, Attn: Quality Assurance; fax (714) 834-3199 | Ask for "Assessor Roll Products" prices; expect a county that points to a reseller |
| Santa Clara CA | 1.93M | Standards and Services Division, 130 W. Tasman Dr., San Jose; 408-299-5500; Data File Order Form on the Assessor's site | Bulk and by-jurisdiction subset forms exist |
| Sacramento CA | 1.61M | assessor@saccounty.gov; 916-875-0700 | Says sales data is confidential |
| Suffolk NY | 1.54M | County FOIL office; Real Property Tax Service | State layer covers about 14% of parcels |
| Nassau NY | 1.39M | nassaucountyny.gov/573/FOIL-Requests | Lookup site only |
| Fulton GA | 1.09M | Board of Assessors, fultoncountyga.gov | Assessors have a backlog on the 2026 digest |
| Pima AZ | 1.08M | County public records form, with its commercial statement | Fees depend on commercial use |
| Gwinnett GA | 1.00M | Online open records portal; the county's quarterly ZIP has values only | |
| Honolulu HI | 1.00M | Real Property Assessment Division, 842 Bethel St., Basement; (808) 768-3799 | |
| St. Louis MO | 0.99M | County Assessor; Sunshine Law, chapter 610 | Route not confirmed |
| DuPage IL | 0.94M | Department FOIA contacts, dupagecounty.gov | Written permission for county data; township assessors hold the cards |
| Macomb MI | 0.89M | County FOIA, Equalization | |
| Wayne MI | 1.77M | NextRequest FOIA page; equalization@waynecountymi.gov; (313) 967-0010 | Detroit already publishes; this is for the rest of the county |
| Will IL | 0.71M | Freedom of Information page, willcountyillinois.com | County terms forbid redistribution without written permission: ask for it |
| Bucks PA | 0.65M | buckscounty.gov Right to Know requests | |
| Delaware PA | 0.58M | delcopa.gov/odmi/data-requests; standard request form | |
| Kane IL | 0.52M | FOIA Officer, 719 Batavia Ave., Geneva, IL 60134 | State commercial purpose |
| Kent MI | 0.67M | kentcountymi.gov/1051/FOIA-Public-Record-Requests | |
| Providence RI | 0.68M | City of Providence records office, then town by town | Mostly Vision lookup sites |
| Milwaukee WI | 0.92M | City already publishes; the suburbs are asked town by town | |
| Dane WI | 0.59M | Madison already publishes; the rest town by town | |
| Suffolk MA | 0.79M | Boston already publishes; Chelsea, Revere and Winthrop by records request | Small remainder |

### Above the limit: your call, if demand justifies it

| County | People | Price found |
|---|---:|---|
| Alameda CA | 1.65M | $20,000 for the whole file, $22,000 with 12 monthly updates (2016 schedule; confirm); $15 to $30 per property |
| Fresno CA | 1.02M | $15,492 for the whole file (5 cents a parcel) |
| Stanislaus CA | 0.56M | $12,000 to $25,500 by contract, and its two published figures disagree; own use only |
| Jefferson KY | 0.79M | $250 base plus per-record tiers for commercial pulls (2018 schedule; confirm); residents only for open records |
| Shelby TN | 0.91M | Restricted to ReGIS participants; residents only for records |
| Knox TN | 0.51M | $100 per map tile, own use only, no redistribution |

Jefferson AL (0.66M) belongs with these until a route is found: its map service holds owner names only, and Alabama limits
requests to residents. Spokane WA (0.56M) waits on D8.

## Buying one property's record, when a home joins

Some counties sell single records cheaply: Alameda at $15 to $30, and Santa Clara at $5 plus a $5 copy fee. Fresno sells only
the whole file. A record bought when someone adds a home there costs far less than a county file. It is manual today and
doesn't scale, so treat it as a question to ask, not a plan.

## Reading one property from a county's lookup site: research result

The November 6 decision asked for research only on this idea: when someone adds a home where only a lookup website exists
(35.5% of Americans), the server reads that one property's page in the background.

**Recommendation: don't build it as a general feature.** Many county sites forbid exactly this, including counties already
in this plan:

| Site | What its terms say |
|---|---|
| Maryland SDAT | Bars automatic or robotic collection, including data mining and web scraping |
| Cook County Assessor | Bars applications that mine or gather data; warns of civil and criminal consequences |
| Clark County WA document site | People detected mining information lose access at once |
| Collier County FL | Bars crawlers, bots, scripts and bulk retrieval |
| Manatee County FL | Treats scraping that harms performance as grounds for termination |
| Washoe County NV recorder | Bars AI use of records without written consent |

The terms of the big lookup platforms (Schneider Beacon and qPublic, Tyler, Vision) couldn't be read: their pages refused
automated fetches or the terms sit on each county's own deployment. No reliable count of counties per platform was found
either, so one connector per platform remains unproven.

**What to do instead, in order:**
1. Ask. The letter above can add one line: "May we read one property's page on your public site when a resident of that
   property asks us to, at a low rate?" A written yes settles it for that county.
2. Link. In Add Home and Property details, open the county's own page for that address and let the person confirm facts with
   one tap. It's free, it's the real source, it breaks no one's terms, and it fits the founder's "look up and confirm".
   This is a small build, for WP9 to consider.
3. Keep the file route above, which already covers more people, at less risk, than a site-by-site scraper would.

## Sources

Read on November 6, 2026: [Clark NV data files](https://www.clarkcountynv.gov/government/assessor/datafiles.php);
[San Bernardino property information](https://arc.sbcounty.gov/property-information/);
[San Mateo assessment data fees](https://smcacre.gov/assessor/assessment-data-fees);
[Johnson KS data requests](https://www.jocogov.org/department/appraiser/staff-office-information/data-requests-and-pricing);
[Sedgwick KS open records](https://www.sedgwickcounty.org/kora/real-estate-ownership-sales-appraisal-and-tax-records/);
[Kern GIS data](https://www.kerncounty.com/government/departments/assessor-recorder/property/mapping-gis/gis-data);
[Ventura rates and fees](https://vcportal.venturacounty.gov/CEO/docs/publications/FY2021-22_Countywide_Service_Rates_Fees.pdf);
[Alameda fee schedule](http://www.acgov.org/forms/assessor/feeschedule.pdf);
[Stanislaus fee schedule](https://www.stancounty.com/assessor/Pdf/FeeSchedule.pdf);
[Orange County records requests](https://www.ocassessor.gov/contact-us/public-records-request);
[Kane IL FOIA](https://assessments.kanecountyil.gov/Pages/FOIA.aspx);
[Wayne MI assessment data](https://www.waynecountymi.gov/Government/Departments/Management-Budget/Assessment-Equalization/Assessment-Data);
[Jefferson KY open records](https://jeffersonpva.ky.gov/open-records-requests/);
[Ada ID assessor data](https://adacounty.id.gov/assessor/assessor-data-analytics/ada-county-assessor-data/);
[Cobb GA data sales](https://gis.cobbcounty.org/Geocortex/Essentials/REST/virtualdirectory/GIS_DataSales_Specifications.pdf);
[California R&T 408.3](https://california.public.law/codes/ca_rev_and_tax_code_section_408.3);
[Comps, Inc. v. Town of Islip](https://www.nycourts.gov/reporter/3dseries/2006/2006_07476.htm);
[residency limits on records requests](https://thevirginiastar.com/politics/transparency-groups-asks-five-states-to-stop-blocking-out-of-state-records-requests/tcsquare/2024/03/14/);
[Kentucky's limit](https://nkytribune.com/2026/02/kentucky-open-records-act-blocks-access);
[Maryland SDAT](https://sdat.dat.maryland.gov/RealProperty);
[Cook County Assessor search](https://assessorpropertydetails.cookcountyil.gov/search/commonsearch.aspx?mode=parid);
[Clark County WA documents](https://e-docs.clark.wa.gov/);
[Collier terms](https://www.collierappraiser.com/legal/Terms_of_Use.html);
[Manatee terms](https://www.manateepao.gov/terms-of-use/);
[Washoe recorder](https://icris.washoecounty.us/ssrecorder).
