@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.claim_evidence

import app.pantopus.android.data.api.models.homes.HomeEvidenceSessionDto
import app.pantopus.android.data.api.models.homes.HomePrivateEvidenceDto
import app.pantopus.android.data.api.models.homes.HomePrivateEvidenceList
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HOME_EVIDENCE_MAX_BYTES
import app.pantopus.android.data.homes.HOME_EVIDENCE_MIMES
import app.pantopus.android.data.homes.HOME_EVIDENCE_TYPES
import app.pantopus.android.data.homes.HomePrivateEvidenceRepository
import app.pantopus.android.ui.screens.homes.claim_review.CLAIM_SESSION_CHANGED
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimReviewSnapshot
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimSessionScope
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimSessionScopeFactory
import kotlinx.coroutines.CoroutineScope
import javax.inject.Inject

class HomePrivateEvidenceAccessFactory
    @Inject
    constructor(
        private val sessions: HomeClaimSessionScopeFactory,
        private val repository: HomePrivateEvidenceRepository,
    ) {
        fun session(scope: CoroutineScope): HomeClaimSessionScope = sessions.create(scope)

        fun create(
            session: HomeClaimSessionScope,
            homeId: String,
            claimId: String,
            platform: Boolean = false,
        ) = HomePrivateEvidenceAccess(session, repository, homeId, claimId, platform)
    }

/** One opening identity owns this instance; a delayed first read cannot rebind it. */
class HomePrivateEvidenceAccess(
    val session: HomeClaimSessionScope,
    private val repository: HomePrivateEvidenceRepository,
    private val homeId: String,
    private val claimId: String,
    private val platform: Boolean,
) {
    private var server: HomeEvidenceSessionDto? = null

    suspend fun list(): HomePrivateEvidenceList {
        session.requireCurrent()
        val result = repository.list(homeId, claimId, server?.sessionScope, platform).value()
        session.requireCurrent()
        val actual = result.claimSession
        check(
            actual.homeId == homeId && actual.claimId == claimId && actual.actorId == session.actorId &&
                HomeClaimReviewSnapshot.validToken(actual.sessionScope) && (server == null || actual == server),
        ) { CLAIM_SESSION_CHANGED }
        result.evidence.forEach { validate(it) }
        server = actual
        return result
    }

    suspend fun upload(
        uploadId: String,
        type: String,
        name: String,
        mime: String,
        bytes: ByteArray,
    ): HomePrivateEvidenceDto {
        list()
        val result = repository.upload(requireNotNull(server), uploadId, type, name, mime, bytes).value().evidence
        session.requireCurrent()
        validate(result, uploadId)
        check(
            result.state == "ready" && result.available && result.evidenceType == type && result.fileName == name &&
                result.mimeType == mime && result.fileSize == bytes.size.toLong(),
        ) { "Could not confirm the saved document. Retry the same upload." }
        val current = list().evidence.singleOrNull { it.id == uploadId }
        check(current == result) { "The document changed. Reload the claim." }
        return result
    }

    suspend fun read(
        evidenceId: String,
        reviewToken: String? = null,
    ): app.pantopus.android.data.homes.HomeEvidenceBytes {
        val before = list()
        val record = before.evidence.singleOrNull { it.id == evidenceId }
        check(record != null && record.available && record.state == "ready") { "This document is unavailable. Reload the claim." }
        if (reviewToken != null) {
            check(before.canVerify && before.reviewToken == reviewToken && HomeClaimReviewSnapshot.validToken(reviewToken)) {
                "The claim changed. Review its current evidence."
            }
        }
        val download = repository.download(requireNotNull(server), evidenceId, platform, reviewToken).value()
        var delivered = false
        try {
            session.requireCurrent()
            val after = list()
            check(
                after.evidence.singleOrNull { it.id == evidenceId } == record && download.bytes.size.toLong() == record.fileSize &&
                    download.mimeType == record.mimeType,
            ) { "The document changed. Open it again." }
            if (reviewToken != null) {
                check(after.canVerify && after.reviewToken == reviewToken && HomeClaimReviewSnapshot.validToken(download.inspection)) {
                    "Could not confirm the inspected document. Open it again."
                }
            }
            delivered = true
            return download
        } finally {
            if (!delivered) download.bytes.fill(0)
        }
    }

    suspend fun verify(
        evidenceId: String,
        reviewToken: String,
        inspection: String,
    ): String {
        list()
        val result = repository.verify(requireNotNull(server), evidenceId, platform, reviewToken, inspection).value()
        session.requireCurrent()
        validate(result.record, evidenceId)
        check(
            result.ok && result.homeId == homeId && result.claimId == claimId && result.uploadId == evidenceId &&
                result.action == "verify_evidence" && result.record.status == "verified" && result.record.eligibleForReview &&
                result.record.state == "ready" && HomeClaimReviewSnapshot.validToken(result.reviewToken),
        ) {
            "Could not confirm verification. Retry the same decision."
        }
        val after = list()
        check(after.reviewToken == result.reviewToken && after.evidence.singleOrNull { it.id == evidenceId } == result.record) {
            "The claim changed. Reload it before another decision."
        }
        return result.reviewToken
    }

    suspend fun remove(evidenceId: String): HomePrivateEvidenceDto {
        list()
        val result = repository.remove(requireNotNull(server), evidenceId).value().evidence
        session.requireCurrent()
        validate(result, evidenceId)
        check(result.state == "retired" && !result.available) { "Could not confirm removal. Retry it." }
        list()
        return result
    }

    private fun validate(
        record: HomePrivateEvidenceDto,
        evidenceId: String = record.id,
    ) {
        check(
            record.homeId == homeId && record.claimId == claimId && record.id == evidenceId &&
                record.evidenceType in HOME_EVIDENCE_TYPES && record.mimeType in HOME_EVIDENCE_MIMES &&
                record.fileSize in 1..HOME_EVIDENCE_MAX_BYTES.toLong() && record.fileName.isNotBlank() &&
                record.state in setOf("reserved", "ready", "retired"),
        ) { "Unexpected private document response. Reopen the claim." }
    }

    private fun <T> NetworkResult<T>.value(): T =
        when (this) {
            is NetworkResult.Success -> data
            is NetworkResult.Failure -> throw error
        }
}

internal fun HomePrivateEvidenceDto.hasPendingRetirement(): Boolean = status != "verified" && (state != "retired" || cleanupPending)
