/**
 * Home Guest Routes (Public — no auth required)
 *
 * Mount at '/api/homes':
 *   GET /guest/:token      — view a guest pass (public)
 *   GET /shared/:token     — view a shared resource via scoped grant (public)
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');


// ============================================================
// GET /guest/:token — Public guest pass view
// ============================================================

router.get('/guest/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { passcode } = req.query;

    if (!token || token.length < 32) {
      return res.status(400).json({ error: 'Invalid token' });
    }

    // Hash incoming token to look up
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Find the guest pass
    const { data: pass, error: passErr } = await supabaseAdmin
      .from('HomeGuestPass')
      .select('*')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (passErr || !pass) {
      return res.status(404).json({ error: 'Guest pass not found' });
    }

    // Validate: not revoked
    if (pass.revoked_at) {
      return res.status(410).json({ error: 'This guest pass has been revoked' });
    }

    // Validate: not expired
    const now = new Date();
    if (pass.end_at && new Date(pass.end_at) <= now) {
      return res.status(410).json({ error: 'This guest pass has expired' });
    }

    // Validate: not started yet
    if (pass.start_at && new Date(pass.start_at) > now) {
      return res.status(403).json({ error: 'This guest pass is not active yet' });
    }

    // Validate: max views
    if (pass.max_views && pass.view_count >= pass.max_views) {
      return res.status(410).json({ error: 'This guest pass has reached its view limit' });
    }

    // Validate: passcode
    if (pass.passcode_hash) {
      if (!passcode) {
        return res.status(403).json({ requiresPasscode: true, error: 'Passcode required' });
      }
      const providedHash = crypto.createHash('sha256').update(passcode).digest('hex');
      if (providedHash !== pass.passcode_hash) {
        return res.status(403).json({ requiresPasscode: true, error: 'Incorrect passcode' });
      }
    }

    // Increment view count + record the view
    const viewerIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null;
    const userAgent = req.headers['user-agent'] || null;

    await Promise.allSettled([
      supabaseAdmin
        .from('HomeGuestPass')
        .update({ view_count: (pass.view_count || 0) + 1 })
        .eq('id', pass.id),
      supabaseAdmin
        .from('HomeGuestPassView')
        .insert({
          guest_pass_id: pass.id,
          viewer_ip: viewerIp,
          user_agent: userAgent,
        }),
    ]);

    // Fetch home basics
    const { data: home } = await supabaseAdmin
      .from('Home')
      .select('id, name, parking_instructions, house_rules, entry_instructions, trash_day, local_tips, guest_welcome_message')
      .eq('id', pass.home_id)
      .single();

    if (!home) {
      return res.status(404).json({ error: 'Home not found' });
    }

    // Build sections based on included_sections
    const includedSections = pass.included_sections || [];
    const sections = {};

    // Collect section data fetches in parallel
    const sectionPromises = {};

    if (includedSections.includes('wifi')) {
      sectionPromises.wifi = supabaseAdmin
        .from('HomeAccessSecret')
        .select('label, secret_value, access_secret_value:HomeAccessSecretValue(secret_value)')
        .eq('home_id', pass.home_id)
        .eq('access_type', 'wifi');
    }

    if (includedSections.includes('emergency')) {
      sectionPromises.emergency = supabaseAdmin
        .from('HomeEmergency')
        .select('type, label, location, details')
        .eq('home_id', pass.home_id);
    }

    // Check for doc: prefixed sections (e.g. "doc:uuid")
    const docIds = includedSections
      .filter(s => s.startsWith('doc:'))
      .map(s => s.replace('doc:', ''));

    if (docIds.length > 0) {
      sectionPromises.docs = supabaseAdmin
        .from('HomeDocument')
        .select('id, title, doc_type, storage_path, mime_type')
        .eq('home_id', pass.home_id)
        .in('id', docIds);
    }

    // Resolve all parallel section fetches
    const sectionKeys = Object.keys(sectionPromises);
    const sectionResults = await Promise.allSettled(Object.values(sectionPromises));

    for (let i = 0; i < sectionKeys.length; i++) {
      const key = sectionKeys[i];
      const result = sectionResults[i];
      if (result.status === 'fulfilled' && result.value.data) {
        if (key === 'wifi') {
          // Transform wifi secrets to guest-friendly format
          const wifiSecrets = result.value.data.map(s => ({
            network_name: s.label,
            password: s.access_secret_value?.[0]?.secret_value || s.secret_value || null,
          }));
          sections.wifi = wifiSecrets.length === 1 ? wifiSecrets[0] : wifiSecrets;
        } else if (key === 'emergency') {
          sections.emergency = result.value.data.map(e => ({
            ...e,
            info_type: e.type,
            location_in_home: e.location,
          }));
        } else if (key === 'docs') {
          sections.docs = result.value.data;
        }
      }
    }

    // Add simple text sections from home record
    if (includedSections.includes('parking')) {
      sections.parking = home.parking_instructions || null;
    }
    if (includedSections.includes('house_rules')) {
      sections.house_rules = home.house_rules || null;
    }
    if (includedSections.includes('entry_instructions')) {
      sections.entry_instructions = home.entry_instructions || null;
    }
    if (includedSections.includes('trash_day')) {
      sections.trash_day = home.trash_day || null;
    }
    if (includedSections.includes('local_tips')) {
      sections.local_tips = home.local_tips || null;
    }

    res.json({
      pass: {
        label: pass.label,
        kind: pass.kind,
        custom_title: pass.custom_title || null,
        expires_at: pass.end_at,
        home_name: home.name || null,
        welcome_message: home.guest_welcome_message || null,
      },
      sections,
    });
  } catch (err) {
    logger.error('Guest view error', { error: err.message });
    res.status(500).json({ error: 'Failed to load guest pass' });
  }
});


// ============================================================
// GET /shared/:token — Public scoped grant view
// ============================================================

router.get('/shared/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { passcode } = req.query;

    if (!token || token.length < 32) {
      return res.status(400).json({ error: 'Invalid token' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const { data: grant, error: grantErr } = await supabaseAdmin
      .from('HomeScopedGrant')
      .select('*')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (grantErr || !grant) {
      return res.status(404).json({ error: 'Shared resource not found' });
    }

    // Validate: not expired
    const now = new Date();
    if (grant.end_at && new Date(grant.end_at) <= now) {
      return res.status(410).json({ error: 'This share link has expired' });
    }

    // Validate: not started yet
    if (grant.start_at && new Date(grant.start_at) > now) {
      return res.status(403).json({ error: 'This share link is not active yet' });
    }

    // Validate: max views
    if (grant.max_views && grant.view_count >= grant.max_views) {
      return res.status(410).json({ error: 'This share link has reached its view limit' });
    }

    // Validate: passcode
    if (grant.passcode_hash) {
      if (!passcode) {
        return res.status(403).json({ requiresPasscode: true, error: 'Passcode required' });
      }
      const providedHash = crypto.createHash('sha256').update(passcode).digest('hex');
      if (providedHash !== grant.passcode_hash) {
        return res.status(403).json({ requiresPasscode: true, error: 'Incorrect passcode' });
      }
    }

    // Increment view count
    await supabaseAdmin
      .from('HomeScopedGrant')
      .update({ view_count: (grant.view_count || 0) + 1 })
      .eq('id', grant.id);

    // Fetch the specific resource
    const tableMap = {
      HomeIssue: 'HomeIssue',
      HomeTask: 'HomeTask',
      HomeDocument: 'HomeDocument',
      HomeCalendarEvent: 'HomeCalendarEvent',
      HomeAsset: 'HomeAsset',
      HomePackage: 'HomePackage',
    };

    const tableName = tableMap[grant.resource_type];
    if (!tableName) {
      return res.status(400).json({ error: 'Unknown resource type' });
    }

    const { data: resource, error: resErr } = await supabaseAdmin
      .from(tableName)
      .select('*')
      .eq('id', grant.resource_id)
      .eq('home_id', grant.home_id)
      .maybeSingle();

    if (resErr || !resource) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    // Strip sensitive fields from the resource
    const { created_by, viewer_user_ids, ...safeResource } = resource;

    res.json({
      grant: {
        resource_type: grant.resource_type,
        can_view: grant.can_view,
        can_edit: grant.can_edit,
        expires_at: grant.end_at,
      },
      resource: safeResource,
    });
  } catch (err) {
    logger.error('Shared view error', { error: err.message });
    res.status(500).json({ error: 'Failed to load shared resource' });
  }
});


module.exports = router;
