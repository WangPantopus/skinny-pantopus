'use strict';
// Reading a county's cell into a fact: empty, zero and "not recorded" say nothing.

const number = (text) => {
  const value = Number(text);
  return text !== '' && text != null && Number.isFinite(value) ? value : null;
};
const positive = (text) => {
  const value = number(text);
  return value !== null && value > 0 ? value : null;
};
function put(facts, name, value) {
  if (value === null || value === undefined || value === '') return;
  facts[name] = value;
}
function word(text) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  return !value || /^(NONE|NULL|UNKNOWN|UNASSIGNED|N\/A)$/i.test(value) ? null : value;
}

module.exports = { number, positive, put, word };
