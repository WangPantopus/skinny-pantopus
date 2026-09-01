//
//  PrivacyHandshakeContent.swift
//  Pantopus
//
//  Render-only models for the T3.4 Privacy Handshake wizard.
//

import Foundation

/// Where the wizard currently is. The shell maps this to chrome.
public enum HandshakeStep: Sendable, Hashable {
    /// Initial step — pick a fan handle + acknowledge platform trust.
    case handleEntry

    /// Tier selection. Free is preselected when the persona has a
    /// rank-1 tier (always true post-migration).
    case tierSelection

    /// Submit-in-flight (POST /follow). Primary CTA shows the
    /// "Working…" spinner courtesy of WizardShell.
    case submitting

    /// Tier > 1 returned `{requiresPayment, subscribeUrl}` — the
    /// shell hands the URL off to the system browser.
    case opensCheckout(subscribeUrl: String)

    /// Tier 1 returned an active free Follower membership.
    case completedFree

    /// Pre-flight `/follow/status` already came back active —
    /// short-circuit before showing the wizard at all.
    case alreadyMember
}

/// The viewer's chosen handle + validation state.
public struct HandshakeHandleState: Sendable, Hashable {
    /// What's currently in the text field.
    public var value: String

    /// True when the backend has bound an audience identity to the
    /// viewer already (handle is fixed, field is read-only).
    public var locked: Bool

    /// True when `value` matches the viewer's User.username — we
    /// surface the "Use my Pantopus username" toggle then.
    public var matchesUsername: Bool

    /// User has explicitly acknowledged using their Pantopus
    /// username as their fan handle.
    public var acknowledgedUsingUsername: Bool

    /// Inline error from the last submit attempt (e.g. "Handle
    /// already taken", "Handle uses invalid characters").
    public var error: String?

    public init(
        value: String = "",
        locked: Bool = false,
        matchesUsername: Bool = false,
        acknowledgedUsingUsername: Bool = false,
        error: String? = nil
    ) {
        self.value = value
        self.locked = locked
        self.matchesUsername = matchesUsername
        self.acknowledgedUsingUsername = acknowledgedUsingUsername
        self.error = error
    }

    /// Handle pattern from `handshakeSchema` (Joi): 3-40 chars,
    /// `[a-zA-Z0-9_.-]+`.
    public var isValid: Bool {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.count >= 3, trimmed.count <= 40 else { return false }
        return trimmed.range(of: "^[A-Za-z0-9_.\\-]+$", options: .regularExpression) != nil
    }
}

/// The persona being subscribed to — minimal preview-card snapshot.
public struct HandshakePersonaPreview: Sendable, Hashable {
    public let id: String
    public let handle: String
    public let displayName: String
    public let avatarUrl: String?
    public let bio: String?
    public let audienceLabel: String
    public let followerCount: Int

    public init(
        id: String,
        handle: String,
        displayName: String,
        avatarUrl: String?,
        bio: String?,
        audienceLabel: String,
        followerCount: Int
    ) {
        self.id = id
        self.handle = handle
        self.displayName = displayName
        self.avatarUrl = avatarUrl
        self.bio = bio
        self.audienceLabel = audienceLabel
        self.followerCount = followerCount
    }
}

/// One row in the tier picker. Mirrors PersonaTierDTO with display
/// state derived for the wizard.
public struct HandshakeTierOption: Sendable, Hashable, Identifiable {
    public let id: String
    public let rank: Int
    public let name: String
    public let description: String?
    public let priceCents: Int
    public let currency: String

    public init(
        id: String,
        rank: Int,
        name: String,
        description: String?,
        priceCents: Int,
        currency: String
    ) {
        self.id = id
        self.rank = rank
        self.name = name
        self.description = description
        self.priceCents = priceCents
        self.currency = currency
    }

    public var isFree: Bool {
        rank == 1 || priceCents == 0
    }

    /// Formatted "Free" / "$5/mo" / "$25/mo" label for the picker row.
    public var priceLabel: String {
        if isFree { return "Free" }
        let dollars = priceCents / 100
        let cents = priceCents % 100
        let symbol = currency.uppercased() == "USD" ? "$" : ""
        if cents == 0 { return "\(symbol)\(dollars)/mo" }
        return String(format: "%@%d.%02d/mo", symbol, dollars, cents)
    }
}

/// Top-level VM state. Most chrome state lives on the wizard's
/// `chrome` snapshot, but render-only data flows via this enum so
/// the view can switch step content without re-reading the VM.
public enum HandshakeUiState: Sendable, Hashable {
    case loading
    case ready(HandshakeReadyContent)
    case error(message: String)
}

public struct HandshakeReadyContent: Sendable, Hashable {
    public let persona: HandshakePersonaPreview
    public let tierOptions: [HandshakeTierOption]
    public let step: HandshakeStep
    public let handle: HandshakeHandleState
    public let selectedTierRank: Int

    public init(
        persona: HandshakePersonaPreview,
        tierOptions: [HandshakeTierOption],
        step: HandshakeStep,
        handle: HandshakeHandleState,
        selectedTierRank: Int
    ) {
        self.persona = persona
        self.tierOptions = tierOptions
        self.step = step
        self.handle = handle
        self.selectedTierRank = selectedTierRank
    }

    public var selectedTier: HandshakeTierOption? {
        tierOptions.first { $0.rank == selectedTierRank }
    }
}
