//
//  StatusWaitingContent.swift
//  Pantopus
//
//  Render-only model for the A18 Status / Waiting screen. The view
//  itself is purely presentational — the caller builds the content
//  and passes it in. Canonical design frames are exposed as static
//  factories on `StatusWaitingContent` so call sites compose by
//  intent ("claim submitted") rather than slot.
//
//  P8.5 polish: the hero is now a `HaloCircle` primitive (tone + icon),
//  the status pill carries an explicit tone (neutral / success / warning
//  / primary) and optional spinning glyph, and two layouts are supported
//  for the actions — a sticky bottom dock (primary + ghost secondary) or
//  an in-body button stack (A18.1's Open Mail / Resend / change-email).
//

import Foundation

/// Hero halo: which ceremonial tone + glyph the `HaloCircle` paints.
public struct StatusHalo: Sendable, Hashable {
    public let tone: HaloCircleTone
    public let icon: PantopusIcon?
    public let isPulsing: Bool

    public init(tone: HaloCircleTone, icon: PantopusIcon? = nil, isPulsing: Bool = false) {
        self.tone = tone
        self.icon = icon
        self.isPulsing = isPulsing
    }
}

/// Tone for the status pill that sits under the headline. Drives the
/// pill background, text, and icon colour.
public enum StatusPillTone: String, Sendable, Hashable {
    /// Neutral "still waiting" — muted surface + secondary text. A18.1 waiting.
    case neutral
    /// Success — green confirmation. A18.1 resent / A18.2 / A18.3 waiting.
    case success
    /// Warning — amber, time-sensitive. A18 "under review".
    case warning
    /// Primary — sky, final-step nudge. A18.3 landlord-confirmed.
    case primary
}

/// The pill under the headline (formerly `etaChip`). Optional spinning
/// glyph drives the A18.1 hourglass.
public struct StatusWaitingPill: Sendable, Hashable {
    public let text: String
    public let icon: PantopusIcon?
    public let tone: StatusPillTone
    public let isSpinning: Bool

    public init(
        text: String,
        icon: PantopusIcon? = nil,
        tone: StatusPillTone = .warning,
        isSpinning: Bool = false
    ) {
        self.text = text
        self.icon = icon
        self.tone = tone
        self.isSpinning = isSpinning
    }
}

/// State of a single timeline step. When `nil` on a stage the view
/// derives it from `currentStageId` (backward-compatible behaviour).
public enum StatusStepState: String, Sendable, Hashable {
    case done, current, pending
}

/// One stage in the optional 3-step timeline. `sub` is an optional
/// caption (e.g. a date) and `state` an optional explicit override.
public struct StatusTimelineStage: Sendable, Hashable, Identifiable {
    public let id: String
    public let label: String
    public let sub: String?
    public let state: StatusStepState?

    public init(id: String, label: String, sub: String? = nil, state: StatusStepState? = nil) {
        self.id = id
        self.label = label
        self.sub = sub
        self.state = state
    }
}

/// One row in the action-cards stack (kept for the "under review" frame).
public struct StatusActionCard: Sendable, Hashable, Identifiable {
    public let id: String
    public let icon: PantopusIcon
    public let title: String
    public let subtitle: String?

    public init(id: String, icon: PantopusIcon, title: String, subtitle: String? = nil) {
        self.id = id
        self.icon = icon
        self.title = title
        self.subtitle = subtitle
    }
}

/// Visual weight of an in-body action button (A18.1's button stack).
public enum StatusActionButtonStyle: String, Sendable, Hashable {
    /// Filled sky primary with optional sky shadow.
    case primary
    /// Outlined surface button with a strong border.
    case outline
    /// Underlined text link.
    case underline
}

/// A button in the in-body action stack (A18.1). `isDisabled` drives the
/// "Resend in 0:42" cooldown variant.
public struct StatusActionButton: Sendable, Hashable, Identifiable {
    public let id: String
    public let label: String
    public let actionKey: String
    public let icon: PantopusIcon?
    public let style: StatusActionButtonStyle
    public let isDisabled: Bool

    public init(
        id: String,
        label: String,
        actionKey: String,
        icon: PantopusIcon? = nil,
        style: StatusActionButtonStyle,
        isDisabled: Bool = false
    ) {
        self.id = id
        self.label = label
        self.actionKey = actionKey
        self.icon = icon
        self.style = style
        self.isDisabled = isDisabled
    }
}

/// CTA at the sticky bottom dock. Carries a label + an opaque key so
/// tests can verify "the right CTA fired" without inspecting closure
/// identity, plus an optional leading glyph.
public struct StatusCTA: Sendable, Hashable {
    public let label: String
    public let actionKey: String
    public let icon: PantopusIcon?

    public init(label: String, actionKey: String, icon: PantopusIcon? = nil) {
        self.label = label
        self.actionKey = actionKey
        self.icon = icon
    }
}

/// Snapshot the view renders. Every slot the design frames list is
/// represented; optional fields hide their section when nil/empty.
public struct StatusWaitingContent: Sendable, Hashable {
    public let halo: StatusHalo
    public let headline: String
    public let subcopy: String
    /// Substring of `subcopy` to render bold (e.g. the email / landlord name).
    public let bodyEmphasis: String?
    /// Muted home-pin chip naming what was claimed. `nil` omits the chip.
    public let addressChip: String?
    public let statusPill: StatusWaitingPill?
    public let timeline: [StatusTimelineStage]
    public let currentStageId: String?
    public let actionCards: [StatusActionCard]
    public let explainerBullets: [String]
    /// In-body button stack (A18.1). When non-empty the sticky dock is
    /// suppressed and these render in the scroll body instead.
    public let actionStack: [StatusActionButton]
    /// Footer hint under the body (info glyph + secondary text). A18.1.
    public let footnote: String?
    public let primaryCta: StatusCTA?
    public let secondaryCta: StatusCTA?

    public init(
        halo: StatusHalo,
        headline: String,
        subcopy: String,
        bodyEmphasis: String? = nil,
        addressChip: String? = nil,
        statusPill: StatusWaitingPill? = nil,
        timeline: [StatusTimelineStage] = [],
        currentStageId: String? = nil,
        actionCards: [StatusActionCard] = [],
        explainerBullets: [String] = [],
        actionStack: [StatusActionButton] = [],
        footnote: String? = nil,
        primaryCta: StatusCTA? = nil,
        secondaryCta: StatusCTA? = nil
    ) {
        self.halo = halo
        self.headline = headline
        self.subcopy = subcopy
        self.bodyEmphasis = bodyEmphasis
        self.addressChip = addressChip
        self.statusPill = statusPill
        self.timeline = timeline
        self.currentStageId = currentStageId
        self.actionCards = actionCards
        self.explainerBullets = explainerBullets
        self.actionStack = actionStack
        self.footnote = footnote
        self.primaryCta = primaryCta
        self.secondaryCta = secondaryCta
    }
}

// MARK: - Presets (the design frames)

public extension StatusWaitingContent {
    /// Three-stage progress used by the Homes claim flow. Stages are
    /// `submitted / review / complete` — homes wizards highlight one of
    /// them depending on where the claim is.
    static let homesClaimTimeline: [StatusTimelineStage] = [
        StatusTimelineStage(id: "submitted", label: "Submitted"),
        StatusTimelineStage(id: "review", label: "Under review"),
        StatusTimelineStage(id: "complete", label: "Complete")
    ]

    // MARK: A18.2 — Claim submitted

    /// A18.2 — right after a claim POST (`approved == false`) or revisited
    /// once the claim resolves (`approved == true`).
    ///
    /// `submittedOn` / `decidedOn` are pre-formatted captions built from the
    /// claim's real `created_at` / `updated_at`. They are **optional on
    /// purpose**: the design frames show sample dates, but the app must never
    /// print a date it can't source from the API, so a nil argument drops the
    /// caption (and the date fragment of the pill) rather than inventing one.
    static func claimSubmitted(
        homeName: String?,
        approved: Bool = false,
        submittedOn: String? = nil,
        decidedOn: String? = nil
    ) -> StatusWaitingContent {
        let chip = homeName?.isEmpty == false ? homeName : nil
        let submittedCaption = submittedOn?.isEmpty == false ? submittedOn : nil
        let decidedCaption = decidedOn?.isEmpty == false ? decidedOn : nil
        if approved {
            return StatusWaitingContent(
                halo: StatusHalo(tone: .success, icon: .badgeCheck),
                headline: "You're the owner",
                subcopy: "Your ownership claim was approved. The Home badge now shows on your profile and household.",
                addressChip: chip,
                statusPill: StatusWaitingPill(
                    text: decidedCaption.map { "Approved · \($0)" } ?? "Approved",
                    icon: .checkCircle,
                    tone: .success
                ),
                timeline: [
                    StatusTimelineStage(id: "submitted", label: "Submitted", sub: submittedCaption, state: .done),
                    StatusTimelineStage(id: "review", label: "Under review", state: .done),
                    StatusTimelineStage(id: "decision", label: "Approved", sub: decidedCaption, state: .done)
                ],
                primaryCta: StatusCTA(label: "Open your home", actionKey: "open_home", icon: .arrowRight),
                secondaryCta: StatusCTA(label: "View claim", actionKey: "view_claim")
            )
        }
        return StatusWaitingContent(
            halo: StatusHalo(tone: .success, icon: .check),
            headline: "Claim submitted",
            subcopy: "We'll review your deed and address match within 3 business days and send you a decision.",
            addressChip: chip,
            statusPill: StatusWaitingPill(
                text: "Decision usually within 3 business days",
                icon: .calendarClock,
                tone: .success
            ),
            timeline: [
                StatusTimelineStage(id: "submitted", label: "Submitted", sub: submittedCaption, state: .done),
                StatusTimelineStage(id: "review", label: "Under review", state: .pending),
                StatusTimelineStage(id: "decision", label: "Decision", state: .pending)
            ],
            primaryCta: StatusCTA(label: "View status", actionKey: "view_status", icon: .arrowRight),
            secondaryCta: StatusCTA(label: "Back to home", actionKey: "back_to_home")
        )
    }

    // MARK: A18.3 — Verification submitted (tenant verifying landlord)

    /// A18.3 — tenant submitted lease + ID, now waiting on the landlord
    /// (`confirmed == false`) or the landlord has signed off and Pantopus
    /// is doing the final review (`confirmed == true`). The primary CTA is
    /// "Back to home" (the user can't speed this up), inverting A18.2.
    ///
    /// `submittedOn` / `confirmedOn` are pre-formatted captions built from the
    /// real lease-request timestamps; nil drops the caption rather than
    /// printing one of the design's sample dates.
    static func verificationSubmitted(
        homeName: String?,
        landlordEmail: String,
        landlordName: String? = nil,
        confirmed: Bool = false,
        submittedOn: String? = nil,
        confirmedOn: String? = nil
    ) -> StatusWaitingContent {
        let chip = homeName?.isEmpty == false ? homeName : nil
        let submittedCaption = submittedOn?.isEmpty == false ? submittedOn : nil
        let confirmedCaption = confirmedOn?.isEmpty == false ? confirmedOn : nil
        let backToHome = StatusCTA(label: "Back to home", actionKey: "back_to_home", icon: .home)
        let viewStatus = StatusCTA(label: "View status", actionKey: "view_status")
        if confirmed {
            let who = landlordName?.isEmpty == false ? (landlordName ?? "Your landlord") : "Your landlord"
            return StatusWaitingContent(
                halo: StatusHalo(tone: .success, icon: .userCheck),
                headline: "Landlord confirmed",
                subcopy: "\(who) confirmed your tenancy. " +
                    "Pantopus is doing a final review before your Resident badge goes live.",
                bodyEmphasis: who,
                addressChip: chip,
                statusPill: StatusWaitingPill(
                    text: "Final review in progress",
                    icon: .calendarClock,
                    tone: .primary
                ),
                timeline: [
                    StatusTimelineStage(id: "lease", label: "Lease + ID", sub: submittedCaption, state: .done),
                    StatusTimelineStage(
                        id: "landlord",
                        label: "Landlord confirms",
                        sub: confirmedCaption,
                        state: .done
                    ),
                    StatusTimelineStage(id: "verified", label: "Verified", sub: "In review", state: .current)
                ],
                primaryCta: backToHome,
                secondaryCta: viewStatus
            )
        }
        let email = landlordEmail.isEmpty ? "your landlord" : landlordEmail
        return StatusWaitingContent(
            halo: StatusHalo(tone: .success, icon: .check),
            headline: "Verification submitted",
            subcopy: "We emailed your landlord at \(email) to confirm. You'll get a push when they do.",
            bodyEmphasis: landlordEmail.isEmpty ? nil : landlordEmail,
            addressChip: chip,
            statusPill: StatusWaitingPill(
                text: "Most landlords confirm in 1–2 days",
                icon: .calendarClock,
                tone: .success
            ),
            timeline: [
                StatusTimelineStage(id: "lease", label: "Lease + ID", sub: submittedCaption, state: .done),
                StatusTimelineStage(id: "landlord", label: "Landlord confirms", state: .pending),
                StatusTimelineStage(id: "verified", label: "Verified", state: .pending)
            ],
            primaryCta: backToHome,
            secondaryCta: viewStatus
        )
    }

    // MARK: Under review (homes claim, mid-process)

    /// Reached from MyClaimsList or a deep link while the backend is still
    /// processing. Keeps the action-cards + explainer recipe.
    static func underReview(
        homeName: String?,
        submittedAgo: String? = nil
    ) -> StatusWaitingContent {
        let venue = (homeName?.isEmpty == false) ? (homeName ?? "your claim") : "your claim"
        var subcopy = "We're reviewing your evidence. We'll email you when \(venue) is verified."
        if let submittedAgo, !submittedAgo.isEmpty {
            subcopy += " Submitted \(submittedAgo)."
        }
        return StatusWaitingContent(
            halo: StatusHalo(tone: .warning, icon: .hourglass),
            headline: "Under review",
            subcopy: subcopy,
            statusPill: StatusWaitingPill(text: "Usually resolved in 2–3 days", icon: .alertCircle, tone: .warning),
            timeline: homesClaimTimeline,
            currentStageId: "review",
            actionCards: [
                StatusActionCard(
                    id: "addEvidence",
                    icon: .upload,
                    title: "Add more evidence",
                    subtitle: "Strengthen your claim with extra documents."
                ),
                StatusActionCard(
                    id: "contactSupport",
                    icon: .mailbox,
                    title: "Contact support",
                    subtitle: "Stuck for more than 3 days? Reach out."
                )
            ],
            explainerBullets: [
                "Pantopus never asks for payment to speed up a review.",
                "You can keep using the rest of the app while we verify.",
                "We'll notify you in-app AND by email when it resolves."
            ],
            primaryCta: StatusCTA(label: "Back to Hub", actionKey: "back_to_hub"),
            secondaryCta: StatusCTA(label: "View claim", actionKey: "view_claim")
        )
    }

    // MARK: Auth frames (password reset)

    /// Reset link sent — Forgot-password success state used by
    /// `ForgotPasswordView`. Primary is "Resend"; ghost is "Back to login".
    static func resetLinkSent(email: String) -> StatusWaitingContent {
        let recipient = email.isEmpty ? "your email" : email
        return StatusWaitingContent(
            halo: StatusHalo(tone: .info, icon: .mailCheck),
            headline: "Check your email",
            subcopy: "We sent a reset link to \(recipient). Click it to set a new password.",
            bodyEmphasis: email.isEmpty ? nil : email,
            primaryCta: StatusCTA(label: "Resend", actionKey: "resend_reset"),
            secondaryCta: StatusCTA(label: "Back to login", actionKey: "back_to_login")
        )
    }

    // MARK: A18.1 — Check your email (verify-email-sent)

    /// A18.1 — fire-and-wait state after sign-up. `resent == false` shows the
    /// neutral "Waiting for link click…" pill with a spinning hourglass and an
    /// enabled Resend; `resent == true` swaps in a green "New link sent" pill,
    /// disables Resend with a cooldown countdown, and pivots the footer hint.
    static func checkYourEmail(
        email: String?,
        resent: Bool = false,
        resendCountdown: String = "0:42"
    ) -> StatusWaitingContent {
        let recipient = email?.isEmpty == false ? (email ?? "your email") : "your email"
        let openMail = StatusActionButton(
            id: "openMail",
            label: "Open Mail app",
            actionKey: "open_mail",
            icon: .externalLink,
            style: .primary
        )
        let useDifferent = StatusActionButton(
            id: "changeEmail",
            label: "Use a different email",
            actionKey: "change_email",
            style: .underline
        )
        let resend = resent
            ? StatusActionButton(
                id: "resendEmail",
                label: "Resend in \(resendCountdown)",
                actionKey: "resend_email",
                icon: .timer,
                style: .outline,
                isDisabled: true
            )
            : StatusActionButton(
                id: "resendEmail",
                label: "Resend email",
                actionKey: "resend_email",
                icon: .refreshCw,
                style: .outline
            )
        return StatusWaitingContent(
            halo: StatusHalo(tone: .info, icon: .mailCheck),
            headline: "Check your email",
            subcopy: "We sent a link to \(recipient). Tap it to finish setting up your account.",
            bodyEmphasis: email?.isEmpty == false ? email : nil,
            statusPill: resent
                ? StatusWaitingPill(text: "New link sent · just now", icon: .checkCircle, tone: .success)
                : StatusWaitingPill(text: "Waiting for link click…", icon: .hourglass, tone: .neutral, isSpinning: true),
            actionStack: [openMail, resend, useDifferent],
            footnote: resent
                ? "Still nothing? Double-check the spelling, or use a different email."
                : "Can't find it? Check spam or your \u{201C}Promotions\u{201D} tab."
        )
    }
}
