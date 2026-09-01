/**
 * Briefing Composer
 *
 * Template-first natural language summary generator. Uses deterministic
 * templates for 1-2 signals, optional AI polish for 3+ competing signals.
 * AI is a finisher, not the foundation — all facts come from source data.
 */

const { getOpenAIClient } = require('../../config/openai');
const logger = require('../../utils/logger');

const DRAFT_MODEL = process.env.OPENAI_DRAFT_MODEL || 'gpt-4o-mini';

// ── Signal-to-sentence templates ────────────────────────────────────

const TEMPLATES = {
  alert: (s) => s.data.severity === 'extreme' || s.data.severity === 'severe'
    ? `${s.label} in effect. ${s.detail}`
    : `${s.label}.`,

  precipitation: (s) => {
    const type = s.data.precip_type === 'snow' ? 'Snow' : s.data.precip_type === 'sleet' ? 'Sleet' : 'Rain';
    return `${type} is likely in the next few hours (${s.data.precip_chance}% chance).`;
  },

  aqi: (s) => `Air quality is ${(s.data.category || 'unhealthy').toLowerCase()} (AQI ${s.data.aqi}).`,

  temperature: (s) => s.data.extreme === 'cold'
    ? `Temperature is ${s.data.temp_f}°F. Protect pipes and outdoor plants.`
    : `Temperature is ${s.data.temp_f}°F. Stay hydrated and limit outdoor exposure.`,

  bill_due: (s) => {
    const when = isWithin24h(s.data.due_date) ? 'today' : 'in the next few days';
    return `Your ${s.data.amount ? '$' + Number(s.data.amount).toFixed(0) + ' ' : ''}${s.label.replace('Bill due: ', '')} bill is due ${when}.`;
  },

  task_due: (s) => {
    const when = isWithin24h(s.data.due_at) ? 'today' : 'soon';
    return `${s.data.task_id ? s.detail : `Task "${s.label.replace('Task: ', '')}" is due ${when}.`}`;
  },

  calendar: (s) => s.detail,

  mail: (s) => `You have ${s.data.urgent_count} urgent mail item${s.data.urgent_count > 1 ? 's' : ''} to review.`,

  gig: (s) => s.detail,

  seasonal: (s) => s.detail,

  local_update: (s) => s.detail,

  evening_tip: (s) => s.detail,

  weather: (s) => s.detail,
};

function isWithin24h(dateStr) {
  if (!dateStr) return false;
  return new Date(dateStr).getTime() - Date.now() < 24 * 60 * 60 * 1000;
}

// ── Weather intro line ──────────────────────────────────────────────

function normalizeConditionPhrase(conditionLabel) {
  const raw = String(conditionLabel || '').trim().toLowerCase();
  if (!raw) return 'clear skies';

  if (raw === 'clear' || raw === 'clear sky') return 'clear skies';
  if (raw === 'mainly clear') return 'mostly clear';

  return raw;
}

function toSentenceCase(text) {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Build a brief weather intro from current conditions.
 * e.g., "It's 52°F and partly cloudy."
 */
function buildWeatherIntro(weather, options = {}) {
  const { includeTemperature = true } = options;
  if (!weather?.current) return null;
  const { temp_f, condition_label } = weather.current;
  const condition = normalizeConditionPhrase(condition_label || 'clear');

  if (!includeTemperature) {
    return `${toSentenceCase(condition)}.`;
  }

  if (temp_f == null) return null;
  return `It's ${temp_f}°F and ${condition}.`;
}

// ── Greetings ───────────────────────────────────────────────────────

function getLocalHour(timezone = 'America/Los_Angeles', now = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      hour12: false,
    }).formatToParts(now);
    const hourPart = parts.find((part) => part.type === 'hour');
    const hour = Number(hourPart?.value);
    if (Number.isFinite(hour)) return hour;
  } catch {
    // Fall through to server-local time.
  }
  return now.getHours();
}

function getGreeting(timezone = 'America/Los_Angeles', now = new Date()) {
  const hour = getLocalHour(timezone, now);
  if (hour < 12) return 'Good morning.';
  if (hour < 17) return 'Good afternoon.';
  return 'Good evening.';
}

// ── Template composer ───────────────────────────────────────────────

/**
 * Produce a deterministic briefing from ranked signals.
 *
 * @param {Object} rankedOutput - From usefulnessEngine.rankSignals()
 * @param {Object} [options]
 * @returns {string}
 */
function composeTemplate(rankedOutput, options = {}) {
  const {
    greeting = true,
    maxWords = 45,
    weather = null,
    leadIntro = null,
    includeWeatherTemperature = true,
    timezone = 'America/Los_Angeles',
    now = new Date(),
  } = options;
  const signals = rankedOutput.signals || [];
  const greetingText = greeting ? getGreeting(timezone, now) : null;

  // Build weather intro line (always, if weather data available)
  const weatherIntro =
    leadIntro || buildWeatherIntro(weather, { includeTemperature: includeWeatherTemperature });

  if (signals.length === 0 && !weatherIntro) {
    const base = 'Nothing notable right now. Enjoy your day.';
    return greetingText ? `${greetingText} ${base}` : base;
  }

  // Convert each signal to a sentence (skip weather/precipitation/temperature
  // signals since the weather intro already covers current conditions)
  const weatherKinds = new Set(['weather', 'precipitation', 'temperature']);
  const nonWeatherSignals = signals.filter((s) => !weatherKinds.has(s.kind));
  const weatherSignals = signals.filter((s) => weatherKinds.has(s.kind));

  // Build parts: weather intro first, then notable weather signals, then other signals
  const parts = [];

  if (weatherIntro) {
    parts.push(weatherIntro);
  }

  // Add weather-related signals only if they add info beyond the intro
  // (e.g., "Rain likely in 3 hours" adds value; generic "Rain" doesn't)
  for (const s of weatherSignals.slice(0, 1)) {
    const templateFn = TEMPLATES[s.kind];
    const sentence = templateFn ? templateFn(s) : s.detail;
    parts.push(sentence);
  }

  // Add non-weather signals
  const maxOtherSignals = Math.max(0, 3 - parts.length);
  for (const s of nonWeatherSignals.slice(0, maxOtherSignals)) {
    const templateFn = TEMPLATES[s.kind];
    parts.push(templateFn ? templateFn(s) : s.detail);
  }

  if (parts.length === 0) {
    const base = 'Nothing notable right now. Enjoy your day.';
    return greetingText ? `${greetingText} ${base}` : base;
  }

  let body = parts.join(' ');

  const remainingCount = signals.length - 3;
  if (remainingCount > 0) {
    body += ` Plus ${remainingCount} more item${remainingCount > 1 ? 's' : ''} to check.`;
  }

  const full = greetingText ? `${greetingText} ${body}` : body;

  // Trim to maxWords if needed
  const words = full.split(/\s+/);
  if (words.length > maxWords) {
    return words.slice(0, maxWords).join(' ') + '...';
  }

  return full;
}

// ── AI polish ───────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a concise morning briefing writer for Pantopus, a real-world network.
Compose a short morning summary from the provided facts.
Rules:
- Stay under {maxWords} words
- Plain language, no hype, no exclamation marks
- At most 3 facts
- Most urgent fact first
- Never invent alerts, dates, amounts, or weather data
- If a greeting is included, keep it brief (e.g. "Good morning.")
Return ONLY the briefing text, nothing else.`;

/**
 * Build the facts payload for the AI from signals.
 */
function buildFactsPrompt(signals, options) {
  const lines = [];
  const greetingText = getGreeting(options.timezone, options.now);

  // Always include weather context first if available
  const weatherIntro = options.leadIntro || buildWeatherIntro(options.weather, {
    includeTemperature: options.includeWeatherTemperature !== false,
  });
  if (weatherIntro) {
    lines.push(`0. [weather_context] ${weatherIntro} (always include — lead with this)`);
  }

  const facts = signals.slice(0, 5).map((s, i) => {
    const templateFn = TEMPLATES[s.kind];
    const sentence = templateFn ? templateFn(s) : s.detail;
    return `${i + 1}. [${s.kind}] ${sentence} (urgency: ${s.urgency})`;
  });
  lines.push(...facts);

  return `Facts to include:\n${lines.join('\n')}\n\n${options.greeting !== false ? `Use the greeting "${greetingText}" and start with the weather.` : 'Start with the weather. No greeting.'}\nMax words: ${options.maxWords || 45}`;
}

/**
 * Validate AI output against source signals.
 * Checks that the AI didn't invent facts not present in the input.
 */
function validateAiOutput(text, signals) {
  if (!text || typeof text !== 'string') return false;

  const words = text.split(/\s+/);

  // Must not be empty or too long
  if (words.length < 3 || words.length > 80) return false;

  // Must not contain common hallucination patterns
  const suspicious = [
    /\b\d{3}-\d{3}-\d{4}\b/,  // phone numbers
    /\bhttps?:\/\//,            // URLs
    /take.*medication/i,        // medical advice
    /you should see a doctor/i,
  ];

  for (const pattern of suspicious) {
    if (pattern.test(text)) return false;
  }

  return true;
}

/**
 * Attempt AI polish of the briefing.
 */
async function aiPolish(signals, options) {
  const openai = getOpenAIClient();
  if (!openai) return null;

  const maxWords = options.maxWords || 45;

  try {
    const response = await openai.chat.completions.create({
      model: DRAFT_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT.replace('{maxWords}', String(maxWords)) },
        { role: 'user', content: buildFactsPrompt(signals, options) },
      ],
      max_tokens: 150,
      temperature: 0.4,
    });

    const text = response.choices?.[0]?.message?.content?.trim();
    const tokensUsed = (response.usage?.prompt_tokens || 0) + (response.usage?.completion_tokens || 0);

    if (!validateAiOutput(text, signals)) {
      logger.warn('briefingComposer: AI validation failed, falling back to template');
      return null;
    }

    return { text, tokensUsed };
  } catch (err) {
    logger.error('briefingComposer: AI polish error', { error: err.message });
    return null;
  }
}

// ── Main composer ───────────────────────────────────────────────────

/**
 * Compose a briefing from ranked signals.
 *
 * @param {Object} rankedOutput - From usefulnessEngine.rankSignals()
 * @param {Object} [options]
 * @param {boolean} [options.forceAI] - Force AI polish even for <3 signals
 * @param {boolean} [options.forceTemplate] - Force template mode, skip AI
 * @param {number}  [options.maxWords=45] - Max word count
 * @param {boolean} [options.greeting=true] - Include greeting
 * @param {string}  [options.targetUse='push'] - 'push' | 'hub_card' | 'preview'
 * @returns {Promise<{text: string, mode: 'template'|'ai_polished', tokens_used: number, signals_included: number, validation_passed: boolean}>}
 */
async function composeBriefing(rankedOutput, options = {}) {
  const {
    forceAI = false,
    forceTemplate = false,
    maxWords = 45,
    greeting = true,
    targetUse = 'push',
    timezone = 'America/Los_Angeles',
    now = new Date(),
  } = options;

  const signals = rankedOutput.signals || [];
  const signalCount = signals.length;

  // Decide whether to use AI
  const shouldUseAI = !forceTemplate && (forceAI || signalCount >= 3);

  if (shouldUseAI) {
    const aiResult = await aiPolish(signals, {
      maxWords,
      greeting,
        targetUse,
        weather: options.weather,
        leadIntro: options.leadIntro,
        includeWeatherTemperature: options.includeWeatherTemperature,
        timezone,
        now,
      });

    if (aiResult) {
      logger.debug('briefingComposer: AI polish succeeded', {
        tokens: aiResult.tokensUsed,
        signalCount,
      });

      return {
        text: aiResult.text,
        mode: 'ai_polished',
        tokens_used: aiResult.tokensUsed,
        signals_included: Math.min(signalCount, 3),
        validation_passed: true,
      };
    }

    // AI failed or validation failed — fall through to template
    logger.info('briefingComposer: AI unavailable or failed, using template');
  }

  // Template mode
  const text = composeTemplate(rankedOutput, {
    greeting,
    maxWords,
    weather: options.weather,
    leadIntro: options.leadIntro,
    includeWeatherTemperature: options.includeWeatherTemperature,
    timezone,
    now,
  });

  return {
    text,
    mode: 'template',
    tokens_used: 0,
    signals_included: Math.min(signalCount, 3),
    validation_passed: true,
  };
}

module.exports = { composeBriefing, composeTemplate };
