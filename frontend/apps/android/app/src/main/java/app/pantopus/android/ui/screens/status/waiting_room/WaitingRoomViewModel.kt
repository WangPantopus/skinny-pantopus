@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.status.waiting_room

import android.util.Log
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.homes.OwnershipClaimDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomeAdminRepository
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.ui.screens.status.StatusCta
import app.pantopus.android.ui.screens.status.StatusWaitingContent
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
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
        private val homeAdminRepo: HomeAdminRepository,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        val homeId: String =
            requireNotNull(savedStateHandle[WAITING_ROOM_HOME_ID_KEY]) {
                "WaitingRoomViewModel requires a '$WAITING_ROOM_HOME_ID_KEY' nav arg."
            }

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

        fun consumeNavEvent() {
            _navEvent.value = null
        }

        fun refresh() {
            viewModelScope.launch {
                when (val result = homesRepo.myOwnershipClaims()) {
                    is NetworkResult.Success -> applyClaims(result.data.claims.firstOrNull { it.homeId == homeId })
                    is NetworkResult.Failure -> {
                        Log.w(TAG, "waitingRoom.load failed: ${result.error.message}")
                        _phase.value = WaitingRoomPhase.Notice(WaitingRoomNotice.LoadFailed)
                    }
                }
            }
        }

        private suspend fun applyClaims(claim: OwnershipClaimDto?) {
            if (claim == null) {
                claimId = null
                applyVerificationFallback()
                return
            }
            claimId = claim.id
            if (claim.status != UNDER_REVIEW_STATUS) {
                if (claim.status in APPROVED_STATUSES) {
                    // A18.2 "You're the owner". Dates come straight off the
                    // claim row — never the design's sample dates.
                    _phase.value =
                        WaitingRoomPhase.Approved(
                            StatusWaitingContent.claimSubmitted(
                                homeName = resolvedAddress(),
                                approved = true,
                                submittedOn = dayCaption(claim.createdAt),
                                decidedOn = dayCaption(claim.updatedAt),
                            ),
                        )
                    return
                }
                _phase.value = WaitingRoomPhase.Notice(WaitingRoomNotice.ClaimDecided)
                return
            }
            val ref = claim.id.take(CLAIM_REF_LENGTH).uppercase()
            val address = resolvedAddress()
            _content.value =
                if (seedState == WaitingRoomState.MoreInfoRequested) {
                    WaitingRoomContent.moreInfoRequested(address = address, claimRef = ref)
                } else {
                    WaitingRoomContent.active(address = address, claimRef = ref)
                }
            _phase.value = WaitingRoomPhase.Loaded
        }

        /**
         * No claim row for this home. RN serves the Verification Center
         * on this same route, branching on `verification_status` from
         * `GET /api/homes/:id/me`
         * (`src/app/homes/[id]/waiting-room.tsx:26-70`). Only when the
         * caller *is* verified (or the call fails) do we fall back to the
         * "No claim in review" notice.
         */
        private suspend fun applyVerificationFallback() {
            val access =
                when (val result = homeAdminRepo.myVerificationAccess(homeId)) {
                    is NetworkResult.Success -> result.data
                    is NetworkResult.Failure -> null
                }
            if (access == null || !access.hasAccess || !access.needsVerification) {
                _phase.value = WaitingRoomPhase.Notice(WaitingRoomNotice.NoClaim)
                return
            }
            _phase.value =
                WaitingRoomPhase.Verification(
                    HomeVerificationContent.make(
                        status = HomeVerificationStatus.from(access.verificationStatus),
                        isInChallengeWindow = access.isInChallengeWindow,
                        challengeWindowEndsAt = access.challengeWindowEndsAt,
                        postcardExpiresAt = access.postcardExpiresAt,
                    ),
                )
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

        /**
         * Best-effort street address for this home. Falls back to the generic
         * "Your home" label rather than inventing an address.
         */
        private suspend fun resolvedAddress(): String =
            when (val addressResult = homesRepo.detail(homeId)) {
                is NetworkResult.Success ->
                    listOfNotNull(
                        addressResult.data.home.address,
                        addressResult.data.home.city,
                        addressResult.data.home.state,
                    ).joinToString(" · ").ifBlank { "Your home" }
                is NetworkResult.Failure -> "Your home"
            }

        fun openNotifications() {
            _navEvent.value = WaitingRoomNav.Notifications
        }

        fun handleInlineAction(action: WaitingRoomInlineAction) {
            when (action.actionKey) {
                "update_evidence" -> claimId?.let { _navEvent.value = WaitingRoomNav.UpdateEvidence(homeId, it) }
                "cancel_claim" -> _navEvent.value = WaitingRoomNav.CancelClaim(homeId)
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
