//
//  GuidanceWindow.swift
//  Pantopus
//
//  The cards draw in a window of their own, one level above the app's. A
//  centre card dims the whole screen, bar included, and takes every touch; it
//  also covers a sheet, so the tips list in Help can show a card again over
//  Settings. A pointer's window lets every touch through to the app except on
//  its bubble: a touch anywhere else closes the pointer and still does its
//  usual job (GUIDE spec §1).
//

import SwiftUI
import UIKit

/// The cards' window. While a pointer shows, a touch outside its bubble falls through to the app.
final class GuidanceWindow: UIWindow {
    /// Returns true for a point the app should get instead (pointer only).
    var passesThrough: ((CGPoint, UIEvent?) -> Bool)?

    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        if let passesThrough, passesThrough(point, event) { return nil }
        return super.hitTest(point, with: event)
    }

    /// The app's own window keeps the keyboard and its focus; touches reach this one all the same.
    override var canBecomeKey: Bool {
        false
    }
}

/// What the overlay draws, shared between the presenter and its view.
@Observable
@MainActor
final class GuidanceOverlayModel {
    var presentation: GuidancePresentation?
    /// False while fading in and out.
    var isShown = false
    /// The pointer's bubble, in the window's points (touches there stay in the overlay).
    @ObservationIgnored var bubbleFrame: CGRect?
}

@MainActor
final class GuidanceWindowPresenter {
    static let shared = GuidanceWindowPresenter()

    private var window: GuidanceWindow?
    private var model: GuidanceOverlayModel?
    private var removal: Task<Void, Never>?

    private init() {}

    func show(_ presentation: GuidancePresentation) {
        removal?.cancel()
        removeWindow()
        guard let scene = Self.hostScene() else { return }
        let model = GuidanceOverlayModel()
        model.presentation = presentation
        let host = UIHostingController(rootView: GuidanceOverlayView(model: model))
        host.view.backgroundColor = .clear
        let window = GuidanceWindow(windowScene: scene)
        window.windowLevel = UIWindow.Level(rawValue: UIWindow.Level.normal.rawValue + 1)
        window.rootViewController = host
        if case .pointer = presentation {
            window.passesThrough = { [weak model] point, event in
                guard let model else { return true }
                if let bubble = model.bubbleFrame, bubble.contains(point) { return false }
                // A touch anywhere else closes the pointer; the app still gets it.
                if event?.type == .touches, let shown = model.presentation {
                    Task { @MainActor in GuidanceCenter.shared.close(shown) }
                }
                return true
            }
        } else {
            // VoiceOver stays on the card until it closes.
            host.view.accessibilityViewIsModal = true
        }
        window.isHidden = false
        self.window = window
        self.model = model
        Task { @MainActor in model.isShown = true }
    }

    /// Fades the card out, then takes the window away.
    func hide() {
        guard let model, window != nil else { return }
        model.isShown = false
        window?.passesThrough = { _, _ in true }
        removal = Task { @MainActor [weak self] in
            try? await Task.sleep(for: .milliseconds(200))
            guard !Task.isCancelled else { return }
            self?.removeWindow()
        }
    }

    private func removeWindow() {
        window?.isHidden = true
        window?.rootViewController = nil
        window = nil
        model = nil
    }

    static func hostScene() -> UIWindowScene? {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        return scenes.first { $0.activationState == .foregroundActive } ?? scenes.first
    }

    /// The app's own window (the cards' window is never key).
    static var appWindow: UIWindow? {
        guard let scene = hostScene() else { return nil }
        return scene.windows.first { $0.isKeyWindow && !($0 is GuidanceWindow) }
            ?? scene.windows.first { !($0 is GuidanceWindow) && !$0.isHidden }
    }
}

/// What keeps a card waiting (GUIDE spec §2 "Never covers something else").
@MainActor
enum GuidanceBlockers {
    static func reason(center: GuidanceCenter) -> String? {
        if UIApplication.shared.applicationState != .active { return "a phone question or the app is away" }
        if AppLockManager.shared.isLocked || AppLockManager.shared.isPrompting { return "Face ID" }
        if center.briefingNoticeBusy { return "the daily briefings sheet" }
        if center.sideMenuOpen { return "the side menu" }
        if center.joinedForCardOnScreen { return "the card they joined for" }
        if DeepLinkRouter.shared.pending != nil || center.waitsForLink || center.waitingCardCheck { return "a link that is opening" }
        // A new account's plan may still open, or is open (JOURNEYS section 2, change 3).
        if PlanFirstOpen.shared.deciding || PlanFirstOpen.shared.planId != nil { return "the plan a new account opens on" }
        if AppLockWindowPresenter.isSomethingPresented { return "a sheet or cover" }
        if center.waitsForKeyboard || TextEditingState.shared.isEditing { return "typing" }
        if let window = GuidanceWindowPresenter.appWindow, isScrolling(window) { return "scrolling" }
        return nil
    }

    /// A page is being dragged or is still gliding.
    private static func isScrolling(_ view: UIView) -> Bool {
        if let scroll = view as? UIScrollView, scroll.isDragging || scroll.isDecelerating { return true }
        return view.subviews.contains { !$0.isHidden && isScrolling($0) }
    }
}
