@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.businesses

import app.pantopus.android.data.api.models.common.JsonValue
import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Lightweight business "user" projection emitted alongside every
 * [BusinessMembership] row. The backend joins `User`
 * (account_type='business') plus `city, state` for the locality body
 * (T6.3f added city/state to the SELECT).
 */
@JsonClass(generateAdapter = true)
data class BusinessUserDto(
    val id: String,
    val username: String? = null,
    val name: String? = null,
    val email: String? = null,
    @Json(name = "profile_picture_url") val profilePictureUrl: String? = null,
    @Json(name = "account_type") val accountType: String? = null,
    val city: String? = null,
    val state: String? = null,
    @Json(name = "average_rating") val averageRating: Double? = null,
    @Json(name = "review_count") val reviewCount: Int? = null,
)

/**
 * Optional `BusinessProfile` join — present when the business has
 * onboarded a profile (categories, logo, description). Always null for
 * freshly-created businesses with no profile yet.
 */
@JsonClass(generateAdapter = true)
data class BusinessProfileDto(
    @Json(name = "business_user_id") val businessUserId: String? = null,
    @Json(name = "business_type") val businessType: String? = null,
    val categories: List<String>? = null,
    @Json(name = "is_published") val isPublished: Boolean? = null,
    @Json(name = "logo_file_id") val logoFileId: String? = null,
    @Json(name = "banner_file_id") val bannerFileId: String? = null,
    val description: String? = null,
    // bi0_unverified … bi4_authority. Anything above bi0_unverified earns
    // the violet verified mark; bi0_unverified reads as pending.
    @Json(name = "identity_verification_tier") val identityVerificationTier: String? = null,
)

/** Per-business stats band — `stats` block on each membership row. */
@JsonClass(generateAdapter = true)
data class BusinessStatsDto(
    @Json(name = "open_chats") val openChats: Int = 0,
    @Json(name = "bookings_this_week") val bookingsThisWeek: Int = 0,
)

/** One member chip in the team stack. `initials` is always present. */
@JsonClass(generateAdapter = true)
data class BusinessTeamChipDto(
    val name: String? = null,
    val initials: String? = null,
    @Json(name = "avatar_file_id") val avatarFileId: String? = null,
)

/** Team summary — `team` block on each membership row. */
@JsonClass(generateAdapter = true)
data class BusinessTeamSummaryDto(
    val count: Int = 0,
    val members: List<BusinessTeamChipDto> = emptyList(),
)

/**
 * One row from `/api/businesses/my-businesses` — the membership +
 * business projection used by the My businesses screen. Route:
 * `backend/routes/businesses.js:682`.
 */
@JsonClass(generateAdapter = true)
data class BusinessMembership(
    val id: String,
    @Json(name = "role_base") val roleBase: String? = null,
    val title: String? = null,
    @Json(name = "joined_at") val joinedAt: String? = null,
    @Json(name = "business_user_id") val businessUserId: String,
    val business: BusinessUserDto,
    val profile: BusinessProfileDto? = null,
    val stats: BusinessStatsDto? = null,
    val team: BusinessTeamSummaryDto? = null,
)

/** `GET /api/businesses/my-businesses` envelope. */
@JsonClass(generateAdapter = true)
data class MyBusinessesResponse(
    val businesses: List<BusinessMembership>,
)

// ---------------------------------------------------------------------------
// P1.6 — Business Profile screen DTOs
// ---------------------------------------------------------------------------

/**
 * Full Business "User" row returned by `GET /api/businesses/:businessId`.
 * The backend `select('*')` projects every column; we decode only the
 * fields the Business Profile screen renders.
 */
@JsonClass(generateAdapter = true)
data class BusinessUserDetailDto(
    val id: String,
    val username: String? = null,
    val name: String? = null,
    val email: String? = null,
    val bio: String? = null,
    val tagline: String? = null,
    @Json(name = "profile_picture_url") val profilePictureUrl: String? = null,
    @Json(name = "cover_photo_url") val coverPhotoUrl: String? = null,
    @Json(name = "account_type") val accountType: String? = null,
    val city: String? = null,
    val state: String? = null,
    val verified: Boolean? = null,
    @Json(name = "average_rating") val averageRating: Double? = null,
    @Json(name = "review_count") val reviewCount: Int? = null,
    @Json(name = "followers_count") val followersCount: Int? = null,
    @Json(name = "gigs_completed") val gigsCompleted: Int? = null,
    @Json(name = "created_at") val createdAt: String? = null,
)

/**
 * Geo point projection. The backend's `parsePostGISPoint` normalises
 * PostGIS data into `{ lat, lng }`.
 */
@JsonClass(generateAdapter = true)
data class BusinessGeoPoint(
    val lat: Double,
    val lng: Double,
)

/** A single `BusinessLocation` row. */
@JsonClass(generateAdapter = true)
data class BusinessLocationDto(
    val id: String,
    val label: String? = null,
    @Json(name = "is_primary") val isPrimary: Boolean? = null,
    val address: String? = null,
    val address2: String? = null,
    val city: String? = null,
    val state: String? = null,
    val zipcode: String? = null,
    val country: String? = null,
    val location: BusinessGeoPoint? = null,
    val phone: String? = null,
    val email: String? = null,
    val timezone: String? = null,
)

/**
 * Full `BusinessProfile` row returned by `GET /api/businesses/:businessId`
 * (and folded in by the public payload). Only fields the iOS screen
 * actually renders are decoded.
 */
@JsonClass(generateAdapter = true)
data class BusinessProfileDetailDto(
    @Json(name = "business_user_id") val businessUserId: String? = null,
    @Json(name = "business_type") val businessType: String? = null,
    val categories: List<String>? = null,
    val description: String? = null,
    @Json(name = "logo_file_id") val logoFileId: String? = null,
    @Json(name = "banner_file_id") val bannerFileId: String? = null,
    @Json(name = "public_email") val publicEmail: String? = null,
    @Json(name = "public_phone") val publicPhone: String? = null,
    val website: String? = null,
    @Json(name = "founded_year") val foundedYear: Int? = null,
    @Json(name = "employee_count") val employeeCount: String? = null,
    @Json(name = "service_area") val serviceArea: BusinessServiceAreaDto? = null,
    @Json(name = "founding_badge") val foundingBadge: Boolean? = null,
    @Json(name = "is_published") val isPublished: Boolean? = null,
    @Json(name = "published_at") val publishedAt: String? = null,
    @Json(name = "verification_status") val verificationStatus: String? = null,
    @Json(name = "primary_location") val primaryLocation: BusinessLocationDto? = null,
    /**
     * Social / booking links keyed by network name. Untyped for the same
     * reason as [attributes] — `social_links` is user-writable jsonb, so a
     * null or non-string member must not fail the whole decode. Callers
     * coerce with `EditBusinessPageMapper.stringMap`.
     */
    @Json(name = "social_links") val socialLinks: JsonValue? = null,
    /**
     * Free-form profile attributes (e.g. `price_level`). Untyped because the
     * jsonb column holds provider-shaped values — mirrors the iOS
     * `[String: JSONValue]`.
     */
    val attributes: JsonValue? = null,
)

/**
 * `access` sub-object returned by business detail and team endpoints.
 */
@JsonClass(generateAdapter = true)
data class BusinessAccessDto(
    val hasAccess: Boolean = false,
    val isOwner: Boolean = false,
    @Json(name = "role_base") val roleBase: String? = null,
    val permissions: List<String> = emptyList(),
)

/**
 * `GET /api/businesses/:businessId` envelope — route
 * `backend/routes/businesses.js:912`.
 */
@JsonClass(generateAdapter = true)
data class BusinessDetailResponse(
    val business: BusinessUserDetailDto,
    val profile: BusinessProfileDetailDto? = null,
    val locations: List<BusinessLocationDto> = emptyList(),
    val access: BusinessAccessDto? = null,
)

/**
 * One `BusinessHours` row returned in `/public/:username`. `day_of_week`
 * is `0..6` (Sunday=0). Closed days have `is_closed = true` and `null`
 * open/close strings.
 */
@JsonClass(generateAdapter = true)
data class BusinessHoursDto(
    val id: String? = null,
    @Json(name = "location_id") val locationId: String? = null,
    @Json(name = "day_of_week") val dayOfWeek: Int,
    @Json(name = "open_time") val openTime: String? = null,
    @Json(name = "close_time") val closeTime: String? = null,
    @Json(name = "is_closed") val isClosed: Boolean? = null,
)

/**
 * `BusinessCatalogItem` row. Used by the Services tab. Donation /
 * product items pass through too — the renderer just shows the kind
 * label and the price (or "Variable" when prices aren't set).
 */
@JsonClass(generateAdapter = true)
data class BusinessCatalogItemDto(
    val id: String,
    val name: String,
    val description: String? = null,
    val kind: String? = null,
    @Json(name = "price_cents") val priceCents: Int? = null,
    @Json(name = "price_max_cents") val priceMaxCents: Int? = null,
    @Json(name = "price_unit") val priceUnit: String? = null,
    val currency: String? = null,
    @Json(name = "image_url") val imageUrl: String? = null,
    @Json(name = "is_featured") val isFeatured: Boolean? = null,
)

/**
 * `GET /api/businesses/:businessId/catalog/items` envelope — the
 * owner/staff catalog read. Route `backend/routes/businesses.js:2386`.
 */
@JsonClass(generateAdapter = true)
data class BusinessCatalogItemsResponse(
    val items: List<BusinessCatalogItemDto> = emptyList(),
)

/**
 * `GET /api/businesses/public/:username` response (subset). Only the
 * fields the Business Profile screen reads are decoded; the response is
 * far larger (pages, blocks, founding slot, …).
 * Route `backend/routes/businesses.js:3277`.
 */
@JsonClass(generateAdapter = true)
data class BusinessPublicResponse(
    val hours: List<BusinessHoursDto> = emptyList(),
    val catalog: List<BusinessCatalogItemDto> = emptyList(),
)

// ---------------------------------------------------------------------------
// P1-C — Owner dashboard DTOs
// ---------------------------------------------------------------------------

/**
 * One onboarding-checklist row from the owner dashboard. Drives the
 * profile-strength card's completion list (`label` + `done`).
 */
@JsonClass(generateAdapter = true)
data class BusinessOnboardingItemDto(
    val key: String,
    val done: Boolean,
    val label: String,
)

/** The `onboarding` block: the checklist plus its completed / total tallies. */
@JsonClass(generateAdapter = true)
data class BusinessOnboardingDto(
    val checklist: List<BusinessOnboardingItemDto> = emptyList(),
    @Json(name = "completed_count") val completedCount: Int = 0,
    @Json(name = "total_count") val totalCount: Int = 0,
)

/**
 * Subset of the `profile` block the owner dashboard reads (publish state +
 * edit recency). The public render comes from the detail fetch.
 */
@JsonClass(generateAdapter = true)
data class BusinessDashboardProfileDto(
    @Json(name = "is_published") val isPublished: Boolean? = null,
    @Json(name = "updated_at") val updatedAt: String? = null,
)

/**
 * `GET /api/businesses/:businessId/dashboard` response (subset) — the
 * owner-scoped fetch: publish state, edit recency, and the onboarding
 * checklist behind the profile-strength card. Route
 * `backend/routes/businesses.js:979`.
 */
@JsonClass(generateAdapter = true)
data class BusinessDashboardResponse(
    val profile: BusinessDashboardProfileDto? = null,
    val onboarding: BusinessOnboardingDto? = null,
    val access: BusinessAccessDto? = null,
)

/** `views` block — total + week-over-week trend percentage. */
@JsonClass(generateAdapter = true)
data class BusinessInsightsViewsDto(
    val total: Int = 0,
    val trend: Int = 0,
)

/** `followers` block — running total, new in-period, and trend. */
@JsonClass(generateAdapter = true)
data class BusinessInsightsFollowersDto(
    val total: Int = 0,
    val new: Int = 0,
    val trend: Int = 0,
)

/** `reviews` block — in-period count, trend, and period average. */
@JsonClass(generateAdapter = true)
data class BusinessInsightsReviewsDto(
    val count: Int = 0,
    val trend: Int = 0,
    @Json(name = "average_rating") val averageRating: Double? = null,
)

/**
 * `GET /api/businesses/:businessId/insights` response (subset) — drives the
 * owner dashboard's "This week" tiles. Route
 * `backend/routes/businesses.js:3915`.
 */
@JsonClass(generateAdapter = true)
data class BusinessInsightsResponse(
    val views: BusinessInsightsViewsDto = BusinessInsightsViewsDto(),
    val followers: BusinessInsightsFollowersDto = BusinessInsightsFollowersDto(),
    val reviews: BusinessInsightsReviewsDto = BusinessInsightsReviewsDto(),
)

/**
 * One enriched `Review` row from the owner reviews endpoint. `comment` is the
 * body; `ownerResponse` is the published reply (null → the owner can reply).
 * Route `backend/routes/businesses.js:3441`.
 */
@JsonClass(generateAdapter = true)
data class BusinessOwnerReviewDto(
    val id: String,
    val rating: Int = 0,
    val comment: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
    @Json(name = "owner_response") val ownerResponse: String? = null,
    @Json(name = "reviewer_name") val reviewerName: String? = null,
    @Json(name = "reviewer_avatar") val reviewerAvatar: String? = null,
    @Json(name = "gig_title") val gigTitle: String? = null,
)

/** `GET /api/businesses/:businessId/reviews` response (subset). */
@JsonClass(generateAdapter = true)
data class BusinessOwnerReviewsResponse(
    val reviews: List<BusinessOwnerReviewDto> = emptyList(),
    val total: Int? = null,
)

/** Body for `POST /api/businesses/:businessId/reviews/:reviewId/respond`. */
@JsonClass(generateAdapter = true)
data class BusinessReviewRespondRequest(
    val response: String,
)

/** `POST /api/businesses/:businessId/follow` response. */
@JsonClass(generateAdapter = true)
data class BusinessFollowResponse(
    val following: Boolean = true,
)

/**
 * Body for `POST /api/businesses/:businessId/inbox/start`.
 * Route `backend/routes/businesses.js:3939`.
 */
@JsonClass(generateAdapter = true)
data class StartBusinessInquiryRequest(
    val subject: String? = null,
)

/**
 * Response from `POST /api/businesses/:businessId/inbox/start`.
 * Backend returns camelCase (`roomId`, `existing`).
 */
@JsonClass(generateAdapter = true)
data class StartBusinessInquiryResponse(
    val roomId: String,
    val existing: Boolean? = null,
)

/**
 * `GET /api/businesses/:businessId/locations` response.
 * Route `backend/routes/businesses.js:1742`.
 */
@JsonClass(generateAdapter = true)
data class BusinessLocationsResponse(
    val locations: List<BusinessLocationDto> = emptyList(),
)

// ---------------------------------------------------------------------------
// Create business wizard (check-username + create-full)
// ---------------------------------------------------------------------------

/**
 * `GET /api/businesses/check-username` response.
 * Route `backend/routes/businesses.js:358`.
 */
@JsonClass(generateAdapter = true)
data class UsernameAvailabilityDto(
    val available: Boolean,
    /** `reserved` | `taken` | `invalid` | `error` when unavailable. */
    val reason: String? = null,
)

/**
 * Optional location block for `POST /api/businesses/create-full`.
 * Route `backend/routes/businesses.js:554`.
 */
@JsonClass(generateAdapter = true)
data class CreateBusinessLocationPayload(
    val address: String,
    val city: String,
    val state: String? = null,
    val zipcode: String? = null,
    val country: String = "US",
)

/**
 * One hours row for `POST /api/businesses/create-full`.
 * Route `backend/routes/businesses.js:554`.
 */
@JsonClass(generateAdapter = true)
data class CreateBusinessHoursPayload(
    @Json(name = "day_of_week") val dayOfWeek: Int,
    @Json(name = "open_time") val openTime: String? = null,
    @Json(name = "close_time") val closeTime: String? = null,
    @Json(name = "is_closed") val isClosed: Boolean = false,
)

/**
 * Body for `POST /api/businesses/create-full`.
 * Route `backend/routes/businesses.js:554`.
 */
@JsonClass(generateAdapter = true)
data class CreateBusinessFullRequest(
    val name: String,
    val username: String,
    val email: String,
    @Json(name = "business_type") val businessType: String? = null,
    val categories: List<String>? = null,
    val description: String? = null,
    val location: CreateBusinessLocationPayload? = null,
    val hours: List<CreateBusinessHoursPayload>? = null,
)

/**
 * `POST /api/businesses/create-full` response.
 * Route `backend/routes/businesses.js:554`.
 */
@JsonClass(generateAdapter = true)
data class CreateBusinessFullResponse(
    val message: String? = null,
    val business: BusinessUserDto,
    @Json(name = "location_id") val locationId: String? = null,
)

// ---------------------------------------------------------------------------
// A13.10 — Edit business page mutations
// ---------------------------------------------------------------------------

/**
 * `PATCH /api/businesses/:businessId` body — `updateBusinessSchema`
 * (`backend/routes/businesses.js:124`). Unspecified keys are left untouched,
 * but `social_links` / `attributes` are jsonb columns the route *replaces*
 * wholesale — send the whole merged object, never a single-key one.
 */
@JsonClass(generateAdapter = true)
data class UpdateBusinessRequest(
    val name: String? = null,
    val tagline: String? = null,
    val description: String? = null,
    val categories: List<String>? = null,
    @Json(name = "public_email") val publicEmail: String? = null,
    @Json(name = "public_phone") val publicPhone: String? = null,
    val website: String? = null,
    @Json(name = "social_links") val socialLinks: Map<String, String>? = null,
    /** Untyped so non-string attribute values round-trip unchanged. */
    val attributes: JsonValue? = null,
    @Json(name = "is_published") val isPublished: Boolean? = null,
)

/** Generic `{ message }` envelope from publish / update success paths. */
@JsonClass(generateAdapter = true)
data class BusinessMutationMessageResponse(
    val message: String? = null,
)

/**
 * One day row for `PUT …/hours` — `weeklyHoursSchema`
 * (`backend/routes/businesses.js:207`).
 */
@JsonClass(generateAdapter = true)
data class SetBusinessHoursDayRequest(
    @Json(name = "day_of_week") val dayOfWeek: Int,
    @Json(name = "open_time") val openTime: String? = null,
    @Json(name = "close_time") val closeTime: String? = null,
    @Json(name = "is_closed") val isClosed: Boolean,
)

/** Body for `PUT /api/businesses/:businessId/locations/:locationId/hours`. */
@JsonClass(generateAdapter = true)
data class SetBusinessHoursRequest(
    val hours: List<SetBusinessHoursDayRequest>,
)

/** `GET/PUT …/hours` response envelope. */
@JsonClass(generateAdapter = true)
data class BusinessLocationHoursResponse(
    val hours: List<BusinessHoursDto> = emptyList(),
)

/**
 * `PATCH /api/businesses/:businessId/locations/:locationId` body —
 * `updateLocationSchema` (`backend/routes/businesses.js:190`). `address` is
 * the street line only; the locality lives in its own columns.
 */
@JsonClass(generateAdapter = true)
data class UpdateBusinessLocationRequest(
    val address: String? = null,
    val city: String? = null,
    val state: String? = null,
    val zipcode: String? = null,
)

/** Envelope for location PATCH. */
@JsonClass(generateAdapter = true)
data class BusinessLocationUpdateResponse(
    val location: BusinessLocationDto? = null,
)

// Business media upload (A12.10 Create Business — logo)

/**
 * `POST /api/upload/business-media/:businessId?type=logo|banner` response
 * (`backend/routes/upload.js:1797`). The server has already written the URL
 * onto the business profile, so callers only need the echoed `url` to
 * render the freshly-uploaded image.
 */
@JsonClass(generateAdapter = true)
data class BusinessMediaUploadResponse(
    val message: String? = null,
    val url: String,
    val key: String? = null,
)
