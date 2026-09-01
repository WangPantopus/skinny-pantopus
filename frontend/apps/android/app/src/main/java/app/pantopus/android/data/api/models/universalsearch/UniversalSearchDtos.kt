package app.pantopus.android.data.api.models.universalsearch

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

// ─── GET api/gigs/search ──────────────────────────────────────
//
// S2 — Universal search decodables. Five independent backend handlers,
// five envelopes. Each DTO decodes only the fields the universal-search
// row renders, so a projection change in an unrelated feature can't
// break this screen. Mirrors iOS
// `Core/Networking/Models/UniversalSearch/UniversalSearchDTOs.swift`.

/** `{ gigs: [...], total }` — route `backend/routes/gigs.js:1822`. */
@JsonClass(generateAdapter = true)
data class UniversalSearchGigsResponse(
    val gigs: List<UniversalSearchGigDto> = emptyList(),
)

/**
 * One task row. Projection built at `backend/routes/gigs.js:1897`
 * (spatial branch) and `backend/routes/gigs.js:2046` (non-spatial
 * branch) — both emit `poster_profile_picture_url`.
 */
@JsonClass(generateAdapter = true)
data class UniversalSearchGigDto(
    val id: String,
    val title: String? = null,
    val category: String? = null,
    val price: Double? = null,
    @Json(name = "poster_profile_picture_url") val posterProfilePictureUrl: String? = null,
)

// ─── GET api/users/search ─────────────────────────────────────

/**
 * `{ users: [...] }` — route `backend/routes/users.js:2367`, rows built
 * by `serializeCompatibilitySearchUser` (`backend/routes/users.js:293`).
 * That serializer already emits camelCase (`profilePicture`), so only
 * the nested casing differs from the other four handlers.
 */
@JsonClass(generateAdapter = true)
data class UniversalSearchPeopleResponse(
    val users: List<UniversalSearchPersonDto> = emptyList(),
)

/**
 * One person row. `city` / `state` are suppressed server-side when the
 * local profile's `show_neighborhood` flag is false.
 */
@JsonClass(generateAdapter = true)
data class UniversalSearchPersonDto(
    val id: String,
    val username: String? = null,
    val name: String? = null,
    val profilePicture: String? = null,
    val city: String? = null,
    val state: String? = null,
)

// ─── GET api/identity/search ──────────────────────────────────

/**
 * `{ results: [...], counts: {...} }` — route
 * `backend/routes/identitySearch.js:370`. Rows are already camelCase
 * (`imageUrl`), built by `publicProfileResult`
 * (`backend/routes/identitySearch.js:328`).
 */
@JsonClass(generateAdapter = true)
data class UniversalSearchProfilesResponse(
    val results: List<UniversalSearchProfileDto> = emptyList(),
)

/**
 * One profile-discovery row. `type` is `public_profile` (Beacon) or
 * `local_profile`; the Beacons tab renders only the former, matching RN
 * `src/app/discover.tsx:151`.
 */
@JsonClass(generateAdapter = true)
data class UniversalSearchProfileDto(
    val id: String,
    val type: String? = null,
    val title: String? = null,
    val subtitle: String? = null,
    val meta: String? = null,
    val imageUrl: String? = null,
    /**
     * `/@handle` or `/persona/handle` — the handle the Beacon profile
     * route needs is parsed out of this.
     */
    val href: String? = null,
)

// ─── GET api/businesses/discover ──────────────────────────────

/** `{ businesses: [...] }` — route `backend/routes/businesses.js:832`. */
@JsonClass(generateAdapter = true)
data class UniversalSearchBusinessesResponse(
    val businesses: List<UniversalSearchBusinessDto> = emptyList(),
)

/** One business row. Projection built at `backend/routes/businesses.js:933`. */
@JsonClass(generateAdapter = true)
data class UniversalSearchBusinessDto(
    val id: String,
    val username: String? = null,
    val name: String? = null,
    @Json(name = "profile_picture_url") val profilePictureUrl: String? = null,
    val city: String? = null,
    val state: String? = null,
    @Json(name = "business_type") val businessType: String? = null,
)

// ─── GET api/homes/discover ───────────────────────────────────

/**
 * `{ homes: [...] }` — route `backend/routes/home.js:2297`.
 *
 * Deliberately separate from the wider
 * `data.api.models.homediscovery.HomeDiscoverResponse`, which decodes
 * the find-or-add-home shape; universal search needs only the row
 * fields it renders.
 */
@JsonClass(generateAdapter = true)
data class UniversalSearchHomesResponse(
    val homes: List<UniversalSearchHomeDto> = emptyList(),
)

/** One home row. Projection built at `backend/routes/home.js:2400`. */
@JsonClass(generateAdapter = true)
data class UniversalSearchHomeDto(
    val id: String,
    val name: String? = null,
    val address: String? = null,
    val city: String? = null,
    val state: String? = null,
    @Json(name = "home_type") val homeType: String? = null,
    val owner: UniversalSearchHomeOwnerDto? = null,
)

/** Nested owner projection on a home discover row. */
@JsonClass(generateAdapter = true)
data class UniversalSearchHomeOwnerDto(
    val id: String? = null,
    val username: String? = null,
    val name: String? = null,
    @Json(name = "profile_picture_url") val profilePictureUrl: String? = null,
)
