@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "TooManyFunctions", "LongParameterList")

package app.pantopus.android.ui.screens.mailbox.mail_detail

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.mailbox.MailDetail
import app.pantopus.android.data.api.models.mailbox.v2.BookletDetailDto
import app.pantopus.android.data.api.models.mailbox.v2.CertifiedDetailDto
import app.pantopus.android.data.api.models.mailbox.v2.CommunityDetailDto
import app.pantopus.android.data.api.models.mailbox.v2.CommunityRsvpStatus
import app.pantopus.android.data.api.models.mailbox.v2.CouponDetailDto
import app.pantopus.android.data.api.models.mailbox.v2.GigDetailDto
import app.pantopus.android.data.api.models.mailbox.v2.MemoryDetailDto
import app.pantopus.android.data.api.models.mailbox.v2.PartyDetailDto
import app.pantopus.android.data.api.models.mailbox.v2.PartyRsvpStatus
import app.pantopus.android.data.api.models.mailbox.v2.RecordsDetailDto
import app.pantopus.android.data.api.models.mailbox.vault.VaultFolderDto
import app.pantopus.android.data.api.models.payments.PaymentIntentSheetParamsDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.gigs.GigsRepository
import app.pantopus.android.data.mailbox.MailboxDocumentRepository
import app.pantopus.android.data.mailbox.MailboxPackageRepository
import app.pantopus.android.data.mailbox.MailboxRepository
import app.pantopus.android.data.mailbox.MailboxVaultRepository
import app.pantopus.android.ui.screens.mailbox.item_detail.MailItemCategory
import app.pantopus.android.ui.screens.mailbox.item_detail.MailTrust
import app.pantopus.android.ui.screens.mailbox.item_detail.PackageBodyContent
import app.pantopus.android.ui.screens.mailbox.mail_detail.variants.decodePackageDetail
import app.pantopus.android.ui.screens.settings.payments.CheckoutOutcome
import app.pantopus.android.ui.screens.shared.mail_item_detail.AIElfBullet
import app.pantopus.android.ui.screens.shared.mail_item_detail.MailDetailTrust
import app.pantopus.android.ui.theme.PantopusIcon
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import javax.inject.Inject

/** Nav arg key for the new A17.1 generic detail route. */
const val MAIL_DETAIL_MAIL_ID_KEY = "mailId"

/** Lifecycle state for the generic A17.1 detail screen. */
sealed interface MailDetailUiState {
    data object Loading : MailDetailUiState

    data class Loaded(val content: MailDetailContent) : MailDetailUiState

    data class Error(val message: String) : MailDetailUiState
}

/** One-shot effects emitted by [MailDetailViewModel]. */
sealed interface MailDetailEvent {
    data class PresentGigBidCheckout(val params: PaymentIntentSheetParamsDto) : MailDetailEvent
}

private data class PendingGigBidAcceptance(
    val content: MailDetailContent,
    val gigId: String,
    val bidId: String,
)

/**
 * Pure projection of the backend mail item into the A17 shell slots.
 * Mirrors iOS `MailDetailContent`.
 *
 * T6.5c — adds optional `bookletDetail` / `certifiedDetail` fields so
 * the variant layouts can render their slot-specific designs without a
 * second fetch.
 */
data class MailDetailContent(
    val mailId: String,
    val category: MailItemCategory,
    /**
     * Raw backend `Mail.category` (`bill` / `legal` / `notice` / `receipt` /
     * `community` / `promo` / `other`). Distinct from [category], which
     * projects `mail_type`. Drives the A17.1 per-category ACTIONS row.
     */
    val mailCategoryKey: String? = null,
    /**
     * True when the sender resolves to RN's `unknown` trust bucket —
     * suppresses the Pay / Sign tiles (`detail.tsx:69-72`).
     */
    val isSenderUnknown: Boolean = false,
    val trust: MailTrust,
    val detailTrust: MailDetailTrust,
    val senderDisplayName: String,
    val senderMeta: String?,
    val senderTypeLabel: String,
    val carrierLine: String,
    val senderInitials: String,
    val senderUserId: String?,
    val title: String,
    val excerpt: String?,
    val referenceLabel: String,
    val createdAtLabel: String?,
    val expiresAtLabel: String?,
    val readStatusLabel: String,
    val bodyParagraphs: List<String>,
    val attachments: List<String>,
    val aiSummary: String?,
    /** A17.1 — optional bullet list under the elf summary (`mail-detail.jsx` ELF.bullets). */
    val aiBullets: List<AIElfBullet> = emptyList(),
    val ackRequired: Boolean,
    val isAcknowledged: Boolean,
    val isArchived: Boolean = false,
    val bookletDetail: BookletDetailDto? = null,
    val certifiedDetail: CertifiedDetailDto? = null,
    val communityDetail: CommunityDetailDto? = null,
    val couponDetail: CouponDetailDto? = null,
    val gigDetail: GigDetailDto? = null,
    val memoryDetail: MemoryDetailDto? = null,
    val packageDetail: PackageBodyContent? = null,
    val partyDetail: PartyDetailDto? = null,
    val recordsDetail: RecordsDetailDto? = null,
) {
    /** Build a typed key-facts row list for the shell's KeyFacts slot. */
    fun keyFacts(): List<MailDetailKeyFact> =
        buildList {
            createdAtLabel?.let {
                add(MailDetailKeyFact(icon = PantopusIcon.Calendar, label = "Received", value = it))
            }
            expiresAtLabel?.let {
                add(MailDetailKeyFact(icon = PantopusIcon.Clock, label = "Expires", value = it))
            }
            senderMeta?.let {
                add(MailDetailKeyFact(icon = PantopusIcon.Briefcase, label = "From", value = it))
            }
            add(
                MailDetailKeyFact(
                    icon = category.icon,
                    label = "Category",
                    value = category.label,
                ),
            )
        }
}

/** Lightweight key/value/icon triple for the generic detail's key facts panel. */
data class MailDetailKeyFact(
    val id: String = java.util.UUID.randomUUID().toString(),
    val icon: PantopusIcon,
    val label: String,
    val value: String,
)

/**
 * T6.5b (P20) — Drives the generic A17.1 mail item detail screen on
 * Android. Mirrors iOS `MailDetailViewModel`.
 */
@HiltViewModel
class MailDetailViewModel
    @Inject
    constructor(
        private val repo: MailboxRepository,
        private val vaultRepo: MailboxVaultRepository,
        private val gigsRepo: GigsRepository,
        private val packageRepo: MailboxPackageRepository,
        private val documentRepo: MailboxDocumentRepository,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        private val mailId: String =
            checkNotNull(savedStateHandle.get<String>(MAIL_DETAIL_MAIL_ID_KEY)) {
                "MailDetailViewModel requires a $MAIL_DETAIL_MAIL_ID_KEY nav argument"
            }

        private val _state = MutableStateFlow<MailDetailUiState>(MailDetailUiState.Loading)
        val state: StateFlow<MailDetailUiState> = _state.asStateFlow()

        private val _toast = MutableStateFlow<String?>(null)
        val toast: StateFlow<String?> = _toast.asStateFlow()

        private val _events = MutableSharedFlow<MailDetailEvent>(extraBufferCapacity = 4)
        val events: SharedFlow<MailDetailEvent> = _events.asSharedFlow()

        private val _ackInFlight = MutableStateFlow(false)
        val ackInFlight: StateFlow<Boolean> = _ackInFlight.asStateFlow()

        private val _rsvpInFlight = MutableStateFlow(false)
        val rsvpInFlight: StateFlow<Boolean> = _rsvpInFlight.asStateFlow()

        /** Coupon redeem mutation in-flight; disables the redeem CTA. */
        private val _couponRedeemInFlight = MutableStateFlow(false)
        val couponRedeemInFlight: StateFlow<Boolean> = _couponRedeemInFlight.asStateFlow()

        /** Gig accept-bid mutation in-flight; disables the action row. */
        private val _gigBidInFlight = MutableStateFlow(false)
        val gigBidInFlight: StateFlow<Boolean> = _gigBidInFlight.asStateFlow()

        /** Party RSVP mutation in-flight; disables the three-way cluster. */
        private val _partyRsvpInFlight = MutableStateFlow(false)
        val partyRsvpInFlight: StateFlow<Boolean> = _partyRsvpInFlight.asStateFlow()

        /** A17.10 records file-to-vault mutation in-flight; disables the CTA. */
        private val _recordsFileInFlight = MutableStateFlow(false)
        val recordsFileInFlight: StateFlow<Boolean> = _recordsFileInFlight.asStateFlow()

        /**
         * A17.8 — a package dashboard write (share ETA / report issue) is in
         * flight; keeps the overflow entries from double-firing.
         */
        private val _packageActionInFlight = MutableStateFlow(false)
        val packageActionInFlight: StateFlow<Boolean> = _packageActionInFlight.asStateFlow()

        /** T6.5e (P19.5) — Save-to-vault picker visibility. */
        private val _showsSaveToVaultPicker = MutableStateFlow(false)
        val showsSaveToVaultPicker: StateFlow<Boolean> = _showsSaveToVaultPicker.asStateFlow()

        /** Vault folders cached after the first overflow-tap fetch. */
        private val _saveToVaultFolders = MutableStateFlow<List<VaultFolderDto>>(emptyList())
        val saveToVaultFolders: StateFlow<List<VaultFolderDto>> = _saveToVaultFolders.asStateFlow()

        private val _saveToVaultInFlight = MutableStateFlow(false)
        val saveToVaultInFlight: StateFlow<Boolean> = _saveToVaultInFlight.asStateFlow()

        /** A17.2 — booklet PDF download in flight; disables the "PDF" tile. */
        private val _bookletDownloadInFlight = MutableStateFlow(false)
        val bookletDownloadInFlight: StateFlow<Boolean> = _bookletDownloadInFlight.asStateFlow()

        /** A17.3 — certified legal-proof fetch in flight. */
        private val _certifiedProofInFlight = MutableStateFlow(false)
        val certifiedProofInFlight: StateFlow<Boolean> = _certifiedProofInFlight.asStateFlow()

        /**
         * A17.3 — `true` once the legal delivery proof has been fetched, so
         * the tile flips to "Saved" (RN's `✓ Saved`,
         * `src/app/mailbox/certified.tsx:205`).
         */
        private val _certifiedProofSaved = MutableStateFlow(false)
        val certifiedProofSaved: StateFlow<Boolean> = _certifiedProofSaved.asStateFlow()

        /**
         * A17.1 — per-category action currently POSTing to
         * `/item/:id/action`; disables the ACTIONS row while it runs.
         */
        private val _categoryActionInFlight = MutableStateFlow<MailCategoryAction?>(null)
        val categoryActionInFlight: StateFlow<MailCategoryAction?> = _categoryActionInFlight.asStateFlow()

        /**
         * A17.1 — destructive category action awaiting confirmation (today
         * only `Dismiss`, which shreds the item).
         */
        private val _pendingDestructiveAction = MutableStateFlow<MailCategoryAction?>(null)
        val pendingDestructiveAction: StateFlow<MailCategoryAction?> = _pendingDestructiveAction.asStateFlow()

        private var pendingGigBidAcceptance: PendingGigBidAcceptance? = null

        /**
         * Set to this mail's id when the loaded item carries a stationery
         * theme — i.e. it came out of the Ceremonial Mail compose flow and
         * belongs in the ceremonial open experience (envelope tap-to-open,
         * voice postscript, ceremonial CTAs) rather than the plain detail.
         * The host observes this and *replaces* the current route, mirroring
         * RN's `router.replace('/mailbox/open?id=…')`
         * (`src/app/mailbox/detail.tsx:43-49`).
         */
        private val _ceremonialRedirectMailId = MutableStateFlow<String?>(null)
        val ceremonialRedirectMailId: StateFlow<String?> = _ceremonialRedirectMailId.asStateFlow()

        /** Clear the redirect once the host has navigated. */
        fun acknowledgeCeremonialRedirect() {
            _ceremonialRedirectMailId.value = null
        }

        fun load() {
            if (_state.value is MailDetailUiState.Loaded) return
            refresh()
        }

        fun refresh() {
            _state.value = MailDetailUiState.Loading
            viewModelScope.launch {
                when (val result = repo.detail(mailId)) {
                    is NetworkResult.Success ->
                        // Ceremonial mail never lands on the generic detail —
                        // hand it straight to the open experience and hold the
                        // loading frame so the plain layout never flashes (RN
                        // short-circuits before `setLoading(false)`).
                        if (result.data.mail.stationeryTheme != null) {
                            _ceremonialRedirectMailId.value = mailId
                        } else {
                            _state.value = MailDetailUiState.Loaded(project(result.data.mail))
                        }
                    is NetworkResult.Failure ->
                        _state.value = MailDetailUiState.Error(result.error.displayMessage("Couldn't load this item."))
                }
            }
        }

        /**
         * Acknowledge the mail item. Optimistic — flips local
         * `isAcknowledged` then rolls back on transport failure.
         */
        fun acknowledge() {
            val current = _state.value as? MailDetailUiState.Loaded ?: return
            if (_ackInFlight.value) return
            _ackInFlight.value = true
            val optimistic = current.content.copy(isAcknowledged = true)
            _state.value = MailDetailUiState.Loaded(optimistic)
            viewModelScope.launch {
                when (val result = repo.acknowledge(mailId)) {
                    is NetworkResult.Success -> {
                        _toast.value = "Acknowledged"
                    }
                    is NetworkResult.Failure -> {
                        _state.value = MailDetailUiState.Loaded(current.content)
                        _toast.value = result.error.message
                    }
                }
                _ackInFlight.value = false
            }
        }

        fun consumeToast() {
            _toast.value = null
        }

        /**
         * Set the user's RSVP status on a Community mail item.
         * Optimistic — flips local state then rolls back on transport
         * failure. "Going" wires to the existing `POST /community/rsvp`
         * route (backend stores it as a `will_attend` reaction); other
         * states are stored locally until the backend exposes a typed
         * per-status route (P22 scope note in the parity audit).
         */
        fun setRsvp(status: CommunityRsvpStatus) {
            val current = _state.value as? MailDetailUiState.Loaded ?: return
            val community = current.content.communityDetail ?: return
            if (_rsvpInFlight.value) return
            _rsvpInFlight.value = true
            val optimistic =
                current.content.copy(
                    communityDetail =
                        community.copy(
                            rsvp = status,
                            attendeeCount =
                                when {
                                    status == CommunityRsvpStatus.Going && community.rsvp != CommunityRsvpStatus.Going ->
                                        community.attendeeCount + 1
                                    status != CommunityRsvpStatus.Going && community.rsvp == CommunityRsvpStatus.Going ->
                                        (community.attendeeCount - 1).coerceAtLeast(0)
                                    else -> community.attendeeCount
                                },
                        ),
                )
            _state.value = MailDetailUiState.Loaded(optimistic)
            if (status != CommunityRsvpStatus.Going) {
                _toast.value = rsvpToast(status)
                _rsvpInFlight.value = false
                return
            }
            viewModelScope.launch {
                when (val result = repo.communityRsvp(community.communityItemId)) {
                    is NetworkResult.Success -> _toast.value = "You're going"
                    is NetworkResult.Failure -> {
                        _state.value = MailDetailUiState.Loaded(current.content)
                        _toast.value = result.error.message
                    }
                }
                _rsvpInFlight.value = false
            }
        }

        private fun rsvpToast(status: CommunityRsvpStatus): String =
            when (status) {
                CommunityRsvpStatus.Going -> "You're going"
                CommunityRsvpStatus.Maybe -> "Saved as maybe"
                CommunityRsvpStatus.NotGoing -> "Marked as can't make it"
                CommunityRsvpStatus.Undecided -> "RSVP cleared"
            }

        // MARK: - Per-category actions (A17.1)

        /**
         * The ACTIONS row for the loaded item — RN's
         * `CATEGORY_ACTIONS[item.category] || CATEGORY_ACTIONS.other`, minus
         * Pay / Sign for unknown senders (`detail.tsx:56-72`).
         */
        fun categoryActions(): List<MailCategoryAction> {
            val content = (_state.value as? MailDetailUiState.Loaded)?.content ?: return emptyList()
            return MailCategoryActions.actions(
                rawCategory = content.mailCategoryKey,
                isSenderUnknown = content.isSenderUnknown,
            )
        }

        /**
         * Route a tile tap. Destructive tiles park in
         * [pendingDestructiveAction] for the screen's confirm dialog; the
         * rest fire straight away.
         */
        fun tapCategoryAction(action: MailCategoryAction) {
            if (action.isDestructive) {
                _pendingDestructiveAction.value = action
                return
            }
            performCategoryAction(action)
        }

        fun dismissDestructiveAction() {
            _pendingDestructiveAction.value = null
        }

        /**
         * `POST /api/mailbox/v2/item/:id/action` — route
         * `backend/routes/mailboxV2.js:459`. The handler records a
         * `mail_action_clicked` event itself, so (unlike RN, which posts a
         * second `/event` write) one call is enough.
         */
        fun performCategoryAction(action: MailCategoryAction) {
            if (_state.value !is MailDetailUiState.Loaded) return
            if (_categoryActionInFlight.value != null) return
            _pendingDestructiveAction.value = null
            _categoryActionInFlight.value = action
            viewModelScope.launch {
                when (val result = repo.itemAction(mailId, action.actionKey)) {
                    is NetworkResult.Success -> {
                        // RN only toasts (`detail.tsx:56-66`) — the generic
                        // detail renders nothing derived from `lifecycle`, so
                        // a refetch would buy a skeleton flash and nothing else.
                        _toast.value = action.successToast
                        _categoryActionInFlight.value = null
                    }
                    is NetworkResult.Failure -> {
                        _toast.value = result.error.displayMessage("Action failed")
                        _categoryActionInFlight.value = null
                    }
                }
            }
        }

        // MARK: - Package dashboard actions (A17.8)

        /**
         * A17.8 — "Share ETA with household". Drops a package-arriving
         * notice into every other resident's Home drawer via
         * `POST api/mailbox/v2/package/:mailId/share-eta`
         * (`backend/routes/mailboxV2.js:727`) and toasts how many people
         * were notified. Mirrors RN `src/app/mailbox/package.tsx:40-48`.
         */
        fun sharePackageEta() {
            val current = _state.value as? MailDetailUiState.Loaded ?: return
            if (current.content.category != MailItemCategory.Package) return
            if (_packageActionInFlight.value) return
            _packageActionInFlight.value = true
            viewModelScope.launch {
                _toast.value =
                    when (val result = packageRepo.shareEta(mailId)) {
                        is NetworkResult.Success -> {
                            val notified = result.data.notified ?: 0
                            val noun = if (notified == 1) "member" else "members"
                            "ETA shared with $notified household $noun"
                        }
                        is NetworkResult.Failure -> result.error.displayMessage("Failed to share")
                    }
                _packageActionInFlight.value = false
            }
        }

        /**
         * A17.8 — "Report issue". RN logs a `package_issue_reported` event
         * against the mail item (`src/app/mailbox/package.tsx:60-64`); the
         * native overflow entry used to be a no-op.
         */
        fun reportPackageIssue() {
            val current = _state.value as? MailDetailUiState.Loaded ?: return
            if (current.content.category != MailItemCategory.Package) return
            if (_packageActionInFlight.value) return
            _packageActionInFlight.value = true
            viewModelScope.launch {
                _toast.value =
                    when (
                        val result =
                            repo.logEvent(eventType = "package_issue_reported", mailId = mailId)
                    ) {
                        is NetworkResult.Success -> "Package issue has been reported"
                        is NetworkResult.Failure ->
                            result.error.displayMessage("Couldn't report this issue")
                    }
                _packageActionInFlight.value = false
            }
        }

        // MARK: - Save to vault (T6.5e / P19.5)

        /** Open the save-to-vault picker. Fetches folders on the first
         *  tap; cached for the rest of the session. */
        fun openSaveToVaultPicker() {
            if (_saveToVaultFolders.value.isNotEmpty()) {
                _showsSaveToVaultPicker.value = true
                return
            }
            viewModelScope.launch {
                when (val result = vaultRepo.folders(drawer = "personal")) {
                    is NetworkResult.Success -> {
                        _saveToVaultFolders.value = result.data.folders
                        if (result.data.folders.isEmpty()) {
                            _toast.value = "Add a folder in your Vault first."
                        } else {
                            _showsSaveToVaultPicker.value = true
                        }
                    }
                    is NetworkResult.Failure ->
                        _toast.value = result.error.displayMessage("Couldn't load your vault folders.")
                }
            }
        }

        fun dismissSaveToVaultPicker() {
            _showsSaveToVaultPicker.value = false
        }

        // ── Document artefacts (A17.2 booklet PDF / A17.3 proof) ─

        /**
         * A17.2 — `POST api/mailbox/v2/p2/booklet/:mailId/download`
         * (`backend/routes/mailboxV2Phase2.js:447`). Mirrors RN's
         * "Download Started · Downloading X.X MB" confirmation
         * (`src/app/mailbox/booklet.tsx:43`). The backend answers 404 when
         * the booklet has no rendered PDF, which surfaces as RN's
         * "Download not available".
         */
        fun downloadBookletPdf() {
            if (_bookletDownloadInFlight.value) return
            _bookletDownloadInFlight.value = true
            viewModelScope.launch {
                try {
                    when (val result = documentRepo.bookletDownload(mailId)) {
                        is NetworkResult.Success -> {
                            val label = megabytesLabel(result.data.sizeBytes)
                            _toast.value =
                                if (label != null) "Download started · $label" else "Download started"
                        }
                        is NetworkResult.Failure -> _toast.value = "Download not available"
                    }
                } finally {
                    _bookletDownloadInFlight.value = false
                }
            }
        }

        /**
         * A17.3 — `GET api/mailbox/v2/p2/certified/:mailId/proof`
         * (`backend/routes/mailboxV2Phase2.js:705`). The route rejects with
         * 400 until the item is acknowledged, which is exactly when RN
         * surfaces the button (`src/app/mailbox/certified.tsx:200`), so the
         * failure copy matches RN's "Proof not available yet".
         */
        fun downloadCertifiedProof() {
            if (_certifiedProofInFlight.value || _certifiedProofSaved.value) return
            _certifiedProofInFlight.value = true
            viewModelScope.launch {
                try {
                    when (val result = documentRepo.certifiedProof(mailId)) {
                        is NetworkResult.Success ->
                            if (result.data.proof == null) {
                                _toast.value = "Proof not available yet"
                            } else {
                                _certifiedProofSaved.value = true
                                _toast.value = "Delivery proof saved"
                            }
                        is NetworkResult.Failure -> _toast.value = "Proof not available yet"
                    }
                } finally {
                    _certifiedProofInFlight.value = false
                }
            }
        }

        /** "2.4 MB" — the label RN puts in its "Download Started" alert. */
        private fun megabytesLabel(sizeBytes: Long?): String? {
            if (sizeBytes == null || sizeBytes <= 0L) return null
            val megabytes = sizeBytes.toDouble() / (1024 * 1024)
            return String.format(Locale.US, "%.1f MB", megabytes)
        }

        // ── Ceremonial variant mutations (A17.5–A17.8) ───────────

        /**
         * A17.5 — Mark a coupon redeemed. Backend redemption is not yet
         * wired; the projection flips locally so the variant body swaps
         * into the redeemed-ribbon state. Mirrors acknowledge so
         * subsequent backend wiring can drop in.
         */
        fun redeemCoupon() {
            val current = _state.value as? MailDetailUiState.Loaded ?: return
            if (current.content.category != MailItemCategory.Coupon) return
            if (current.content.couponDetail == null) return
            if (_couponRedeemInFlight.value) return
            _couponRedeemInFlight.value = true
            _state.value = MailDetailUiState.Loaded(current.content.copy(isAcknowledged = true))
            _toast.value = "Redeemed"
            _couponRedeemInFlight.value = false
        }

        /**
         * A17.6 — Accept the incoming bid on a gig through the backend
         * accept → PaymentSheet → finalize/abort flow.
         */
        fun acceptGigBid() {
            val current = _state.value as? MailDetailUiState.Loaded
            val gig = current?.content?.gigDetail
            if (current == null || gig == null) return
            if (!canAcceptGigBid(current)) return
            val gigId = gig.gigId
            val bidId = gig.bidId
            if (gigId.isNullOrBlank() || bidId.isNullOrBlank()) {
                _toast.value = "Couldn't accept this bid from mail."
                return
            }
            _gigBidInFlight.value = true
            viewModelScope.launch {
                when (val result = gigsRepo.acceptBid(gigId, bidId)) {
                    is NetworkResult.Success -> {
                        val params = result.data.sheetParams()
                        val requiresPayment = result.data.requiresPaymentSetup == true || !params.clientSecret.isNullOrBlank()
                        if (requiresPayment) {
                            pendingGigBidAcceptance =
                                PendingGigBidAcceptance(
                                    content = current.content,
                                    gigId = gigId,
                                    bidId = bidId,
                                )
                            _events.emit(MailDetailEvent.PresentGigBidCheckout(params))
                        } else {
                            _state.value =
                                MailDetailUiState.Loaded(current.content.copy(gigDetail = gig.accepted()))
                            _toast.value = "Bid accepted"
                            _gigBidInFlight.value = false
                        }
                    }
                    is NetworkResult.Failure -> {
                        _toast.value = result.error.message
                        _gigBidInFlight.value = false
                    }
                }
            }
        }

        private fun canAcceptGigBid(current: MailDetailUiState.Loaded): Boolean =
            current.content.category == MailItemCategory.Gig && !_gigBidInFlight.value

        fun onGigBidCheckoutOutcome(outcome: CheckoutOutcome) {
            val pending = pendingGigBidAcceptance ?: return
            pendingGigBidAcceptance = null
            when (outcome) {
                CheckoutOutcome.Paid -> finalizePendingGigBid(pending)
                CheckoutOutcome.Canceled -> abortPendingGigBid(pending, "Payment canceled")
                is CheckoutOutcome.Declined ->
                    abortPendingGigBid(pending, outcome.message ?: "Your card was declined.")
            }
        }

        private fun finalizePendingGigBid(pending: PendingGigBidAcceptance) {
            viewModelScope.launch {
                when (val result = gigsRepo.finalizeAcceptBid(pending.gigId, pending.bidId)) {
                    is NetworkResult.Success -> {
                        val gig = pending.content.gigDetail
                        _state.value =
                            MailDetailUiState.Loaded(
                                pending.content.copy(gigDetail = gig?.accepted()),
                            )
                        _toast.value = "Bid accepted"
                    }
                    is NetworkResult.Failure -> {
                        _state.value = MailDetailUiState.Loaded(pending.content)
                        _toast.value = result.error.message
                    }
                }
                _gigBidInFlight.value = false
            }
        }

        private fun abortPendingGigBid(
            pending: PendingGigBidAcceptance,
            message: String,
        ) {
            viewModelScope.launch {
                gigsRepo.abortAcceptBid(pending.gigId, pending.bidId)
                _state.value = MailDetailUiState.Loaded(pending.content)
                _toast.value = message
                _gigBidInFlight.value = false
            }
        }

        /**
         * A17.9 — Set the user's RSVP on a Party mail item. Backend
         * wiring is not yet exposed for personal invites; the projection
         * flips locally so the variant swaps into the going-state hero /
         * elf / potluck-claim affordances.
         */
        fun setPartyRsvp(status: PartyRsvpStatus) {
            val current = _state.value as? MailDetailUiState.Loaded ?: return
            val party = current.content.partyDetail ?: return
            if (_partyRsvpInFlight.value) return
            _partyRsvpInFlight.value = true
            val confirmedAtLabel =
                if (status == PartyRsvpStatus.Going) partyRsvpStamp() else null
            _state.value =
                MailDetailUiState.Loaded(
                    current.content.copy(
                        partyDetail = party.withRsvp(status, confirmedAtLabel),
                    ),
                )
            _toast.value = partyRsvpToast(status)
            _partyRsvpInFlight.value = false
        }

        /**
         * A17.9 — Adjust the plus-one stepper. Clamped to `0..4`.
         */
        fun setPartyPlusOneCount(count: Int) {
            val current = _state.value as? MailDetailUiState.Loaded ?: return
            val party = current.content.partyDetail ?: return
            val clamped = count.coerceIn(0, 4)
            _state.value =
                MailDetailUiState.Loaded(
                    current.content.copy(partyDetail = party.withPlusOneCount(clamped)),
                )
        }

        /**
         * A17.9 — Claim (or release) a potluck bring-item. Passing
         * `name = null` releases the claim — design uses this to flip
         * "I'll bring it" back to the unclaimed style.
         */
        fun togglePartyBringClaim(
            index: Int,
            name: String?,
        ) {
            val current = _state.value as? MailDetailUiState.Loaded ?: return
            val party = current.content.partyDetail ?: return
            _state.value =
                MailDetailUiState.Loaded(
                    current.content.copy(partyDetail = party.withBringClaim(index, name)),
                )
            _toast.value = if (name == null) "Released" else "Claimed"
        }

        private fun partyRsvpToast(status: PartyRsvpStatus): String =
            when (status) {
                PartyRsvpStatus.Going -> "You're in"
                PartyRsvpStatus.Maybe -> "Saved as maybe"
                PartyRsvpStatus.NotGoing -> "Sent regrets"
                PartyRsvpStatus.Undecided -> "RSVP cleared"
            }

        private fun partyRsvpStamp(): String {
            val formatter =
                java.time.format.DateTimeFormatter
                    .ofPattern("h:mm a", java.util.Locale.US)
            return "Today ${formatter.format(java.time.LocalTime.now())}"
        }

        /**
         * A17.7 — Save the memory keepsake to the user's default
         * memories vault folder. Falls through to the picker if no
         * folders are cached yet; once cached, prefers a folder whose
         * label contains "memor" before defaulting to the first folder.
         */
        fun saveMemoryToVault() {
            val (content, memory) = currentUnsavedMemoryContent() ?: return
            // Optimistic flip so the saved banner + vault card take over
            // without waiting for the network round-trip.
            _state.value =
                MailDetailUiState.Loaded(
                    content.copy(memoryDetail = memory.copy(isSaved = true)),
                )
            val folderId = preferredMemoryFolderId()
            if (folderId == null) {
                openSaveToVaultPicker()
            } else {
                saveToVault(folderId)
            }
        }

        /**
         * A17.10 — File the archival record in its suggested vault folder
         * via the same `POST …/vault/file` path as Save to vault.
         */
        fun fileRecordToVault() {
            val current = _state.value as? MailDetailUiState.Loaded ?: return
            val records = current.content.recordsDetail ?: return
            if (current.content.category != MailItemCategory.Records || records.isFiled) return
            // Claim the in-flight flag synchronously — a second tap while the
            // folders fetch is awaiting would otherwise POST /vault/file twice.
            if (_recordsFileInFlight.value) return
            _recordsFileInFlight.value = true
            viewModelScope.launch {
                try {
                    fileRecordToVaultInner(current.content, records)
                } finally {
                    _recordsFileInFlight.value = false
                }
            }
        }

        private suspend fun fileRecordToVaultInner(
            content: MailDetailContent,
            records: RecordsDetailDto,
        ) {
            if (_saveToVaultFolders.value.isEmpty()) {
                when (val result = vaultRepo.folders(drawer = "personal")) {
                    is NetworkResult.Success -> _saveToVaultFolders.value = result.data.folders
                    is NetworkResult.Failure -> {
                        _toast.value = result.error.displayMessage("Couldn't load your vault folders.")
                        return
                    }
                }
            }
            val folderId = suggestedVaultFolderId(records)
            if (folderId == null) {
                // No vault folder matches the record's suggested trail — let
                // the user pick rather than filing it somewhere arbitrary.
                openSaveToVaultPicker()
                return
            }
            _state.value =
                MailDetailUiState.Loaded(
                    content.copy(
                        recordsDetail = records.copy(isFiled = true, filedAtLabel = filedAtStamp()),
                    ),
                )
            when (val result = vaultRepo.file(mailId = mailId, folderId = folderId)) {
                is NetworkResult.Success -> {
                    val label = _saveToVaultFolders.value.firstOrNull { it.id == folderId }?.label
                    _toast.value = label?.let { "Filed in $it" } ?: "Filed in Vault"
                }
                is NetworkResult.Failure -> {
                    _state.value = MailDetailUiState.Loaded(content)
                    _toast.value = result.error.displayMessage("Couldn't file to vault. Try again.")
                }
            }
        }

        /**
         * Resolve the vault folder the record should be filed in by matching
         * the payload's `vault_trail` crumbs against the user's real folders,
         * most-specific crumb first. The `Mailbox` / `Vault` crumbs are
         * chrome, not folders. Returns null when nothing matches — the caller
         * opens the picker instead of guessing (no system folder is named
         * "Records" or "Archive", so a label-contains heuristic silently filed
         * every record into whichever folder happened to sort first).
         */
        private fun suggestedVaultFolderId(records: RecordsDetailDto): String? {
            val folders = _saveToVaultFolders.value
            if (folders.isEmpty()) return null
            return records.vaultTrail
                .asReversed()
                .asSequence()
                .map { it.label.trim() }
                .filter { it.isNotEmpty() && !it.equals("Mailbox", true) && !it.equals("Vault", true) }
                .mapNotNull { crumb -> folders.firstOrNull { it.label.equals(crumb, ignoreCase = true) } }
                .firstOrNull()
                ?.id
        }

        /**
         * "Today 2:14 PM · retention 7y" — the optimistic filed-at stamp.
         * Mirrors iOS `formatFiledAtNow()`.
         */
        private fun filedAtStamp(): String {
            val formatter = DateTimeFormatter.ofPattern("h:mm a", Locale.US)
            return "Today ${formatter.format(java.time.LocalTime.now())} · retention 7y"
        }

        private fun currentUnsavedMemoryContent(): Pair<MailDetailContent, MemoryDetailDto>? {
            val content = (_state.value as? MailDetailUiState.Loaded)?.content ?: return null
            val memory = content.memoryDetail ?: return null
            if (content.category != MailItemCategory.Memory || memory.isSaved || _saveToVaultInFlight.value) return null
            return content to memory
        }

        private fun preferredMemoryFolderId(): String? {
            val folders = _saveToVaultFolders.value
            val memoryFolder = folders.firstOrNull { it.label.lowercase().contains("memor") }
            return (memoryFolder ?: folders.firstOrNull())?.id
        }

        /** POST the current mail to the supplied vault folder. */
        fun saveToVault(folderId: String) {
            if (_saveToVaultInFlight.value) return
            _saveToVaultInFlight.value = true
            viewModelScope.launch {
                when (val result = vaultRepo.file(mailId = mailId, folderId = folderId)) {
                    is NetworkResult.Success -> {
                        val folderLabel = _saveToVaultFolders.value.firstOrNull { it.id == folderId }?.label
                        _toast.value = folderLabel?.let { "Saved to $it" } ?: "Saved to vault"
                    }
                    is NetworkResult.Failure ->
                        _toast.value = result.error.displayMessage("Couldn't save to vault. Try again.")
                }
                _showsSaveToVaultPicker.value = false
                _saveToVaultInFlight.value = false
            }
        }

        companion object {
            /**
             * Pure projection from the backend [MailDetail] envelope to
             * the generic A17.1 content. Static so the test suite can
             * exercise it without standing the VM up.
             */
            @JvmStatic
            fun project(detail: MailDetail): MailDetailContent {
                val category = MailItemCategory.fromRaw(detail.mailType ?: detail.type)
                val trust = MailTrust.fromRaw(null)
                val senderDisplayName =
                    detail.sender?.name
                        ?: detail.senderBusinessName
                        ?: detail.senderAddress
                        ?: "Unknown sender"
                val senderMeta = detail.sender?.username?.let { "@$it" } ?: detail.senderAddress
                val senderTypeLabel =
                    senderTypeLabel(
                        category = category,
                        sender = detail.sender,
                        businessName = detail.senderBusinessName,
                    )
                val carrierLine = "via ${carrierLabel(detail.`object`)}"
                val referenceLabel = referenceLabel(detail.`object`, detail.id)
                val title = detail.displayTitle ?: detail.subject ?: "Mail"
                val excerpt = detail.previewText
                val createdAtLabel = formatLongDate(detail.createdAt)
                val expiresAtLabel = formatLongDate(detail.expiresAt)
                val bodyParagraphs = bodyParagraphs(detail.content)
                val ackRequired = detail.ackRequired == true
                val ackStatus = detail.ackStatus?.lowercase() == "acknowledged"
                val variants = decodeVariantDetails(category = category, payload = detail.`object`)
                val resolvedAck = ackStatus || (variants.certified?.isAcknowledged == true)
                val readStatusLabel = if (detail.viewed || resolvedAck) "Read" else "Unread"
                return MailDetailContent(
                    mailId = detail.id,
                    category = category,
                    mailCategoryKey = detail.category,
                    isSenderUnknown = resolveSenderTrust(detail) == "unknown",
                    trust = trust,
                    detailTrust = trust.detailTrust,
                    senderDisplayName = senderDisplayName,
                    senderMeta = senderMeta,
                    senderTypeLabel = senderTypeLabel,
                    carrierLine = carrierLine,
                    senderInitials = makeInitials(senderDisplayName),
                    senderUserId = detail.sender?.id,
                    title = title,
                    excerpt = excerpt,
                    referenceLabel = referenceLabel,
                    createdAtLabel = createdAtLabel,
                    expiresAtLabel = expiresAtLabel,
                    readStatusLabel = readStatusLabel,
                    bodyParagraphs = bodyParagraphs,
                    attachments = detail.attachments ?: emptyList(),
                    aiSummary = null,
                    ackRequired = ackRequired,
                    isAcknowledged = resolvedAck,
                    isArchived = detail.archived,
                    bookletDetail = variants.booklet,
                    certifiedDetail = variants.certified,
                    communityDetail = variants.community,
                    couponDetail = variants.coupon,
                    gigDetail = variants.gig,
                    memoryDetail = variants.memory,
                    packageDetail = variants.packageDetail,
                    partyDetail = variants.party,
                    recordsDetail = variants.records,
                )
            }

            /**
             * RN `getSenderTrust` (`src/components/mailbox/sender.ts:39-58`)
             * — the same fallback ladder the backend's `resolveSenderTrust`
             * (`backend/routes/mailboxV2.js:198`) uses. Only the `unknown`
             * bucket matters to the ACTIONS row (it suppresses Pay / Sign).
             */
            @JvmStatic
            fun resolveSenderTrust(detail: MailDetail): String {
                val known =
                    setOf(
                        "verified_gov",
                        "verified_utility",
                        "verified_business",
                        "pantopus_user",
                        "unknown",
                    )
                val raw = detail.senderTrust?.trim().orEmpty()
                if (raw in known) return raw
                val business = detail.senderBusinessName?.trim().orEmpty()
                if (business.isNotEmpty()) return "verified_business"
                if (detail.senderUserId != null || detail.sender != null) return "pantopus_user"
                return "unknown"
            }

            private data class VariantDetails(
                val booklet: BookletDetailDto?,
                val certified: CertifiedDetailDto?,
                val community: CommunityDetailDto?,
                val coupon: CouponDetailDto?,
                val gig: GigDetailDto?,
                val memory: MemoryDetailDto?,
                val packageDetail: PackageBodyContent?,
                val party: PartyDetailDto?,
                val records: RecordsDetailDto?,
            )

            private fun bodyParagraphs(content: String?): List<String> =
                content
                    ?.takeIf { it.isNotEmpty() }
                    ?.split("\n\n")
                    ?.map { it.trim() }
                    ?.filter { it.isNotEmpty() }
                    ?: emptyList()

            private fun decodeVariantDetails(
                category: MailItemCategory,
                payload: Map<String, Any?>?,
            ): VariantDetails =
                VariantDetails(
                    booklet =
                        if (category == MailItemCategory.Booklet) {
                            BookletDetailDto.decodeFromObjectPayload(payload)
                        } else {
                            null
                        },
                    certified =
                        if (category == MailItemCategory.Certified) {
                            CertifiedDetailDto.decodeFromObjectPayload(payload)
                        } else {
                            null
                        },
                    community =
                        if (category == MailItemCategory.Community) {
                            CommunityDetailDto.decodeFromObjectPayload(payload)
                        } else {
                            null
                        },
                    coupon =
                        if (category == MailItemCategory.Coupon) {
                            CouponDetailDto.decodeFromObjectPayload(payload)
                        } else {
                            null
                        },
                    gig =
                        if (category == MailItemCategory.Gig) {
                            GigDetailDto.decodeFromObjectPayload(payload)
                        } else {
                            null
                        },
                    memory =
                        if (category == MailItemCategory.Memory) {
                            MemoryDetailDto.decodeFromObjectPayload(payload)
                        } else {
                            null
                        },
                    packageDetail =
                        if (category == MailItemCategory.Package) {
                            decodePackageDetail(payload)
                        } else {
                            null
                        },
                    // Backend ingestion for personal invites is not yet
                    // wired; fall back to the deterministic fixture so the
                    // A17.9 variant lights up the moment a user opens a
                    // party-categorised mail. Once the wire schema ships,
                    // `PartyDetailDto.decodeFromObjectPayload(...)` returns
                    // the real payload and this fallback becomes dead code.
                    party =
                        if (category == MailItemCategory.Party) {
                            PartyDetailDto.decodeFromObjectPayload(payload)
                                ?: app.pantopus.android.ui.screens.mailbox.item_detail.MailItemSampleData
                                    .partyInvite
                        } else {
                            null
                        },
                    records =
                        if (category == MailItemCategory.Records) {
                            RecordsDetailDto.decodeFromObjectPayload(payload)
                        } else {
                            null
                        },
                )

            @JvmStatic
            fun makeInitials(name: String): String {
                if (name.isEmpty()) return "M"
                return name
                    .split(" ")
                    .take(2)
                    .mapNotNull { it.firstOrNull()?.uppercaseChar()?.toString() }
                    .joinToString("")
                    .ifEmpty { "M" }
            }

            @JvmStatic
            fun formatLongDate(iso: String?): String? {
                if (iso.isNullOrBlank()) return null
                val instant = runCatching { Instant.parse(iso) }.getOrNull() ?: return null
                val zoned = instant.atZone(ZoneId.systemDefault())
                return DateTimeFormatter.ofPattern("EEE MMM d, yyyy", Locale.US).format(zoned)
            }

            @JvmStatic
            fun referenceLabel(
                payload: Map<String, Any?>?,
                itemId: String,
            ): String {
                val candidates =
                    listOf("reference", "reference_number", "case_number", "tracking_number", "document_id")
                return candidates
                    .firstNotNullOfOrNull { key -> (payload?.get(key) as? String)?.trim()?.takeIf { it.isNotEmpty() } }
                    ?: "Ref ${itemId.uppercase(Locale.US)}"
            }

            @JvmStatic
            fun carrierLabel(payload: Map<String, Any?>?): String {
                val candidates = listOf("carrier", "service", "delivery_service", "mail_service")
                return candidates
                    .firstNotNullOfOrNull { key -> (payload?.get(key) as? String)?.trim()?.takeIf { it.isNotEmpty() } }
                    ?: "Pantopus Mail"
            }

            @JvmStatic
            fun senderTypeLabel(
                category: MailItemCategory,
                sender: MailDetail.Sender?,
                businessName: String?,
            ): String =
                when {
                    sender != null -> "Pantopus user"
                    businessName != null && category.detailTrust == MailDetailTrust.Verified -> "Verified sender"
                    businessName != null -> "Business"
                    category.detailTrust == MailDetailTrust.Warning -> "Action notice"
                    else -> "Mail sender"
                }
        }
    }
