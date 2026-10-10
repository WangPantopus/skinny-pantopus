package app.pantopus.android.data.profile

import app.pantopus.android.data.api.models.profile.PublicProfileDto
import app.pantopus.android.data.api.models.users.ProfileResponse
import app.pantopus.android.data.api.models.users.ProfileUpdateRequest
import app.pantopus.android.data.api.models.users.ProfileUpdateResponse
import app.pantopus.android.data.api.models.users.UpdateSkillsRequest
import app.pantopus.android.data.api.models.users.UpdateSkillsResponse
import app.pantopus.android.data.api.models.users.UserSearchResponse
import app.pantopus.android.data.api.models.users.UserStatsDto
import app.pantopus.android.data.api.models.users.UsernameAvailabilityDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.conditionalApiCall
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.UsersApi
import app.pantopus.android.data.store.ScreenStore
import app.pantopus.android.data.store.StoreKeys
import app.pantopus.android.data.store.StoreTopics
import app.pantopus.android.data.store.Stored
import app.pantopus.android.data.store.asResult
import javax.inject.Inject
import javax.inject.Singleton

/** Wraps the user-profile routes in the [NetworkResult] taxonomy. */
@Singleton
class ProfileRepository
    @Inject
    constructor(
        private val api: UsersApi,
        private val store: ScreenStore,
    ) {
        /** `GET /api/users/id/:id` — route `backend/routes/users.js:2041`. */
        suspend fun publicProfile(
            id: String,
            force: Boolean = false,
        ): NetworkResult<PublicProfileDto> {
            val stored =
                store.read(
                    StoreKeys.publicProfile(id),
                    force,
                ) { etag -> conditionalApiCall { api.publicProfileConditional(id, etag) } }
            return stored.data?.let { NetworkResult.Success(it) } ?: stored.asResult()
        }

        fun publicProfileCopy(id: String): Stored<PublicProfileDto> = store.peek(StoreKeys.publicProfile(id))

        /** `GET /api/users/profile` — route `backend/routes/users.js:1962`. */
        suspend fun ownProfile(): NetworkResult<ProfileResponse> =
            ownProfileStored().let { it.data?.let { data -> NetworkResult.Success(data) } ?: it.asResult() }

        /** The viewer's profile through the screens' store (fresh 10 minutes; [force] reads now). */
        suspend fun ownProfileStored(force: Boolean = false): Stored<ProfileResponse> =
            store.read(StoreKeys.ownProfile, force) { etag -> conditionalApiCall { api.profileConditional(etag) } }

        /** The stored profile as it is now, without a request. */
        fun ownProfileCopy(): ProfileResponse? = store.peek(StoreKeys.ownProfile).data

        /** True while the stored profile is fresh and no topic marked it out of date. */
        fun ownProfileIsCurrent(): Boolean = store.isCurrent(StoreKeys.ownProfile)

        /** `PATCH /api/users/profile` — route `backend/routes/users.js:2052`. */
        suspend fun updateProfile(body: ProfileUpdateRequest): NetworkResult<ProfileUpdateResponse> =
            safeApiCall { api.updateProfile(body) }.also { if (it is NetworkResult.Success) store.markEdited(StoreTopics.PROFILE_ME) }

        /**
         * `PUT /api/users/skills` — replace the caller's whole skill
         * list. Route `backend/routes/users.js:2246`. The handler trims,
         * dedupes and caps the list, then echoes the cleaned array.
         */
        suspend fun updateSkills(skills: List<String>): NetworkResult<UpdateSkillsResponse> =
            safeApiCall { api.updateSkills(UpdateSkillsRequest(skills = skills)) }
                .also { if (it is NetworkResult.Success) store.markEdited(StoreTopics.PROFILE_ME) }

        /**
         * `GET /api/users/username-availability?username=` — can the signed-in person change their
         * username to this one? Route `backend/routes/users.js` (`router.get('/username-availability'`).
         */
        suspend fun usernameAvailability(username: String): NetworkResult<UsernameAvailabilityDto> =
            safeApiCall { api.usernameAvailability(username) }

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
