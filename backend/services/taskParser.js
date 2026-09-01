/**
 * Deterministic Task Parser
 * =========================
 * Fast, regex-based extraction of structured fields from plain-language task text.
 * Runs BEFORE LLM to provide instant defaults and reduce hallucination surface.
 *
 * Extracted fields:
 *   - budget (dollar amount)
 *   - schedule_type / time expressions
 *   - location hints (home/current/address)
 *   - urgency signals
 *   - category hints
 */
const logger = require('../utils/logger');

// ── Price / Budget ───────────────────────────────────────────────

const MONEY_RE = /\$\s?(\d{1,6}(?:\.\d{1,2})?)/i;
const MONEY_WORDS_RE = /(?:around|about|roughly|~|approx(?:imately)?)\s+\$?\s?(\d{1,6})/i;
const BUDGET_RANGE_RE = /\$?\s?(\d{1,6})\s*[-–—to]+\s*\$?\s?(\d{1,6})/i;
const HOURLY_RE = /\$?\s?(\d{1,5})\s*(?:\/\s*h(?:ou)?r|per\s*h(?:ou)?r|hourly)/i;

function extractBudget(text) {
  // Hourly rate first (more specific)
  const hourlyMatch = text.match(HOURLY_RE);
  if (hourlyMatch) {
    return {
      pay_type: 'hourly',
      hourly_rate: parseFloat(hourlyMatch[1]),
      confidence: 0.9,
    };
  }

  // Range
  const rangeMatch = text.match(BUDGET_RANGE_RE);
  if (rangeMatch) {
    const low = parseFloat(rangeMatch[1]);
    const high = parseFloat(rangeMatch[2]);
    return {
      pay_type: 'fixed',
      budget_fixed: Math.round((low + high) / 2),
      confidence: 0.8,
    };
  }

  // Exact amount
  const exactMatch = text.match(MONEY_RE) || text.match(MONEY_WORDS_RE);
  if (exactMatch) {
    return {
      pay_type: 'fixed',
      budget_fixed: parseFloat(exactMatch[1]),
      confidence: 0.9,
    };
  }

  // "open to offers" / "negotiable" / "make an offer"
  if (/\b(open\s+to\s+offers?|negotiabl[e]|make\s+(?:an?\s+)?offer|name\s+your\s+price)\b/i.test(text)) {
    return { pay_type: 'offers', confidence: 0.85 };
  }

  return null;
}

// ── Schedule / Time ──────────────────────────────────────────────

const NOW_RE = /\b(asap|right\s+now|immediately|urgent(?:ly)?|as\s+soon\s+as\s+possible)\b/i;
const TODAY_RE = /\b(today|this\s+(?:afternoon|evening|morning)|tonight|later\s+today)\b/i;
const TOMORROW_RE = /\b(tomorrow|tmrw)\b/i;
const THIS_WEEK_RE = /\b(this\s+week(?:end)?|next\s+few\s+days)\b/i;
const FLEXIBLE_RE = /\b(whenever|flexible|no\s+rush|any\s*time|when(?:ever)?\s+(?:you\s+)?can)\b/i;
const DATE_RE = /\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/;
const TIME_RE = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)\b/i;

function extractSchedule(text) {
  if (NOW_RE.test(text)) {
    return { schedule_type: 'asap', confidence: 0.95 };
  }
  if (TODAY_RE.test(text)) {
    return { schedule_type: 'today', confidence: 0.9 };
  }
  if (TOMORROW_RE.test(text)) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    return {
      schedule_type: 'scheduled',
      time_window_start: tomorrow.toISOString(),
      confidence: 0.85,
    };
  }
  if (FLEXIBLE_RE.test(text)) {
    return { schedule_type: 'flexible', confidence: 0.9 };
  }
  if (THIS_WEEK_RE.test(text)) {
    return { schedule_type: 'flexible', confidence: 0.7 };
  }

  // Specific date
  const dateMatch = text.match(DATE_RE);
  if (dateMatch) {
    const month = parseInt(dateMatch[1]);
    const day = parseInt(dateMatch[2]);
    const year = dateMatch[3] ? parseInt(dateMatch[3]) : new Date().getFullYear();
    const fullYear = year < 100 ? 2000 + year : year;
    const d = new Date(fullYear, month - 1, day, 9, 0, 0);
    if (!isNaN(d.getTime())) {
      return {
        schedule_type: 'scheduled',
        time_window_start: d.toISOString(),
        confidence: 0.8,
      };
    }
  }

  return null;
}

// ── Location ─────────────────────────────────────────────────────

const HOME_RE = /\b(at\s+(?:my\s+)?home|my\s+(?:house|place|apartment|apt|condo|flat)|come\s+(?:to\s+)?(?:my\s+)?(?:home|house|place))\b/i;
const CURRENT_RE = /\b((?:my\s+)?current\s+location|where\s+i\s+am|here)\b/i;

function extractLocation(text) {
  if (HOME_RE.test(text)) {
    return { location_mode: 'home', confidence: 0.9 };
  }
  if (CURRENT_RE.test(text)) {
    return { location_mode: 'current', confidence: 0.8 };
  }
  return null;
}

// ── Category ─────────────────────────────────────────────────────

const CATEGORY_PATTERNS = [
  { pattern: /\b(mov(?:e|ing)\s+(?:furniture|couch|table|bed|boxes|stuff)|help\s+mov(?:e|ing))\b/i, category: 'Moving' },
  { pattern: /\b(clean(?:ing)?|mop|vacuum|scrub|tidy|dust)\b/i, category: 'Cleaning' },
  { pattern: /\b(mow(?:ing)?|lawn|yard|garden(?:ing)?|landscap(?:e|ing)|weeds?|hedge|trim)\b/i, category: 'Gardening' },
  { pattern: /\b(fix|repair|broken|mount|install|hang|assemble|plumb(?:ing)?|leak|pipe|handyman)\b/i, category: 'Handyman' },
  { pattern: /\b(deliver(?:y)?|pick\s*up|errand|grocer(?:y|ies)|shop(?:ping)?|fetch)\b/i, category: 'Delivery' },
  { pattern: /\b(dog|cat|pet|walk(?:ing)?|feed(?:ing)?|sit(?:ting)?)\b/i, category: 'Pet Care' },
  { pattern: /\b(child|kid|baby|nanny|babysit(?:ting)?|watch\s+(?:my\s+)?kids?)\b/i, category: 'Child Care' },
  { pattern: /\b(tutor(?:ing)?|teach|lesson|homework|math|reading)\b/i, category: 'Tutoring' },
  { pattern: /\b(photo(?:graph)?(?:y|er)?|portrait|headshot|shoot)\b/i, category: 'Photography' },
  { pattern: /\b(cook(?:ing)?|chef|meal(?:\s+prep)?|cater(?:ing)?)\b/i, category: 'Cooking' },
  { pattern: /\b(tech|computer|laptop|wifi|printer|software|IT|setup)\b/i, category: 'Tech Support' },
  { pattern: /\b(event|party|setup|decor(?:ation)?|birthday)\b/i, category: 'Event Help' },
];

function extractCategory(text) {
  for (const { pattern, category } of CATEGORY_PATTERNS) {
    if (pattern.test(text)) {
      return { category, confidence: 0.8 };
    }
  }
  return null;
}

// ── Urgency ──────────────────────────────────────────────────────

const URGENT_RE = /\b(urgent(?:ly)?|emergency|asap|right\s+now|immediately|desperate(?:ly)?|need\s+(?:it\s+)?now)\b/i;

function extractUrgency(text) {
  return URGENT_RE.test(text) ? { is_urgent: true, confidence: 0.9 } : null;
}

// ── Tags (simple keyword extraction) ─────────────────────────────

const TAG_PATTERNS = [
  { pattern: /\bheavy\s+lift(?:ing)?\b/i, tag: 'heavy-lifting' },
  { pattern: /\boutdoor\b/i, tag: 'outdoor' },
  { pattern: /\bindoor\b/i, tag: 'indoor' },
  { pattern: /\btools?\s+(?:required|needed)\b/i, tag: 'tools-required' },
  { pattern: /\bcar\s+(?:required|needed)\b/i, tag: 'vehicle-needed' },
  { pattern: /\bbackground\s+check\b/i, tag: 'background-check' },
];

function extractTags(text) {
  const tags = [];
  for (const { pattern, tag } of TAG_PATTERNS) {
    if (pattern.test(text)) tags.push(tag);
  }
  return tags.length > 0 ? { tags, confidence: 0.7 } : null;
}

// ── Duration  ────────────────────────────────────────────────────

const DURATION_RE = /\b(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/i;
const MINUTES_RE = /\b(\d+)\s*(?:minutes?|mins?|m)\b/i;

function extractDuration(text) {
  const hMatch = text.match(DURATION_RE);
  if (hMatch) {
    return { estimated_duration: parseFloat(hMatch[1]), confidence: 0.85 };
  }
  const mMatch = text.match(MINUTES_RE);
  if (mMatch) {
    return { estimated_duration: parseInt(mMatch[1]) / 60, confidence: 0.8 };
  }
  return null;
}

// ── Main Parser ──────────────────────────────────────────────────

/**
 * Parse a free-text task description and extract structured fields.
 * Returns a partial task draft with per-field confidence scores.
 *
 * @param {string} text — Raw user input
 * @returns {{ fields: object, fieldConfidence: object }}
 */
function parseTaskText(text) {
  if (!text || typeof text !== 'string') {
    return { fields: {}, fieldConfidence: {} };
  }

  const trimmed = text.trim();
  const fields = {};
  const fieldConfidence = {};

  // Budget / pay
  const budget = extractBudget(trimmed);
  if (budget) {
    fields.pay_type = budget.pay_type;
    fieldConfidence.pay_type = budget.confidence;
    if (budget.budget_fixed != null) {
      fields.budget_fixed = budget.budget_fixed;
      fieldConfidence.budget_fixed = budget.confidence;
    }
    if (budget.hourly_rate != null) {
      fields.hourly_rate = budget.hourly_rate;
      fieldConfidence.hourly_rate = budget.confidence;
    }
  }

  // Schedule
  const schedule = extractSchedule(trimmed);
  if (schedule) {
    fields.schedule_type = schedule.schedule_type;
    fieldConfidence.schedule_type = schedule.confidence;
    if (schedule.time_window_start) {
      fields.time_window_start = schedule.time_window_start;
      fieldConfidence.time_window_start = schedule.confidence;
    }
  }

  // Location
  const location = extractLocation(trimmed);
  if (location) {
    fields.location_mode = location.location_mode;
    fieldConfidence.location_mode = location.confidence;
  }

  // Category
  const category = extractCategory(trimmed);
  if (category) {
    fields.category = category.category;
    fieldConfidence.category = category.confidence;
  }

  // Urgency
  const urgency = extractUrgency(trimmed);
  if (urgency) {
    fields.is_urgent = urgency.is_urgent;
    fieldConfidence.is_urgent = urgency.confidence;
  }

  // Tags
  const tags = extractTags(trimmed);
  if (tags) {
    fields.tags = tags.tags;
    fieldConfidence.tags = tags.confidence;
  }

  // Duration
  const duration = extractDuration(trimmed);
  if (duration) {
    fields.estimated_duration = duration.estimated_duration;
    fieldConfidence.estimated_duration = duration.confidence;
  }

  // Generate a basic title from first 8 words if no AI is available
  const words = trimmed.split(/\s+/);
  fields._basicTitle = words.slice(0, 8).join(' ');
  if (fields._basicTitle.length > 60) {
    fields._basicTitle = fields._basicTitle.substring(0, 57) + '...';
  }

  return { fields, fieldConfidence };
}

module.exports = { parseTaskText };
