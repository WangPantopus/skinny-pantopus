'use strict';

/**
 * Each county's own public property page, by county FIPS code, for the link in Add
 * Home and Property details (services/countyPages.js). A person opens it and comes back
 * to confirm with a tap; Pantopus never reads these pages (many of their terms forbid
 * that, docs/research/provider-replacement/public-records-requests.md). `parcel` is the
 * county's own address for one parcel, where it has one. Listed so far: the counties
 * with no public file to read, where this link helps most, and the first live counties.
 */
module.exports = {
  '01073': { name: 'Jefferson County', url: 'https://eringcapture.jccal.org/' },
  '04019': { name: 'Pima County', url: 'https://www.asr.pima.gov/ParcelSearch' },
  '06001': { name: 'Alameda County', url: 'https://www.acassessor.org/homeowners/assessed-value-look-up/' },
  '06019': { name: 'Fresno County', url: 'https://www.fresnocountyca.gov/Departments/Assessor/Value' },
  '06029': { name: 'Kern County', url: 'https://www.kerncounty.com/government/departments/assessor-recorder/property/assessor-property-search' },
  '06059': { name: 'Orange County', url: 'https://assessedvalue.ocassessor.gov/' },
  '06067': { name: 'Sacramento County', url: 'https://assessor.saccounty.gov/content/assessor/us/en/maps-property-data-and-records/assessor-parcel-viewer.html' },
  '06071': { name: 'San Bernardino County', url: 'https://arc.sbcounty.gov/property-information/' },
  '06081': { name: 'San Mateo County', url: 'https://smcacre.gov/assessor/property-tax-look' },
  '06085': { name: 'Santa Clara County', url: 'https://www.sccassessor.org/' },
  '06099': { name: 'Stanislaus County', url: 'https://www.stancounty.com/assessor/' },
  '06111': { name: 'Ventura County', url: 'https://assessor.venturacounty.gov/assessor-data/property-search/' },
  '13067': { name: 'Cobb County', url: 'https://gis.cobbcounty.org/PropertySearch.html' },
  '13121': { name: 'Fulton County', url: 'https://iaspublicaccess.fultoncountyga.gov/' },
  '13135': { name: 'Gwinnett County', url: 'https://gwinnettassessor.manatron.com/IWantTo/PropertyGISSearch.aspx' },
  '15003': { name: 'the City and County of Honolulu', url: 'https://realproperty.honolulu.gov/' },
  '16001': { name: 'Ada County', url: 'https://adacounty.id.gov/assessor/property-assessments-records/assessors-property-records/' },
  '17031': { name: 'Cook County', url: 'https://assessorpropertydetails.cookcountyil.gov/search/commonsearch.aspx?mode=parid' },
  '17043': { name: 'DuPage County', url: 'https://propertylookup.dupagecounty.gov/' },
  '17089': { name: 'Kane County', url: 'https://assessments.kanecountyil.gov/' },
  '17197': { name: 'Will County', url: 'https://www.willcountysoa.com/PropertySearchPortal' },
  '20091': { name: 'Johnson County', url: 'https://www.jocogov.org/item/service-listing/search-property-values' },
  '20173': { name: 'Sedgwick County', url: 'https://www.sedgwickcounty.org/appraiser/' },
  '21111': { name: 'Jefferson County', url: 'https://jeffersonpva.ky.gov/property-search/' },
  '25025': { name: 'the City of Boston', url: 'https://www.boston.gov/departments/assessing' },
  '26081': { name: 'Kent County', url: 'https://app.kentcountymi.gov/PropertySearch/appStart' },
  '26099': { name: 'Macomb County', url: 'https://www.macombgov.org/departments/planning-and-economic-development/mapping-and-data-services' },
  '26163': { name: 'Wayne County', url: 'https://www.waynecountymi.gov/Government/Departments/Management-Budget/Assessment-Equalization/Assessment-Data' },
  '29189': { name: 'St. Louis County', url: 'https://assessor.stlouiscountymo.gov/realestate/searchinput.aspx' },
  '32003': { name: 'Clark County', url: 'https://maps.clarkcountynv.gov/assessor/AssessorParcelDetail/site.aspx' },
  '36059': { name: 'Nassau County', url: 'https://lrv.nassaucountyny.gov/' },
  '36103': { name: 'Suffolk County', url: 'https://www.suffolkcountyny.gov/Departments/Real-Property-Tax-Service-Agency' },
  '42017': { name: 'Bucks County', url: 'https://www.buckscounty.gov/RealEstate.aspx' },
  '42045': { name: 'Delaware County', url: 'https://www.delcopa.gov/treasurer/propertyassessment' },
  '42071': { name: 'Lancaster County', url: 'https://co.lancaster.pa.us/154/Property-Assessment' },
  '45045': { name: 'Greenville County', url: 'https://www.greenvillecounty.org/appsas400/RealProperty/' },
  '47093': { name: 'Knox County', url: 'https://www.kgis.org/kgismaps/' },
  '47157': { name: 'Shelby County', url: 'https://www.assessor.shelbycountytn.gov/propertySearch' },
  '48113': { name: 'Dallas Central Appraisal District', url: 'https://www.dallascad.org/SearchAddr.aspx', parcel: 'https://www.dallascad.org/AcctDetailRes.aspx?ID={parcel}' },
  '53011': { name: 'Clark County', url: 'https://gis.clark.wa.gov/gishome/property/' },
  '53063': { name: 'Spokane County', url: 'https://www.spokanecounty.gov/1879/Online-Services' },
  '55025': { name: 'Dane County', url: 'https://accessdane.danecounty.gov/Parcel' },
};
