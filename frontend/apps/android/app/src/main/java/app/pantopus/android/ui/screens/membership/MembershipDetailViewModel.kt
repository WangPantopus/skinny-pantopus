@file:Suppress("PackageNaming", "TooManyFunctions")

package app.pantopus.android.ui.screens.membership

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.membership.MembershipPersonaDto
import app.pantopus.android.data.api.models.membership.MembershipTierDto
import app.pantopus.android.data.api.models.membership.PersonaMembershipDto
import app.pantopus.android.data.api.models.membership.PersonaPublicTierDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.membership.MembershipRepository
import app.pantopus.android.ui.components.PersonaPillar
import app.pantopus.android.ui.theme.PantopusIcon
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import java.util.Locale
import javax.inject.Inject
import kotlin.math.max

/**
 * Nav-arg key for the persona id read off the back-stack handle. Matches the
 * `ChildRoutes.MEMBERSHIP_DETAIL` route template (`personas/{personaId}/...`).
 */
const val MEMBERSHIP_DETAIL_PERSONA_ID_KEY = "personaId"

/**
 * A10.8 — Backs the fan-side membership manage screen. `load()` fetches the
 * fan's own membership from `GET /api/personas/:id/membership`
 * (`backend/routes/personaMembership.js:108`) and projects it onto the
 * existing [MembershipDetailContent]. The [MembershipSampleData] fixtures
 * remain the preview/snapshot seam (the Paparazzi tests render
 * `MembershipLoadedContent` with the sample directly).
 *
 * Mutations, all real round-trips:
 *  * Cancel    → `POST .../membership/cancel`    (`personaMembership.js:204`)
 *  * Upgrade   → `POST .../membership/upgrade`   (`personaMembership.js:121`)
 *                — takes effect immediately.
 *  * Downgrade → `POST .../membership/downgrade` (`personaMembership.js:162`)
 *                — scheduled at `current_period_end`.
 *  * Refund    → `POST .../membership/refund-request`
 *                (`personaMembership.js:251`) with `reason: sla_missed`.
 *
 * The tier ladder for the picker comes from `GET /api/personas/:handle/tiers`
 * (`personas.js:1111`).
 */
@HiltViewModel
class MembershipDetailViewModel
    @Inject
    constructor(
        savedStateHandle: SavedStateHandle,
        private val repository: MembershipRepository,
    ) : ViewModel() {
        private val personaId: String =
            savedStateHandle.get<String>(MEMBERSHIP_DETAIL_PERSONA_ID_KEY).orEmpty()

        private val _state = MutableStateFlow<MembershipDetailUiState>(MembershipDetailUiState.Loading)
        val state: StateFlow<MembershipDetailUiState> = _state.asStateFlow()

        private val _actionError = MutableStateFlow<String?>(null)
        val actionError: StateFlow<String?> = _actionError.asStateFlow()

        private val _isCancelling = MutableStateFlow(false)
        val isCancelling: StateFlow<Boolean> = _isCancelling.asStateFlow()

        /** Change-tier picker. */
        private val _isTierPickerOpen = MutableStateFlow(false)
        val isTierPickerOpen: StateFlow<Boolean> = _isTierPickerOpen.asStateFlow()

        private val _tierOptions = MutableStateFlow<List<MembershipTierOption>>(emptyList())
        val tierOptions: StateFlow<List<MembershipTierOption>> = _tierOptions.asStateFlow()

        private val _isChangingTier = MutableStateFlow(false)
        val isChangingTier: StateFlow<Boolean> = _isChangingTier.asStateFlow()

        private val _tierChangeConfirmation = MutableStateFlow<String?>(null)
        val tierChangeConfirmation: StateFlow<String?> = _tierChangeConfirmation.asStateFlow()

        /** Refund request sheet. */
        private val _isRefundSheetOpen = MutableStateFlow(false)
        val isRefundSheetOpen: StateFlow<Boolean> = _isRefundSheetOpen.asStateFlow()

        private val _isRequestingRefund = MutableStateFlow(false)
        val isRequestingRefund: StateFlow<Boolean> = _isRequestingRefund.asStateFlow()

        private val _refundConfirmation = MutableStateFlow<String?>(null)
        val refundConfirmation: StateFlow<String?> = _refundConfirmation.asStateFlow()

        private val _refundError = MutableStateFlow<String?>(null)
        val refundError: StateFlow<String?> = _refundError.asStateFlow()

        private var currentTierRank: Int = 1
        private var personaHandle: String? = null

        fun load() {
            _state.value = MembershipDetailUiState.Loading
            _actionError.value = null
            viewModelScope.launch {
                when (val result = repository.membership(personaId)) {
                    is NetworkResult.Success -> {
                        val membership = result.data.membership
                        if (membership?.persona != null) {
                            apply(membership)
                            loadTierLadder()
                        } else {
                            _state.value =
                                MembershipDetailUiState.Error("We couldn't find your membership.")
                        }
                    }
                    is NetworkResult.Failure -> {
                        _state.value =
                            MembershipDetailUiState.Error(
                                if (result.error is NetworkError.NotFound) {
                                    "We couldn't find your membership."
                                } else {
                                    "Couldn't load membership."
                                },
                            )
                    }
                }
            }
        }

        fun refresh() = load()

        /** Settle a freshly-read membership into state + the picker inputs. */
        private fun apply(membership: PersonaMembershipDto) {
            currentTierRank = membership.tier?.rank ?: 1
            personaHandle = membership.persona?.handle
            _state.value =
                MembershipDetailUiState.Populated(MembershipProjection.project(membership, personaId))
        }

        /**
         * Public tier ladder for the picker. Non-blocking: a failure here
         * leaves the picker empty rather than failing the whole screen
         * (mirrors RN, which swallows the tier-list error).
         */
        private suspend fun loadTierLadder() {
            val handle = personaHandle
            if (handle.isNullOrEmpty()) {
                _tierOptions.value = emptyList()
                return
            }
            _tierOptions.value =
                when (val result = repository.publicTiers(handle)) {
                    is NetworkResult.Success ->
                        MembershipProjection.tierOptions(result.data.tiers, currentTierRank)
                    is NetworkResult.Failure -> emptyList()
                }
        }

        // --- Change tier ---------------------------------------------------

        fun presentTierPicker() {
            _actionError.value = null
            _tierChangeConfirmation.value = null
            _isTierPickerOpen.value = true
        }

        fun dismissTierPicker() {
            _isTierPickerOpen.value = false
        }

        /**
         * Upgrade (immediate) or downgrade (scheduled at period end), chosen
         * by comparing the target rank with the current one — the backend
         * enforces the same split across two distinct routes.
         */
        fun changeTier(option: MembershipTierOption) {
            if (_isChangingTier.value || option.rank == currentTierRank) return
            _isChangingTier.value = true
            _actionError.value = null
            _tierChangeConfirmation.value = null
            viewModelScope.launch {
                val result =
                    if (option.direction == MembershipTierDirection.Upgrade) {
                        repository.upgrade(personaId, option.rank)
                    } else {
                        repository.downgrade(personaId, option.rank)
                    }
                _isChangingTier.value = false
                when (result) {
                    is NetworkResult.Success -> {
                        _isTierPickerOpen.value = false
                        _tierChangeConfirmation.value =
                            if (option.direction == MembershipTierDirection.Upgrade) {
                                "Tier upgraded."
                            } else {
                                "Downgrade scheduled — takes effect at the end of this period."
                            }
                        val membership = result.data.membership
                        if (membership?.persona != null) {
                            apply(membership)
                            // Re-derive the ladder so directions flip around
                            // the new rank.
                            loadTierLadder()
                        } else {
                            load()
                        }
                    }
                    is NetworkResult.Failure ->
                        _actionError.value = "Couldn't change tier. Please try again."
                }
            }
        }

        // --- Refund request ------------------------------------------------

        fun presentRefundSheet() {
            _refundError.value = null
            _refundConfirmation.value = null
            _isRefundSheetOpen.value = true
        }

        fun dismissRefundSheet() {
            _isRefundSheetOpen.value = false
        }

        /**
         * SLA-missed refund. The backend re-validates that one of the fan's
         * threads is genuinely past its reply window and answers
         * `400 no_sla_missed_thread` when it isn't — surfaced verbatim so the
         * fan understands why nothing was refunded.
         */
        fun requestRefund() {
            if (_isRequestingRefund.value) return
            _isRequestingRefund.value = true
            _refundError.value = null
            viewModelScope.launch {
                val result = repository.requestRefund(personaId)
                _isRequestingRefund.value = false
                when (result) {
                    is NetworkResult.Success -> {
                        _isRefundSheetOpen.value = false
                        _refundConfirmation.value =
                            "Refund requested. You'll get a confirmation email shortly."
                        val membership = result.data.membership
                        if (membership?.persona != null) apply(membership) else load()
                    }
                    is NetworkResult.Failure ->
                        _refundError.value = refundErrorMessage(result.error)
                }
            }
        }

        /** "Give it a week" — drop the SLA banner and settle to the happy path. */
        fun dismissSlaAlert() {
            val current = _state.value
            if (current is MembershipDetailUiState.SlaMissed) {
                _state.value = MembershipDetailUiState.Populated(current.content.clearingSlaAlert())
            }
        }

        /**
         * Single-tap cancel. Posts the no-charge cancel and, on success, hands
         * off to [onCancelled] (the host's navigation). On failure surfaces an
         * inline error and stays put.
         */
        fun cancel(onCancelled: () -> Unit) {
            if (_isCancelling.value) return
            _isCancelling.value = true
            _actionError.value = null
            viewModelScope.launch {
                when (repository.cancel(personaId)) {
                    is NetworkResult.Success -> {
                        _isCancelling.value = false
                        onCancelled()
                    }
                    is NetworkResult.Failure -> {
                        _isCancelling.value = false
                        _actionError.value = "Couldn't cancel right now. Please try again."
                    }
                }
            }
        }

        companion object {
            private const val REFUND_ALREADY_REQUESTED_STATUS = 409

            internal fun refundErrorMessage(error: NetworkError): String =
                when {
                    error is NetworkError.ClientError && error.code == REFUND_ALREADY_REQUESTED_STATUS ->
                        "You've already requested a refund for this membership."
                    error is NetworkError.ClientError -> error.message
                    else -> "Couldn't request a refund."
                }
        }
    }

/**
 * Maps the backend membership read onto [MembershipDetailContent]. Mirrors
 * iOS `MembershipDetailViewModel.project`. Kept as a top-level object so it is
 * unit-testable without a ViewModel.
 */
@Suppress("MagicNumber", "ReturnCount")
internal object MembershipProjection {
    fun project(
        dto: PersonaMembershipDto,
        personaId: String = "",
    ): MembershipDetailContent =
        MembershipDetailContent(
            persona = projectPersona(dto.persona),
            tier = tierForRank(dto.tier?.rank),
            priceLabel = priceLabel(dto.tier?.priceCents, dto.tier?.currency),
            periodLabel = periodLabel(dto.tier?.billingInterval),
            renewalLabel = renewalLabel(dto.currentPeriodEnd, dto.cancelAtPeriodEnd == true),
            // Payment-method detail isn't on the membership read (Phase 3,
            // Stripe). Surface an honest, non-fabricated descriptor.
            paymentLabel = "Managed by Stripe",
            benefits = benefits(dto.tier),
            policyFootnote = MembershipSampleData.POLICY_FOOTNOTE,
            slaAlert = null,
            personaId = dto.persona?.id ?: personaId,
            inbox =
                MembershipInboxCard(
                    remainingThreads = dto.quotaRemaining?.msgThreads,
                    threadsPerPeriod = dto.tier?.msgThreadsPerPeriod,
                ),
            hasScheduledTierChange = dto.scheduledTierChange?.tierId != null,
            isTerminal = dto.status == "canceled" || dto.status == "expired",
            cancelAtPeriodEnd = dto.cancelAtPeriodEnd == true,
        )

    /**
     * Ladder rows for the change-tier picker — current rank removed,
     * direction derived from the rank comparison so the sheet can state
     * "Takes effect immediately" vs "Scheduled for the end of this period".
     */
    fun tierOptions(
        tiers: List<PersonaPublicTierDto>,
        currentRank: Int,
    ): List<MembershipTierOption> =
        tiers
            .filter { it.rank != currentRank }
            .sortedBy { it.rank }
            .map { tier ->
                MembershipTierOption(
                    id = tier.id,
                    rank = tier.rank,
                    name = tier.name ?: "Tier ${tier.rank}",
                    priceLabel = tierPriceLabel(tier),
                    direction =
                        if (tier.rank > currentRank) {
                            MembershipTierDirection.Upgrade
                        } else {
                            MembershipTierDirection.Downgrade
                        },
                )
            }

    private fun tierPriceLabel(tier: PersonaPublicTierDto): String {
        val price = priceLabel(tier.priceCents, tier.currency)
        if (price == "Free") return price
        return "$price / ${periodLabel(tier.billingInterval)}"
    }

    private fun projectPersona(dto: MembershipPersonaDto?): MembershipPersona {
        val name = dto?.displayName ?: dto?.handle ?: "Creator"
        return MembershipPersona(
            id = dto?.id ?: "",
            name = name,
            initials = initials(name),
            subtitle = subtitle(dto?.category, dto?.audienceLabel, dto?.followerCount),
            pillar = PersonaPillar.Business,
            pillarLabel = "Creator",
            verified = dto?.credential?.status == "verified",
        )
    }

    private fun initials(name: String): String =
        name.split(" ").filter { it.isNotEmpty() }.take(2)
            .joinToString("") { it.first().toString() }
            .uppercase()

    private fun subtitle(
        category: String?,
        audienceLabel: String?,
        followerCount: Int?,
    ): String {
        val parts = mutableListOf<String>()
        if (!category.isNullOrEmpty()) parts.add(category.replaceFirstChar { it.uppercase() })
        if (followerCount != null) parts.add("${formatCount(followerCount)} ${audienceLabel ?: "members"}")
        return parts.joinToString(" · ")
    }

    private fun tierForRank(rank: Int?): MembershipTier =
        when (rank ?: 1) {
            2 -> MembershipTier.Silver
            in 3..Int.MAX_VALUE -> MembershipTier.Gold
            else -> MembershipTier.Bronze
        }

    private fun priceLabel(
        cents: Int?,
        currency: String?,
    ): String {
        if (cents == null || cents <= 0) return "Free"
        val symbol = if (currency == null || currency.lowercase() == "usd") "$" else "${currency.uppercase()} "
        return if (cents % 100 == 0) "$symbol${cents / 100}" else String.format(Locale.US, "$symbol%.2f", cents / 100.0)
    }

    private fun periodLabel(interval: String?): String =
        when (interval) {
            "year", "yearly", "annual" -> "year"
            "week", "weekly" -> "week"
            else -> "month"
        }

    private fun renewalLabel(
        endIso: String?,
        cancelAtPeriodEnd: Boolean,
    ): String {
        val date =
            endIso?.let { runCatching { Instant.parse(it).atZone(ZoneId.systemDefault()).toLocalDate() }.getOrNull() }
                ?: return if (cancelAtPeriodEnd) "Cancels at the end of this period" else "Renews automatically"
        val dateStr = date.format(DateTimeFormatter.ofPattern("MMM d", Locale.US))
        if (cancelAtPeriodEnd) return "Cancels on $dateStr"
        val days = max(0L, ChronoUnit.DAYS.between(LocalDate.now(), date)).toInt()
        return "Renews on $dateStr · $days days from now"
    }

    /** Benefit rows derived from the tier's perk fields — real data, not fabricated. */
    private fun benefits(tier: MembershipTierDto?): List<MembershipBenefit> {
        if (tier == null) return emptyList()
        val rows = mutableListOf<MembershipBenefit>()
        tier.msgThreadsPerPeriod?.let { threads ->
            if (threads != 0) {
                rows.add(
                    MembershipBenefit(
                        id = "threads",
                        icon = PantopusIcon.MessageCircle,
                        label = "Direct message threads",
                        meta = if (threads < 0) "Unlimited" else "$threads per period",
                    ),
                )
            }
        }
        if (tier.creatorCanInitiateDm == true) {
            rows.add(
                MembershipBenefit(
                    id = "creatorDm",
                    icon = PantopusIcon.Mail,
                    label = "Creator can message you",
                    meta = "Replies land in your inbox",
                ),
            )
        }
        tier.replyPolicy?.takeIf { it.isNotEmpty() }?.let { policy ->
            rows.add(
                MembershipBenefit(
                    id = "replyPolicy",
                    icon = PantopusIcon.MessageCircle,
                    label = "Reply policy",
                    meta = policy.replace("_", " ").replaceFirstChar { it.uppercase() },
                ),
            )
        }
        return rows
    }

    private fun formatCount(count: Int): String = String.format(Locale.US, "%,d", count)
}
