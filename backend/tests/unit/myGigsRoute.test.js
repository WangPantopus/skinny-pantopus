const { resetTables, seedTable } = require('../__mocks__/supabaseAdmin');

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../../middleware/verifyToken', () => (req, _res, next) => {
  req.user = { id: 'aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa', role: 'user' };
  next();
});

jest.mock('../../services/notificationService', () => ({
  createNotification: jest.fn(),
  createBulkNotifications: jest.fn(),
  notifyBidReceived: jest.fn(),
  notifyBidAccepted: jest.fn(),
}));

jest.mock('../../utils/businessPermissions', () => ({
  hasPermission: jest.fn().mockResolvedValue(false),
  getBusinessIdsWithPermissions: jest.fn().mockResolvedValue([]),
  getTeamMembersWithPermissions: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../stripe/stripeService', () => ({
  createPaymentIntent: jest.fn(),
  capturePayment: jest.fn(),
  refundPayment: jest.fn(),
}));

jest.mock('../../stripe/paymentStateMachine', () => ({
  PAYMENT_STATES: {
    PENDING: 'pending',
    AUTHORIZED: 'authorized',
    CAPTURED: 'captured',
    RELEASED: 'released',
    REFUNDED: 'refunded',
  },
}));

const express = require('express');
const request = require('supertest');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/gigs', require('../../routes/gigs'));
  return app;
}

describe('GET /api/gigs/my-gigs', () => {
  let app;

  beforeAll(() => {
    app = createApp();
  });

  beforeEach(() => {
    resetTables();
  });

  it('returns poster dashboard bid metrics and thumbnails', async () => {
    seedTable('Gig', [
      {
        id: 'gig-1',
        title: 'Need patio cleaned',
        description: 'Wash and sweep the patio',
        price: 80,
        category: 'Cleaning',
        deadline: '2026-03-10T18:00:00.000Z',
        status: 'open',
        user_id: 'aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa',
        accepted_by: null,
        accepted_at: null,
        created_at: '2026-03-07T12:00:00.000Z',
        updated_at: '2026-03-07T12:00:00.000Z',
        attachments: ['https://cdn.example.com/patio.jpg', 'https://cdn.example.com/notes.pdf'],
      },
      {
        id: 'gig-2',
        title: 'Need moving help',
        description: 'Carry boxes downstairs',
        price: 120,
        category: 'Moving',
        deadline: null,
        status: 'completed',
        user_id: 'aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa',
        accepted_by: 'worker-7',
        accepted_at: '2026-03-06T10:00:00.000Z',
        created_at: '2026-03-05T09:00:00.000Z',
        updated_at: '2026-03-06T14:00:00.000Z',
        attachments: [],
      },
    ]);

    seedTable('GigBid', [
      { id: 'bid-1', gig_id: 'gig-1', bid_amount: 65 },
      { id: 'bid-2', gig_id: 'gig-1', bid_amount: 75 },
    ]);

    const res = await request(app).get('/api/gigs/my-gigs').expect(200);

    expect(res.body.total).toBe(2);

    const firstGig = res.body.gigs.find((gig) => gig.id === 'gig-1');
    const secondGig = res.body.gigs.find((gig) => gig.id === 'gig-2');

    expect(firstGig.bid_count).toBe(2);
    expect(firstGig.bidsCount).toBe(2);
    expect(firstGig.top_bid_amount).toBe(75);
    expect(firstGig.first_image).toBe('https://cdn.example.com/patio.jpg');

    expect(secondGig.bid_count).toBe(0);
    expect(secondGig.top_bid_amount).toBeNull();
    expect(secondGig.first_image).toBeNull();
  });
});
