package app.pantopus.android.data.privacy

import app.pantopus.android.data.api.models.settings.PrivacyBlocksResponse
import app.pantopus.android.data.api.models.settings.PrivacySettingsResponse
import app.pantopus.android.data.api.models.settings.PrivacySettingsUpdate
import app.pantopus.android.data.store.ScreenStore
import app.pantopus.android.data.store.StoreKeys
import app.pantopus.android.data.store.StoreTopics
import app.pantopus.android.data.store.asResult
import app.pantopus.android.data.api.net.conditionalApiCall
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
        private val store: ScreenStore,
    ) {
        fun settingsCopy(): PrivacySettingsResponse? = store.peek(StoreKeys.privacySettings).data

        suspend fun settings(force: Boolean = false): NetworkResult<PrivacySettingsResponse> =
            store.read(StoreKeys.privacySettings, force) { etag -> conditionalApiCall { api.settingsConditional(etag) } }.asResult()

        suspend fun updateSettings(body: PrivacySettingsUpdate): NetworkResult<PrivacySettingsResponse> =
            safeApiCall {
                api.updateSettings(
                    body,
                )
            }.also {
                if (it is NetworkResult.Success) {
                    store.remove(StoreKeys.privacySettings)
                    store.markEdited(StoreTopics.PROFILE_ME)
                }
            }

        suspend fun blocks(): NetworkResult<PrivacyBlocksResponse> = safeApiCall { api.blocks() }

        /** `DELETE /api/privacy/blocks/:blockId` — remove a single block
         *  row. Returns `Unit` on success; callers should rollback their
         *  optimistic state on `NetworkResult.Failure`. */
        suspend fun deleteBlock(blockId: String): NetworkResult<Unit> = safeApiCall { api.deleteBlock(blockId) }
    }
