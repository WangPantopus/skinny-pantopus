package app.pantopus.android.data.homes

import app.pantopus.android.data.api.services.HomeResidencyReviewApi
import kotlinx.coroutines.CancellationException
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody

interface HomeResidencyReviewTransport {
    suspend fun read(
        scope: HomeResidencyReviewScope,
        claimId: String,
        session: String?,
    ): HomeResidencyCurrentReview

    suspend fun decide(
        draft: PendingHomeResidencyReview,
        session: String,
    ): String
}

class APIHomeResidencyReviewTransport(
    private val api: HomeResidencyReviewApi,
    private val codec: HomeResidencyReviewCodec,
) : HomeResidencyReviewTransport {
    override suspend fun read(
        scope: HomeResidencyReviewScope,
        claimId: String,
        session: String?,
    ): HomeResidencyCurrentReview {
        try {
            check(scope.isValid() && homeTaskUUID(claimId))
            val response = api.read(scope.homeId, claimId, session)
            val bytes = (response.body() ?: response.errorBody())?.use { it.string() }
            check(response.code() == HTTP_OK)
            return codec.current(checkNotNull(bytes), scope, claimId, session)
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (_: Exception) {
            throw HomeResidencyReviewFailure(HomeResidencyReviewFailureKind.Unavailable)
        }
    }

    override suspend fun decide(
        draft: PendingHomeResidencyReview,
        session: String,
    ): String {
        try {
            check(codec.valid(draft, draft.scope) && HomeResidencyReviewCodec.reviewHash(session))
            val response =
                api.decide(
                    draft.scope.homeId,
                    draft.claimId,
                    draft.action.wire,
                    draft.requestJson.toRequestBody("application/json".toMediaType()),
                    session,
                )
            val json = (response.body() ?: response.errorBody())?.use { it.string() }
            val fields = codec.objectFrom(checkNotNull(json))
            if (response.code() != HTTP_OK) throw refusal(response.code(), fields["code"] as? String)
            val current = codec.current(fields, draft.scope, draft.claimId, session)
            check(fields["claim_id"] == draft.claimId && fields["target_id"] == current.applicantId)
            check(fields["action"] == draft.action.wire && fields["replayed"] is Boolean)
            return codec.receipt(codec.nested(fields["receipt"]), draft)
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (known: HomeResidencyReviewFailure) {
            throw known
        } catch (_: Exception) {
            throw HomeResidencyReviewFailure(HomeResidencyReviewFailureKind.Unknown)
        }
    }

    private fun refusal(
        status: Int,
        code: String?,
    ): HomeResidencyReviewFailure =
        HomeResidencyReviewFailure(
            when {
                status in FINAL_STATUSES && code in FINAL_CODES -> HomeResidencyReviewFailureKind.Refused
                status in DENIED_STATUSES || code == "SESSION_SCOPE_CHANGED" -> HomeResidencyReviewFailureKind.Unavailable
                else -> HomeResidencyReviewFailureKind.Unknown
            },
        )

    private companion object {
        const val HTTP_OK = 200
        val FINAL_STATUSES = setOf(403, 409)
        val DENIED_STATUSES = setOf(401, 403, 404)
        val FINAL_CODES =
            setOf(
                "RESIDENCY_REVIEW_CHANGED",
                "CLAIM_NOT_PENDING",
                "OWNERSHIP_FLOW_REQUIRED",
                "MEMBERSHIP_RENEWAL_REQUIRED",
                "RESIDENCY_ROLE_FORBIDDEN",
                "PROPOSED_ROLE_FORBIDDEN",
                "PERMISSION_DELEGATION_FORBIDDEN",
            )
    }
}
