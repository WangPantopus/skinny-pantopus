@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.status.waiting_room

import android.util.Log
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.homes.OwnershipClaimDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.data.tenant.TenantRepository
import app.pantopus.android.ui.screens.homes.HomeDashboardAccessFactory
import app.pantopus.android.ui.screens.homes.currentVerificationKind
import app.pantopus.android.ui.screens.homes.sharedAccess
import app.pantopus.android.ui.screens.status.StatusCta
import app.pantopus.android.ui.screens.status.StatusWaitingContent
import app.pantopus.android.ui.theme.PantopusIcon
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import javax.inject.Inject

/** Nav key carrying the home id into the A18.4 waiting room. */
const val WAITING_ROOM_HOME_ID_KEY = "homeId"

/** Navigation intents surfaced to the host. */
sealed interface WaitingRoomNav {
    data object Notifications : WaitingRoomNav

    data class BackToHome(val homeId: String) : WaitingRoomNav

    /** "Back to My homes": the claim gives no way into this Home yet. */
    data class MyHomes(val homeId: String) : WaitingRoomNav

    data class ViewClaim(val claimId: String) : WaitingRoomNav

    data class UpdateEvidence(val homeId: String, val claimId: String) : WaitingRoomNav

    data class CancelClaim(val homeId: String) : WaitingRoomNav

    // ─── Verification Center intents ───────────────────────────────

    /**
     * A12.7 postcard screen — "Enter verification code" / "Verify with a
     * mailed code".
     */
    data class VerifyPostcard(val homeId: String) : WaitingRoomNav

    /** Residency-evidence wizard — "Upload proof". */
    data class UploadProof(val homeId: String) : WaitingRoomNav

    /** A12 landlord-verification wizard. */
    data class LandlordVerification(val homeId: String) : WaitingRoomNav

    /**
     * "This isn't my home" — the existing Leave home confirm, which owns
     * `POST /api/homes/:id/move-out`.
     */
    data class LeaveHome(val homeId: String) : WaitingRoomNav

    /** "Request help" — Help Center. */
    data object RequestHelp : WaitingRoomNav
}

/**
 * Backs the A18.4 persistent waiting room. Loads the caller's pending
 * ownership claim for [homeId] from `GET /api/homes/my-ownership-claims`
 * and projects it into [WaitingRoomContent]. Actions delegate to the host
 * via [navEvent].
 */
@HiltViewModel
class WaitingRoomViewModel
    @Inject
    constructor(
        private val homesRepo: HomesRepository,
        accessFactory: HomeDashboardAccessFactory,
        savedStateHandle: SavedStateHandle,
        private val tenantRepo: TenantRepository,
    ) : ViewModel() {
        val homeId: String =
            requireNotNull(savedStateHandle[WAITING_ROOM_HOME_ID_KEY]) {
                "WaitingRoomViewModel requires a '$WAITING_ROOM_HOME_ID_KEY' nav arg."
            }

        private val authority = accessFactory.create(homeId, viewModelScope)

        private val stateKey = savedStateHandle.get<String>(WAITING_ROOM_STATE_KEY)
        private val seedState =
            when (stateKey) {
                "more-info", "more_info", "paused" -> WaitingRoomState.MoreInfoRequested
                else -> WaitingRoomState.Active
            }

        private val _content = MutableStateFlow(seedState.content())
        val content: StateFlow<WaitingRoomContent> = _content.asStateFlow()

        private val _phase = MutableStateFlow<WaitingRoomPhase>(WaitingRoomPhase.Loading)
        val phase: StateFlow<WaitingRoomPhase> = _phase.asStateFlow()

        private val _navEvent = MutableStateFlow<WaitingRoomNav?>(null)
        val navEvent: StateFlow<WaitingRoomNav?> = _navEvent.asStateFlow()

        private var claimId: String? = null

        /** The claim is a renter's residency document (`claim_type` "resident"). */
        private var claimIsResidency = false

        /** The approval checklist action in flight (its button reads "Opening…"). */
        private val _approvalBusyKey = MutableStateFlow<String?>(null)
        val approvalBusyKey: StateFlow<String?> = _approvalBusyKey.asStateFlow()

        /** Why the last identity check action couldn't go ahead, shown on the checklist. */
        private val _approvalNotice = MutableStateFlow<String?>(null)
        val approvalNotice: StateFlow<String?> = _approvalNotice.asStateFlow()

        /** Stripe's identity check page for the screen to open in a Custom Tab. */
        private val _openUrl = MutableStateFlow<String?>(null)
        val openUrl: StateFlow<String?> = _openUrl.asStateFlow()

        /** Stripe's page was opened; coming back reads the check from Stripe. */
        private var identityCheckOpened = false
        private var identityPoll: Job? = null

        fun consumeNavEvent() {
            _navEvent.value = null
        }

        fun refresh() {
            viewModelScope.launch { load() }
        }

        private suspend fun load() {
            when (val result = homesRepo.myOwnershipClaims()) {
                is NetworkResult.Success -> applyClaims(result.data.claims.firstOrNull { it.homeId == homeId })
                is NetworkResult.Failure -> {
                    Log.w(TAG, "waitingRoom.load failed: ${result.error.message}")
                    _phase.value = WaitingRoomPhase.Notice(WaitingRoomNotice.LoadFailed)
                }
            }
        }

        /** Every resume reloads the room; coming back from Stripe's page also reads the check from Stripe. */
        fun onResumed() {
            val claim = claimId
            if (identityCheckOpened && claim != null) {
                identityCheckOpened = false
                checkIdentity(claim)
            } else {
                refresh()
            }
        }

        /** A checklist button: confirm identity (Stripe's page) or upload a document. */
        fun handleApprovalAction(key: String) {
            when (key) {
                WaitingRoomApproval.UPLOAD_DOCUMENT ->
                    handleInlineAction(
                        WaitingRoomInlineAction(
                            id = "updateEvidence",
                            label = "",
                            icon = PantopusIcon.FilePlus2,
                            tone = WaitingRoomActionTone.Primary,
                            actionKey = "update_evidence",
                        ),
                    )
                WaitingRoomApproval.CONFIRM_IDENTITY -> confirmIdentity()
                else -> log("approval.$key")
            }
        }

        fun consumeOpenUrl() {
            _openUrl.value = null
        }

        /** Starts (or continues) the Stripe Identity check approval needs and hands its page to the screen. */
        private fun confirmIdentity() {
            val claim = claimId ?: return
            if (_approvalBusyKey.value != null) return
            _approvalBusyKey.value = WaitingRoomApproval.CONFIRM_IDENTITY
            _approvalNotice.value = null
            viewModelScope.launch {
                when (val result = homesRepo.startClaimIdentityCheck(homeId, claim)) {
                    is NetworkResult.Success -> {
                        val url = result.data.verificationUrl
                        if (url != null && url.startsWith("https://")) {
                            identityCheckOpened = true
                            _openUrl.value = url
                        } else {
                            checkIdentity(claim)
                        }
                    }
                    is NetworkResult.Failure -> _approvalNotice.value = identityFailureMessage(result.error)
                }
                _approvalBusyKey.value = null
            }
        }

        /** Reads the check from Stripe; while Stripe is still checking, looks again a few times. */
        private fun checkIdentity(claim: String) {
            identityPoll?.cancel()
            identityPoll =
                viewModelScope.launch {
                    repeat(IDENTITY_POLL_ROUNDS) { round ->
                        if (round > 0) delay(IDENTITY_POLL_MS)
                        val checked = homesRepo.claimIdentityCheck(homeId, claim)
                        load()
                        val processing = (checked as? NetworkResult.Success)?.data?.approval?.identity == "processing"
                        if (!processing || claimId != claim) return@launch
                    }
                }
        }

        private suspend fun applyClaims(claim: OwnershipClaimDto?) {
            if (claim == null) {
                claimId = null
                claimIsResidency = false
                applyVerificationFallback()
                return
            }
            claimId = claim.id
            claimIsResidency = claim.claimType == "resident"
            if (claim.status != UNDER_REVIEW_STATUS) {
                if (claim.status in APPROVED_STATUSES) {
                    // A18.2 "You're the owner" (a verified resident for a
                    // residency document). Dates come straight off the
                    // claim row — never the design's sample dates.
                    _phase.value =
                        WaitingRoomPhase.Approved(
                            StatusWaitingContent.claimSubmitted(
                                homeName = homeContext(claim.home).address,
                                approved = true,
                                submittedOn = dayCaption(claim.createdAt),
                                decidedOn = dayCaption(claim.updatedAt),
                                residency = claimIsResidency,
                            ),
                        )
                    return
                }
                _phase.value =
                    WaitingRoomPhase.Notice(
                        if (claimIsResidency) WaitingRoomNotice.ResidencyClaimDecided else WaitingRoomNotice.ClaimDecided,
                    )
                return
            }
            val ref = claim.id.take(CLAIM_REF_LENGTH).uppercase()
            val home = homeContext(claim.home)
            val canOpenHome = opensHomeScreen()
            _content.value =
                if (seedState == WaitingRoomState.MoreInfoRequested) {
                    WaitingRoomContent.moreInfoRequested(
                        address = home.address,
                        claimRef = ref,
                        submittedOn = dayCaption(claim.createdAt),
                        canOpenHome = canOpenHome,
                    )
                } else {
                    WaitingRoomContent.active(
                        address = home.address,
                        claimRef = ref,
                        submittedOn = dayCaption(claim.createdAt),
                        reviewCaption = null,
                        needsDocuments = claim.approval?.let { it.proof == "missing" } ?: (claim.hasEvidence == false),
                        addressVerified = home.addressVerified,
                        residency = claimIsResidency,
                        approval = claim.approval,
                        canOpenHome = canOpenHome,
                    )
                }
            _phase.value = WaitingRoomPhase.Loaded
        }

        /**
         * Whether the Home's own screen has something for this person: shared access, or their own
         * verification step there (the server's answer for that screen). A claim on a Home someone
         * else added gives neither until it's approved. An unreadable answer keeps "Back to home".
         */
        private suspend fun opensHomeScreen(): Boolean {
            val access =
                try {
                    authority.read()
                } catch (cancelled: CancellationException) {
                    throw cancelled
                } catch (_: Exception) {
                    return true
                }
            return access.sharedAccess() != null || access.currentVerificationKind() != null
        }

        /** Pending residents have denied Home access with a safe verification context. */
        private suspend fun applyVerificationFallback() {
            val access =
                try {
                    authority.read()
                } catch (cancelled: CancellationException) {
                    throw cancelled
                } catch (_: Exception) {
                    _phase.value = WaitingRoomPhase.Notice(WaitingRoomNotice.LoadFailed)
                    return
                }
            if (access.currentVerificationKind() == null) {
                _phase.value = WaitingRoomPhase.Notice(WaitingRoomNotice.NoClaim)
                return
            }
            val offersLandlord = offersLandlordConfirmation()
            _phase.value =
                WaitingRoomPhase.Verification(
                    HomeVerificationContent.make(
                        status = HomeVerificationStatus.from(access.verificationStatus),
                        offersLandlord = offersLandlord,
                    ),
                )
        }

        /**
         * The landlord card helps only when a verified landlord can answer, or
         * the person already has a request there. An unreadable status hides it.
         */
        private suspend fun offersLandlordConfirmation(): Boolean {
            val status = (tenantRepo.homeStatus(homeId) as? NetworkResult.Success)?.data ?: return false
            return status.matches(homeId) && status.offersLandlordConfirmation
        }

        /**
         * Route one Verification Center action card. Keys are declared on
         * [HomeVerificationContent.ActionKey].
         */
        fun handleVerificationAction(action: HomeVerificationAction) {
            _navEvent.value =
                when (action.actionKey) {
                    HomeVerificationContent.ActionKey.ENTER_CODE,
                    HomeVerificationContent.ActionKey.REQUEST_MAILED_CODE,
                    -> WaitingRoomNav.VerifyPostcard(homeId)
                    HomeVerificationContent.ActionKey.UPLOAD_PROOF ->
                        WaitingRoomNav.UploadProof(homeId)
                    HomeVerificationContent.ActionKey.LANDLORD_VERIFICATION ->
                        WaitingRoomNav.LandlordVerification(homeId)
                    HomeVerificationContent.ActionKey.MOVE_OUT ->
                        WaitingRoomNav.LeaveHome(homeId)
                    HomeVerificationContent.ActionKey.REQUEST_HELP ->
                        WaitingRoomNav.RequestHelp
                    else -> {
                        log("verification.${action.actionKey}")
                        null
                    }
                }
        }

        /** The Home's street line, and whether the person has verified their address there. */
        private data class HomeContext(val address: String, val addressVerified: Boolean)

        /**
         * A pending claimant can't read the Home yet, so their own claim's address
         * comes next; the generic "Your home" label is the last resort.
         */
        private suspend fun homeContext(claimed: OwnershipClaimDto.ClaimedHome? = null): HomeContext =
            when (val detail = homesRepo.detail(homeId)) {
                is NetworkResult.Success ->
                    HomeContext(
                        address =
                            listOfNotNull(detail.data.home.address, detail.data.home.city, detail.data.home.state)
                                .joinToString(" · ")
                                .ifBlank { "Your home" },
                        // Household-verified members (an invitation) can still verify the address by mail.
                        addressVerified =
                            detail.data.home.residencyStatus == "verified" &&
                                detail.data.home.residencySource != "household" &&
                                detail.data.home.residencySource != "claim",
                    )
                is NetworkResult.Failure ->
                    HomeContext(
                        address =
                            listOfNotNull(claimed?.address, claimed?.city, claimed?.state)
                                .joinToString(" · ")
                                .ifBlank { "Your home" },
                        addressVerified = false,
                    )
            }

        fun openNotifications() {
            _navEvent.value = WaitingRoomNav.Notifications
        }

        fun handleInlineAction(action: WaitingRoomInlineAction) {
            when (action.actionKey) {
                // A residency document is updated in the residency document flow, never the ownership one.
                "update_evidence" ->
                    if (claimIsResidency) {
                        _navEvent.value = WaitingRoomNav.UploadProof(homeId)
                    } else {
                        claimId?.let { _navEvent.value = WaitingRoomNav.UpdateEvidence(homeId, it) }
                    }
                "cancel_claim" -> _navEvent.value = WaitingRoomNav.CancelClaim(homeId)
                "verify_postcard" -> _navEvent.value = WaitingRoomNav.VerifyPostcard(homeId)
                else -> log("inline.${action.actionKey}")
            }
        }

        fun handlePrimary(cta: StatusCta) {
            when (cta.actionKey) {
                "view_claim" -> claimId?.let { _navEvent.value = WaitingRoomNav.ViewClaim(it) }
                // A18.2 approved frame's primary CTA ("Open your home").
                "open_home" -> _navEvent.value = WaitingRoomNav.BackToHome(homeId)
                else -> log("dock.${cta.actionKey}")
            }
        }

        fun handleSecondary(cta: StatusCta) {
            when (cta.actionKey) {
                "back_to_home" -> _navEvent.value = WaitingRoomNav.BackToHome(homeId)
                "my_homes" -> _navEvent.value = WaitingRoomNav.MyHomes(homeId)
                // A18.2 approved frame's ghost CTA ("View claim").
                "view_claim" -> claimId?.let { _navEvent.value = WaitingRoomNav.ViewClaim(it) }
                else -> log("dock.${cta.actionKey}")
            }
        }

        private fun log(action: String) {
            Log.i(TAG, "waitingRoom.action home=$homeId action=$action")
        }

        companion object {
            private const val TAG = "WaitingRoom"

            private const val IDENTITY_POLL_ROUNDS = 7
            private const val IDENTITY_POLL_MS = 10_000L

            /** The server's own words for a refused identity check (it never names another person). */
            fun identityFailureMessage(error: NetworkError): String =
                when (error) {
                    is NetworkError.ClientError -> error.message
                    is NetworkError.Server ->
                        runCatching { JSONObject(error.body.orEmpty()).optString("error") }
                            .getOrNull()
                            ?.takeIf { it.isNotBlank() }
                    else -> null
                } ?: "Your identity check couldn\u2019t start. Please try again."

            /** Claim reference shown in the waiting room = first 8 chars of the claim id. */
            private const val CLAIM_REF_LENGTH = 8

            /**
             * The only masked status `GET /api/homes/my-ownership-claims`
             * returns while a claim is still in flight — every other value it
             * can return (`approved` / `rejected` / `revoked`) is terminal.
             */
            private const val UNDER_REVIEW_STATUS = "under_review"

            /**
             * Terminal statuses that mean the claimant won. `maskClaimState`
             * (`backend/routes/homeOwnership.js:2107`) emits `approved`; the
             * extra synonyms mirror `MyClaimsListViewModel.statusText`.
             */
            private val APPROVED_STATUSES = setOf("approved", "verified", "complete")

            /** "Oct 14"-style caption for a backend ISO-8601 timestamp. */
            private val DAY_CAPTION: DateTimeFormatter =
                DateTimeFormatter.ofPattern("MMM d").withZone(ZoneId.systemDefault())

            /**
             * Returns null when the string doesn't parse so the caller omits
             * the caption instead of printing a placeholder.
             */
            fun dayCaption(iso: String): String? = runCatching { DAY_CAPTION.format(Instant.parse(iso)) }.getOrNull()

            /** Optional query param selecting the more-info frame. */
            const val WAITING_ROOM_STATE_KEY = "state"
        }
    }
