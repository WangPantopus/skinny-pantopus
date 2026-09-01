jest.mock('../../config/supabaseAdmin', () => ({}));

const {
  filterEffectivelyOpenSlots,
  normalizeSlotsWithReservationCounts,
} = require('../../services/supportTrainSlotAvailability');

describe('supportTrainSlotAvailability', () => {
  it('does not count an open slot as available when active reservations fill capacity', () => {
    const slots = [
      { id: 'slot-1', status: 'open', filled_count: 0, capacity: 1 },
      { id: 'slot-2', status: 'open', filled_count: 0, capacity: 1 },
    ];
    const reservations = [
      { id: 'reservation-1', slot_id: 'slot-1', status: 'reserved' },
      { id: 'reservation-2', slot_id: 'slot-2', status: 'canceled' },
    ];

    expect(filterEffectivelyOpenSlots(slots, reservations).map((slot) => slot.id)).toEqual([
      'slot-2',
    ]);
  });

  it('counts stale full slots as available when active reservations are below capacity', () => {
    const slots = [{ id: 'slot-1', status: 'full', filled_count: 1, capacity: 2 }];
    const reservations = [{ id: 'reservation-1', slot_id: 'slot-1', status: 'reserved' }];

    expect(filterEffectivelyOpenSlots(slots, reservations)).toEqual([
      { id: 'slot-1', status: 'open', filled_count: 1, capacity: 2 },
    ]);
  });

  it('normalizes stale full/open slot rows from active reservation counts', () => {
    const slots = [
      { id: 'stale-open', status: 'open', filled_count: 0, capacity: 1 },
      { id: 'stale-full', status: 'full', filled_count: 1, capacity: 2 },
      { id: 'completed', status: 'completed', filled_count: 1, capacity: 1 },
    ];
    const reservations = [
      { id: 'reservation-1', slot_id: 'stale-open', status: 'delivered' },
      { id: 'reservation-2', slot_id: 'stale-full', status: 'reserved' },
      { id: 'reservation-3', slot_id: 'completed', status: 'confirmed' },
    ];

    expect(normalizeSlotsWithReservationCounts(slots, reservations)).toEqual([
      { id: 'stale-open', status: 'full', filled_count: 1, capacity: 1 },
      { id: 'stale-full', status: 'open', filled_count: 1, capacity: 2 },
      { id: 'completed', status: 'completed', filled_count: 1, capacity: 1 },
    ]);
  });
});
