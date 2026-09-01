@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.status

import androidx.compose.runtime.Immutable
import app.pantopus.android.ui.components.HaloCircleTone
import app.pantopus.android.ui.theme.PantopusIcon

/** Hero halo: which ceremonial tone + glyph the [HaloCircle] paints. */
@Immutable
data class StatusHalo(
    val tone: HaloCircleTone,
    val icon: PantopusIcon? = null,
    val isPulsing: Boolean = false,
)

/** Tone for the status pill under the headline. */
enum class StatusPillTone { Neutral, Success, Warning, Primary }

/** The pill under the headline (formerly `etaChip`). */
@Immutable
data class StatusWaitingPill(
    val text: String,
    val icon: PantopusIcon? = null,
    val tone: StatusPillTone = StatusPillTone.Warning,
    val isSpinning: Boolean = false,
)

/** State of a single timeline step. When null, derived from `currentStageId`. */
enum class StatusStepState { Done, Current, Pending }

@Immutable
data class StatusTimelineStage(
    val id: String,
    val label: String,
    val sub: String? = null,
    val state: StatusStepState? = null,
)

@Immutable
data class StatusActionCard(
    val id: String,
    val icon: PantopusIcon,
    val title: String,
    val subtitle: String? = null,
)

/** Visual weight of an in-body action button (A18.1's button stack). */
enum class StatusActionButtonStyle { Primary, Outline, Underline }

/** A button in the in-body action stack (A18.1). */
@Immutable
data class StatusActionButton(
    val id: String,
    val label: String,
    val actionKey: String,
    val icon: PantopusIcon? = null,
    val style: StatusActionButtonStyle,
    val isDisabled: Boolean = false,
)

/** CTA that carries a label, an opaque key, and an optional leading glyph. */
@Immutable
data class StatusCta(
    val label: String,
    val actionKey: String,
    val icon: PantopusIcon? = null,
)

@Immutable
data class StatusWaitingContent(
    val halo: StatusHalo,
    val headline: String,
    val subcopy: String,
    val bodyEmphasis: String? = null,
    val addressChip: String? = null,
    val statusPill: StatusWaitingPill? = null,
    val timeline: List<StatusTimelineStage> = emptyList(),
    val currentStageId: String? = null,
    val actionCards: List<StatusActionCard> = emptyList(),
    val explainerBullets: List<String> = emptyList(),
    val actionStack: List<StatusActionButton> = emptyList(),
    val footnote: String? = null,
    val primaryCta: StatusCta? = null,
    val secondaryCta: StatusCta? = null,
) {
    companion object {
        /** Three-stage progress used by the Homes claim flow. */
        val homesClaimTimeline: List<StatusTimelineStage> =
            listOf(
                StatusTimelineStage(id = "submitted", label = "Submitted"),
                StatusTimelineStage(id = "review", label = "Under review"),
                StatusTimelineStage(id = "complete", label = "Complete"),
            )

        // ── A18.2 Claim submitted ────────────────────────────────────────

        /**
         * A18.2 — right after a claim POST (`approved == false`) or revisited
         * once it resolves (`approved == true`).
         *
         * [submittedOn] / [decidedOn] are pre-formatted captions built from
         * the claim's real `created_at` / `updated_at`. They are **optional on
         * purpose**: the design frames show sample dates, but the app must
         * never print a date it can't source from the API, so a null argument
         * drops the caption (and the date fragment of the pill) rather than
         * inventing one.
         */
        fun claimSubmitted(
            homeName: String? = null,
            approved: Boolean = false,
            submittedOn: String? = null,
            decidedOn: String? = null,
        ): StatusWaitingContent {
            val chip = homeName?.takeIf { it.isNotBlank() }
            val submittedCaption = submittedOn?.takeIf { it.isNotBlank() }
            val decidedCaption = decidedOn?.takeIf { it.isNotBlank() }
            if (approved) {
                return StatusWaitingContent(
                    halo = StatusHalo(tone = HaloCircleTone.Success, icon = PantopusIcon.BadgeCheck),
                    headline = "You're the owner",
                    subcopy =
                        "Your ownership claim was approved. The Home badge now shows on your profile and household.",
                    addressChip = chip,
                    statusPill =
                        StatusWaitingPill(
                            text = decidedCaption?.let { "Approved · $it" } ?: "Approved",
                            icon = PantopusIcon.CheckCircle,
                            tone = StatusPillTone.Success,
                        ),
                    timeline =
                        listOf(
                            StatusTimelineStage("submitted", "Submitted", submittedCaption, StatusStepState.Done),
                            StatusTimelineStage("review", "Under review", state = StatusStepState.Done),
                            StatusTimelineStage("decision", "Approved", decidedCaption, StatusStepState.Done),
                        ),
                    primaryCta =
                        StatusCta(label = "Open your home", actionKey = "open_home", icon = PantopusIcon.ArrowRight),
                    secondaryCta = StatusCta(label = "View claim", actionKey = "view_claim"),
                )
            }
            return StatusWaitingContent(
                halo = StatusHalo(tone = HaloCircleTone.Success, icon = PantopusIcon.Check),
                headline = "Claim submitted",
                subcopy = "We'll review your deed and address match within 3 business days and send you a decision.",
                addressChip = chip,
                statusPill =
                    StatusWaitingPill(
                        text = "Decision usually within 3 business days",
                        icon = PantopusIcon.CalendarClock,
                        tone = StatusPillTone.Success,
                    ),
                timeline =
                    listOf(
                        StatusTimelineStage("submitted", "Submitted", submittedCaption, StatusStepState.Done),
                        StatusTimelineStage("review", "Under review", state = StatusStepState.Pending),
                        StatusTimelineStage("decision", "Decision", state = StatusStepState.Pending),
                    ),
                primaryCta =
                    StatusCta(label = "View status", actionKey = "view_status", icon = PantopusIcon.ArrowRight),
                secondaryCta = StatusCta(label = "Back to home", actionKey = "back_to_home"),
            )
        }

        // ── A18.3 Verification submitted (tenant verifying landlord) ──────

        /**
         * A18.3 — tenant submitted lease + ID, now waiting on the landlord
         * (`confirmed == false`) or the landlord signed off and Pantopus is
         * doing the final review (`confirmed == true`). Primary CTA is "Back
         * to home" (the user can't speed this up), inverting A18.2.
         *
         * [submittedOn] / [confirmedOn] are pre-formatted captions built from
         * the real lease-request timestamps; null drops the caption rather
         * than printing one of the design's sample dates.
         */
        fun verificationSubmitted(
            homeName: String? = null,
            landlordEmail: String,
            landlordName: String? = null,
            confirmed: Boolean = false,
            submittedOn: String? = null,
            confirmedOn: String? = null,
        ): StatusWaitingContent {
            val chip = homeName?.takeIf { it.isNotBlank() }
            val submittedCaption = submittedOn?.takeIf { it.isNotBlank() }
            val confirmedCaption = confirmedOn?.takeIf { it.isNotBlank() }
            val backToHome = StatusCta(label = "Back to home", actionKey = "back_to_home", icon = PantopusIcon.Home)
            val viewStatus = StatusCta(label = "View status", actionKey = "view_status")
            if (confirmed) {
                val who = landlordName?.takeIf { it.isNotBlank() } ?: "Your landlord"
                return StatusWaitingContent(
                    halo = StatusHalo(tone = HaloCircleTone.Success, icon = PantopusIcon.UserCheck),
                    headline = "Landlord confirmed",
                    subcopy =
                        "$who confirmed your tenancy. " +
                            "Pantopus is doing a final review before your Resident badge goes live.",
                    bodyEmphasis = who,
                    addressChip = chip,
                    statusPill =
                        StatusWaitingPill(
                            text = "Final review in progress",
                            icon = PantopusIcon.CalendarClock,
                            tone = StatusPillTone.Primary,
                        ),
                    timeline =
                        listOf(
                            StatusTimelineStage("lease", "Lease + ID", submittedCaption, StatusStepState.Done),
                            StatusTimelineStage(
                                "landlord",
                                "Landlord confirms",
                                confirmedCaption,
                                StatusStepState.Done,
                            ),
                            StatusTimelineStage("verified", "Verified", "In review", StatusStepState.Current),
                        ),
                    primaryCta = backToHome,
                    secondaryCta = viewStatus,
                )
            }
            val email = landlordEmail.ifBlank { "your landlord" }
            return StatusWaitingContent(
                halo = StatusHalo(tone = HaloCircleTone.Success, icon = PantopusIcon.Check),
                headline = "Verification submitted",
                subcopy = "We emailed your landlord at $email to confirm. You'll get a push when they do.",
                bodyEmphasis = landlordEmail.ifBlank { null },
                addressChip = chip,
                statusPill =
                    StatusWaitingPill(
                        text = "Most landlords confirm in 1–2 days",
                        icon = PantopusIcon.CalendarClock,
                        tone = StatusPillTone.Success,
                    ),
                timeline =
                    listOf(
                        StatusTimelineStage("lease", "Lease + ID", submittedCaption, StatusStepState.Done),
                        StatusTimelineStage("landlord", "Landlord confirms", state = StatusStepState.Pending),
                        StatusTimelineStage("verified", "Verified", state = StatusStepState.Pending),
                    ),
                primaryCta = backToHome,
                secondaryCta = viewStatus,
            )
        }

        // ── Under review (homes claim, mid-process) ──────────────────────

        fun underReview(
            homeName: String? = null,
            submittedAgo: String? = null,
        ): StatusWaitingContent {
            val venue = homeName?.takeIf { it.isNotBlank() } ?: "your claim"
            val baseSubcopy = "We're reviewing your evidence. We'll email you when $venue is verified."
            val subcopy =
                if (!submittedAgo.isNullOrBlank()) "$baseSubcopy Submitted $submittedAgo." else baseSubcopy
            return StatusWaitingContent(
                halo = StatusHalo(tone = HaloCircleTone.Warning, icon = PantopusIcon.Hourglass),
                headline = "Under review",
                subcopy = subcopy,
                statusPill =
                    StatusWaitingPill(
                        text = "Usually resolved in 2–3 days",
                        icon = PantopusIcon.AlertCircle,
                        tone = StatusPillTone.Warning,
                    ),
                timeline = homesClaimTimeline,
                currentStageId = "review",
                actionCards =
                    listOf(
                        StatusActionCard(
                            id = "addEvidence",
                            icon = PantopusIcon.Upload,
                            title = "Add more evidence",
                            subtitle = "Strengthen your claim with extra documents.",
                        ),
                        StatusActionCard(
                            id = "contactSupport",
                            icon = PantopusIcon.Mailbox,
                            title = "Contact support",
                            subtitle = "Stuck for more than 3 days? Reach out.",
                        ),
                    ),
                explainerBullets =
                    listOf(
                        "Pantopus never asks for payment to speed up a review.",
                        "You can keep using the rest of the app while we verify.",
                        "We'll notify you in-app AND by email when it resolves.",
                    ),
                primaryCta = StatusCta(label = "Back to Hub", actionKey = "back_to_hub"),
                secondaryCta = StatusCta(label = "View claim", actionKey = "view_claim"),
            )
        }

        // ── Auth frames (password reset) ─────────────────────────────────

        /** Reset link sent — Forgot-password success state. */
        fun resetLinkSent(email: String): StatusWaitingContent {
            val recipient = email.ifBlank { "your email" }
            return StatusWaitingContent(
                halo = StatusHalo(tone = HaloCircleTone.Info, icon = PantopusIcon.MailCheck),
                headline = "Check your email",
                subcopy = "We sent a reset link to $recipient. Click it to set a new password.",
                bodyEmphasis = email.ifBlank { null },
                primaryCta = StatusCta(label = "Resend", actionKey = "resend_reset"),
                secondaryCta = StatusCta(label = "Back to login", actionKey = "back_to_login"),
            )
        }

        // ── A18.1 Check your email (verify-email-sent) ───────────────────

        /**
         * A18.1 — fire-and-wait state after sign-up. `resent == false` shows
         * the neutral "Waiting for link click…" pill with a spinning hourglass
         * and an enabled Resend; `resent == true` swaps in a green "New link
         * sent" pill, disables Resend with a cooldown countdown, and pivots the
         * footer hint.
         */
        fun checkYourEmail(
            email: String? = null,
            resent: Boolean = false,
            resendCountdown: String = "0:42",
        ): StatusWaitingContent {
            val recipient = email?.takeIf { it.isNotBlank() } ?: "your email"
            val openMail =
                StatusActionButton(
                    id = "openMail",
                    label = "Open Mail app",
                    actionKey = "open_mail",
                    icon = PantopusIcon.ExternalLink,
                    style = StatusActionButtonStyle.Primary,
                )
            val useDifferent =
                StatusActionButton(
                    id = "changeEmail",
                    label = "Use a different email",
                    actionKey = "change_email",
                    style = StatusActionButtonStyle.Underline,
                )
            val resend =
                if (resent) {
                    StatusActionButton(
                        id = "resendEmail",
                        label = "Resend in $resendCountdown",
                        actionKey = "resend_email",
                        icon = PantopusIcon.Timer,
                        style = StatusActionButtonStyle.Outline,
                        isDisabled = true,
                    )
                } else {
                    StatusActionButton(
                        id = "resendEmail",
                        label = "Resend email",
                        actionKey = "resend_email",
                        icon = PantopusIcon.RefreshCw,
                        style = StatusActionButtonStyle.Outline,
                    )
                }
            return StatusWaitingContent(
                halo = StatusHalo(tone = HaloCircleTone.Info, icon = PantopusIcon.MailCheck),
                headline = "Check your email",
                subcopy = "We sent a link to $recipient. Tap it to finish setting up your account.",
                bodyEmphasis = email?.takeIf { it.isNotBlank() },
                statusPill =
                    if (resent) {
                        StatusWaitingPill(
                            text = "New link sent · just now",
                            icon = PantopusIcon.CheckCircle,
                            tone = StatusPillTone.Success,
                        )
                    } else {
                        StatusWaitingPill(
                            text = "Waiting for link click…",
                            icon = PantopusIcon.Hourglass,
                            tone = StatusPillTone.Neutral,
                            isSpinning = true,
                        )
                    },
                actionStack = listOf(openMail, resend, useDifferent),
                footnote =
                    if (resent) {
                        "Still nothing? Double-check the spelling, or use a different email."
                    } else {
                        "Can't find it? Check spam or your “Promotions” tab."
                    },
            )
        }
    }
}
