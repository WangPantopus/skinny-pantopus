package app.pantopus.android.data.social

import app.pantopus.android.data.api.models.profile.PublicProfileDto
import app.pantopus.android.data.api.models.users.FollowActionResponse
import app.pantopus.android.data.api.models.users.UserRelationshipDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.UserSocialApi
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
    ) {
        /** `GET /api/users/username/:username` — `backend/routes/users.js:3367`. */
        suspend fun publicProfileByUsername(username: String): NetworkResult<PublicProfileDto> =
            safeApiCall { api.publicProfileByUsername(normalizeHandle(username)) }

        /** `POST /api/users/:id/follow` — `backend/routes/users.js:3520`. */
        suspend fun follow(userId: String): NetworkResult<FollowActionResponse> = safeApiCall { api.follow(userId) }

        /** `DELETE /api/users/:id/follow` — `backend/routes/users.js:3593`. */
        suspend fun unfollow(userId: String): NetworkResult<FollowActionResponse> = safeApiCall { api.unfollow(userId) }

        /** `GET /api/users/:id/relationship` — `backend/routes/users.js:3685`. */
        suspend fun relationship(userId: String): NetworkResult<UserRelationshipDto> = safeApiCall { api.relationship(userId) }

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
