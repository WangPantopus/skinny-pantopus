//
//  PulseHeaderQuickReturn.swift
//  Pantopus
//
//  The Pulse header's quick return (founder request 2026-10-22): as in
//  Facebook, scrolling down far enough slides the header away and
//  scrolling up brings it back. Dragging the map counts as scrolling, and
//  over the map the header itself can be flicked up out of the way.
//

import CoreGraphics
import Foundation

/// Tracks scroll travel for the Pulse header. A class that nothing observes,
/// so the per-frame bookkeeping doesn't redraw the feed: only a change of
/// `isHidden`, which `FeedView` copies into its state, does.
@MainActor
final class PulseHeaderQuickReturn {
    /// Upward travel of a drag on the header that tucks it away.
    static let flickHideAfter: CGFloat = 24
    /// A quicker flick tucks it away sooner: once it has gone this far and
    /// is heading for `flickPredictedTravel`.
    static let flickMinimum: CGFloat = 10
    static let flickPredictedTravel: CGFloat = 96

    /// How long after a flick a chip's tap is taken to be the flick's.
    static let flickTapGuard: TimeInterval = 0.6

    private(set) var isHidden = false
    /// Travel in the current direction: > 0 scrolling down, < 0 up.
    private var travel: CGFloat = 0
    private var lastListOffset: CGFloat?
    /// The drag on the header under way: where it started (a new start is
    /// a new drag) and whether it went up or down rather than sideways.
    private var headerDragStart: CGPoint?
    private var headerDragIsVertical = false
    /// When the header was last flicked away.
    private var flickedAt: Date?

    /// Just after a flick: a chip the flick started on can still be handed
    /// the touch as the finger lifts, and that isn't a tap.
    var justFlicked: Bool {
        guard let flickedAt else { return false }
        return Date().timeIntervalSince(flickedAt) < Self.flickTapGuard
    }

    /// The content moved `delta` points up (negative: down). Returns the new
    /// hidden state when this move changes it.
    func scroll(by delta: CGFloat, hideAfter: CGFloat, showAfter: CGFloat) -> Bool? {
        guard delta != 0 else { return nil }
        if (delta > 0) != (travel > 0) { travel = 0 }
        travel += delta
        if !isHidden, travel >= hideAfter {
            return set(hidden: true)
        }
        if isHidden, travel <= -showAfter {
            return set(hidden: false)
        }
        return nil
    }

    /// The list scrolled to `offset` (0 at the top). Near the top the
    /// header always shows.
    func listScrolled(to offset: CGFloat, nearTop: CGFloat) -> Bool? {
        defer { lastListOffset = offset }
        guard let last = lastListOffset else { return nil }
        if offset < nearTop {
            return isHidden ? set(hidden: false) : nil
        }
        return scroll(by: offset - last, hideAfter: 12, showAfter: 12)
    }

    /// The header itself is being dragged (Map mode): the finger has moved
    /// `translation` from `start` and is heading for `predicted`. Returns
    /// true when that tucks it away: 24 points up, or a quick flick up. A
    /// drag that starts sideways (a chip row scrolling) never does.
    func headerDragged(from start: CGPoint, translation: CGSize, predicted: CGSize) -> Bool {
        if start != headerDragStart {
            headerDragStart = start
            headerDragIsVertical = abs(translation.height) > abs(translation.width)
        }
        guard headerDragIsVertical, !isHidden else { return false }
        return translation.height <= -Self.flickHideAfter
            || (translation.height <= -Self.flickMinimum && predicted.height <= -Self.flickPredictedTravel)
    }

    /// The drag on the header ended: the next one decides its own way.
    func headerDragEnded() {
        headerDragStart = nil
    }

    /// Hides the header now (it was flicked away); a later drag or scroll
    /// counts its travel from here.
    func hide() {
        isHidden = true
        travel = 0
        headerDragStart = nil
        flickedAt = Date()
    }

    /// Shows the header and forgets the travel so far.
    func reset() {
        isHidden = false
        travel = 0
        lastListOffset = nil
        headerDragStart = nil
    }

    private func set(hidden: Bool) -> Bool {
        isHidden = hidden
        travel = 0
        return hidden
    }
}
