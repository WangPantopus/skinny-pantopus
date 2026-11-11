//
//  MomentsMapFinger.swift
//  Pantopus
//
//  A finger moving the Moments map (founder, 2026-11-11: "for the tab bar
//  down below, we can hide it while users scrolling in the map"). While a
//  finger pans or pinches the map the tab bar slides away, as it does while a
//  page scrolls (`RootTabBarScrollWatcher`), and it comes back by itself
//  about a second after the map stops. A swipe up from the bottom edge is
//  the phone's own Home gesture, so nothing has to be learned to wake it.
//  The map also learns that it was moved by hand, which closes a crowded
//  spot once its bubble has split (`MomentsMapViewModel.closeSpotIfSplit`).
//
//  The touches are watched by a recognizer on the window that never takes
//  one, so the map's own gestures, its pins and everything over it work as
//  before.
//

import MapKit
import SwiftUI
import UIKit.UIGestureRecognizerSubclass

extension View {
    /// On the Moments map's `Map`: `hidesBar` slides the tab bar away while a finger moves the map (phones);
    /// `onTouch` is told of every touch on the map itself.
    func watchesFingerOnMap(hidesBar: Bool, onTouch: @escaping @MainActor () -> Void) -> some View {
        modifier(MomentsMapFingerWatch(hidesBar: hidesBar, onTouch: onTouch))
    }
}

private struct MomentsMapFingerWatch: ViewModifier {
    let hidesBar: Bool
    let onTouch: @MainActor () -> Void
    @Environment(RootTabModel.self) private var rootTabs: RootTabModel?
    @State private var bar = MomentsMapBarStepper()

    func body(content: Content) -> some View {
        content
            // While the map glides on after the finger lifts, it is still moving: the bar waits for it to stop.
            .onMapCameraChange(frequency: .continuous) { _ in bar.mapMoved() }
            .background {
                MomentsMapTouchReader(
                    onTouch: onTouch,
                    onMove: { if hidesBar { bar.fingerMoves(tabs: rootTabs) } },
                    onLift: { bar.fingerLifted() }
                )
                .allowsHitTesting(false)
                .accessibilityHidden(true)
            }
            .onDisappear { bar.comeBackNow() }
    }
}

/// Sends the tab bar away while a finger moves the map and brings it back once the map has been still a second.
@MainActor
private final class MomentsMapBarStepper {
    /// The map has been still this long with no finger on it: the bar comes back.
    static let stillSeconds = 1.0

    private weak var tabs: RootTabModel?
    private var fingerDown = false
    private var lastMotion = Date()
    private var comeBack: Task<Void, Never>?

    func fingerMoves(tabs: RootTabModel?) {
        self.tabs = tabs
        fingerDown = true
        comeBack?.cancel()
        comeBack = nil
        if let tabs, !tabs.barScrolledAway { tabs.barScrolledAway = true }
    }

    func fingerLifted() {
        guard fingerDown else { return }
        fingerDown = false
        lastMotion = Date()
        waitForStill()
    }

    func mapMoved() {
        if !fingerDown, comeBack != nil { lastMotion = Date() }
    }

    func comeBackNow() {
        comeBack?.cancel()
        comeBack = nil
        fingerDown = false
        if let tabs, tabs.barScrolledAway { tabs.barScrolledAway = false }
    }

    private func waitForStill() {
        comeBack?.cancel()
        comeBack = Task { [weak self] in
            while let self, !Task.isCancelled {
                let left = Self.stillSeconds - Date().timeIntervalSince(lastMotion)
                if left <= 0 {
                    comeBack = nil
                    comeBackNow()
                    return
                }
                try? await Task.sleep(for: .seconds(left))
            }
        }
    }
}

/// Puts the touch watcher on the window while the map is in it.
private struct MomentsMapTouchReader: UIViewRepresentable {
    let onTouch: @MainActor () -> Void
    let onMove: @MainActor () -> Void
    let onLift: @MainActor () -> Void

    func makeUIView(context _: Context) -> Anchor {
        Anchor()
    }

    func updateUIView(_ view: Anchor, context _: Context) {
        view.watcher.onTouch = onTouch
        view.watcher.onMove = onMove
        view.watcher.onLift = onLift
    }

    final class Anchor: UIView {
        let watcher = MomentsMapTouchWatcher()
        private weak var watched: UIWindow?

        override func didMoveToWindow() {
            super.didMoveToWindow()
            guard window !== watched else { return }
            watched?.removeGestureRecognizer(watcher)
            watcher.letGo()
            watched = window
            window?.addGestureRecognizer(watcher)
        }
    }
}

/// Watches the touches that land on a map and never recognizes: every other gesture works as if it weren't there.
private final class MomentsMapTouchWatcher: UIGestureRecognizer, UIGestureRecognizerDelegate {
    /// A finger that travels this far is moving the map, not tapping it.
    static let moveDistance: CGFloat = 10

    var onTouch: (@MainActor () -> Void)?
    var onMove: (@MainActor () -> Void)?
    var onLift: (@MainActor () -> Void)?
    private var starts: [ObjectIdentifier: CGPoint] = [:]
    private var moving = false

    init() {
        super.init(target: nil, action: nil)
        cancelsTouchesInView = false
        delaysTouchesBegan = false
        delaysTouchesEnded = false
        delegate = self
    }

    /// Only touches on the map itself (its pins are inside it); the buttons and the row over it aren't.
    func gestureRecognizer(_: UIGestureRecognizer, shouldReceive touch: UITouch) -> Bool {
        var view = touch.view
        while let current = view {
            if current is MKMapView { return true }
            view = current.superview
        }
        return false
    }

    func gestureRecognizer(_: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith _: UIGestureRecognizer) -> Bool {
        true
    }

    override func canPrevent(_: UIGestureRecognizer) -> Bool {
        false
    }

    override func canBePrevented(by _: UIGestureRecognizer) -> Bool {
        false
    }

    override func touchesBegan(_ touches: Set<UITouch>, with _: UIEvent) {
        for touch in touches {
            starts[ObjectIdentifier(touch)] = touch.location(in: nil)
        }
        onTouch?()
        // Two fingers down is a pinch: the map is being moved.
        if starts.count > 1 { startMoving() }
    }

    override func touchesMoved(_ touches: Set<UITouch>, with _: UIEvent) {
        guard !moving else { return }
        for touch in touches {
            guard let start = starts[ObjectIdentifier(touch)] else { continue }
            let now = touch.location(in: nil)
            if hypot(now.x - start.x, now.y - start.y) >= Self.moveDistance {
                startMoving()
                return
            }
        }
    }

    override func touchesEnded(_ touches: Set<UITouch>, with _: UIEvent) {
        lifted(touches)
    }

    override func touchesCancelled(_ touches: Set<UITouch>, with _: UIEvent) {
        lifted(touches)
    }

    override func reset() {
        super.reset()
        letGo()
    }

    /// Every finger is up (or the map left the window): what was moving has been let go.
    func letGo() {
        starts.removeAll()
        guard moving else { return }
        moving = false
        onLift?()
    }

    private func startMoving() {
        moving = true
        onMove?()
    }

    private func lifted(_ touches: Set<UITouch>) {
        for touch in touches {
            starts.removeValue(forKey: ObjectIdentifier(touch))
        }
        onTouch?()
        guard starts.isEmpty else { return }
        letGo()
        state = .failed
    }
}
