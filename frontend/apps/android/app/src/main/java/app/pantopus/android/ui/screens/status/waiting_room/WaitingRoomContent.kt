@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.status.waiting_room

import androidx.compose.runtime.Immutable
import app.pantopus.android.ui.components.HaloCircleTone
import app.pantopus.android.ui.screens.status.StatusCta
import app.pantopus.android.ui.screens.status.StatusHalo
import app.pantopus.android.ui.screens.status.StatusPillTone
import app.pantopus.android.ui.screens.status.StatusStepState
import app.pantopus.android.ui.screens.status.StatusTimelineStage
import app.pantopus.android.ui.screens.status.StatusWaitingContent
import app.pantopus.android.ui.screens.status.StatusWaitingPill
import app.pantopus.android.ui.theme.PantopusIcon

/**
 * A18.4 — the persistent "waiting for approval" room. Mirrors iOS
 * `WaitingRoomContent`. Unlike the one-shot A18.2 `claimSubmitted` screen
 * this surface is re-entrant: reachable from the home card any time a claim
 * is under review (`pantopus://homes/:id/waiting-room`). It reuses the
 * A18.2/A18.3 [StatusHalo] / [StatusTimelineStage] / [StatusWaitingPill] /
 * [StatusCta] primitives but adds room-only chrome — a back + bell top bar,
 * an info-toned pulsing halo (review isn't done, so not success green), a
 * monospace claim-ref address row, a 2-column "Manage this claim" action
 * grid, and a distinct "more info requested · review paused" secondary state.
 */

/** Warning-toned reviewer note shown only in the "more info requested" state. */
@Immutable
data class WaitingRoomReviewerNote(
    val eyebrow: String,
    val body: String,
)

/** Visual weight of an inline "Manage this claim" action button. */
enum class WaitingRoomActionTone { Standard, Primary, Danger }

/** One button in the 2-column "Manage this claim" grid. */
@Immutable
data class WaitingRoomInlineAction(
    val id: String,
    val label: String,
    val icon: PantopusIcon,
    val tone: WaitingRoomActionTone,
    val actionKey: String,
)

/**
 * Non-content frame the room falls back to when there is nothing real to
 * show: the claims fetch failed, no claim exists for this home, or the claim
 * is no longer in review. Mirrors iOS `WaitingRoomNotice`.
 *
 * @param isRetry `true` → the CTA retries the fetch; `false` → it leaves the room.
 */
@Immutable
data class WaitingRoomNotice(
    val headline: String,
    val body: String,
    val ctaLabel: String,
    val isRetry: Boolean,
) {
    companion object {
        /**
         * `GET /api/homes/my-ownership-claims` failed — never fall back to
         * the seeded fixture, which would read as real claim data.
         */
        val LoadFailed =
            WaitingRoomNotice(
                headline = "Couldn't load your claim",
                body = "We couldn't reach Pantopus. Check your connection and try again.",
                ctaLabel = "Try again",
                isRetry = true,
            )

        /** No claim row for this home — the manage actions would be no-ops. */
        val NoClaim =
            WaitingRoomNotice(
                headline = "No claim in review",
                body = "We couldn't find an ownership claim for this home.",
                ctaLabel = "Back to home",
                isRetry = false,
            )

        /**
         * The claim exists but the backend already returned a terminal status
         * (`approved` / `rejected` / `revoked`).
         */
        val ClaimDecided =
            WaitingRoomNotice(
                headline = "This claim isn't in review",
                body = "Your ownership claim has been decided. Check My Claims for the outcome.",
                ctaLabel = "Back to home",
                isRetry = false,
            )
    }
}

/** Which frame the room is currently rendering. Mirrors iOS `WaitingRoomPhase`. */
@Immutable
sealed interface WaitingRoomPhase {
    data object Loading : WaitingRoomPhase

    data object Loaded : WaitingRoomPhase

    data class Notice(val notice: WaitingRoomNotice) : WaitingRoomPhase

    /**
     * No ownership claim is in review but the caller's occupancy still
     * isn't verified — render RN's Verification Center frame instead of
     * the dead-end "No claim in review" notice
     * (`src/app/homes/[id]/waiting-room.tsx:67-70`).
     */
    data class Verification(val content: HomeVerificationContent) : WaitingRoomPhase

    /**
     * The claim resolved in the claimant's favour — render the A18.2
     * "You're the owner" frame instead of a dead-end notice. The payload is
     * built from the real claim row, so every date it prints is API-sourced.
     */
    data class Approved(val content: StatusWaitingContent) : WaitingRoomPhase
}

/** Snapshot the `WaitingRoomScreen` renders. */
@Immutable
data class WaitingRoomContent(
    val title: String,
    val halo: StatusHalo,
    val headline: String,
    val subcopy: String,
    val address: String,
    val claimRef: String,
    val reviewerNote: WaitingRoomReviewerNote? = null,
    val timeline: List<StatusTimelineStage>,
    val timelinePaused: Boolean = false,
    val etaPill: StatusWaitingPill,
    val manageSectionTitle: String,
    val inlineActions: List<WaitingRoomInlineAction>,
    val primaryCta: StatusCta,
    val secondaryCta: StatusCta,
) {
    companion object {
        const val ROOM_TITLE = "Waiting for approval"
        const val SAMPLE_ADDRESS = "418 Linden Ave · Apt 3B"
        const val SAMPLE_CLAIM_REF = "CLM-4F2A"
        const val MANAGE_TITLE = "Manage this claim"

        private val viewClaim =
            StatusCta(label = "View claim", actionKey = "view_claim", icon = PantopusIcon.FileText)
        private val backToHome = StatusCta(label = "Back to home", actionKey = "back_to_home")

        private fun cancelClaimAction() =
            WaitingRoomInlineAction(
                id = "cancelClaim",
                label = "Cancel claim",
                icon = PantopusIcon.XCircle,
                tone = WaitingRoomActionTone.Danger,
                actionKey = "cancel_claim",
            )

        /**
         * Active wait — `Under review`, info-toned pulsing halo, the Submitted
         * → Under review → Approved timeline with "Under review" current, and
         * the "within 24–48 hours" ETA pill.
         */
        fun active(
            address: String = SAMPLE_ADDRESS,
            claimRef: String = SAMPLE_CLAIM_REF,
        ): WaitingRoomContent =
            WaitingRoomContent(
                title = ROOM_TITLE,
                halo = StatusHalo(tone = HaloCircleTone.Info, icon = PantopusIcon.Hourglass, isPulsing = true),
                headline = "Under review",
                subcopy =
                    "Pantopus is checking your documents against county records. " +
                        "You'll get a push the moment we decide.",
                address = address,
                claimRef = claimRef,
                reviewerNote = null,
                timeline =
                    listOf(
                        StatusTimelineStage("submitted", "Submitted", "Oct 24", StatusStepState.Done),
                        StatusTimelineStage("review", "Under review", "Started 9h ago", StatusStepState.Current),
                        StatusTimelineStage("approved", "Approved", state = StatusStepState.Pending),
                    ),
                timelinePaused = false,
                etaPill =
                    StatusWaitingPill(
                        text = "Decision usually within 24–48 hours",
                        icon = PantopusIcon.CalendarClock,
                        tone = StatusPillTone.Primary,
                    ),
                manageSectionTitle = MANAGE_TITLE,
                inlineActions =
                    listOf(
                        WaitingRoomInlineAction(
                            id = "updateEvidence",
                            label = "Update evidence",
                            icon = PantopusIcon.FilePlus2,
                            tone = WaitingRoomActionTone.Standard,
                            actionKey = "update_evidence",
                        ),
                        cancelClaimAction(),
                    ),
                primaryCta = viewClaim,
                secondaryCta = backToHome,
            )

        /**
         * More info requested · review paused — `We need one more thing`,
         * static warning halo, a reviewer-note card, the timeline paused on
         * "Under review" (current node shows `alert-circle`), the "Paused ·
         * respond within 7 days" ETA pill, and "Update evidence" promoted to
         * primary.
         */
        fun moreInfoRequested(
            address: String = SAMPLE_ADDRESS,
            claimRef: String = SAMPLE_CLAIM_REF,
        ): WaitingRoomContent =
            WaitingRoomContent(
                title = ROOM_TITLE,
                halo = StatusHalo(tone = HaloCircleTone.Warning, icon = PantopusIcon.FileWarning),
                headline = "We need one more thing",
                subcopy =
                    "Your utility bill is older than 90 days. " +
                        "Upload one from the last 60 days to continue the review.",
                address = address,
                claimRef = claimRef,
                reviewerNote =
                    WaitingRoomReviewerNote(
                        eyebrow = "Note from reviewer · Maya K.",
                        body =
                            "“The PG&E bill you uploaded is dated July 14. Please upload one from " +
                                "August or later — anything within the last 60 days works.”",
                    ),
                timeline =
                    listOf(
                        StatusTimelineStage("submitted", "Submitted", "Oct 24", StatusStepState.Done),
                        StatusTimelineStage("review", "Under review", "Action needed", StatusStepState.Current),
                        StatusTimelineStage("approved", "Approved", state = StatusStepState.Pending),
                    ),
                timelinePaused = true,
                etaPill =
                    StatusWaitingPill(
                        text = "Paused · respond within 7 days",
                        icon = PantopusIcon.AlertCircle,
                        tone = StatusPillTone.Warning,
                    ),
                manageSectionTitle = MANAGE_TITLE,
                inlineActions =
                    listOf(
                        WaitingRoomInlineAction(
                            id = "updateEvidence",
                            label = "Update evidence",
                            icon = PantopusIcon.FilePlus2,
                            tone = WaitingRoomActionTone.Primary,
                            actionKey = "update_evidence",
                        ),
                        cancelClaimAction(),
                    ),
                primaryCta = viewClaim,
                secondaryCta = backToHome,
            )
    }
}

/** Which canonical frame the room opens on. Mirrors iOS `WaitingRoomState`. */
enum class WaitingRoomState {
    Active,
    MoreInfoRequested,
    ;

    fun content(): WaitingRoomContent =
        when (this) {
            Active -> WaitingRoomContent.active()
            MoreInfoRequested -> WaitingRoomContent.moreInfoRequested()
        }
}
