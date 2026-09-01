package app.pantopus.android.data.blocks

import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.BlocksApi
import javax.inject.Inject
import javax.inject.Singleton

/** Wraps the block/unblock endpoints in the [NetworkResult] taxonomy. */
@Singleton
class BlocksRepository
    @Inject
    constructor(
        private val api: BlocksApi,
    ) {
        /**
         * `POST /api/users/:userId/block` — block another user.
         * Route `backend/routes/blocks.js:13`.
         */
        suspend fun block(userId: String): NetworkResult<Unit> = safeApiCall { api.block(userId) }

        /**
         * `DELETE /api/users/:userId/block` — unblock a user.
         * Route `backend/routes/blocks.js:101`.
         */
        suspend fun unblock(userId: String): NetworkResult<Unit> = safeApiCall { api.unblock(userId) }
    }
