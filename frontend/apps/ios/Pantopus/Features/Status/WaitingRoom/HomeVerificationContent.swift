//
//  HomeVerificationContent.swift
//  Pantopus
//
//  The Verification Center frame of the A18.4 room. RN serves the same
//  route (`pantopus://homes/:id/waiting-room`) two different ways: an
//  ownership-claim wait *and* — when the caller has no claim in review
//  but their occupancy still isn't verified — a Verification Center that
//  branches on `verification_status` from `GET /api/homes/:id/me`
//  (`src/app/homes/[id]/waiting-room.tsx:242-313`).
//
//  This file is the projection for that second frame. Pure value types:
//  the view-model builds one from the access DTO and the view paints it.
//  Mirrors Android `HomeVerificationContent.kt`.
//

import Foundation

/// The `verification_status` vocabulary the Verification Center
/// branches on. Values come from `HomeOccupancy.verification_status`
/// (surfaced at `backend/routes/homeIam.js:126`); anything unmapped
/// falls back to `.unverified`, which is exactly RN's `default:` arm.
public enum HomeVerificationStatus: String, Sendable, Hashable, CaseIterable {
    case pendingPostcard = "pending_postcard"
    case provisionalBootstrap = "provisional_bootstrap"
    case pendingApproval = "pending_approval"
    case pendingDoc = "pending_doc"
    case provisional
    case suspendedChallenged = "suspended_challenged"
    case unverified

    /// Never throws — an unknown server value renders the generic
    /// "Verification required" frame rather than an empty screen.
    public static func from(raw: String?) -> HomeVerificationStatus {
        guard let raw, let known = HomeVerificationStatus(rawValue: raw) else {
            return .unverified
        }
        return known
    }
}

/// The single date card RN renders under the body — the challenge-window
/// end date (`provisional`) or the postcard expiry (`pending_postcard`).
public struct HomeVerificationCountdown: Sendable, Hashable {
    public let icon: PantopusIcon
    public let label: String
    public let value: String

    public init(icon: PantopusIcon, label: String, value: String) {
        self.icon = icon
        self.label = label
        self.value = value
    }
}

/// One full-width action card (icon · title · description · chevron).
/// `actionKey` is opaque so tests assert on the action that fired
/// without inspecting closure identity — same contract as
/// `WaitingRoomInlineAction`.
public struct HomeVerificationAction: Sendable, Hashable, Identifiable {
    public let id: String
    public let icon: PantopusIcon
    public let title: String
    public let subtitle: String?
    public let tone: WaitingRoomActionTone
    public let actionKey: String

    public init(
        id: String,
        icon: PantopusIcon,
        title: String,
        subtitle: String? = nil,
        tone: WaitingRoomActionTone = .standard,
        actionKey: String
    ) {
        self.id = id
        self.icon = icon
        self.title = title
        self.subtitle = subtitle
        self.tone = tone
        self.actionKey = actionKey
    }
}

/// Snapshot the Verification Center frame renders.
public struct HomeVerificationContent: Sendable, Hashable {
    /// Top-bar title — constant across every status.
    public static let screenTitle = "Verification Center"

    public let status: HomeVerificationStatus
    public let halo: StatusHalo
    public let headline: String
    public let body: String
    public let countdown: HomeVerificationCountdown?
    public let actions: [HomeVerificationAction]
    /// Label of the trailing ghost CTA ("Done" in RN).
    public let doneLabel: String

    public init(
        status: HomeVerificationStatus,
        halo: StatusHalo,
        headline: String,
        body: String,
        countdown: HomeVerificationCountdown? = nil,
        actions: [HomeVerificationAction],
        doneLabel: String = "Done"
    ) {
        self.status = status
        self.halo = halo
        self.headline = headline
        self.body = body
        self.countdown = countdown
        self.actions = actions
        self.doneLabel = doneLabel
    }
}

// MARK: - Action keys

public extension HomeVerificationContent {
    /// Opaque keys the view-model maps onto navigation intents.
    enum ActionKey {
        public static let enterCode = "enter_code"
        public static let uploadProof = "upload_proof"
        public static let landlordVerification = "landlord_verification"
        public static let requestMailedCode = "request_mailed_code"
        public static let moveOut = "move_out"
        public static let requestHelp = "request_help"
    }
}

// MARK: - Factory

public extension HomeVerificationContent {
    /// Build the frame for one access record. Every string is copied from
    /// RN's `getStatusConfig` + action list
    /// (`src/app/homes/[id]/waiting-room.tsx:128-313`).
    ///
    /// `HaloCircle` has no destructive tone, so `suspended_challenged`
    /// renders `.warning` + `alert-circle` rather than RN's red disc.
    static func make(
        status: HomeVerificationStatus,
        isInChallengeWindow: Bool = false,
        challengeWindowEndsAt: String? = nil,
        postcardExpiresAt: String? = nil
    ) -> HomeVerificationContent {
        HomeVerificationContent(
            status: status,
            halo: halo(for: status, isInChallengeWindow: isInChallengeWindow),
            headline: headline(for: status, isInChallengeWindow: isInChallengeWindow),
            body: body(for: status, isInChallengeWindow: isInChallengeWindow),
            countdown: countdown(
                for: status,
                isInChallengeWindow: isInChallengeWindow,
                challengeWindowEndsAt: challengeWindowEndsAt,
                postcardExpiresAt: postcardExpiresAt
            ),
            actions: actions(for: status)
        )
    }

    // MARK: Halo / copy

    private static func halo(
        for status: HomeVerificationStatus,
        isInChallengeWindow: Bool
    ) -> StatusHalo {
        switch status {
        case .pendingPostcard:
            StatusHalo(tone: .info, icon: .mail)
        case .provisionalBootstrap:
            StatusHalo(tone: .warning, icon: .shield)
        case .pendingApproval:
            StatusHalo(tone: .info, icon: .hourglass, isPulsing: true)
        case .pendingDoc:
            StatusHalo(tone: .warning, icon: .fileText)
        case .provisional:
            if isInChallengeWindow {
                StatusHalo(tone: .info, icon: .clock, isPulsing: true)
            } else {
                StatusHalo(tone: .warning, icon: .shield)
            }
        case .suspendedChallenged:
            StatusHalo(tone: .warning, icon: .alertCircle)
        case .unverified:
            StatusHalo(tone: .info, icon: .hourglass)
        }
    }

    private static func headline(
        for status: HomeVerificationStatus,
        isInChallengeWindow: Bool
    ) -> String {
        switch status {
        case .pendingPostcard: "Check your mailbox"
        case .provisionalBootstrap: "Limited access"
        case .pendingApproval: "Waiting for approval"
        case .pendingDoc: "Document under review"
        case .provisional: isInChallengeWindow ? "Challenge window active" : "Provisional access"
        case .suspendedChallenged: "Access suspended"
        case .unverified: "Verification required"
        }
    }

    private static func body(
        for status: HomeVerificationStatus,
        isInChallengeWindow: Bool
    ) -> String {
        switch status {
        case .pendingPostcard:
            "A verification code has been mailed to this address. " +
                "Enter the code to complete verification."
        case .provisionalBootstrap:
            "You have provisional access with limited features. " +
                "Verify your address to unlock full home management."
        case .pendingApproval:
            "A household member needs to approve your request. Pull down to check for updates."
        case .pendingDoc:
            "Your uploaded documents are being reviewed. This usually takes 1-2 business days."
        case .provisional:
            isInChallengeWindow
                ? "Your access is provisional while existing members can review. " +
                "Full access will be granted once the window closes."
                : "Verify your address to unlock full home management features."
        case .suspendedChallenged:
            "Your access has been challenged by a household member. " +
                "Contact support if you believe this is an error."
        case .unverified:
            "Complete verification to access this home."
        }
    }

    // MARK: Countdown

    private static func countdown(
        for status: HomeVerificationStatus,
        isInChallengeWindow: Bool,
        challengeWindowEndsAt: String?,
        postcardExpiresAt: String?
    ) -> HomeVerificationCountdown? {
        if status == .provisional, isInChallengeWindow,
           let formatted = formatDay(challengeWindowEndsAt) {
            return HomeVerificationCountdown(
                icon: .clock,
                label: "Challenge window ends",
                value: formatted
            )
        }
        if status == .pendingPostcard, let formatted = formatDay(postcardExpiresAt) {
            return HomeVerificationCountdown(
                icon: .mail,
                label: "Code expires",
                value: formatted
            )
        }
        return nil
    }

    /// Medium-style local date ("Oct 14, 2026"). Returns nil when the
    /// string doesn't parse so the card is omitted rather than printing
    /// a placeholder date.
    static func formatDay(_ iso: String?) -> String? {
        guard let iso else { return nil }
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let date = fractional.date(from: iso) ?? ISO8601DateFormatter().date(from: iso) else {
            return nil
        }
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter.string(from: date)
    }

    // MARK: Actions

    private static func actions(for status: HomeVerificationStatus) -> [HomeVerificationAction] {
        var actions: [HomeVerificationAction] = []
        if status == .pendingPostcard {
            actions.append(
                HomeVerificationAction(
                    id: "enterCode",
                    icon: .keyRound,
                    title: "Enter verification code",
                    subtitle: "Enter the code from your postcard",
                    actionKey: ActionKey.enterCode
                )
            )
        }
        if status == .provisionalBootstrap || status == .pendingDoc || status == .provisional {
            actions.append(
                HomeVerificationAction(
                    id: "uploadProof",
                    icon: .upload,
                    title: "Upload proof",
                    subtitle: "Speed up verification with a document",
                    actionKey: ActionKey.uploadProof
                )
            )
        }
        if status == .pendingApproval || status == .unverified || status == .provisional {
            actions.append(
                HomeVerificationAction(
                    id: "landlordVerification",
                    icon: .shieldCheck,
                    title: "Landlord verification",
                    subtitle: status == .pendingApproval
                        ? "Check your approval status"
                        : "Request landlord approval",
                    actionKey: ActionKey.landlordVerification
                )
            )
        }
        if status != .pendingPostcard, status != .pendingApproval {
            actions.append(
                HomeVerificationAction(
                    id: "requestMailedCode",
                    icon: .mail,
                    title: "Verify with mailed code",
                    subtitle: "Receive a code at this address",
                    actionKey: ActionKey.requestMailedCode
                )
            )
        }
        actions.append(
            HomeVerificationAction(
                id: "moveOut",
                icon: .xCircle,
                title: "This isn't my home",
                subtitle: "Remove yourself from this household",
                tone: .danger,
                actionKey: ActionKey.moveOut
            )
        )
        actions.append(
            HomeVerificationAction(
                id: "requestHelp",
                icon: .helpCircle,
                title: "Request help",
                subtitle: "Get verification support",
                actionKey: ActionKey.requestHelp
            )
        )
        return actions
    }
}
