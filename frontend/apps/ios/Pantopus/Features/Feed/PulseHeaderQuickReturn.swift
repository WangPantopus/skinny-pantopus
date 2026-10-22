//
//  PulseHeaderQuickReturn.swift
//  Pantopus
//
//  The Pulse header's quick return (founder request 2026-10-22): as in
//  Facebook, scrolling down far enough slides the header away and
//  scrolling up brings it back. Dragging the map counts as scrolling.
//

import CoreGraphics

/// Tracks scroll travel for the Pulse header. A class that nothing observes,
/// so the per-frame bookkeeping doesn't redraw the feed: only a change of
/// `isHidden`, which `FeedView` copies into its state, does.
@MainActor
final class PulseHeaderQuickReturn {
    private(set) var isHidden = false
    /// Travel in the current direction: > 0 scrolling down, < 0 up.
    private var travel: CGFloat = 0
    private var lastListOffset: CGFloat?

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

    /// Shows the header and forgets the travel so far.
    func reset() {
        isHidden = false
        travel = 0
        lastListOffset = nil
    }

    private func set(hidden: Bool) -> Bool {
        isHidden = hidden
        travel = 0
        return hidden
    }
}
