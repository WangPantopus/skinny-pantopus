//
//  KeyboardDismissal.swift
//  Pantopus
//
//  The keyboard goes away the way people expect on every screen (founder
//  requests 2026-10-29 and 2026-11-05): a tap anywhere outside the text being
//  typed closes it, and so does starting to scroll the page, forms and
//  composers included. The tap still reaches what's under it, so Save, Log in,
//  a switch or a segmented control work on the first tap, and a screen left by
//  a tap doesn't bring the keyboard back on return. A tap anywhere in a field's
//  box types in that field (`typesInFieldOnTap`). Composers that keep typing
//  after a tap or a drag (chat's Send and its thread, a search box's clear
//  button) opt out with `keepsKeyboardOnTap()`; a list under a search box, or a
//  post while its reply is typed, takes only the closing tap with
//  `closesKeyboardFirst`. The keyboard's Done closes it whichever field has it
//  (`Keyboard.close()`). When the keyboard moves (the iPhone Duo folded or
//  turned while typing), the text being typed scrolls back into view.
//

// UIKit comes in through its gesture-recognizer submodule, which lets `ClosingTap` set its own state.
import SwiftUI
import UIKit.UIGestureRecognizerSubclass

public extension View {
    /// Installs the app's keyboard rules in this view's window. Put it once on
    /// the app's root (sheets and full-screen covers share its window), and on
    /// the root of any screen shown in a window of its own.
    func dismissesKeyboardOnTapOutside() -> some View {
        background(KeyboardTapInstaller().frame(width: 0, height: 0).accessibilityHidden(true))
    }

    /// A tap or a drag that starts here leaves the keyboard up: a composer's
    /// Send, attach and emoji buttons, a chat thread (it moves the keyboard
    /// itself), a search box's clear button.
    func keepsKeyboardOnTap() -> some View {
        background(KeepsKeyboardRegion(alsoWhileScrolling: true).accessibilityHidden(true))
    }

    /// The box drawn around a text field: a tap anywhere in it, not only on
    /// the line of text, types in the field (`focus`) rather than closing the
    /// keyboard. Scrolling the page from here still closes it. Put it on the
    /// box, under its background, so the field keeps its own taps.
    func typesInFieldOnTap(_ focus: FocusState<Bool>.Binding) -> some View {
        background {
            Color.clear
                .contentShape(Rectangle())
                .onTapGesture { focus.wrappedValue = true }
                .accessibilityHidden(true)
        }
        .background(KeepsKeyboardRegion(alsoWhileScrolling: false).accessibilityHidden(true))
    }

    /// While `isTyping` (the search box above this list has the keyboard), a
    /// tap on the list only closes the keyboard and nothing under the finger
    /// opens; scrolling still scrolls. Put it on the rows inside the scroll
    /// view, not on the scroll view.
    func closesKeyboardFirst(_ isTyping: Bool) -> some View {
        modifier(ClosesKeyboardFirstWhileTyping(isTyping: isTyping))
    }

    /// The same while anything is being typed, for content whose text box
    /// lives elsewhere (a post while its reply is typed). Never put it on a
    /// view that holds the text box itself.
    func closesKeyboardFirst() -> some View {
        modifier(ClosesKeyboardFirstWhileTyping())
    }
}

/// The keyboard, for controls that put it away themselves.
@MainActor
public enum Keyboard {
    /// Closes the keyboard, whichever text box has it: the Done above the
    /// keyboard, a screen's own Save.
    public static func close() {
        UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
    }
}

private struct ClosesKeyboardFirstWhileTyping: ViewModifier {
    @Environment(\.accessibilityVoiceOverEnabled) private var voiceOverEnabled
    var isTyping: Bool?

    func body(content: Content) -> some View {
        // Disabling hit testing also removes the controls from VoiceOver.
        // Its explicit activation can open a result while the field is focused.
        content.allowsHitTesting(voiceOverEnabled || !(isTyping ?? TextEditingState.shared.isEditing))
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

/// Adds the keyboard rules to the window this view lands in, once per window.
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

/// Closes the keyboard on a tap outside any text box, and when a page starts
/// scrolling under the finger. Neither takes the touch: the tap goes on to its
/// button, row or switch, and the page scrolls as it would. Both only act
/// while text is being typed in that window, and only the page's own scrolling
/// counts, so dragging inside a text box (its text, the cursor, a selection)
/// keeps the keyboard.
@MainActor
final class KeyboardTapDismissal: NSObject, UIGestureRecognizerDelegate {
    static let shared = KeyboardTapDismissal()

    /// The scroll views under the last finger to go down while typing: the
    /// first of them to start scrolling closes the keyboard.
    private let armedPages = NSHashTable<UIScrollView>.weakObjects()
    /// Scroll views whose drag this already follows.
    private let followedPages = NSHashTable<UIPanGestureRecognizer>.weakObjects()

    func install(in window: UIWindow) {
        _ = TextEditingState.shared
        _ = FocusedTextKeeper.shared
        guard !(window.gestureRecognizers ?? []).contains(where: { $0 is ClosingTap }) else { return }
        let tap = ClosingTap(target: nil, action: nil)
        tap.cancelsTouchesInView = false
        tap.delaysTouchesEnded = false
        tap.delegate = self
        tap.onTap = { tap, point in
            // Not if the tap moved typing to another box (a button can).
            guard let editing = tap.editing, FirstResponder.current === editing,
                  let window = tap.view as? UIWindow else { return }
            // Just off a field's line of text is still inside the box drawn around it: the tap types there.
            if let field = Self.textBox(near: point, in: window) {
                if field !== editing { field.becomeFirstResponder() }
                return
            }
            window.endEditing(true)
        }
        window.addGestureRecognizer(tap)
    }

    /// The text box whose line of text is a few points from `point`: a tap in
    /// the margin of a field's box (above or below its text, at its sides).
    private static func textBox(near point: CGPoint, in window: UIWindow) -> UIView? {
        let margins = [CGPoint(x: 0, y: 10), CGPoint(x: 0, y: -10), CGPoint(x: 12, y: 0), CGPoint(x: -12, y: 0)]
        for margin in margins {
            var view = window.hitTest(CGPoint(x: point.x + margin.x, y: point.y + margin.y), with: nil)
            while let current = view, current !== window {
                if current is UITextInput { return current.canBecomeFirstResponder ? current : nil }
                view = current.superview
            }
        }
        return nil
    }

    /// Every touch in the window passes here as it starts, while text is being
    /// typed in it. The tap follows the finger only when it could close the
    /// keyboard; the pages under it are noted either way.
    func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldReceive touch: UITouch) -> Bool {
        armedPages.removeAllObjects()
        guard let tap = gestureRecognizer as? ClosingTap,
              let window = tap.view as? UIWindow,
              let editing = FirstResponder.current as? UIView,
              editing is UITextInput,
              editing.window === window else { return false }
        // A text box under the finger: the outermost one, so its own scrolling
        // (a long note, a field's line of text) isn't taken for the page's.
        var textBox: UIView?
        var view = touch.view
        while let current = view, current !== window {
            if current is UITextInput { textBox = current }
            view = current.superview
        }
        let kept = KeepsKeyboardRegion.kept(touch, in: window)
        if kept != .tapsAndDrags { armPages(around: textBox ?? touch.view, in: window) }
        // A touch in a text box places the cursor or moves typing to it; one
        // in a field's box types in that field.
        guard textBox == nil, kept == nil else { return false }
        tap.editing = editing
        return true
    }

    func gestureRecognizer(
        _: UIGestureRecognizer,
        shouldRecognizeSimultaneouslyWith _: UIGestureRecognizer
    ) -> Bool {
        true
    }

    /// Notes the scroll views around `view`, and follows their drags. A text
    /// box's own scroll views (its text, a field's line) aren't the page.
    private func armPages(around view: UIView?, in window: UIWindow) {
        var current = view is UITextInput ? view?.superview : view
        while let candidate = current, candidate !== window {
            if let page = candidate as? UIScrollView, !(page is UITextView) {
                armedPages.add(page)
                if !followedPages.contains(page.panGestureRecognizer) {
                    followedPages.add(page.panGestureRecognizer)
                    page.panGestureRecognizer.addTarget(self, action: #selector(pageDragChanged(_:)))
                }
            }
            current = candidate.superview
        }
    }

    @objc private func pageDragChanged(_ drag: UIPanGestureRecognizer) {
        guard drag.state == .began, let page = drag.view as? UIScrollView, armedPages.contains(page) else { return }
        armedPages.removeAllObjects()
        guard FirstResponder.current is UITextInput else { return }
        page.window?.endEditing(true)
    }
}

/// Follows one finger from down to up and reports a tap. It never recognizes:
/// UIKit's own controls (a switch, a segmented control) turn away a tap
/// recognizer above them, and nothing should wait on this one.
private final class ClosingTap: UIGestureRecognizer {
    /// What was being typed in when the finger went down.
    weak var editing: UIView?
    /// The tap, and where in the window the finger lifted.
    var onTap: (@MainActor (ClosingTap, CGPoint) -> Void)?

    /// How far a finger may move and still tap, as UIKit's own tap allows.
    private static let slop: CGFloat = 10
    private weak var finger: UITouch?
    private var start = CGPoint.zero

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent) {
        super.touchesBegan(touches, with: event)
        guard finger == nil, touches.count == 1, let touch = touches.first else {
            state = .failed
            return
        }
        finger = touch
        start = touch.location(in: nil)
    }

    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent) {
        super.touchesMoved(touches, with: event)
        guard let finger, touches.contains(finger) else { return }
        let point = finger.location(in: nil)
        if hypot(point.x - start.x, point.y - start.y) > Self.slop { state = .failed }
    }

    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent) {
        super.touchesEnded(touches, with: event)
        guard let finger, touches.contains(finger) else { return }
        onTap?(self, finger.location(in: nil))
        state = .failed
    }

    override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent) {
        super.touchesCancelled(touches, with: event)
        state = .failed
    }

    override func reset() {
        super.reset()
        finger = nil
        editing = nil
    }
}

/// Keeps the text being typed in view when the keyboard moves. SwiftUI scrolls
/// a form to its text box when the keyboard comes up, but not when the screen
/// changes size under it: folding the iPhone Duo to tabletop while typing left
/// the box behind the keyboard, with nothing to show what was typed. Once the
/// keyboard has settled, the scroll view around the box brings the cursor into
/// view; a box already in view doesn't move.
@MainActor
final class FocusedTextKeeper {
    static let shared = FocusedTextKeeper()

    private init() {
        // Lives as long as the app, like the typing observers above.
        _ = NotificationCenter.default.addObserver(
            forName: UIResponder.keyboardDidChangeFrameNotification, object: nil, queue: .main
        ) { _ in
            Task { @MainActor in FocusedTextKeeper.shared.revealTypedText() }
        }
    }

    private func revealTypedText() {
        guard let box = FirstResponder.current as? UIView, let input = box as? UITextInput, box.window != nil else {
            return
        }
        // A one-line field shows whole; in a longer text view, the line being typed.
        var target = box.bounds
        if box is UITextView, let selection = input.selectedTextRange {
            target = input.caretRect(for: selection.end).insetBy(dx: 0, dy: -Spacing.s3)
        }
        var view = box.superview
        while let current = view {
            if let scrollView = current as? UIScrollView, !(current is UITextView), scrollView.isScrollEnabled {
                scrollView.scrollRectToVisible(
                    box.convert(target, to: scrollView).insetBy(dx: 0, dy: -Spacing.s2),
                    animated: true
                )
                return
            }
            view = current.superview
        }
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

/// An area where a tap leaves the keyboard up, and with `alsoWhileScrolling`
/// a drag too. Only touches on this screen count, not ones on a sheet that
/// covers it.
private struct KeepsKeyboardRegion: UIViewRepresentable {
    let alsoWhileScrolling: Bool

    enum Kept {
        /// A field's box: a tap types in it, a drag scrolls the page.
        case taps
        /// A composer's controls, a thread that moves the keyboard itself.
        case tapsAndDrags
    }

    func makeUIView(context _: Context) -> RegionView {
        RegionView()
    }

    func updateUIView(_ view: RegionView, context _: Context) {
        view.alsoWhileScrolling = alsoWhileScrolling
    }

    /// What the regions under `touch` keep; nil when it's in none.
    static func kept(_ touch: UITouch, in window: UIWindow) -> Kept? {
        var kept: Kept?
        for region in RegionView.all.allObjects {
            guard region.window === window,
                  region.bounds.contains(touch.location(in: region)),
                  let screen = region.screenView,
                  touch.view?.isDescendant(of: screen) == true else { continue }
            if region.alsoWhileScrolling { return .tapsAndDrags }
            kept = .taps
        }
        return kept
    }

    final class RegionView: UIView {
        static let all = NSHashTable<RegionView>.weakObjects()

        var alsoWhileScrolling = true

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
