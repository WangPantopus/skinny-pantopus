@file:Suppress("PackageNaming", "LongMethod", "CyclomaticComplexMethod", "TooManyFunctions")

package app.pantopus.android.ui.screens.status.waiting_room

import androidx.compose.runtime.Immutable
import app.pantopus.android.ui.components.HaloCircleTone
import app.pantopus.android.ui.screens.status.StatusHalo
import app.pantopus.android.ui.theme.PantopusIcon
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.util.Locale

/**
 * The Verification Center frame of the A18.4 room. RN serves the same
 * route (`pantopus://homes/:id/waiting-room`) two different ways: an
 * ownership-claim wait *and* — when the caller has no claim in review but
 * their occupancy still isn't verified — a Verification Center that
 * branches on `verification_status` from `GET /api/homes/:id/me`
 * (`src/app/homes/[id]/waiting-room.tsx:242-313`).
 *
 * Pure value types: the view-model builds one from the access DTO and the
 * screen paints it. Mirrors iOS `HomeVerificationContent.swift`.
 */

/**
 * The `verification_status` vocabulary the Verification Center branches
 * on. Values come from `HomeOccupancy.verification_status` (surfaced at
 * `backend/routes/homeIam.js:126`); anything unmapped falls back to
 * [Unverified], which is exactly RN's `default:` arm.
 */
enum class HomeVerificationStatus(val raw: String) {
    PendingPostcard("pending_postcard"),
    ProvisionalBootstrap("provisional_bootstrap"),
    PendingApproval("pending_approval"),
    PendingDoc("pending_doc"),
    Provisional("provisional"),
    SuspendedChallenged("suspended_challenged"),
    Unverified("unverified"),
    ;

    companion object {
        /**
         * Never throws — an unknown server value renders the generic
         * "Verification required" frame rather than an empty screen.
         */
        fun from(raw: String?): HomeVerificationStatus = entries.firstOrNull { it.raw == raw } ?: Unverified
    }
}

/**
 * The single date card RN renders under the body — the challenge-window
 * end date (`provisional`) or the postcard expiry (`pending_postcard`).
 */
@Immutable
data class HomeVerificationCountdown(
    val icon: PantopusIcon,
    val label: String,
    val value: String,
)

/**
 * One full-width action card (icon · title · description · chevron).
 * [actionKey] is opaque so tests assert on the action that fired without
 * inspecting lambda identity — same contract as [WaitingRoomInlineAction].
 */
@Immutable
data class HomeVerificationAction(
    val id: String,
    val icon: PantopusIcon,
    val title: String,
    val subtitle: String? = null,
    val tone: WaitingRoomActionTone = WaitingRoomActionTone.Standard,
    val actionKey: String,
)

/** Snapshot the Verification Center frame renders. */
@Immutable
data class HomeVerificationContent(
    val status: HomeVerificationStatus,
    val halo: StatusHalo,
    val headline: String,
    val body: String,
    val countdown: HomeVerificationCountdown? = null,
    val actions: List<HomeVerificationAction>,
    /** Label of the trailing ghost CTA ("Done" in RN). */
    val doneLabel: String = "Done",
) {
    /** Opaque keys the view-model maps onto navigation intents. */
    object ActionKey {
        const val ENTER_CODE = "enter_code"
        const val UPLOAD_PROOF = "upload_proof"
        const val LANDLORD_VERIFICATION = "landlord_verification"
        const val REQUEST_MAILED_CODE = "request_mailed_code"
        const val MOVE_OUT = "move_out"
        const val REQUEST_HELP = "request_help"
    }

    companion object {
        /** Top-bar title — constant across every status. */
        const val SCREEN_TITLE = "Verification Center"

        /**
         * Build the frame for one access record. Every string is copied
         * from RN's `getStatusConfig` + action list
         * (`src/app/homes/[id]/waiting-room.tsx:128-313`).
         *
         * [HaloCircleTone] has no destructive tone, so
         * `suspended_challenged` renders [HaloCircleTone.Warning] +
         * `alert-circle` rather than RN's red disc.
         */
        fun make(
            status: HomeVerificationStatus,
            isInChallengeWindow: Boolean = false,
            challengeWindowEndsAt: String? = null,
            postcardExpiresAt: String? = null,
        ): HomeVerificationContent =
            HomeVerificationContent(
                status = status,
                halo = halo(status, isInChallengeWindow),
                headline = headline(status, isInChallengeWindow),
                body = body(status, isInChallengeWindow),
                countdown =
                    countdown(status, isInChallengeWindow, challengeWindowEndsAt, postcardExpiresAt),
                actions = actions(status),
            )

        private fun halo(
            status: HomeVerificationStatus,
            isInChallengeWindow: Boolean,
        ): StatusHalo =
            when (status) {
                HomeVerificationStatus.PendingPostcard ->
                    StatusHalo(HaloCircleTone.Info, PantopusIcon.Mail)
                HomeVerificationStatus.ProvisionalBootstrap ->
                    StatusHalo(HaloCircleTone.Warning, PantopusIcon.Shield)
                HomeVerificationStatus.PendingApproval ->
                    StatusHalo(HaloCircleTone.Info, PantopusIcon.Hourglass, isPulsing = true)
                HomeVerificationStatus.PendingDoc ->
                    StatusHalo(HaloCircleTone.Warning, PantopusIcon.FileText)
                HomeVerificationStatus.Provisional ->
                    if (isInChallengeWindow) {
                        StatusHalo(HaloCircleTone.Info, PantopusIcon.Clock, isPulsing = true)
                    } else {
                        StatusHalo(HaloCircleTone.Warning, PantopusIcon.Shield)
                    }
                HomeVerificationStatus.SuspendedChallenged ->
                    StatusHalo(HaloCircleTone.Warning, PantopusIcon.AlertCircle)
                HomeVerificationStatus.Unverified ->
                    StatusHalo(HaloCircleTone.Info, PantopusIcon.Hourglass)
            }

        private fun headline(
            status: HomeVerificationStatus,
            isInChallengeWindow: Boolean,
        ): String =
            when (status) {
                HomeVerificationStatus.PendingPostcard -> "Check your mailbox"
                HomeVerificationStatus.ProvisionalBootstrap -> "Limited access"
                HomeVerificationStatus.PendingApproval -> "Waiting for approval"
                HomeVerificationStatus.PendingDoc -> "Document under review"
                HomeVerificationStatus.Provisional ->
                    if (isInChallengeWindow) "Challenge window active" else "Provisional access"
                HomeVerificationStatus.SuspendedChallenged -> "Access suspended"
                HomeVerificationStatus.Unverified -> "Verification required"
            }

        private fun body(
            status: HomeVerificationStatus,
            isInChallengeWindow: Boolean,
        ): String =
            when (status) {
                HomeVerificationStatus.PendingPostcard ->
                    "A verification code has been mailed to this address. " +
                        "Enter the code to complete verification."
                HomeVerificationStatus.ProvisionalBootstrap ->
                    "You have provisional access with limited features. " +
                        "Verify your address to unlock full home management."
                HomeVerificationStatus.PendingApproval ->
                    "A household member needs to approve your request. " +
                        "Pull down to check for updates."
                HomeVerificationStatus.PendingDoc ->
                    "Your uploaded documents are being reviewed. " +
                        "This usually takes 1-2 business days."
                HomeVerificationStatus.Provisional ->
                    if (isInChallengeWindow) {
                        "Your access is provisional while existing members can review. " +
                            "Full access will be granted once the window closes."
                    } else {
                        "Verify your address to unlock full home management features."
                    }
                HomeVerificationStatus.SuspendedChallenged ->
                    "Your access has been challenged by a household member. " +
                        "Contact support if you believe this is an error."
                HomeVerificationStatus.Unverified ->
                    "Complete verification to access this home."
            }

        private fun countdown(
            status: HomeVerificationStatus,
            isInChallengeWindow: Boolean,
            challengeWindowEndsAt: String?,
            postcardExpiresAt: String?,
        ): HomeVerificationCountdown? {
            if (status == HomeVerificationStatus.Provisional && isInChallengeWindow) {
                formatDay(challengeWindowEndsAt)?.let {
                    return HomeVerificationCountdown(
                        icon = PantopusIcon.Clock,
                        label = "Challenge window ends",
                        value = it,
                    )
                }
            }
            if (status == HomeVerificationStatus.PendingPostcard) {
                formatDay(postcardExpiresAt)?.let {
                    return HomeVerificationCountdown(
                        icon = PantopusIcon.Mail,
                        label = "Code expires",
                        value = it,
                    )
                }
            }
            return null
        }

        /**
         * Medium-style local date ("Oct 14, 2026"). Returns null when the
         * string doesn't parse so the card is omitted rather than
         * printing a placeholder date.
         */
        fun formatDay(iso: String?): String? {
            if (iso.isNullOrBlank()) return null
            return runCatching {
                DAY_FORMAT.format(Instant.parse(iso))
            }.getOrNull()
        }

        private val DAY_FORMAT: DateTimeFormatter =
            DateTimeFormatter
                .ofLocalizedDate(FormatStyle.MEDIUM)
                .withLocale(Locale.getDefault())
                .withZone(ZoneId.systemDefault())

        private fun actions(status: HomeVerificationStatus): List<HomeVerificationAction> {
            val actions = mutableListOf<HomeVerificationAction>()
            if (status == HomeVerificationStatus.PendingPostcard) {
                actions +=
                    HomeVerificationAction(
                        id = "enterCode",
                        icon = PantopusIcon.KeyRound,
                        title = "Enter verification code",
                        subtitle = "Enter the code from your postcard",
                        actionKey = ActionKey.ENTER_CODE,
                    )
            }
            if (status == HomeVerificationStatus.ProvisionalBootstrap ||
                status == HomeVerificationStatus.PendingDoc ||
                status == HomeVerificationStatus.Provisional
            ) {
                actions +=
                    HomeVerificationAction(
                        id = "uploadProof",
                        icon = PantopusIcon.Upload,
                        title = "Upload proof",
                        subtitle = "Speed up verification with a document",
                        actionKey = ActionKey.UPLOAD_PROOF,
                    )
            }
            if (status == HomeVerificationStatus.PendingApproval ||
                status == HomeVerificationStatus.Unverified ||
                status == HomeVerificationStatus.Provisional
            ) {
                actions +=
                    HomeVerificationAction(
                        id = "landlordVerification",
                        icon = PantopusIcon.ShieldCheck,
                        title = "Landlord verification",
                        subtitle =
                            if (status == HomeVerificationStatus.PendingApproval) {
                                "Check your approval status"
                            } else {
                                "Request landlord approval"
                            },
                        actionKey = ActionKey.LANDLORD_VERIFICATION,
                    )
            }
            if (status != HomeVerificationStatus.PendingPostcard &&
                status != HomeVerificationStatus.PendingApproval
            ) {
                actions +=
                    HomeVerificationAction(
                        id = "requestMailedCode",
                        icon = PantopusIcon.Mail,
                        title = "Verify with mailed code",
                        subtitle = "Receive a code at this address",
                        actionKey = ActionKey.REQUEST_MAILED_CODE,
                    )
            }
            actions +=
                HomeVerificationAction(
                    id = "moveOut",
                    icon = PantopusIcon.XCircle,
                    title = "This isn't my home",
                    subtitle = "Remove yourself from this household",
                    tone = WaitingRoomActionTone.Danger,
                    actionKey = ActionKey.MOVE_OUT,
                )
            actions +=
                HomeVerificationAction(
                    id = "requestHelp",
                    icon = PantopusIcon.HelpCircle,
                    title = "Request help",
                    subtitle = "Get verification support",
                    actionKey = ActionKey.REQUEST_HELP,
                )
            return actions
        }
    }
}
