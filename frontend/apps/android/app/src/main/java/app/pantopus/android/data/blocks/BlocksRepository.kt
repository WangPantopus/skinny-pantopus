package app.pantopus.android.data.blocks

import app.pantopus.android.data.api.models.settings.UserBlocksResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.BlocksApi
import app.pantopus.android.data.store.ScreenStore
import app.pantopus.android.data.store.StoreTopics
import javax.inject.Inject
import javax.inject.Singleton

/** Wraps the block/unblock endpoints in the [NetworkResult] taxonomy. */
@Singleton
class BlocksRepository
    @Inject
    constructor(
        private val api: BlocksApi,
        private val store: ScreenStore,
    ) {
        /**
         * `POST /api/users/:userId/block` — block another user.
         * Route `backend/routes/blocks.js:13`.
         */
        suspend fun block(userId: String): NetworkResult<Unit> = safeApiCall { api.block(userId) }.changed()

        /**
         * `DELETE /api/users/:userId/block` — unblock a user.
         * Route `backend/routes/blocks.js:101`.
         */
        suspend fun unblock(userId: String): NetworkResult<Unit> = safeApiCall { api.unblock(userId) }.changed()

        /**
         * `GET /api/users/blocked` — the viewer's own personal blocks.
         * Route `backend/routes/blocks.js:138`.
         */
        suspend fun blocked(): NetworkResult<UserBlocksResponse> = safeApiCall { api.blocked() }

        private fun <T> NetworkResult<T>.changed(): NetworkResult<T> = also {
            if (it is NetworkResult.Success) {
                store.markEdited(StoreTopics.PROFILE_ME)
                store.markEdited(StoreTopics.POSTS)
            }
        }
    }
