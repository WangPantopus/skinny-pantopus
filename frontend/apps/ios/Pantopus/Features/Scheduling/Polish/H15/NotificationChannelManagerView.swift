//
//  NotificationChannelManagerView.swift
//  Pantopus
//
//  H15 · Stream I18. The dedicated channel manager list screen — the iOS
//  equivalent of the Web ChannelsManager at /scheduling/settings/channels.
//
//  Three reminder-channel rows (Push / Email / SMS) show their live status and
//  open the shared `NotificationChannelPromptView` sheet on tap; a "More
//  channels" section surfaces connected-calendar state (loading / error /
//  empty "coming soon" / populated); a P·E·S legend closes the list.
//
//  Presented as a navigation-stack destination (routed) or a full-screen cover;
//  the existing `NotificationPermissionScreen` remains the just-in-time prompt
//  entry point — this screen is the proactive settings surface.
//

import SwiftUI
import UIKit

// swiftlint:disable:next type_body_length
struct NotificationChannelManagerView: View {
    @State private var viewModel: NotificationChannelManagerViewModel
    @State private var showPrompt = false

    init(owner: SchedulingOwner, accountEmail: String = "") {
        _viewModel = State(
            wrappedValue: NotificationChannelManagerViewModel(
                owner: owner,
                accountEmail: accountEmail
            )
        )
    }

    /// Convenience: resolve the signed-in account email at the call site.
    @MainActor
    init(owner: SchedulingOwner, client: SchedulingClient = .shared) {
        let email: String = if case let .signedIn(user) = AuthManager.shared.state {
            user.email
        } else {
            ""
        }
        _viewModel = State(
            wrappedValue: NotificationChannelManagerViewModel(
                owner: owner,
                accountEmail: email,
                client: client
            )
        )
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s5) {
                headerSection
                channelsSection
                moreChannelsSection
                legend
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.vertical, Spacing.s5)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(Theme.Color.appBg)
        .navigationTitle("Notification channels")
        .navigationBarTitleDisplayMode(.inline)
        .task { await viewModel.onAppear() }
        .onReceive(NotificationCenter.default.publisher(for: UIApplication.willEnterForegroundNotification)) { _ in
            Task { await viewModel.onForeground() }
        }
        .sheet(isPresented: $showPrompt) {
            if let frame = viewModel.activePromptFrame {
                promptSheet(frame: frame)
            }
        }
        .onChange(of: viewModel.activePromptFrame) { _, frame in
            showPrompt = frame != nil
        }
        .onChange(of: showPrompt) { _, isShowing in
            if !isShowing { viewModel.activePromptFrame = nil }
        }
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .accessibilityIdentifier("scheduling.notificationChannelManager")
    }

    // MARK: - Header

    private var headerSection: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            // Pillar identity chip
            HStack(spacing: Spacing.s1) {
                Icon(.radio, size: 12, color: viewModel.theme.accent)
                Text(viewModel.theme.title)
                    .font(.system(size: 10, weight: .bold))
                    .tracking(0.5)
                    .textCase(.uppercase)
                    .foregroundStyle(viewModel.theme.accent)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(viewModel.theme.softBg)
            .clipShape(Capsule())

            Text("Reminder channels")
                .font(.system(size: 21, weight: .bold))
                .tracking(-0.3)
                .foregroundStyle(Theme.Color.appText)

            Text("Make sure booking reminders can actually reach you. Push lives on this device; email is always on.")
                .font(.system(size: 13))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    // MARK: - Reminder channels section

    private var channelsSection: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            sectionHeading("How reminders reach you")
            VStack(spacing: Spacing.s0) {
                ForEach(viewModel.channelRows) { row in
                    channelRowView(row)
                    if row.id != viewModel.channelRows.last?.id {
                        Divider()
                            .background(Theme.Color.appBorderSubtle)
                            .padding(.leading, Spacing.s4 + 40 + Spacing.s3)
                    }
                }
            }
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                    .strokeBorder(Theme.Color.appBorder, lineWidth: 1)
            )
        }
    }

    private func channelRowView(_ row: ChannelRow) -> some View {
        HStack(spacing: Spacing.s3) {
            channelDisc(channel: row.id, muted: row.status != .on)
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: Spacing.s2) {
                    Text(row.id.displayName)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                    channelStatusPill(row.status)
                }
                Text(row.detail)
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: Spacing.s2)
            if let label = row.actionLabel {
                Button {
                    viewModel.openPrompt(for: row)
                } label: {
                    Text(label)
                        .font(.system(size: 12.5, weight: .bold))
                        .foregroundStyle(Theme.Color.appTextStrong)
                        .padding(.horizontal, Spacing.s3)
                        .frame(minHeight: 32)
                        .background(Theme.Color.appSurface)
                        .overlay(
                            RoundedRectangle(cornerRadius: Radii.sm, style: .continuous)
                                .strokeBorder(Theme.Color.appBorder, lineWidth: 1)
                        )
                        .clipShape(RoundedRectangle(cornerRadius: Radii.sm, style: .continuous))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("\(label) — \(row.id.displayName)")
            }
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, 14)
    }

    private func channelDisc(channel: NotificationChannel, muted: Bool) -> some View {
        ZStack {
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .fill(muted ? Theme.Color.appSurfaceSunken : viewModel.theme.softBg)
                .frame(width: 40, height: 40)
            Icon(
                channel.glyph,
                size: 20,
                strokeWidth: 2,
                color: muted ? Theme.Color.appTextMuted : viewModel.theme.accent
            )
        }
        .accessibilityHidden(true)
    }

    @ViewBuilder
    private func channelStatusPill(_ status: ChannelStatus) -> some View {
        let pillStatus = status.pillStatus
        // For comingSoon, build a custom "lock + Coming soon" pill since
        // SchedulingPillStatus doesn't have a direct "coming soon" case with
        // a lock glyph.
        if status == .comingSoon {
            HStack(spacing: 3) {
                Icon(.lock, size: 9, strokeWidth: 2.2, color: Theme.Color.appTextSecondary)
                Text("Coming soon")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .lineLimit(1)
            }
            .padding(.horizontal, Spacing.s2)
            .padding(.vertical, 3)
            .background(Theme.Color.appSurfaceSunken)
            .overlay(Capsule().strokeBorder(Theme.Color.appBorder, lineWidth: 1))
            .clipShape(Capsule())
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Coming soon")
        } else {
            SchedulingStatusPill(pillStatus)
        }
    }

    // MARK: - More channels section

    private var moreChannelsSection: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            sectionHeading("More channels")
            switch viewModel.moreChannelsPhase {
            case .loading:
                moreChannelsSkeleton
            case let .error(message):
                moreChannelsError(message)
            case let .ready(calendars) where calendars.isEmpty:
                moreChannelsEmpty
            case let .ready(calendars):
                moreChannelsList(calendars)
            }
        }
    }

    private var moreChannelsSkeleton: some View {
        VStack(spacing: Spacing.s2) {
            Shimmer(height: 80, cornerRadius: Radii.xl)
        }
        .accessibilityHidden(true)
    }

    private func moreChannelsError(_ message: String) -> some View {
        VStack(spacing: Spacing.s3) {
            Spacer(minLength: Spacing.s2)
            ZStack {
                Circle().fill(Theme.Color.appSurfaceSunken).frame(width: 44, height: 44)
                Icon(.cloudOff, size: 20, strokeWidth: 1.8, color: Theme.Color.appTextSecondary)
            }
            Text("Couldn't load channels")
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            Text(message)
                .font(.system(size: 12.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 240)
            Button {
                Task { await viewModel.loadMoreChannels() }
            } label: {
                HStack(spacing: 6) {
                    Icon(.refreshCw, size: 14, color: Theme.Color.appTextStrong)
                    Text("Try again")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.Color.appTextStrong)
                }
                .padding(.horizontal, Spacing.s4)
                .padding(.vertical, 10)
                .overlay(Capsule().stroke(Theme.Color.appBorder, lineWidth: 1))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("scheduling.channelManager.retryMore")
            Spacer(minLength: Spacing.s2)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Spacing.s4)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .strokeBorder(Theme.Color.appBorder, lineWidth: 1)
        )
    }

    private var moreChannelsEmpty: some View {
        VStack(spacing: Spacing.s3) {
            ZStack {
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .fill(viewModel.theme.softBg)
                    .frame(width: 48, height: 48)
                Icon(.plus, size: 24, strokeWidth: 2, color: viewModel.theme.accent)
            }
            Text("More ways to reach you are coming soon")
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
                .multilineTextAlignment(.center)
            Text("We'll let you know when you can send reminders through other channels.")
                .font(.system(size: 12.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 260)
                .fixedSize(horizontal: false, vertical: true)

            if let toast = viewModel.connectToast {
                Text(toast)
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .multilineTextAlignment(.center)
                    .accessibilityIdentifier("scheduling.channelManager.connectToast")
            }

            Button {
                Task { await viewModel.connectChannel() }
            } label: {
                HStack(spacing: Spacing.s2) {
                    if viewModel.isConnecting {
                        ProgressView()
                            .progressViewStyle(.circular)
                            .scaleEffect(0.7)
                            .tint(viewModel.theme.accent)
                    }
                    Text(viewModel.isConnecting ? "Connecting…" : "Connect a channel")
                        .font(.system(size: 12.5, weight: .bold))
                        .foregroundStyle(viewModel.theme.accent)
                }
                .padding(.horizontal, Spacing.s4)
                .frame(minHeight: 36)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.sm, style: .continuous)
                        .strokeBorder(viewModel.theme.accent, lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: Radii.sm, style: .continuous))
            }
            .buttonStyle(.plain)
            .disabled(viewModel.isConnecting)
            .accessibilityIdentifier("scheduling.channelManager.connectChannel")
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Spacing.s6)
        .padding(.horizontal, Spacing.s4)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .strokeBorder(Theme.Color.appBorder, lineWidth: 1)
        )
    }

    private func moreChannelsList(_ calendars: [ConnectedCalendarDTO]) -> some View {
        VStack(spacing: Spacing.s2) {
            ForEach(calendars) { calendar in
                HStack(spacing: Spacing.s3) {
                    ZStack {
                        RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                            .fill(viewModel.theme.softBg)
                            .frame(width: 40, height: 40)
                        Icon(.radio, size: 20, strokeWidth: 2, color: viewModel.theme.accent)
                    }
                    VStack(alignment: .leading, spacing: 2) {
                        Text(calendar.provider?.capitalized ?? "Channel")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(Theme.Color.appText)
                            .lineLimit(1)
                        if let acct = calendar.externalAccount {
                            Text(acct)
                                .font(.system(size: 11))
                                .foregroundStyle(Theme.Color.appTextSecondary)
                                .lineLimit(1)
                        }
                    }
                    Spacer(minLength: Spacing.s2)
                    SchedulingStatusPill(.active)
                }
                .padding(.horizontal, Spacing.s3)
                .padding(.vertical, Spacing.s3)
                .background(Theme.Color.appSurface)
                .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                        .strokeBorder(Theme.Color.appBorder, lineWidth: 1)
                )
            }
        }
    }

    // MARK: - Legend

    private var legend: some View {
        HStack(spacing: Spacing.s5) {
            Spacer(minLength: 0)
            Text("P · Push")
                .font(.system(size: 11, design: .monospaced))
                .foregroundStyle(Theme.Color.appTextMuted)
            Text("E · Email")
                .font(.system(size: 11, design: .monospaced))
                .foregroundStyle(Theme.Color.appTextMuted)
            HStack(spacing: 4) {
                Text("S · SMS")
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundStyle(Theme.Color.appTextMuted)
                Icon(.lock, size: 10, strokeWidth: 2.6, color: Theme.Color.appTextMuted)
                Text("soon")
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
            Spacer(minLength: 0)
        }
        .padding(.top, Spacing.s1)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Legend: P is Push, E is Email, S is SMS (coming soon)")
    }

    // MARK: - Prompt sheet

    private func promptSheet(frame: NotificationPromptFrame) -> some View {
        let promptVM = makePromptViewModel(for: frame)
        return NotificationChannelPromptView(viewModel: promptVM, showsCloseButton: true)
            .task { await promptVM.onAppear() }
            .presentationDetents([.large, .fraction(0.75)])
            .presentationDragIndicator(.visible)
    }

    /// Wraps `NotificationPermissionViewModel.init` with a `@MainActor` result
    /// closure so actor-isolated calls inside the closure are safe under Swift 6.
    @MainActor
    private func makePromptViewModel(for frame: NotificationPromptFrame) -> NotificationPermissionViewModel {
        let vm = viewModel
        return NotificationPermissionViewModel(
            owner: vm.owner,
            initialFrame: frame,
            accountEmail: vm.accountEmail,
            service: NotificationChannelService.shared
        ) { result in
            Task { @MainActor in
                vm.handlePromptResult(result)
                vm.activePromptFrame = nil
            }
        }
    }

    // MARK: - Helpers

    private func sectionHeading(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 11, weight: .bold))
            .tracking(0.08 * 11)
            .textCase(.uppercase)
            .foregroundStyle(Theme.Color.appTextMuted)
            .padding(.horizontal, 2)
    }
}

// MARK: - NotificationChannel display name

private extension NotificationChannel {
    var displayName: String {
        switch self {
        case .push: "Push (this device)"
        case .email: "Email"
        case .sms: "SMS"
        }
    }
}

// MARK: - Previews

#if DEBUG
#Preview("Personal — empty more") {
    NavigationStack {
        NotificationChannelManagerView(owner: .personal, accountEmail: "maria@pantopus.co")
    }
}

#Preview("Home") {
    NavigationStack {
        NotificationChannelManagerView(owner: .home(homeId: "h1"), accountEmail: "maria@pantopus.co")
    }
}

#Preview("Business") {
    NavigationStack {
        NotificationChannelManagerView(owner: .business(id: "b1"), accountEmail: "maria@pantopus.co")
    }
}
#endif
