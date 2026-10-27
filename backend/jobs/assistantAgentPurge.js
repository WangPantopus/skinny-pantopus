// ============================================================
// JOB: Assistant record purge
// The assistant's tool and push steps (AgentStep rows of type tool and
// notify) are kept 90 days (docs/product/ai-assistant-phase3-contract-
// 2026-10-22.md §3.6). This deletes older ones, then chat-turn requests
// older than 90 days that have no steps left. Cards (proposal steps) and
// the requests that hold them live as long as their conversation, which
// deletes them by cascade. A standing rule's runs (origin rule, with their
// action steps) are its history and are kept a year (§18.2). Runs daily.
// ============================================================

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');

const KEEP_MS = 90 * 24 * 60 * 60 * 1000;
const RULE_RUNS_KEEP_MS = 365 * 24 * 60 * 60 * 1000;
const BATCH = 500;
// A day's run stops here; the next run picks up the rest.
const MAX_BATCHES = 40;

async function purgeSteps(cutoff) {
  let removed = 0;
  for (let batch = 0; batch < MAX_BATCHES; batch++) {
    // Rule runs' action steps go with their runs, after a year.
    const { data, error } = await supabaseAdmin.from('AgentStep')
      .select('id')
      .neq('type', 'proposal')
      .neq('type', 'action')
      .lt('created_at', cutoff)
      .order('created_at', { ascending: true })
      .limit(BATCH);
    if (error) throw new Error(`Old assistant steps read failed: ${error.message}`);
    if (!data || !data.length) break;
    const { error: deleteError } = await supabaseAdmin.from('AgentStep').delete().in('id', data.map((row) => row.id));
    if (deleteError) throw new Error(`Old assistant steps delete failed: ${deleteError.message}`);
    removed += data.length;
    if (data.length < BATCH) break;
  }
  return removed;
}

async function purgeEmptyChatRequests(cutoff) {
  let removed = 0;
  // Requests that still hold a card stay, so the scan moves on past them.
  let after = null;
  for (let batch = 0; batch < MAX_BATCHES; batch++) {
    let query = supabaseAdmin.from('AgentRequest')
      .select('id, created_at')
      .eq('origin', 'chat')
      .lt('created_at', cutoff)
      .order('created_at', { ascending: true })
      .limit(BATCH);
    if (after) query = query.gt('created_at', after);
    const { data: requests, error } = await query;
    if (error) throw new Error(`Old assistant requests read failed: ${error.message}`);
    if (!requests || !requests.length) break;
    const ids = requests.map((row) => row.id);
    const { data: steps, error: stepsError } = await supabaseAdmin.from('AgentStep').select('request_id').in('request_id', ids);
    if (stepsError) throw new Error(`Old assistant request steps read failed: ${stepsError.message}`);
    const kept = new Set((steps || []).map((row) => row.request_id));
    const empty = ids.filter((id) => !kept.has(id));
    if (empty.length) {
      const { error: deleteError } = await supabaseAdmin.from('AgentRequest').delete().in('id', empty).eq('origin', 'chat');
      if (deleteError) throw new Error(`Old assistant requests delete failed: ${deleteError.message}`);
      removed += empty.length;
    }
    after = requests[requests.length - 1].created_at;
    if (requests.length < BATCH) break;
  }
  return removed;
}

// A rule's runs older than a year; their action steps go with them (cascade).
async function purgeRuleRuns(cutoff) {
  let removed = 0;
  for (let batch = 0; batch < MAX_BATCHES; batch++) {
    const { data, error } = await supabaseAdmin.from('AgentRequest')
      .select('id')
      .eq('origin', 'rule')
      .lt('created_at', cutoff)
      .order('created_at', { ascending: true })
      .limit(BATCH);
    if (error) throw new Error(`Old rule runs read failed: ${error.message}`);
    if (!data || !data.length) break;
    const { error: deleteError } = await supabaseAdmin.from('AgentRequest').delete().in('id', data.map((row) => row.id)).eq('origin', 'rule');
    if (deleteError) throw new Error(`Old rule runs delete failed: ${deleteError.message}`);
    removed += data.length;
    if (data.length < BATCH) break;
  }
  return removed;
}

async function assistantAgentPurge({ now = Date.now() } = {}) {
  const cutoff = new Date(now - KEEP_MS).toISOString();
  const steps = await purgeSteps(cutoff);
  const requests = await purgeEmptyChatRequests(cutoff);
  const ruleRuns = await purgeRuleRuns(new Date(now - RULE_RUNS_KEEP_MS).toISOString());
  if (steps || requests || ruleRuns) logger.info('[assistantAgentPurge] Deleted old assistant records', { steps, requests, ruleRuns });
  return { steps, requests, ruleRuns };
}

module.exports = assistantAgentPurge;
