//
//  PulseSeeingTooMuchLine.swift
//  Pantopus
//
//  "Seeing too much? Mute what you don't care about." (Pulse S10.6; build
//  spec §7): one line on Nearby's unfiltered page once the person has used
//  Pulse for a few days. Tapping it opens Pulse preferences, where a topic
//  can be muted for the area being read; tapping it or dismissing it
//  retires it for good on this device for this account. The tap is sent
//  as `pulse_seeing_too_much_tap` (§15), which the server records once it
//  accepts that event (it answers 204 and keeps nothing until then).
//

import SwiftUI

/// When the line is due: three days after the account's first Pulse visit
/// on this device, until it is tapped or dismissed.
enum PulseSeeingTooMuch {
    static let delay: TimeInterval = 3 * 24 * 60 * 60

    /// Notes the first visit and answers whether the line is due.
    static func due(userId: String, now: Date = Date(), defaults: UserDefaults = .standard) -> Bool {
        guard !defaults.bool(forKey: retiredKey(userId)) else { return false }
        guard let first = defaults.object(forKey: firstUseKey(userId)) as? Date else {
            defaults.set(now, forKey: firstUseKey(userId))
            return false
        }
        return now.timeIntervalSince(first) >= delay
    }

    static func retire(userId: String, defaults: UserDefaults = .standard) {
        defaults.set(true, forKey: retiredKey(userId))
    }

    static func firstUseKey(_ userId: String) -> String {
        "pulse.seeingTooMuch.firstUse.\(userId)"
    }

    private static func retiredKey(_ userId: String) -> String {
        "pulse.seeingTooMuch.retired.\(userId)"
    }
}

extension PulsePageViewModel {
    /// The line shows on Nearby's unfiltered page, once it's due.
    var showsSeeingTooMuch: Bool {
        seeingTooMuchDue && mode == .nearby && activeTopic == nil
    }

    /// Each visit: notes the first one, then decides whether the line is due.
    func noteSeeingTooMuch(now: Date = Date()) {
        guard let userId = Self.signedInUserId else { return }
        seeingTooMuchDue = PulseSeeingTooMuch.due(userId: userId, now: now)
    }

    /// The line goes for good, tapped or dismissed; a tap is counted.
    func retireSeeingTooMuch(tapped: Bool) {
        if tapped { PilotEvents.shared.record(.seeingTooMuchTap, meta: [:]) }
        if let userId = Self.signedInUserId { PulseSeeingTooMuch.retire(userId: userId) }
        seeingTooMuchDue = false
    }

    private static var signedInUserId: String? {
        guard case let .signedIn(user) = AuthManager.shared.state else { return nil }
        return user.id
    }
}

/// The line itself: its words open Pulse preferences, the × dismisses it.
struct PulseSeeingTooMuchLine: View {
    /// True for the words (open preferences), false for the ×.
    let onRetire: @MainActor (_ tapped: Bool) -> Void

    var body: some View {
        HStack(alignment: .center, spacing: Spacing.s1) {
            Button {
                onRetire(true)
            } label: {
                Text("Seeing too much? Mute what you don't care about.")
                    .pulseFont(.small)
                    .foregroundStyle(Theme.Color.primaryInk)
                    .multilineTextAlignment(.leading)
                    .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
            }
            .buttonStyle(.plain)
            .accessibilityHint("Opens Pulse preferences")
            .accessibilityIdentifier("pulseSeeingTooMuch")
            Button {
                onRetire(false)
            } label: {
                Icon(.x, size: 16, color: Theme.Color.appTextSecondary)
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Dismiss")
            .accessibilityIdentifier("pulseSeeingTooMuchDismiss")
        }
        .padding(.leading, Spacing.s4)
        .padding(.trailing, Spacing.s2)
    }
}
