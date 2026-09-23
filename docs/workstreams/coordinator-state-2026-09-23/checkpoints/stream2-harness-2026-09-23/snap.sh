#!/bin/zsh
# Snapshot: occupancy rows (md5 of full row json + key columns) and residency letters (no pdf bytes) for the fixture home.
P=/private/tmp/pantopus-stream2-r06-runtime/psql.sh
$P -qAt -c "select json_agg(x order by x.user_id) from (select o.user_id, o.role_base, o.is_active, o.verification_status, o.end_at, md5(row_to_json(o)::text) row_md5 from \"HomeOccupancy\" o where o.home_id in ('f0e51100-0000-4000-8000-000000000200')) x;" \
 -c "select coalesce(json_agg(x order by x.issued_at),'[]'::json) from (select id, user_id, letter_code, status, resident_name, address_line1, city, state, zipcode, purpose, issued_at, expires_at, revoked_at, revoke_reason, verify_count, last_verified_at, pdf_sha256, length(pdf_base64) pdf_b64_len from \"ResidencyLetter\" where home_id='f0e51100-0000-4000-8000-000000000200') x;"
