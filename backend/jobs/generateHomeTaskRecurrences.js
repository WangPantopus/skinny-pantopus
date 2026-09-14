const { generateDue } = require('../services/homeTaskRecurrenceService');
const logger = require('../utils/logger');

module.exports = async function generateHomeTaskRecurrences() {
  const result = await generateDue(25);
  if (result.failed) logger.warn('Home task recurrence needs retry', result);
  else if (result.selected) logger.info('Home task recurrence checked', result);
  return result;
};
