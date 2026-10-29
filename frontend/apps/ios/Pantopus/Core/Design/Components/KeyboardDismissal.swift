//
//  KeyboardDismissal.swift
//  Pantopus
//
//  The keyboard goes away the way people expect on every screen (founder
//  request 2026-10-29): a tap anywhere outside the text being typed closes
//  it. The tap still reaches what's under it, so Save or Log in work on the
//  first tap, and a screen left by a tap doesn't bring the keyboard back on
//  return. Composers that keep typing after a tap (chat's Send, a search
//  box's clear button) opt out with `keepsKeyboardOnTap()`; a list under a
//  search box, or a post while its reply is typed, takes only the closing
//  tap with `closesKeyboardFirst`.
//

import SwiftUI
import UIKit

public extension View {
    /// Installs the tap that closes the keyboard in this view's window. Put it
    /// once on the app's root: sheets and full-screen covers share the window.
    func dismissesKeyboardOnTapOutside() -> some View {
        background(KeyboardTapInstaller().frame(width: 0, height: 0).accessibilityHidden(true))
    }

    /// A tap here leaves the keyboard up: a composer's Send, attach and emoji
    /// buttons, a search box's clear button.
    func keepsKeyboardOnTap() -> some View {
        background(KeepsKeyboardRegion().accessibilityHidden(true))
    }

    /// While `isTyping` (the search box above this list has the keyboard), a
    /// tap on the list only closes the keyboard and nothing under the finger
    /// opens; scrolling still scrolls. Put it on the rows inside the scroll
    /// view, not on the scroll view.
    func closesKeyboardFirst(_ isTyping: Bool) -> some View {
        allowsHitTesting(!isTyping)
    }

    /// The same while anything is being typed, for content whose text box
    /// lives elsewhere (a post while its reply is typed). Never put it on a
    /// view that holds the text box itself.
    func closesKeyboardFirst() -> some View {
        modifier(ClosesKeyboardFirstWhileTyping())
    }
}

private struct ClosesKeyboardFirstWhileTyping: ViewModifier {
    func body(content: Content) -> some View {
        content.allowsHitTesting(!TextEditingState.shared.isEditing)
    }
}

/// Whether a text box anywhere in the app is being typed in.
@Observable
@MainActor
final class TextEditingState {
    static let shared = TextEditingState()

    private(set) var isEditing = false

    private init() {
        let center = NotificationCenter.default
        let changes = [
            UITextField.textDidBeginEditingNotification, UITextView.textDidBeginEditingNotification,
            UITextField.textDidEndEditingNotification, UITextView.textDidEndEditingNotification
        ]
        for name in changes {
            // The observers live as long as the app; typing can move straight
            // from one box to another, so ask the responder chain each time.
            _ = center.addObserver(forName: name, object: nil, queue: .main) { _ in
                Task { @MainActor in TextEditingState.shared.refresh() }
            }
        }
    }

    private func refresh() {
        let editing = FirstResponder.current is UITextInput
        if editing != isEditing { isEditing = editing }
    }
}

/// Adds the closing tap to the window this view lands in, once per window.
private struct KeyboardTapInstaller: UIViewRepresentable {
    func makeUIView(context _: Context) -> InstallerView {
        let view = InstallerView()
        view.isUserInteractionEnabled = false
        return view
    }

    func updateUIView(_: InstallerView, context _: Context) {}

    final class InstallerView: UIView {
        override func didMoveToWindow() {
            super.didMoveToWindow()
            if let window { KeyboardTapDismissal.shared.install(in: window) }
        }
    }
}

/// Ends editing on a tap outside any text box. It never cancels or delays the
/// tap, and it only listens while text is being typed in its window.
@MainActor
final class KeyboardTapDismissal: NSObject, UIGestureRecognizerDelegate {
    static let shared = KeyboardTapDismissal()

    private final class ClosingTap: UITapGestureRecognizer {}

    func install(in window: UIWindow) {
        _ = TextEditingState.shared
        guard !(window.gestureRecognizers ?? []).contains(where: { $0 is ClosingTap }) else { return }
        let tap = ClosingTap(target: self, action: #selector(tapped(_:)))
        tap.cancelsTouchesInView = false
        tap.delaysTouchesEnded = false
        tap.delegate = self
        window.addGestureRecognizer(tap)
    }

    @objc private func tapped(_ tap: UITapGestureRecognizer) {
        guard tap.state == .ended else { return }
        tap.view?.endEditing(true)
    }

    func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldReceive touch: UITouch) -> Bool {
        guard let window = gestureRecognizer.view as? UIWindow,
              let editing = FirstResponder.current as? UIView,
              editing is UITextInput,
              editing.window === window else { return false }
        // A tap in a text box places the cursor there or moves typing to it.
        var view = touch.view
        while let current = view, current !== window {
            if current is UITextInput { return false }
            view = current.superview
        }
        return !KeepsKeyboardRegion.contains(touch, in: window)
    }

    func gestureRecognizer(
        _: UIGestureRecognizer,
        shouldRecognizeSimultaneouslyWith _: UIGestureRecognizer
    ) -> Bool {
        true
    }
}

/// The responder the keyboard is typing into, found by asking the responder
/// chain (an action sent to no target goes to the first responder).
@MainActor
private enum FirstResponder {
    weak static var found: UIResponder?

    static var current: UIResponder? {
        found = nil
        UIApplication.shared.sendAction(#selector(UIResponder.pantopusReportFirstResponder), to: nil, from: nil, for: nil)
        return found
    }
}

private extension UIResponder {
    @objc func pantopusReportFirstResponder() {
        FirstResponder.found = self
    }
}

/// An area where a tap leaves the keyboard up. Only touches on this screen
/// count, not ones on a sheet that covers it.
private struct KeepsKeyboardRegion: UIViewRepresentable {
    func makeUIView(context _: Context) -> RegionView {
        RegionView()
    }

    func updateUIView(_: RegionView, context _: Context) {}

    static func contains(_ touch: UITouch, in window: UIWindow) -> Bool {
        RegionView.all.allObjects.contains { region in
            guard region.window === window,
                  region.bounds.contains(touch.location(in: region)),
                  let screen = region.screenView else { return false }
            return touch.view?.isDescendant(of: screen) == true
        }
    }

    final class RegionView: UIView {
        static let all = NSHashTable<RegionView>.weakObjects()

        override init(frame: CGRect) {
            super.init(frame: frame)
            isUserInteractionEnabled = false
            Self.all.add(self)
        }

        @available(*, unavailable)
        required init?(coder _: NSCoder) {
            nil
        }

        /// The root view of the screen this region is drawn in.
        var screenView: UIView? {
            var view: UIView? = superview
            while let current = view {
                if current.next is UIViewController { return current }
                view = current.superview
            }
            return nil
        }
    }
}
