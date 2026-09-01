/**
 * Integration tests: Schema Validation
 *
 * Validates that all column names used in backend code actually exist
 * in the database. Catches typos and stale references early.
 */
const { admin } = require('./helpers');

/**
 * Check that a table exists and has the expected columns by querying
 * a single row with the explicit column selection.
 */
async function validateColumns(table, columns) {
  const { error } = await admin.from(table).select(columns).limit(0);
  return error;
}

describe('Schema Validation — column selections', () => {
  // These mirror the columns.js constants to ensure they match the actual schema

  test('Gig list columns exist', async () => {
    const error = await validateColumns('Gig', `
      id, title, description, price, category, deadline,
      status, user_id, accepted_by, accepted_at,
      created_at, updated_at, is_urgent, tags,
      scheduled_start, payment_status,
      origin_mode, origin_home_id,
      ref_listing_id, ref_post_id,
      created_by, beneficiary_user_id
    `);
    expect(error).toBeNull();
  });

  test('Post list columns exist', async () => {
    const error = await validateColumns('Post', `
      id, user_id, home_id, content, media_urls, media_types,
      post_type, visibility, like_count, comment_count, share_count,
      is_pinned, is_edited, created_at, updated_at,
      location_name, title, post_format, tags,
      event_date, event_end_date, event_venue,
      safety_alert_kind, deal_expires_at, deal_business_name,
      lost_found_type, service_category,
      post_as, audience, business_id,
      is_story, story_expires_at,
      matched_business_ids, matched_businesses_cache,
      latitude, longitude
    `);
    expect(error).toBeNull();
  });

  test('Listing list columns exist', async () => {
    const error = await validateColumns('Listing', `
      id, user_id, title, description, price, is_free,
      category, subcategory, condition, quantity, status,
      media_urls, media_types, location_name,
      latitude, longitude, visibility_scope, radius_miles,
      meetup_preference, delivery_available, tags,
      view_count, save_count, message_count,
      created_at, updated_at
    `);
    expect(error).toBeNull();
  });

  test('Notification columns exist', async () => {
    const error = await validateColumns('Notification', `
      id, user_id, type, title, body, icon, link,
      is_read, metadata, created_at
    `);
    expect(error).toBeNull();
  });

  test('HomeTask columns exist', async () => {
    const error = await validateColumns('HomeTask', `
      id, home_id, task_type, title, description,
      assigned_to, due_at, status, priority, budget,
      completed_at, linked_gig_id, converted_to_gig_id,
      created_by, created_at, updated_at, visibility, mail_id
    `);
    expect(error).toBeNull();
  });

  test('HomeIssue columns exist', async () => {
    const error = await validateColumns('HomeIssue', `
      id, home_id, title, description, severity, status,
      reported_by, assigned_vendor_id, estimated_cost, photos,
      linked_gig_id, resolved_at,
      created_at, updated_at, visibility
    `);
    expect(error).toBeNull();
  });

  test('HomeBill columns exist', async () => {
    const error = await validateColumns('HomeBill', `
      id, home_id, bill_type, provider_name, amount, currency,
      period_start, period_end, due_date, status,
      paid_at, paid_by,
      created_by, created_at, updated_at
    `);
    expect(error).toBeNull();
  });

  test('HomePackage columns exist', async () => {
    const error = await validateColumns('HomePackage', `
      id, home_id, carrier, tracking_number, vendor_name, description,
      delivery_instructions, status, expected_at, delivered_at,
      picked_up_by, created_by, created_at, updated_at, visibility
    `);
    expect(error).toBeNull();
  });

  test('HomeCalendarEvent columns exist', async () => {
    const error = await validateColumns('HomeCalendarEvent', `
      id, home_id, event_type, title, description,
      start_at, end_at, location_notes, recurrence_rule,
      assigned_to, alerts_enabled,
      created_by, created_at, updated_at, visibility
    `);
    expect(error).toBeNull();
  });

  test('Phase 1 home household claim columns exist', async () => {
    const homeError = await validateColumns('Home', `
      id, household_resolution_state, household_resolution_updated_at
    `);
    expect(homeError).toBeNull();

    const claimError = await validateColumns('HomeOwnershipClaim', `
      id, home_id, claimant_user_id, state, claim_phase_v2,
      terminal_reason, challenge_state, claim_strength,
      routing_classification, identity_status,
      merged_into_claim_id, expires_at
    `);
    expect(claimError).toBeNull();

    const evidenceError = await validateColumns('HomeVerificationEvidence', `
      id, claim_id, confidence_level
    `);
    expect(evidenceError).toBeNull();
  });

  test('HomeOccupancy uses is_active (not is_current)', async () => {
    // This is the exact regression test for the bug that broke all mailbox features
    const error = await validateColumns('HomeOccupancy', 'id, user_id, home_id, is_active');
    expect(error).toBeNull();

    // Verify the wrong column name would fail
    const wrongError = await validateColumns('HomeOccupancy', 'id, is_current');
    expect(wrongError).not.toBeNull();
  });

  test('BusinessTeam uses is_active', async () => {
    const error = await validateColumns('BusinessTeam', 'id, business_user_id, user_id, role_base, is_active');
    expect(error).toBeNull();
  });

  test('BusinessPermissionOverride columns exist', async () => {
    const error = await validateColumns('BusinessPermissionOverride',
      'business_user_id, user_id, permission, allowed');
    expect(error).toBeNull();
  });

  test('BusinessRolePermission columns exist', async () => {
    const error = await validateColumns('BusinessRolePermission',
      'role_base, permission, allowed');
    expect(error).toBeNull();
  });
});
