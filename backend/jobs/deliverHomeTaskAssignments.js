const { deliverPending } = require('../services/homeTaskAssignmentDeliveryService');
const logger = require('../utils/logger');

module.exports = async function deliverHomeTaskAssignments() {
  const result = await deliverPending(25);
  if (result.selected) logger.info('Home task assignment delivery checked', result);
  return result;
};
