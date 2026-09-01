//
//  WaitingRoomContent.swift
//  Pantopus
//
//  A18.4 — the persistent "waiting for approval" room. Unlike the one-shot
//  A18.2 `claimSubmitted` screen, this surface is re-entrant: reachable from
//  the home card any time a claim is under review (`pantopus://homes/:id/
//  waiting-room`). It reuses the A18.2/A18.3 `HaloCircle` + timeline + status
//  pill primitives but adds waiting-room-only chrome the one-shot factory
//  never covered — a back-chevron + bell top bar, an info-toned pulsing halo
//  (review isn't done, so not success green), a monospace claim-ref address
//  row, a 2-column "Manage this claim" action grid, and a distinct
//  "more info requested · review paused" secondary state.
//
//  Render-only: the caller (the view-model) builds the content and the
//  `WaitingRoomView` paints every slot. Two canonical frames are exposed as
//  static factories so call sites compose by intent.
//

import Foundation

/// Warning-toned reviewer note shown only in the "more info requested" state.
public struct WaitingRoomReviewerNote: Sendable, Hashable {
    /// Uppercase eyebrow, e.g. "Note from reviewer · Maya K.".
    public let eyebrow: String
    /// The reviewer's verbatim message (already quote-wrapped).
    public let body: String

    public init(eyebrow: String, body: String) {
        self.eyebrow = eyebrow
        self.body = body
    }
}

/// Visual weight of an inline "Manage this claim" action button.
public enum WaitingRoomActionTone: String, Sendable, Hashable {
    /// Neutral outline — surface bg + standard border + secondary text.
    case standard
    /// Elevated outline — sky border + sky text + subtle shadow. The
    /// more-info state promotes "Update evidence" to this tone.
    case primary
    /// Destructive outline — red border + red text. "Cancel claim".
    case danger
}

/// One button in the 2-column "Manage this claim" grid. Carries an opaque
/// `actionKey` so tests can verify the right action fired without inspecting
/// closure identity.
public struct WaitingRoomInlineAction: Sendable, Hashable, Identifiable {
    public let id: String
    public let label: String
    public let icon: PantopusIcon
    public let tone: WaitingRoomActionTone
    public let actionKey: String

    public init(
        id: String,
        label: String,
        icon: PantopusIcon,
        tone: WaitingRoomActionTone,
        actionKey: String
    ) {
        self.id = id
        self.label = label
        self.icon = icon
        self.tone = tone
        self.actionKey = actionKey
    }
}

/// Non-content frame the room falls back to when there is nothing real to
/// show: the claims fetch failed, no claim exists for this home, or the claim
/// is no longer in review. Mirrors Android `WaitingRoomNotice`.
public struct WaitingRoomNotice: Sendable, Hashable {
    public let headline: String
    public let body: String
    public let ctaLabel: String
    /// `true` → the CTA retries the fetch; `false` → it leaves the room.
    public let isRetry: Bool

    public init(headline: String, body: String, ctaLabel: String, isRetry: Bool) {
        self.headline = headline
        self.body = body
        self.ctaLabel = ctaLabel
        self.isRetry = isRetry
    }

    /// `GET /api/homes/my-ownership-claims` failed — never fall back to the
    /// seeded fixture, which would read as real claim data.
    public static let loadFailed = WaitingRoomNotice(
        headline: "Couldn't load your claim",
        body: "We couldn't reach Pantopus. Check your connection and try again.",
        ctaLabel: "Try again",
        isRetry: true
    )

    /// No claim row for this home — the manage actions would be no-ops.
    public static let noClaim = WaitingRoomNotice(
        headline: "No claim in review",
        body: "We couldn't find an ownership claim for this home.",
        ctaLabel: "Back to home",
        isRetry: false
    )

    /// The claim exists but the backend already returned a terminal status
    /// (`approved` / `rejected` / `revoked`).
    public static let claimDecided = WaitingRoomNotice(
        headline: "This claim isn't in review",
        body: "Your ownership claim has been decided. Check My Claims for the outcome.",
        ctaLabel: "Back to home",
        isRetry: false
    )
}

/// Which frame the room is currently rendering. Mirrors Android
/// `WaitingRoomPhase`.
public enum WaitingRoomPhase: Sendable, Hashable {
    case loading
    case loaded
    case notice(WaitingRoomNotice)
    /// No ownership claim is in review but the caller's occupancy still
    /// isn't verified — render RN's Verification Center frame instead of
    /// the dead-end "No claim in review" notice
    /// (`src/app/homes/[id]/waiting-room.tsx:67-70`).
    case verification(HomeVerificationContent)
    /// The claim resolved in the claimant's favour — render the A18.2
    /// "You're the owner" frame instead of a dead-end notice. The payload is
    /// built from the real claim row, so every date it prints is API-sourced.
    case approved(StatusWaitingContent)
}

/// Snapshot the `WaitingRoomView` renders. Reuses the shared `StatusHalo`,
/// `StatusWaitingPill`, `StatusTimelineStage`, and `StatusCTA` primitives so
/// the halo / timeline / pill / dock stay identical to A18.2/A18.3.
public struct WaitingRoomContent: Sendable, Hashable {
    /// Top-bar title — constant across both states.
    public let title: String
    public let halo: StatusHalo
    public let headline: String
    public let subcopy: String
    /// Address shown in the home-pin pill, e.g. "418 Linden Ave · Apt 3B".
    public let address: String
    /// Monospace claim reference appended after a divider, e.g. "CLM-4F2A".
    public let claimRef: String
    /// Warning reviewer-note card. `nil` in the active-wait state.
    public let reviewerNote: WaitingRoomReviewerNote?
    public let timeline: [StatusTimelineStage]
    /// When `true` the timeline recolors its active node/segment to warning
    /// and swaps the pulsing current dot for an `alert-circle`.
    public let timelinePaused: Bool
    /// ETA pill under the timeline (primary "within 24–48h" / warning "paused").
    public let etaPill: StatusWaitingPill
    /// Overline above the inline action grid ("Manage this claim").
    public let manageSectionTitle: String
    public let inlineActions: [WaitingRoomInlineAction]
    public let primaryCta: StatusCTA
    public let secondaryCta: StatusCTA

    public init(
        title: String,
        halo: StatusHalo,
        headline: String,
        subcopy: String,
        address: String,
        claimRef: String,
        reviewerNote: WaitingRoomReviewerNote? = nil,
        timeline: [StatusTimelineStage],
        timelinePaused: Bool = false,
        etaPill: StatusWaitingPill,
        manageSectionTitle: String,
        inlineActions: [WaitingRoomInlineAction],
        primaryCta: StatusCTA,
        secondaryCta: StatusCTA
    ) {
        self.title = title
        self.halo = halo
        self.headline = headline
        self.subcopy = subcopy
        self.address = address
        self.claimRef = claimRef
        self.reviewerNote = reviewerNote
        self.timeline = timeline
        self.timelinePaused = timelinePaused
        self.etaPill = etaPill
        self.manageSectionTitle = manageSectionTitle
        self.inlineActions = inlineActions
        self.primaryCta = primaryCta
        self.secondaryCta = secondaryCta
    }
}

// MARK: - Presets (the design frames)

public extension WaitingRoomContent {
    /// Constant chrome shared by both frames.
    static let roomTitle = "Waiting for approval"
    static let sampleAddress = "418 Linden Ave · Apt 3B"
    static let sampleClaimRef = "CLM-4F2A"
    static let manageTitle = "Manage this claim"

    private static var viewClaim: StatusCTA {
        StatusCTA(label: "View claim", actionKey: "view_claim", icon: .fileText)
    }

    private static var backToHome: StatusCTA {
        StatusCTA(label: "Back to home", actionKey: "back_to_home")
    }

    private static func cancelClaimAction() -> WaitingRoomInlineAction {
        WaitingRoomInlineAction(
            id: "cancelClaim",
            label: "Cancel claim",
            icon: .xCircle,
            tone: .danger,
            actionKey: "cancel_claim"
        )
    }

    /// Active wait — `Under review`, info-toned pulsing halo, the Submitted →
    /// Under review → Approved timeline with "Under review" current, and the
    /// "within 24–48 hours" ETA pill.
    static func active(
        address: String = sampleAddress,
        claimRef: String = sampleClaimRef
    ) -> WaitingRoomContent {
        WaitingRoomContent(
            title: roomTitle,
            halo: StatusHalo(tone: .info, icon: .hourglass, isPulsing: true),
            headline: "Under review",
            subcopy: "Pantopus is checking your documents against county records. " +
                "You'll get a push the moment we decide.",
            address: address,
            claimRef: claimRef,
            reviewerNote: nil,
            timeline: [
                StatusTimelineStage(id: "submitted", label: "Submitted", sub: "Oct 24", state: .done),
                StatusTimelineStage(id: "review", label: "Under review", sub: "Started 9h ago", state: .current),
                StatusTimelineStage(id: "approved", label: "Approved", state: .pending)
            ],
            timelinePaused: false,
            etaPill: StatusWaitingPill(
                text: "Decision usually within 24–48 hours",
                icon: .calendarClock,
                tone: .primary
            ),
            manageSectionTitle: manageTitle,
            inlineActions: [
                WaitingRoomInlineAction(
                    id: "updateEvidence",
                    label: "Update evidence",
                    icon: .filePlus2,
                    tone: .standard,
                    actionKey: "update_evidence"
                ),
                cancelClaimAction()
            ],
            primaryCta: viewClaim,
            secondaryCta: backToHome
        )
    }

    /// More info requested · review paused — `We need one more thing`, static
    /// warning halo, a reviewer-note card, the timeline paused on "Under
    /// review" (current node shows `alert-circle`), the "Paused · respond
    /// within 7 days" ETA pill, and "Update evidence" promoted to primary.
    static func moreInfoRequested(
        address: String = sampleAddress,
        claimRef: String = sampleClaimRef
    ) -> WaitingRoomContent {
        WaitingRoomContent(
            title: roomTitle,
            halo: StatusHalo(tone: .warning, icon: .fileWarning),
            headline: "We need one more thing",
            subcopy: "Your utility bill is older than 90 days. " +
                "Upload one from the last 60 days to continue the review.",
            address: address,
            claimRef: claimRef,
            reviewerNote: WaitingRoomReviewerNote(
                eyebrow: "Note from reviewer · Maya K.",
                body: "\u{201C}The PG&E bill you uploaded is dated July 14. Please upload one from " +
                    "August or later — anything within the last 60 days works.\u{201D}"
            ),
            timeline: [
                StatusTimelineStage(id: "submitted", label: "Submitted", sub: "Oct 24", state: .done),
                StatusTimelineStage(id: "review", label: "Under review", sub: "Action needed", state: .current),
                StatusTimelineStage(id: "approved", label: "Approved", state: .pending)
            ],
            timelinePaused: true,
            etaPill: StatusWaitingPill(
                text: "Paused · respond within 7 days",
                icon: .alertCircle,
                tone: .warning
            ),
            manageSectionTitle: manageTitle,
            inlineActions: [
                WaitingRoomInlineAction(
                    id: "updateEvidence",
                    label: "Update evidence",
                    icon: .filePlus2,
                    tone: .primary,
                    actionKey: "update_evidence"
                ),
                cancelClaimAction()
            ],
            primaryCta: viewClaim,
            secondaryCta: backToHome
        )
    }
}
