//
//  SettingsView.swift
//  Pantopus
//
//  Settings hub. Hosts the index (`GroupedListView`) plus every
//  sub-route. P8 / T6.2c wired six previously-placeholder rows to
//  real screens (Blocked users, Password, Verification, Help, Legal,
//  About). P5.2 / A14.6 wired Payments. Data export stays on
//  `NotYetAvailableView` per Q7's "park until P8.5" decision.
//

import SwiftUI

/// Sentinel routes within the Settings stack.
public enum SettingsStackRoute: Hashable {
    case notifications
    case privacy
    case identityCenter
    case audienceProfile
    /// A03.2 — Beacon Updates feed, reached from the Audience Profile
    /// "Beacon Updates" entry row.
    case beaconsFeed
    case blockedUsers
    case password
    case verification
    case help
    case legal
    case legalContent(LegalDocument)
    case about
    /// P5.2 / A14.6 — Settings → Payments (payments-out · Stripe
    /// setup · payout routing). Distinct from A10.10 Wallet
    /// (earnings-in) which lives under the Wallet tab.
    case payments
    case dataExport
    /// One route intentionally parked until P8.5: data export wizard.
    /// See `docs/t6-open-questions-decisions.md` Q7.
    case placeholder(label: String)
}

public struct SettingsView: View {
    @State private var path: [SettingsStackRoute] = []
    private let onClose: @MainActor () -> Void
    private let onEditProfile: @MainActor () -> Void
    private let onOpenReviewClaims: @MainActor () -> Void
    private let onOpenWallet: @MainActor () -> Void
    private let onSignedOut: @MainActor () -> Void

    public init(
        initialRoute: SettingsStackRoute? = nil,
        onClose: @escaping @MainActor () -> Void = {},
        onEditProfile: @escaping @MainActor () -> Void = {},
        onOpenReviewClaims: @escaping @MainActor () -> Void = {},
        onOpenWallet: @escaping @MainActor () -> Void = {},
        onSignedOut: @escaping @MainActor () -> Void = {}
    ) {
        _path = State(initialValue: initialRoute.map { [$0] } ?? [])
        self.onClose = onClose
        self.onEditProfile = onEditProfile
        self.onOpenReviewClaims = onOpenReviewClaims
        self.onOpenWallet = onOpenWallet
        self.onSignedOut = onSignedOut
    }

    public var body: some View {
        currentView
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Theme.Color.appBg)
            .accessibilityIdentifier("settings")
    }

    @ViewBuilder private var currentView: some View {
        if let route = path.last {
            destination(for: route)
        } else {
            indexView
        }
    }

    private var indexView: some View {
        GroupedListView(
            dataSource: SettingsIndexViewModel { route in
                handle(route: route)
            },
            onBack: onClose
        )
        .accessibilityIdentifier("settings")
    }

    @ViewBuilder private func destination(for route: SettingsStackRoute) -> some View {
        switch route {
        case .notifications, .privacy:
            groupedDestination(for: route)
        case .identityCenter:
            IdentityCenterView(
                onBack: { popLast() },
                onOpenIdentity: { card in
                    if card.kind == .publicProfile {
                        path.append(.audienceProfile)
                    }
                }
            )
        case .audienceProfile:
            AudienceProfileView(onBack: popLast) { path.append(.beaconsFeed) }
        case .beaconsFeed:
            BeaconsFeedView(
                onOpenPost: { _ in path.append(.placeholder(label: "Post")) },
                onCompose: { _ in path.append(.placeholder(label: "Compose")) },
                onDiscover: { path.append(.placeholder(label: "Discover beacons")) },
                onBack: popLast
            )
        case .legal:
            LegalIndexView(
                onBack: { popLast() },
                onSelect: { doc in path.append(.legalContent(doc)) }
            )
        case let .legalContent(doc):
            LegalContentView(document: doc) { popLast() }
        case let .placeholder(label):
            NotYetAvailableView(tabName: label, icon: .info)
        case .blockedUsers, .password, .verification, .help, .about, .payments, .dataExport:
            settingsDestination(for: route)
        }
    }

    @ViewBuilder private func settingsDestination(for route: SettingsStackRoute) -> some View {
        switch route {
        case .blockedUsers:
            BlockedUsersView { popLast() }
        case .password:
            PasswordChangeView { popLast() }
        case .verification:
            VerificationCenterView { popLast() }
        case .help:
            HelpCenterView { popLast() }
        case .about:
            AboutView { popLast() }
        case .payments:
            PaymentsView(onBack: { popLast() }, onOpenWallet: onOpenWallet)
        case .dataExport:
            DataExportView { popLast() }
        default:
            EmptyView()
        }
    }

    @ViewBuilder private func groupedDestination(for route: SettingsStackRoute) -> some View {
        switch route {
        case .notifications:
            NotificationSettingsView { popLast() }
        case .privacy:
            PrivacyView(viewModel: PrivacySettingsViewModel()) { popLast() }
        default:
            EmptyView()
        }
    }

    private func popLast() {
        if !path.isEmpty { path.removeLast() }
    }

    private func handle(route: SettingsRoute) {
        if let stack = Self.stackRoute(for: route) {
            path.append(stack)
            return
        }
        switch route {
        case .editProfile: onEditProfile()
        case .reviewClaims: onOpenReviewClaims()
        case .didSignOut: onSignedOut()
        default: break
        }
    }

    private static func stackRoute(for route: SettingsRoute) -> SettingsStackRoute? {
        switch route {
        case .notifications: .notifications
        case .privacy: .identityCenter // Profiles & Privacy is the unified destination.
        case .blocks: .blockedUsers
        case .password: .password
        case .verification: .verification
        // Parked until P8.5 — see docs/t6-open-questions-decisions.md Q7.
        case .dataExport: .dataExport
        // P5.2 / A14.6 — Settings → Payments (payments-out · Stripe
        // setup · payout routing). Distinct from A10.10 Wallet
        // (earnings-in), which the host still surfaces via
        // `onOpenWallet` for any tab-level entry that needs it.
        case .paymentsPayouts: .payments
        case .help: .help
        case .legal: .legal
        case .about: .about
        default: nil
        }
    }
}

#Preview {
    SettingsView()
}
