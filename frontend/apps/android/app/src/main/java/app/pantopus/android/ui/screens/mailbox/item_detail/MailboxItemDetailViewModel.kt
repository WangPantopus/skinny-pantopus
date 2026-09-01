@file:Suppress("MagicNumber", "LongMethod", "PackageNaming", "TooManyFunctions")

package app.pantopus.android.ui.screens.mailbox.item_detail

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.mailbox.v2.BookletDetailDto
import app.pantopus.android.data.api.models.mailbox.v2.CertifiedDetailDto
import app.pantopus.android.data.api.models.mailbox.v2.CommunityDetailDto
import app.pantopus.android.data.api.models.mailbox.v2.CouponDetailDto
import app.pantopus.android.data.api.models.mailbox.v2.GigDetailDto
import app.pantopus.android.data.api.models.mailbox.v2.MailboxCategoryPayload
import app.pantopus.android.data.api.models.mailbox.v2.MailboxV2Item
import app.pantopus.android.data.api.models.mailbox.v2.MemoryDetailDto
import app.pantopus.android.data.api.models.mailbox.v2.PackageDetailResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.mailbox.MailboxRepository
import app.pantopus.android.ui.components.KeyFactRow
import app.pantopus.android.ui.components.TimelineStep
import app.pantopus.android.ui.components.TimelineStepState
import app.pantopus.android.ui.screens.mailbox.item_detail.bodies.GenericMailBodyContent
import app.pantopus.android.ui.theme.PantopusIcon
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.Duration
import java.time.Instant
import javax.inject.Inject

/** Key used to pass the mail id through the nav backstack. */
const val MAILBOX_ITEM_DETAIL_MAIL_ID_KEY = "mailId"

/** Package delivery lifecycle used by the A17.8 body. */
enum class PackageDeliveryStatus(
    val raw: String,
) {
    Shipped("pre_receipt"),
    InTransit("in_transit"),
    OutForDelivery("out_for_delivery"),
    Delivered("delivered"),
    ;

    companion object {
        fun fromRaw(raw: String?): PackageDeliveryStatus = entries.firstOrNull { it.raw == raw } ?: InTransit
    }
}

/** One carrier scan / handoff row for the package body. */
data class PackageHandoffStep(
    val id: String,
    val title: String,
    val location: String,
    val timestamp: String,
    val icon: PantopusIcon,
)

/** Courier proof-photo metadata for delivered packages. */
data class PackageDeliveryPhoto(
    val capturedAt: String,
    val watermark: String,
    val location: String,
    val verificationLabel: String,
    val isReceived: Boolean = false,
)

/** One line item in the package contents card. */
data class PackageContentsItem(
    val id: String,
    val quantity: Int,
    val name: String,
    val detail: String,
)

/** Optional order summary shown after tracking details. */
data class PackageContents(
    val title: String,
    val items: List<PackageContentsItem>,
    val subtotal: String? = null,
    val shipping: String? = null,
    val total: String? = null,
)

private fun packageDefaultStatusTitle(status: PackageDeliveryStatus): String =
    when (status) {
        PackageDeliveryStatus.Shipped -> "Shipped"
        PackageDeliveryStatus.InTransit -> "In transit"
        PackageDeliveryStatus.OutForDelivery -> "Out for delivery"
        PackageDeliveryStatus.Delivered -> "Delivered to your porch"
    }

private fun packageDefaultStatusDetail(status: PackageDeliveryStatus): String =
    when (status) {
        PackageDeliveryStatus.Shipped -> "Label created by the sender."
        PackageDeliveryStatus.InTransit -> "Moving through the carrier network."
        PackageDeliveryStatus.OutForDelivery -> "Expected today by 3 PM."
        PackageDeliveryStatus.Delivered -> "Front porch - left in shade."
    }

/** Data projected onto the Package body slot. */
data class PackageBodyContent(
    val carrier: String,
    val service: String? = null,
    val dimensions: String? = null,
    val weight: String? = null,
    val trackingUrl: String? = null,
    val etaLine: String? = null,
    val status: PackageDeliveryStatus = PackageDeliveryStatus.InTransit,
    val trackingNumber: String? = null,
    val referenceLine: String? = null,
    val statusTitle: String = packageDefaultStatusTitle(status),
    val statusDetail: String = packageDefaultStatusDetail(status),
    val trackingSteps: List<TimelineStep> = emptyList(),
    val handoffSteps: List<PackageHandoffStep> = emptyList(),
    val deliveryPhoto: PackageDeliveryPhoto? = null,
    val contents: PackageContents? = null,
)

private fun PackageBodyContent.receivedCopy(): PackageBodyContent =
    copy(
        status = PackageDeliveryStatus.Delivered,
        statusTitle = "Logged as received",
        statusDetail = "Today - by you",
        trackingSteps = trackingSteps.map { it.copy(state = TimelineStepState.Done) },
        deliveryPhoto = deliveryPhoto?.copy(isReceived = true),
    )

/** Full projection of a single mailbox item for the detail screen. */
data class MailboxItemDetailContent(
    val category: MailItemCategory,
    val trust: MailTrust,
    val sender: SenderBlockContent,
    val aiElf: AIElfContent?,
    val keyFacts: List<KeyFactRow>,
    val timeline: List<TimelineStep>,
    val packageInfo: PackageBodyContent?,
    val ctaEnabled: Boolean,
    val isUnread: Boolean = false,
    val isArchived: Boolean = false,
    /**
     * Category-specific sub-payload resolved from `mail.object_payload`
     * (P18). [MailboxCategoryPayload.Other] for categories without a
     * dedicated body decoder.
     */
    val payload: MailboxCategoryPayload = MailboxCategoryPayload.Other,
    /** Readable body for categories without a bespoke body layout. */
    val genericBody: GenericMailBodyContent? = null,
)

/** Observed state for the Mailbox Item Detail screen. */
sealed interface MailboxItemDetailUiState {
    data object Loading : MailboxItemDetailUiState

    data class Loaded(
        val content: MailboxItemDetailContent,
    ) : MailboxItemDetailUiState

    data class Error(
        val message: String,
    ) : MailboxItemDetailUiState
}

/** Per-CTA busy / error flags surfaced to the view for optimistic UI. */
data class MailboxCTAFlags(
    val primaryLoading: Boolean = false,
    val ghostLoading: Boolean = false,
    val errorToast: String? = null,
    val primaryCompleted: Boolean = false,
)

/** ViewModel for the Mailbox Item Detail screen. */
@HiltViewModel
class MailboxItemDetailViewModel
    @Inject
    constructor(
        private val repo: MailboxRepository,
        private val networkMonitor: app.pantopus.android.data.network.NetworkMonitor,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        private val mailId: String =
            requireNotNull(savedStateHandle[MAILBOX_ITEM_DETAIL_MAIL_ID_KEY]) {
                "MailboxItemDetailViewModel requires a '$MAILBOX_ITEM_DETAIL_MAIL_ID_KEY' nav arg."
            }

        private val _state = MutableStateFlow<MailboxItemDetailUiState>(MailboxItemDetailUiState.Loading)

        /** Observed UI state. */
        val state: StateFlow<MailboxItemDetailUiState> = _state.asStateFlow()

        private val _ctaFlags = MutableStateFlow(MailboxCTAFlags())

        /** Ephemeral CTA busy + toast flags. */
        val ctaFlags: StateFlow<MailboxCTAFlags> = _ctaFlags.asStateFlow()

        /** Initial load; no-op when already loaded. */
        fun load() {
            if (_state.value is MailboxItemDetailUiState.Loaded) return
            refresh()
        }

        /** Pull-to-refresh / retry. */
        fun refresh() {
            _state.value = MailboxItemDetailUiState.Loading
            viewModelScope.launch { fetch() }
        }

        /** Clear the CTA error toast. */
        fun dismissToast() {
            _ctaFlags.update { it.copy(errorToast = null) }
        }

        /**
         * Whether the user has checked the "I acknowledge receipt" gate
         * on the certified body. The screen mirrors this into the
         * checkbox state. Primary CTA only enables when this is true.
         */
        private val _certifiedAckChecked = MutableStateFlow(false)
        val certifiedAckChecked: StateFlow<Boolean> = _certifiedAckChecked.asStateFlow()

        fun setCertifiedAckChecked(checked: Boolean) {
            _certifiedAckChecked.value = checked
        }

        /**
         * Primary CTA tap. Routes by category:
         *   Package    → [logAsReceived] (P9 flow)
         *   Coupon     → optimistic "added to wallet" client-side flip
         *   Booklet    → `file` action via the V2 item-action endpoint
         *   Certified  → `acknowledge` action; gated on
         *                [certifiedAckChecked] == true
         * No-op for any other category.
         */
        fun performPrimaryAction() {
            val current = _state.value as? MailboxItemDetailUiState.Loaded ?: return
            if (_ctaFlags.value.primaryLoading) return
            when (current.content.category) {
                MailItemCategory.Package -> logAsReceived()
                MailItemCategory.Coupon -> addToWallet()
                MailItemCategory.Booklet -> saveBookletToLibrary()
                MailItemCategory.Certified -> {
                    if (_certifiedAckChecked.value) acknowledgeReceipt()
                }
                MailItemCategory.Memory -> saveMemoryToVault()
                else -> Unit
            }
        }

        /**
         * "Save to Vault" — client-side keepsake flip (no backend).
         * Re-projects the loaded content with `isSaved == true` so the body
         * swaps the facts grid for the vault-location card and the elf copy
         * switches to the saved variant. No-ops if already kept.
         */
        private fun saveMemoryToVault() {
            val current = _state.value as? MailboxItemDetailUiState.Loaded ?: return
            val payload = current.content.payload as? MailboxCategoryPayload.Memory ?: return
            if (payload.detail.isSaved) return
            _state.value =
                MailboxItemDetailUiState.Loaded(
                    current.content.copy(
                        payload = MailboxCategoryPayload.Memory(payload.detail.copy(isSaved = true)),
                    ),
                )
        }

        /** Ghost CTA tap. Mirrors [performPrimaryAction]'s dispatch. */
        fun performGhostAction() {
            val current = _state.value as? MailboxItemDetailUiState.Loaded ?: return
            if (_ctaFlags.value.ghostLoading) return
            when (current.content.category) {
                MailItemCategory.Package -> markNotMine()
                MailItemCategory.Coupon -> saveCouponForLater()
                // "View terms" is a UI-only modal handled by the screen.
                MailItemCategory.Certified -> Unit
                else -> Unit
            }
        }

        // MARK: - Coupon actions

        /**
         * "Add to wallet" → POST .../action { action: "file" }. The
         * backend has no first-class wallet endpoint yet, so we persist
         * via the existing `file` action in the V2 whitelist
         * (`backend/routes/mailboxV2.js:465`). When a real wallet
         * endpoint lands, switch the action name without changing the
         * UI.
         */
        private fun addToWallet() {
            callItemAction(action = "file", primary = true) {
                _ctaFlags.update { it.copy(primaryCompleted = true) }
            }
        }

        /**
         * "Save for later" → POST .../action { action: "file" }. `file`
         * is the closest valid action in the V2 whitelist; a dedicated
         * `save_for_later` action would be cleaner.
         */
        private fun saveCouponForLater() {
            callItemAction(action = "file", primary = false)
        }

        // MARK: - Booklet actions

        /** "Save to library" → `file` action. Same rationale as coupon's. */
        private fun saveBookletToLibrary() {
            callItemAction(action = "file", primary = true)
        }

        // MARK: - Certified actions

        /**
         * "Acknowledge receipt" → POST .../action { action: "acknowledge" }.
         * `acknowledge` is in the V2 action whitelist
         * (`backend/routes/mailboxV2.js:465`).
         */
        private fun acknowledgeReceipt() {
            callItemAction(
                action = "acknowledge",
                primary = true,
                onSuccess = { _ctaFlags.update { it.copy(primaryCompleted = true) } },
            )
        }

        private fun callItemAction(
            action: String,
            primary: Boolean,
            onSuccess: (() -> Unit)? = null,
        ) {
            _ctaFlags.update {
                if (primary) it.copy(primaryLoading = true) else it.copy(ghostLoading = true)
            }
            viewModelScope.launch {
                when (val result = repo.itemAction(mailId, action)) {
                    is NetworkResult.Success -> {
                        onSuccess?.invoke()
                        _ctaFlags.update {
                            if (primary) it.copy(primaryLoading = false) else it.copy(ghostLoading = false)
                        }
                    }
                    is NetworkResult.Failure ->
                        _ctaFlags.update {
                            if (primary) {
                                it.copy(primaryLoading = false, errorToast = result.error.message)
                            } else {
                                it.copy(ghostLoading = false, errorToast = result.error.message)
                            }
                        }
                }
            }
        }

        /**
         * Primary CTA for Package: `PATCH .../status { status: "delivered" }`.
         * Applies an optimistic timeline flip, rolls back on failure.
         */
        fun logAsReceived() {
            val current = _state.value as? MailboxItemDetailUiState.Loaded ?: return
            if (_ctaFlags.value.primaryLoading) return
            app.pantopus.android.data.analytics.Analytics.track(
                app.pantopus.android.data.analytics.AnalyticsEvent.CtaMailboxItemLogReceived,
            )
            if (!networkMonitor.isOnline.value) {
                _ctaFlags.update {
                    it.copy(errorToast = "You're offline. Try again when you're back online.")
                }
                return
            }
            val originalTimeline = current.content.timeline
            val originalCtaEnabled = current.content.ctaEnabled
            val originalPackageInfo = current.content.packageInfo
            _state.value =
                MailboxItemDetailUiState.Loaded(
                    current.content.copy(
                        timeline = flipCurrentToDone(originalTimeline),
                        packageInfo = current.content.packageInfo?.receivedCopy(),
                        ctaEnabled = false,
                    ),
                )
            _ctaFlags.update { it.copy(primaryLoading = true) }
            viewModelScope.launch {
                when (val result = repo.packageStatusUpdate(mailId, status = "delivered")) {
                    is NetworkResult.Success ->
                        _ctaFlags.update { it.copy(primaryLoading = false, primaryCompleted = true) }
                    is NetworkResult.Failure -> {
                        (_state.value as? MailboxItemDetailUiState.Loaded)?.let { rolled ->
                            _state.value =
                                MailboxItemDetailUiState.Loaded(
                                    rolled.content.copy(
                                        timeline = originalTimeline,
                                        packageInfo = originalPackageInfo,
                                        ctaEnabled = originalCtaEnabled,
                                    ),
                                )
                        }
                        _ctaFlags.update {
                            it.copy(
                                primaryLoading = false,
                                errorToast = result.error.message,
                            )
                        }
                    }
                }
            }
        }

        /** Ghost CTA: `POST .../action { action: "not_mine" }`. */
        fun markNotMine() {
            val current = _state.value as? MailboxItemDetailUiState.Loaded ?: return
            if (_ctaFlags.value.ghostLoading) return
            _ctaFlags.update { it.copy(ghostLoading = true) }
            viewModelScope.launch {
                when (val result = repo.itemAction(mailId, "not_mine")) {
                    is NetworkResult.Success -> {
                        _state.value =
                            MailboxItemDetailUiState.Loaded(current.content.copy(ctaEnabled = false))
                        _ctaFlags.update { it.copy(ghostLoading = false) }
                    }
                    is NetworkResult.Failure ->
                        _ctaFlags.update {
                            it.copy(
                                ghostLoading = false,
                                errorToast = result.error.message,
                            )
                        }
                }
            }
        }

        private suspend fun fetch() {
            when (val result = repo.item(mailId)) {
                is NetworkResult.Failure ->
                    _state.value = MailboxItemDetailUiState.Error(result.error.displayMessage("Couldn't load this item."))
                is NetworkResult.Success -> {
                    val item = result.data.mail
                    val category = MailItemCategory.fromRaw(item.type)
                    when (category) {
                        MailItemCategory.Package -> fetchPackage(item, category)
                        MailItemCategory.Coupon,
                        MailItemCategory.Booklet,
                        MailItemCategory.Certified,
                        MailItemCategory.Community,
                        MailItemCategory.Gig,
                        MailItemCategory.Memory,
                        ->
                            _state.value =
                                MailboxItemDetailUiState.Loaded(projectCategoryBody(item, category))
                        else ->
                            _state.value =
                                MailboxItemDetailUiState.Loaded(projectBase(item, category))
                    }
                }
            }
        }

        /**
         * Coupon / Booklet / Certified — decode `object_payload` into a
         * typed payload and project facts + AI elf + (Certified only)
         * chain timeline + stamp.
         */
        private fun projectCategoryBody(
            item: MailboxV2Item,
            category: MailItemCategory,
        ): MailboxItemDetailContent {
            val payload =
                MailboxCategoryPayload.resolve(
                    category = category,
                    objectPayload = item.objectPayload,
                )
            val baseTrust = MailTrust.fromRaw(item.senderTrust)
            return when (payload) {
                is MailboxCategoryPayload.Coupon -> projectCoupon(item, category, payload.detail, baseTrust)
                is MailboxCategoryPayload.Booklet -> projectBooklet(item, category, payload.detail, baseTrust)
                is MailboxCategoryPayload.Certified -> projectCertified(item, category, payload.detail)
                is MailboxCategoryPayload.Community -> projectCommunity(item, category, payload.detail, baseTrust)
                is MailboxCategoryPayload.Gig -> projectGig(item, category, payload.detail, baseTrust)
                is MailboxCategoryPayload.Memory -> projectMemory(item, category, payload.detail)
                // Records (A17.10) is rendered on the live `mail_detail` path
                // (MailDetailScreen → RecordsDetailLayout). This parallel
                // item_detail surface treats it as a generic item.
                is MailboxCategoryPayload.Records -> projectBase(item, category)
                MailboxCategoryPayload.Other -> projectBase(item, category)
            }
        }

        /**
         * Community (A17.4) — group seal, poll/event/update card, attendee
         * strip, Pulse link, and RSVP controls live in `CommunityBody`, so
         * the standard shell slots stay intentionally quiet.
         */
        private fun projectCommunity(
            item: MailboxV2Item,
            category: MailItemCategory,
            community: CommunityDetailDto,
            baseTrust: MailTrust,
        ): MailboxItemDetailContent =
            MailboxItemDetailContent(
                category = category,
                trust = if (baseTrust == MailTrust.Unverified) MailTrust.Verified else baseTrust,
                sender =
                    SenderBlockContent(
                        displayName = item.senderDisplay,
                        meta = item.createdAt,
                        initials = initials(item.senderDisplay),
                        senderUserId = item.senderUserId,
                    ),
                aiElf = null,
                keyFacts = emptyList(),
                timeline = emptyList(),
                packageInfo = null,
                ctaEnabled = true,
                isUnread = !item.viewed,
                isArchived = item.archived,
                payload = MailboxCategoryPayload.Community(community),
            )

        /**
         * Gig (A17.6) — the bidder becomes the sender; the rich gig surface
         * (bidder/post/bid cards + action row or accepted timeline) lives in
         * `GigBody`, so the shell carries no AI elf / KeyFacts / timeline and
         * no sticky CTA shelf (the three-way action row is in the body).
         */
        private fun projectGig(
            item: MailboxV2Item,
            category: MailItemCategory,
            gig: GigDetailDto,
            baseTrust: MailTrust,
        ): MailboxItemDetailContent =
            MailboxItemDetailContent(
                category = category,
                trust = baseTrust,
                sender =
                    SenderBlockContent(
                        displayName = gig.bidder.name,
                        meta = item.createdAt,
                        initials = initials(gig.bidder.name),
                        senderUserId = item.senderUserId,
                    ),
                aiElf = null,
                keyFacts = emptyList(),
                timeline = emptyList(),
                packageInfo = null,
                ctaEnabled = true,
                isUnread = !item.viewed,
                isArchived = item.archived,
                payload = MailboxCategoryPayload.Gig(gig),
            )

        /**
         * Memory (A17.7) — project the keepsake payload. The body owns the
         * polaroid / note / facts / vault rendering; the shell only needs a
         * verified sender block (the elf + facts are not the standard
         * slots), so [aiElf] / keyFacts / timeline stay empty.
         */
        private fun projectMemory(
            item: MailboxV2Item,
            category: MailItemCategory,
            memory: MemoryDetailDto,
        ): MailboxItemDetailContent =
            MailboxItemDetailContent(
                category = category,
                trust = MailTrust.Verified,
                sender =
                    SenderBlockContent(
                        displayName = item.senderDisplay,
                        meta = item.createdAt,
                        initials = initials(item.senderDisplay),
                        senderUserId = item.senderUserId,
                    ),
                aiElf = null,
                keyFacts = emptyList(),
                timeline = emptyList(),
                packageInfo = null,
                ctaEnabled = true,
                isUnread = !item.viewed,
                isArchived = item.archived,
                payload = MailboxCategoryPayload.Memory(memory),
            )

        /**
         * Accept the incoming bid. Optimistically flips the gig payload into
         * its accepted state (the body swaps the action row for the next-steps
         * timeline). No network — the gig action endpoint was removed with the
         * backend; re-point this at the real endpoint when it lands.
         */
        fun acceptGigBid() {
            val current = _state.value as? MailboxItemDetailUiState.Loaded ?: return
            val payload = current.content.payload as? MailboxCategoryPayload.Gig ?: return
            if (payload.detail.isAccepted) return
            _state.value =
                MailboxItemDetailUiState.Loaded(
                    current.content.copy(
                        ctaEnabled = false,
                        payload = MailboxCategoryPayload.Gig(payload.detail.accepted()),
                    ),
                )
        }

        private fun projectCoupon(
            item: MailboxV2Item,
            category: MailItemCategory,
            coupon: CouponDetailDto,
            baseTrust: MailTrust,
        ): MailboxItemDetailContent {
            val aiElf =
                coupon.expiresAt?.let { expiry ->
                    daysUntil(expiry)?.takeIf { it in 0..30 }?.let { days ->
                        AIElfContent(
                            suggestion = "Expires in $days day${if (days == 1) "" else "s"} — add to wallet before then?",
                            primaryChip = "Add to wallet",
                            secondaryChip = "Remind me later",
                        )
                    }
                }
            val facts =
                buildList {
                    coupon.merchant?.let { add(KeyFactRow(label = "Merchant", value = it)) }
                    coupon.code?.let { add(KeyFactRow(label = "Code", value = it, isCode = true)) }
                    coupon.terms?.let { add(KeyFactRow(label = "Terms", value = it)) }
                    coupon.minimumSpend?.let { add(KeyFactRow(label = "Minimum spend", value = it)) }
                }
            return MailboxItemDetailContent(
                category = category,
                trust = baseTrust,
                sender =
                    SenderBlockContent(
                        displayName = item.senderDisplay,
                        meta = item.createdAt,
                        initials = initials(item.senderDisplay),
                        senderUserId = item.senderUserId,
                    ),
                aiElf = aiElf,
                keyFacts = facts,
                timeline = emptyList(),
                packageInfo = null,
                ctaEnabled = true,
                isUnread = !item.viewed,
                isArchived = item.archived,
                payload = MailboxCategoryPayload.Coupon(coupon),
            )
        }

        private fun projectBooklet(
            item: MailboxV2Item,
            category: MailItemCategory,
            booklet: BookletDetailDto,
            baseTrust: MailTrust,
        ): MailboxItemDetailContent =
            MailboxItemDetailContent(
                category = category,
                trust = baseTrust,
                sender =
                    SenderBlockContent(
                        displayName = item.senderDisplay,
                        meta = item.createdAt,
                        initials = initials(item.senderDisplay),
                        senderUserId = item.senderUserId,
                    ),
                aiElf = null,
                keyFacts =
                    listOf(
                        KeyFactRow(label = "Sender", value = item.senderDisplay),
                        KeyFactRow(label = "Pages", value = "${booklet.pageCount}"),
                        KeyFactRow(label = "Received at", value = item.createdAt),
                    ),
                timeline = emptyList(),
                packageInfo = null,
                ctaEnabled = true,
                isUnread = !item.viewed,
                isArchived = item.archived,
                payload = MailboxCategoryPayload.Booklet(booklet),
            )

        private fun projectCertified(
            item: MailboxV2Item,
            category: MailItemCategory,
            certified: CertifiedDetailDto,
        ): MailboxItemDetailContent {
            val timeline =
                certified.chain.map { step ->
                    TimelineStep(
                        title = step.label,
                        state = if (step.isComplete) TimelineStepState.Done else TimelineStepState.Upcoming,
                        subtitle = step.occurredAt,
                    )
                }
            val aiElf =
                certified.acknowledgeBy?.let { deadline ->
                    val days = daysUntil(deadline) ?: 0
                    AIElfContent(
                        suggestion = "Acknowledge by $deadline — $days day${if (days == 1) "" else "s"} remaining",
                        primaryChip = "Acknowledge now",
                        secondaryChip = "View terms",
                    )
                }
            val facts =
                buildList {
                    add(KeyFactRow(label = "Reference #", value = certified.referenceNumber, isCode = true))
                    add(KeyFactRow(label = "Sender", value = item.senderDisplay))
                    certified.acknowledgeBy?.let {
                        add(KeyFactRow(label = "Acknowledge by", value = it))
                    }
                    certified.documentType?.let {
                        add(KeyFactRow(label = "Document type", value = it))
                    }
                }
            return MailboxItemDetailContent(
                category = category,
                trust = MailTrust.CertifiedChain,
                sender =
                    SenderBlockContent(
                        displayName = item.senderDisplay,
                        meta = item.createdAt,
                        initials = initials(item.senderDisplay),
                        senderUserId = item.senderUserId,
                        showStamp = true,
                    ),
                aiElf = aiElf,
                keyFacts = facts,
                timeline = timeline,
                packageInfo = null,
                ctaEnabled = !certified.isAcknowledged,
                isUnread = !item.viewed,
                isArchived = item.archived,
                payload = MailboxCategoryPayload.Certified(certified),
            )
        }

        private suspend fun fetchPackage(
            item: MailboxV2Item,
            category: MailItemCategory,
        ) {
            when (val result = repo.packageDetail(mailId)) {
                is NetworkResult.Failure ->
                    _state.value = MailboxItemDetailUiState.Loaded(projectBase(item, category))
                is NetworkResult.Success ->
                    _state.value = MailboxItemDetailUiState.Loaded(projectPackage(item, result.data))
            }
        }

        private fun projectBase(
            item: MailboxV2Item,
            category: MailItemCategory,
        ): MailboxItemDetailContent =
            MailboxItemDetailContent(
                category = category,
                trust = MailTrust.fromRaw(item.senderTrust),
                sender =
                    SenderBlockContent(
                        displayName = item.senderDisplay,
                        meta = item.createdAt,
                        initials = initials(item.senderDisplay),
                        senderUserId = item.senderUserId,
                    ),
                aiElf = null,
                keyFacts =
                    listOf(
                        KeyFactRow(label = "Subject", value = item.displayTitle ?: "—"),
                        KeyFactRow(label = "Received", value = item.createdAt),
                    ),
                timeline = emptyList(),
                packageInfo = null,
                ctaEnabled = true,
                isUnread = !item.viewed,
                isArchived = item.archived,
                genericBody = genericBody(item, category),
            )

        private fun genericBody(
            item: MailboxV2Item,
            category: MailItemCategory,
        ): GenericMailBodyContent =
            GenericMailBodyContent(
                category = category,
                paragraphs = bodyParagraphs(item),
                attachments = item.attachments.orEmpty(),
                tags = item.tags,
                actionLabel = actionLabel(item),
            )

        private fun bodyParagraphs(item: MailboxV2Item): List<String> {
            val content = item.content?.trim()
            val source =
                content?.takeIf { it.isNotEmpty() }
                    ?: item.previewText?.trim()?.takeIf { it.isNotEmpty() }
            if (source.isNullOrEmpty()) return emptyList()
            return source
                .split("\n\n")
                .map { it.trim() }
                .filter { it.isNotEmpty() }
        }

        private fun actionLabel(item: MailboxV2Item): String? =
            when {
                item.ackRequired == true -> "Acknowledge"
                item.actionRequired == true -> "Action needed"
                else -> null
            }

        private fun projectPackage(
            item: MailboxV2Item,
            pkg: PackageDetailResponse,
        ): MailboxItemDetailContent {
            val map = pkg.`package`
            val tracking = map["tracking_number"] as? String
            val carrier = (map["carrier"] as? String) ?: "Carrier"
            val currentStatus = (map["status"] as? String) ?: "in_transit"
            val deliveryStatus = PackageDeliveryStatus.fromRaw(currentStatus)
            val received =
                (map["logged_as_received"] as? Boolean)
                    ?: (map["received"] as? Boolean)
                    ?: ((map["received_at"] as? String) != null)
            val facts =
                buildList {
                    if (tracking != null) {
                        add(KeyFactRow(label = "Tracking #", value = tracking, isCode = true))
                    }
                    add(KeyFactRow(label = "Sender", value = item.senderDisplay))
                    add(KeyFactRow(label = "Carrier", value = carrier))
                    add(KeyFactRow(label = "Received at", value = item.createdAt))
                }
            return MailboxItemDetailContent(
                category = MailItemCategory.Package,
                trust = MailTrust.fromRaw(item.senderTrust),
                sender =
                    SenderBlockContent(
                        displayName = item.senderDisplay,
                        meta = pkg.sender?.display ?: carrier,
                        initials = initials(item.senderDisplay),
                        senderUserId = item.senderUserId,
                    ),
                aiElf = null,
                keyFacts = facts,
                timeline = timeline(currentStatus),
                packageInfo =
                    packageBodyContent(
                        carrier = carrier,
                        trackingNumber = tracking,
                        packageMap = map,
                        responseTimeline = pkg.timeline,
                        status = deliveryStatus,
                        received = received,
                    ),
                ctaEnabled = deliveryStatus == PackageDeliveryStatus.Delivered && !received,
                isUnread = !item.viewed,
                isArchived = item.archived,
            )
        }

        private fun initials(name: String): String =
            name
                .trim()
                .split(" ")
                .take(2)
                .mapNotNull { it.firstOrNull()?.toString() }
                .joinToString("")
                .uppercase()

        /**
         * Number of whole days from now until the supplied ISO-8601
         * string, rounded down. Accepts both full timestamps
         * (`2026-05-31T12:00:00Z`) and date-only strings
         * (`2026-05-31`). Negative when in the past; null when the
         * string can't be parsed.
         */
        private fun daysUntil(iso: String): Int? {
            val instant =
                runCatching { Instant.parse(iso) }
                    .getOrNull()
                    ?: runCatching {
                        java.time.LocalDate
                            .parse(iso)
                            .atStartOfDay(java.time.ZoneOffset.UTC)
                            .toInstant()
                    }.getOrNull()
                    ?: return null
            return Duration.between(Instant.now(), instant).toDays().toInt()
        }

        private fun timeline(status: String): List<TimelineStep> {
            val deliveryStatus = PackageDeliveryStatus.fromRaw(status)
            return MailItemSampleData.packageTrackingSteps(deliveryStatus)
        }

        private fun flipCurrentToDone(steps: List<TimelineStep>): List<TimelineStep> {
            val index = steps.indexOfFirst { it.state == TimelineStepState.Current }
            if (index < 0) return steps
            return steps.mapIndexed { i, step ->
                when (i) {
                    index -> step.copy(state = TimelineStepState.Done)
                    index + 1 -> step.copy(state = TimelineStepState.Current)
                    else -> step
                }
            }
        }
    }

private fun Map<String, Any?>.stringValue(vararg keys: String): String? = keys.firstNotNullOfOrNull { key -> this[key] as? String }

private fun packageBodyContent(
    carrier: String,
    trackingNumber: String?,
    packageMap: Map<String, Any?>,
    responseTimeline: List<Any?>,
    status: PackageDeliveryStatus,
    received: Boolean,
): PackageBodyContent {
    val sample = MailItemSampleData.packageBody(status)
    val statusTitle =
        packageMap.stringValue("status_title", "status_label")
            ?: sample.statusTitle
    val statusDetail =
        packageMap.stringValue("status_detail", "eta_line")
            ?: sample.statusDetail
    return PackageBodyContent(
        carrier = carrier,
        service =
            packageMap.stringValue("service", "delivery_service", "mail_service")
                ?: sample.service,
        dimensions =
            packageMap.stringValue("dimensions", "size")
                ?: sample.dimensions,
        weight = packageMap.stringValue("weight") ?: sample.weight,
        trackingUrl =
            packageMap.stringValue("tracking_url", "carrier_url")
                ?: sample.trackingUrl,
        etaLine = packageMap.stringValue("eta_line") ?: sample.etaLine,
        status = status,
        trackingNumber = trackingNumber ?: sample.trackingNumber,
        referenceLine =
            packageMap.stringValue("reference", "reference_line")
                ?: sample.referenceLine,
        statusTitle = if (received) "Logged as received" else statusTitle,
        statusDetail = if (received) "Today - by you" else statusDetail,
        trackingSteps =
            MailItemSampleData.packageTrackingSteps(status).map {
                if (received) it.copy(state = TimelineStepState.Done) else it
            },
        handoffSteps = packageHandoffSteps(responseTimeline, sample.handoffSteps),
        deliveryPhoto = packagePhoto(packageMap, sample.deliveryPhoto, received),
        contents = sample.contents,
    )
}

private fun packageHandoffSteps(
    timeline: List<Any?>,
    fallback: List<PackageHandoffStep>,
): List<PackageHandoffStep> {
    val decoded =
        timeline.mapIndexedNotNull { index, raw ->
            val map = raw as? Map<*, *> ?: return@mapIndexedNotNull null
            val title =
                (map["label"] as? String)
                    ?: (map["title"] as? String)
                    ?: (map["status"] as? String)
                    ?: return@mapIndexedNotNull null
            PackageHandoffStep(
                id = (map["id"] as? String) ?: "handoff-$index",
                title = title,
                location =
                    (map["where"] as? String)
                        ?: (map["location"] as? String)
                        ?: "Carrier network",
                timestamp =
                    (map["when"] as? String)
                        ?: (map["timestamp"] as? String)
                        ?: (map["occurred_at"] as? String)
                        ?: "Pending",
                icon = iconNamed(map["icon"] as? String),
            )
        }
    return decoded.ifEmpty { fallback }
}

private fun packagePhoto(
    map: Map<String, Any?>,
    fallback: PackageDeliveryPhoto?,
    received: Boolean,
): PackageDeliveryPhoto? {
    val photoMap =
        (map["delivery_photo"] as? Map<*, *>)
            ?: (map["photo"] as? Map<*, *>)
    if (fallback == null && photoMap == null) return null
    return PackageDeliveryPhoto(
        capturedAt =
            (photoMap?.get("captured_at") as? String)
                ?: (photoMap?.get("time") as? String)
                ?: fallback?.capturedAt
                ?: "Delivery scan",
        watermark =
            (photoMap?.get("watermark") as? String)
                ?: fallback?.watermark
                ?: "Courier proof photo",
        location =
            (photoMap?.get("location") as? String)
                ?: (photoMap?.get("where") as? String)
                ?: fallback?.location
                ?: "Delivery location",
        verificationLabel =
            (photoMap?.get("verification_label") as? String)
                ?: fallback?.verificationLabel
                ?: "Verified",
        isReceived = received || (fallback?.isReceived == true),
    )
}

private fun iconNamed(raw: String?): PantopusIcon =
    when (raw) {
        "home" -> PantopusIcon.Home
        "building-2" -> PantopusIcon.Building2
        "tag" -> PantopusIcon.Tag
        "camera" -> PantopusIcon.Camera
        "map-pin" -> PantopusIcon.MapPin
        "package", "package-2", "truck" -> PantopusIcon.Package
        "arrow-right" -> PantopusIcon.ArrowRight
        else -> PantopusIcon.Circle
    }
