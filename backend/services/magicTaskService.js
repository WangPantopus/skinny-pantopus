/**
 * Magic Task AI Service
 * =====================
 * Hybrid pipeline: deterministic parser → LLM structured extraction → validation.
 *
 * The pipeline:
 * 1. Deterministic parser runs instantly (regex-based budget, time, location, category)
 * 2. LLM refines: generates a polished title + description, fills remaining fields
 * 3. Validation layer clamps budget, enforces enums, sets defaults
 *
 * Confidence scoring:
 *   high   (≥ 0.8) — auto-fill, allow instant post
 *   medium (0.5–0.79) — show preview with highlighted "Confirm this" chip
 *   low    (< 0.5) — ask one clarifying question
 */
const { getOpenAIClient } = require('../config/openai');
const { parseTaskText } = require('./taskParser');
const logger = require('../utils/logger');

// ── GIG_CATEGORIES must match backend validation + frontend constants ──
const VALID_CATEGORIES = [
  // Original browse categories
  'Handyman', 'Cleaning', 'Moving', 'Pet Care', 'Child Care',
  'Tutoring', 'Photography', 'Cooking', 'Delivery', 'Tech Support',
  'Gardening', 'Event Help', 'Other',
  // Pro-service categories
  'Plumbing', 'Electrical', 'HVAC', 'Roofing', 'General Contractor',
  'Landscaping Pro', 'Home Inspector', 'Painting Pro', 'Flooring',
  // Delivery/errand categories
  'Errands', 'Grocery Pickup',
];

const VALID_PAY_TYPES = ['fixed', 'hourly', 'offers'];
const VALID_SCHEDULE_TYPES = ['asap', 'today', 'scheduled', 'flexible'];
const VALID_LOCATION_MODES = ['home', 'current', 'address', 'map_pin'];
const VALID_PRIVACY_LEVELS = ['approx', 'exact_after_accept', 'exact_immediately'];
const VALID_ARCHETYPES = [
  'quick_help', 'delivery_errand', 'home_service', 'pro_service_quote',
  'care_task', 'event_shift', 'remote_task', 'recurring_service', 'general',
];

const PRO_CATEGORIES = [
  'Plumbing', 'Electrical', 'HVAC', 'Roofing', 'General Contractor',
  'Landscaping Pro', 'Home Inspector', 'Painting Pro', 'Flooring',
];

const DELIVERY_CATS = ['Delivery', 'Errands', 'Grocery Pickup'];

/**
 * Infer task archetype from category string.
 */
function inferArchetypeFromCategory(category) {
  if (!category) return 'quick_help';
  const lc = category.toLowerCase();
  if (DELIVERY_CATS.some(c => c.toLowerCase() === lc)) return 'delivery_errand';
  if (PRO_CATEGORIES.some(c => c.toLowerCase() === lc)) return 'pro_service_quote';
  if (lc === 'pet care' || lc === 'child care') return 'care_task';
  if (lc === 'event help') return 'event_shift';
  if (lc === 'cleaning' || lc === 'handyman' || lc === 'gardening') return 'home_service';
  return 'quick_help';
}

/**
 * Text-based archetype inference for cases where category alone is insufficient.
 * Returns an archetype string or null if no strong signal found.
 */
function inferArchetypeFromText(text) {
  if (!text) return null;
  const lc = text.toLowerCase();
  if (/\b(plumb(?:er|ing)|electric(?:ian|al)|hvac|roof(?:er|ing)|contractor|inspector|licensed|insured|quote|estimate)\b/.test(lc)) return 'pro_service_quote';
  if (/\b(babysit(?:ter|ting)?|nanny|child\s*care|elder\s*care|pet\s*sit(?:ter|ting)?|daycare|caregiver)\b/.test(lc)) return 'care_task';
  if (/\b(party|event|setup\s+help|cleanup\s+crew|bartend|booth|staffing)\b/.test(lc)) return 'event_shift';
  if (/\b(resume|design|edit(?:ing)?|flyer|logo|translat|online|remote|virtual|freelance)\b/.test(lc)) return 'remote_task';
  if (/\b(weekly|recurring|every\s+(?:day|week|month)|bi-weekly|daily|monthly)\b/.test(lc)) return 'recurring_service';
  if (/\b(pick\s*up|drop\s*off|deliver(?:y)?|errand|grocer(?:y|ies)|fetch|courier)\b/.test(lc)) return 'delivery_errand';
  return null;
}

// ── LLM system prompt ──────────────────────────────────────────

const SYSTEM_PROMPT = `You are Pantopus, a local task assistant. A user describes a task in plain language; your job is to turn that into a polished, posting-ready structured task with a SPECIFIC price range and time estimate — even when the user omits both.

IMPORTANT OUTPUT RULES
- Return ONLY valid JSON (no prose, no markdown).
- ALWAYS populate budget_range with realistic min/max numbers (US market, local helpers).
- ALWAYS populate estimated_hours with a realistic decimal number (e.g. 0.25, 0.5, 1, 2.5).
- ALWAYS write a description of 2–3 complete sentences that captures the specifics the user mentioned (locations, items, counts, constraints). Don't just echo the user's message — make it sound like a helpful local task listing.
- Title should be a concrete, scannable headline (≤ 60 chars). Prefer "<verb> <object> <where/when>" shape (e.g. "Amazon locker pickup: Portland to Camas", "Help moving a couch this afternoon").

MULTI-DAY / SPAN / RECURRING TASKS
When the user describes a task that spans multiple days/weeks/months (e.g. "for a day", "for 2 weeks", "for a month", "every day this week", "Mon through Fri"):
- Use time_window_start and time_window_end to describe the SPAN (ISO datetimes). If no explicit start is given, assume the span starts at the nearest sensible boundary (tomorrow 9am local, next Monday, etc.).
- Set estimated_hours to the PER-SESSION on-task time for the helper — NOT the total calendar duration. A daily 30-min dog walk is 0.5, not 14. Housesitting (mostly presence) is typically 1.0 per day check-in. A tutor session is usually 1.0–2.0.
- Set task_archetype to "recurring_service" when the task repeats (daily/weekly pattern), or to the nearest fit (e.g. "care_task" for multi-day childcare, "home_service" for multi-day projects) otherwise.
- NEVER output absurd estimated_hours like 168, 336, 720 — those just confuse helpers. If the task is truly one continuous stretch (e.g. "paint the house, takes a month"), cap estimated_hours at a reasonable per-visit figure (e.g. 8) and rely on time_window_start/end to convey the span.
- Set schedule_type to "scheduled" when a specific start is given, "flexible" when the user says "anytime this week/month", and "today"/"asap" only when the task is same-day.

JSON SCHEMA
{
  "title": string (≤ 60 chars, concrete headline),
  "description": string (2–3 sentences, specific, helpful to a helper scanning the feed),
  "category": one of: Handyman, Cleaning, Moving, Pet Care, Child Care, Tutoring, Photography, Cooking, Delivery, Tech Support, Gardening, Event Help, Plumbing, Electrical, HVAC, Roofing, General Contractor, Landscaping Pro, Home Inspector, Painting Pro, Flooring, Errands, Grocery Pickup, Other,
  "tags": string[] (up to 3 short tags, lowercase),
  "pay_type": "fixed" | "hourly" | "offers",
  "budget_fixed": number | null (only if pay_type = "fixed"),
  "budget_range": { "min": number, "max": number } (REQUIRED — your suggested range in USD),
  "hourly_rate": number | null (only if pay_type = "hourly"),
  "estimated_hours": number (REQUIRED, decimal hours; total time on-task for the helper),
  "schedule_type": "asap" | "today" | "scheduled" | "flexible",
  "time_window_start": ISO datetime string | null,
  "time_window_end": ISO datetime string | null,
  "location_mode": "home" | "current" | "address" | "map_pin",
  "location_text": string | null (any specific address/place the user named),
  "privacy_level": "approx" | "exact_after_accept" | "exact_immediately",
  "attachments_suggested": boolean,
  "task_archetype": "quick_help" | "delivery_errand" | "home_service" | "pro_service_quote" | "care_task" | "event_shift" | "remote_task" | "recurring_service" | "general",
  "is_urgent": boolean,

  // Module-specific (include ONLY when the matching archetype applies):
  // delivery_errand:
  "pickup_location_text": string | null,
  "dropoff_location_text": string | null,
  "delivery_items": string[],
  // pro_service_quote:
  "requires_license": boolean,
  "scope_description": string | null,
  // care_task:
  "care_type": "child" | "pet" | "elder" | "other" | null,
  "care_details_text": string | null,
  "care_count": number | null,
  // event_shift:
  "event_type": "party" | "wedding" | "corporate" | "community" | "other" | null,
  "guest_count": number | null,
  "shift_hours": number | null,
  // remote_task:
  "deliverable_type": "document" | "design" | "code" | "video" | "other" | null,
  "file_format": string | null,

  "confidence": number (0.0–1.0; be conservative),
  "field_confidence": { "title": number, "description": number, "category": number, "pay_type": number, "schedule_type": number, "location_mode": number },
  "missing_fields": string[],
  "clarifying_question": null | { "field": string, "question": string, "options": string[] }
}

PRICING GUIDANCE (US neighborhood rates, 2024–2026)
- Quick errand / package pickup within ~5 mi: $15–$30, 0.5–1 hr.
- Delivery 5–15 mi: $20–$45, 0.75–1.5 hr.
- Delivery 15–30 mi (incl. cross-town, cross-river): $30–$70, 1–2 hr.
- Grocery pickup & delivery: $20–$45 (not counting groceries), 1–1.5 hr.
- Dog walk (30 min): $15–$25; dog sit (per visit): $20–$40.
- Babysitting: $20–$30/hr (hourly).
- Elder care / companion visit (1–2 hr): $25–$40/hr.
- Light handyman (TV mount, shelf, faucet swap): $40–$120, 1–2 hr.
- Moving help (2 movers, local, 1–3 hr): $80–$200 total.
- Yard cleanup (small yard): $40–$120, 1–3 hr.
- House cleaning (1BR/1BA): $60–$120; (3BR/2BA): $120–$250. Hourly $30–$50/hr.
- Tutoring: $20–$50/hr.
- Licensed trades (plumber, electrician, HVAC, roofer) — use "quotes"/pay_type=offers and budget_range of $100–$400 for diagnostic/small jobs; larger = $300–$2000. Set requires_license=true.
- IKEA assembly per item: $40–$100; whole-room set: $120–$300.
- Event setup/bartender shift (3–5 hr): $120–$300 total or $25–$45/hr.
- Photography (1–2 hr session): $120–$300.

PAY TYPE RULES
- If the user names a dollar amount → pay_type="fixed", budget_fixed = that amount.
- If the user says "per hour" or the task is open-ended (tutoring, babysitting, hourly cleaning, elder care) → pay_type="hourly", hourly_rate = midpoint of typical range.
- Otherwise → pay_type="offers" (helpers will bid). Still provide budget_range so the user has a sensible suggested price.

SCHEDULE RULES
- Words like "now / right now / ASAP / urgent / immediately" → schedule_type="asap", is_urgent=true.
- "today / this morning / this afternoon / tonight" → schedule_type="today".
- A specific date, day-of-week, or time → schedule_type="scheduled", plus time_window_start (ISO) if possible.
- "sometime / whenever / flexible / this week" → schedule_type="flexible".

LOCATION RULES
- "at home / my place / my house / my apartment" → location_mode="home".
- "I'm at X / near X / at the park" → location_mode="current".
- A specific third-party address → location_mode="address", location_text = the address.
- Delivery tasks: fill pickup_location_text and dropoff_location_text with the best phrases from the user's message, and put the route in the description.

FEW-SHOT EXAMPLES

Example 1 — user: "Need someone to help me pickup an Amazon order from an Amazon locker in Portland to Camas."
Output:
{
  "title": "Amazon locker pickup: Portland to Camas",
  "description": "Pick up a package from an Amazon locker in Portland and drop it at an address in Camas, WA. The helper will need the locker pickup code and a vehicle for the ~20-mile cross-river trip.",
  "category": "Delivery",
  "tags": ["pickup", "delivery", "amazon"],
  "pay_type": "offers",
  "budget_fixed": null,
  "budget_range": { "min": 25, "max": 55 },
  "hourly_rate": null,
  "estimated_hours": 1.25,
  "schedule_type": "asap",
  "time_window_start": null,
  "time_window_end": null,
  "location_mode": "address",
  "location_text": "Portland, OR → Camas, WA",
  "privacy_level": "exact_after_accept",
  "attachments_suggested": false,
  "task_archetype": "delivery_errand",
  "is_urgent": false,
  "pickup_location_text": "Amazon locker in Portland",
  "dropoff_location_text": "Camas",
  "delivery_items": ["Amazon package"],
  "confidence": 0.82,
  "field_confidence": { "title": 0.9, "description": 0.85, "category": 0.95, "pay_type": 0.8, "schedule_type": 0.7, "location_mode": 0.8 },
  "missing_fields": ["budget_fixed", "time_window_start"],
  "clarifying_question": null
}

Example 2 — user: "Dog walker for Maya (golden retriever) Mon/Wed/Fri afternoons"
Output:
{
  "title": "Dog walker for golden retriever — MWF afternoons",
  "description": "Looking for a friendly dog walker for Maya, a golden retriever, on Monday, Wednesday, and Friday afternoons. Walks should be about 30 minutes around the neighborhood. Consistency matters so we'd love someone who can commit to the full week.",
  "category": "Pet Care",
  "tags": ["dog-walking", "recurring", "afternoons"],
  "pay_type": "hourly",
  "budget_fixed": null,
  "budget_range": { "min": 18, "max": 28 },
  "hourly_rate": 22,
  "estimated_hours": 0.5,
  "schedule_type": "flexible",
  "time_window_start": null,
  "time_window_end": null,
  "location_mode": "home",
  "location_text": null,
  "privacy_level": "exact_after_accept",
  "attachments_suggested": false,
  "task_archetype": "recurring_service",
  "is_urgent": false,
  "care_type": "pet",
  "care_details_text": "Maya, golden retriever; 30-min neighborhood walks",
  "care_count": 1,
  "confidence": 0.84,
  "field_confidence": { "title": 0.9, "description": 0.85, "category": 0.98, "pay_type": 0.85, "schedule_type": 0.8, "location_mode": 0.85 },
  "missing_fields": [],
  "clarifying_question": null
}

Example 3 — user: "need a housesitter for 2 weeks starting Monday, just checking mail and watering plants"
Output:
{
  "title": "Housesitter needed — 2 weeks",
  "description": "Looking for a reliable neighbor to check on the house for two weeks starting Monday. Daily tasks are light: bring in mail, water indoor plants, and do a quick walk-through. Ideal for someone nearby who can swing by briefly each day.",
  "category": "Other",
  "tags": ["housesitting", "recurring", "mail"],
  "pay_type": "offers",
  "budget_fixed": null,
  "budget_range": { "min": 140, "max": 280 },
  "hourly_rate": null,
  "estimated_hours": 0.5,
  "schedule_type": "scheduled",
  "time_window_start": "<next Monday 09:00 local>",
  "time_window_end": "<Monday + 14 days, 18:00 local>",
  "location_mode": "home",
  "location_text": null,
  "privacy_level": "exact_after_accept",
  "attachments_suggested": false,
  "task_archetype": "recurring_service",
  "is_urgent": false,
  "confidence": 0.8,
  "field_confidence": { "title": 0.9, "description": 0.85, "category": 0.7, "pay_type": 0.75, "schedule_type": 0.9, "location_mode": 0.9 },
  "missing_fields": ["budget_fixed"],
  "clarifying_question": null
}

Example 4 — user: "kitchen faucet leaking, need a plumber this week, budget around 200"
Output:
{
  "title": "Fix leaking kitchen faucet",
  "description": "Kitchen faucet is leaking and needs a licensed plumber for diagnosis and repair this week. Budget is around $200 for the visit and small parts; let me know if scope grows.",
  "category": "Plumbing",
  "tags": ["leak", "faucet", "licensed"],
  "pay_type": "fixed",
  "budget_fixed": 200,
  "budget_range": { "min": 150, "max": 350 },
  "hourly_rate": null,
  "estimated_hours": 1.5,
  "schedule_type": "flexible",
  "time_window_start": null,
  "time_window_end": null,
  "location_mode": "home",
  "location_text": null,
  "privacy_level": "exact_after_accept",
  "attachments_suggested": true,
  "task_archetype": "pro_service_quote",
  "is_urgent": false,
  "requires_license": true,
  "scope_description": "Diagnose and repair a leaking kitchen faucet; likely cartridge/seal replacement.",
  "confidence": 0.88,
  "field_confidence": { "title": 0.95, "description": 0.9, "category": 0.95, "pay_type": 0.9, "schedule_type": 0.8, "location_mode": 0.9 },
  "missing_fields": [],
  "clarifying_question": null
}

FINAL REMINDERS
- Only one clarifying_question allowed, and only if a critical field (time or budget) truly cannot be inferred.
- Be conservative with overall confidence; only ≥ 0.8 when you're clearly sure.
- Don't invent facts the user didn't give (no made-up addresses, names, or prices stated as facts — use budget_range for suggested prices).
- Module-specific fields: ONLY include the object for the matching archetype.`;

// ── LLM extraction ──────────────────────────────────────────────

const AI_TIMEOUT_MS = Number(process.env.MAGIC_TASK_AI_TIMEOUT_MS) || 10_000; // 10s default
const AI_MODEL = process.env.MAGIC_TASK_AI_MODEL || 'gpt-4o';
const AI_TEMPERATURE = process.env.MAGIC_TASK_AI_TEMPERATURE != null
  ? Number(process.env.MAGIC_TASK_AI_TEMPERATURE)
  : 0.4;
const AI_MAX_TOKENS = Number(process.env.MAGIC_TASK_AI_MAX_TOKENS) || 1500;

/**
 * Call OpenAI to extract structured task fields from user text.
 * @param {string} userText — Raw user input
 * @param {object} deterministicFields — Fields already extracted by parser
 * @returns {Promise<object|null>} — Structured task draft or null on failure
 */
async function llmExtract(userText, deterministicFields = {}, context = {}) {
  const openai = getOpenAIClient();
  if (!openai) return null;

  try {
    const contextHints = [];
    if (deterministicFields.pay_type) {
      contextHints.push(`Deterministic parser already found pay_type="${deterministicFields.pay_type}"${deterministicFields.budget_fixed ? `, budget=$${deterministicFields.budget_fixed}` : ''}`);
    }
    if (context.budget) {
      contextHints.push(`User indicated a budget of $${context.budget}`);
    }
    if (deterministicFields.schedule_type) {
      contextHints.push(`Deterministic parser found schedule_type="${deterministicFields.schedule_type}"`);
    }
    if (deterministicFields.category) {
      contextHints.push(`Deterministic parser found category="${deterministicFields.category}"`);
    }

    const userMessage = contextHints.length > 0
      ? `User message: "${userText}"\n\nHints from deterministic parser:\n${contextHints.join('\n')}`
      : `User message: "${userText}"`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      response_format: { type: 'json_object' },
      temperature: AI_TEMPERATURE,
      max_tokens: AI_MAX_TOKENS,
    }, { signal: controller.signal });

    clearTimeout(timeout);

    const content = completion.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content);
    return parsed;
  } catch (err) {
    if (err.name === 'AbortError') {
      logger.warn('Magic Task AI timed out', { timeout: AI_TIMEOUT_MS });
    } else {
      logger.error('Magic Task AI error', { error: err.message });
    }
    return null;
  }
}

// ── Validation + Defaults ───────────────────────────────────────

function clampBudget(val) {
  if (val == null) return null;
  const num = parseFloat(val);
  if (isNaN(num) || num < 0) return null;
  return Math.min(num, 10000); // Cap at $10K
}

function validateAndDefault(draft) {
  const validated = { ...draft };

  // Task archetype
  if (!validated.task_archetype || !VALID_ARCHETYPES.includes(validated.task_archetype)) {
    // Try text-based inference first (more granular), then fall back to category-based
    validated.task_archetype =
      inferArchetypeFromText(validated._rawText) ||
      inferArchetypeFromCategory(validated.category);
  }

  // Category
  if (validated.category && !VALID_CATEGORIES.includes(validated.category)) {
    validated.category = 'Other';
  }
  if (!validated.category) validated.category = 'Other';

  // Pay type
  if (!VALID_PAY_TYPES.includes(validated.pay_type)) {
    validated.pay_type = 'offers';
  }

  // Budget clamping
  validated.budget_fixed = clampBudget(validated.budget_fixed);
  validated.hourly_rate = clampBudget(validated.hourly_rate);

  // Budget range validation
  if (validated.budget_range && typeof validated.budget_range === 'object') {
    const min = clampBudget(validated.budget_range.min);
    const max = clampBudget(validated.budget_range.max);
    if (min != null && max != null && min <= max) {
      validated.budget_range = { min, max };
    } else {
      validated.budget_range = null;
    }
  } else {
    validated.budget_range = null;
  }

  // Schedule type
  if (!VALID_SCHEDULE_TYPES.includes(validated.schedule_type)) {
    validated.schedule_type = 'asap';
  }

  // Location mode
  if (!VALID_LOCATION_MODES.includes(validated.location_mode)) {
    validated.location_mode = 'home';
  }

  // Privacy level
  if (!VALID_PRIVACY_LEVELS.includes(validated.privacy_level)) {
    validated.privacy_level = 'exact_after_accept';
  }

  // Tags
  if (!Array.isArray(validated.tags)) validated.tags = [];
  validated.tags = validated.tags.slice(0, 5);

  // Title safety
  if (!validated.title || validated.title.length < 3) {
    validated.title = 'Task request';
  }
  if (validated.title.length > 255) {
    validated.title = validated.title.substring(0, 252) + '...';
  }

  // Description safety
  if (!validated.description || validated.description.length < 5) {
    validated.description = draft._rawText || 'Help needed';
  }

  // Defaults
  if (validated.is_urgent == null) validated.is_urgent = false;
  if (validated.attachments_suggested == null) validated.attachments_suggested = false;

  // ── Normalize module-specific AI suggestions into structured module data ──

  // Delivery module suggestions
  if (validated.task_archetype === 'delivery_errand') {
    if (!validated.pickup_address && validated.pickup_location_text) {
      validated.pickup_address = validated.pickup_location_text;
    }
    if (!validated.dropoff_address && validated.dropoff_location_text) {
      validated.dropoff_address = validated.dropoff_location_text;
    }
    if (!validated.items && Array.isArray(validated.delivery_items) && validated.delivery_items.length > 0) {
      validated.items = validated.delivery_items.map(item =>
        typeof item === 'string' ? { name: item, quantity: 1 } : item
      );
    }
  }

  // Pro service module suggestions
  if (validated.task_archetype === 'pro_service_quote') {
    if (validated.requires_license == null) validated.requires_license = false;
    if (!validated.scope_description && validated.scope_description !== '') {
      validated.scope_description = null;
    }
  }

  // Care module suggestions → care_details JSONB
  if (validated.task_archetype === 'care_task' && (validated.care_type || validated.care_details_text || validated.care_count)) {
    if (!validated.care_details) {
      const VALID_CARE_TYPES = ['child', 'pet', 'elder', 'other'];
      validated.care_details = {
        careType: VALID_CARE_TYPES.includes(validated.care_type) ? validated.care_type : 'other',
        agesOrDetails: validated.care_details_text || '',
        count: typeof validated.care_count === 'number' && validated.care_count > 0 ? validated.care_count : 1,
      };
    }
  }

  // Event module suggestions → event_details JSONB
  if (validated.task_archetype === 'event_shift' && (validated.event_type || validated.guest_count || validated.shift_hours)) {
    if (!validated.event_details) {
      const VALID_EVENT_TYPES = ['party', 'wedding', 'corporate', 'community', 'other'];
      validated.event_details = {
        eventType: VALID_EVENT_TYPES.includes(validated.event_type) ? validated.event_type : 'other',
        guestCount: typeof validated.guest_count === 'number' ? validated.guest_count : null,
      };
      if (typeof validated.shift_hours === 'number' && validated.shift_hours > 0) {
        validated.estimated_hours = validated.shift_hours;
      }
    }
  }

  // Remote module suggestions → remote_details JSONB
  if (validated.task_archetype === 'remote_task' && (validated.deliverable_type || validated.file_format)) {
    if (!validated.remote_details) {
      const VALID_DELIVERABLE_TYPES = ['document', 'design', 'code', 'video', 'other'];
      validated.remote_details = {
        deliverableType: VALID_DELIVERABLE_TYPES.includes(validated.deliverable_type) ? validated.deliverable_type : 'other',
        fileFormat: validated.file_format || '',
      };
    }
  }

  // Clean up intermediate AI fields (not stored in DB directly)
  delete validated.pickup_location_text;
  delete validated.dropoff_location_text;
  delete validated.delivery_items;
  delete validated.care_type;
  delete validated.care_details_text;
  delete validated.care_count;
  delete validated.event_type;
  delete validated.guest_count;
  delete validated.shift_hours;
  delete validated.deliverable_type;
  delete validated.file_format;

  return validated;
}

// ── Confidence calculation ──────────────────────────────────────

function computeOverallConfidence(fieldConfidence) {
  const criticalFields = ['title', 'description', 'category', 'schedule_type'];
  const importantFields = ['pay_type', 'location_mode'];

  let total = 0;
  let weights = 0;

  for (const f of criticalFields) {
    const conf = fieldConfidence[f] || 0.3;
    total += conf * 2; // Critical fields weighted 2x
    weights += 2;
  }
  for (const f of importantFields) {
    const conf = fieldConfidence[f] || 0.3;
    total += conf;
    weights += 1;
  }

  return Math.round((total / weights) * 100) / 100;
}

// ── Public API ──────────────────────────────────────────────────

/**
 * Generate a structured task draft from free-text input.
 *
 * @param {string} text — Raw user input (typed or dictated)
 * @param {object} context — Optional context hints
 * @param {string} [context.homeId] — User's home ID (for location_mode=home)
 * @param {object} [context.location] — Pre-locked location { lat, lng }
 * @param {string} [context.locationMode] — Pre-locked location mode
 * @returns {Promise<object>} — { draft, confidence, fieldConfidence, clarifyingQuestion, source }
 */
async function generateMagicDraft(text, context = {}) {
  const startTime = Date.now();

  // Step 1: Deterministic parser (instant)
  const { fields: deterministicFields, fieldConfidence: detConfidence } = parseTaskText(text);

  logger.info('Magic Task deterministic parse', {
    fieldsFound: Object.keys(deterministicFields).length,
    fields: Object.keys(deterministicFields),
  });

  // Step 2: LLM extraction (async, with timeout)
  let aiResult = null;
  let source = 'deterministic';

  try {
    aiResult = await llmExtract(text, deterministicFields, context);
    if (aiResult) source = 'ai';
  } catch (err) {
    logger.warn('Magic Task AI extraction failed, using deterministic only', { error: err.message });
  }

  // Step 3: Merge — AI takes priority, deterministic fills gaps
  const merged = {};

  if (aiResult) {
    // Use AI results as base
    Object.assign(merged, {
      title: aiResult.title,
      description: aiResult.description,
      category: aiResult.category,
      tags: aiResult.tags,
      pay_type: aiResult.pay_type,
      budget_fixed: aiResult.budget_fixed,
      budget_range: aiResult.budget_range || null,
      hourly_rate: aiResult.hourly_rate,
      estimated_hours: aiResult.estimated_hours,
      schedule_type: aiResult.schedule_type,
      time_window_start: aiResult.time_window_start,
      time_window_end: aiResult.time_window_end,
      location_mode: aiResult.location_mode,
      location_text: aiResult.location_text,
      privacy_level: aiResult.privacy_level,
      attachments_suggested: aiResult.attachments_suggested,
      is_urgent: aiResult.is_urgent,
      task_archetype: aiResult.task_archetype,
      // Module-specific fields (AI suggestions)
      pickup_location_text: aiResult.pickup_location_text || null,
      dropoff_location_text: aiResult.dropoff_location_text || null,
      delivery_items: aiResult.delivery_items || null,
      requires_license: aiResult.requires_license || false,
      scope_description: aiResult.scope_description || null,
      care_type: aiResult.care_type || null,
      care_details_text: aiResult.care_details_text || null,
      care_count: aiResult.care_count || null,
      event_type: aiResult.event_type || null,
      guest_count: aiResult.guest_count || null,
      shift_hours: aiResult.shift_hours || null,
      deliverable_type: aiResult.deliverable_type || null,
      file_format: aiResult.file_format || null,
    });
  }

  // Fill gaps with deterministic results
  if (!merged.pay_type && deterministicFields.pay_type) {
    merged.pay_type = deterministicFields.pay_type;
  }
  if (merged.budget_fixed == null && deterministicFields.budget_fixed != null) {
    merged.budget_fixed = deterministicFields.budget_fixed;
  }
  if (merged.hourly_rate == null && deterministicFields.hourly_rate != null) {
    merged.hourly_rate = deterministicFields.hourly_rate;
  }
  if (!merged.schedule_type && deterministicFields.schedule_type) {
    merged.schedule_type = deterministicFields.schedule_type;
  }
  if (!merged.location_mode && deterministicFields.location_mode) {
    merged.location_mode = deterministicFields.location_mode;
  }
  if (!merged.category && deterministicFields.category) {
    merged.category = deterministicFields.category;
  }
  if (!merged.is_urgent && deterministicFields.is_urgent) {
    merged.is_urgent = deterministicFields.is_urgent;
  }
  if ((!merged.tags || merged.tags.length === 0) && deterministicFields.tags) {
    merged.tags = deterministicFields.tags;
  }
  if (merged.estimated_hours == null && deterministicFields.estimated_duration != null) {
    merged.estimated_hours = deterministicFields.estimated_duration;
  }

  // Fallback title from deterministic parser
  if (!merged.title && deterministicFields._basicTitle) {
    merged.title = deterministicFields._basicTitle;
  }

  // Apply user-provided budget from context
  if (context.budget != null && context.budget > 0) {
    merged.budget_fixed = context.budget;
    merged.pay_type = 'fixed';
  }

  // Apply context overrides
  if (context.locationMode) {
    merged.location_mode = context.locationMode;
  }

  // Store raw text for fallback
  merged._rawText = text;

  // Step 4: Validate and apply defaults
  const draft = validateAndDefault(merged);

  // Step 5: Compute confidence
  const fieldConfidence = {};
  if (aiResult?.field_confidence) {
    Object.assign(fieldConfidence, aiResult.field_confidence);
  }
  // Override with deterministic confidence where it's higher
  for (const [key, val] of Object.entries(detConfidence)) {
    if (!fieldConfidence[key] || val > fieldConfidence[key]) {
      fieldConfidence[key] = val;
    }
  }

  const confidence = aiResult?.confidence
    ? Math.round(aiResult.confidence * 100) / 100
    : computeOverallConfidence(fieldConfidence);

  // Step 6: Determine clarifying question (if any)
  let clarifyingQuestion = null;
  if (aiResult?.clarifying_question) {
    clarifyingQuestion = aiResult.clarifying_question;
  } else if (confidence < 0.5) {
    // Generate a basic clarifying question for the least-confident critical field
    if (!fieldConfidence.schedule_type || fieldConfidence.schedule_type < 0.5) {
      clarifyingQuestion = {
        field: 'schedule_type',
        question: 'When do you need this done?',
        options: ['ASAP', 'Today', 'Pick a time', 'Flexible'],
      };
    } else if (!fieldConfidence.pay_type || fieldConfidence.pay_type < 0.5) {
      clarifyingQuestion = {
        field: 'pay_type',
        question: 'How would you like to pay?',
        options: ['Set a price', 'Hourly rate', 'Open to offers'],
      };
    }
  }

  const elapsed = Date.now() - startTime;
  logger.info('Magic Task draft generated', { source, confidence, elapsed, fieldsSet: Object.keys(draft).length });

  return {
    draft,
    confidence,
    fieldConfidence,
    clarifyingQuestion,
    source,
    elapsed,
  };
}

/**
 * Build a "basic" draft when the user chooses to post without AI.
 * Uses only deterministic parsing.
 */
function generateBasicDraft(text, context = {}) {
  const { fields, fieldConfidence } = parseTaskText(text);

  const words = text.trim().split(/\s+/);
  const title = words.slice(0, 8).join(' ') || 'Task request';

  const draft = validateAndDefault({
    title: title.length > 60 ? title.substring(0, 57) + '...' : title,
    description: text.trim(),
    category: fields.category || 'Other',
    tags: fields.tags || [],
    pay_type: fields.pay_type || 'offers',
    budget_fixed: fields.budget_fixed || null,
    hourly_rate: fields.hourly_rate || null,
    schedule_type: fields.schedule_type || 'asap',
    location_mode: context.locationMode || fields.location_mode || 'home',
    privacy_level: 'exact_after_accept',
    is_urgent: fields.is_urgent || false,
    _rawText: text,
  });

  return {
    draft,
    confidence: computeOverallConfidence(fieldConfidence),
    fieldConfidence,
    clarifyingQuestion: null,
    source: 'basic',
    elapsed: 0,
  };
}

module.exports = {
  generateMagicDraft,
  generateBasicDraft,
  VALID_CATEGORIES,
};
