package app.pantopus.android.data.ai

import app.pantopus.android.data.api.models.ai.AIMemoryEditBody
import app.pantopus.android.data.api.models.ai.AIMemoryForgetAllResponse
import app.pantopus.android.data.api.models.ai.AIMemoryItemDto
import app.pantopus.android.data.api.models.ai.AIMemoryListResponse
import app.pantopus.android.data.api.models.ai.AIMemoryReviewedResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.AIApi
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Settings → What Pantopus remembers (AI assistant phase 3 contract §5.4, §5.7): the person's own items, which only they
 * see. An item is added only from a Remember card in the assistant; here it can be edited, forgotten, or confirmed for
 * another year.
 */
@Singleton
class AIMemoryRepository
    @Inject
    constructor(
        private val api: AIApi,
    ) {
        suspend fun list(): NetworkResult<AIMemoryListResponse> = safeApiCall { api.memory() }

        suspend fun edit(
            id: String,
            fact: String,
        ): NetworkResult<AIMemoryItemDto> = safeApiCall { api.editMemory(id, AIMemoryEditBody(fact)).item }

        suspend fun forget(id: String): NetworkResult<Unit> = safeApiCall { api.forgetMemory(id) }

        suspend fun forgetAll(): NetworkResult<AIMemoryForgetAllResponse> = safeApiCall { api.forgetAllMemory() }

        suspend fun reviewed(): NetworkResult<AIMemoryReviewedResponse> = safeApiCall { api.memoryReviewed() }
    }
