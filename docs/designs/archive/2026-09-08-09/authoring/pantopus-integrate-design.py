from pathlib import Path
import re

root = Path('/Users/yingpengwang/skinny-pantopus')
target = root / 'docs/pantopus-nationwide-product-design-2026-09-08.md'
text = target.read_text()

def appendix(path, letter):
    draft = Path(path).read_text()
    draft = re.sub(r'^# [^\n]+\n+', '', draft, count=1)
    draft = re.sub(r'^## (\d+)\. ', lambda m: '### ' + letter + '.' + m.group(1) + ' ', draft, flags=re.M)
    draft = re.sub(r'^### (?![AB]\.)(.+)$', r'#### \1', draft, flags=re.M)
    draft = re.sub(r'`(backend/[^`\s:]+):(\d+)`', lambda m: '['+m.group(1)+'](../'+m.group(1)+') (line '+m.group(2)+')', draft)
    return draft.strip()

tech = appendix('/private/tmp/pantopus-tech-design.md','A')
tech = tech.replace('Kinds include possibility, place, post, link, document and personal note.', 'Kinds include possibility, place, post, link, document, bill, product, event and personal note; typed child records can hold category-specific details.')
journeys = appendix('/private/tmp/pantopus-journeys-design.md','B')
journeys = journeys.replace('**Explore my area** and **Save something I found**', '**Explore a place** and **Show Pantopus something**')
text = text.replace('<!-- TECHNICAL_APPENDIX -->', tech)
text = text.replace('<!-- JOURNEYS_APPENDIX -->', journeys)
needle = '\nKeep existing weather/AQI, supported ATTOM and environmental/civic sources available'
extra = '''
#### A.8.1 Core category sources and additional integrations

The following source families complete the acquisition plan for the product categories specified above. These are source candidates and access routes, not a declaration of live Pantopus coverage.

| Source | Acquisition and product use | Access/interpretation boundary |
| --- | --- | --- |
| [IMLS library data](https://imls.gov/research-evaluation/surveys/public-libraries-survey-pls) | Annual downloadable national systems/outlets seed; follow official institution/state-network links to programs. | Directory metadata does not establish current benefits, eligibility, inventory, or exact service boundaries. |
| Official library/state-network pages | HTML/PDF/structured-feed extraction for borrowing, passes, learning and digital access; supported by sources such as [Idaho statewide resources](https://libraries.idaho.gov/lili/) and [Iowa's library directory](https://statelibraryofiowa.gov/i-want-0/find-library). | Confirm each program's service-area and membership rules; statewide coordination does not mean every offer is open to every resident. |
| [myTurn](https://myturn.com/api-docs/) | Authorized platform adapter for supported item browsing/borrowing functions. | Limited public API functionality and eligible subscriptions; no verified all-tenant national inventory feed. |
| [GE manual lookup](https://www.geappliances.com/ge/service-and-support/literature.htm) and other manufacturer support sites | Resolve confirmed models to manuals and support material. | Manufacturer-specific integration; no universal manual API or bulk illustration redistribution rights established. |
| [Schema.org Offer](https://schema.org/Offer) and [Awin offers](https://help.awin.com/apidocs/promotions) | Publisher markup and authenticated offer feed with terms, dates, regions and change filtering. | Visible terms still matter; network and advertiser membership affect access. Published price is not a personalized checkout quote. |
| [AT&T Broadband Facts](https://www.att.com/broadbandlabels/broadband-facts-machine-readable-plans/) | Machine-readable published plan labels for a supported internet-offer workflow. | [Provider explanation](https://www.att.com/support/article-modal/my-account/000100570/) distinguishes headline price from promotions and government taxes. Match plan/location/date; do not invent an all-in total. |
| [Ticketmaster Discovery](https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/) | Keyed API with event IDs, locations, sale dates, status and source links. | Participating-platform coverage, quotas and terms; price ranges/status do not prove a specific available ticket. |
| Organizer feeds and [Schema.org Event](https://schema.org/Event) | Published iCalendar/RSS/structured event metadata and canonical pages. | Resolve occurrence, year, timezone and exceptions. A flyer alone cannot provide live updates. |
| [211 access process](https://register.211.org/Home/FAQs) and [Open Referral](https://openreferral.org/about/technology-overview/) | Obtain service data through authorized agreements; normalize organizations/services/locations using a common interchange model. | A trial has limited data; a schema is not a national dataset or a redistribution license. |
| [CareerOneStop APIs](https://api.careeronestop.org/api-explorer/) | Authenticated location-based job-center, training-provider and related resource queries. | Confirm relevant program details; a listing does not establish admission, free tuition or personal qualification. |
| [RIDB](https://ridb.recreation.gov/docs) and [NPS API](https://www.nps.gov/subjects/digital/nps-data-api.htm) | Recreation locations, activities, published fees/access and applicable alerts. | Federal/NPS coverage supplemented by local/state sources; documented discovery access is not guaranteed live campsite inventory or booking access. |
| [DOE AFDC station API](https://developer.nlr.gov/docs/transportation/alt-fuel-stations-v1/) | Keyed station, route-nearby and connector/access data for supported travel questions. | Station records/status are not real-time stall availability; retain verification dates and conditional/missing pricing. |
| [FCC broadband map and downloads](https://help.bdc.fcc.gov/hc/en-us/articles/10467446103579-How-to-Use-the-FCC-s-National-Broadband-Map) | Provider-reported availability and area/provider downloads; official address lookup where appropriate. | Building Fabric licensing and API access are distinct issues. A public bulk API is not assumed to be an unrestricted address-search API. Provider confirmation is needed for serviceability. |
| [ArcGIS discovery](https://developers.arcgis.com/rest/users-groups-and-items/search-reference/) and [feature queries](https://developers.arcgis.com/rest/services-reference/enterprise/query-feature-service-layer/) | Discover official publisher datasets, pin IDs, query supported spatial attributes. | A publishing platform supplies no uniform nationwide municipal schema; verify owner, fields, freshness and reuse terms per dataset. |
| [USDA Soil Data Access](https://sdmdataaccess.nrcs.usda.gov/WebServiceHelp.aspx) and [hardiness data](https://planthardiness.ars.usda.gov/pages/map-creation) | Spatial/tabular queries and GIS files for a supported growing/soil explanation. | Map-level estimates are not yard tests; respect attribution and derivative-map conditions. |
| [USGS 3DEP](https://www.usgs.gov/3d-elevation-program/about-3dep-products-services) | Elevation/lidar inputs to an evaluated outdoor sunlight model. | Coverage, acquisition age, building/tree representation and model validation determine usable resolution; no automatic indoor-sunlight capability. |

Source onboarding must confirm the actual endpoint, credentials, quotas, permitted storage/display, current response shape, attribution and failure behavior. The public directory/source layer remains available without securing every deeper provider integration first.
'''
assert needle in text
text = text.replace(needle, '\n'+extra+needle)
target.write_text(text)
print({'words':len(text.split()), 'lines':len(text.splitlines())})
