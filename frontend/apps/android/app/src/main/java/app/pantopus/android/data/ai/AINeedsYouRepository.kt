package app.pantopus.android.data.ai

import app.pantopus.android.data.api.models.ai.AINeedsYouResponse
import app.pantopus.android.data.api.net.conditionalApiCall
import app.pantopus.android.data.api.services.AIApi
import app.pantopus.android.data.store.ScreenStore
import app.pantopus.android.data.store.StoreKeys
import app.pantopus.android.data.store.Stored
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Today's Needs you card (AI assistant phase 3 contract §6): what waits on the person, read through the screens' store
 * so the last list shows at once and then refreshes.
 */
@Singleton
class AINeedsYouRepository
    @Inject
    constructor(
        private val api: AIApi,
        private val store: ScreenStore,
    ) {
        /** The list through the store (fresh 30 seconds; [force] reads now, for a pull). */
        suspend fun needsYouStored(force: Boolean = false): Stored<AINeedsYouResponse> =
            store.read(StoreKeys.needsYou, force) { etag -> conditionalApiCall { api.needsYou(etag) } }

        /** The stored list as it is now, without a request. */
        fun needsYouCopy(): AINeedsYouResponse? = store.peek(StoreKeys.needsYou).data
    }
