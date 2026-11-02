package app.pantopus.android.data.ai

import app.pantopus.android.data.api.models.ai.AIRuleChangeBody
import app.pantopus.android.data.api.models.ai.AIRuleDto
import app.pantopus.android.data.api.models.ai.AIRulesResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.AIApi
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Settings → What Pantopus does for you (AI assistant phase 3 contract §18.5): the person's standing rules. A rule is
 * turned on only from a card in the assistant; here it can be switched off or on, extended (a weekly plan) or deleted.
 */
@Singleton
class AIRulesRepository
    @Inject
    constructor(
        private val api: AIApi,
    ) {
        suspend fun list(): NetworkResult<AIRulesResponse> = safeApiCall { api.rules() }

        suspend fun setEnabled(
            id: String,
            enabled: Boolean,
        ): NetworkResult<AIRuleDto> = safeApiCall { api.changeRule(id, AIRuleChangeBody(enabled = enabled)).rule }

        suspend fun extend(id: String): NetworkResult<AIRuleDto> = safeApiCall { api.changeRule(id, AIRuleChangeBody(extend = true)).rule }

        suspend fun delete(id: String): NetworkResult<Unit> = safeApiCall { api.deleteRule(id) }
    }
