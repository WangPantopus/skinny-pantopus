'use strict';
// ============================================================
// HOME PROFILE SERIALIZER — one projection of a home for a viewer.
//
// Two routes answer "what does someone else see of this home?":
//   GET /api/homes/:id/public-profile        (a real outsider asking)
//   GET /api/identity-center/view-as?surface=home   (the resident asking
//                                             to see themselves as an
//                                             outsider — the privacy mirror)
// They MUST agree, so both call this. `reveal` is the only switch:
// insiders (members, creator, claimants) see the exact address and the
// owner's full name; everyone else gets the street and a first name.
//
// HIDDEN_FROM_OUTSIDERS is the list the mirror prints. Keep it true: it
// is checked by tests against the projection itself.
// ============================================================

const { redactStreet, firstNameOnly } = require('../utils/addressRedaction');

const HIDDEN_FROM_OUTSIDERS = Object.freeze([
  { key: 'house_number', label: 'Your house number and unit' },
  { key: 'zipcode', label: 'Your zip code' },
  { key: 'surname', label: 'Your last name' },
  { key: 'household', label: 'Who else lives here' },
  { key: 'documents', label: 'Anything you uploaded to verify' },
  { key: 'move_in', label: 'When you moved in' },
]);

function serializeHomeForViewer(home, { reveal }) {
  if (!home) return null;
  return {
    id: home.id,
    name: home.name,
    address: reveal ? home.address : redactStreet(home.address),
    address_redacted: !reveal,
    city: home.city,
    state: home.state,
    zipcode: reveal ? home.zipcode : null,
    home_type: home.home_type,
    visibility: home.visibility,
    description: home.description || null,
    created_at: home.created_at,
  };
}

function fullName(user) {
  if (!user) return null;
  return user.name || [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || null;
}

function serializeOwnerForViewer(user, { reveal }) {
  if (!user) return null;
  const name = fullName(user);
  return {
    id: user.id,
    username: user.username,
    name: reveal ? name : firstNameOnly(name),
    profile_picture_url: user.profile_picture_url || null,
  };
}

module.exports = { serializeHomeForViewer, serializeOwnerForViewer, HIDDEN_FROM_OUTSIDERS, fullName };
