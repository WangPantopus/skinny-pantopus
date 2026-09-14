@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.claim_evidence

import app.pantopus.android.data.api.models.homes.HomePrivateEvidenceDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.homes.HomeEvidenceBytes
import app.pantopus.android.ui.screens.homes.claim_review.CLAIM_SESSION_CHANGED
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimReviewSnapshot
import app.pantopus.android.ui.screens.homes.claim_review.isFinalHomeClaimFailure
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/** Document verification is separate from claim approval. No claim mutation repository is available here. */
class HomePrivateEvidenceController(
    parent: CoroutineScope,
    private val access: HomePrivateEvidenceAccess,
    private val claimant: Boolean,
    private val displayedReviewToken: String? = null,
) {
    private val job = SupervisorJob(parent.coroutineContext[Job])
    private val scope = CoroutineScope(parent.coroutineContext + job)
    private val _state = MutableStateFlow(HomePrivateEvidenceState())
    val state = _state.asStateFlow()
    private var closed = false
    private var expectedToken = displayedReviewToken
    private var pending: HomeEvidenceDecision? = null

    init {
        scope.launch(start = CoroutineStart.UNDISPATCHED) {
            access.session.invalidated.collect { if (it) invalidate() }
        }
        reload()
    }

    private fun current(): Boolean = !closed && access.session.isCurrent

    private fun requireCurrent() {
        check(current()) { CLAIM_SESSION_CHANGED }
    }

    fun reload() {
        if (!current() || _state.value.busy || pending != null) return
        clearPreview()
        _state.update { it.copy(documents = emptyList(), canVerify = false, canRemove = false, loading = true, busy = true, error = null) }
        launch {
            val list = access.list()
            requireCurrent()
            if (!claimant && expectedToken != null) {
                check(list.reviewToken == expectedToken) {
                    "The claim changed. Close this panel and reopen the claim."
                }
            }
            expectedToken = list.reviewToken
            _state.update {
                it.copy(
                    documents = list.evidence,
                    canVerify = !claimant && list.canVerify,
                    canRemove = claimant,
                    loading = false,
                    busy = false,
                )
            }
        }
    }

    fun open(document: HomePrivateEvidenceDto) {
        if (!canUse(document) || !document.available) return
        _state.update { it.copy(busy = true, error = null) }
        clearPreview()
        launch {
            val inspect = _state.value.canVerify && document.status != "verified"
            val token = if (inspect) expectedToken?.also { check(HomeClaimReviewSnapshot.validToken(it)) } else null
            val content = access.read(document.id, token)
            var delivered = false
            try {
                requireCurrent()
                _state.update { it.copy(busy = false, preview = HomeEvidencePreview(document, content, token)) }
                delivered = true
            } finally {
                if (!delivered) content.bytes.fill(0)
            }
        }
    }

    fun verify() {
        if (!current() || _state.value.busy) return
        val decision = pending ?: displayedDecision() ?: return
        pending = decision
        _state.update { it.copy(busy = true, error = null, retryVerification = true) }
        launch {
            val next = access.verify(decision.documentId, decision.reviewToken, decision.inspection)
            requireCurrent()
            expectedToken = next
            pending = null
            clearPreview()
            _state.update {
                it.copy(
                    busy = false,
                    retryVerification = false,
                    notice = "Document verified. Claim approval is a separate decision.",
                )
            }
            reload()
        }
    }

    fun remove(document: HomePrivateEvidenceDto) {
        if (!canUse(document) || !claimant || !document.hasPendingRetirement()) return
        _state.update { it.copy(busy = true, error = null) }
        clearPreview()
        launch {
            access.remove(document.id)
            requireCurrent()
            _state.update { it.copy(busy = false, notice = "Document removed. Retained claim history is unchanged.") }
            reload()
        }
    }

    fun previewDisplayed(preview: HomeEvidencePreview) {
        if (current() && _state.value.preview === preview) _state.update { it.copy(previewReady = true) }
    }

    fun closePreview() {
        if (pending == null) clearPreview()
    }

    private fun clearPreview() {
        _state.value.preview?.content?.bytes?.fill(0)
        _state.update { it.copy(preview = null, previewReady = false) }
    }

    fun close() {
        closed = true
        clearPreview()
        pending = null
        _state.value = HomePrivateEvidenceState()
        scope.cancel()
    }

    private fun invalidate() {
        clearPreview()
        pending = null
        _state.value = HomePrivateEvidenceState(loading = false, error = CLAIM_SESSION_CHANGED)
    }

    private fun canUse(document: HomePrivateEvidenceDto): Boolean {
        if (!current() || _state.value.busy || pending != null) return false
        return document in _state.value.documents
    }

    private fun displayedDecision(): HomeEvidenceDecision? {
        if (!_state.value.canVerify || !_state.value.previewReady) return null
        val preview = _state.value.preview ?: return null
        val token = preview.reviewToken
        val inspection = preview.content.inspection
        return if (token != null && inspection != null) HomeEvidenceDecision(preview.document.id, token, inspection) else null
    }

    private fun launch(action: suspend () -> Unit) {
        scope.launch {
            try {
                action()
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: NetworkError) {
                handleFailure(error)
            } catch (error: IllegalStateException) {
                handleFailure(error)
            } catch (error: IllegalArgumentException) {
                handleFailure(error)
            }
        }
    }

    private fun handleFailure(error: Throwable) {
        if (!current()) {
            invalidate()
            return
        }
        clearPreview()
        val finalDenial =
            error.isFinalHomeClaimFailure() ||
                error.message == CLAIM_SESSION_CHANGED
        if (finalDenial) pending = null
        _state.value =
            HomePrivateEvidenceState(
                loading = false, error = error.message ?: "Could not load this document. Retry.",
                retryVerification = pending != null,
            )
    }
}

data class HomePrivateEvidenceState(
    val documents: List<HomePrivateEvidenceDto> = emptyList(),
    val loading: Boolean = true,
    val busy: Boolean = false,
    val canVerify: Boolean = false,
    val canRemove: Boolean = false,
    val error: String? = null,
    val notice: String? = null,
    val preview: HomeEvidencePreview? = null,
    val retryVerification: Boolean = false,
    val previewReady: Boolean = false,
)

data class HomeEvidencePreview(val document: HomePrivateEvidenceDto, val content: HomeEvidenceBytes, val reviewToken: String?)

private data class HomeEvidenceDecision(val documentId: String, val reviewToken: String, val inspection: String)
