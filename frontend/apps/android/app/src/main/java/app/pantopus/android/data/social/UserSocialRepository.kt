package app.pantopus.android.data.social

import app.pantopus.android.data.api.models.profile.PublicProfileDto
import app.pantopus.android.data.api.models.users.FollowActionResponse
import app.pantopus.android.data.api.models.users.UserRelationshipDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.conditionalApiCall
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.UserSocialApi
import app.pantopus.android.data.store.ScreenStore
import app.pantopus.android.data.store.StoreKeys
import app.pantopus.android.data.store.StoreTopics
import app.pantopus.android.data.store.Stored
import app.pantopus.android.data.store.asResult
import javax.inject.Inject
import javax.inject.Singleton

/**
 * T3 — handle resolution + the plain follow graph, wrapped in the
 * [NetworkResult] taxonomy. Mirrors iOS `UserSocialEndpoints`.
 */
@Singleton
class UserSocialRepository
    @Inject
    constructor(
        private val api: UserSocialApi,
        private val store: ScreenStore,
    ) {
        /** `GET /api/users/username/:username` — `backend/routes/users.js:3367`. */
        suspend fun publicProfileByUsername(
            username: String,
            force: Boolean = false,
        ): NetworkResult<PublicProfileDto> {
            val handle = normalizeHandle(username)
            val stored =
                store.read(StoreKeys.publicProfile(handle, byUsername = true), force) { etag ->
                    conditionalApiCall { api.publicProfileByUsernameConditional(handle, etag) }
                }
            return stored.data?.let { NetworkResult.Success(it) } ?: stored.asResult()
        }

        fun publicProfileCopy(username: String): Stored<PublicProfileDto> =
            store.peek(StoreKeys.publicProfile(normalizeHandle(username), byUsername = true))

        /** `POST /api/users/:id/follow` — `backend/routes/users.js:3520`. */
        suspend fun follow(userId: String): NetworkResult<FollowActionResponse> = safeApiCall { api.follow(userId) }.changed()

        /** `DELETE /api/users/:id/follow` — `backend/routes/users.js:3593`. */
        suspend fun unfollow(userId: String): NetworkResult<FollowActionResponse> = safeApiCall { api.unfollow(userId) }.changed()

        /** `GET /api/users/:id/relationship` — `backend/routes/users.js:3685`. */
        suspend fun relationship(userId: String): NetworkResult<UserRelationshipDto> = safeApiCall { api.relationship(userId) }

        private fun <T> NetworkResult<T>.changed(): NetworkResult<T> =
            also {
                if (it is NetworkResult.Success) store.markStale(StoreTopics.PROFILE_ME)
            }

        companion object {
            private val UUID_REGEX =
                Regex(
                    "^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
                    RegexOption.IGNORE_CASE,
                )

            /**
             * `true` when the route param looks like a canonical v1–v5 UUID.
             * Mirrors the RN `UUID_REGEX` guard at
             * `pantopus/frontend/apps/mobile/src/app/user/[id].tsx:27`, which
             * is what decides between `api/users/id/:id` and
             * `api/users/username/:username`.
             */
            fun isUuid(value: String): Boolean = UUID_REGEX.matches(value.trim())

            /** Strip a leading `@` — RN's `normalizeUsername`. */
            fun normalizeHandle(value: String): String = value.trim().trimStart('@')
        }
    }
