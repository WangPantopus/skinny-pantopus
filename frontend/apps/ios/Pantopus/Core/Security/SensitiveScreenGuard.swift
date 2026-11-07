//
//  SensitiveScreenGuard.swift
//  Pantopus
//
//  Screen-level identity gate for the private surfaces (Wallet, Settings →
//  Payments, Mail, access codes). Mirrors RN
//  `components/security/SensitiveScreenGuard.tsx`:
//
//   - device carries no credential (no passcode, no biometric) → content
//     renders immediately (there is nothing to check against),
//   - a successful check inside the 5-minute grace window → content renders
//     immediately,
//   - otherwise prompt for Face ID / Touch ID / device passcode *before* the
//     content is composed. Cancel / failure navigates back, exactly like RN's
//     `backOrDismissTo(router, MAIN_TABS_ROUTE)`.
//
//  Once through, the content stays alive under the cover: coming back after
//  5 minutes away asks again, and the person lands where they were (unless a
//  sheet was open: the cover can't reach over it, so the content goes with it).
//
//  The Android counterpart is `core/security/SensitiveScreenGuard.kt`.
//

import SwiftUI

public struct SensitiveScreenGuard<Content: View>: View {
    /// Gate lifecycle. `pending` is the pre-check frame, `rejected` keeps the
    /// cover up (with a Retry) while the caller pops the screen.
    public enum Phase: Equatable, Sendable {
        case pending
        case authenticating
        case authenticated
        case rejected(message: String?)
    }

    private let reason: String
    private let gracePeriod: TimeInterval
    private let manager: AppLockManager
    private let onRejected: @MainActor () -> Void
    private let content: () -> Content

    @State private var phase: Phase = .pending
    /// The check has passed once: the content exists from here on.
    @State private var hasPassed = false
    /// On screen now. A guard in another tab or under a pushed screen waits to be seen before it asks.
    @State private var isOnScreen = false
    /// When this screen last went out of sight.
    @State private var leftAt: Date?

    public init(
        reason: String,
        gracePeriod: TimeInterval = AppLockManager.sensitiveAuthGrace,
        manager: AppLockManager = .shared,
        onRejected: @escaping @MainActor () -> Void = {},
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.reason = reason
        self.gracePeriod = gracePeriod
        self.manager = manager
        self.onRejected = onRejected
        self.content = content
    }

    public var body: some View {
        ZStack {
            if hasPassed {
                content()
                    .allowsHitTesting(phase == .authenticated)
                    .accessibilityHidden(phase != .authenticated)
            }
            if phase != .authenticated {
                cover
            }
        }
        .hiddenInAppSwitcher()
        .onAppear {
            isOnScreen = true
            passInsideGrace()
        }
        .onDisappear {
            isOnScreen = false
            leftAt = Date()
            if phase == .authenticated { manager.noteSensitiveScreenLeft() }
        }
        .task {
            askAgainIfGoneTooLong()
            await authenticateIfNeeded()
        }
        .onChange(of: manager.foregroundReturn) { _, back in
            guard let back else { return }
            askAgain(afterAway: back.awayFor)
            guard isOnScreen else { return }
            Task { await authenticateIfNeeded() }
        }
        // The whole-app lock asks first; its Face ID counts for this screen too.
        .onChange(of: manager.isLocked) { _, locked in
            guard !locked, isOnScreen else { return }
            Task { await authenticateIfNeeded() }
        }
    }

    // MARK: - Gate

    /// Inside the grace there is nothing to ask, so no cover shows either.
    private func passInsideGrace() {
        guard phase == .pending, manager.capability == .available,
              manager.isWithinSensitiveGracePeriod(gracePeriod) else { return }
        phase = .authenticated
        hasPassed = true
    }

    /// Back on screen (another tab, a pushed screen closed) after the grace ran out.
    private func askAgainIfGoneTooLong() {
        guard let leftAt else { return }
        askAgain(afterAway: Date().timeIntervalSince(leftAt))
    }

    /// A cover left up asks again now someone is back; an open screen asks after the grace ran out.
    private func askAgain(afterAway away: TimeInterval) {
        switch phase {
        case .rejected:
            phase = .pending
        case .authenticated:
            if away >= gracePeriod, !manager.isWithinSensitiveGracePeriod(gracePeriod) {
                phase = .pending
                if AppLockWindowPresenter.isSomethingPresented { hasPassed = false }
            }
        case .pending, .authenticating:
            break
        }
    }

    private func authenticateIfNeeded() async {
        guard phase == .pending, !manager.isLocked else { return }
        phase = .authenticating
        switch await manager.verifySensitiveScreen(reason: reason, gracePeriod: gracePeriod) {
        case .verified:
            phase = .authenticated
            hasPassed = true
        case .cancelled:
            phase = .rejected(message: nil)
            onRejected()
        case let .failed(message):
            phase = .rejected(message: message)
            onRejected()
        }
    }

    private func retry() {
        phase = .pending
        Task { await authenticateIfNeeded() }
    }

    // MARK: - Cover

    private var cover: some View {
        VStack(spacing: Spacing.s4) {
            Icon(.lock, size: 44, color: Theme.Color.primaryInk)
            Text(reason)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
                .multilineTextAlignment(.center)
            if case let .rejected(message) = phase {
                Text(message ?? "Identity check cancelled.")
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .multilineTextAlignment(.center)
                Button(action: retry) {
                    Text("Try again")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(Theme.Color.appTextInverse)
                        .padding(.horizontal, 22)
                        .frame(height: 44)
                        .background(Theme.Color.primarySolid)
                        .clipShape(Capsule())
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("sensitiveScreenGuardRetry")
            } else {
                Text("Confirm it's you to continue.")
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .multilineTextAlignment(.center)
            }
        }
        .padding(Spacing.s6)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("sensitiveScreenGuard")
    }
}
