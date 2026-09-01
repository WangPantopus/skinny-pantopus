/**
 * Address Validation Module
 *
 * Barrel export for the address validation pipeline.
 *
 * Usage:
 *   const { addressValidationService, addressDecisionEngine, canonicalAddressService, mailVerificationService, mailVendorService, lobMailProvider, mockMailProvider, googleProvider, smartyProvider, AddressVerdictStatus } =
 *     require('../services/addressValidation');
 */

const addressValidationService = require('./addressValidationService');
const addressDecisionEngine = require('./addressDecisionEngine');
const canonicalAddressService = require('./canonicalAddressService');
const mailVerificationService = require('./mailVerificationService');
const mailVendorService = require('./mailVendorService');
const lobMailProvider = require('./lobMailProvider');
const mockMailProvider = require('./mockMailProvider');
const landlordAuthorityService = require('./landlordAuthorityService');
const googleProvider = require('./googleProvider');
const smartyProvider = require('./smartyProvider');
const placeClassificationProvider = require('./placeClassificationProvider');
const secondaryAddressProvider = require('./secondaryAddressProvider');
const parcelIntelProvider = require('./parcelIntelProvider');
const pipelineService = require('./pipelineService');
const { AddressVerdictStatus } = require('./types');

module.exports = {
  addressValidationService,
  addressDecisionEngine,
  canonicalAddressService,
  mailVerificationService,
  mailVendorService,
  lobMailProvider,
  mockMailProvider,
  landlordAuthorityService,
  googleProvider,
  smartyProvider,
  placeClassificationProvider,
  secondaryAddressProvider,
  parcelIntelProvider,
  pipelineService,
  AddressVerdictStatus,
};
