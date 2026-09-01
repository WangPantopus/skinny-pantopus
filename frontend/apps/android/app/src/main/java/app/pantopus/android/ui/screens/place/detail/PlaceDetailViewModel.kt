package app.pantopus.android.ui.screens.place.detail

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.place.BlockInviteRecipient
import app.pantopus.android.data.api.models.place.FridgeCardItem
import app.pantopus.android.data.api.models.place.IssueFridgeCardRequest
import app.pantopus.android.data.api.models.place.PlaceIntelligence
import app.pantopus.android.data.api.models.place.PlaceSectionEnvelope
import app.pantopus.android.data.api.models.place.PlaceSectionId
import app.pantopus.android.data.api.models.place.UnlistedProfile
import app.pantopus.android.data.api.models.place.UnlistedRemovalStatus
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.place.PlaceRepository
import app.pantopus.android.ui.screens.place.PlaceDetailGroup
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.math.BigDecimal
import java.math.RoundingMode
import javax.inject.Inject

const val PLACE_DETAIL_HOME_ID_KEY = "homeId"
const val PLACE_DETAIL_SLUG_KEY = "slug"

/**
 * Container VM for a Place group-detail page (W2.3). Fetches the home's
 * PlaceIntelligence (the dashboard's warm cache) and exposes the four
 * states; the screen extracts the page's sections via [PlaceDetailGroup].
 * Mirrors the iOS `PlaceDetailViewModel`.
 */
private const val MAX_SEED_ITEMS = 12

/** Two letters, as the Block Founders route's address validator demands. */
private const val STATE_CODE_LENGTH = 2

// Mirrors the server's clamp (realRentService.normalizeBedrooms).
private const val MAX_BEDROOMS = 10

// A cohesive container for one detail page's several T4 surfaces —
// letters, claims, fridge cards, the mailbox check, the rate watch, the
// rent report, and the block founders panel. The count grows one wave
// at a time; splitting it would fragment a single screen's state.
@Suppress("TooManyFunctions")
@HiltViewModel
class PlaceDetailViewModel
    @Inject
    constructor(
        private val repo: PlaceRepository,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        private val homeId: String =
            requireNotNull(savedStateHandle[PLACE_DETAIL_HOME_ID_KEY]) {
                "PlaceDetailViewModel requires a '$PLACE_DETAIL_HOME_ID_KEY' nav arg."
            }
        val group: PlaceDetailGroup =
            PlaceDetailGroup.fromSlug(savedStateHandle[PLACE_DETAIL_SLUG_KEY])
                ?: PlaceDetailGroup.TODAY

        private val _state = MutableStateFlow<PlaceDetailUiState>(PlaceDetailUiState.Loading)
        val state: StateFlow<PlaceDetailUiState> = _state.asStateFlow()

        fun load() {
            if (_state.value is PlaceDetailUiState.Loaded) return
            refresh()
        }

        fun refresh() {
            _state.value = PlaceDetailUiState.Loading
            viewModelScope.launch {
                _state.value =
                    when (val result = repo.intelligence(homeId)) {
                        is NetworkResult.Success -> PlaceDetailUiState.Loaded(result.data)
                        is NetworkResult.Failure -> PlaceDetailUiState.Error(result.error.displayMessage("Couldn't load this place."))
                    }
            }
        }

        // ── Residency letters (Identity detail, T4) ──────────────

        private val _letters = MutableStateFlow<ResidencyLetterUiState>(ResidencyLetterUiState.Loading)
        val letters: StateFlow<ResidencyLetterUiState> = _letters.asStateFlow()

        private val _isIssuing = MutableStateFlow(false)
        val isIssuing: StateFlow<Boolean> = _isIssuing.asStateFlow()

        fun loadLetters() {
            viewModelScope.launch {
                _letters.value =
                    when (val r = repo.residencyLetters(homeId)) {
                        is NetworkResult.Success -> ResidencyLetterUiState.Loaded(r.data.letters)
                        is NetworkResult.Failure -> ResidencyLetterUiState.Error(r.error.message)
                    }
            }
        }

        fun issueLetter(purpose: String) {
            if (purpose.isBlank()) return
            viewModelScope.launch {
                _isIssuing.value = true
                repo.issueResidencyLetter(homeId, purpose)
                _isIssuing.value = false
                loadLetters()
            }
        }

        fun revokeLetter(letterId: String) {
            viewModelScope.launch {
                // Revocation is a promise. A silent failure lets the
                // resident believe a live letter carrying their name and
                // street address has been withdrawn when it still
                // verifies — the same reason the claim and fridge-card
                // revokes surface theirs.
                when (val r = repo.revokeResidencyLetter(homeId, letterId)) {
                    is NetworkResult.Success -> Unit
                    is NetworkResult.Failure ->
                        _actionToast.value =
                            PlaceActionToast(r.error.displayMessage("Couldn't revoke the letter."), isError = true)
                }
                loadLetters()
            }
        }

        // ── Action feedback (claims + fridge cards) ──────────────
        // One consumable toast for issue/revoke outcomes, mirroring the
        // iOS sections' vm.toast. Android used to swallow every failure
        // (`Failure -> Unit`): a 403/422/rate-limit stopped the spinner
        // with no card, no copy, and no message — and below API 33 even
        // success was silent.

        private val _actionToast = MutableStateFlow<PlaceActionToast?>(null)
        val actionToast: StateFlow<PlaceActionToast?> = _actionToast.asStateFlow()

        fun consumeActionToast() {
            _actionToast.value = null
        }

        // ── Residency Pass — scoped live claims (Identity, T4) ───

        private val _claims = MutableStateFlow<ResidencyClaimsUiState>(ResidencyClaimsUiState.Loading)
        val claims: StateFlow<ResidencyClaimsUiState> = _claims.asStateFlow()

        private val _isIssuingClaim = MutableStateFlow(false)
        val isIssuingClaim: StateFlow<Boolean> = _isIssuingClaim.asStateFlow()

        /** The verify link the UI should copy to the clipboard, once. */
        private val _claimLinkToCopy = MutableStateFlow<String?>(null)
        val claimLinkToCopy: StateFlow<String?> = _claimLinkToCopy.asStateFlow()

        fun loadClaims() {
            viewModelScope.launch {
                _claims.value =
                    when (val r = repo.residencyClaims(homeId)) {
                        is NetworkResult.Success -> ResidencyClaimsUiState.Loaded(r.data.claims)
                        is NetworkResult.Failure -> ResidencyClaimsUiState.Error(r.error.displayMessage("Couldn't load your claims."))
                    }
            }
        }

        fun issueClaim(
            scope: String,
            expiresInDays: Int,
        ) {
            viewModelScope.launch {
                _isIssuingClaim.value = true
                when (val r = repo.issueResidencyClaim(homeId, scope, expiresInDays)) {
                    is NetworkResult.Success -> {
                        _claimLinkToCopy.value = r.data.claim.verifyUrl
                        _actionToast.value = PlaceActionToast("Claim issued — verification link copied.", isError = false)
                    }
                    is NetworkResult.Failure ->
                        _actionToast.value =
                            PlaceActionToast(r.error.displayMessage("Couldn't issue the claim."), isError = true)
                }
                _isIssuingClaim.value = false
                loadClaims()
            }
        }

        fun consumeClaimLink() {
            _claimLinkToCopy.value = null
        }

        fun revokeClaim(claimId: String) {
            viewModelScope.launch {
                when (val r = repo.revokeResidencyClaim(homeId, claimId)) {
                    is NetworkResult.Success -> Unit
                    is NetworkResult.Failure ->
                        _actionToast.value =
                            PlaceActionToast(r.error.displayMessage("Couldn't revoke the claim."), isError = true)
                }
                loadClaims()
            }
        }

        // ── Fridge cards — 911-ready household card (Risk, T4) ───

        private val _fridgeCards = MutableStateFlow<FridgeCardsUiState>(FridgeCardsUiState.Loading)
        val fridgeCards: StateFlow<FridgeCardsUiState> = _fridgeCards.asStateFlow()

        private val _isIssuingCard = MutableStateFlow(false)
        val isIssuingCard: StateFlow<Boolean> = _isIssuingCard.asStateFlow()

        /** The card link the UI should copy to the clipboard, once. */
        private val _cardLinkToCopy = MutableStateFlow<String?>(null)
        val cardLinkToCopy: StateFlow<String?> = _cardLinkToCopy.asStateFlow()

        /** Utilities pre-seed from the home's existing emergency info. */
        private val _utilitySeed = MutableStateFlow<List<FridgeCardItem>>(emptyList())
        val utilitySeed: StateFlow<List<FridgeCardItem>> = _utilitySeed.asStateFlow()

        fun loadFridgeCards() {
            viewModelScope.launch {
                _fridgeCards.value =
                    when (val r = repo.fridgeCards(homeId)) {
                        is NetworkResult.Success -> FridgeCardsUiState.Loaded(r.data.cards)
                        is NetworkResult.Failure -> FridgeCardsUiState.Error(r.error.displayMessage("Couldn't load the cards."))
                    }
                if (_utilitySeed.value.isEmpty()) {
                    when (val r = repo.homeEmergencies(homeId)) {
                        is NetworkResult.Success ->
                            _utilitySeed.value =
                                r.data.emergencies
                                    .filter { it.label.isNotBlank() }
                                    .take(MAX_SEED_ITEMS)
                                    .map { FridgeCardItem(label = it.label, note = it.location.orEmpty()) }
                        is NetworkResult.Failure -> Unit
                    }
                }
            }
        }

        fun issueFridgeCard(body: IssueFridgeCardRequest) {
            viewModelScope.launch {
                _isIssuingCard.value = true
                when (val r = repo.issueFridgeCard(homeId, body)) {
                    is NetworkResult.Success -> {
                        _cardLinkToCopy.value = r.data.card.cardUrl
                        _actionToast.value = PlaceActionToast("Card issued — link copied.", isError = false)
                    }
                    is NetworkResult.Failure ->
                        _actionToast.value =
                            PlaceActionToast(r.error.displayMessage("Couldn't issue the card."), isError = true)
                }
                _isIssuingCard.value = false
                loadFridgeCards()
            }
        }

        fun consumeCardLink() {
            _cardLinkToCopy.value = null
        }

        fun revokeFridgeCard(cardId: String) {
            viewModelScope.launch {
                when (val r = repo.revokeFridgeCard(homeId, cardId)) {
                    is NetworkResult.Success -> Unit
                    is NetworkResult.Failure ->
                        _actionToast.value =
                            PlaceActionToast(r.error.displayMessage("Couldn't revoke the card."), isError = true)
                }
                loadFridgeCards()
            }
        }

        // ── Mailbox reality check (Identity detail) ──────────────

        private val _mailboxCheck = MutableStateFlow<MailboxCheckUiState>(MailboxCheckUiState.Loading)
        val mailboxCheck: StateFlow<MailboxCheckUiState> = _mailboxCheck.asStateFlow()

        fun loadMailboxCheck() {
            viewModelScope.launch {
                _mailboxCheck.value =
                    when (val r = repo.mailboxCheck(homeId)) {
                        is NetworkResult.Success -> MailboxCheckUiState.Loaded(r.data.check)
                        is NetworkResult.Failure -> MailboxCheckUiState.Error(r.error.displayMessage("Couldn't run the mailbox check."))
                    }
            }
        }

        // ── Rate watch (Money detail, T4) ────────────────────────

        private val _rateWatch = MutableStateFlow<RateWatchUiState>(RateWatchUiState.Loading)
        val rateWatch: StateFlow<RateWatchUiState> = _rateWatch.asStateFlow()

        private val _isSavingWatch = MutableStateFlow(false)
        val isSavingWatch: StateFlow<Boolean> = _isSavingWatch.asStateFlow()

        fun loadRateWatch() {
            viewModelScope.launch {
                _rateWatch.value =
                    when (val r = repo.recordWatch(homeId)) {
                        is NetworkResult.Success ->
                            r.data.watch?.let { RateWatchUiState.Loaded(it) } ?: RateWatchUiState.None
                        is NetworkResult.Failure -> RateWatchUiState.Error(r.error.displayMessage("Couldn't load your watch."))
                    }
            }
        }

        /** Save failures stay INLINE — never collapse the form to Error. */
        private val _watchSaveError = MutableStateFlow<String?>(null)
        val watchSaveError: StateFlow<String?> = _watchSaveError.asStateFlow()

        fun setRateWatch(month: String) {
            if (month.isBlank()) return
            viewModelScope.launch {
                _isSavingWatch.value = true
                _watchSaveError.value = null
                // A save failure (typo month, out-of-range, transient 500)
                // keeps the current state — the form, with the typed month
                // still in it — and reports inline. Replacing the whole
                // section with a dead-end Error card turned a one-character
                // typo into an apparent feature outage with no way back.
                when (val r = repo.setRecordWatch(homeId, month.trim())) {
                    is NetworkResult.Success -> {
                        _rateWatch.value =
                            r.data.watch?.let { RateWatchUiState.Loaded(it) } ?: RateWatchUiState.None
                    }
                    is NetworkResult.Failure ->
                        _watchSaveError.value = r.error.displayMessage("Couldn't save the watch.")
                }
                _isSavingWatch.value = false
            }
        }

        fun removeRateWatch() {
            viewModelScope.launch {
                repo.removeRecordWatch(homeId)
                _rateWatch.value = RateWatchUiState.None
            }
        }

        // ── Real Rent Benchmark (Money detail, band D / T4) ──────
        // Two independent things: the BLOCK aggregate, which rides the
        // intelligence contract's `real_rent` section, and the viewer's
        // OWN report, which lives here.

        private val _rentReport = MutableStateFlow<RealRentUiState>(RealRentUiState.Loading)
        val rentReport: StateFlow<RealRentUiState> = _rentReport.asStateFlow()

        private val _isSavingRent = MutableStateFlow(false)
        val isSavingRent: StateFlow<Boolean> = _isSavingRent.asStateFlow()

        /** Save failures stay INLINE — never collapse the form to Error. */
        private val _rentSaveError = MutableStateFlow<String?>(null)
        val rentSaveError: StateFlow<String?> = _rentSaveError.asStateFlow()

        /**
         * A saved contribution reads back as money, not as a live text
         * field: the viewer confirms "$2,400 / mo · 2BR" and presses Edit
         * to change it. Parity: iOS `isEditing`, web's Edit button.
         */
        private val _isEditingRent = MutableStateFlow(false)
        val isEditingRent: StateFlow<Boolean> = _isEditingRent.asStateFlow()

        fun beginEditingRent() {
            _rentSaveError.value = null
            _isEditingRent.value = true
        }

        fun cancelEditingRent() {
            _rentSaveError.value = null
            _isEditingRent.value = false
        }

        fun loadRentReport() {
            viewModelScope.launch {
                // A stale save error must not outlive the composer it was
                // written for — otherwise a fresh visit opens with a
                // rejection the viewer never triggered.
                _rentSaveError.value = null
                _isEditingRent.value = false
                _rentReport.value =
                    when (val r = repo.rentReport(homeId)) {
                        is NetworkResult.Success ->
                            r.data.report?.let { RealRentUiState.Loaded(it) } ?: RealRentUiState.None
                        is NetworkResult.Failure -> RealRentUiState.Error(r.error.displayMessage("Couldn't load your rent."))
                    }
            }
        }

        /**
         * Contribute or update. A rejected save (a typo, an amount
         * outside the plausibility fence, a transient 500) keeps the
         * current state — the form, with the typed amount still in it —
         * and reports inline. Collapsing the section to a dead-end Error
         * card is the bug the rate watch shipped with; do not reintroduce
         * it here.
         *
         * [bedrooms] has NO default on purpose. It used to, and the
         * own-card's "Update" quietly took it: an omitted bedroom count
         * makes the server fall back to the Home row, which yields 0 —
         * STUDIO — whenever that row is null. A resident fixing a typo
         * would silently leave their 2-bedroom cohort, be compared
         * against a different band, and corrupt the block's same-size
         * sample for every neighbor. Every caller now has to say what
         * size the report is for.
         */
        fun setRentReport(
            monthlyRent: String,
            bedrooms: String,
        ) {
            val amount = parseMonthlyRent(monthlyRent)
            if (amount == null) {
                _rentSaveError.value = RENT_AMOUNT_MESSAGE
                return
            }
            viewModelScope.launch {
                _isSavingRent.value = true
                _rentSaveError.value = null
                when (val r = repo.setRentReport(homeId, amount, parseBedrooms(bedrooms))) {
                    is NetworkResult.Success -> {
                        _isEditingRent.value = false
                        _rentReport.value =
                            r.data.report?.let { RealRentUiState.Loaded(it) } ?: RealRentUiState.None
                        // The block band now includes this figure, so the
                        // section's own progress/standing is stale.
                        refreshIntelligenceQuietly()
                    }
                    is NetworkResult.Failure ->
                        _rentSaveError.value = rentWriteMessage(r.error, "Couldn't save your rent.")
                }
                _isSavingRent.value = false
            }
        }

        /**
         * Withdraw. The in-flight flag is set across the whole request:
         * without it "Remove my rent" stayed live for the round trip, so
         * there was no feedback at all and a double-tap fired two
         * DELETEs. Parity: iOS shows "Removing…" and disables both
         * controls; web disables on the pending mutation.
         */
        fun removeRentReport() {
            viewModelScope.launch {
                _isSavingRent.value = true
                _rentSaveError.value = null
                when (val r = repo.removeRentReport(homeId)) {
                    is NetworkResult.Success -> {
                        _isEditingRent.value = false
                        _rentReport.value = RealRentUiState.None
                        refreshIntelligenceQuietly()
                    }
                    is NetworkResult.Failure ->
                        _rentSaveError.value = rentWriteMessage(r.error, "Couldn't remove your rent.")
                }
                _isSavingRent.value = false
            }
        }

        /**
         * Re-read the section envelopes in place. Deliberately does NOT
         * flip [state] to Loading: a contribution must not blank the page
         * the user is standing on, and a failed refresh must leave the
         * last good render alone.
         */
        private suspend fun refreshIntelligenceQuietly() {
            val result = repo.intelligence(homeId)
            if (result is NetworkResult.Success) {
                _state.value = PlaceDetailUiState.Loaded(result.data)
            }
        }

        // ── Block Founders (Your block detail, T4) ───────────────

        private val _blockFounders = MutableStateFlow<BlockFoundersUiState>(BlockFoundersUiState.Loading)
        val blockFounders: StateFlow<BlockFoundersUiState> = _blockFounders.asStateFlow()

        private val _isSendingInvite = MutableStateFlow(false)
        val isSendingInvite: StateFlow<Boolean> = _isSendingInvite.asStateFlow()

        fun loadBlockFounders() {
            viewModelScope.launch {
                _blockFounders.value =
                    when (val r = repo.blockFounders(homeId)) {
                        is NetworkResult.Success -> BlockFoundersUiState.Loaded(r.data.block)
                        is NetworkResult.Failure -> BlockFoundersUiState.Error(r.error.displayMessage("Couldn't load your block."))
                    }
            }
        }

        /**
         * Mail one template postcard invite. The server surfaces
         * WEEKLY_CAP (429) and SEND_FAILED (502) with copy of its own;
         * both reach the viewer through the shared action toast, which
         * already tints failures.
         */
        fun sendBlockInvite(
            line1: String,
            city: String,
            state: String,
            zip: String,
        ) {
            val recipient =
                BlockInviteRecipient(
                    line1 = line1.trim(),
                    city = city.trim(),
                    state = state.trim().uppercase(),
                    zip = zip.trim(),
                )
            // The server validates for real; this only stops a send that
            // would certainly 400 and burn a round trip.
            if (!recipient.isComplete()) return
            viewModelScope.launch {
                _isSendingInvite.value = true
                when (val r = repo.sendBlockInvite(homeId, recipient)) {
                    is NetworkResult.Success -> {
                        val left = r.data.invitesRemaining
                        val plural = if (left == 1) "invite" else "invites"
                        _actionToast.value =
                            PlaceActionToast("Postcard on its way — $left $plural left this week.", isError = false)
                    }
                    is NetworkResult.Failure ->
                        _actionToast.value =
                            PlaceActionToast(r.error.displayMessage("Couldn't send the invitation."), isError = true)
                }
                _isSendingInvite.value = false
                loadBlockFounders()
            }
        }

        // ── Unlisted — address removal (Identity detail, T1+) ────
        // NOT gated on verification: someone who has just claimed their
        // address is exactly who needs this, and making them wait for a
        // postcard to start removing themselves would invert it.

        private val _unlisted = MutableStateFlow<UnlistedUiState>(UnlistedUiState.Loading)
        val unlisted: StateFlow<UnlistedUiState> = _unlisted.asStateFlow()

        /** The broker whose step is being written right now, if any. */
        private val _pendingRemovalBrokerId = MutableStateFlow<String?>(null)
        val pendingRemovalBrokerId: StateFlow<String?> = _pendingRemovalBrokerId.asStateFlow()

        fun loadUnlisted() {
            viewModelScope.launch {
                _unlisted.value =
                    when (val r = repo.unlisted(homeId)) {
                        is NetworkResult.Success -> UnlistedUiState.Loaded(r.data.unlisted)
                        is NetworkResult.Failure ->
                            UnlistedUiState.Error(r.error.displayMessage("Couldn't load your removal list."))
                    }
            }
        }

        /**
         * Record where the resident has got to with one broker.
         *
         * A failed write must NOT collapse the section: the state
         * program, the method note and every opt-out link stay exactly
         * where they were, and the failure is reported through the
         * shared action toast, which this section renders inline. The
         * alternative — an Error card in place of the list — takes a
         * frightened person's removal instructions away over a transient
         * 500.
         *
         * On success the confirmed row is merged in place rather than
         * refetched, EXCEPT when the progress read had failed (removals
         * null): merging into nothing would fabricate a complete
         * checklist out of one row, so we re-read and stay honest about
         * whatever comes back.
         */
        fun setUnlistedRemoval(
            brokerId: String,
            status: UnlistedRemovalStatus,
        ) {
            if (!status.isSendable || brokerId.isBlank()) return
            viewModelScope.launch {
                _pendingRemovalBrokerId.value = brokerId
                when (val r = repo.setUnlistedRemoval(homeId, brokerId, status)) {
                    is NetworkResult.Success -> {
                        val current = _unlisted.value
                        if (current is UnlistedUiState.Loaded && current.profile.removals != null) {
                            _unlisted.value = UnlistedUiState.Loaded(current.profile.withRemoval(r.data.removal))
                        } else {
                            loadUnlisted()
                        }
                        _actionToast.value = PlaceActionToast(removalSavedMessage(status), isError = false)
                    }
                    is NetworkResult.Failure ->
                        _actionToast.value =
                            PlaceActionToast(r.error.displayMessage("Couldn't save that step."), isError = true)
                }
                _pendingRemovalBrokerId.value = null
            }
        }

        companion object {
            /**
             * We track what the resident tells us they have done — we do
             * not do it for them, and the confirmation must not imply we
             * did.
             */
            internal fun removalSavedMessage(status: UnlistedRemovalStatus): String =
                when (status) {
                    UnlistedRemovalStatus.TODO -> "Marked as still to do."
                    UnlistedRemovalStatus.REQUESTED -> "Noted — you've sent the request."
                    UnlistedRemovalStatus.CONFIRMED -> "Noted — you've confirmed the removal."
                    UnlistedRemovalStatus.RELISTED -> "Noted — the site has put you back."
                    UnlistedRemovalStatus.UNKNOWN -> "Saved."
                }

            /** Whatever the viewer typed, refused in their own terms. */
            internal const val RENT_AMOUNT_MESSAGE = "Enter the amount you pay each month, like 2150."

            /**
             * The route's 403 is `VERIFICATION_REQUIRED`, and that gate
             * IS the product — a block benchmark is only worth reading
             * because the people in it proved they live there. Used only
             * when the server sent no body of its own.
             */
            internal const val VERIFICATION_REQUIRED_MESSAGE =
                "Verify your address to add your rent — a benchmark is only real if the people in it live there."

            private const val FORBIDDEN_CODE = 403

            /** Above this the figure is not a monthly rent, it is a typo. */
            private val MAX_RENT_DOLLARS = BigDecimal.valueOf(Int.MAX_VALUE.toLong())

            /**
             * "$2,400", "2,400", "2400" and "2400.50" all name the same
             * monthly figure — and "495.75" names $496, never $49,575.
             *
             * Digit-filtering used to DELETE the decimal point, so
             * "495.75" was sent as 49575: a figure that clears the
             * server's $50–$50,000 fence, saves silently, and skews every
             * quartile the block reads — while the field on screen still
             * said 495.75. Grouping separators and currency symbols go;
             * the decimal separator stays and is honoured, and anything
             * that is not a number at all is refused out loud.
             */
            internal fun parseMonthlyRent(raw: String): Int? {
                val cleaned = raw.filter { it.isDigit() || it == '.' }
                if (cleaned.none { it.isDigit() }) return null
                // "1.2.3" and "" are not numbers — refuse them out loud
                // rather than sending some other figure than the one on
                // screen.
                val value = cleaned.toBigDecimalOrNull() ?: return null
                val dollars = value.setScale(0, RoundingMode.HALF_UP)
                val plausible = dollars > BigDecimal.ZERO && dollars <= MAX_RENT_DOLLARS
                return if (plausible) dollars.toInt() else null
            }

            /**
             * Blank means "use the home's own bedroom count" — the
             * server's documented fallback — so an empty field is
             * omitted, never sent as zero, which would mean STUDIO.
             */
            internal fun parseBedrooms(raw: String): Int? {
                val trimmed = raw.trim()
                if (trimmed.isEmpty()) return null
                // Parsed as a WHOLE number, never digit-filtered. Stripping
                // non-digits turned "2.5" into 25, which the server clamps
                // to 10 — a resident's rent silently joined the 10-bedroom
                // cohort. A bedroom count that is not a plain integer is
                // refused (null = omit) rather than reinterpreted.
                val n = trimmed.toIntOrNull() ?: return null
                return if (n in 0..MAX_BEDROOMS) n else null
            }

            /**
             * A write failure in the resident's own terms. 403 carries
             * the route's actual sentence on this surface (the repo opts
             * into keeping the body), so it reaches the viewer the way a
             * 400 already does instead of the shared client's canned
             * "You don't have permission to do that."
             */
            internal fun rentWriteMessage(
                error: NetworkError,
                fallback: String,
            ): String =
                when {
                    error is NetworkError.Forbidden -> VERIFICATION_REQUIRED_MESSAGE
                    error.code == FORBIDDEN_CODE -> error.displayMessage(VERIFICATION_REQUIRED_MESSAGE)
                    else -> error.displayMessage(fallback)
                }
        }
    }

/** One consumable outcome message for the claim/card composers. */
data class PlaceActionToast(val message: String, val isError: Boolean)

/** Every field the Block Founders route requires, non-blank. */
// The server refuses a malformed ZIP with BAD_ADDRESS; enabling Mail on
// one just spends a round-trip to tell the sender what the field could
// have. Mirrors the iOS check and the server's own regex.
private val ZIP_RE = Regex("""\d{5}(-\d{4})?""")

fun BlockInviteRecipient.isComplete(): Boolean =
    line1.isNotBlank() &&
        city.isNotBlank() &&
        state.length == STATE_CODE_LENGTH &&
        ZIP_RE.matches(zip.trim())

sealed interface ResidencyClaimsUiState {
    data object Loading : ResidencyClaimsUiState

    data class Loaded(val claims: List<app.pantopus.android.data.api.models.place.ResidencyClaim>) : ResidencyClaimsUiState

    data class Error(val message: String) : ResidencyClaimsUiState
}

sealed interface FridgeCardsUiState {
    data object Loading : FridgeCardsUiState

    data class Loaded(val cards: List<app.pantopus.android.data.api.models.place.FridgeCard>) : FridgeCardsUiState

    data class Error(val message: String) : FridgeCardsUiState
}

sealed interface MailboxCheckUiState {
    data object Loading : MailboxCheckUiState

    data class Loaded(val check: app.pantopus.android.data.api.models.place.MailboxCheck) : MailboxCheckUiState

    data class Error(val message: String) : MailboxCheckUiState
}

sealed interface RateWatchUiState {
    data object Loading : RateWatchUiState

    data object None : RateWatchUiState

    data class Loaded(val watch: app.pantopus.android.data.api.models.place.RecordWatch) : RateWatchUiState

    data class Error(val message: String) : RateWatchUiState
}

/**
 * The viewer's OWN rent report (Real Rent, Wave 3). [None] is the
 * honest "you haven't contributed yet" case — the composer — and is
 * never an error.
 */
sealed interface RealRentUiState {
    data object Loading : RealRentUiState

    data object None : RealRentUiState

    data class Loaded(val report: app.pantopus.android.data.api.models.place.RentReport) : RealRentUiState

    data class Error(val message: String) : RealRentUiState
}

sealed interface BlockFoundersUiState {
    data object Loading : BlockFoundersUiState

    data class Loaded(val block: app.pantopus.android.data.api.models.place.BlockStatus) : BlockFoundersUiState

    data class Error(val message: String) : BlockFoundersUiState
}

sealed interface ResidencyLetterUiState {
    data object Loading : ResidencyLetterUiState

    data class Loaded(val letters: List<app.pantopus.android.data.api.models.place.ResidencyLetter>) : ResidencyLetterUiState

    data class Error(val message: String) : ResidencyLetterUiState
}

/**
 * Unlisted (Wave 4). There is no `None` case on purpose: the profile is
 * the law and a verified registry, so it is never empty for a US state
 * — and an unverified state arrives as a null `stateProgram` INSIDE a
 * loaded profile, which the UI renders as "we could not confirm",
 * never as "your state has none".
 */
sealed interface UnlistedUiState {
    data object Loading : UnlistedUiState

    data class Loaded(val profile: UnlistedProfile) : UnlistedUiState

    data class Error(val message: String) : UnlistedUiState
}

sealed interface PlaceDetailUiState {
    data object Loading : PlaceDetailUiState

    data class Loaded(val intelligence: PlaceIntelligence) : PlaceDetailUiState

    data class Error(val message: String) : PlaceDetailUiState
}

/** Sections that belong to this detail page, in contract order. */
fun PlaceIntelligence.sectionsFor(group: PlaceDetailGroup): List<PlaceSectionEnvelope> {
    val groups = group.groups.toSet()
    return groups.let { gs -> this.groups.filter { it.groupId in gs }.flatMap { it.sections } }
}

/** Find a single section across the payload. */
fun PlaceIntelligence.section(id: PlaceSectionId): PlaceSectionEnvelope? = groups.flatMap { it.sections }.firstOrNull { it.sectionId == id }
