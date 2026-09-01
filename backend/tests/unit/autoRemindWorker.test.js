const { resetTables, seedTable, getTable } = require('../__mocks__/supabaseAdmin');
const notificationService = require('../../services/notificationService');

const POSTER_ID = 'poster-1111-1111-1111-111111111111';
const WORKER_ID = 'worker-2222-2222-2222-222222222222';
const GIG_ID = 'gig-auto-3333-3333-333333333333';

function seedGig(overrides = {}) {
  seedTable('Gig', [
    {
      id: GIG_ID,
      title: 'Furniture assembly',
      user_id: POSTER_ID,
      accepted_by: WORKER_ID,
      accepted_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 hour ago
      status: 'assigned',
      started_at: null,
      scheduled_start: null,
      starts_asap: false,
      last_worker_reminder_at: null,
      auto_reminder_count: 0,
      worker_ack_status: null,
      worker_ack_eta_minutes: null,
      worker_ack_updated_at: null,
      ...overrides,
    },
  ]);
}

describe('autoRemindWorker job', () => {
  let autoRemindWorker;

  beforeAll(() => {
    autoRemindWorker = require('../../jobs/autoRemindWorker');
  });

  beforeEach(() => {
    resetTables();
    jest.clearAllMocks();
    notificationService.createNotification.mockResolvedValue({ id: 'notif-1' });
  });

  it('sends first reminder for scheduled gig approaching start time (T-30min)', async () => {
    const thirtyMinFromNow = new Date(Date.now() + 25 * 60 * 1000).toISOString(); // 25 min from now
    seedGig({ scheduled_start: thirtyMinFromNow });

    await autoRemindWorker();

    expect(notificationService.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: WORKER_ID,
        type: 'gig_start_reminder',
        metadata: expect.objectContaining({
          reminder_kind: 'auto_start_work',
          auto_reminder_number: 1,
        }),
      })
    );

    const gigTable = getTable('Gig');
    const gig = gigTable.find((g) => g.id === GIG_ID);
    expect(gig.auto_reminder_count).toBe(1);
    expect(gig.last_worker_reminder_at).toBeDefined();
  });

  it('sends second reminder for scheduled gig past start time', async () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    seedGig({
      scheduled_start: fiveMinAgo,
      auto_reminder_count: 1,
      last_worker_reminder_at: new Date(Date.now() - 20 * 60 * 1000).toISOString(), // 20 min ago
    });

    await autoRemindWorker();

    expect(notificationService.createNotification).toHaveBeenCalledTimes(1);

    const gigTable = getTable('Gig');
    const gig = gigTable.find((g) => g.id === GIG_ID);
    expect(gig.auto_reminder_count).toBe(2);
  });

  it('sends first reminder for ASAP gig 30+ min after acceptance', async () => {
    seedGig({
      accepted_at: new Date(Date.now() - 35 * 60 * 1000).toISOString(), // 35 min ago
    });

    await autoRemindWorker();

    expect(notificationService.createNotification).toHaveBeenCalledTimes(1);
  });

  it('sends second reminder for ASAP gig 90+ min after acceptance', async () => {
    seedGig({
      accepted_at: new Date(Date.now() - 95 * 60 * 1000).toISOString(), // 95 min ago
      auto_reminder_count: 1,
      last_worker_reminder_at: new Date(Date.now() - 50 * 60 * 1000).toISOString(), // 50 min ago
    });

    await autoRemindWorker();

    expect(notificationService.createNotification).toHaveBeenCalledTimes(1);

    const gigTable = getTable('Gig');
    const gig = gigTable.find((g) => g.id === GIG_ID);
    expect(gig.auto_reminder_count).toBe(2);
  });

  it('skips gig where worker said starting_now', async () => {
    const tenMinFromNow = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    seedGig({
      scheduled_start: tenMinFromNow,
      worker_ack_status: 'starting_now',
    });

    await autoRemindWorker();

    expect(notificationService.createNotification).not.toHaveBeenCalled();
  });

  it('respects 15-min cooldown from last reminder', async () => {
    const tenMinFromNow = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    seedGig({
      scheduled_start: tenMinFromNow,
      last_worker_reminder_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 min ago
    });

    await autoRemindWorker();

    expect(notificationService.createNotification).not.toHaveBeenCalled();
  });

  it('caps at 2 auto-reminders', async () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    seedGig({
      scheduled_start: fiveMinAgo,
      auto_reminder_count: 2,
      last_worker_reminder_at: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    });

    await autoRemindWorker();

    // Query should exclude gigs with auto_reminder_count >= 2
    expect(notificationService.createNotification).not.toHaveBeenCalled();
  });

  it('delays reminder when worker is running_late with ETA', async () => {
    const tenMinFromNow = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    seedGig({
      scheduled_start: tenMinFromNow,
      worker_ack_status: 'running_late',
      worker_ack_eta_minutes: 30,
      worker_ack_updated_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 min ago, ETA 30min = 25 min left
    });

    await autoRemindWorker();

    // Worker said 30min ETA 5 min ago, so 25 min remain — should not remind yet
    expect(notificationService.createNotification).not.toHaveBeenCalled();
  });

  it('sends reminder when running_late ETA has passed', async () => {
    const tenMinFromNow = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    seedGig({
      scheduled_start: tenMinFromNow,
      worker_ack_status: 'running_late',
      worker_ack_eta_minutes: 10,
      worker_ack_updated_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15 min ago, ETA 10min = expired
    });

    await autoRemindWorker();

    expect(notificationService.createNotification).toHaveBeenCalledTimes(1);
  });

  it('does not send reminder for gig where start time is far away', async () => {
    const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    seedGig({ scheduled_start: twoHoursFromNow });

    await autoRemindWorker();

    expect(notificationService.createNotification).not.toHaveBeenCalled();
  });
});
