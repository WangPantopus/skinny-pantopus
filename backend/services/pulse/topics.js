// The twelve Pulse topics and their names (docs/product/pulse-build/02-contract.md §1). `sports` is
// the Sports lane's existing id. Nobody creates topics: choosing one filters, and muting one hides
// it, everywhere or in one area.
const PULSE_TOPIC_NAMES = Object.freeze({
  around_here: 'Around here',
  outdoors: 'Outdoors',
  gardening: 'Gardening',
  home_repairs: 'Home and repairs',
  food: 'Food',
  kids_schools: 'Kids and schools',
  pets: 'Pets',
  arts_culture: 'Arts and culture',
  sports: 'Sports and fitness',
  getting_around: 'Getting around',
  local_government: 'Local government',
  volunteering: 'Volunteering',
});

const PULSE_TOPICS = Object.freeze(Object.keys(PULSE_TOPIC_NAMES));

const isPulseTopic = (value) => typeof value === 'string' && Object.hasOwn(PULSE_TOPIC_NAMES, value);

module.exports = { PULSE_TOPICS, PULSE_TOPIC_NAMES, isPulseTopic };
