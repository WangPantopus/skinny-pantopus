const supabaseAdmin = require('../config/supabaseAdmin');

const ACTIVE_RESERVATION_STATUSES = ['reserved', 'delivered', 'confirmed'];
const AVAILABILITY_SLOT_STATUSES = ['open', 'full'];
const DEFAULT_SLOT_COLUMNS =
  'id, support_train_id, slot_date, slot_label, support_mode, start_time, end_time, status, filled_count, capacity';

function normalizeCapacity(slot) {
  const capacity = Number(slot?.capacity ?? 1);
  return Number.isFinite(capacity) && capacity > 0 ? capacity : 1;
}

function buildActiveReservationCountBySlotId(reservations = []) {
  const counts = new Map();
  for (const reservation of reservations || []) {
    if (!reservation?.slot_id) continue;
    if (!ACTIVE_RESERVATION_STATUSES.includes(reservation.status)) continue;
    counts.set(reservation.slot_id, (counts.get(reservation.slot_id) || 0) + 1);
  }
  return counts;
}

function normalizeSlotsWithReservationCounts(slots = [], reservations = []) {
  const counts = buildActiveReservationCountBySlotId(reservations);
  return (slots || []).map((slot) => {
    const activeCount = counts.get(slot.id) || 0;
    const capacity = normalizeCapacity(slot);
    let status = slot.status;

    if (status === 'open' && activeCount >= capacity) {
      status = 'full';
    } else if (status === 'full' && activeCount < capacity) {
      status = 'open';
    }

    return {
      ...slot,
      status,
      filled_count: activeCount,
    };
  });
}

function filterEffectivelyOpenSlots(slots = [], reservations = []) {
  return normalizeSlotsWithReservationCounts(slots, reservations).filter((slot) => {
    if (slot.status !== 'open') return false;
    return (slot.filled_count || 0) < normalizeCapacity(slot);
  });
}

async function getActiveReservationsForSlots(slotIds) {
  const ids = [...new Set((slotIds || []).filter(Boolean))];
  if (ids.length === 0) return [];

  const { data, error } = await supabaseAdmin
    .from('SupportTrainReservation')
    .select('id, slot_id, status')
    .in('slot_id', ids)
    .in('status', ACTIVE_RESERVATION_STATUSES);

  if (error) throw error;
  return data || [];
}

async function countActiveReservationsForSlot(slotId) {
  if (!slotId) return 0;

  const { count, error } = await supabaseAdmin
    .from('SupportTrainReservation')
    .select('id', { count: 'exact', head: true })
    .eq('slot_id', slotId)
    .in('status', ACTIVE_RESERVATION_STATUSES);

  if (error) throw error;
  return count || 0;
}

async function normalizeSlotsWithActiveReservations(slots = []) {
  const reservations = await getActiveReservationsForSlots((slots || []).map((slot) => slot.id));
  return normalizeSlotsWithReservationCounts(slots, reservations);
}

async function listEffectivelyOpenSlots({
  supportTrainId,
  fromDate,
  toDate,
  columns = DEFAULT_SLOT_COLUMNS,
} = {}) {
  let query = supabaseAdmin
    .from('SupportTrainSlot')
    .select(columns)
    .in('status', AVAILABILITY_SLOT_STATUSES);

  if (supportTrainId) query = query.eq('support_train_id', supportTrainId);
  if (fromDate) query = query.gte('slot_date', fromDate);
  if (toDate) query = query.lte('slot_date', toDate);

  query = query.order('slot_date', { ascending: true }).order('sort_order', { ascending: true });

  const { data: slots, error } = await query;
  if (error) throw error;

  const reservations = await getActiveReservationsForSlots((slots || []).map((slot) => slot.id));
  return filterEffectivelyOpenSlots(slots || [], reservations);
}

module.exports = {
  ACTIVE_RESERVATION_STATUSES,
  buildActiveReservationCountBySlotId,
  countActiveReservationsForSlot,
  filterEffectivelyOpenSlots,
  listEffectivelyOpenSlots,
  normalizeSlotsWithActiveReservations,
  normalizeSlotsWithReservationCounts,
};
