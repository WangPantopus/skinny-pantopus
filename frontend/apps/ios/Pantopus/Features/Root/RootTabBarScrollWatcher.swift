//
//  RootTabBarScrollWatcher.swift
//  Pantopus
//
//  The tab bar steps aside while you read (founder request 2026-10-30):
//  scrolling down a page slides it away and scrolling up brings it back,
//  after 12 points. On Pulse the header goes with it but comes back only at
//  the top of the feed. It also comes back at the top and the
//  end of the page, on another tab or page, and when the page that sent it
//  away closes or another screen opens over it. Only pages that run under the bar send
//  it away: a chat beside the list has its thread end above its composer, and a
//  page with its own bar at the bottom (a letter's Counter, Vault and Shred)
//  would leave that bar over an empty band, so both keep it. A chat that is the
//  whole screen has no bar at all (`hidesTabBar`). `RootTabBar` keeps it in place
//  while VoiceOver or Switch Control is on.
//
//  Every screen's header goes the same way (founder request 2026-11-07): on
//  the same pages, scrolling down past the top slides it away, and it stays
//  away until the reader is back near the top of the page (another page, tab
//  or screen brings it back too). The headers that do are the stacks' system
//  bar and the headers drawn above a page (`ScrollAwayHeader.swift`).
//

import SwiftUI
import UIKit

/// Watches the page being scrolled in `RootTabContainer` and sets
/// `RootTabModel.barScrolledAway` and `headerAwayScreen`. The page is the
/// scroll view under the finger when a touch starts, noted by a recognizer
/// that never takes a touch, so every gesture and control works as before.
@MainActor
final class RootTabBarScrollWatcher: NSObject, UIGestureRecognizerDelegate {
    /// Scrolling this far down sends the bar away, and this far up brings
    /// it back.
    static let travelToMove: CGFloat = 12
    /// A page that scrolls less than this keeps the bar: there's little
    /// under it to uncover.
    static let minimumScroll: CGFloat = 120
    /// A page fills at least this share of the tab's height: a row of
    /// chips, a card's carousel or a text box isn't one.
    static let pageShare: CGFloat = 0.4
    /// The header slides away only this far down the page, so the top of a
    /// page reads with its header and a short scroll doesn't flap it.
    static let headerHideOffset: CGFloat = 120
    /// Back within this of the top of the page, the header comes back: about
    /// a header's height, so it's there before the page's first line is.
    static let headerReturnZone: CGFloat = 44

    /// The tabs' model, where the bar reads whether it's away.
    weak var tabs: RootTabModel?
    /// How far the bar reaches up from the bottom of the tabs, safe area
    /// included; 0 while a screen hides the bar, and nothing is watched.
    var barHeight: CGFloat = 0 {
        didSet { if barHeight == 0 { stopWatching() } }
    }

    private weak var container: UIView?
    private weak var page: UIScrollView?
    private var offsetObservation: NSKeyValueObservation?
    private let sentinel = PageSentinel()
    /// The page's last offset from its top, rubber band left out.
    private var lastOffset: CGFloat?
    /// The page's top inset at that offset: a header sliding away or back
    /// changes it, which moves the page's top without a scroll.
    private var lastTopInset: CGFloat?
    /// The room the page's headers take above its first line, the most seen
    /// on this page: the header goes only once the page is past it, so the
    /// room it leaves doesn't bring the page back to its top and the header
    /// with it.
    private var headerRoom: CGFloat = 0
    /// Travel in the current direction: > 0 down the page, < 0 up.
    private var travel: CGFloat = 0
    /// A change on its way to the model (sent on the next turn).
    private var pendingAway: Bool?
    /// The same for the header: the screen whose header goes, or nil for back.
    private var pendingHeader: HeaderChange?

    private struct HeaderChange {
        let screen: ObjectIdentifier?
    }

    private final class TouchProbe: UIGestureRecognizer {}

    func install(on view: UIView) {
        container = view
        let probe = TouchProbe(target: nil, action: nil)
        probe.delegate = self
        view.addGestureRecognizer(probe)
        sentinel.onLeaveWindow = { [weak self] in
            // After UIKit has finished moving the page's views.
            Task { @MainActor [weak self] in self?.pageLeftIfGone() }
        }
    }

    /// Every touch on the tabs passes here as it starts: note the page under
    /// it, and leave the touch to everything else.
    func gestureRecognizer(_: UIGestureRecognizer, shouldReceive touch: UITouch) -> Bool {
        touchBegan(in: touch.view)
        return false
    }

    private func touchBegan(in view: UIView?) {
        guard barHeight > 0, let container, let found = scrollingPage(around: view, in: container), found !== page else {
            return
        }
        watch(found)
        // Another page than the one that sent the bar away: it comes back,
        // and so does the header.
        setAway(false)
        setHeaderAway(false)
    }

    /// The nearest scroll view around `view` that pages up and down under
    /// the bar.
    private func scrollingPage(around view: UIView?, in container: UIView) -> UIScrollView? {
        let barTop = container.bounds.maxY - barHeight
        var current = view
        while let candidate = current, candidate !== container {
            if let scrollView = candidate as? UIScrollView, !(scrollView is UITextView), scrollView.isScrollEnabled,
               scrollView.alwaysBounceVertical || Self.scrollRange(of: scrollView) > 0 {
                let frame = scrollView.convert(scrollView.bounds, to: container)
                if frame.height >= container.bounds.height * Self.pageShare, frame.maxY > barTop + 1 {
                    return scrollView
                }
            }
            current = candidate.superview
        }
        return nil
    }

    private static func scrollRange(of scrollView: UIScrollView) -> CGFloat {
        let inset = scrollView.adjustedContentInset
        return max(0, scrollView.contentSize.height + inset.top + inset.bottom - scrollView.bounds.height)
    }

    private func watch(_ scrollView: UIScrollView) {
        stopWatching()
        page = scrollView
        scrollView.insertSubview(sentinel, at: 0)
        offsetObservation = scrollView.observe(\.contentOffset, options: [.new]) { [weak self] scrollView, _ in
            MainActor.assumeIsolated { self?.scrolled(scrollView) }
        }
    }

    private func stopWatching() {
        offsetObservation?.invalidate()
        offsetObservation = nil
        sentinel.removeFromSuperview()
        page = nil
        lastOffset = nil
        lastTopInset = nil
        headerRoom = 0
        travel = 0
    }

    /// From the top of the tabs' safe area (under the status bar) to where
    /// the page's first line sits at its top: the headers above it.
    private func topRoom(of scrollView: UIScrollView) -> CGFloat {
        guard let container else { return 0 }
        let frameTop = scrollView.convert(scrollView.bounds, to: container).minY
        return max(0, frameTop + scrollView.adjustedContentInset.top - container.safeAreaInsets.top)
    }

    private func scrolled(_ scrollView: UIScrollView) {
        guard scrollView === page, barHeight > 0 else { return }
        let topInset = scrollView.adjustedContentInset.top
        let fromTop = scrollView.contentOffset.y + topInset
        let range = Self.scrollRange(of: scrollView)
        let offset = min(max(fromTop, 0), range)
        headerRoom = max(headerRoom, topRoom(of: scrollView))
        // A header sliding away or back moves the top of the page: that's no
        // scroll of the person's, so the next move counts from here.
        defer { lastOffset = offset }
        if let lastTopInset, abs(topInset - lastTopInset) > 0.5 {
            self.lastTopInset = topInset
            travel = 0
            return
        }
        lastTopInset = topInset
        // At the top of the page, or pulled down past it (to refresh).
        if fromTop <= 0.5 {
            setAway(false)
            setHeaderAway(false)
            return
        }
        // Back near the top, however it got there: the header comes back.
        if fromTop <= Self.headerReturnZone {
            setHeaderAway(false)
        }
        // Only the person's scrolling moves the bar, not a page settling or
        // jumping to a row by itself.
        guard let last = lastOffset, scrollView.isTracking || scrollView.isDragging || scrollView.isDecelerating else {
            return
        }
        // At the end of the page there's nothing left to uncover: the bar
        // comes back into the room the page leaves it, as Safari's does.
        if offset >= range - 0.5 {
            setAway(false)
            return
        }
        let delta = offset - last
        guard delta != 0 else { return }
        if (delta > 0) != (travel > 0) { travel = 0 }
        travel += delta
        if travel >= Self.travelToMove {
            scrolledDown(scrollView, fromTop: fromTop, offset: offset, range: range)
        } else if travel <= -Self.travelToMove {
            setAway(false)
        }
    }

    /// The person has scrolled the page down a step.
    private func scrolledDown(_ scrollView: UIScrollView, fromTop: CGFloat, offset: CGFloat, range: CGFloat) {
        let assisted = UIAccessibility.isVoiceOverRunning || UIAccessibility.isSwitchControlRunning
        // Past the top of the page (and its headers' room): the header goes,
        // and comes back only near the top, not on the way up as the bar does.
        let hideAt = max(Self.headerHideOffset, headerRoom + Self.headerReturnZone + Self.travelToMove)
        if fromTop >= hideAt, range >= Self.minimumScroll, !assisted {
            setHeaderAway(true)
        }
        // Not in the last few points, where it would only come back.
        if !isAway, range >= Self.minimumScroll, range - offset > Self.travelToMove, !assisted, !hasOwnBottomBar(scrollView) {
            setAway(true)
        } else {
            travel = 0
        }
    }

    /// The screen keeps its own bar just above the tab bar (a letter's
    /// actions shelf, a composer): what's there isn't the page scrolling.
    private func hasOwnBottomBar(_ scrollView: UIScrollView) -> Bool {
        guard let container else { return false }
        let justAbove = CGPoint(x: container.bounds.midX, y: container.bounds.maxY - barHeight - 4)
        guard let found = container.hitTest(justAbove, with: nil) else { return false }
        return !found.isDescendant(of: scrollView)
    }

    /// The page left the screen (another screen opened over it, its tab or
    /// screen closed): the bar and the header come back.
    private func pageLeftIfGone() {
        if let page, page.window != nil { return }
        stopWatching()
        setAway(false)
        setHeaderAway(false)
    }

    private var isAway: Bool {
        pendingAway ?? tabs?.barScrolledAway ?? false
    }

    private func setAway(_ away: Bool) {
        travel = 0
        guard away != isAway else { return }
        pendingAway = away
        // On the next turn: never while SwiftUI is updating the tabs.
        Task { @MainActor [weak self] in
            guard let self, let away = pendingAway else { return }
            pendingAway = nil
            if let tabs, tabs.barScrolledAway != away { tabs.barScrolledAway = away }
        }
    }

    private var isHeaderAway: Bool {
        if let pendingHeader { return pendingHeader.screen != nil }
        return tabs?.headerAwayScreen != nil
    }

    private func setHeaderAway(_ away: Bool) {
        guard away != isHeaderAway else { return }
        // Only the header of the screen this page is on goes: a screen pushed
        // over it, or a sheet, starts with its own.
        let screen = away ? page?.screenID : nil
        guard !away || screen != nil else { return }
        pendingHeader = HeaderChange(screen: screen)
        // On the next turn, as the bar's; animated, so the page takes the
        // header's room as it goes (faded with Reduce Motion, as the bar).
        Task { @MainActor [weak self] in
            guard let self, let change = pendingHeader else { return }
            pendingHeader = nil
            guard let tabs, tabs.headerAwayScreen != change.screen else { return }
            let animation: Animation = UIAccessibility.isReduceMotionEnabled
                ? .easeInOut(duration: 0.2) : .snappy(duration: 0.3)
            withAnimation(animation) { tabs.headerAwayScreen = change.screen }
        }
    }
}

/// A hidden view inside the watched page that reports the page leaving the
/// window: another screen pushed over it, or its tab or screen closed.
private final class PageSentinel: UIView {
    var onLeaveWindow: (@MainActor () -> Void)?

    override init(frame: CGRect) {
        super.init(frame: frame)
        isHidden = true
        isUserInteractionEnabled = false
        accessibilityElementsHidden = true
    }

    @available(*, unavailable)
    required init?(coder _: NSCoder) {
        nil
    }

    override func didMoveToWindow() {
        super.didMoveToWindow()
        // The page left with this inside it, not this taken out of the page.
        if window == nil, superview != nil { onLeaveWindow?() }
    }
}
