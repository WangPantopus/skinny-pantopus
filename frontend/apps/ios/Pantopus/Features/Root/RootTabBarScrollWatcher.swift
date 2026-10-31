//
//  RootTabBarScrollWatcher.swift
//  Pantopus
//
//  The tab bar steps aside while you read (founder request 2026-10-30):
//  scrolling down a page slides it away and scrolling up brings it back,
//  after the same 12 points as the Pulse header's quick return, so on Pulse
//  the two go and come back together. It also comes back at the top and the
//  end of the page, on another tab or page, and when the page that sent it
//  away closes or another screen opens over it. Only pages that run under the bar send
//  it away: a chat's thread ends above its composer, and a page with its own
//  bar at the bottom (a letter's Counter, Vault and Shred) would leave that
//  bar over an empty band, so both keep it. `RootTabBar` keeps it in place
//  while VoiceOver or Switch Control is on.
//

import UIKit

/// Watches the page being scrolled in `RootTabContainer` and sets
/// `RootTabModel.barScrolledAway`. The page is the scroll view under the
/// finger when a touch starts, noted by a recognizer that never takes a
/// touch, so every gesture and control works as before.
@MainActor
final class RootTabBarScrollWatcher: NSObject, UIGestureRecognizerDelegate {
    /// Scrolling this far down sends the bar away, and this far up brings
    /// it back (the Pulse header's `PulseHeaderQuickReturn` distances).
    static let travelToMove: CGFloat = 12
    /// A page that scrolls less than this keeps the bar: there's little
    /// under it to uncover.
    static let minimumScroll: CGFloat = 120
    /// A page fills at least this share of the tab's height: a row of
    /// chips, a card's carousel or a text box isn't one.
    static let pageShare: CGFloat = 0.4

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
    /// Travel in the current direction: > 0 down the page, < 0 up.
    private var travel: CGFloat = 0
    /// A change on its way to the model (sent on the next turn).
    private var pendingAway: Bool?

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
        // Another page than the one that sent the bar away: it comes back.
        setAway(false)
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
        travel = 0
    }

    private func scrolled(_ scrollView: UIScrollView) {
        guard scrollView === page, barHeight > 0 else { return }
        let fromTop = scrollView.contentOffset.y + scrollView.adjustedContentInset.top
        let range = Self.scrollRange(of: scrollView)
        let offset = min(max(fromTop, 0), range)
        defer { lastOffset = offset }
        // At the top of the page, or pulled down past it (to refresh).
        if fromTop <= 0.5 {
            setAway(false)
            return
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
            // Not in the last few points, where it would only come back.
            if !isAway, range >= Self.minimumScroll, range - offset > Self.travelToMove, !UIAccessibility.isVoiceOverRunning,
               !UIAccessibility.isSwitchControlRunning, !hasOwnBottomBar(scrollView) {
                setAway(true)
            } else {
                travel = 0
            }
        } else if travel <= -Self.travelToMove {
            setAway(false)
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
    /// screen closed): the bar comes back.
    private func pageLeftIfGone() {
        if let page, page.window != nil { return }
        stopWatching()
        setAway(false)
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
