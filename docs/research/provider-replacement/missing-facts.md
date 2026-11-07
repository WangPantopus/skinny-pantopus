# Missing facts: what county records leave empty

Every home in the property index whose county record leaves a Property details field empty, counted by field, kind of home, state and county, largest gaps first. Counted from each county's serving release by the missing-facts ledger (`scripts/property-index/gaps.cjs`), last updated 2026-11-07; the releases' source dates run from 2020-07-17 to 2026-11-07. The list of homes behind these numbers (each home's id, parcel number, address and missing fields) lives only in private storage, next to the releases, and refreshes after every publish. The research that fills these gaps works from it, using `scripts/property-index/gaps-read.cjs`. This page holds counts only. Regenerate it with `node scripts/property-index/gaps-report.cjs --bucket <bucket>` and the reader key.

## The rule

A field counts as missing when it applies to the record's kind of home and Property details would show no row for it. A blank, a word meaning unknown, or a zero all show nothing. The fields are the 46 in [property-fields.md](property-fields.md), less 6 that no county record fills: Pantopus ID (Pantopus gives every exact match its own), the four estimate rows (model output, never a record field) and Occupancy (a private flag no release holds). Which fields apply to each kind follows the [subject scopes](evidence/subject-scopes.csv) and the scopes the screens use. A condo unit has no lot of its own, and a building's rooms belong to its units. A unit gets its building's figures when the building's record is at the unit's own address, as on its page. Land and non-home records are left out.

| Kind | Fields that apply | Records |
| --- | ---: | ---: |
| House | 40 | 39,101,757 |
| Townhouse | 40 | 1,449,903 |
| Mobile home | 40 | 1,308,203 |
| Home, type not recorded | 40 | 1,959,120 |
| Condo unit | 35 | 5,013,163 |
| Two-to-four-unit building | 26 | 2,321,066 |
| Apartment or other building | 26 | 605,265 |
| Condo building | 12 | 1,810,937 |

Some gaps need no research, and the field tables count them separately:

- **County wrote 0:** the county wrote a zero for a count, such as no fireplace or no half bath.
- **Next build fills it:** the county's next build adds the field from the record itself, such as the other unit of the lot size or the property type's words.
- **Building record has it:** a condo unit's building record, filed at another address, holds the field.

## Every county in storage

731 counties: 48,832,146 homes and 4,737,268 residential building records. 31,706,353 homes (64.9% of those with rooms of their own) lack bedrooms or bathrooms; 36,175,047 records (67.5%) lack at least one of bedrooms, bathrooms, living area, year built or lot size, where it applies. 1,892 restricted records and 0 taken-down addresses are counted out and never listed.

| Field | Records it applies to | Missing | Share | County wrote 0 | Next build fills it | Building record has it | To look up |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| ZIP+4 | 51,758,477 | 51,582,729 | 99.7% | 0 | 0 | 0 | 51,582,729 |
| Property subtype | 51,758,477 | 51,318,301 | 99.1% | 0 | 0 | 0 | 51,318,301 |
| Roof cover | 53,569,414 | 46,458,172 | 86.7% | 0 | 0 | 1 | 46,458,171 |
| Property class | 51,758,477 | 46,122,859 | 89.1% | 0 | 0 | 0 | 46,122,859 |
| Parking spaces | 48,832,146 | 46,122,001 | 94.5% | 0 | 0 | 0 | 46,122,001 |
| Quality | 53,569,414 | 44,899,144 | 83.8% | 0 | 0 | 0 | 44,899,144 |
| Gross area | 53,569,414 | 44,887,511 | 83.8% | 0 | 0 | 0 | 44,887,511 |
| Fireplaces | 48,832,146 | 44,384,442 | 90.9% | 1,415 | 0 | 0 | 44,383,027 |
| Parking type | 48,832,146 | 44,340,418 | 90.8% | 0 | 0 | 0 | 44,340,418 |
| Partial baths | 48,832,146 | 44,207,510 | 90.5% | 0 | 0 | 0 | 44,207,510 |
| Parking area | 48,832,146 | 43,581,106 | 89.2% | 0 | 0 | 0 | 43,581,106 |
| Lot number | 46,745,314 | 42,929,226 | 91.8% | 0 | 0 | 0 | 42,929,226 |
| Exterior walls | 53,569,414 | 42,752,410 | 79.8% | 0 | 0 | 2 | 42,752,408 |
| Garage | 48,832,146 | 42,433,355 | 86.9% | 0 | 0 | 0 | 42,433,355 |
| Condition | 48,832,146 | 42,395,173 | 86.8% | 0 | 0 | 0 | 42,395,173 |
| Cooling | 48,832,146 | 41,951,169 | 85.9% | 0 | 0 | 0 | 41,951,169 |
| Subdivision | 51,758,477 | 41,408,588 | 80.0% | 0 | 0 | 0 | 41,408,588 |
| Ground floor area | 43,818,983 | 40,317,778 | 92.0% | 0 | 0 | 0 | 40,317,778 |
| Architectural style | 53,569,414 | 39,462,357 | 73.7% | 0 | 0 | 0 | 39,462,357 |
| Buildings on the parcel | 46,745,314 | 38,862,046 | 83.1% | 0 | 0 | 0 | 38,862,046 |
| Heating | 48,832,146 | 38,407,429 | 78.7% | 0 | 0 | 0 | 38,407,429 |
| Effective year built | 53,569,414 | 37,060,612 | 69.2% | 0 | 0 | 0 | 37,060,612 |
| Full baths | 48,832,146 | 35,871,668 | 73.5% | 5 | 0 | 0 | 35,871,663 |
| Property type | 53,569,414 | 33,475,461 | 62.5% | 0 | 31,513,874 | 0 | 1,961,587 |
| Stories | 53,569,414 | 33,346,299 | 62.2% | 0 | 0 | 15,026 | 33,331,273 |
| Tax code area | 51,758,477 | 32,895,903 | 63.6% | 0 | 0 | 0 | 32,895,903 |
| Bathrooms | 48,832,146 | 30,784,075 | 63.0% | 0 | 0 | 0 | 30,784,075 |
| Bedrooms | 48,832,146 | 30,097,886 | 61.6% | 0 | 0 | 0 | 30,097,886 |
| Municipality | 53,569,414 | 28,245,499 | 52.7% | 0 | 0 | 0 | 28,245,499 |
| Legal description | 51,758,477 | 27,828,592 | 53.8% | 0 | 0 | 0 | 27,828,592 |
| Lot area | 46,745,314 | 20,300,634 | 43.4% | 0 | 14,731,866 | 0 | 5,568,768 |
| Lot size | 46,745,314 | 15,789,631 | 33.8% | 0 | 10,204,837 | 0 | 5,584,794 |
| Living area | 48,832,146 | 11,746,803 | 24.1% | 0 | 0 | 0 | 11,746,803 |
| County use code | 51,758,477 | 11,373,776 | 22.0% | 0 | 0 | 0 | 11,373,776 |
| Year built | 53,569,414 | 10,024,511 | 18.7% | 0 | 0 | 14 | 10,024,497 |
| Address on record | 51,758,477 | 3,430,659 | 6.6% | 0 | 0 | 0 | 3,430,659 |
| Land use | 51,758,477 | 3,189,243 | 6.2% | 0 | 0 | 0 | 3,189,243 |
| Parcel number (APN) | 51,758,477 | 1 | 0.0% | 0 | 0 | 0 | 1 |
| County | 53,569,414 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| County code (FIPS) | 53,569,414 | 0 | 0.0% | 0 | 0 | 0 | 0 |

## Live counties

The 36 counties people see on Property details today. 36 counties: 12,243,544 homes and 1,403,308 residential building records. 529,329 homes (4.3% of those with rooms of their own) lack bedrooms or bathrooms; 725,516 records (5.3%) lack at least one of bedrooms, bathrooms, living area, year built or lot size, where it applies. 48 restricted records and 0 taken-down addresses are counted out and never listed.

| Field | Records it applies to | Missing | Share | County wrote 0 | Next build fills it | Building record has it | To look up |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| ZIP+4 | 13,080,183 | 12,904,435 | 98.7% | 0 | 0 | 0 | 12,904,435 |
| Property subtype | 13,080,183 | 12,640,007 | 96.6% | 0 | 0 | 0 | 12,640,007 |
| Parking spaces | 12,243,544 | 10,437,411 | 85.2% | 0 | 0 | 0 | 10,437,411 |
| Property class | 13,080,183 | 10,301,501 | 78.8% | 0 | 0 | 0 | 10,301,501 |
| Buildings on the parcel | 11,268,207 | 9,644,070 | 85.6% | 0 | 0 | 0 | 9,644,070 |
| Subdivision | 13,080,183 | 9,231,889 | 70.6% | 0 | 0 | 0 | 9,231,889 |
| Parking area | 12,243,544 | 9,029,806 | 73.8% | 0 | 0 | 0 | 9,029,806 |
| Fireplaces | 12,243,544 | 8,986,464 | 73.4% | 1,415 | 0 | 0 | 8,985,049 |
| Partial baths | 12,243,544 | 8,974,553 | 73.3% | 0 | 0 | 0 | 8,974,553 |
| Gross area | 13,646,852 | 8,348,561 | 61.2% | 0 | 0 | 0 | 8,348,561 |
| Architectural style | 13,646,852 | 8,340,325 | 61.1% | 0 | 0 | 0 | 8,340,325 |
| Roof cover | 13,646,852 | 8,289,306 | 60.7% | 0 | 0 | 0 | 8,289,306 |
| Quality | 13,646,852 | 8,177,963 | 59.9% | 0 | 0 | 0 | 8,177,963 |
| Lot number | 11,268,207 | 7,885,950 | 70.0% | 0 | 0 | 0 | 7,885,950 |
| Parking type | 12,243,544 | 7,751,816 | 63.3% | 0 | 0 | 0 | 7,751,816 |
| Ground floor area | 10,431,568 | 7,609,339 | 72.9% | 0 | 0 | 0 | 7,609,339 |
| Condition | 12,243,544 | 7,522,001 | 61.4% | 0 | 0 | 0 | 7,522,001 |
| Garage | 12,243,544 | 7,383,075 | 60.3% | 0 | 0 | 0 | 7,383,075 |
| Exterior walls | 13,646,852 | 7,185,159 | 52.7% | 0 | 0 | 0 | 7,185,159 |
| Cooling | 12,243,544 | 6,994,510 | 57.1% | 0 | 0 | 0 | 6,994,510 |
| Effective year built | 13,646,852 | 5,785,929 | 42.4% | 0 | 0 | 0 | 5,785,929 |
| Heating | 12,243,544 | 5,524,135 | 45.1% | 0 | 0 | 0 | 5,524,135 |
| Legal description | 13,080,183 | 4,868,382 | 37.2% | 0 | 0 | 0 | 4,868,382 |
| Municipality | 13,646,852 | 4,803,831 | 35.2% | 0 | 0 | 0 | 4,803,831 |
| Full baths | 12,243,544 | 4,589,429 | 37.5% | 3 | 0 | 0 | 4,589,426 |
| Tax code area | 13,080,183 | 4,449,831 | 34.0% | 0 | 0 | 0 | 4,449,831 |
| Stories | 13,646,852 | 3,667,004 | 26.9% | 0 | 0 | 0 | 3,667,004 |
| County use code | 13,080,183 | 1,489,672 | 11.4% | 0 | 0 | 0 | 1,489,672 |
| Bathrooms | 12,243,544 | 473,968 | 3.9% | 0 | 0 | 0 | 473,968 |
| Bedrooms | 12,243,544 | 433,312 | 3.5% | 0 | 0 | 0 | 433,312 |
| Living area | 12,243,544 | 357,979 | 2.9% | 0 | 0 | 0 | 357,979 |
| Year built | 13,646,852 | 163,930 | 1.2% | 0 | 0 | 0 | 163,930 |
| Lot size | 11,268,207 | 145,061 | 1.3% | 0 | 0 | 0 | 145,061 |
| Lot area | 11,268,207 | 144,659 | 1.3% | 0 | 0 | 0 | 144,659 |
| Address on record | 13,080,183 | 25,118 | 0.2% | 0 | 0 | 0 | 25,118 |
| Land use | 13,080,183 | 24,828 | 0.2% | 0 | 0 | 0 | 24,828 |
| Property type | 13,646,852 | 2,126 | 0.0% | 0 | 2,126 | 0 | 0 |
| Parcel number (APN) | 13,080,183 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| County | 13,646,852 | 0 | 0.0% | 0 | 0 | 0 | 0 |
| County code (FIPS) | 13,646,852 | 0 | 0.0% | 0 | 0 | 0 | 0 |

## By kind of home

The core facts, missing (share of that kind). Most missing lot sizes come back with each county's next build, which computes the lot size from the lot area and the other way round (the field tables above count them):

| Kind | Homes | Bedrooms | Bathrooms | Living area | Year built | Lot size |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| House | 39,101,757 | 24,094,086 (61.6%) | 24,760,464 (63.3%) | 8,732,489 (22.3%) | 6,505,036 (16.6%) | 13,026,387 (33.3%) |
| Townhouse | 1,449,903 | 491,178 (33.9%) | 475,979 (32.8%) | 167,695 (11.6%) | 112,207 (7.7%) | 595,370 (41.1%) |
| Mobile home | 1,308,203 | 1,060,586 (81.1%) | 1,060,143 (81.0%) | 273,831 (20.9%) | 260,134 (19.9%) | 742,573 (56.8%) |
| Home, type not recorded | 1,959,120 | 1,616,677 (82.5%) | 1,617,969 (82.6%) | 1,605,511 (82.0%) | 1,608,955 (82.1%) | 303,543 (15.5%) |
| Condo unit | 5,013,163 | 2,835,359 (56.6%) | 2,869,520 (57.2%) | 967,277 (19.3%) | 738,259 (14.7%) | doesn’t apply |
| Two-to-four-unit building | 2,321,066 | doesn’t apply | doesn’t apply | doesn’t apply | 278,141 (12.0%) | 831,121 (35.8%) |
| Apartment or other building | 605,265 | doesn’t apply | doesn’t apply | doesn’t apply | 149,537 (24.7%) | 290,637 (48.0%) |
| Condo building | 1,810,937 | doesn’t apply | doesn’t apply | doesn’t apply | 372,242 (20.6%) | doesn’t apply |

## By state

| State | Counties | Records | No bedrooms or bathrooms | Share | A core fact missing | Share | Bedrooms | Bathrooms | Living area | Year built | Lot size |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| FL | 67 | 8,796,270 | 6,255,363 | 76.1% | 6,714,225 | 76.3% | 6,251,379 | 6,242,203 | 14,718 | 21,526 | 5,572,910 |
| TX | 25 | 6,208,388 | 3,366,710 | 55.6% | 4,031,583 | 64.9% | 3,350,658 | 2,917,154 | 102,655 | 109,123 | 1,449,826 |
| NY | 62 | 4,310,406 | 3,286,093 | 93.8% | 3,967,794 | 92.1% | 1,812,761 | 3,286,082 | 1,787,368 | 1,611,886 | 2,330,909 |
| NC | 88 | 3,038,974 | 2,310,478 | 78.5% | 2,355,928 | 77.5% | 2,310,131 | 2,291,415 | 1,446,615 | 670,715 | 191,003 |
| NJ | 21 | 2,727,578 | 2,308,070 | 100.0% | 2,344,436 | 86.0% | 2,308,070 | 2,308,070 | 2,308,070 | 58,889 | 205,489 |
| MD | 24 | 2,033,586 | 1,923,751 | 100.0% | 1,952,686 | 96.0% | 1,923,751 | 1,923,751 | 54,154 | 32,152 | 1,455,493 |
| MA | 14 | 2,291,642 | 1,718,096 | 92.7% | 1,826,333 | 79.7% | 1,718,087 | 1,714,361 | 43,919 | 12,003 | 281,324 |
| MN | 57 | 1,627,516 | 1,426,712 | 91.0% | 1,447,736 | 89.0% | 1,426,705 | 1,426,541 | 911,054 | 503,351 | 180,727 |
| WI | 71 | 1,565,930 | 1,346,113 | 89.3% | 1,363,982 | 87.1% | 1,346,035 | 1,345,485 | 1,345,395 | 1,352,408 | 44,023 |
| CO | 38 | 1,501,980 | 990,401 | 68.4% | 1,030,198 | 68.6% | 989,931 | 988,601 | 983,979 | 1,018,659 | 315,809 |
| UT | 29 | 983,549 | 877,326 | 100.0% | 881,212 | 89.6% | 877,326 | 877,326 | 102,499 | 90,353 | 3,771 |
| OH | 6 | 1,738,012 | 820,273 | 53.5% | 982,040 | 56.5% | 820,095 | 819,611 | 251,107 | 717,334 | 652,968 |
| WA | 35 | 1,391,591 | 790,895 | 59.5% | 850,082 | 61.1% | 785,791 | 786,014 | 772,505 | 811,549 | 768,836 |
| WV | 55 | 684,498 | 663,351 | 100.0% | 664,169 | 97.0% | 663,351 | 663,351 | 16,981 | 16,820 | 36,142 |
| OR | 4 | 602,877 | 499,771 | 88.8% | 503,895 | 83.6% | 499,673 | 499,481 | 560 | 4,224 | 899 |
| CA | 8 | 5,418,944 | 451,738 | 9.5% | 1,516,069 | 28.0% | 450,180 | 381,680 | 362,585 | 1,334,752 | 1,002,895 |
| MO | 3 | 744,185 | 353,567 | 49.0% | 358,655 | 48.2% | 353,529 | 353,101 | 1,352 | 2,680 | 3,151 |
| IL | 1 | 1,571,131 | 268,442 | 20.6% | 307,768 | 19.6% | 175,250 | 267,888 | 226,512 | 19,004 | 18,326 |
| ME | 16 | 244,806 | 238,662 | 100.0% | 244,806 | 100.0% | 238,662 | 238,662 | 234,287 | 244,806 | 241,467 |
| MI | 2 | 734,820 | 236,152 | 37.1% | 714,886 | 97.3% | 235,999 | 207,312 | 18,817 | 526,257 | 345,415 |
| VT | 14 | 234,043 | 231,761 | 100.0% | 234,043 | 100.0% | 231,761 | 231,761 | 231,761 | 234,043 | 2,119 |
| GA | 1 | 264,533 | 225,343 | 100.0% | 264,533 | 100.0% | 225,343 | 225,343 | 225,343 | 264,533 | 40 |
| OK | 2 | 499,221 | 219,174 | 45.5% | 219,548 | 44.0% | 219,069 | 3,205 | 1,662 | 243 | 142 |
| TN | 1 | 265,464 | 217,828 | 100.0% | 265,464 | 100.0% | 217,828 | 217,828 | 707 | 265,464 | 1,278 |
| NM | 1 | 209,215 | 203,059 | 100.0% | 204,290 | 97.6% | 203,059 | 203,059 | 203,059 | 1,231 | 400 |
| NE | 1 | 180,278 | 174,633 | 100.0% | 178,959 | 99.3% | 174,633 | 174,633 | 0 | 67 | 175,103 |
| SC | 1 | 99,990 | 99,346 | 100.0% | 99,364 | 99.4% | 99,346 | 7,031 | 1,925 | 9,710 | 2,708 |
| PA | 5 | 1,491,255 | 84,592 | 6.2% | 499,044 | 33.5% | 73,947 | 75,787 | 2,086 | 7,725 | 482,175 |
| MT | 56 | 421,012 | 53,415 | 12.9% | 59,241 | 14.1% | 51,375 | 52,621 | 49,828 | 50,542 | 4,938 |
| CT | 9 | 1,190,683 | 28,316 | 2.8% | 44,055 | 3.7% | 27,765 | 24,536 | 17,191 | 16,456 | 14,574 |
| DC | 1 | 202,889 | 27,635 | 15.6% | 31,979 | 15.8% | 27,626 | 22,287 | 22,256 | 14,580 | 193 |
| ID | 10 | 48,725 | 9,012 | 18.7% | 15,547 | 31.9% | 8,552 | 7,665 | 5,767 | 1,336 | 4,401 |
| VA | 3 | 245,423 | 275 | 0.1% | 497 | 0.2% | 218 | 230 | 86 | 90 | 177 |

## Counties with the largest gaps

The 40 counties with the most homes lacking bedrooms or bathrooms. Every county and every field is in [missing-facts-by-county.csv](evidence/missing-facts-by-county.csv), and every state in [missing-facts-by-state.csv](evidence/missing-facts-by-state.csv).

| County | State | Live | Records | No bedrooms or bathrooms | Share | A core fact missing | Share | Bedrooms | Bathrooms | Living area | Year built | Lot size |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Tarrant County | TX |  | 615,134 | 606,438 | 100.0% | 606,499 | 98.6% | 606,438 | 606,438 | 1,406 | 1,654 | 19,901 |
| Palm Beach County | FL |  | 662,544 | 580,633 | 100.0% | 591,931 | 89.3% | 580,633 | 580,633 | 1,804 | 910 | 400,740 |
| Bexar County | TX |  | 583,292 | 572,070 | 100.0% | 572,291 | 98.1% | 572,070 | 572,070 | 8,576 | 5,687 | 117 |
| Suffolk County | NY |  | 465,225 | 445,948 | 100.0% | 462,630 | 99.4% | 373,081 | 445,948 | 372,360 | 388,197 | 63,381 |
| Orange County | FL |  | 430,306 | 406,402 | 100.0% | 413,694 | 96.1% | 406,402 | 406,402 | 659 | 955 | 362,785 |
| Cuyahoga County | OH |  | 439,524 | 387,072 | 100.0% | 439,524 | 100.0% | 387,072 | 387,072 | 4,574 | 439,524 | 390,644 |
| Lee County | FL |  | 404,588 | 382,131 | 100.0% | 387,438 | 95.8% | 382,131 | 382,131 | 1,189 | 2,928 | 296,281 |
| Middlesex County | MA |  | 529,540 | 381,484 | 93.3% | 398,583 | 75.3% | 381,477 | 381,274 | 25,497 | 4,906 | 21,376 |
| Pinellas County | FL |  | 406,526 | 374,977 | 100.0% | 388,679 | 95.6% | 374,977 | 374,977 | 27 | 13 | 282,996 |
| Collin County | TX |  | 373,736 | 368,458 | 100.0% | 371,819 | 99.5% | 368,458 | 368,458 | 8,565 | 8,607 | 259,508 |
| Hennepin County | MN |  | 400,401 | 368,209 | 100.0% | 368,747 | 92.1% | 368,209 | 368,209 | 368,209 | 1,174 | 13 |
| Wake County | NC |  | 371,763 | 367,220 | 100.0% | 367,221 | 98.8% | 367,220 | 367,220 | 905 | 480 | 0 |
| Nassau County | NY |  | 389,203 | 356,551 | 100.0% | 389,203 | 100.0% | 356,551 | 356,551 | 356,551 | 389,203 | 376,328 |
| St. Louis County | MO |  | 360,091 | 351,821 | 100.0% | 351,857 | 97.7% | 351,821 | 351,821 | 97 | 45 | 0 |
| Salt Lake County | UT |  | 349,871 | 340,618 | 100.0% | 341,030 | 97.5% | 340,618 | 340,618 | 16,330 | 16,054 | 0 |
| Contra Costa County | CA |  | 364,855 | 338,306 | 100.0% | 363,740 | 99.7% | 338,306 | 338,306 | 335,363 | 358,715 | 290,877 |
| Duval County | FL |  | 342,460 | 332,847 | 100.0% | 338,872 | 99.0% | 332,847 | 332,847 | 0 | 8 | 312,429 |
| Montgomery County | MD |  | 328,610 | 308,072 | 100.0% | 309,418 | 94.2% | 308,072 | 308,072 | 489 | 709 | 233,948 |
| Broward County | FL |  | 736,656 | 298,754 | 45.0% | 635,027 | 86.2% | 294,964 | 298,185 | 1,099 | 615 | 410,151 |
| Polk County | FL |  | 289,890 | 277,273 | 100.0% | 284,370 | 98.1% | 277,273 | 277,273 | 1 | 1 | 275,803 |
| Cook County | IL | yes | 1,571,131 | 268,442 | 20.6% | 307,768 | 19.6% | 175,250 | 267,888 | 226,512 | 19,004 | 18,326 |
| Brevard County | FL |  | 279,912 | 261,860 | 100.0% | 265,346 | 94.8% | 261,860 | 261,860 | 1,553 | 883 | 229,417 |
| Hidalgo County | TX |  | 260,554 | 251,094 | 100.0% | 251,666 | 96.6% | 251,094 | 251,094 | 5,235 | 3,484 | 30,632 |
| Prince George's County | MD |  | 265,203 | 250,481 | 100.0% | 251,817 | 95.0% | 250,481 | 250,481 | 239 | 1,029 | 215,266 |
| Erie County | NY |  | 302,452 | 249,484 | 100.0% | 290,510 | 96.1% | 1,966 | 249,484 | 1,849 | 1,829 | 210,352 |
| Baltimore County | MD |  | 263,710 | 249,043 | 100.0% | 253,732 | 96.2% | 249,043 | 249,043 | 2,281 | 10,947 | 195,895 |
| Montgomery County | TX |  | 246,009 | 245,482 | 100.0% | 245,922 | 100.0% | 245,482 | 245,482 | 6,794 | 22,033 | 245,664 |
| Pasco County | FL |  | 253,829 | 245,246 | 100.0% | 248,674 | 98.0% | 245,246 | 245,246 | 46 | 52 | 236,965 |
| Ocean County | NJ |  | 259,916 | 240,254 | 100.0% | 241,628 | 93.0% | 240,254 | 240,254 | 240,254 | 699 | 28,344 |
| Hamilton County | OH |  | 259,392 | 237,381 | 100.0% | 259,392 | 100.0% | 237,381 | 237,381 | 237,381 | 259,392 | 1,423 |
| Travis County | TX |  | 393,548 | 236,411 | 64.3% | 236,753 | 60.2% | 236,128 | 32,018 | 2,388 | 2,643 | 11,824 |
| Volusia County | FL |  | 236,912 | 230,361 | 100.0% | 233,464 | 98.5% | 230,361 | 230,361 | 482 | 776 | 204,536 |
| DeKalb County | GA |  | 264,533 | 225,343 | 100.0% | 264,533 | 100.0% | 225,343 | 225,343 | 225,343 | 264,533 | 40 |
| Bergen County | NJ |  | 278,963 | 224,209 | 100.0% | 226,479 | 81.2% | 224,209 | 224,209 | 224,209 | 2,076 | 13,845 |
| Worcester County | MA |  | 274,213 | 222,130 | 100.0% | 223,607 | 81.5% | 222,130 | 222,130 | 1,907 | 915 | 7,130 |
| Collier County | FL |  | 245,977 | 219,416 | 100.0% | 222,427 | 90.4% | 219,416 | 219,416 | 77 | 0 | 119,713 |
| Davidson County | TN |  | 265,464 | 217,828 | 100.0% | 265,464 | 100.0% | 217,828 | 217,828 | 707 | 265,464 | 1,278 |
| Tulsa County | OK |  | 224,882 | 217,159 | 100.0% | 217,159 | 96.6% | 217,159 | 1,279 | 30 | 224 | 32 |
| Multnomah County | OR |  | 235,900 | 216,338 | 100.0% | 217,332 | 92.1% | 216,338 | 216,338 | 318 | 1,268 | 0 |
| Wayne County | MI |  | 227,097 | 204,894 | 100.0% | 207,163 | 91.2% | 204,894 | 204,894 | 16,048 | 18,534 | 155 |

## Live counties, one by one

| County | State | Records | No bedrooms or bathrooms | Share | A core fact missing | Share | Bedrooms | Bathrooms | Living area | Year built | Lot size |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Cook County | IL | 1,571,131 | 268,442 | 20.6% | 307,768 | 19.6% | 175,250 | 267,888 | 226,512 | 19,004 | 18,326 |
| Denton County | TX | 317,399 | 43,600 | 14.0% | 43,734 | 13.8% | 43,475 | 23,869 | 1,730 | 1,737 | 7,678 |
| Harris County | TX | 1,245,935 | 33,533 | 2.8% | 72,898 | 5.9% | 33,493 | 33,435 | 9,591 | 6,058 | 39,355 |
| District of Columbia | DC | 202,889 | 27,635 | 15.6% | 31,979 | 15.8% | 27,626 | 22,287 | 22,256 | 14,580 | 193 |
| Mecklenburg County | NC | 387,209 | 27,081 | 7.4% | 29,088 | 7.5% | 26,998 | 26,492 | 26,797 | 27,092 | 0 |
| Miami-Dade County | FL | 856,283 | 23,319 | 3.0% | 24,173 | 2.8% | 23,130 | 11,713 | 611 | 1 | 680 |
| Riverside County | CA | 790,516 | 17,534 | 2.4% | 32,039 | 4.1% | 17,137 | 16,911 | 14,331 | 19,720 | 10,907 |
| Pierce County | WA | 286,118 | 10,724 | 3.9% | 25,783 | 9.0% | 10,544 | 10,636 | 10,332 | 13,732 | 11,671 |
| Los Angeles County | CA | 2,157,802 | 10,135 | 0.6% | 13,983 | 0.6% | 9,846 | 3,419 | 0 | 4,063 | 0 |
| San Bernardino County | CA | 596,291 | 8,909 | 1.6% | 12,071 | 2.0% | 8,519 | 7,447 | 5,796 | 8,424 | 730 |
| Denver County | CO | 216,522 | 7,158 | 3.4% | 7,696 | 3.6% | 7,158 | 5,581 | 5,559 | 4,981 | 438 |
| Western Connecticut Planning Region | CT | 187,249 | 6,169 | 3.9% | 7,043 | 3.8% | 6,145 | 5,001 | 3,606 | 2,822 | 635 |
| Capitol Planning Region | CT | 270,273 | 5,922 | 2.6% | 9,631 | 3.6% | 5,671 | 4,738 | 3,435 | 2,849 | 3,687 |
| Dane County | WI | 74,158 | 5,635 | 8.4% | 11,027 | 14.9% | 5,634 | 5,554 | 5,566 | 1,190 | 5,351 |
| Franklin County | OH | 519,475 | 4,753 | 1.2% | 13,257 | 2.6% | 4,715 | 4,129 | 4,084 | 12,516 | 0 |
| South Central Connecticut Planning Region | CT | 183,974 | 4,707 | 3.2% | 7,098 | 3.9% | 4,688 | 4,179 | 2,228 | 2,612 | 1,987 |
| Naugatuck Valley Planning Region | CT | 168,047 | 2,827 | 2.0% | 5,571 | 3.3% | 2,789 | 2,676 | 2,068 | 2,163 | 2,719 |
| Southeastern Connecticut Planning Region | CT | 92,268 | 2,565 | 3.2% | 5,621 | 6.1% | 2,534 | 2,444 | 1,959 | 1,792 | 3,067 |
| Lower Connecticut River Valley Planning Region | CT | 106,871 | 2,467 | 2.7% | 3,467 | 3.2% | 2,417 | 2,332 | 1,705 | 1,791 | 786 |
| Oklahoma County | OK | 274,339 | 2,015 | 0.8% | 2,389 | 0.9% | 1,910 | 1,926 | 1,632 | 19 | 110 |
| San Joaquin County | CA | 213,230 | 1,946 | 1.0% | 3,328 | 1.6% | 1,929 | 1,928 | 1,192 | 2,610 | 431 |
| Ramsey County | MN | 153,898 | 1,858 | 1.3% | 14,951 | 9.7% | 1,851 | 1,687 | 1,673 | 1,171 | 13,417 |
| Greater Bridgeport Planning Region | CT | 99,645 | 1,787 | 2.3% | 2,437 | 2.4% | 1,781 | 1,524 | 1,014 | 1,255 | 264 |
| Hillsborough County | FL | 459,147 | 1,203 | 0.3% | 3,485 | 0.8% | 1,200 | 612 | 23 | 3 | 2,290 |
| Northwest Hills Planning Region | CT | 45,055 | 1,180 | 2.9% | 1,713 | 3.8% | 1,073 | 1,029 | 660 | 664 | 574 |
| Montgomery County | PA | 287,886 | 1,157 | 0.5% | 4,559 | 1.6% | 1,121 | 1,133 | 1,077 | 1,447 | 2,968 |
| Jackson County | MO | 241,665 | 987 | 0.4% | 6,022 | 2.5% | 960 | 619 | 651 | 2,486 | 3,151 |
| Clark County | WA | 175,959 | 861 | 0.5% | 6,730 | 3.8% | 848 | 789 | 815 | 1,391 | 5,270 |
| Milwaukee County | WI | 140,744 | 752 | 0.7% | 1,927 | 1.4% | 675 | 205 | 103 | 190 | 1,205 |
| Northeastern Connecticut Planning Region | CT | 37,301 | 692 | 2.0% | 1,474 | 4.0% | 667 | 613 | 516 | 508 | 855 |
| Allegheny County | PA | 465,278 | 585 | 0.1% | 8,250 | 1.8% | 362 | 502 | 250 | 4,817 | 3,130 |
| Adams County | CO | 154,012 | 462 | 0.3% | 2,225 | 1.4% | 448 | 374 | 0 | 0 | 1,906 |
| Sarasota County | FL | 264,035 | 409 | 0.2% | 1,498 | 0.6% | 408 | 16 | 5 | 36 | 1,059 |
| Monroe County | NY | 235,076 | 197 | 0.1% | 286 | 0.1% | 191 | 186 | 169 | 184 | 45 |
| Seminole County | FL | 156,021 | 62 | 0.0% | 63 | 0.0% | 61 | 61 | 7 | 2 | 0 |
| Charlottesville city | VA | 13,151 | 61 | 0.5% | 252 | 1.9% | 58 | 33 | 26 | 20 | 176 |
