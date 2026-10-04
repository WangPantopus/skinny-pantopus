jest.mock('../../services/emailService', () => ({
  sendGuestReservationReminderEmail: jest.fn(),
}));

const supabase = require('../../config/supabaseAdmin');
const { sendGuestReservationReminderEmail } = require('../../services/emailService');
const { createNotification } = require('../../services/notificationService');
const { runSupportTrainReminders } = require('../../jobs/supportTrainReminders');

const {
  filterEffectivelyOpenSlots,
  normalizeSlotsWithReservationCounts,
} = require('../../services/supportTrainSlotAvailability');

describe('supportTrainSlotAvailability', () => {
  it('counts only active reservations against slot capacity', () => {
    const slots = [
      { id: 'slot-1', status: 'open', filled_count: 0, capacity: 1 },
      { id: 'slot-2', status: 'open', filled_count: 0, capacity: 1 },
    ];
    expect(filterEffectivelyOpenSlots(slots, [
      { id: 'reservation-1', slot_id: 'slot-1', status: 'reserved' },
      { id: 'reservation-2', slot_id: 'slot-2', status: 'canceled' },
    ]).map(slot => slot.id)).toEqual(['slot-2']);
  });

  describe('train-local reminder delivery', () => {
    function seed({ date = '2026-10-04', start = '18:00', end = '19:00',
      account = false, coords = {}, status = 'reserved', slotStatus = 'full',
      trainStatus = 'active', eveningMarker = null, dayMarker = null,
      shared = null, noEmail = false, homeId = null } = {}) {
      supabase.seedTable('SupportTrain', [{
        id: 'train', status: trainStatus, Activity: { title: 'Meal train' },
        recipient_home_id: homeId, delivery_address: '123 Shared St',
        delivery_city: 'Camas', delivery_state: 'WA', delivery_zip: '98607',
        ...coords,
      }]);
      supabase.seedTable('SupportTrainReservation', [{
        id: 'reservation', support_train_id: 'train', slot_id: 'slot',
        user_id: account ? 'helper' : null, guest_name: 'Email helper',
        guest_email: noEmail ? null : 'guest@example.com', contribution_mode: 'cook',
        dish_title: 'Lasagna', restaurant_name: null, status,
        private_note_to_organizer: 'private note sentinel',
        guest_address_shared_at: shared,
        last_reminder_sent: eveningMarker, day_of_reminder_sent_at: dayMarker,
        SupportTrain: coords,
        SupportTrainSlot: { id: 'slot', slot_date: date, slot_label: 'Dinner',
          start_time: start, end_time: end, status: slotStatus },
      }]);
      return supabase.getTable('SupportTrainReservation')[0];
    }

    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(new Date('2026-10-04T14:00:00Z'));
      supabase.resetTables();
      sendGuestReservationReminderEmail.mockReset().mockResolvedValue({ success: true });
      createNotification.mockReset().mockResolvedValue({ id: 'notification' });
    });
    afterEach(() => { jest.useRealTimers(); supabase.resetTables(); });

    const boundaries = [
      ['evening before 17:00', '2026-10-04T23:59:00Z', { date: '2026-10-05' }, null],
      ['evening at 17:00 across UTC midnight', '2026-10-05T00:00:00Z', { date: '2026-10-05' }, 'tomorrow'],
      ['evening at 23:59', '2026-10-05T06:59:00Z', { date: '2026-10-05' }, 'tomorrow'],
      ['morning before 07:00', '2026-10-04T13:59:00Z', {}, null],
      ['morning at 07:00', '2026-10-04T14:00:00Z', {}, 'today'],
      ['early slot before four-hour threshold', '2026-10-04T11:59:00Z', { start: '09:00' }, null],
      ['early slot at four-hour threshold', '2026-10-04T12:00:00Z', { start: '09:00' }, 'today'],
      ['no start before morning', '2026-10-04T13:59:00Z', { start: null }, null],
      ['no start at morning', '2026-10-04T14:00:00Z', { start: null }, 'today'],
      ['no time window at morning', '2026-10-04T14:00:00Z', { start: null, end: null }, 'today'],
      ['early midnight slot on its day', '2026-10-04T07:09:00Z', { start: '02:00' }, 'today'],
      ['early midnight slot on previous evening', '2026-10-04T03:00:00Z', { start: '02:00' }, 'tomorrow'],
      ['past start is not reminded', '2026-10-04T14:00:00Z', { start: '06:00' }, null],
      ['late today after UTC rollover', '2026-10-05T05:00:00Z', { start: '23:00' }, 'today'],
      ['Eastern evening', '2026-10-04T21:00:00Z', { date: '2026-10-05', coords: { delivery_lat: 40.7, delivery_lng: -74 } }, 'tomorrow'],
      ['Eastern morning', '2026-10-04T11:00:00Z', { coords: { delivery_lat: 40.7, delivery_lng: -74 } }, 'today'],
      ['Arizona winter morning', '2026-11-02T14:00:00Z', { date: '2026-11-02', coords: { delivery_lat: 33.4, delivery_lng: -112 } }, 'today'],
      ['spring DST evening', '2027-03-14T01:00:00Z', { date: '2027-03-14' }, 'tomorrow'],
      ['spring DST morning', '2027-03-14T14:00:00Z', { date: '2027-03-14' }, 'today'],
      ['fall DST before morning', '2026-11-01T14:59:00Z', { date: '2026-11-01' }, null],
      ['fall DST morning', '2026-11-01T15:00:00Z', { date: '2026-11-01' }, 'today'],
    ];
    for (const account of [false, true]) {
      it.each(boundaries)(`${account ? 'account' : 'guest'} local boundary: %s`, async (_name, clock, scenario, day) => {
        jest.setSystemTime(new Date(clock));
        seed({ ...scenario, account });
        await runSupportTrainReminders();
        await runSupportTrainReminders();
        expect(sendGuestReservationReminderEmail).toHaveBeenCalledTimes(!account && day ? 1 : 0);
        expect(createNotification).toHaveBeenCalledTimes(account && day ? 1 : 0);
        const row = supabase.getTable('SupportTrainReservation')[0];
        expect(Boolean(row.last_reminder_sent)).toBe(day === 'tomorrow');
        expect(Boolean(row.day_of_reminder_sent_at)).toBe(day === 'today');
        if (day && !account) {
          expect(sendGuestReservationReminderEmail).toHaveBeenCalledWith(expect.objectContaining({
            toEmail: 'guest@example.com', trainTitle: 'Meal train', reminderDay: day,
            contributionMode: 'cook', dishTitle: 'Lasagna', supportTrainId: 'train',
          }));
          expect(JSON.stringify(sendGuestReservationReminderEmail.mock.calls)).not.toMatch(/123 Shared|private note sentinel|private_note_to_organizer/);
        }
      });

      it(`${account ? 'account' : 'guest'} gets independent evening and morning deliveries`, async () => {
        jest.setSystemTime(new Date('2026-10-04T00:00:00Z')); // Oct 3, 17:00 Pacific
        seed({ account });
        await runSupportTrainReminders();
        await runSupportTrainReminders();
        const evening = supabase.getTable('SupportTrainReservation')[0].last_reminder_sent;
        expect(evening).not.toBeNull();
        expect(supabase.getTable('SupportTrainReservation')[0].day_of_reminder_sent_at).toBeNull();
        jest.setSystemTime(new Date('2026-10-04T14:00:00Z'));
        await runSupportTrainReminders();
        await runSupportTrainReminders();
        const row = supabase.getTable('SupportTrainReservation')[0];
        expect(row.last_reminder_sent).toBe(evening);
        expect(row.day_of_reminder_sent_at).not.toBeNull();
        expect(account ? createNotification : sendGuestReservationReminderEmail).toHaveBeenCalledTimes(2);
      });
    }

    it.each([
      { status: 'canceled' }, { status: 'delivered' }, { status: 'confirmed' },
      { slotStatus: 'canceled' }, { slotStatus: 'completed' },
      { trainStatus: 'paused' }, { trainStatus: 'completed' }, { noEmail: true },
      { dayMarker: '2026-10-04T14:00:00Z' },
    ])('does not deliver for ineligible state %j', async scenario => {
      seed(scenario);
      await runSupportTrainReminders();
      expect(sendGuestReservationReminderEmail).not.toHaveBeenCalled();
      expect(createNotification).not.toHaveBeenCalled();
    });

    it.each(['tomorrow', 'today'])('failed, rejected and preview %s emails remain retryable', async day => {
      for (const delivery of [{ success: false }, { success: false, error: 'EMAIL_REJECTED' }, { success: true, preview: true }]) {
        supabase.resetTables();
        jest.setSystemTime(new Date(day === 'tomorrow' ? '2026-10-04T00:00:00Z' : '2026-10-04T14:00:00Z'));
        seed();
        sendGuestReservationReminderEmail.mockReset().mockResolvedValueOnce(delivery).mockResolvedValue({ success: true });
        const marker = day === 'tomorrow' ? 'last_reminder_sent' : 'day_of_reminder_sent_at';
        await runSupportTrainReminders();
        expect(supabase.getTable('SupportTrainReservation')[0][marker]).toBeNull();
        await runSupportTrainReminders();
        expect(supabase.getTable('SupportTrainReservation')[0][marker]).not.toBeNull();
        await runSupportTrainReminders();
        expect(sendGuestReservationReminderEmail).toHaveBeenCalledTimes(2);
      }
    });

    it('a failed account notification remains retryable', async () => {
      seed({ account: true, eveningMarker: '2026-10-04T00:00:00Z' });
      createNotification.mockResolvedValueOnce(null);
      await runSupportTrainReminders();
      expect(supabase.getTable('SupportTrainReservation')[0].day_of_reminder_sent_at).toBeNull();
      await runSupportTrainReminders();
      await runSupportTrainReminders();
      expect(createNotification).toHaveBeenCalledTimes(2);
      expect(createNotification).toHaveBeenLastCalledWith(expect.objectContaining({
        userId: 'helper', type: 'support_train_reminders', link: '/app/support-trains/train',
      }));
    });

    it('does not repeat during the fall DST repeated hour', async () => {
      seed({ date: '2026-11-01', start: '03:30' });
      jest.setSystemTime(new Date('2026-11-01T08:30:00Z'));
      await runSupportTrainReminders();
      jest.setSystemTime(new Date('2026-11-01T09:30:00Z'));
      await runSupportTrainReminders();
      expect(sendGuestReservationReminderEmail).toHaveBeenCalledTimes(1);
    });

    it.each([false, true])('includes only an already shared drop-off address (Home=%s)', async fromHome => {
      seed({ shared: '2026-10-03T20:00:00Z', homeId: fromHome ? 'home' : null });
      if (fromHome) supabase.seedTable('Home', [{ id: 'home', address: '456 Home St', address2: 'Unit 2', city: 'Camas', state: 'WA', zipcode: '98607' }]);
      await runSupportTrainReminders();
      expect(sendGuestReservationReminderEmail).toHaveBeenCalledWith(expect.objectContaining({
        guestAddressSharedAt: '2026-10-03T20:00:00Z',
        addressLabel: fromHome ? '456 Home St Unit 2\nCamas, WA, 98607' : '123 Shared St\nCamas, WA, 98607',
        slotTime: '18:00 - 19:00',
      }));
    });

    it('retains a retry when shared address lookup fails', async () => {
      seed({ shared: '2026-10-03T20:00:00Z', homeId: 'missing-home' });
      await runSupportTrainReminders();
      expect(sendGuestReservationReminderEmail).not.toHaveBeenCalled();
      expect(supabase.getTable('SupportTrainReservation')[0].day_of_reminder_sent_at).toBeNull();
    });

    it.each([
      ['cancellation', { status: 'canceled' }],
      ['helper email change', { guest_email: 'changed@example.com' }],
      ['share receipt removal', { guest_address_shared_at: null }],
      ['share receipt change', { guest_address_shared_at: '2026-10-04T13:00:00Z' }],
      ['account helper', { user_id: 'account-helper' }],
      ['train mismatch', { support_train_id: 'other-train' }],
      ['slot mismatch', { slot_id: 'other-slot' }],
      ['slot cancellation', { SupportTrainSlot: { id: 'slot', status: 'canceled' } }],
      ['reservation missing', null],
      ['train paused during address lookup', { pauseTrain: true }],
    ])('refuses stale shared address after %s following the job query', async (_name, mutation) => {
      const original = seed({ shared: '2026-10-03T20:00:00Z' });
      const from = supabase.from;
      let trainReads = 0;
      const spy = jest.spyOn(supabase, 'from').mockImplementation(table => {
        if (table === 'SupportTrain') {
          trainReads++;
          if (trainReads === 1 && !mutation?.pauseTrain) {
            // Replacement leaves the scheduler's original snapshot untouched.
            supabase.seedTable('SupportTrainReservation', mutation ? [{ ...original, ...mutation }] : []);
          }
          if (trainReads === 2 && mutation?.pauseTrain) {
            const train = supabase.getTable('SupportTrain')[0];
            supabase.seedTable('SupportTrain', [{ ...train, status: 'paused' }]);
          }
        }
        return from(table);
      });
      try {
        await runSupportTrainReminders();
        expect(sendGuestReservationReminderEmail).not.toHaveBeenCalled();
        expect(createNotification).not.toHaveBeenCalled();
        expect(spy.mock.calls.some(([table]) => table === 'Home')).toBe(false);
        expect(trainReads).toBe(mutation?.pauseTrain ? 2 : 1);
        const stored = supabase.getTable('SupportTrainReservation')[0];
        if (stored) expect(stored.day_of_reminder_sent_at).toBeNull();
      } finally {
        spy.mockRestore();
      }
    });
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
