//
//  MomentsWatchSession.swift
//  Pantopus
//
//  Watching, held by whoever opened it, above the screen that shows it. On
//  the iPhone Duo a fold moves the window between screens: SwiftUI can take
//  the viewer down and build it again, and on the open Duo the Moment moves
//  between a full-screen cover and a card beside the map. Everything a fold
//  must keep lives here: the Moment and the second it's at, the queue, a
//  half-typed reply, whether the reactions or Seen by are open, and whether
//  the reply box had the keyboard. It stops only when the person closes it.
//

import Foundation
import Observation

@Observable
@MainActor
final class MomentsWatchSession: Identifiable {
    let id = UUID()
    let model: MomentsViewerModel
    /// The reply being typed: a fold keeps the words.
    var replyText = ""
    var showsReactions = false
    var showsSeenBy = false
    /// The reply box has the keyboard (as far as the screen showing it last said).
    @ObservationIgnored var replyFocused = false
    /// When the reply box lost the keyboard without being closed: closing or half folding the Duo takes the
    /// keyboard just before the screen is rebuilt, so a screen that comes within a second gives it back.
    @ObservationIgnored var replyFocusDropped: Date?

    init(request: MomentsWatchRequest, onWatched: @escaping @MainActor (Set<String>) -> Void) {
        model = MomentsViewerModel(request: request, onWatched: onWatched)
    }

    /// The reply box had the keyboard a moment ago and nobody closed it: a fold took it.
    var wantsReplyFocusBack: Bool {
        guard let dropped = replyFocusDropped else { return false }
        return Date().timeIntervalSince(dropped) < 1
    }

    /// The person closed the reply (sent it, tapped away, chose a reaction): nothing to give back.
    func replyClosed() {
        replyFocused = false
        replyFocusDropped = nil
    }

    /// The real close: the viewer stops (a screen going away never stops it).
    func end() {
        model.stop()
    }
}
