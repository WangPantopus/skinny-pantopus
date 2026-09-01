/**
 * Business Public Page Routes
 *
 * Public-facing business profile at /api/b/:username.
 * No auth required — this is the SEO-friendly public business page.
 *
 * Mount at: app.use('/api/b', require('./routes/businessPublicPage'));
 *
 * Endpoints:
 *   GET  /:username  — Full public business profile + trust signals
 */

const express = require('express');
const router = express.Router();
const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');


// ============ HELPERS ============

const parsePostGISPoint = (point) => {
  if (!point) return null;
  if (typeof point === 'object' && point.coordinates) {
    return { longitude: point.coordinates[0], latitude: point.coordinates[1] };
  }
  const str = String(point);
  const wktMatch = str.match(/POINT\(([^ ]+) ([^ ]+)\)/);
  if (wktMatch) {
    return { longitude: parseFloat(wktMatch[1]), latitude: parseFloat(wktMatch[2]) };
  }
  // WKB hex (Supabase returns geography columns in this format)
  if (/^[0-9a-fA-F]+$/.test(str) && (str.length === 42 || str.length === 50)) {
    try {
      const buf = Buffer.from(str, 'hex');
      const le = buf[0] === 1;
      const wkbType = le ? buf.readUInt32LE(1) : buf.readUInt32BE(1);
      const hasSRID = (wkbType & 0x20000000) !== 0;
      const geomType = wkbType & 0xFF;
      if (geomType !== 1) return null;
      const coordOffset = hasSRID ? 9 : 5;
      const lng = le ? buf.readDoubleLE(coordOffset) : buf.readDoubleBE(coordOffset);
      const lat = le ? buf.readDoubleLE(coordOffset + 8) : buf.readDoubleBE(coordOffset + 8);
      if (Number.isFinite(lng) && Number.isFinite(lat)) {
        return { longitude: lng, latitude: lat };
      }
    } catch (_) {
      return null;
    }
  }
  return null;
};


// ============ ROUTES ============

/**
 * GET /:username/:slug — Public business page by slug
 *
 * Returns the same payload as /:username, with currentPage.blocks resolved
 * from the requested slug's published revision.
 */
router.get('/:username/:slug', async (req, res) => {
  try {
    const { username, slug } = req.params;

    const { data: bizUser, error: userErr } = await supabaseAdmin
      .from('User')
      .select('id, username, name, email, profile_picture_url, cover_photo_url, bio, tagline, average_rating, review_count, account_type, gigs_completed')
      .eq('username', username)
      .eq('account_type', 'business')
      .single();

    if (userErr || !bizUser) {
      return res.status(404).json({ error: 'Business not found' });
    }

    const { data: profile } = await supabaseAdmin
      .from('BusinessProfile')
      .select('business_type, categories, description, logo_file_id, banner_file_id, public_email, public_phone, website, social_links, founded_year, employee_count, service_area, theme, attributes, avg_response_minutes, verification_status, verified_at, created_at')
      .eq('business_user_id', bizUser.id)
      .eq('is_published', true)
      .single();

    if (!profile) {
      return res.status(404).json({ error: 'Business profile not published' });
    }

    const { data: locations } = await supabaseAdmin
      .from('BusinessLocation')
      .select('id, label, is_primary, address, address2, city, state, zipcode, country, location, timezone, phone, email')
      .eq('business_user_id', bizUser.id)
      .eq('is_active', true)
      .order('sort_order');

    for (const loc of (locations || [])) {
      if (loc.location) loc.location = parsePostGISPoint(loc.location);
    }

    const locationIds = (locations || []).map((l) => l.id);
    let allHours = [];
    if (locationIds.length > 0) {
      const { data: hours } = await supabaseAdmin
        .from('BusinessHours')
        .select('*')
        .in('location_id', locationIds)
        .order('day_of_week');
      allHours = hours || [];
    }

    const { data: featuredItems } = await supabaseAdmin
      .from('BusinessCatalogItem')
      .select('id, name, description, kind, price_cents, price_max_cents, price_unit, currency, image_url, image_file_id, is_featured, tags')
      .eq('business_user_id', bizUser.id)
      .eq('status', 'active')
      .order('is_featured', { ascending: false })
      .order('sort_order')
      .limit(20);

    let reviewSummary = {
      average_rating: parseFloat(bizUser.average_rating) || null,
      review_count: bizUser.review_count || 0,
      distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    };

    if (bizUser.review_count > 0) {
      const { data: distRows } = await supabaseAdmin
        .from('Review')
        .select('rating')
        .eq('reviewee_id', bizUser.id);

      for (const r of (distRows || [])) {
        const star = Math.round(r.rating);
        if (star >= 1 && star <= 5) {
          reviewSummary.distribution[star] = (reviewSummary.distribution[star] || 0) + 1;
        }
      }
    }

    const completedGigs = bizUser.gigs_completed || 0;
    const profileCreatedAt = profile.created_at ? new Date(profile.created_at) : null;
    const daysSinceCreation = profileCreatedAt
      ? (Date.now() - profileCreatedAt.getTime()) / (1000 * 60 * 60 * 24)
      : Infinity;
    const isNewBusiness = completedGigs < 3 && daysSinceCreation <= 30;

    const { data: pages } = await supabaseAdmin
      .from('BusinessPage')
      .select('id, slug, title, description, is_default, show_in_nav, icon_key, nav_order, published_revision')
      .eq('business_user_id', bizUser.id)
      .gt('published_revision', 0)
      .order('nav_order');

    const defaultPage = (pages || []).find((p) => p.is_default) || (pages || [])[0];
    const currentPage = (pages || []).find((p) => p.slug === slug);
    if (!currentPage) {
      return res.status(404).json({ error: 'Page not found' });
    }

    let currentPageBlocks = [];
    if (currentPage.published_revision > 0) {
      const { data: blocks } = await supabaseAdmin
        .from('BusinessPageBlock')
        .select('id, block_type, schema_version, sort_order, data, settings, location_id, show_from, show_until, is_visible')
        .eq('page_id', currentPage.id)
        .eq('revision', currentPage.published_revision)
        .eq('is_visible', true)
        .order('sort_order');

      const now = new Date();
      currentPageBlocks = (blocks || []).filter((b) => {
        if (b.show_from && new Date(b.show_from) > now) return false;
        if (b.show_until && new Date(b.show_until) <= now) return false;
        return true;
      });
    }

    supabaseAdmin
      .from('BusinessProfileView')
      .insert({
        business_user_id: bizUser.id,
        viewer_user_id: null,
        source: 'public_page',
      })
      .then(() => {})
      .catch(() => {});

    res.json({
      business: {
        id: bizUser.id,
        username: bizUser.username,
        name: bizUser.name,
        profile_picture_url: bizUser.profile_picture_url,
        cover_photo_url: bizUser.cover_photo_url,
        bio: bizUser.bio,
        tagline: bizUser.tagline,
        average_rating: parseFloat(bizUser.average_rating) || null,
        review_count: bizUser.review_count || 0,
      },
      profile: {
        ...profile,
        avg_response_minutes: profile.avg_response_minutes || null,
      },
      locations: locations || [],
      hours: allHours,
      catalog: featuredItems || [],
      review_summary: reviewSummary,
      trust: {
        is_new_business: isNewBusiness,
        verification_status: profile.verification_status || 'unverified',
        verified_at: profile.verified_at || null,
        verification_badge: profile.verification_status === 'government_verified'
          ? 'gov_verified'
          : (profile.verification_status === 'document_verified' ? 'verified' : null),
      },
      pages: pages || [],
      defaultPage: defaultPage || null,
      currentPage: {
        ...currentPage,
        blocks: currentPageBlocks,
      },
    });
  } catch (err) {
    logger.error('Public business slug page error', {
      error: err.message,
      username: req.params.username,
      slug: req.params.slug,
    });
    res.status(500).json({ error: 'Failed to fetch business page' });
  }
});

/**
 * GET /:username — Public business profile
 *
 * Returns:
 *   - business: User row (public fields)
 *   - profile: BusinessProfile row
 *   - locations: Active BusinessLocations
 *   - hours: BusinessHours for all locations
 *   - catalog: Top featured catalog items
 *   - review_summary: Rating distribution + totals
 *   - trust: { is_new_business }
 *   - pages: Published BusinessPages with default page blocks
 */
router.get('/:username', async (req, res) => {
  try {
    const { username } = req.params;

    // 1. Get business user
    const { data: bizUser, error: userErr } = await supabaseAdmin
      .from('User')
      .select('id, username, name, email, profile_picture_url, cover_photo_url, bio, tagline, average_rating, review_count, account_type, gigs_completed')
      .eq('username', username)
      .eq('account_type', 'business')
      .single();

    if (userErr || !bizUser) {
      return res.status(404).json({ error: 'Business not found' });
    }

    // 2. Get published profile
    const { data: profile } = await supabaseAdmin
      .from('BusinessProfile')
      .select('business_type, categories, description, logo_file_id, banner_file_id, public_email, public_phone, website, social_links, founded_year, employee_count, service_area, theme, attributes, avg_response_minutes, verification_status, verified_at, created_at')
      .eq('business_user_id', bizUser.id)
      .eq('is_published', true)
      .single();

    if (!profile) {
      return res.status(404).json({ error: 'Business profile not published' });
    }

    // 3. Get active locations
    const { data: locations } = await supabaseAdmin
      .from('BusinessLocation')
      .select('id, label, is_primary, address, address2, city, state, zipcode, country, location, timezone, phone, email')
      .eq('business_user_id', bizUser.id)
      .eq('is_active', true)
      .order('sort_order');

    for (const loc of (locations || [])) {
      if (loc.location) loc.location = parsePostGISPoint(loc.location);
    }

    // 4. Get hours for all locations
    const locationIds = (locations || []).map(l => l.id);
    let allHours = [];
    if (locationIds.length > 0) {
      const { data: hours } = await supabaseAdmin
        .from('BusinessHours')
        .select('*')
        .in('location_id', locationIds)
        .order('day_of_week');
      allHours = hours || [];
    }

    // 5. Get featured catalog items
    const { data: featuredItems } = await supabaseAdmin
      .from('BusinessCatalogItem')
      .select('id, name, description, kind, price_cents, price_max_cents, price_unit, currency, image_url, image_file_id, is_featured, tags')
      .eq('business_user_id', bizUser.id)
      .eq('status', 'active')
      .order('is_featured', { ascending: false })
      .order('sort_order')
      .limit(20);

    // 6. Review summary: distribution by star + totals
    let reviewSummary = {
      average_rating: parseFloat(bizUser.average_rating) || null,
      review_count: bizUser.review_count || 0,
      distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    };

    if (bizUser.review_count > 0) {
      const { data: distRows } = await supabaseAdmin
        .from('Review')
        .select('rating')
        .eq('reviewee_id', bizUser.id);

      for (const r of (distRows || [])) {
        const star = Math.round(r.rating);
        if (star >= 1 && star <= 5) {
          reviewSummary.distribution[star] = (reviewSummary.distribution[star] || 0) + 1;
        }
      }
    }

    // 7. New business status
    const completedGigs = bizUser.gigs_completed || 0;
    const profileCreatedAt = profile.created_at ? new Date(profile.created_at) : null;
    const daysSinceCreation = profileCreatedAt
      ? (Date.now() - profileCreatedAt.getTime()) / (1000 * 60 * 60 * 24)
      : Infinity;
    const isNewBusiness = completedGigs < 3 && daysSinceCreation <= 30;

    // 8. Published pages
    const { data: pages } = await supabaseAdmin
      .from('BusinessPage')
      .select('id, slug, title, description, is_default, show_in_nav, icon_key, nav_order, published_revision')
      .eq('business_user_id', bizUser.id)
      .gt('published_revision', 0)
      .order('nav_order');

    // Get blocks for default page
    const defaultPage = (pages || []).find(p => p.is_default) || (pages || [])[0];
    let defaultBlocks = [];
    if (defaultPage && defaultPage.published_revision > 0) {
      const { data: blocks } = await supabaseAdmin
        .from('BusinessPageBlock')
        .select('id, block_type, schema_version, sort_order, data, settings, location_id, show_from, show_until, is_visible')
        .eq('page_id', defaultPage.id)
        .eq('revision', defaultPage.published_revision)
        .eq('is_visible', true)
        .order('sort_order');

      const now = new Date();
      defaultBlocks = (blocks || []).filter(b => {
        if (b.show_from && new Date(b.show_from) > now) return false;
        if (b.show_until && new Date(b.show_until) <= now) return false;
        return true;
      });
    }

    // 9. Log profile view (fire-and-forget)
    supabaseAdmin
      .from('BusinessProfileView')
      .insert({
        business_user_id: bizUser.id,
        viewer_user_id: null, // public, no auth
        source: 'public_page',
      })
      .then(() => {})
      .catch(() => {});

    res.json({
      business: {
        id: bizUser.id,
        username: bizUser.username,
        name: bizUser.name,
        profile_picture_url: bizUser.profile_picture_url,
        cover_photo_url: bizUser.cover_photo_url,
        bio: bizUser.bio,
        tagline: bizUser.tagline,
        average_rating: parseFloat(bizUser.average_rating) || null,
        review_count: bizUser.review_count || 0,
      },
      profile: {
        ...profile,
        avg_response_minutes: profile.avg_response_minutes || null,
      },
      locations: locations || [],
      hours: allHours,
      catalog: featuredItems || [],
      review_summary: reviewSummary,
      trust: {
        is_new_business: isNewBusiness,
        verification_status: profile.verification_status || 'unverified',
        verified_at: profile.verified_at || null,
        verification_badge: profile.verification_status === 'government_verified'
          ? 'gov_verified'
          : (profile.verification_status === 'document_verified' ? 'verified' : null),
      },
      pages: pages || [],
      defaultPage: defaultPage
        ? { ...defaultPage, blocks: defaultBlocks }
        : null,
    });
  } catch (err) {
    logger.error('Public business page error', { error: err.message, username: req.params.username });
    res.status(500).json({ error: 'Failed to fetch business profile' });
  }
});


module.exports = router;
