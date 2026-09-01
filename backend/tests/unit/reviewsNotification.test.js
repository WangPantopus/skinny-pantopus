const express = require('express');
const request = require('supertest');
const { resetTables, seedTable, getTable } = require('../__mocks__/supabaseAdmin');
const notificationService = require('../../services/notificationService');

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const WORKER_ID = '22222222-2222-4222-8222-222222222222';
const GIG_ID = '33333333-3333-4333-8333-333333333333';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/reviews', require('../../routes/reviews'));
  return app;
}

describe('POST /api/reviews notifications', () => {
  let app;

  beforeAll(() => {
    app = createApp();
  });

  beforeEach(() => {
    resetTables();
    jest.clearAllMocks();

    seedTable('Gig', [
      {
        id: GIG_ID,
        user_id: OWNER_ID,
        accepted_by: WORKER_ID,
        status: 'completed',
      },
    ]);

    seedTable('User', [
      { id: OWNER_ID, name: 'Task Owner', username: 'owner' },
      { id: WORKER_ID, name: 'Worker Bee', first_name: 'Worker', username: 'workerbee' },
    ]);

    seedTable('Review', []);

    notificationService.createNotification.mockResolvedValue({ id: 'notif-review-1' });
  });

  it('notifies the task owner when the worker leaves a review', async () => {
    const res = await request(app)
      .post('/api/reviews')
      .set('x-test-user-id', WORKER_ID)
      .send({
        gig_id: GIG_ID,
        reviewee_id: OWNER_ID,
        rating: 5,
        comment: 'Great task owner',
      });

    expect(res.status).toBe(201);

    await new Promise((resolve) => setImmediate(resolve));

    const reviews = getTable('Review');
    expect(reviews).toHaveLength(1);

    expect(notificationService.createNotification).toHaveBeenCalledWith({
      userId: OWNER_ID,
      type: 'review_received',
      title: 'New Review',
      body: 'Worker Bee left you a 5-star review',
      link: `/gigs/${GIG_ID}`,
      metadata: {
        gig_id: GIG_ID,
        review_id: reviews[0].id,
      },
    });
  });
});
