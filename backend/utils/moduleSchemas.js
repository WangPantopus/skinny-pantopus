const Joi = require('joi');

/**
 * Joi schemas for task module JSONB fields.
 *
 * All fields within each module are optional — modules are progressive
 * and users may fill some fields but not others. The schemas validate
 * types but don't require any specific field.
 */

const careDetailsSchema = Joi.object({
  careType: Joi.string().valid('child', 'pet', 'elder', 'other').optional(),
  agesOrDetails: Joi.string().allow('').max(500).optional(),
  count: Joi.number().integer().min(0).max(50).optional(),
  specialNeeds: Joi.string().allow('').max(2000).optional(),
  languagePreference: Joi.string().allow('').max(200).optional(),
  preferredHelperId: Joi.string().uuid().allow(null).optional(),
  emergencyNotes: Joi.string().allow('').max(2000).optional(),
}).allow(null).optional();

const logisticsDetailsSchema = Joi.object({
  workerCount: Joi.number().integer().min(1).max(10).optional(),
  vehicleNeeded: Joi.boolean().optional(),
  vehicleType: Joi.string().allow('').max(200).optional(),
  toolsNeeded: Joi.array().items(Joi.string().max(200)).max(20).optional(),
  accessInstructions: Joi.string().allow('').max(2000).optional(),
  petsOnProperty: Joi.boolean().optional(),
  stairsInfo: Joi.string().valid('none', 'few_steps', 'multiple_flights').allow('').optional(),
  heavyLifting: Joi.boolean().optional(),
}).allow(null).optional();

const remoteDetailsSchema = Joi.object({
  deliverableType: Joi.string().valid('document', 'design', 'code', 'video', 'other').allow('').optional(),
  fileFormat: Joi.string().allow('').max(200).optional(),
  revisionCount: Joi.number().integer().min(1).max(10).optional(),
  timezone: Joi.string().allow('').max(100).optional(),
  meetingRequired: Joi.boolean().optional(),
  dueDate: Joi.string().isoDate().allow(null).optional(),
}).allow(null).optional();

const urgentDetailsSchema = Joi.object({
  startsAsap: Joi.boolean().optional(),
  responseWindowMinutes: Joi.number().integer().min(5).max(120).optional(),
  arrivalNeededBy: Joi.string().isoDate().allow(null, '').optional(),
  shareLocationDuringTask: Joi.boolean().optional(),
  liveStatusEnabled: Joi.boolean().optional(),
  roadsideVehicleNotes: Joi.string().allow('').max(1000).optional(),
  pickupDropoffMode: Joi.string().allow('').max(200).optional(),
}).allow(null).optional();

const eventDetailsSchema = Joi.object({
  eventType: Joi.string().valid('party', 'wedding', 'corporate', 'community', 'other').allow('').optional(),
  guestCount: Joi.number().integer().min(0).max(10000).allow(null).optional(),
  shiftStart: Joi.string().isoDate().allow(null).optional(),
  shiftEnd: Joi.string().isoDate().allow(null).optional(),
  dressCode: Joi.string().allow('').max(500).optional(),
  roleType: Joi.string().valid('setup', 'serving', 'bartending', 'cleanup', 'general').allow('').optional(),
  venueDetails: Joi.string().allow('').max(2000).optional(),
}).allow(null).optional();

module.exports = {
  careDetailsSchema,
  logisticsDetailsSchema,
  remoteDetailsSchema,
  urgentDetailsSchema,
  eventDetailsSchema,
};
