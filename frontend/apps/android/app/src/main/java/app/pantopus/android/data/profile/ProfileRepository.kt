package app.pantopus.android.data.profile

import app.pantopus.android.data.api.models.profile.PublicProfileDto
import app.pantopus.android.data.api.models.users.ProfileResponse
import app.pantopus.android.data.api.models.users.ProfileUpdateRequest
import app.pantopus.android.data.api.models.users.ProfileUpdateResponse
import app.pantopus.android.data.api.models.users.UpdateSkillsRequest
import app.pantopus.android.data.api.models.users.UpdateSkillsResponse
import app.pantopus.android.data.api.models.users.UserSearchResponse
import app.pantopus.android.data.api.models.users.UserStatsDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.UsersApi
import javax.inject.Inject
import javax.inject.Singleton

/** Wraps the user-profile routes in the [NetworkResult] taxonomy. */
@Singleton
class ProfileRepository
    @Inject
    constructor(
        private val api: UsersApi,
    ) {
        /** `GET /api/users/id/:id` — route `backend/routes/users.js:2041`. */
        suspend fun publicProfile(id: String): NetworkResult<PublicProfileDto> = safeApiCall { api.publicProfile(id) }

        /** `GET /api/users/profile` — route `backend/routes/users.js:1962`. */
        suspend fun ownProfile(): NetworkResult<ProfileResponse> = safeApiCall { api.profile() }

        /** `PATCH /api/users/profile` — route `backend/routes/users.js:2052`. */
        suspend fun updateProfile(body: ProfileUpdateRequest): NetworkResult<ProfileUpdateResponse> =
            safeApiCall { api.updateProfile(body) }

        /**
         * `PUT /api/users/skills` — replace the caller's whole skill
         * list. Route `backend/routes/users.js:2246`. The handler trims,
         * dedupes and caps the list, then echoes the cleaned array.
         */
        suspend fun updateSkills(skills: List<String>): NetworkResult<UpdateSkillsResponse> =
            safeApiCall { api.updateSkills(UpdateSkillsRequest(skills = skills)) }

        /** `GET /api/users/:id/stats` — route `backend/routes/users.js:2787`. */
        suspend fun stats(userId: String): NetworkResult<UserStatsDto> = safeApiCall { api.stats(userId) }

        /**
         * `GET /api/users/search?q=…&type=…&limit=…` — verified-user
         * directory search. Route `backend/routes/users.js:2367`. The
         * backend rejects `q` under 2 characters; callers must gate.
         */
        suspend fun search(
            query: String,
            limit: Int = 20,
            type: String = "all",
        ): NetworkResult<UserSearchResponse> =
            safeApiCall {
                api.search(query = query, limit = limit, type = type)
            }
    }
