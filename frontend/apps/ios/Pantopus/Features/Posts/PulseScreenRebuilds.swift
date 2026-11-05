//
//  PulseScreenRebuilds.swift
//  Pantopus
//
//  A fold or a turn of the iPhone Duo makes the open Pulse screens anew on the
//  same models (the tab keeps its models through the fold): a post, a post
//  being written. The old screen can leave just before or just after the new
//  one appears, and screens under the open one show for a moment while the
//  new layout rebuilds its stack. A screen that appears while another screen
//  of its model shows, moments after the last one left, or moments after the
//  tab moved its screens to its other layout, is a rebuilt screen, not the
//  reader coming back: its model reads nothing again for it. Coming back later
//  (Back, another tab and back) reads what is out of date, as before, and a
//  pull to refresh always reads.
//

import Foundation

/// The screens showing one model, to tell a rebuilt screen from a return.
@MainActor
final class PulseScreenRebuilds {
    /// How soon after a screen leaves a new one still counts as that screen rebuilt.
    static let window: TimeInterval = 1
    /// How long after the tab moves its screens they count as rebuilt: turned sideways, the two columns lay the post
    /// column out only once the turn is over, more than a second later.
    static let moveWindow: TimeInterval = 3

    private var showing = 0
    private var leftAt: Date?
    private var movedAt: Date?

    func screenDidAppear() {
        showing += 1
    }

    func screenDidDisappear() {
        showing = max(showing - 1, 0)
        leftAt = Date()
    }

    /// The tab that keeps the model moved its screens to its other layout (one stack or two columns).
    func screensMoved() {
        movedAt = Date()
    }

    /// The screen appearing now is a rebuilt one: another screen of the model still shows, one left moments ago, or
    /// the tab moved its screens moments ago.
    var isRebuilding: Bool {
        if showing > 1 { return true }
        let now = Date()
        if let leftAt, now.timeIntervalSince(leftAt) < Self.window { return true }
        if let movedAt, now.timeIntervalSince(movedAt) < Self.moveWindow { return true }
        return false
    }
}
