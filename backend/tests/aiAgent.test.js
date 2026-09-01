/**
 * Tests for AI Agent Layer — schemas, tools, and service orchestration.
 */
const {
  gigDraftJsonSchema,
  listingDraftJsonSchema,
  postDraftJsonSchema,
  mailSummaryJsonSchema,
  placeBriefJsonSchema,
  validateGigDraft,
  validateListingDraft,
  validatePostDraft,
  validateMailSummary,
  validatePlaceBrief,
} = require('../services/ai/schemas');

const { toolDefinitions, executeTool } = require('../services/ai/tools');
const { VERSIONS } = require('../services/ai/prompts');

// ===========================================================================
// Schema validation tests
// ===========================================================================

describe('AI Draft Schemas', () => {
  describe('gigDraftJsonSchema', () => {
    it('has required title and description', () => {
      expect(gigDraftJsonSchema.required).toContain('title');
      expect(gigDraftJsonSchema.required).toContain('description');
    });

    it('validates a valid gig draft', () => {
      const draft = {
        title: 'Help moving furniture',
        description: 'Need help moving a couch and two chairs from 2nd floor.',
        price: 50,
        category: 'moving',
        is_urgent: false,
        tags: ['moving', 'furniture'],
        schedule_type: 'today',
        pay_type: 'fixed',
      };
      expect(validateGigDraft(draft)).toBe(true);
    });

    it('rejects gig with missing title', () => {
      const draft = { description: 'Some description' };
      expect(validateGigDraft(draft)).toBe(false);
    });

    it('rejects gig with short title', () => {
      const draft = { title: 'Hi', description: 'Need help' };
      expect(validateGigDraft(draft)).toBe(false);
    });

    it('rejects gig with invalid schedule_type', () => {
      const draft = {
        title: 'Valid title',
        description: 'Valid description',
        schedule_type: 'invalid_type',
      };
      expect(validateGigDraft(draft)).toBe(false);
    });

    it('rejects additional properties', () => {
      const draft = {
        title: 'Valid title',
        description: 'Valid description',
        unknown_field: 'should fail',
      };
      expect(validateGigDraft(draft)).toBe(false);
    });

    it('validates gig with clarifying questions', () => {
      const draft = {
        title: 'Lawn mowing needed',
        description: 'Front and back yard',
        clarifying_questions: [
          { id: 'q1', question: 'How large is the yard?' },
        ],
      };
      expect(validateGigDraft(draft)).toBe(true);
    });

    it('rejects tags exceeding maxItems', () => {
      const draft = {
        title: 'Valid title here',
        description: 'Valid description here',
        tags: ['a', 'b', 'c', 'd', 'e', 'f'],
      };
      expect(validateGigDraft(draft)).toBe(false);
    });
  });

  describe('listingDraftJsonSchema', () => {
    it('has required title', () => {
      expect(listingDraftJsonSchema.required).toContain('title');
    });

    it('validates a valid listing draft', () => {
      const draft = {
        title: 'Dyson V15 Vacuum',
        description: 'Barely used, comes with all attachments.',
        price: 200,
        isFree: false,
        category: 'electronics',
        condition: 'like_new',
        listingType: 'sell_item',
      };
      expect(validateListingDraft(draft)).toBe(true);
    });

    it('validates free listing', () => {
      const draft = {
        title: 'Free firewood',
        isFree: true,
        listingType: 'free_item',
      };
      expect(validateListingDraft(draft)).toBe(true);
    });

    it('rejects listing with invalid condition', () => {
      const draft = {
        title: 'Some item',
        condition: 'destroyed',
        listingType: 'sell_item',
      };
      expect(validateListingDraft(draft)).toBe(false);
    });
  });

  describe('postDraftJsonSchema', () => {
    it('has required content', () => {
      expect(postDraftJsonSchema.required).toContain('content');
    });

    it('validates a valid post draft', () => {
      const draft = {
        content: 'Anyone know a good plumber in the area? My kitchen sink is leaking.',
        purpose: 'ask',
        visibility: 'neighborhood',
        postType: 'ask_local',
      };
      expect(validatePostDraft(draft)).toBe(true);
    });

    it('rejects post with invalid purpose', () => {
      const draft = {
        content: 'Some content here.',
        purpose: 'invalid_purpose',
      };
      expect(validatePostDraft(draft)).toBe(false);
    });
  });

  describe('mailSummaryJsonSchema', () => {
    it('has required summary and urgency', () => {
      expect(mailSummaryJsonSchema.required).toContain('summary');
      expect(mailSummaryJsonSchema.required).toContain('urgency');
    });

    it('validates a valid mail summary', () => {
      const summary = {
        summary: 'Water bill for January 2025, due February 15.',
        urgency: 'due_soon',
        key_facts: [
          { field: 'Amount', value: '$45.82' },
          { field: 'Due Date', value: '2025-02-15' },
        ],
        recommended_actions: [
          { type: 'pay', title: 'Pay Bill', reason: 'Due within 7 days', metadata: null },
        ],
      };
      expect(validateMailSummary(summary)).toBe(true);
    });

    it('rejects invalid urgency level', () => {
      const summary = {
        summary: 'Some mail summary.',
        urgency: 'super_urgent',
      };
      expect(validateMailSummary(summary)).toBe(false);
    });
  });

  describe('placeBriefJsonSchema', () => {
    it('validates all_clear brief', () => {
      const brief = {
        summary: 'No active alerts for your area.',
        overall_status: 'all_clear',
        headlines: [],
      };
      expect(validatePlaceBrief(brief)).toBe(true);
    });

    it('validates brief with alerts', () => {
      const brief = {
        summary: 'A winter storm is approaching your area.',
        overall_status: 'warning',
        headlines: [
          {
            type: 'weather',
            severity: 'high',
            title: 'Winter Storm Warning',
            detail: 'Heavy snowfall expected tonight.',
            action: null,
          },
        ],
      };
      expect(validatePlaceBrief(brief)).toBe(true);
    });

    it('rejects invalid severity', () => {
      const brief = {
        summary: 'Alert summary',
        overall_status: 'advisory',
        headlines: [
          { type: 'weather', severity: 'apocalyptic', title: 'Bad Alert' },
        ],
      };
      expect(validatePlaceBrief(brief)).toBe(false);
    });
  });
});

// ===========================================================================
// Tool definition tests
// ===========================================================================

describe('AI Tool Definitions', () => {
  it('exports an array of tool definitions', () => {
    expect(Array.isArray(toolDefinitions)).toBe(true);
    expect(toolDefinitions.length).toBeGreaterThan(0);
  });

  it('each tool has required structure', () => {
    for (const tool of toolDefinitions) {
      expect(tool).toHaveProperty('type', 'function');
      expect(tool).toHaveProperty('name');
      expect(typeof tool.name).toBe('string');
      expect(tool).toHaveProperty('description');
      expect(typeof tool.description).toBe('string');
      expect(tool).toHaveProperty('parameters');
      expect(tool.parameters).toHaveProperty('type', 'object');
    }
  });

  it('has expected tool names', () => {
    const toolNames = toolDefinitions.map(t => t.name);
    expect(toolNames).toContain('get_user_context');
    expect(toolNames).toContain('get_place_alerts');
    expect(toolNames).toContain('create_gig_draft');
    expect(toolNames).toContain('create_listing_draft');
    expect(toolNames).toContain('create_post_draft');
    expect(toolNames).toContain('summarize_mail_item');
  });

  it('executeTool returns error for unknown tool', async () => {
    const result = await executeTool('nonexistent_tool', {}, 'user-123');
    expect(result).toHaveProperty('error');
    expect(result.error).toMatch(/unknown/i);
  });
});

// ===========================================================================
// Prompt version tests
// ===========================================================================

describe('AI Prompt Versions', () => {
  it('exports version strings for all prompts', () => {
    expect(VERSIONS).toBeDefined();
    expect(typeof VERSIONS.chat).toBe('string');
    expect(typeof VERSIONS.listing).toBe('string');
    expect(typeof VERSIONS.post).toBe('string');
    expect(typeof VERSIONS.mail).toBe('string');
    expect(typeof VERSIONS.placeBrief).toBe('string');
  });

  it('versions follow named format', () => {
    const versionFormat = /^[a-z]+-.*v\d+\.\d+$/;
    for (const v of Object.values(VERSIONS)) {
      expect(v).toMatch(versionFormat);
    }
  });
});
