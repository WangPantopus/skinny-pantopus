package app.pantopus.android.data.handshake

import app.pantopus.android.data.api.models.audience.PersonaMeResponse
import app.pantopus.android.data.api.models.audience.PersonaTiersResponse
import app.pantopus.android.data.api.models.handshake.FanHandleSuggestionResponse
import app.pantopus.android.data.api.models.handshake.FollowPreferencesBody
import app.pantopus.android.data.api.models.handshake.FollowPreferencesResponse
import app.pantopus.android.data.api.models.handshake.FollowStatusResponse
import app.pantopus.android.data.api.models.handshake.HandshakeBody
import app.pantopus.android.data.api.models.handshake.HandshakeSubmitResponse
import app.pantopus.android.data.api.models.handshake.HandshakeValidationErrorDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.PrivacyHandshakeApi
import com.squareup.moshi.Moshi
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Wraps `/api/personas/[*]` handshake calls in [NetworkResult]. The
 * submit() helper unwraps Retrofit's `Response<T>` so callers can
 * branch on the typed [HandshakeError] without re-parsing the body.
 */
@Singleton
class PrivacyHandshakeRepository
    @Inject
    constructor(
        private val api: PrivacyHandshakeApi,
        private val moshi: Moshi,
    ) {
        suspend fun persona(handle: String): NetworkResult<PersonaMeResponse> = safeApiCall { api.persona(handle) }

        suspend fun tiers(handle: String): NetworkResult<PersonaTiersResponse> = safeApiCall { api.tiers(handle) }

        suspend fun fanHandleSuggestion(handle: String): NetworkResult<FanHandleSuggestionResponse> =
            safeApiCall { api.fanHandleSuggestion(handle) }

        suspend fun followStatus(personaId: String): NetworkResult<FollowStatusResponse> = safeApiCall { api.followStatus(personaId) }

        suspend fun updatePreferences(
            personaId: String,
            body: FollowPreferencesBody,
        ): NetworkResult<FollowPreferencesResponse> = safeApiCall { api.updatePreferences(personaId, body) }

        /** Returns either the success payload or a typed [HandshakeError]. */
        suspend fun submit(
            personaId: String,
            body: HandshakeBody,
        ): HandshakeOutcome =
            try {
                val response = api.submit(personaId, body)
                if (response.isSuccessful) {
                    val payload =
                        response.body()
                            ?: return HandshakeOutcome.Error(HandshakeError.Other("Empty response body."))
                    HandshakeOutcome.Success(payload)
                } else {
                    HandshakeOutcome.Error(parseErrorBody(response.code(), response.errorBody()?.string()))
                }
            } catch (t: Throwable) {
                HandshakeOutcome.Error(HandshakeError.Other(t.message ?: "Couldn't follow. Try again."))
            }

        private fun parseErrorBody(
            statusCode: Int,
            body: String?,
        ): HandshakeError {
            val parsed =
                body?.let {
                    runCatching { moshi.adapter(HandshakeValidationErrorDto::class.java).fromJson(it) }
                        .getOrNull()
                }
            return when (statusCode) {
                409 -> HandshakeError.HandleTaken
                400 -> {
                    if (parsed?.code == "pantopus_username_requires_ack") {
                        HandshakeError.UsernameRequiresAck
                    } else {
                        HandshakeError.Validation(parsed?.error)
                    }
                }
                else -> HandshakeError.Other(parsed?.error ?: "Couldn't follow. Try again.")
            }
        }
    }

/** Discriminated union for the handshake submit outcome. */
sealed interface HandshakeOutcome {
    data class Success(val response: HandshakeSubmitResponse) : HandshakeOutcome

    data class Error(val error: HandshakeError) : HandshakeOutcome
}

sealed interface HandshakeError {
    data object HandleTaken : HandshakeError

    data object UsernameRequiresAck : HandshakeError

    data class Validation(val message: String?) : HandshakeError

    data class Other(val message: String) : HandshakeError
}
