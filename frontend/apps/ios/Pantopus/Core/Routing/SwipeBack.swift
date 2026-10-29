//
//  SwipeBack.swift
//  Pantopus
//
//  Swipe from the left edge to go back, the screen following the finger as
//  in Settings or Mail (founder request 2026-10-29). The stacks hide UIKit's
//  navigation bar and draw their own top bars, and UIKit's edge swipe won't
//  start while its bar is hidden, so no screen went back with a swipe.
//  `swipesBackFromEdge()` on a stack's root lets that stack's edge swipe
//  start whenever a screen is behind the top one; `swipeBackDisabled(_:)`
//  keeps it off on a screen while its own Back asks first (unsaved typing),
//  goes back a step inside the screen, or isn't there at all.
//

import SwiftUI
import UIKit

extension View {
    /// Lets the screens pushed on the enclosing NavigationStack go back with
    /// a swipe from the left edge. Apply once, to the stack's root view
    /// (inside the NavigationStack).
    func swipesBackFromEdge() -> some View {
        background(SwipeBackStackProbe())
    }

    /// Keeps the edge swipe off on this pushed screen while `disabled`, as
    /// `interactiveDismissDisabled` does for a sheet's swipe down: the
    /// screen's own Back stays the way out.
    func swipeBackDisabled(_ disabled: Bool = true) -> some View {
        background(SwipeBackScreenProbe(isDisabled: disabled))
    }
}

/// Finds the stack around the root view once it is in a window.
private struct SwipeBackStackProbe: UIViewRepresentable {
    func makeUIView(context _: Context) -> SwipeBackStackView {
        let view = SwipeBackStackView()
        view.isHidden = true
        view.isUserInteractionEnabled = false
        return view
    }

    func updateUIView(_: SwipeBackStackView, context _: Context) {}
}

private final class SwipeBackStackView: UIView {
    override func didMoveToWindow() {
        super.didMoveToWindow()
        guard window != nil, let navigation = owningController?.navigationController else { return }
        SwipeBackGesture.install(on: navigation)
    }
}

/// Marks the pushed screen it sits in while the swipe is to stay off.
private struct SwipeBackScreenProbe: UIViewRepresentable {
    let isDisabled: Bool

    func makeUIView(context _: Context) -> SwipeBackScreenView {
        let view = SwipeBackScreenView()
        view.isHidden = true
        view.isUserInteractionEnabled = false
        return view
    }

    func updateUIView(_ view: SwipeBackScreenView, context _: Context) {
        view.keepsSwipeOff = isDisabled
    }
}

private final class SwipeBackScreenView: UIView {
    var keepsSwipeOff = false

    /// Whether a probe in this screen's views keeps the swipe off.
    static func isSwipeOff(in view: UIView) -> Bool {
        if let probe = view as? SwipeBackScreenView { return probe.keepsSwipeOff }
        return view.subviews.contains { isSwipeOff(in: $0) }
    }
}

/// The edge swipe's delegate on a stack whose root asked for it. The swipe
/// starts only with a screen to go back to, no push or pop under way (a
/// swipe then would leave the stack out of step with its path), and no
/// probe on the top screen keeping it off. The recognizer holds its
/// delegate weakly, so the stack keeps this one for as long as it lives.
@MainActor
private final class SwipeBackGesture: NSObject, UIGestureRecognizerDelegate {
    private static var ownerKey: UInt8 = 0
    private weak var navigation: UINavigationController?

    private init(navigation: UINavigationController) {
        self.navigation = navigation
    }

    static func install(on navigation: UINavigationController) {
        guard let recognizer = navigation.interactivePopGestureRecognizer,
              !(recognizer.delegate is SwipeBackGesture) else { return }
        let delegate = SwipeBackGesture(navigation: navigation)
        objc_setAssociatedObject(navigation, &ownerKey, delegate, .OBJC_ASSOCIATION_RETAIN_NONATOMIC)
        recognizer.delegate = delegate
    }

    func gestureRecognizerShouldBegin(_: UIGestureRecognizer) -> Bool {
        guard let navigation, navigation.viewControllers.count > 1, navigation.transitionCoordinator == nil,
              let screen = navigation.topViewController?.viewIfLoaded else { return false }
        return !SwipeBackScreenView.isSwipeOff(in: screen)
    }
}

private extension UIView {
    /// The view controller whose view holds this one.
    var owningController: UIViewController? {
        var responder = next
        while let current = responder {
            if let controller = current as? UIViewController { return controller }
            responder = current.next
        }
        return nil
    }
}
