const institutionalPlace = {
  id: 'school-123',
  displayName: { text: 'Roosevelt High School' },
  businessStatus: 'OPERATIONAL',
  primaryType: 'school',
  types: ['school', 'point_of_interest', 'establishment'],
};

const venuePlace = {
  id: 'venue-123',
  displayName: { text: 'Moda Center' },
  businessStatus: 'OPERATIONAL',
  primaryType: 'stadium',
  types: ['stadium', 'point_of_interest', 'establishment'],
};

const churchPlace = {
  id: 'church-123',
  displayName: { text: 'St. Mark Church' },
  businessStatus: 'OPERATIONAL',
  primaryType: 'church',
  types: ['church', 'point_of_interest', 'establishment'],
};

const hospitalPlace = {
  id: 'hospital-123',
  displayName: { text: 'Providence Medical Center' },
  businessStatus: 'OPERATIONAL',
  primaryType: 'hospital',
  types: ['hospital', 'medical_center', 'point_of_interest', 'establishment'],
};

const governmentPlace = {
  id: 'government-123',
  displayName: { text: 'Portland City Hall' },
  businessStatus: 'OPERATIONAL',
  primaryType: 'city_hall',
  types: ['city_hall', 'local_government_office', 'point_of_interest', 'establishment'],
};

const officePlace = {
  id: 'office-123',
  displayName: { text: 'Acme Corporate Headquarters' },
  businessStatus: 'OPERATIONAL',
  primaryType: 'corporate_office',
  types: ['corporate_office', 'point_of_interest', 'establishment'],
};

const storefrontPlace = {
  id: 'store-123',
  displayName: { text: 'Acme Market' },
  businessStatus: 'OPERATIONAL',
  primaryType: 'store',
  types: ['store', 'shopping_mall', 'point_of_interest', 'establishment'],
};

const warehousePlace = {
  id: 'warehouse-123',
  displayName: { text: 'Acme Distribution Center' },
  businessStatus: 'OPERATIONAL',
  primaryType: 'warehouse',
  types: ['warehouse', 'manufacturer', 'point_of_interest', 'establishment'],
};

const residentialPlace = {
  id: 'housing-123',
  displayName: { text: 'Laurelhurst Commons Apartments' },
  businessStatus: 'OPERATIONAL',
  primaryType: 'apartment_complex',
  types: ['apartment_complex', 'premise'],
};

module.exports = {
  institutionalPlace,
  venuePlace,
  churchPlace,
  hospitalPlace,
  governmentPlace,
  officePlace,
  storefrontPlace,
  warehousePlace,
  residentialPlace,
};
