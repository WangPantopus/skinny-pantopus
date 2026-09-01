//
//  SensitiveScreenGuard.swift
//  Pantopus
//
//  Screen-level identity gate for the money surfaces (Wallet, Settings →
//  Payments). Mirrors RN `components/security/SensitiveScreenGuard.tsx`:
//
//   - device carries no credential (no passcode, no biometric) → content
//     renders immediately (there is nothing to check against),
//   - a successful check inside the 5-minute grace window → content renders
//     immediately,
//   - otherwise prompt for Face ID / Touch ID / device passcode *before* the
//     content is composed. Cancel / failure navigates back, exactly like RN's
//     `backOrDismissTo(router, MAIN_TABS_ROUTE)`.
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

    public init(
        reason: String,
        gracePeriod: TimeInterval = AppLockManager.sensitiveAuthGrace,
        manager: AppLockManager = .shared,
        onRejected: @escaping @MainActor () -> Void,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.reason = reason
        self.gracePeriod = gracePeriod
        self.manager = manager
        self.onRejected = onRejected
        self.content = content
    }

    public var body: some View {
        Group {
            if phase == .authenticated {
                content()
            } else {
                cover
            }
        }
        .task { await authenticateIfNeeded() }
    }

    // MARK: - Gate

    private func authenticateIfNeeded() async {
        guard phase == .pending else { return }
        manager.refreshCapability()
        // RN's first branch: no biometric *and* no device credential to check
        // against — never make the screen unreachable.
        guard manager.capability == .available else {
            phase = .authenticated
            return
        }
        if manager.isWithinSensitiveGracePeriod(gracePeriod) {
            phase = .authenticated
            return
        }
        phase = .authenticating
        switch await manager.verifySensitiveAction(reason: reason) {
        case .verified:
            phase = .authenticated
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
            Icon(.lock, size: 44, color: Theme.Color.primary600)
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
                        .background(Theme.Color.primary600)
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
