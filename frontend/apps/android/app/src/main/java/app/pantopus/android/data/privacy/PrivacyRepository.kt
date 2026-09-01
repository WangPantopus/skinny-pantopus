package app.pantopus.android.data.privacy

import app.pantopus.android.data.api.models.settings.PrivacyBlocksResponse
import app.pantopus.android.data.api.models.settings.PrivacySettingsResponse
import app.pantopus.android.data.api.models.settings.PrivacySettingsUpdate
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.PrivacyApi
import javax.inject.Inject
import javax.inject.Singleton

/** Wraps `/api/privacy/[*]` in the [NetworkResult] taxonomy. */
@Singleton
class PrivacyRepository
    @Inject
    constructor(
        private val api: PrivacyApi,
    ) {
        suspend fun settings(): NetworkResult<PrivacySettingsResponse> = safeApiCall { api.settings() }

        suspend fun updateSettings(body: PrivacySettingsUpdate): NetworkResult<PrivacySettingsResponse> =
            safeApiCall {
                api.updateSettings(
                    body,
                )
            }

        suspend fun blocks(): NetworkResult<PrivacyBlocksResponse> = safeApiCall { api.blocks() }

        /** `DELETE /api/privacy/blocks/:blockId` — remove a single block
         *  row. Returns `Unit` on success; callers should rollback their
         *  optimistic state on `NetworkResult.Failure`. */
        suspend fun deleteBlock(blockId: String): NetworkResult<Unit> = safeApiCall { api.deleteBlock(blockId) }
    }
