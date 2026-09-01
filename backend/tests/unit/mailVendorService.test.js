// ============================================================
// TEST: Mail Vendor Service + Providers
//
// Unit tests covering:
//   1. LobMailProvider — sendPostcard, getJobStatus, signature verification
//   2. MockMailProvider — sendPostcard, getJobStatus, reset
//   3. MailVendorService — dispatchPostcard, pollJobStatus, processWebhookEvent
//   4. Lob webhook route — event handling, signature validation, error cases
//   5. HTML template generation
// ============================================================

const { resetTables, seedTable, getTable } = require('../__mocks__/supabaseAdmin');

// ── Mock fetch globally ─────────────────────────────────────

const originalFetch = global.fetch;
let mockFetchImpl;

beforeAll(() => {
  global.fetch = jest.fn((...args) => {
    if (mockFetchImpl) return mockFetchImpl(...args);
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
});

afterAll(() => {
  global.fetch = originalFetch;
});

// ── Setup ───────────────────────────────────────────────────

beforeEach(() => {
  resetTables();
  jest.clearAllMocks();
  mockFetchImpl = null;
});

// ============================================================
// 1. LobMailProvider
// ============================================================

describe('LobMailProvider', () => {
  const { LobMailProvider, buildFrontHtml, buildBackHtml, authHeader } = require('../../services/addressValidation/lobMailProvider');

  const testAddress = {
    line1: '123 Main St',
    line2: 'Apt 4A',
    city: 'Portland',
    state: 'OR',
    zip: '97201',
  };

  describe('isAvailable', () => {
    test('returns false when no API key', () => {
      const provider = new LobMailProvider();
      provider.apiKey = '';
      expect(provider.isAvailable()).toBe(false);
    });

    test('returns true when API key is set', () => {
      const provider = new LobMailProvider();
      provider.apiKey = 'test_key_123';
      expect(provider.isAvailable()).toBe(true);
    });
  });

  describe('sendPostcard', () => {
    test('sends postcard and returns vendorJobId', async () => {
      mockFetchImpl = () =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            id: 'psc_abc123',
            object: 'postcard',
            expected_delivery_date: '2026-03-15',
          }),
        });

      const provider = new LobMailProvider();
      provider.apiKey = 'test_key';
      provider.env = 'test';

      const result = await provider.sendPostcard(testAddress, '123456');
      expect(result.vendorJobId).toBe('psc_abc123');
      expect(result.status).toBe('created');
    });

    test('sends request with correct auth header', async () => {
      mockFetchImpl = (url, opts) => {
        expect(opts.headers.Authorization).toBe(authHeader('test_key'));
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: 'psc_1', object: 'postcard' }),
        });
      };

      const provider = new LobMailProvider();
      provider.apiKey = 'test_key';
      await provider.sendPostcard(testAddress, '123456');
    });

    test('sends JSON body with address fields', async () => {
      let sentBody;
      mockFetchImpl = (url, opts) => {
        sentBody = JSON.parse(opts.body);
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: 'psc_1', object: 'postcard' }),
        });
      };

      const provider = new LobMailProvider();
      provider.apiKey = 'test_key';
      await provider.sendPostcard(testAddress, '123456');

      expect(sentBody.to.address_line1).toBe('123 Main St');
      expect(sentBody.to.address_line2).toBe('Apt 4A');
      expect(sentBody.to.address_city).toBe('Portland');
      expect(sentBody.to.address_state).toBe('OR');
      expect(sentBody.to.address_zip).toBe('97201');
    });

    test('omits address_line2 when not provided', async () => {
      let sentBody;
      mockFetchImpl = (url, opts) => {
        sentBody = JSON.parse(opts.body);
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: 'psc_1', object: 'postcard' }),
        });
      };

      const provider = new LobMailProvider();
      provider.apiKey = 'test_key';
      await provider.sendPostcard({ ...testAddress, line2: undefined }, '123456');

      expect(sentBody.to.address_line2).toBeUndefined();
    });

    test('uses template ID when provided', async () => {
      let sentBody;
      mockFetchImpl = (url, opts) => {
        sentBody = JSON.parse(opts.body);
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: 'psc_1', object: 'postcard' }),
        });
      };

      const provider = new LobMailProvider();
      provider.apiKey = 'test_key';
      await provider.sendPostcard(testAddress, '123456', 'tmpl_custom');

      expect(sentBody.front).toBe('tmpl_custom');
      expect(sentBody.back).toBe('tmpl_custom');
    });

    test('uses inline HTML when no template ID', async () => {
      let sentBody;
      mockFetchImpl = (url, opts) => {
        sentBody = JSON.parse(opts.body);
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: 'psc_1', object: 'postcard' }),
        });
      };

      const provider = new LobMailProvider();
      provider.apiKey = 'test_key';
      await provider.sendPostcard(testAddress, '123456');

      expect(sentBody.front).toContain('Pantopus');
      expect(sentBody.front).toContain('Address Verification');
      expect(sentBody.back).toContain('123456');
    });

    test('throws on API error', async () => {
      mockFetchImpl = () =>
        Promise.resolve({
          ok: false,
          status: 422,
          text: () => Promise.resolve('Unprocessable Entity'),
        });

      const provider = new LobMailProvider();
      provider.apiKey = 'test_key';

      await expect(provider.sendPostcard(testAddress, '123456'))
        .rejects.toThrow('Lob API error: 422');
    });

    test('throws when API key not configured', async () => {
      const provider = new LobMailProvider();
      provider.apiKey = '';

      await expect(provider.sendPostcard(testAddress, '123456'))
        .rejects.toThrow('Lob API key not configured');
    });

    test('posts to /v1/postcards endpoint', async () => {
      let calledUrl;
      mockFetchImpl = (url) => {
        calledUrl = url;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: 'psc_1', object: 'postcard' }),
        });
      };

      const provider = new LobMailProvider();
      provider.apiKey = 'test_key';
      await provider.sendPostcard(testAddress, '123456');

      expect(calledUrl).toBe('https://api.lob.com/v1/postcards');
    });
  });

  describe('getJobStatus', () => {
    test('returns status and metadata', async () => {
      mockFetchImpl = () =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            id: 'psc_abc123',
            expected_delivery_date: '2026-03-15',
            date_created: '2026-02-27',
            send_date: '2026-02-28',
            carrier: 'USPS',
            tracking_number: null,
            thumbnails: [],
            url: 'https://lob.com/psc_abc123.pdf',
          }),
        });

      const provider = new LobMailProvider();
      provider.apiKey = 'test_key';

      const result = await provider.getJobStatus('psc_abc123');
      expect(result.status).toBe('mailed');
      expect(result.metadata.id).toBe('psc_abc123');
      expect(result.metadata.carrier).toBe('USPS');
    });

    test('returns delivered status from tracking events', async () => {
      mockFetchImpl = () =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            id: 'psc_abc123',
            tracking_events: [
              { type: 'In Transit' },
              { type: 'Delivered' },
            ],
          }),
        });

      const provider = new LobMailProvider();
      provider.apiKey = 'test_key';

      const result = await provider.getJobStatus('psc_abc123');
      expect(result.status).toBe('delivered');
    });

    test('returns returned status from tracking events', async () => {
      mockFetchImpl = () =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            id: 'psc_1',
            tracking_events: [{ type: 'Returned to Sender' }],
          }),
        });

      const provider = new LobMailProvider();
      provider.apiKey = 'test_key';

      const result = await provider.getJobStatus('psc_1');
      expect(result.status).toBe('returned');
    });

    test('returns in_transit for generic tracking events', async () => {
      mockFetchImpl = () =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            id: 'psc_1',
            tracking_events: [{ type: 'In Local Area' }],
          }),
        });

      const provider = new LobMailProvider();
      provider.apiKey = 'test_key';

      const result = await provider.getJobStatus('psc_1');
      expect(result.status).toBe('in_transit');
    });

    test('returns created when no send_date', async () => {
      mockFetchImpl = () =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: 'psc_1' }),
        });

      const provider = new LobMailProvider();
      provider.apiKey = 'test_key';

      const result = await provider.getJobStatus('psc_1');
      expect(result.status).toBe('created');
    });

    test('throws on API error', async () => {
      mockFetchImpl = () =>
        Promise.resolve({
          ok: false,
          status: 404,
          text: () => Promise.resolve('Not Found'),
        });

      const provider = new LobMailProvider();
      provider.apiKey = 'test_key';

      await expect(provider.getJobStatus('psc_missing'))
        .rejects.toThrow('Lob API error: 404');
    });

    test('encodes vendor job ID in URL', async () => {
      let calledUrl;
      mockFetchImpl = (url) => {
        calledUrl = url;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: 'psc_abc' }),
        });
      };

      const provider = new LobMailProvider();
      provider.apiKey = 'test_key';
      await provider.getJobStatus('psc_abc');

      expect(calledUrl).toBe('https://api.lob.com/v1/postcards/psc_abc');
    });
  });

  describe('verifyWebhookSignature', () => {
    const crypto = require('crypto');

    test('returns true for valid signature', () => {
      const provider = new LobMailProvider();
      provider.webhookSecret = 'test_secret';

      const timestamp = '1234567890';
      const body = '{"event":"test"}';
      const payload = `${timestamp}.${body}`;
      const expected = crypto
        .createHmac('sha256', 'test_secret')
        .update(payload)
        .digest('hex');

      expect(provider.verifyWebhookSignature(body, timestamp, expected)).toBe(true);
    });

    test('returns false for invalid signature', () => {
      const provider = new LobMailProvider();
      provider.webhookSecret = 'test_secret';

      expect(provider.verifyWebhookSignature('body', '123', 'badsig')).toBe(false);
    });

    test('returns false when webhook secret not configured', () => {
      const provider = new LobMailProvider();
      provider.webhookSecret = '';

      expect(provider.verifyWebhookSignature('body', '123', 'sig')).toBe(false);
    });

    test('returns false for different-length signatures', () => {
      const provider = new LobMailProvider();
      provider.webhookSecret = 'test_secret';

      expect(provider.verifyWebhookSignature('body', '123', 'short')).toBe(false);
    });
  });

  describe('HTML templates', () => {
    test('front HTML contains Pantopus branding', () => {
      const html = buildFrontHtml('Test User');
      expect(html).toContain('Pantopus');
      expect(html).toContain('Address Verification');
      expect(html).toContain('Test User');
    });

    test('front HTML uses default name when not provided', () => {
      const html = buildFrontHtml();
      expect(html).toContain('Current Resident');
    });

    test('back HTML contains code and QR URL', () => {
      const html = buildBackHtml('654321', 'pantopus://verify?code=654321');
      expect(html).toContain('654321');
      expect(html).toContain('Your Verification Code');
      expect(html).toContain('pantopus://verify');
      expect(html).toContain('QR Code');
    });

    test('back HTML includes expiry instruction', () => {
      const html = buildBackHtml('123456', 'pantopus://verify?code=123456');
      expect(html).toContain('30 days');
    });
  });

  describe('authHeader', () => {
    test('generates correct Basic auth header', () => {
      const header = authHeader('test_key_123');
      const decoded = Buffer.from(header.replace('Basic ', ''), 'base64').toString();
      expect(decoded).toBe('test_key_123:');
    });
  });
});

// ============================================================
// 2. MockMailProvider
// ============================================================

describe('MockMailProvider', () => {
  const { MockMailProvider } = require('../../services/addressValidation/mockMailProvider');

  const testAddress = {
    line1: '456 Oak Ave',
    city: 'Seattle',
    state: 'WA',
    zip: '98101',
  };

  test('isAvailable always returns true', () => {
    const provider = new MockMailProvider();
    expect(provider.isAvailable()).toBe(true);
  });

  test('sendPostcard returns a mock vendor job ID', async () => {
    const provider = new MockMailProvider();
    const result = await provider.sendPostcard(testAddress, '123456');

    expect(result.vendorJobId).toMatch(/^mock_psc_/);
    expect(result.status).toBe('sent');
  });

  test('sendPostcard stores the postcard record', async () => {
    const provider = new MockMailProvider();
    await provider.sendPostcard(testAddress, '123456');

    expect(provider.sentPostcards).toHaveLength(1);
    expect(provider.sentPostcards[0].code).toBe('123456');
    expect(provider.sentPostcards[0].address).toEqual(testAddress);
  });

  test('sendPostcard stores templateId', async () => {
    const provider = new MockMailProvider();
    await provider.sendPostcard(testAddress, '123456', 'tmpl_custom');

    expect(provider.sentPostcards[0].templateId).toBe('tmpl_custom');
  });

  test('sendPostcard stores null templateId when not provided', async () => {
    const provider = new MockMailProvider();
    await provider.sendPostcard(testAddress, '123456');

    expect(provider.sentPostcards[0].templateId).toBeNull();
  });

  test('getJobStatus returns delivered for known jobs', async () => {
    const provider = new MockMailProvider();
    const { vendorJobId } = await provider.sendPostcard(testAddress, '123456');

    const status = await provider.getJobStatus(vendorJobId);
    expect(status.status).toBe('delivered');
    expect(status.metadata.mock).toBe(true);
  });

  test('getJobStatus returns unknown for unknown jobs', async () => {
    const provider = new MockMailProvider();
    const status = await provider.getJobStatus('nonexistent');

    expect(status.status).toBe('unknown');
  });

  test('reset clears stored postcards', async () => {
    const provider = new MockMailProvider();
    await provider.sendPostcard(testAddress, '123456');
    expect(provider.sentPostcards).toHaveLength(1);

    provider.reset();
    expect(provider.sentPostcards).toHaveLength(0);
  });

  test('multiple sends accumulate records', async () => {
    const provider = new MockMailProvider();
    await provider.sendPostcard(testAddress, '111111');
    await provider.sendPostcard(testAddress, '222222');

    expect(provider.sentPostcards).toHaveLength(2);
    expect(provider.sentPostcards[0].code).toBe('111111');
    expect(provider.sentPostcards[1].code).toBe('222222');
  });
});

// ============================================================
// 3. MailVendorService
// ============================================================

describe('MailVendorService', () => {
  // We need to mock the providers at the module level
  jest.mock('../../services/addressValidation/lobMailProvider', () => {
    const instance = {
      isAvailable: jest.fn(() => false),
      sendPostcard: jest.fn(),
      getJobStatus: jest.fn(),
      webhookSecret: '',
      verifyWebhookSignature: jest.fn(),
    };
    instance.LobMailProvider = jest.fn();
    return instance;
  });

  jest.mock('../../services/addressValidation/mockMailProvider', () => {
    const instance = {
      isAvailable: jest.fn(() => true),
      sendPostcard: jest.fn(),
      getJobStatus: jest.fn(),
      reset: jest.fn(),
    };
    instance.MockMailProvider = jest.fn();
    return instance;
  });

  const lobProvider = require('../../services/addressValidation/lobMailProvider');
  const mockProvider = require('../../services/addressValidation/mockMailProvider');
  const { MailVendorService } = require('../../services/addressValidation/mailVendorService');

  let service;

  beforeEach(() => {
    service = new MailVendorService();
    lobProvider.isAvailable.mockReturnValue(false);
    mockProvider.sendPostcard.mockResolvedValue({ vendorJobId: 'mock_psc_1', status: 'sent' });
    mockProvider.getJobStatus.mockResolvedValue({ status: 'delivered', metadata: { mock: true } });
  });

  describe('getProvider', () => {
    test('returns mock provider when Lob is not available', () => {
      lobProvider.isAvailable.mockReturnValue(false);
      const provider = service.getProvider();
      expect(provider).toBe(mockProvider);
    });

    test('returns Lob provider when available', () => {
      lobProvider.isAvailable.mockReturnValue(true);
      const provider = service.getProvider();
      expect(provider).toBe(lobProvider);
    });
  });

  describe('dispatchPostcard', () => {
    function seedJobData() {
      seedTable('HomeAddress', [{
        id: 'addr-1',
        address_hash: 'h',
        address_line1_norm: '123 Main St',
        address_line2_norm: null,
        city_norm: 'Portland',
        state: 'OR',
        postal_code: '97201',
        country: 'US',
        place_type: 'single_family',
      }]);
      seedTable('AddressVerificationAttempt', [{
        id: 'attempt-1',
        user_id: 'user-1',
        address_id: 'addr-1',
        method: 'mail_code',
        status: 'created',
        risk_tier: 'low',
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      }]);
      seedTable('MailVerificationJob', [{
        id: 'job-1',
        attempt_id: 'attempt-1',
        vendor: 'pending',
        template_id: 'address_verification_v1',
        vendor_job_id: null,
        vendor_status: 'pending',
        metadata: { code: '123456', address_id: 'addr-1' },
      }]);
    }

    test('dispatches postcard and updates job', async () => {
      seedJobData();
      const result = await service.dispatchPostcard('job-1');

      expect(result.success).toBe(true);
      expect(result.vendorJobId).toBe('mock_psc_1');

      // Check job was updated
      const jobs = getTable('MailVerificationJob');
      const job = jobs.find((j) => j.id === 'job-1');
      expect(job.vendor).toBe('mock');
      expect(job.vendor_job_id).toBe('mock_psc_1');
      expect(job.vendor_status).toBe('sent');
      expect(job.sent_at).toBeTruthy();
    });

    test('transitions attempt status to sent', async () => {
      seedJobData();
      await service.dispatchPostcard('job-1');

      const attempts = getTable('AddressVerificationAttempt');
      const attempt = attempts.find((a) => a.id === 'attempt-1');
      expect(attempt.status).toBe('sent');
    });

    test('returns error when job not found', async () => {
      const result = await service.dispatchPostcard('nonexistent');
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    test('skips if already dispatched', async () => {
      seedJobData();
      // Manually set vendor_job_id
      const jobs = getTable('MailVerificationJob');
      jobs[0].vendor_job_id = 'psc_already';

      const result = await service.dispatchPostcard('job-1');
      expect(result.success).toBe(true);
      expect(result.vendorJobId).toBe('psc_already');
      expect(mockProvider.sendPostcard).not.toHaveBeenCalled();
    });

    test('returns error when attempt not found', async () => {
      seedTable('MailVerificationJob', [{
        id: 'job-orphan',
        attempt_id: 'missing-attempt',
        vendor: 'pending',
        vendor_status: 'pending',
        metadata: { code: '123456' },
      }]);

      const result = await service.dispatchPostcard('job-orphan');
      expect(result.success).toBe(false);
      expect(result.error).toContain('attempt not found');
    });

    test('returns error when address not found', async () => {
      seedTable('AddressVerificationAttempt', [{
        id: 'attempt-orphan',
        user_id: 'user-1',
        address_id: 'missing-addr',
        method: 'mail_code',
        status: 'created',
        expires_at: new Date().toISOString(),
      }]);
      seedTable('MailVerificationJob', [{
        id: 'job-no-addr',
        attempt_id: 'attempt-orphan',
        vendor: 'pending',
        vendor_status: 'pending',
        metadata: { code: '123456' },
      }]);

      const result = await service.dispatchPostcard('job-no-addr');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Address not found');
    });

    test('returns error when code missing from metadata', async () => {
      seedTable('HomeAddress', [{
        id: 'addr-1',
        address_hash: 'h',
        address_line1_norm: '123 Main St',
        city_norm: 'Portland',
        state: 'OR',
        postal_code: '97201',
        country: 'US',
        place_type: 'single_family',
      }]);
      seedTable('AddressVerificationAttempt', [{
        id: 'attempt-no-code',
        user_id: 'user-1',
        address_id: 'addr-1',
        method: 'mail_code',
        status: 'created',
        expires_at: new Date().toISOString(),
      }]);
      seedTable('MailVerificationJob', [{
        id: 'job-no-code',
        attempt_id: 'attempt-no-code',
        vendor: 'pending',
        vendor_status: 'pending',
        metadata: {},
      }]);

      const result = await service.dispatchPostcard('job-no-code');
      expect(result.success).toBe(false);
      expect(result.error).toContain('code not found');
    });

    test('handles provider error gracefully', async () => {
      seedJobData();
      mockProvider.sendPostcard.mockRejectedValue(new Error('Network timeout'));

      const result = await service.dispatchPostcard('job-1');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Network timeout');

      // Job should be marked as failed
      const jobs = getTable('MailVerificationJob');
      const job = jobs.find((j) => j.id === 'job-1');
      expect(job.vendor_status).toBe('failed');
    });

    test('passes correct address to provider', async () => {
      seedJobData();
      await service.dispatchPostcard('job-1');

      expect(mockProvider.sendPostcard).toHaveBeenCalledWith(
        expect.objectContaining({
          line1: '123 Main St',
          city: 'Portland',
          state: 'OR',
          zip: '97201',
        }),
        '123456',
        'address_verification_v1',
      );
    });

    test('uses unit from metadata as line2 fallback', async () => {
      seedTable('HomeAddress', [{
        id: 'addr-1',
        address_hash: 'h',
        address_line1_norm: '456 Oak Ave',
        address_line2_norm: null,
        city_norm: 'Seattle',
        state: 'WA',
        postal_code: '98101',
        country: 'US',
        place_type: 'building',
      }]);
      seedTable('AddressVerificationAttempt', [{
        id: 'attempt-unit',
        user_id: 'user-1',
        address_id: 'addr-1',
        method: 'mail_code',
        status: 'created',
        expires_at: new Date().toISOString(),
      }]);
      seedTable('MailVerificationJob', [{
        id: 'job-unit',
        attempt_id: 'attempt-unit',
        vendor: 'pending',
        vendor_status: 'pending',
        metadata: { code: '654321', address_id: 'addr-1', unit: 'Apt 3B' },
      }]);

      await service.dispatchPostcard('job-unit');

      expect(mockProvider.sendPostcard).toHaveBeenCalledWith(
        expect.objectContaining({ line2: 'Apt 3B' }),
        '654321',
        undefined,
      );
    });
  });

  describe('pollJobStatus', () => {
    test('delegates to active provider', async () => {
      const result = await service.pollJobStatus('mock_psc_1');
      expect(mockProvider.getJobStatus).toHaveBeenCalledWith('mock_psc_1');
      expect(result.status).toBe('delivered');
    });
  });

  describe('processWebhookEvent', () => {
    function seedJobWithVendor() {
      seedTable('AddressVerificationAttempt', [{
        id: 'attempt-wh',
        user_id: 'user-1',
        address_id: 'addr-1',
        method: 'mail_code',
        status: 'sent',
        expires_at: new Date().toISOString(),
      }]);
      seedTable('MailVerificationJob', [{
        id: 'job-wh',
        attempt_id: 'attempt-wh',
        vendor: 'lob',
        vendor_job_id: 'psc_lob_123',
        vendor_status: 'created',
        metadata: { code: '123456' },
      }]);
    }

    test('updates job vendor_status on event', async () => {
      seedJobWithVendor();
      const result = await service.processWebhookEvent('psc_lob_123', 'postcard.mailed', {});

      expect(result.success).toBe(true);

      const jobs = getTable('MailVerificationJob');
      const job = jobs.find((j) => j.vendor_job_id === 'psc_lob_123');
      expect(job.vendor_status).toBe('mailed');
    });

    test('transitions attempt to delivered_unknown on postcard.delivered', async () => {
      seedJobWithVendor();
      await service.processWebhookEvent('psc_lob_123', 'postcard.delivered', {});

      const attempts = getTable('AddressVerificationAttempt');
      const attempt = attempts.find((a) => a.id === 'attempt-wh');
      expect(attempt.status).toBe('delivered_unknown');
    });

    test('transitions attempt to expired on returned_to_sender', async () => {
      seedJobWithVendor();
      await service.processWebhookEvent('psc_lob_123', 'postcard.returned_to_sender', {});

      const attempts = getTable('AddressVerificationAttempt');
      const attempt = attempts.find((a) => a.id === 'attempt-wh');
      expect(attempt.status).toBe('expired');
    });

    test('stores webhook event metadata in job', async () => {
      seedJobWithVendor();
      await service.processWebhookEvent('psc_lob_123', 'postcard.in_transit', { extra: 'data' });

      const jobs = getTable('MailVerificationJob');
      const job = jobs.find((j) => j.vendor_job_id === 'psc_lob_123');
      expect(job.metadata.last_webhook_event).toBe('postcard.in_transit');
      expect(job.metadata.last_webhook_at).toBeTruthy();
    });

    test('returns error when job not found', async () => {
      const result = await service.processWebhookEvent('psc_missing', 'postcard.mailed', {});
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    test('maps unknown event type to "unknown" status', async () => {
      seedJobWithVendor();
      await service.processWebhookEvent('psc_lob_123', 'postcard.something_new', {});

      const jobs = getTable('MailVerificationJob');
      const job = jobs.find((j) => j.vendor_job_id === 'psc_lob_123');
      expect(job.vendor_status).toBe('unknown');
    });

    test('maps postcard.rendered_pdf to rendered', async () => {
      seedJobWithVendor();
      await service.processWebhookEvent('psc_lob_123', 'postcard.rendered_pdf', {});

      const jobs = getTable('MailVerificationJob');
      expect(jobs.find((j) => j.vendor_job_id === 'psc_lob_123').vendor_status).toBe('rendered');
    });

    test('maps postcard.in_local_area to in_local_area', async () => {
      seedJobWithVendor();
      await service.processWebhookEvent('psc_lob_123', 'postcard.in_local_area', {});

      const jobs = getTable('MailVerificationJob');
      expect(jobs.find((j) => j.vendor_job_id === 'psc_lob_123').vendor_status).toBe('in_local_area');
    });

    test('maps postcard.processed_for_delivery to out_for_delivery', async () => {
      seedJobWithVendor();
      await service.processWebhookEvent('psc_lob_123', 'postcard.processed_for_delivery', {});

      const jobs = getTable('MailVerificationJob');
      expect(jobs.find((j) => j.vendor_job_id === 'psc_lob_123').vendor_status).toBe('out_for_delivery');
    });

    test('maps postcard.deleted to canceled', async () => {
      seedJobWithVendor();
      await service.processWebhookEvent('psc_lob_123', 'postcard.deleted', {});

      const jobs = getTable('MailVerificationJob');
      expect(jobs.find((j) => j.vendor_job_id === 'psc_lob_123').vendor_status).toBe('canceled');
    });

    test('maps postcard.re-routed to rerouted', async () => {
      seedJobWithVendor();
      await service.processWebhookEvent('psc_lob_123', 'postcard.re-routed', {});

      const jobs = getTable('MailVerificationJob');
      expect(jobs.find((j) => j.vendor_job_id === 'psc_lob_123').vendor_status).toBe('rerouted');
    });

    test('does not transition attempt from verified on delivered', async () => {
      seedTable('AddressVerificationAttempt', [{
        id: 'attempt-verified',
        user_id: 'user-1',
        address_id: 'addr-1',
        method: 'mail_code',
        status: 'verified',
        expires_at: new Date().toISOString(),
      }]);
      seedTable('MailVerificationJob', [{
        id: 'job-verified',
        attempt_id: 'attempt-verified',
        vendor: 'lob',
        vendor_job_id: 'psc_v',
        vendor_status: 'mailed',
        metadata: {},
      }]);

      await service.processWebhookEvent('psc_v', 'postcard.delivered', {});

      // Should remain verified (the .in() filter prevents transition)
      const attempts = getTable('AddressVerificationAttempt');
      expect(attempts.find((a) => a.id === 'attempt-verified').status).toBe('verified');
    });
  });
});

// ============================================================
// 4. Lob Webhook Route
// ============================================================

describe('Lob webhook route', () => {
  // Re-mock for route-level tests
  jest.mock('../../services/addressValidation/mailVendorService', () => ({
    processWebhookEvent: jest.fn(),
    MailVendorService: jest.fn(),
  }));

  jest.mock('../../services/addressValidation/lobMailProvider', () => ({
    webhookSecret: '',
    verifyWebhookSignature: jest.fn(() => true),
    isAvailable: jest.fn(() => false),
  }));

  const mailVendorService = require('../../services/addressValidation/mailVendorService');
  const lobMailProvider = require('../../services/addressValidation/lobMailProvider');

  const router = require('../../routes/lobWebhook');

  function findHandler() {
    for (const layer of router.stack) {
      if (layer.route && layer.route.path === '/' && layer.route.methods.post) {
        return layer.route.stack[layer.route.stack.length - 1].handle;
      }
    }
    throw new Error('POST / handler not found on lobWebhook router');
  }

  const handler = findHandler();

  function mockReq(body, headers = {}) {
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
    return {
      body: Buffer.from(bodyStr),
      headers: {
        'lob-signature-timestamp': '1234567890',
        'lob-signature': 'valid_sig',
        ...headers,
      },
    };
  }

  function mockRes() {
    const res = {
      _status: 200,
      _json: null,
      status(code) { res._status = code; return res; },
      json(data) { res._json = data; return res; },
    };
    return res;
  }

  beforeEach(() => {
    lobMailProvider.webhookSecret = '';
    mailVendorService.processWebhookEvent.mockResolvedValue({ success: true });
  });

  test('processes valid webhook event', async () => {
    const event = {
      event_type: { id: 'postcard.mailed' },
      body: { id: 'psc_123' },
      id: 'evt_1',
    };

    const req = mockReq(event);
    const res = mockRes();
    await handler(req, res);

    expect(res._status).toBe(200);
    expect(res._json.received).toBe(true);
    expect(res._json.postcardId).toBe('psc_123');
    expect(res._json.eventType).toBe('postcard.mailed');
  });

  test('calls processWebhookEvent with correct args', async () => {
    const event = {
      event_type: { id: 'postcard.delivered' },
      body: { id: 'psc_456' },
    };

    const req = mockReq(event);
    const res = mockRes();
    await handler(req, res);

    expect(mailVendorService.processWebhookEvent).toHaveBeenCalledWith(
      'psc_456',
      'postcard.delivered',
      expect.objectContaining({ event_type: { id: 'postcard.delivered' } }),
    );
  });

  test('returns 400 for invalid JSON', async () => {
    const req = mockReq('not-json{{{');
    const res = mockRes();
    await handler(req, res);

    expect(res._status).toBe(400);
    expect(res._json.error).toContain('Invalid JSON');
  });

  test('returns 400 when missing event_type', async () => {
    const req = mockReq({ body: { id: 'psc_1' } });
    const res = mockRes();
    await handler(req, res);

    expect(res._status).toBe(400);
    expect(res._json.error).toContain('Missing');
  });

  test('returns 400 when missing postcard ID', async () => {
    const req = mockReq({ event_type: { id: 'postcard.mailed' } });
    const res = mockRes();
    await handler(req, res);

    expect(res._status).toBe(400);
  });

  test('verifies signature when webhook secret is configured', async () => {
    lobMailProvider.webhookSecret = 'secret_123';
    lobMailProvider.verifyWebhookSignature.mockReturnValue(true);

    const event = {
      event_type: { id: 'postcard.mailed' },
      body: { id: 'psc_1' },
    };

    const req = mockReq(event);
    const res = mockRes();
    await handler(req, res);

    expect(lobMailProvider.verifyWebhookSignature).toHaveBeenCalled();
    expect(res._status).toBe(200);
  });

  test('returns 401 for invalid signature', async () => {
    lobMailProvider.webhookSecret = 'secret_123';
    lobMailProvider.verifyWebhookSignature.mockReturnValue(false);

    const req = mockReq({ event_type: { id: 'postcard.mailed' }, body: { id: 'psc_1' } });
    const res = mockRes();
    await handler(req, res);

    expect(res._status).toBe(401);
    expect(res._json.error).toContain('Invalid webhook signature');
  });

  test('returns 400 when signature headers missing', async () => {
    lobMailProvider.webhookSecret = 'secret_123';

    const event = { event_type: { id: 'postcard.mailed' }, body: { id: 'psc_1' } };
    const req = mockReq(event, {
      'lob-signature-timestamp': undefined,
      'lob-signature': undefined,
    });
    const res = mockRes();
    await handler(req, res);

    expect(res._status).toBe(400);
    expect(res._json.error).toContain('Missing signature');
  });

  test('skips signature verification when no secret', async () => {
    lobMailProvider.webhookSecret = '';

    const event = {
      event_type: { id: 'postcard.mailed' },
      body: { id: 'psc_1' },
    };

    const req = mockReq(event);
    const res = mockRes();
    await handler(req, res);

    expect(lobMailProvider.verifyWebhookSignature).not.toHaveBeenCalled();
    expect(res._status).toBe(200);
  });

  test('returns 200 even when processWebhookEvent fails', async () => {
    mailVendorService.processWebhookEvent.mockResolvedValue({
      success: false,
      error: 'Job not found',
    });

    const event = {
      event_type: { id: 'postcard.mailed' },
      body: { id: 'psc_unknown' },
    };

    const req = mockReq(event);
    const res = mockRes();
    await handler(req, res);

    // Still 200 to prevent Lob retries
    expect(res._status).toBe(200);
    expect(res._json.received).toBe(true);
  });

  test('returns 200 on processing exception', async () => {
    mailVendorService.processWebhookEvent.mockRejectedValue(new Error('DB error'));

    const event = {
      event_type: { id: 'postcard.mailed' },
      body: { id: 'psc_1' },
    };

    const req = mockReq(event);
    const res = mockRes();
    await handler(req, res);

    expect(res._status).toBe(200);
    expect(res._json.received).toBe(true);
    expect(res._json.error).toBe('DB error');
  });

  test('supports alternative event format with type and reference_id', async () => {
    const event = {
      type: 'postcard.delivered',
      reference_id: 'psc_alt',
    };

    const req = mockReq(event);
    const res = mockRes();
    await handler(req, res);

    expect(mailVendorService.processWebhookEvent).toHaveBeenCalledWith(
      'psc_alt',
      'postcard.delivered',
      expect.anything(),
    );
  });
});
