//
//  AIAssistantLaunch.swift
//  Pantopus
//
//  How the assistant thread can open with something to do
//  (`docs/product/ai-assistant-phase3-contract-2026-10-22.md` §8.3, §8.4):
//  `pantopus://assistant` takes fixed keys only (`starter`, `compose`,
//  `surface`), each mapped here to the app's own words, so a link never
//  carries anyone's words. Siri's Start a plan and Remind my household hand
//  the person's words over in the app's memory instead (`AIAssistantLaunchInbox`).
//

import Foundation

/// What the assistant thread does once it opens.
public struct AIAssistantLaunch: Hashable, Sendable {
    /// Each launch happens once, even when two say the same.
    public let id = UUID()
    /// Sent as the person's next message.
    public let send: String?
    /// Put in the composer with the keyboard up, not sent ("Start a plan: ").
    public let compose: String?
    /// What the turn is about: `plans`, `today` (with the default home) or `nearby`.
    public let surface: String?

    public init(send: String? = nil, compose: String? = nil, surface: String? = nil) {
        self.send = send
        self.compose = compose
        self.surface = surface
    }

    /// `?starter=catch_up_nearby`: "What did I miss nearby?" sent, as the Nearby starter does.
    static let starters: [String: (text: String, surface: String)] = [
        "catch_up_nearby": ("What did I miss nearby?", "nearby")
    ]

    /// `?compose=start_plan|remind_household`: the composer starts the sentence.
    static let composers: [String: (text: String, surface: String)] = [
        "start_plan": ("Start a plan: ", "plans"),
        "remind_household": ("Remind my household to ", "today")
    ]

    static let surfaces: Set<String> = ["plans", "today", "nearby"]

    /// The launch a link's keys ask for; nil when it names none the app knows.
    static func fromLink(starter: String?, compose: String?, surface: String?) -> AIAssistantLaunch? {
        let surface = surface.flatMap { surfaces.contains($0) ? $0 : nil }
        if let starter = starter.flatMap({ starters[$0] }) {
            return AIAssistantLaunch(send: starter.text, surface: surface ?? starter.surface)
        }
        if let compose = compose.flatMap({ composers[$0] }) {
            return AIAssistantLaunch(compose: compose.text, surface: surface ?? compose.surface)
        }
        return surface.map { AIAssistantLaunch(surface: $0) }
    }

    /// Siri's Start a plan: the words as said, about Plans. Nil with no words (Host a plan opens).
    static func startPlan(words: String) -> AIAssistantLaunch? {
        let said = words.trimmingCharacters(in: .whitespacesAndNewlines)
        return said.isEmpty ? nil : AIAssistantLaunch(send: said, surface: "plans")
    }

    /// Siri's Remind my household: "Remind my household: <words>", about Today's home; with no
    /// words, the composer starts the sentence.
    static func remindHousehold(words: String) -> AIAssistantLaunch {
        let said = words.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !said.isEmpty else { return AIAssistantLaunch(compose: "Remind my household to ", surface: "today") }
        return AIAssistantLaunch(send: "Remind my household: \(said)", surface: "today")
    }
}

/// Siri's words, handed to the assistant thread in the app's memory (never in a link). A
/// launch waits a minute at most, and only for the account that made it.
@MainActor
final class AIAssistantLaunchInbox {
    static let shared = AIAssistantLaunchInbox()

    private struct Pending {
        let launch: AIAssistantLaunch
        let userId: String
        let at: Date
    }

    private var pending: Pending?

    /// The launch for the thread opening now, once.
    func take(userId: String) -> AIAssistantLaunch? {
        defer { pending = nil }
        guard let pending, pending.userId == userId, Date().timeIntervalSince(pending.at) < 60 else { return nil }
        return pending.launch
    }

    /// Opens the assistant with Siri's words; nil (Start a plan with no words) opens Host a plan.
    /// Signed out or behind App Lock, the app just opens.
    func openFromSiri(_ launch: AIAssistantLaunch?) async {
        guard await AssistantIntentSession.isReady(), case let .signedIn(user) = AuthManager.shared.state else { return }
        guard let launch else {
            DeepLinkRouter.shared.handle(path: "/plans/new")
            return
        }
        pending = Pending(launch: launch, userId: user.id, at: Date())
        DeepLinkRouter.shared.handle(path: "/assistant")
    }
}
