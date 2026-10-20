// What a HomeAsset row may hold, checked the same way wherever one is made: by
// POST /api/homes/:id/assets, and by the assistant's home_asset card before it offers one.
// The categories are the table's check constraint; the price fits numeric(12,2); dates are
// days (YYYY-MM-DD) a receipt or a warranty could carry.
const Joi = require('joi');

const HOME_ASSET_CATEGORIES = ['appliance', 'electronics', 'furniture', 'tool', 'valuable', 'consumable', 'fixture', 'other'];
const assetDay = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).custom((value, helpers) => {
  const day = new Date(`${value}T12:00:00.000Z`);
  const year = Number(value.slice(0, 4));
  if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== value || year < 1900 || year > 2100) {
    return helpers.error('date.base');
  }
  return value;
}).allow(null, '');
const assetText = (max) => Joi.string().trim().max(max).allow(null, '');
const createHomeAssetSchema = Joi.object({
  category: Joi.string().valid(...HOME_ASSET_CATEGORIES).required(),
  name: Joi.string().trim().min(1).max(120).required(),
  room: assetText(80),
  brand: assetText(80),
  model: assetText(80),
  serial_number: assetText(80),
  purchase_date: assetDay,
  purchase_price: Joi.number().min(0).max(9999999999.99).precision(2).allow(null),
  warranty_expires_at: assetDay,
  notes: assetText(2000),
  details: Joi.object().unknown(true).custom((value, helpers) => (
    JSON.stringify(value).length > 8000 ? helpers.error('any.invalid') : value
  )).allow(null),
});

module.exports = { HOME_ASSET_CATEGORIES, createHomeAssetSchema };
