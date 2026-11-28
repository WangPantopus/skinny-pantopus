//
//  PulseTrackSwitch.swift
//  Pantopus
//
//  What the Pulse track keeps on the phone outside the app's screens (the postcard widget's snapshot, PHASE-3 piece 9;
//  the 8 pm "Your day" reminder, piece 10)
//  follows the switch: read on, it is brought up to date; read off (or signed out), it is taken away at once, so a
//  switched-off phone shows exactly today's. Called from `PulseReinventedFlags.apply(_:)` each time the switch's value
//  is applied (launch, coming to the front, an account change). With nothing written while on, off does nothing.
//

import Foundation

@MainActor
enum PulseTrackSwitch {
    static func applied(_ on: Bool) {
        if on {
            Task(priority: .utility) { await PostcardWidgetStore.refresh() }
            // An account change lands here too: the reminder follows this account's own row, not the last one's.
            Task { await YourDayReminder.arm() }
        } else {
            PostcardWidgetStore.clear()
            YourDayReminder.cancel()
        }
    }
}
