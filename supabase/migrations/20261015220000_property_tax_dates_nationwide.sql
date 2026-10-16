-- Backwards compatible: yes. Data only (no schema change).
--
-- Property-tax dates, checked nationwide on 2026-10-15 against each state's
-- own statute or tax department (the row's source and source_url).
--
--   * The 69 seeded state rows outside Washington were all 'unverified' with
--     no source link. Each now cites the official page it was checked
--     against. Rows whose date is a statewide rule become 'official'; rows
--     where towns or cities set the date (Connecticut, Massachusetts,
--     Michigan) stay 'unverified' and say so.
--   * Titles now say what the date is when it is not a plain due date, e.g.
--     "last day to pay without interest" (North Carolina, Tennessee),
--     "delinquent after 5 p.m." (Arizona, California).
--   * Colorado's first half is due on the last day of February, so the rule
--     moves to BYMONTHDAY=-1 (Feb 28 was a day early in leap years).
--   * North Dakota's Feb 15 is the 5% full-payment discount deadline, not a
--     due date; the halves (Mar 1 and Oct 15) are added.
--   * New rows: Nebraska (state, plus Douglas, Lancaster and Sarpy, which
--     are a month earlier), Georgia (the state default, unverified, plus
--     Cobb, DeKalb and Gwinnett), Franklin County, Ohio, and New Castle
--     County, Delaware (Dec 31 for 2026 by state law; Sep 30 expected from
--     2027). County rows are keyed `ST:<county FIPS>` and win over the state
--     rows for homes in that county (addressCalendarService).
--   * Illinois, Ohio's other counties and the town-set states (AK, ME, NH,
--     NY, PA, RI, VA, VT) get no invented dates: the calendar tells those
--     homes where their dates are set instead.
BEGIN;
SET LOCAL lock_timeout='5s';

UPDATE public."AddressCalendarRule" SET title = 'Property tax — first half due', detail = 'Interest starts if it is still unpaid after Dec 10.', source = 'New Mexico Taxation and Revenue Department (NMSA 7-38-38)', source_url = 'https://www.tax.newmexico.gov/businesses/wp-content/uploads/sites/4/2024/01/Important-Dates.pdf', confidence = 'official', updated_at = now()
WHERE scope_type = 'state' AND scope_key = 'NM' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=11;BYMONTHDAY=10';

UPDATE public."AddressCalendarRule" SET title = 'Property tax — second half due', detail = 'Interest starts if it is still unpaid after May 10.', source = 'New Mexico Taxation and Revenue Department (NMSA 7-38-38)', source_url = 'https://www.tax.newmexico.gov/businesses/wp-content/uploads/sites/4/2024/01/Important-Dates.pdf', confidence = 'official', updated_at = now()
WHERE scope_type = 'state' AND scope_key = 'NM' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=4;BYMONTHDAY=10';

UPDATE public."AddressCalendarRule" SET title = 'Property tax due — in full, or the first of four installments', detail = 'Each installment has a 10-day grace period before a penalty.', source = 'Nev. Rev. Stat. 361.483', source_url = 'https://www.leg.state.nv.us/NRS/NRS-361.html#NRS361Sec483', confidence = 'official', updated_at = now()
WHERE scope_type = 'state' AND scope_key = 'NV' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=8;BYDAY=3MO';

UPDATE public."AddressCalendarRule" SET title = 'Property tax — second installment due', detail = 'A penalty applies if it is not paid within 10 days.', source = 'Nev. Rev. Stat. 361.483', source_url = 'https://www.leg.state.nv.us/NRS/NRS-361.html#NRS361Sec483', confidence = 'official', updated_at = now()
WHERE scope_type = 'state' AND scope_key = 'NV' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=10;BYDAY=1MO';

UPDATE public."AddressCalendarRule" SET title = 'Property tax — third installment due', detail = 'A penalty applies if it is not paid within 10 days.', source = 'Nev. Rev. Stat. 361.483', source_url = 'https://www.leg.state.nv.us/NRS/NRS-361.html#NRS361Sec483', confidence = 'official', updated_at = now()
WHERE scope_type = 'state' AND scope_key = 'NV' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=1;BYDAY=1MO';

UPDATE public."AddressCalendarRule" SET title = 'Property tax — fourth installment due', detail = 'A penalty applies if it is not paid within 10 days.', source = 'Nev. Rev. Stat. 361.483', source_url = 'https://www.leg.state.nv.us/NRS/NRS-361.html#NRS361Sec483', confidence = 'official', updated_at = now()
WHERE scope_type = 'state' AND scope_key = 'NV' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=3;BYDAY=1MO';

UPDATE public."AddressCalendarRule" SET title = 'Property tax — first half (or all) due', detail = 'Taxes are due from Nov 1; at least half must be paid by Dec 31.', source = '68 O.S. § 2913', source_url = 'https://www.oscn.net/applications/oscn/DeliverDocument.asp?CiteID=93075', confidence = 'official', updated_at = now()
WHERE scope_type = 'state' AND scope_key = 'OK' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=12;BYMONTHDAY=31';

UPDATE public."AddressCalendarRule" SET title = 'Property tax — second half due', detail = 'When the first half was paid by Dec 31.', source = '68 O.S. § 2913', source_url = 'https://www.oscn.net/applications/oscn/DeliverDocument.asp?CiteID=93075', confidence = 'official', updated_at = now()
WHERE scope_type = 'state' AND scope_key = 'OK' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=3;BYMONTHDAY=31';

UPDATE public."AddressCalendarRule" SET title = 'Property tax — first third due (or all, with a 3% discount)', detail = NULL, source = 'Or. Rev. Stat. 311.505', source_url = 'https://www.oregonlegislature.gov/bills_laws/ors/ors311.html', confidence = 'official', updated_at = now()
WHERE scope_type = 'state' AND scope_key = 'OR' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=11;BYMONTHDAY=15';

UPDATE public."AddressCalendarRule" SET title = 'Property tax — second third due', detail = NULL, source = 'Or. Rev. Stat. 311.505', source_url = 'https://www.oregonlegislature.gov/bills_laws/ors/ors311.html', confidence = 'official', updated_at = now()
WHERE scope_type = 'state' AND scope_key = 'OR' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=15';

UPDATE public."AddressCalendarRule" SET title = 'Property tax — final third due', detail = NULL, source = 'Or. Rev. Stat. 311.505', source_url = 'https://www.oregonlegislature.gov/bills_laws/ors/ors311.html', confidence = 'official', updated_at = now()
WHERE scope_type = 'state' AND scope_key = 'OR' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=5;BYMONTHDAY=15';

UPDATE public."AddressCalendarRule" SET title = 'Property tax due (penalty after Jan 15)', detail = NULL, source = 'S.C. Code §§ 12-45-70, 12-45-180', source_url = 'https://www.scstatehouse.gov/code/t12c045.php', confidence = 'official', updated_at = now()
WHERE scope_type = 'state' AND scope_key = 'SC' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=1;BYMONTHDAY=15';

UPDATE public."AddressCalendarRule" SET title = 'Property tax — first half due', detail = NULL, source = 'S.D. Codified Laws 10-21-23', source_url = 'https://sdlegislature.gov/api/Statutes/10-21-23.html', confidence = 'official', updated_at = now()
WHERE scope_type = 'state' AND scope_key = 'SD' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=4;BYMONTHDAY=30';

UPDATE public."AddressCalendarRule" SET title = 'Property tax — second half due', detail = NULL, source = 'S.D. Codified Laws 10-21-23', source_url = 'https://sdlegislature.gov/api/Statutes/10-21-23.html', confidence = 'official', updated_at = now()
WHERE scope_type = 'state' AND scope_key = 'SD' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=10;BYMONTHDAY=31';

UPDATE public."AddressCalendarRule" SET title = 'Property tax — last day to pay without interest', detail = 'Taxes are due from the first Monday in October.', source = 'Tennessee Comptroller of the Treasury', source_url = 'https://comptroller.tn.gov/office-functions/pa/property-taxes/assessment-schedule.html', confidence = 'official', updated_at = now()
WHERE scope_type = 'state' AND scope_key = 'TN' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=28';

UPDATE public."AddressCalendarRule" SET title = 'Property tax — last day to pay before penalty', detail = 'Bills mailed after Jan 10 get a later date.', source = 'Texas Comptroller of Public Accounts', source_url = 'https://comptroller.texas.gov/taxes/property-tax/bills/penalty-bills.php', confidence = 'official', updated_at = now()
WHERE scope_type = 'state' AND scope_key = 'TX' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=1;BYMONTHDAY=31';

UPDATE public."AddressCalendarRule" SET title = 'Property tax due', detail = 'Moves to the next business day on a weekend or holiday.', source = 'Utah Code 59-2-1331', source_url = 'https://le.utah.gov/xcode/Title59/Chapter2/59-2-S1331.html', confidence = 'official', updated_at = now()
WHERE scope_type = 'state' AND scope_key = 'UT' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=11;BYMONTHDAY=30';

UPDATE public."AddressCalendarRule" SET title = 'Property tax — full payment or first installment due', detail = NULL, source = 'Wisconsin Department of Revenue', source_url = 'https://www.revenue.wi.gov/dor%20publications/pb060.pdf', confidence = 'official', updated_at = now()
WHERE scope_type = 'state' AND scope_key = 'WI' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=1;BYMONTHDAY=31';

UPDATE public."AddressCalendarRule" SET title = 'Property tax — final installment due', detail = NULL, source = 'Wisconsin Department of Revenue', source_url = 'https://www.revenue.wi.gov/dor%20publications/pb060.pdf', confidence = 'official', updated_at = now()
WHERE scope_type = 'state' AND scope_key = 'WI' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=7;BYMONTHDAY=31';

UPDATE public."AddressCalendarRule" SET title = 'Property tax — first half due', detail = 'Late after Sep 30; paying early earns a 2.5% discount.', source = 'West Virginia State Tax Department', source_url = 'https://tax.wv.gov/Business/PropertyTax/Pages/PropertyTaxDueDates.aspx', confidence = 'official', updated_at = now()
WHERE scope_type = 'state' AND scope_key = 'WV' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=9;BYMONTHDAY=1';

UPDATE public."AddressCalendarRule" SET title = 'Property tax — second half due', detail = 'Late after Mar 31; paying early earns a 2.5% discount.', source = 'West Virginia State Tax Department', source_url = 'https://tax.wv.gov/Business/PropertyTax/Pages/PropertyTaxDueDates.aspx', confidence = 'official', updated_at = now()
WHERE scope_type = 'state' AND scope_key = 'WV' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=3;BYMONTHDAY=1';

UPDATE public."AddressCalendarRule" SET title = 'Property tax — first half due', detail = 'Interest starts if it is still unpaid after Nov 10.', source = 'Wyo. Stat. 39-13-108', source_url = 'https://wyoleg.gov/statutes/compress/title39.pdf', confidence = 'official', updated_at = now()
WHERE scope_type = 'state' AND scope_key = 'WY' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=9;BYMONTHDAY=1';

UPDATE public."AddressCalendarRule" SET title = 'Property tax — second half due', detail = 'Interest starts if it is still unpaid after May 10.', source = 'Wyo. Stat. 39-13-108', source_url = 'https://wyoleg.gov/statutes/compress/title39.pdf', confidence = 'official', updated_at = now()
WHERE scope_type = 'state' AND scope_key = 'WY' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=3;BYMONTHDAY=1';

UPDATE public."AddressCalendarRule" SET title = 'Property tax — first half (or all) due', detail = NULL, source = 'Kansas Department of Revenue (K.S.A. 79-2004)', source_url = 'https://www.ksrevenue.gov/pvdproptaxcal.html', confidence = 'official', updated_at = now()
WHERE scope_type = 'state' AND scope_key = 'KS' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=12;BYMONTHDAY=20';

UPDATE public."AddressCalendarRule" SET title = 'Property tax — second half due', detail = NULL, source = 'Kansas Department of Revenue (K.S.A. 79-2004)', source_url = 'https://www.ksrevenue.gov/pvdproptaxcal.html', confidence = 'official', updated_at = now()
WHERE scope_type = 'state' AND scope_key = 'KS' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=5;BYMONTHDAY=10';

UPDATE public."AddressCalendarRule" SET title = 'Property tax due', detail = 'Paying in full by Nov 1 earns a 2% discount.', source = 'Ky. Rev. Stat. 134.015', source_url = 'https://apps.legislature.ky.gov/law/statutes/statute.aspx?id=28365', confidence = 'official', updated_at = now()
WHERE scope_type = 'state' AND scope_key = 'KY' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=12;BYMONTHDAY=31';

UPDATE public."AddressCalendarRule" SET title = 'Property tax due', detail = 'Orleans Parish has a later date.', source = 'La. R.S. 47:2127', source_url = 'https://legis.la.gov/Legis/Law.aspx?d=631514', confidence = 'official', updated_at = now()
WHERE scope_type = 'state' AND scope_key = 'LA' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=12;BYMONTHDAY=31';

UPDATE public."AddressCalendarRule" SET title = 'Property tax — quarterly installment due', detail = 'Only in towns that bill quarterly; your tax bill has your town’s dates.', source = 'Mass. Gen. Laws c. 59, § 57C', source_url = 'https://malegislature.gov/Laws/GeneralLaws/PartI/TitleIX/Chapter59/Section57C', confidence = 'unverified', updated_at = now()
WHERE scope_type = 'state' AND scope_key = 'MA' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=8;BYMONTHDAY=1';

UPDATE public."AddressCalendarRule" SET title = 'Property tax — quarterly installment due', detail = 'Only in towns that bill quarterly; your tax bill has your town’s dates.', source = 'Mass. Gen. Laws c. 59, § 57C', source_url = 'https://malegislature.gov/Laws/GeneralLaws/PartI/TitleIX/Chapter59/Section57C', confidence = 'unverified', updated_at = now()
WHERE scope_type = 'state' AND scope_key = 'MA' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=11;BYMONTHDAY=1';

UPDATE public."AddressCalendarRule" SET title = 'Property tax — quarterly installment due', detail = 'Only in towns that bill quarterly; your tax bill has your town’s dates.', source = 'Mass. Gen. Laws c. 59, § 57C', source_url = 'https://malegislature.gov/Laws/GeneralLaws/PartI/TitleIX/Chapter59/Section57C', confidence = 'unverified', updated_at = now()
WHERE scope_type = 'state' AND scope_key = 'MA' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=1';

UPDATE public."AddressCalendarRule" SET title = 'Property tax — quarterly installment due', detail = 'Only in towns that bill quarterly; your tax bill has your town’s dates.', source = 'Mass. Gen. Laws c. 59, § 57C', source_url = 'https://malegislature.gov/Laws/GeneralLaws/PartI/TitleIX/Chapter59/Section57C', confidence = 'unverified', updated_at = now()
WHERE scope_type = 'state' AND scope_key = 'MA' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=5;BYMONTHDAY=1';

UPDATE public."AddressCalendarRule" SET title = 'Property tax — first half, last day without interest', detail = 'For a principal residence paying in two installments.', source = 'Md. Tax-Property § 10-204.3', source_url = 'https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gtp&section=10-204.3&enactments=false', confidence = 'official', updated_at = now()
WHERE scope_type = 'state' AND scope_key = 'MD' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=9;BYMONTHDAY=30';

UPDATE public."AddressCalendarRule" SET title = 'Property tax — second half, last day without interest', detail = 'For a principal residence paying in two installments.', source = 'Maryland Department of Assessments and Taxation', source_url = 'https://dat.maryland.gov/realproperty/pages/question-and-answers-on-semiannual-property-tax-payment.aspx', confidence = 'official', updated_at = now()
WHERE scope_type = 'state' AND scope_key = 'MD' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=12;BYMONTHDAY=31';

UPDATE public."AddressCalendarRule" SET title = 'Property tax — summer taxes due', detail = 'The statewide date; some cities set their own.', source = 'Michigan State Tax Commission', source_url = 'https://www.michigan.gov/taxes/-/media/Project/Websites/treasury/STC/Bulletins/2025/Bulletin-11-of-2025---Property-Tax-and-Equalization-Calendar-for-2026.pdf', confidence = 'unverified', updated_at = now()
WHERE scope_type = 'state' AND scope_key = 'MI' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=9;BYMONTHDAY=14';

UPDATE public."AddressCalendarRule" SET title = 'Property tax — winter taxes, last day before a late penalty', detail = 'Due Dec 1; many towns add a penalty after Feb 14.', source = 'Michigan State Tax Commission', source_url = 'https://www.michigan.gov/taxes/-/media/Project/Websites/treasury/STC/Bulletins/2025/Bulletin-11-of-2025---Property-Tax-and-Equalization-Calendar-for-2026.pdf', confidence = 'unverified', updated_at = now()
WHERE scope_type = 'state' AND scope_key = 'MI' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=14';

UPDATE public."AddressCalendarRule" SET title = 'Property tax — first half due', detail = NULL, source = 'Minnesota Department of Revenue', source_url = 'https://www.revenue.state.mn.us/property-tax-calendar', confidence = 'official', updated_at = now()
WHERE scope_type = 'state' AND scope_key = 'MN' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=5;BYMONTHDAY=15';

UPDATE public."AddressCalendarRule" SET title = 'Property tax — second half due', detail = NULL, source = 'Minnesota Department of Revenue', source_url = 'https://www.revenue.state.mn.us/property-tax-calendar', confidence = 'official', updated_at = now()
WHERE scope_type = 'state' AND scope_key = 'MN' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=10;BYMONTHDAY=15';

UPDATE public."AddressCalendarRule" SET title = 'Property tax due', detail = NULL, source = 'Missouri State Tax Commission', source_url = 'https://stc.mo.gov/faq/what-fees-and-penalties-may-i-owe/', confidence = 'official', updated_at = now()
WHERE scope_type = 'state' AND scope_key = 'MO' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=12;BYMONTHDAY=31';

UPDATE public."AddressCalendarRule" SET title = 'Property tax due', detail = NULL, source = 'Mississippi Department of Revenue', source_url = 'https://www.dor.ms.gov/county-services/property-tax-frequently-asked-questions', confidence = 'official', updated_at = now()
WHERE scope_type = 'state' AND scope_key = 'MS' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=1';

UPDATE public."AddressCalendarRule" SET title = 'Property tax — first half due (5 p.m.)', detail = NULL, source = 'Mont. Code Ann. 15-16-102', source_url = 'https://mca.legmt.gov/bills/mca/title_0150/chapter_0160/part_0010/section_0020/0150-0160-0010-0020.html', confidence = 'official', updated_at = now()
WHERE scope_type = 'state' AND scope_key = 'MT' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=11;BYMONTHDAY=30';

UPDATE public."AddressCalendarRule" SET title = 'Property tax — second half due (5 p.m.)', detail = NULL, source = 'Mont. Code Ann. 15-16-102', source_url = 'https://mca.legmt.gov/bills/mca/title_0150/chapter_0160/part_0010/section_0020/0150-0160-0010-0020.html', confidence = 'official', updated_at = now()
WHERE scope_type = 'state' AND scope_key = 'MT' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=5;BYMONTHDAY=31';

UPDATE public."AddressCalendarRule" SET title = 'Property tax — last day to pay without interest', detail = 'Taxes are due Sep 1.', source = 'N.C. Gen. Stat. 105-360', source_url = 'https://www.ncleg.gov/EnactedLegislation/Statutes/HTML/BySection/Chapter_105/GS_105-360.html', confidence = 'official', updated_at = now()
WHERE scope_type = 'state' AND scope_key = 'NC' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=1;BYMONTHDAY=5';

UPDATE public."AddressCalendarRule" SET title = 'Property tax — last day for the 5% full-payment discount', detail = 'The halves are due Mar 1 and Oct 15.', source = 'N.D. Cent. Code ch. 57-20', source_url = 'https://www.ndlegis.gov/cencode/t57c20.pdf', confidence = 'official', updated_at = now()
WHERE scope_type = 'state' AND scope_key = 'ND' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=15';

UPDATE public."AddressCalendarRule" SET title = 'Property tax — quarterly installment due', detail = NULL, source = 'New Jersey Division of Taxation', source_url = 'https://nj.gov/treasury/taxation/pdf/pubs/workcalendar.pdf', confidence = 'official', updated_at = now()
WHERE scope_type = 'state' AND scope_key = 'NJ' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=1';

UPDATE public."AddressCalendarRule" SET title = 'Property tax — quarterly installment due', detail = NULL, source = 'New Jersey Division of Taxation', source_url = 'https://nj.gov/treasury/taxation/pdf/pubs/workcalendar.pdf', confidence = 'official', updated_at = now()
WHERE scope_type = 'state' AND scope_key = 'NJ' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=5;BYMONTHDAY=1';

UPDATE public."AddressCalendarRule" SET title = 'Property tax — quarterly installment due', detail = NULL, source = 'New Jersey Division of Taxation', source_url = 'https://nj.gov/treasury/taxation/pdf/pubs/workcalendar.pdf', confidence = 'official', updated_at = now()
WHERE scope_type = 'state' AND scope_key = 'NJ' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=8;BYMONTHDAY=1';

UPDATE public."AddressCalendarRule" SET title = 'Property tax — quarterly installment due', detail = NULL, source = 'New Jersey Division of Taxation', source_url = 'https://nj.gov/treasury/taxation/pdf/pubs/workcalendar.pdf', confidence = 'official', updated_at = now()
WHERE scope_type = 'state' AND scope_key = 'NJ' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=11;BYMONTHDAY=1';

UPDATE public."AddressCalendarRule" SET title = 'Property tax — last day to pay (delinquent after Dec 31)', detail = 'Taxes are due Oct 1.', source = 'Alabama Department of Revenue', source_url = 'https://www.revenue.alabama.gov/faqs/when-are-my-property-taxes-due/', confidence = 'official', updated_at = now()
WHERE scope_type = 'state' AND scope_key = 'AL' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=12;BYMONTHDAY=31';

UPDATE public."AddressCalendarRule" SET title = 'Property tax due', detail = 'Moves to the next business day on a weekend or holiday.', source = 'Arkansas Department of Finance and Administration', source_url = 'https://www.dfa.arkansas.gov/office/arkansas-assessment-coordination-division/real-property/residential-real-estate/', confidence = 'official', updated_at = now()
WHERE scope_type = 'state' AND scope_key = 'AR' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=10;BYMONTHDAY=15';

UPDATE public."AddressCalendarRule" SET title = 'Property tax — first half, delinquent after 5 p.m.', detail = 'Due Oct 1.', source = 'Ariz. Rev. Stat. § 42-18052', source_url = 'https://www.azleg.gov/ars/42/18052.htm', confidence = 'official', updated_at = now()
WHERE scope_type = 'state' AND scope_key = 'AZ' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=11;BYMONTHDAY=1';

UPDATE public."AddressCalendarRule" SET title = 'Property tax — second half, delinquent after 5 p.m.', detail = 'Due Mar 1.', source = 'Ariz. Rev. Stat. § 42-18052', source_url = 'https://www.azleg.gov/ars/42/18052.htm', confidence = 'official', updated_at = now()
WHERE scope_type = 'state' AND scope_key = 'AZ' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=5;BYMONTHDAY=1';

UPDATE public."AddressCalendarRule" SET title = 'Property tax — first installment, delinquent after 5 p.m.', detail = 'Due Nov 1.', source = 'California State Board of Equalization', source_url = 'https://www.boe.ca.gov/proptaxes/calendar.htm', confidence = 'official', updated_at = now()
WHERE scope_type = 'state' AND scope_key = 'CA' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=12;BYMONTHDAY=10';

UPDATE public."AddressCalendarRule" SET title = 'Property tax — second installment, delinquent after 5 p.m.', detail = 'Due Feb 1.', source = 'California State Board of Equalization', source_url = 'https://www.boe.ca.gov/proptaxes/calendar.htm', confidence = 'official', updated_at = now()
WHERE scope_type = 'state' AND scope_key = 'CA' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=4;BYMONTHDAY=10';

UPDATE public."AddressCalendarRule" SET title = 'Property tax — first half due (last day of February)', detail = 'Or pay the full year by Apr 30.', source = 'Colorado Division of Property Taxation', source_url = 'https://dpt.colorado.gov/understanding-property-taxes-in-colorado', confidence = 'official', rrule = 'FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=-1', updated_at = now()
WHERE scope_type = 'state' AND scope_key = 'CO' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=28';

UPDATE public."AddressCalendarRule" SET title = 'Property tax — second half due', detail = NULL, source = 'Colorado Division of Property Taxation', source_url = 'https://dpt.colorado.gov/understanding-property-taxes-in-colorado', confidence = 'official', updated_at = now()
WHERE scope_type = 'state' AND scope_key = 'CO' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=6;BYMONTHDAY=15';

UPDATE public."AddressCalendarRule" SET title = 'Property tax — first installment (most towns)', detail = 'Each town sets its dates; interest starts if it is unpaid after Aug 1.', source = 'Conn. Gen. Stat. §§ 12-142, 12-146', source_url = 'https://www.cga.ct.gov/current/pub/chap_204.htm', confidence = 'unverified', updated_at = now()
WHERE scope_type = 'state' AND scope_key = 'CT' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=7;BYMONTHDAY=1';

UPDATE public."AddressCalendarRule" SET title = 'Property tax — second installment (most towns)', detail = 'Each town sets its dates; interest starts if it is unpaid after Feb 1.', source = 'Conn. Gen. Stat. §§ 12-142, 12-146', source_url = 'https://www.cga.ct.gov/current/pub/chap_204.htm', confidence = 'unverified', updated_at = now()
WHERE scope_type = 'state' AND scope_key = 'CT' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=1;BYMONTHDAY=1';

UPDATE public."AddressCalendarRule" SET title = 'Property tax — first half due', detail = NULL, source = 'DC Office of Tax and Revenue (D.C. Code § 47-811)', source_url = 'https://otr.cfo.dc.gov/page/real-property-tax-bill-due-dates-and-delayed-tax-bills', confidence = 'official', updated_at = now()
WHERE scope_type = 'state' AND scope_key = 'DC' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=3;BYMONTHDAY=31';

UPDATE public."AddressCalendarRule" SET title = 'Property tax — second half due', detail = NULL, source = 'DC Office of Tax and Revenue (D.C. Code § 47-811)', source_url = 'https://otr.cfo.dc.gov/page/real-property-tax-bill-due-dates-and-delayed-tax-bills', confidence = 'official', updated_at = now()
WHERE scope_type = 'state' AND scope_key = 'DC' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=9;BYMONTHDAY=15';

UPDATE public."AddressCalendarRule" SET title = 'County property tax due', detail = 'Kent and Sussex counties; New Castle County has its own date.', source = 'Kent and Sussex county tax offices (9 Del. C. ch. 86)', source_url = 'https://sussexcountyde.gov/tax-frequently-asked-questions', confidence = 'official', updated_at = now()
WHERE scope_type = 'state' AND scope_key = 'DE' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=9;BYMONTHDAY=30';

UPDATE public."AddressCalendarRule" SET title = 'Property tax — last day before delinquency', detail = 'Due Nov 1; paying early (Nov–Feb) earns a discount.', source = 'Florida Department of Revenue', source_url = 'https://floridarevenue.com/property/Pages/Taxpayers.aspx', confidence = 'official', updated_at = now()
WHERE scope_type = 'state' AND scope_key = 'FL' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=3;BYMONTHDAY=31';

UPDATE public."AddressCalendarRule" SET title = 'Property tax — first installment due', detail = NULL, source = 'Hawaii county real property tax offices', source_url = 'https://www.honolulu.gov/bfs/treasury-division/', confidence = 'official', updated_at = now()
WHERE scope_type = 'state' AND scope_key = 'HI' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=8;BYMONTHDAY=20';

UPDATE public."AddressCalendarRule" SET title = 'Property tax — second installment due', detail = NULL, source = 'Hawaii county real property tax offices', source_url = 'https://www.honolulu.gov/bfs/treasury-division/', confidence = 'official', updated_at = now()
WHERE scope_type = 'state' AND scope_key = 'HI' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=20';

UPDATE public."AddressCalendarRule" SET title = 'Property tax — first half due', detail = 'Interest starts Oct 1.', source = 'Iowa Department of Revenue (Iowa Code § 445.37)', source_url = 'https://revenue.iowa.gov/taxes/tax-guidance/property-tax/iowa-property-tax-overview', confidence = 'official', updated_at = now()
WHERE scope_type = 'state' AND scope_key = 'IA' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=9;BYMONTHDAY=30';

UPDATE public."AddressCalendarRule" SET title = 'Property tax — second half due', detail = 'Interest starts Apr 1.', source = 'Iowa Department of Revenue (Iowa Code § 445.37)', source_url = 'https://revenue.iowa.gov/taxes/tax-guidance/property-tax/iowa-property-tax-overview', confidence = 'official', updated_at = now()
WHERE scope_type = 'state' AND scope_key = 'IA' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=3;BYMONTHDAY=31';

UPDATE public."AddressCalendarRule" SET title = 'Property tax — first half (or all) due', detail = NULL, source = 'Idaho State Tax Commission (Idaho Code § 63-903)', source_url = 'https://tax.idaho.gov/taxes/property/understanding-property-taxes/', confidence = 'official', updated_at = now()
WHERE scope_type = 'state' AND scope_key = 'ID' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=12;BYMONTHDAY=20';

UPDATE public."AddressCalendarRule" SET title = 'Property tax — second half due', detail = 'If the first half was paid by Dec 20.', source = 'Idaho State Tax Commission (Idaho Code § 63-903)', source_url = 'https://tax.idaho.gov/taxes/property/understanding-property-taxes/', confidence = 'official', updated_at = now()
WHERE scope_type = 'state' AND scope_key = 'ID' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=6;BYMONTHDAY=20';

UPDATE public."AddressCalendarRule" SET title = 'Property tax — spring installment due', detail = 'Moves to the next business day on a weekend or holiday.', source = 'Indiana Department of Local Government Finance', source_url = 'https://www.in.gov/dlgf/understanding-your-tax-bill/property-tax-due-dates/', confidence = 'official', updated_at = now()
WHERE scope_type = 'state' AND scope_key = 'IN' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=5;BYMONTHDAY=10';

UPDATE public."AddressCalendarRule" SET title = 'Property tax — fall installment due', detail = 'Moves to the next business day on a weekend or holiday.', source = 'Indiana Department of Local Government Finance', source_url = 'https://www.in.gov/dlgf/understanding-your-tax-bill/property-tax-due-dates/', confidence = 'official', updated_at = now()
WHERE scope_type = 'state' AND scope_key = 'IN' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=11;BYMONTHDAY=10';

INSERT INTO public."AddressCalendarRule" (scope_type, scope_key, kind, title, detail, rrule, dtstart, lead_days, source, source_url, confidence)
SELECT 'state', 'ND', 'property_tax', 'Property tax — first half due', 'With any special assessments.', 'FREQ=YEARLY;BYMONTH=3;BYMONTHDAY=1', '2027-03-01'::date, 14, 'N.D. Cent. Code ch. 57-20', 'https://www.ndlegis.gov/cencode/t57c20.pdf', 'official'
WHERE NOT EXISTS (SELECT 1 FROM public."AddressCalendarRule" WHERE scope_type = 'state' AND scope_key = 'ND' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=3;BYMONTHDAY=1' AND dtstart = '2027-03-01'::date);

INSERT INTO public."AddressCalendarRule" (scope_type, scope_key, kind, title, detail, rrule, dtstart, lead_days, source, source_url, confidence)
SELECT 'state', 'ND', 'property_tax', 'Property tax — second half due', NULL, 'FREQ=YEARLY;BYMONTH=10;BYMONTHDAY=15', '2026-10-15'::date, 14, 'N.D. Cent. Code ch. 57-20', 'https://www.ndlegis.gov/cencode/t57c20.pdf', 'official'
WHERE NOT EXISTS (SELECT 1 FROM public."AddressCalendarRule" WHERE scope_type = 'state' AND scope_key = 'ND' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=10;BYMONTHDAY=15' AND dtstart = '2026-10-15'::date);

INSERT INTO public."AddressCalendarRule" (scope_type, scope_key, kind, title, detail, rrule, dtstart, lead_days, source, source_url, confidence)
SELECT 'state', 'NE', 'property_tax', 'Property tax — first half, last day before interest', 'Douglas, Lancaster and Sarpy counties are a month earlier.', 'FREQ=YEARLY;BYMONTH=4;BYMONTHDAY=30', '2026-04-30'::date, 14, 'Neb. Rev. Stat. 77-204', 'https://nebraskalegislature.gov/laws/statutes.php?statute=77-204', 'official'
WHERE NOT EXISTS (SELECT 1 FROM public."AddressCalendarRule" WHERE scope_type = 'state' AND scope_key = 'NE' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=4;BYMONTHDAY=30' AND dtstart = '2026-04-30'::date);

INSERT INTO public."AddressCalendarRule" (scope_type, scope_key, kind, title, detail, rrule, dtstart, lead_days, source, source_url, confidence)
SELECT 'state', 'NE', 'property_tax', 'Property tax — second half, last day before interest', 'Douglas, Lancaster and Sarpy counties are a month earlier.', 'FREQ=YEARLY;BYMONTH=8;BYMONTHDAY=31', '2026-08-31'::date, 14, 'Neb. Rev. Stat. 77-204', 'https://nebraskalegislature.gov/laws/statutes.php?statute=77-204', 'official'
WHERE NOT EXISTS (SELECT 1 FROM public."AddressCalendarRule" WHERE scope_type = 'state' AND scope_key = 'NE' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=8;BYMONTHDAY=31' AND dtstart = '2026-08-31'::date);

INSERT INTO public."AddressCalendarRule" (scope_type, scope_key, kind, title, detail, rrule, dtstart, lead_days, source, source_url, confidence)
SELECT 'county', 'NE:31055', 'property_tax', 'Property tax — first half, last day before interest', NULL, 'FREQ=YEARLY;BYMONTH=3;BYMONTHDAY=31', '2026-03-31'::date, 14, 'Nebraska Department of Revenue (Neb. Rev. Stat. 77-204)', 'https://revenue.nebraska.gov/sites/default/files/doc/pad/calendar/Assessor_Calendar_April_2026.pdf', 'official'
WHERE NOT EXISTS (SELECT 1 FROM public."AddressCalendarRule" WHERE scope_type = 'county' AND scope_key = 'NE:31055' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=3;BYMONTHDAY=31' AND dtstart = '2026-03-31'::date);

INSERT INTO public."AddressCalendarRule" (scope_type, scope_key, kind, title, detail, rrule, dtstart, lead_days, source, source_url, confidence)
SELECT 'county', 'NE:31055', 'property_tax', 'Property tax — second half, last day before interest', NULL, 'FREQ=YEARLY;BYMONTH=7;BYMONTHDAY=31', '2026-07-31'::date, 14, 'Nebraska Department of Revenue (Neb. Rev. Stat. 77-204)', 'https://revenue.nebraska.gov/sites/default/files/doc/pad/calendar/Assessor_Calendar_April_2026.pdf', 'official'
WHERE NOT EXISTS (SELECT 1 FROM public."AddressCalendarRule" WHERE scope_type = 'county' AND scope_key = 'NE:31055' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=7;BYMONTHDAY=31' AND dtstart = '2026-07-31'::date);

INSERT INTO public."AddressCalendarRule" (scope_type, scope_key, kind, title, detail, rrule, dtstart, lead_days, source, source_url, confidence)
SELECT 'county', 'NE:31109', 'property_tax', 'Property tax — first half, last day before interest', NULL, 'FREQ=YEARLY;BYMONTH=3;BYMONTHDAY=31', '2026-03-31'::date, 14, 'Nebraska Department of Revenue (Neb. Rev. Stat. 77-204)', 'https://revenue.nebraska.gov/sites/default/files/doc/pad/calendar/Assessor_Calendar_April_2026.pdf', 'official'
WHERE NOT EXISTS (SELECT 1 FROM public."AddressCalendarRule" WHERE scope_type = 'county' AND scope_key = 'NE:31109' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=3;BYMONTHDAY=31' AND dtstart = '2026-03-31'::date);

INSERT INTO public."AddressCalendarRule" (scope_type, scope_key, kind, title, detail, rrule, dtstart, lead_days, source, source_url, confidence)
SELECT 'county', 'NE:31109', 'property_tax', 'Property tax — second half, last day before interest', NULL, 'FREQ=YEARLY;BYMONTH=7;BYMONTHDAY=31', '2026-07-31'::date, 14, 'Nebraska Department of Revenue (Neb. Rev. Stat. 77-204)', 'https://revenue.nebraska.gov/sites/default/files/doc/pad/calendar/Assessor_Calendar_April_2026.pdf', 'official'
WHERE NOT EXISTS (SELECT 1 FROM public."AddressCalendarRule" WHERE scope_type = 'county' AND scope_key = 'NE:31109' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=7;BYMONTHDAY=31' AND dtstart = '2026-07-31'::date);

INSERT INTO public."AddressCalendarRule" (scope_type, scope_key, kind, title, detail, rrule, dtstart, lead_days, source, source_url, confidence)
SELECT 'county', 'NE:31153', 'property_tax', 'Property tax — first half, last day before interest', NULL, 'FREQ=YEARLY;BYMONTH=3;BYMONTHDAY=31', '2026-03-31'::date, 14, 'Nebraska Department of Revenue (Neb. Rev. Stat. 77-204)', 'https://revenue.nebraska.gov/sites/default/files/doc/pad/calendar/Assessor_Calendar_April_2026.pdf', 'official'
WHERE NOT EXISTS (SELECT 1 FROM public."AddressCalendarRule" WHERE scope_type = 'county' AND scope_key = 'NE:31153' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=3;BYMONTHDAY=31' AND dtstart = '2026-03-31'::date);

INSERT INTO public."AddressCalendarRule" (scope_type, scope_key, kind, title, detail, rrule, dtstart, lead_days, source, source_url, confidence)
SELECT 'county', 'NE:31153', 'property_tax', 'Property tax — second half, last day before interest', NULL, 'FREQ=YEARLY;BYMONTH=7;BYMONTHDAY=31', '2026-07-31'::date, 14, 'Nebraska Department of Revenue (Neb. Rev. Stat. 77-204)', 'https://revenue.nebraska.gov/sites/default/files/doc/pad/calendar/Assessor_Calendar_April_2026.pdf', 'official'
WHERE NOT EXISTS (SELECT 1 FROM public."AddressCalendarRule" WHERE scope_type = 'county' AND scope_key = 'NE:31153' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=7;BYMONTHDAY=31' AND dtstart = '2026-07-31'::date);

INSERT INTO public."AddressCalendarRule" (scope_type, scope_key, kind, title, detail, rrule, dtstart, lead_days, source, source_url, confidence)
SELECT 'state', 'GA', 'property_tax', 'Property tax due (state default)', 'Many counties set an earlier date or two installments — check your bill.', 'FREQ=YEARLY;BYMONTH=12;BYMONTHDAY=20', '2026-12-20'::date, 14, 'Georgia Department of Revenue', 'https://dor.georgia.gov/property-tax-returns-and-payment', 'unverified'
WHERE NOT EXISTS (SELECT 1 FROM public."AddressCalendarRule" WHERE scope_type = 'state' AND scope_key = 'GA' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=12;BYMONTHDAY=20' AND dtstart = '2026-12-20'::date);

INSERT INTO public."AddressCalendarRule" (scope_type, scope_key, kind, title, detail, rrule, dtstart, lead_days, source, source_url, confidence)
SELECT 'county', 'GA:13067', 'property_tax', 'County property tax due', NULL, 'FREQ=YEARLY;BYMONTH=10;BYMONTHDAY=15', '2026-10-15'::date, 14, 'Cobb County Tax Commissioner', 'https://www.cobbtax.gov/property/index.php', 'official'
WHERE NOT EXISTS (SELECT 1 FROM public."AddressCalendarRule" WHERE scope_type = 'county' AND scope_key = 'GA:13067' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=10;BYMONTHDAY=15' AND dtstart = '2026-10-15'::date);

INSERT INTO public."AddressCalendarRule" (scope_type, scope_key, kind, title, detail, rrule, dtstart, lead_days, source, source_url, confidence)
SELECT 'county', 'GA:13089', 'property_tax', 'Property tax — first installment (or all) due', 'Moves to the next business day on a weekend.', 'FREQ=YEARLY;BYMONTH=9;BYMONTHDAY=30', '2026-09-30'::date, 14, 'DeKalb County Tax Commissioner', 'https://dekalbtaxga.gov/property-tax/tax-bill-information/', 'official'
WHERE NOT EXISTS (SELECT 1 FROM public."AddressCalendarRule" WHERE scope_type = 'county' AND scope_key = 'GA:13089' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=9;BYMONTHDAY=30' AND dtstart = '2026-09-30'::date);

INSERT INTO public."AddressCalendarRule" (scope_type, scope_key, kind, title, detail, rrule, dtstart, lead_days, source, source_url, confidence)
SELECT 'county', 'GA:13089', 'property_tax', 'Property tax — second installment due', 'Moves to the next business day on a weekend.', 'FREQ=YEARLY;BYMONTH=11;BYMONTHDAY=15', '2026-11-15'::date, 14, 'DeKalb County Tax Commissioner', 'https://dekalbtaxga.gov/property-tax/tax-bill-information/', 'official'
WHERE NOT EXISTS (SELECT 1 FROM public."AddressCalendarRule" WHERE scope_type = 'county' AND scope_key = 'GA:13089' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=11;BYMONTHDAY=15' AND dtstart = '2026-11-15'::date);

INSERT INTO public."AddressCalendarRule" (scope_type, scope_key, kind, title, detail, rrule, dtstart, lead_days, source, source_url, confidence)
SELECT 'county', 'GA:13135', 'property_tax', 'County property tax due', 'The 2026 bills.', 'FREQ=DAILY;COUNT=1', '2026-11-15'::date, 14, 'Gwinnett County Tax Commissioner', 'https://www.gwinnetttaxcommissioner.com/property-tax/billing-information/deadlines-and-due-dates', 'official'
WHERE NOT EXISTS (SELECT 1 FROM public."AddressCalendarRule" WHERE scope_type = 'county' AND scope_key = 'GA:13135' AND kind = 'property_tax' AND rrule = 'FREQ=DAILY;COUNT=1' AND dtstart = '2026-11-15'::date);

INSERT INTO public."AddressCalendarRule" (scope_type, scope_key, kind, title, detail, rrule, dtstart, lead_days, source, source_url, confidence)
SELECT 'county', 'OH:39049', 'property_tax', 'Property tax — first half due', NULL, 'FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=28', '2026-02-28'::date, 14, 'Franklin County Treasurer', 'https://treasurer.franklincountyohio.gov/About-Taxes/Property-Tax-Due-Date-FAQ', 'official'
WHERE NOT EXISTS (SELECT 1 FROM public."AddressCalendarRule" WHERE scope_type = 'county' AND scope_key = 'OH:39049' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=28' AND dtstart = '2026-02-28'::date);

INSERT INTO public."AddressCalendarRule" (scope_type, scope_key, kind, title, detail, rrule, dtstart, lead_days, source, source_url, confidence)
SELECT 'county', 'OH:39049', 'property_tax', 'Property tax — second half due', NULL, 'FREQ=YEARLY;BYMONTH=7;BYMONTHDAY=20', '2026-07-20'::date, 14, 'Franklin County Treasurer', 'https://treasurer.franklincountyohio.gov/About-Taxes/Property-Tax-Due-Date-FAQ', 'official'
WHERE NOT EXISTS (SELECT 1 FROM public."AddressCalendarRule" WHERE scope_type = 'county' AND scope_key = 'OH:39049' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=7;BYMONTHDAY=20' AND dtstart = '2026-07-20'::date);

INSERT INTO public."AddressCalendarRule" (scope_type, scope_key, kind, title, detail, rrule, dtstart, lead_days, source, source_url, confidence)
SELECT 'county', 'DE:10003', 'property_tax', 'County property tax due', 'Moved to Dec 31 for 2026 by state law.', 'FREQ=DAILY;COUNT=1', '2026-12-31'::date, 14, 'New Castle County', 'https://www.newcastlede.gov/232/Tax-Information-Forms', 'official'
WHERE NOT EXISTS (SELECT 1 FROM public."AddressCalendarRule" WHERE scope_type = 'county' AND scope_key = 'DE:10003' AND kind = 'property_tax' AND rrule = 'FREQ=DAILY;COUNT=1' AND dtstart = '2026-12-31'::date);

INSERT INTO public."AddressCalendarRule" (scope_type, scope_key, kind, title, detail, rrule, dtstart, lead_days, source, source_url, confidence)
SELECT 'county', 'DE:10003', 'property_tax', 'County property tax due', 'New Castle County expects to return to Sep 30 from 2027.', 'FREQ=YEARLY;BYMONTH=9;BYMONTHDAY=30', '2027-09-30'::date, 14, 'New Castle County', 'https://www.newcastlede.gov/232/Tax-Information-Forms', 'unverified'
WHERE NOT EXISTS (SELECT 1 FROM public."AddressCalendarRule" WHERE scope_type = 'county' AND scope_key = 'DE:10003' AND kind = 'property_tax' AND rrule = 'FREQ=YEARLY;BYMONTH=9;BYMONTHDAY=30' AND dtstart = '2027-09-30'::date);


COMMIT;
