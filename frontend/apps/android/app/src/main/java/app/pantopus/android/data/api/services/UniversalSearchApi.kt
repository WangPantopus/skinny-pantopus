package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.universalsearch.UniversalSearchBusinessesResponse
import app.pantopus.android.data.api.models.universalsearch.UniversalSearchGigsResponse
import app.pantopus.android.data.api.models.universalsearch.UniversalSearchHomesResponse
import app.pantopus.android.data.api.models.universalsearch.UniversalSearchPeopleResponse
import app.pantopus.android.data.api.models.universalsearch.UniversalSearchProfilesResponse
import retrofit2.http.GET
import retrofit2.http.Query

/**
 * S2 — Universal search. One screen fans out across five independent
 * backend search surfaces (tasks / people / beacons / businesses /
 * homes). Each route lives in a different backend router, so they are
 * collected here rather than piled into the five feature APIs.
 *
 * Endpoint drift vs. the RN parity doc: the doc quotes
 * `GET api/identity-search`; the real mount is `api/identity`
 * (`backend/app.js:357`) plus `router.get('/search', …)`
 * (`backend/routes/identitySearch.js:370`) → `GET api/identity/search`.
 */
interface UniversalSearchApi {
    /**
     * `GET api/gigs/search?q=&limit=&status=` — route
     * `backend/routes/gigs.js:1822` (mounted `backend/app.js:309`).
     * Rejects a `q` shorter than 2 characters with a 400, so callers
     * must gate on `query.length >= 2`. `limit` is capped at 50
     * server-side.
     */
    @GET("api/gigs/search")
    suspend fun gigs(
        @Query("q") query: String,
        @Query("limit") limit: Int,
        @Query("status") status: String = "open",
    ): UniversalSearchGigsResponse

    /**
     * `GET api/users/search?q=&type=&limit=` — route
     * `backend/routes/users.js:2367` (mounted `backend/app.js:306`).
     * `type` is validated against `all | people | business`; the People
     * tab passes `people` so business accounts stay in the Businesses
     * tab. `limit` is capped at 20 server-side.
     */
    @GET("api/users/search")
    suspend fun people(
        @Query("q") query: String,
        @Query("limit") limit: Int,
        @Query("type") type: String = "people",
    ): UniversalSearchPeopleResponse

    /**
     * `GET api/identity/search?q=&scope=&limit=` — route
     * `backend/routes/identitySearch.js:370`.
     *
     * **Feature-gated.** `backend/app.js:357` only mounts
     * `api/identity` inside `if (isIdentityFirewallEnabled())`, so on a
     * deployment with the Identity Firewall off this 404s. Callers must
     * treat `NetworkError.NotFound` as "this surface is unavailable"
     * and keep the rest of the screen rendering.
     *
     * `scope` is validated against `all | local_profiles |
     * public_profiles`; the Beacons tab passes `public_profiles` so the
     * response only carries `type == "public_profile"` rows.
     */
    @GET("api/identity/search")
    suspend fun profiles(
        @Query("q") query: String,
        @Query("limit") limit: Int,
        @Query("scope") scope: String = "public_profiles",
    ): UniversalSearchProfilesResponse

    /**
     * `GET api/businesses/discover?q=&limit=` — route
     * `backend/routes/businesses.js:832` (mounted `backend/app.js:348`).
     * Returns published `BusinessProfile` rows only. Rejects a `q`
     * shorter than 2 characters with a 400.
     */
    @GET("api/businesses/discover")
    suspend fun businesses(
        @Query("q") query: String,
        @Query("limit") limit: Int,
    ): UniversalSearchBusinessesResponse

    /**
     * `GET api/homes/discover?q=&limit=` — route
     * `backend/routes/home.js:2297` (mounted `backend/app.js:326`).
     * Only surfaces `visibility == "public_preview"` homes whose
     * `privacy_mask_level` is `normal`. Rejects a `q` shorter than 2
     * characters with a 400.
     */
    @GET("api/homes/discover")
    suspend fun homes(
        @Query("q") query: String,
        @Query("limit") limit: Int,
    ): UniversalSearchHomesResponse
}
