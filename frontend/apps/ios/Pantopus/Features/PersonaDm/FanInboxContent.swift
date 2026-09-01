//
//  FanInboxContent.swift
//  Pantopus
//
//  A15.5 "Fan thread" — empty frame. Render models for the fan's inbox on
//  one persona: either an existing DM thread, or the "Start a
//  conversation" composer with its quota gate.
//
//  The gates below are the backend's first-class rejection codes, not
//  generic errors — `402 quota_exhausted`, `403 blocked`,
//  `403 no_membership`, `403 tier_does_not_allow`
//  (`backend/routes/personaDms.js:46`). Each carries its own copy.
//

import Foundation

/// Why the fan cannot open a new thread right now.
public enum FanInboxGate: Sendable, Hashable {
    /// `402 quota_exhausted` — every message-thread credit spent this period.
    case quotaExhausted
    /// `403 tier_does_not_allow` — the tier grants no DM threads at all.
    case tierDoesNotAllow
    /// `403 no_membership` — no active membership on this persona.
    case noMembership
    /// `403 blocked` — the creator blocked this account.
    case blocked

    public var headline: String {
        switch self {
        case .quotaExhausted: "Out of message threads"
        case .tierDoesNotAllow: "No messaging on this tier"
        case .noMembership: "Subscribe first"
        case .blocked: "Cannot message"
        }
    }

    public var body: String {
        switch self {
        case .quotaExhausted:
            "You have used all your message threads for this period. "
                + "They reset when your membership renews."
        case .tierDoesNotAllow:
            "This tier doesn't include direct messages — upgrade to send a DM."
        case .noMembership:
            "You need to subscribe to a paid tier first."
        case .blocked:
            "This profile cannot accept new messages from your account."
        }
    }

    /// CTA label for the gate, or `nil` when there is nothing to do here.
    public var ctaTitle: String? {
        switch self {
        case .quotaExhausted, .blocked: nil
        case .tierDoesNotAllow, .noMembership: "Change tier"
        }
    }
}

/// Remaining message-thread credits. `remaining == nil` with a non-nil
/// `limit` means unlimited (the backend returns `null` for an unlimited
/// tier); `limit == nil` means the tier grants none.
public struct FanInboxQuota: Sendable, Hashable {
    public let remaining: Int?
    public let limit: Int?

    public init(remaining: Int?, limit: Int?) {
        self.remaining = remaining
        self.limit = limit
    }

    /// "3 of 5 left" chip copy from the A15.5 quota gate.
    public var chipLabel: String {
        guard let limit else { return "No message threads on this tier" }
        if limit < 0 || remaining == nil { return "Unlimited message threads" }
        return "\(remaining ?? 0) of \(limit) left"
    }
}

/// The "Start a conversation" frame.
public struct FanInboxStartContent: Sendable, Hashable {
    /// `@handle` of the persona.
    public let personaTitle: String
    public let personaName: String
    public let initials: String
    public let quota: FanInboxQuota
    /// Non-nil when the composer must stay locked.
    public let gate: FanInboxGate?

    public init(
        personaTitle: String,
        personaName: String,
        initials: String,
        quota: FanInboxQuota,
        gate: FanInboxGate?
    ) {
        self.personaTitle = personaTitle
        self.personaName = personaName
        self.initials = initials
        self.quota = quota
        self.gate = gate
    }
}

/// Top-level render state for the fan inbox.
public enum FanInboxState: Sendable {
    case loading
    /// An open thread already exists — render the thread surface for it.
    case thread(threadId: String)
    case start(FanInboxStartContent)
    case error(message: String)
}
