@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.status.waiting_room

import androidx.compose.runtime.Immutable
import app.pantopus.android.data.api.models.homes.ClaimApprovalProgressDto
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
    fun leavingToMyHomes(): WaitingRoomNotice = if (isRetry) this else copy(ctaLabel = "Back to My homes")

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

        /**
         * No claim row for this home — the manage actions would be no-ops. With
         * no claim there is no kind to name, so the copy fits ownership and residency.
         */
        val NoClaim =
            WaitingRoomNotice(
                headline = "No claim in review",
                body = "We couldn't find a claim for this home.",
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

        /**
         * [ClaimDecided] for a renter's residency document. Usually the renter
         * withdrew it (document approval waits on identity confirmation), so it
         * says closed rather than decided.
         */
        val ResidencyClaimDecided =
            WaitingRoomNotice(
                headline = "This claim isn't in review",
                body = "Your residency claim is closed. Check My Claims for the outcome.",
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
    /** Why the claim isn't approved yet and what to do; empty when the server didn't say. */
    val approvalSteps: List<WaitingRoomApprovalStep> = emptyList(),
) {
    companion object {
        const val ROOM_TITLE = "Waiting for approval"
        const val SAMPLE_ADDRESS = "418 Linden Ave · Apt 3B"
        const val SAMPLE_CLAIM_REF = "CLM-4F2A"
        const val MANAGE_TITLE = "Manage this claim"

        private val viewClaim =
            StatusCta(label = "View claim", actionKey = "view_claim", icon = PantopusIcon.FileText)
        private val backToHome = StatusCta(label = "Back to home", actionKey = "back_to_home")

        /**
         * A claim on a Home someone else added gives no way in until it's approved, and that
         * Home would only say "Home access unavailable": the claim is listed on My homes.
         */
        private val backToMyHomes = StatusCta(label = "Back to My homes", actionKey = "my_homes")

        private fun cancelClaimAction() =
            WaitingRoomInlineAction(
                id = "cancelClaim",
                label = "Cancel claim",
                icon = PantopusIcon.XCircle,
                tone = WaitingRoomActionTone.Danger,
                actionKey = "cancel_claim",
            )

        /**
         * What the room waits for. A person reviews the documents (no county-records
         * check), and no review time is promised. Approval also needs a confirmed identity.
         */
        private fun waitCopy(
            needsDocuments: Boolean,
            needsIdentity: Boolean,
            residency: Boolean,
        ): String {
            val requested =
                if (residency) {
                    "Upload a lease or utility bill with your name and this address so a Pantopus reviewer " +
                        "can check that you live here."
                } else {
                    "Upload a deed, closing disclosure or property tax bill so a Pantopus reviewer can check ownership."
                }
            return when {
                needsIdentity && needsDocuments -> "Confirm your identity and " + requested.replaceFirstChar { it.lowercase() }
                needsIdentity -> "A Pantopus reviewer can approve your claim once your identity is confirmed."
                needsDocuments -> requested
                else -> "Your documents are waiting for a Pantopus reviewer."
            }
        }

        private fun activeHalo(
            needsDocuments: Boolean,
            needsIdentity: Boolean,
        ): StatusHalo =
            when {
                needsDocuments -> StatusHalo(tone = HaloCircleTone.Info, icon = PantopusIcon.FilePlus2)
                needsIdentity -> StatusHalo(tone = HaloCircleTone.Info, icon = PantopusIcon.IdCard)
                else -> StatusHalo(tone = HaloCircleTone.Info, icon = PantopusIcon.Hourglass, isPulsing = true)
            }

        private fun activeHeadline(
            needsDocuments: Boolean,
            needsIdentity: Boolean,
        ): String =
            when {
                needsIdentity && needsDocuments -> "Two steps left"
                needsIdentity -> "Confirm your identity"
                needsDocuments -> "Add your documents"
                else -> "Under review"
            }

        private fun activeReviewCaption(
            needsDocuments: Boolean,
            needsIdentity: Boolean,
            reviewCaption: String?,
        ): String? =
            when {
                needsDocuments -> "Waiting for documents"
                needsIdentity -> "Waiting for your ID check"
                else -> reviewCaption
            }

        private fun activeEtaPill(
            needsDocuments: Boolean,
            needsIdentity: Boolean,
        ): StatusWaitingPill =
            when {
                needsDocuments ->
                    StatusWaitingPill("The review starts after you upload documents", PantopusIcon.FilePlus2, StatusPillTone.Primary)
                needsIdentity -> StatusWaitingPill("Approval waits for your ID check", PantopusIcon.IdCard, StatusPillTone.Primary)
                else -> StatusWaitingPill("We'll notify you when it's decided", PantopusIcon.Bell, StatusPillTone.Primary)
            }

        /**
         * While an ownership claim waits, the claimant can still prove they live
         * here by mail (founder decision, 2026-10-06); ownership stays in review.
         */
        private fun verifyByMailAction() =
            WaitingRoomInlineAction(
                id = "verifyByMail",
                label = "Verify address by mail",
                icon = PantopusIcon.Mail,
                tone = WaitingRoomActionTone.Standard,
                actionKey = "verify_postcard",
            )

        /**
         * Active wait — `Under review`, info-toned pulsing halo, the Submitted
         * → Under review → Approved timeline with "Under review" current, and
         * the "We'll notify you when it's decided" pill (no review time is promised).
         * A claim started from Add Home has no documents yet ([needsDocuments]),
         * so the room asks for them instead. Mail verification is offered until
         * the person's address is verified. [residency] marks a renter's
         * residency document, which asks for a lease or utility bill instead.
         * [approval] (the server's checklist) adds the identity check approval needs.
         * Without [canOpenHome] the dock leads back to My homes instead of the Home.
         */
        @Suppress("LongParameterList")
        fun active(
            address: String = SAMPLE_ADDRESS,
            claimRef: String = SAMPLE_CLAIM_REF,
            submittedOn: String? = "Oct 24",
            reviewCaption: String? = "Started 9h ago",
            needsDocuments: Boolean = false,
            addressVerified: Boolean = false,
            residency: Boolean = false,
            approval: ClaimApprovalProgressDto? = null,
            canOpenHome: Boolean = true,
        ): WaitingRoomContent {
            val needsIdentity = approval != null && approval.identity != "verified"
            val wait = waitCopy(needsDocuments = needsDocuments, needsIdentity = needsIdentity, residency = residency)
            val meanwhile =
                if (addressVerified) {
                    "Your address is verified, so you can use your Home meanwhile."
                } else {
                    "Meanwhile, you can verify your address by mail."
                }
            return WaitingRoomContent(
                title = ROOM_TITLE,
                halo = activeHalo(needsDocuments, needsIdentity),
                headline = activeHeadline(needsDocuments, needsIdentity),
                subcopy = "$wait $meanwhile",
                address = address,
                claimRef = claimRef,
                reviewerNote = null,
                timeline =
                    listOf(
                        StatusTimelineStage("submitted", "Submitted", submittedOn, StatusStepState.Done),
                        StatusTimelineStage(
                            "review",
                            "Under review",
                            activeReviewCaption(needsDocuments, needsIdentity, reviewCaption),
                            StatusStepState.Current,
                        ),
                        StatusTimelineStage("approved", "Approved", state = StatusStepState.Pending),
                    ),
                timelinePaused = false,
                etaPill = activeEtaPill(needsDocuments, needsIdentity),
                manageSectionTitle = MANAGE_TITLE,
                inlineActions =
                    listOfNotNull(
                        WaitingRoomInlineAction(
                            id = "updateEvidence",
                            label = if (needsDocuments) "Upload documents" else "Update evidence",
                            icon = PantopusIcon.FilePlus2,
                            tone = if (needsDocuments) WaitingRoomActionTone.Primary else WaitingRoomActionTone.Standard,
                            actionKey = "update_evidence",
                        ),
                        verifyByMailAction().takeUnless { addressVerified },
                        cancelClaimAction(),
                    ),
                primaryCta = viewClaim,
                secondaryCta = if (canOpenHome) backToHome else backToMyHomes,
                approvalSteps = WaitingRoomApproval.steps(approval, residency),
            )
        }

        /** The design's sample note, shown before the claim loads (the seeded frame). */
        const val SAMPLE_NOTE = "Please upload a property tax bill with your name on it."

        /**
         * More info requested · review paused: a Pantopus reviewer asked for something (Request info) and no
         * document has answered it yet. `We need one more thing`, static warning halo, the reviewer's [note]
         * (asked on [askedOn]), the timeline paused on "Under review" (current node shows `alert-circle`), the
         * "Paused · waiting for you" pill and the upload promoted to primary. The identity checklist stays, and the
         * dock follows [canOpenHome] as in [active]. Mirrors iOS `WaitingRoomContent.moreInfoRequested`.
         */
        @Suppress("LongParameterList")
        fun moreInfoRequested(
            address: String = SAMPLE_ADDRESS,
            claimRef: String = SAMPLE_CLAIM_REF,
            submittedOn: String? = "Oct 24",
            note: String? = SAMPLE_NOTE,
            askedOn: String? = "Oct 26",
            residency: Boolean = false,
            approval: ClaimApprovalProgressDto? = null,
            canOpenHome: Boolean = true,
        ): WaitingRoomContent =
            WaitingRoomContent(
                title = ROOM_TITLE,
                halo = StatusHalo(tone = HaloCircleTone.Warning, icon = PantopusIcon.FileWarning),
                headline = "We need one more thing",
                subcopy =
                    "A Pantopus reviewer asked for something before they can finish your claim. " +
                        "Upload it and the review continues.",
                address = address,
                claimRef = claimRef,
                reviewerNote =
                    WaitingRoomReviewerNote(
                        eyebrow = askedOn?.let { "Note from Pantopus · $it" } ?: "Note from Pantopus",
                        body =
                            note?.trim()?.takeIf { it.isNotEmpty() }?.let { "\u201C$it\u201D" }
                                ?: "A reviewer needs another document before they can finish your claim.",
                    ),
                timeline =
                    listOf(
                        StatusTimelineStage("submitted", "Submitted", submittedOn, StatusStepState.Done),
                        StatusTimelineStage("review", "Under review", "Action needed", StatusStepState.Current),
                        StatusTimelineStage("approved", "Approved", state = StatusStepState.Pending),
                    ),
                timelinePaused = true,
                etaPill =
                    StatusWaitingPill(
                        text = "Paused · waiting for you",
                        icon = PantopusIcon.AlertCircle,
                        tone = StatusPillTone.Warning,
                    ),
                manageSectionTitle = MANAGE_TITLE,
                inlineActions =
                    listOf(
                        WaitingRoomInlineAction(
                            id = "updateEvidence",
                            label = "Upload documents",
                            icon = PantopusIcon.FilePlus2,
                            tone = WaitingRoomActionTone.Primary,
                            actionKey = "update_evidence",
                        ),
                        cancelClaimAction(),
                    ),
                primaryCta = viewClaim,
                secondaryCta = if (canOpenHome) backToHome else backToMyHomes,
                approvalSteps = WaitingRoomApproval.steps(approval, residency),
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
