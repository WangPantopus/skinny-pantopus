//
//  DevicesView.swift
//  Pantopus
//
//  Settings → Security & devices. Trusted-device registry with the current
//  device pinned, trust badges and last-seen; swipe / Remove on another
//  device → step-up → `DELETE /api/auth/devices/:id`; "Sign out of all
//  other devices"; "Lockdown" (sign out everywhere); security preferences
//  (restore grants, new-device email) behind step-up; recent security
//  events. Wrapped in `SensitiveScreenGuard` like the money surfaces so
//  the list itself is behind Face ID / passcode (5-minute grace); each
//  mutation then obtains its own server-verifiable step-up token.
//
//  Four render states per the CLAUDE.md state rule: skeleton / empty /
//  loaded / error. Accessibility identifiers (`settings.devices.*`) are
//  the parity contract with Android `DevicesViewModel.TAG_*`.
//

// swiftlint:disable file_length type_body_length

import SwiftUI

public struct DevicesView: View {
    @State private var viewModel: DevicesViewModel
    @State private var toastDismissTask: Task<Void, Never>?
    private let onBack: @MainActor () -> Void

    init(viewModel: DevicesViewModel = DevicesViewModel(), onBack: @escaping @MainActor () -> Void) {
        _viewModel = State(initialValue: viewModel)
        self.onBack = onBack
    }

    public var body: some View {
        VStack(spacing: Spacing.s0) {
            SettingsTopBar(title: "Security & devices", onBack: onBack)
                .accessibilityIdentifier("settings.devices.topBar")
            SensitiveScreenGuard(reason: "Confirm it's you to manage your devices", onRejected: onBack) {
                content
            }
        }
        .background(Theme.Color.appBg)
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .task { await viewModel.load() }
        .overlay(alignment: .bottom) {
            if let toast = viewModel.toast {
                ToastView(message: toast)
                    .padding(.bottom, Spacing.s6)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                    .accessibilityIdentifier("settings.devices.toast")
            }
        }
        .animation(.easeInOut(duration: 0.2), value: viewModel.toast)
        .onChange(of: viewModel.toast) { _, toast in
            toastDismissTask?.cancel()
            guard toast != nil else { return }
            toastDismissTask = Task { @MainActor in
                try? await Task.sleep(for: .seconds(3))
                guard !Task.isCancelled else { return }
                viewModel.toast = nil
            }
        }
        .confirmationDialog(
            "Remove this device?",
            isPresented: Binding(
                get: { viewModel.deviceToRemove != nil },
                set: { if !$0 { viewModel.deviceToRemove = nil } }
            ),
            titleVisibility: .visible,
            presenting: viewModel.deviceToRemove
        ) { device in
            Button("Remove \(DevicesViewModel.displayName(for: device))", role: .destructive) {
                Task { await viewModel.removeDevice(device) }
            }
            .accessibilityIdentifier("settings.devices.confirm.primary")
            Button("Cancel", role: .cancel) { viewModel.deviceToRemove = nil }
                .accessibilityIdentifier("settings.devices.confirm.cancel")
        } message: { _ in
            Text("It will be signed out immediately and will need a password, Face ID or passcode to come back.")
        }
        .confirmationDialog(
            "Sign out of all other devices?",
            isPresented: Bindable(viewModel).isSignOutOthersConfirmPresented,
            titleVisibility: .visible
        ) {
            Button("Sign out other devices", role: .destructive) {
                Task { await viewModel.signOutOtherDevices() }
            }
            .accessibilityIdentifier("settings.devices.confirm.primary")
            Button("Cancel", role: .cancel) {}
                .accessibilityIdentifier("settings.devices.confirm.cancel")
        } message: {
            Text("Every other phone, tablet and browser will be signed out. This device stays signed in.")
        }
        .confirmationDialog(
            "Sign out everywhere?",
            isPresented: Bindable(viewModel).isLockdownConfirmPresented,
            titleVisibility: .visible
        ) {
            Button("Lockdown — sign out everywhere", role: .destructive) {
                Task { await viewModel.lockdown() }
            }
            .accessibilityIdentifier("settings.devices.confirm.primary")
            Button("Cancel", role: .cancel) {}
                .accessibilityIdentifier("settings.devices.confirm.cancel")
        } message: {
            Text("Every device including this one will be signed out. Use this if you think someone else has access to your account.")
        }
        .accessibilityIdentifier("settings.devices.root")
    }

    // MARK: - States

    @ViewBuilder private var content: some View {
        switch viewModel.state {
        case .loading:
            skeleton
        case let .error(message):
            ScrollView {
                ErrorState(headline: "Couldn't load your devices", message: message) {
                    await viewModel.load()
                }
                .padding(.horizontal, Spacing.s5)
                .padding(.top, Spacing.s16)
            }
            .accessibilityIdentifier("settings.devices.error")
        case let .empty(content):
            list(content: content, isEmpty: true)
        case let .loaded(content):
            list(content: content, isEmpty: false)
        }
    }

    private var skeleton: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s4) {
                Shimmer(width: 96, height: 10, cornerRadius: Radii.xs)
                skeletonRow
                Shimmer(width: 120, height: 10, cornerRadius: Radii.xs)
                    .padding(.top, Spacing.s2)
                skeletonRow
                skeletonRow
                Shimmer(width: 140, height: 10, cornerRadius: Radii.xs)
                    .padding(.top, Spacing.s2)
                Shimmer(height: 44, cornerRadius: Radii.lg)
                Shimmer(height: 44, cornerRadius: Radii.lg)
            }
            .padding(Spacing.s4)
        }
        .accessibilityIdentifier("settings.devices.loading")
    }

    private var skeletonRow: some View {
        HStack(spacing: Spacing.s3) {
            Shimmer(width: 40, height: 40, cornerRadius: Radii.md)
            VStack(alignment: .leading, spacing: Spacing.s1) {
                Shimmer(width: 150, height: 12, cornerRadius: Radii.xs)
                Shimmer(width: 200, height: 10, cornerRadius: Radii.xs)
                Shimmer(width: 110, height: 10, cornerRadius: Radii.xs)
            }
            Spacer(minLength: Spacing.s0)
            Shimmer(width: 56, height: 20, cornerRadius: Radii.pill)
        }
        .padding(Spacing.s3)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
    }

    // MARK: - Loaded / empty

    private func list(content: DevicesViewModel.Content, isEmpty: Bool) -> some View {
        List {
            if isEmpty {
                Section {
                    EmptyState(
                        icon: .smartphone,
                        headline: "No devices registered yet",
                        subcopy: "Devices appear here after they sign in with this version of Pantopus. "
                            + "Sign out and back in on this device to register it."
                    )
                    .padding(.vertical, Spacing.s4)
                    .listRowBackground(Theme.Color.appBg)
                    .listRowSeparator(.hidden)
                    .accessibilityIdentifier("settings.devices.empty")
                }
            } else {
                if let current = content.currentDevice {
                    Section {
                        DeviceRow(device: current, isRevoking: false, onRemove: nil)
                            .accessibilityIdentifier("settings.devices.device.\(current.id)")
                    } header: {
                        sectionHeader("This device")
                    }
                }
                if !content.otherDevices.isEmpty {
                    Section {
                        ForEach(content.otherDevices) { device in
                            DeviceRow(
                                device: device,
                                isRevoking: viewModel.revokingDeviceId == device.id
                            ) {
                                viewModel.requestRemove(device)
                            }
                            .accessibilityIdentifier("settings.devices.device.\(device.id)")
                            .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                                Button(role: .destructive) {
                                    viewModel.requestRemove(device)
                                } label: {
                                    Label("Remove", systemImage: "trash")
                                }
                                .accessibilityIdentifier("settings.devices.device.\(device.id).swipeRemove")
                            }
                        }
                    } header: {
                        sectionHeader("Other devices")
                    }
                }
                if !content.sessions.isEmpty {
                    Section {
                        ForEach(content.sessions) { session in
                            SessionRow(session: session)
                                .accessibilityIdentifier("settings.devices.session.\(session.id)")
                        }
                    } header: {
                        sectionHeader("Web sessions")
                    } footer: {
                        Text("Browser sessions are signed out with \"Sign out of all other devices\".")
                            .pantopusTextStyle(.caption)
                            .foregroundStyle(Theme.Color.appTextMuted)
                    }
                }
            }

            actionsSection(content: content)
            prefsSection(content: content)
            eventsSection(content: content)
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background(Theme.Color.appBg)
        .refreshable { await viewModel.refresh() }
        .accessibilityIdentifier(isEmpty ? "settings.devices.emptyList" : "settings.devices.list")
    }

    private func sectionHeader(_ title: String) -> some View {
        Text(title)
            .pantopusTextStyle(.overline)
            .foregroundStyle(Theme.Color.appTextSecondary)
            .textCase(.uppercase)
            .accessibilityAddTraits(.isHeader)
    }

    // MARK: - Actions

    private func actionsSection(content: DevicesViewModel.Content) -> some View {
        Section {
            Button {
                viewModel.isSignOutOthersConfirmPresented = true
            } label: {
                actionLabel(
                    icon: .power,
                    title: "Sign out of all other devices",
                    subtitle: content.hasOtherSessions
                        ? "Keeps this device signed in."
                        : "No other devices are signed in right now.",
                    isLoading: viewModel.isSigningOutOthers,
                    tint: Theme.Color.appText
                )
            }
            .buttonStyle(.plain)
            .disabled(viewModel.isSigningOutOthers || viewModel.isLockingDown)
            .accessibilityIdentifier("settings.devices.signOutOthers")

            Button {
                viewModel.isLockdownConfirmPresented = true
            } label: {
                actionLabel(
                    icon: .shieldAlert,
                    title: "Lockdown — sign out everywhere",
                    subtitle: "Signs out every device, including this one.",
                    isLoading: viewModel.isLockingDown,
                    tint: Theme.Color.error
                )
            }
            .buttonStyle(.plain)
            .disabled(viewModel.isSigningOutOthers || viewModel.isLockingDown)
            .accessibilityIdentifier("settings.devices.lockdown")
        } header: {
            sectionHeader("Sign out")
        }
    }

    private func actionLabel(icon: PantopusIcon, title: String, subtitle: String, isLoading: Bool, tint: Color) -> some View {
        HStack(spacing: Spacing.s3) {
            Icon(icon, size: 20, color: tint)
            VStack(alignment: .leading, spacing: Spacing.s0) {
                Text(title)
                    .pantopusTextStyle(.small)
                    .fontWeight(.semibold)
                    .foregroundStyle(tint)
                Text(subtitle)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            Spacer(minLength: Spacing.s2)
            if isLoading {
                ProgressView()
                    .controlSize(.small)
            } else {
                Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
            }
        }
        .contentShape(Rectangle())
        .padding(.vertical, Spacing.s1)
    }

    // MARK: - Preferences

    private func prefsSection(content: DevicesViewModel.Content) -> some View {
        Section {
            if let prefs = content.prefs {
                Toggle(isOn: Binding(
                    get: { prefs.newDeviceEmail ?? true },
                    set: { value in Task { await viewModel.setNewDeviceEmail(value) } }
                )) {
                    prefLabel(
                        title: "Email me about new sign-ins",
                        subtitle: "Get an email whenever a new device signs in to your account."
                    )
                }
                .tint(Theme.Color.primary600)
                .disabled(viewModel.isSavingPrefs)
                .accessibilityIdentifier("settings.devices.prefs.newDeviceEmail")

                Toggle(isOn: Binding(
                    get: { prefs.allowRestoreGrants ?? true },
                    set: { value in Task { await viewModel.setAllowRestoreGrants(value) } }
                )) {
                    prefLabel(
                        title: "Quick restore after reinstall",
                        subtitle: "Let a trusted Android device restore your session with a fingerprint or face after a reinstall."
                    )
                }
                .tint(Theme.Color.primary600)
                .disabled(viewModel.isSavingPrefs)
                .accessibilityIdentifier("settings.devices.prefs.allowRestoreGrants")
            } else {
                HStack(spacing: Spacing.s2) {
                    Icon(.alertCircle, size: 16, color: Theme.Color.appTextMuted)
                    Text("Security settings couldn't load. Pull to refresh.")
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextMuted)
                }
                .accessibilityIdentifier("settings.devices.prefs.unavailable")
            }
        } header: {
            sectionHeader("Security settings")
        } footer: {
            Text("Changing these asks you to confirm it's you.")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextMuted)
        }
    }

    private func prefLabel(title: String, subtitle: String) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            Text(title)
                .pantopusTextStyle(.small)
                .foregroundStyle(Theme.Color.appText)
            Text(subtitle)
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
        .padding(.vertical, Spacing.s1)
    }

    // MARK: - Events

    private func eventsSection(content: DevicesViewModel.Content) -> some View {
        Section {
            if content.events.isEmpty {
                Text("No recent security activity.")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextMuted)
                    .accessibilityIdentifier("settings.devices.activity.empty")
            } else {
                ForEach(content.events) { event in
                    EventRow(event: event, detail: DevicesViewModel.eventDetail(event, devices: content.devices))
                        .accessibilityIdentifier("settings.devices.event.\(event.id)")
                }
            }
        } header: {
            sectionHeader("Recent activity")
        }
    }
}

// MARK: - Rows

/// One device: platform glyph, name, detail line, last seen, trust chip,
/// optional Remove button (never on the current device).
private struct DeviceRow: View {
    let device: AuthDeviceDTO
    let isRevoking: Bool
    let onRemove: (() -> Void)?

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.s3) {
            ZStack {
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .fill(device.isCurrent == true ? Theme.Color.primary100 : Theme.Color.appSurfaceSunken)
                Icon(glyph, size: 20, color: device.isCurrent == true ? Theme.Color.primary600 : Theme.Color.appTextSecondary)
            }
            .frame(width: 40, height: 40)
            .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: Spacing.s1) {
                HStack(spacing: Spacing.s2) {
                    Text(DevicesViewModel.displayName(for: device))
                        .pantopusTextStyle(.small)
                        .fontWeight(.semibold)
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(1)
                    if device.isCurrent == true {
                        StatusChip("This device", variant: .info)
                    }
                }
                let detail = DevicesViewModel.detailLine(for: device)
                if !detail.isEmpty {
                    Text(detail)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .lineLimit(2)
                }
                HStack(spacing: Spacing.s2) {
                    Text(DevicesViewModel.lastSeenLabel(for: device))
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextMuted)
                    trustChip
                }
            }
            Spacer(minLength: Spacing.s2)
            if isRevoking {
                ProgressView()
                    .controlSize(.small)
            } else if let onRemove {
                Button(action: onRemove) {
                    Icon(.trash2, size: 18, color: Theme.Color.error)
                        .frame(width: 36, height: 36)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Remove \(DevicesViewModel.displayName(for: device))")
                .accessibilityIdentifier("settings.devices.device.\(device.id).remove")
            }
        }
        .padding(.vertical, Spacing.s1)
        .accessibilityElement(children: .combine)
    }

    private var glyph: PantopusIcon {
        switch device.platform?.lowercased() {
        case "ios", "android": .smartphone
        case "web": .globe
        default: .monitor
        }
    }

    @ViewBuilder private var trustChip: some View {
        switch DevicesViewModel.trustTone(device.trustLevel) {
        case .trusted:
            StatusChip(DevicesViewModel.trustLabel(device.trustLevel), variant: .success, icon: .shieldCheck)
        case .unverified:
            StatusChip(DevicesViewModel.trustLabel(device.trustLevel), variant: .warning, icon: .shield)
        case .suspect:
            StatusChip(DevicesViewModel.trustLabel(device.trustLevel), variant: .error, icon: .shieldAlert)
        case .unknown:
            EmptyView()
        }
    }
}

/// One web session row.
private struct SessionRow: View {
    let session: AuthSessionDTO

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.s3) {
            ZStack {
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .fill(Theme.Color.appSurfaceSunken)
                Icon(.globe, size: 20, color: Theme.Color.appTextSecondary)
            }
            .frame(width: 40, height: 40)
            .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: Spacing.s1) {
                HStack(spacing: Spacing.s2) {
                    Text(DevicesViewModel.sessionTitle(for: session))
                        .pantopusTextStyle(.small)
                        .fontWeight(.semibold)
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(1)
                    if session.isCurrent == true {
                        StatusChip("This session", variant: .info)
                    }
                }
                Text(DevicesViewModel.lastSeenLabel(for: session))
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
            Spacer(minLength: Spacing.s0)
        }
        .padding(.vertical, Spacing.s1)
        .accessibilityElement(children: .combine)
    }
}

/// One security-event row on the timeline.
private struct EventRow: View {
    let event: AuthSecurityEventDTO
    let detail: String?

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.s3) {
            Circle()
                .fill(DevicesViewModel.isSecurityEvent(event.type) ? Theme.Color.warning : Theme.Color.primary400)
                .frame(width: 8, height: 8)
                .padding(.top, Spacing.s1)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: Spacing.s0) {
                Text(DevicesViewModel.eventTitle(event.type))
                    .pantopusTextStyle(.small)
                    .foregroundStyle(Theme.Color.appText)
                if let detail {
                    Text(detail)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .lineLimit(1)
                }
            }
            Spacer(minLength: Spacing.s2)
            if let date = event.createdAt?.date {
                Text(DevicesViewModel.relative(date, now: Date()))
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
        }
        .padding(.vertical, Spacing.s1)
        .accessibilityElement(children: .combine)
    }
}

#Preview("Loading") {
    DevicesView(viewModel: DevicesViewModel(api: APIClient.shared, auth: AuthManager.previewSignedIn)) {}
}
