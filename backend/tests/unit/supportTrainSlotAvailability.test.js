jest.mock('../../services/emailService', () => ({
  sendGuestReservationConfirmationEmail: jest.fn(),
}));

const supabase = require('../../config/supabaseAdmin');
const { sendGuestReservationConfirmationEmail } = require('../../services/emailService');
const { createNotification } = require('../../services/notificationService');
const { runSupportTrainReminders } = require('../../jobs/supportTrainReminders');

const {
  filterEffectivelyOpenSlots,
  normalizeSlotsWithReservationCounts,
} = require('../../services/supportTrainSlotAvailability');

describe('supportTrainSlotAvailability', () => {
  it('keeps active reservation capacity and reminder delivery consistent', async () => {
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

    jest.useFakeTimers().setSystemTime(new Date('2026-10-04T12:00:00Z'));
    try {
      const cases = [
        { name: 'guest tomorrow', date: '2026-10-05', email: true },
        { name: 'guest today', date: '2026-10-04', email: true },
        { name: 'account tomorrow', date: '2026-10-05', account: true },
        { name: 'account today', date: '2026-10-04', account: true },
        { name: 'canceled reservation', date: '2026-10-05', status: 'canceled' },
        { name: 'canceled slot', date: '2026-10-05', slotStatus: 'canceled' },
        { name: 'completed slot', date: '2026-10-04', slotStatus: 'completed' },
        { name: 'completed train', date: '2026-10-05', trainStatus: 'completed' },
        { name: 'paused train', date: '2026-10-05', trainStatus: 'paused' },
        { name: 'missing recipient', date: '2026-10-05', noEmail: true },
        { name: 'already reminded', date: '2026-10-05', reminded: true },
      ];
      for (const scenario of cases) {
        supabase.resetTables();
        sendGuestReservationConfirmationEmail.mockReset().mockResolvedValue({ success: true });
        createNotification.mockReset().mockResolvedValue({ id: 'notification' });
        supabase.seedTable('SupportTrain', [{
          id: 'train', status: scenario.trainStatus || 'active', Activity: { title: 'Meal train' },
        }]);
        supabase.seedTable('SupportTrainReservation', [{
          id: 'reservation', support_train_id: 'train', slot_id: 'slot',
          user_id: scenario.account ? 'helper' : null,
          guest_name: 'Email helper', guest_email: scenario.noEmail ? null : 'guest@example.com',
          contribution_mode: 'cook', status: scenario.status || 'reserved',
          last_reminder_sent: scenario.reminded ? '2026-10-03T12:00:00Z' : null,
          SupportTrainSlot: {
            id: 'slot', slot_date: scenario.date, slot_label: 'Dinner',
            start_time: '14:00', end_time: '15:00', status: scenario.slotStatus || 'full',
          },
        }]);
        await runSupportTrainReminders();
        await runSupportTrainReminders();
        expect(sendGuestReservationConfirmationEmail.mock.calls.length).toBe(scenario.email ? 1 : 0);
        expect(createNotification.mock.calls.length).toBe(scenario.account ? 1 : 0);
        const row = supabase.getTable('SupportTrainReservation')[0];
        expect(Boolean(row.last_reminder_sent)).toBe(Boolean(scenario.email || scenario.account || scenario.reminded));
        if (scenario.email) {
          expect(sendGuestReservationConfirmationEmail).toHaveBeenCalledWith(expect.objectContaining({
            toEmail: 'guest@example.com', guestName: 'Email helper', trainTitle: 'Meal train',
            slotLabel: 'Dinner', contributionMode: 'cook', supportTrainId: 'train', isReminder: true,
          }));
          expect(JSON.stringify(sendGuestReservationConfirmationEmail.mock.calls)).not.toMatch(/address|private_note/);
        }
      }

      // Failed sends and local previews remain retryable; a successful retry is
      // marked once and the next scheduler run does not deliver again.
      for (const delivery of [{ success: false }, { success: true, preview: true }]) {
        supabase.resetTables();
        supabase.seedTable('SupportTrain', [{ id: 'train', status: 'active', Activity: { title: 'Meal train' } }]);
        supabase.seedTable('SupportTrainReservation', [{
          id: 'retry', support_train_id: 'train', user_id: null, guest_email: 'guest@example.com',
          guest_name: 'Email helper', status: 'reserved', last_reminder_sent: null,
          SupportTrainSlot: { id: 'slot', slot_date: '2026-10-05', slot_label: 'Dinner', status: 'open' },
        }]);
        sendGuestReservationConfirmationEmail.mockReset()
          .mockResolvedValueOnce(delivery).mockResolvedValue({ success: true });
        await runSupportTrainReminders();
        expect(supabase.getTable('SupportTrainReservation')[0].last_reminder_sent).toBeNull();
        await runSupportTrainReminders();
        expect(supabase.getTable('SupportTrainReservation')[0].last_reminder_sent).not.toBeNull();
        await runSupportTrainReminders();
        expect(sendGuestReservationConfirmationEmail).toHaveBeenCalledTimes(2);
      }

      supabase.resetTables();
      supabase.seedTable('SupportTrain', [{ id: 'train', status: 'published', Activity: { title: 'Meal train' } }]);
      supabase.seedTable('SupportTrainReservation', [{
        id: 'account-retry', support_train_id: 'train', user_id: 'helper', status: 'reserved',
        last_reminder_sent: null,
        SupportTrainSlot: { id: 'slot', slot_date: '2026-10-04', start_time: '14:00', status: 'full' },
      }]);
      createNotification.mockReset().mockResolvedValueOnce(null).mockResolvedValue({ id: 'notification' });
      await runSupportTrainReminders();
      expect(supabase.getTable('SupportTrainReservation')[0].last_reminder_sent).toBeNull();
      await runSupportTrainReminders();
      await runSupportTrainReminders();
      expect(createNotification).toHaveBeenCalledTimes(2);
      expect(createNotification).toHaveBeenLastCalledWith(expect.objectContaining({
        userId: 'helper', type: 'support_train_reminders', link: '/app/support-trains/train',
      }));
    } finally {
      jest.useRealTimers();
      supabase.resetTables();
    }
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
