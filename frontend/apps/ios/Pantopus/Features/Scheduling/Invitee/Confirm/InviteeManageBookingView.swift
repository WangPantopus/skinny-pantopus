//
//  InviteeManageBookingView.swift
//  Pantopus
//
//  D4 Manage your booking (Stream I6). Token-authed management built to the
//  Calendarly design: a status badge, the summary card (dimmed/struck for past/
//  cancelled), a Manage action region (Reschedule + soft-destructive Cancel,
//  disabled when the window is closed), the add-to-calendar cluster, and a policy
//  card. Renders loading (skeleton) / loaded / cancelled / past / window-closed /
//  token-expired / error, wrapped in the offline banner.
//

import SwiftUI

// swiftlint:disable:next type_body_length
struct InviteeManageBookingView: View {
    @State private var viewModel: InviteeManageBookingViewModel
    @State private var showAddToCalendar = false
    @State private var shareItem: ICSShareItem?
    @Environment(\.openURL) private var openURL

    init(viewModel: InviteeManageBookingViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    var body: some View {
        @Bindable var viewModel = viewModel
        return content
            .background(Theme.Color.appBg)
            .navigationTitle("Your booking")
            .navigationBarTitleDisplayMode(.inline)
            .task { await viewModel.load() }
            .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
            .accessibilityIdentifier("scheduling.inviteeManageBooking")
            .sheet(isPresented: $viewModel.showReschedule) {
                InviteeRescheduleView(
                    viewModel: viewModel.makeRescheduleViewModel(),
                    onClose: { viewModel.showReschedule = false },
                    onRescheduled: { viewModel.didReschedule() }
                )
            }
            .sheet(isPresented: $viewModel.showCancelSheet) { cancelSheet }
            .sheet(isPresented: $showAddToCalendar) { addToCalendarSheet }
            .sheet(item: $shareItem) { item in ICSShareSheet(item: item) }
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .loading:
            loadingSkeleton
        case .loaded:
            loadedScroll
        case .expired:
            expiredHalo
        case let .error(message):
            errorState(message)
        }
    }

    private var loadedScroll: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                if let banner = viewModel.inlineBanner {
                    ConfirmBanner(tone: .error, icon: .alertTriangle, title: "Something went wrong", message: banner)
                }
                SchedulingStatusPill(status: viewModel.pillStatus)
                BookingSummaryCard(
                    summary: viewModel.summary,
                    dimmed: viewModel.lifecycle != .confirmed,
                    struck: viewModel.lifecycle == .cancelled,
                    hostPrefix: false,
                    showPillar: true
                )

                switch viewModel.lifecycle {
                case .confirmed:
                    actionRegion
                    CalendarClusterView(accent: viewModel.accent) { showAddToCalendar = true }
                    policyCard(viewModel.windowClosed ? viewModel.windowClosedPolicySentence : viewModel.policySentence)
                case .pending:
                    pendingNote
                    CalendarClusterView(accent: viewModel.accent) { showAddToCalendar = true }
                    policyCard(viewModel.policySentence)
                case .past:
                    pastNote
                    CalendarClusterView(accent: viewModel.accent) { showAddToCalendar = true }
                    policyCard("Booked a follow-up? Manage it from the new confirmation email.")
                case .cancelled:
                    cancelledBanner
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, Spacing.s3)
        }
    }

    // MARK: - Action region

    private var actionRegion: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            ConfirmOverline("Manage")
            actionButton(
                icon: .calendarClock,
                label: "Reschedule",
                sub: "Pick a new time that works for you.",
                tone: .neutral,
                disabled: viewModel.windowClosed
            ) { viewModel.tapReschedule() }
            actionButton(
                icon: .xCircle,
                label: "Cancel booking",
                sub: "Cancelling frees the slot for someone else.",
                tone: .destructive,
                disabled: viewModel.windowClosed
            ) { viewModel.tapCancel() }
            if viewModel.windowClosed {
                HStack(alignment: .top, spacing: Spacing.s2) {
                    Icon(.lock, size: 13, color: Theme.Color.warning)
                    Text("Too late to change online — contact your host to reschedule or cancel.")
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.warning)
                        .fixedSize(horizontal: false, vertical: true)
                    Spacer(minLength: Spacing.s0)
                }
                .padding(.horizontal, 2)
            }
        }
    }

    private enum ActionTone { case neutral, destructive }

    // swiftlint:disable:next function_parameter_count
    private func actionButton(
        icon: PantopusIcon,
        label: String,
        sub: String,
        tone: ActionTone,
        disabled: Bool,
        action: @escaping () -> Void
    ) -> some View {
        let isErr = tone == .destructive
        let tileBg = disabled ? Theme.Color.appSurfaceSunken
            : (isErr ? Theme.Color.errorBg : viewModel.accentBg)
        let tileFg = disabled ? Theme.Color.appTextMuted : (isErr ? Theme.Color.error : viewModel.accent)
        let labelColor = disabled ? Theme.Color.appTextMuted : (isErr ? Theme.Color.error : Theme.Color.appText)
        let border = disabled ? Theme.Color.appBorder : (isErr ? Theme.Color.errorLight : Theme.Color.appBorderStrong)
        return Button(action: action) {
            HStack(spacing: Spacing.s3) {
                Icon(icon, size: 16, strokeWidth: 2.1, color: tileFg)
                    .frame(width: 32, height: 32)
                    .background(tileBg)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                VStack(alignment: .leading, spacing: 1) {
                    Text(label)
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(labelColor)
                    Text(sub)
                        .font(.system(size: 10.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                Spacer(minLength: Spacing.s0)
                if !disabled { Icon(.chevronRight, size: 15, color: Theme.Color.appTextMuted) }
            }
            .padding(Spacing.s3)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .strokeBorder(border, lineWidth: 1.5)
            )
            .opacity(disabled ? 0.75 : 1)
        }
        .buttonStyle(.plain)
        .disabled(false) // keep tappable when window-closed → routes to policy-blocked
        .accessibilityIdentifier("scheduling.inviteeManageBooking.\(isErr ? "cancel" : "reschedule")")
    }

    // MARK: - Notes / banners

    private var pendingNote: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.hourglass, size: 14, color: Theme.Color.appTextSecondary)
            Text("This request is awaiting the host's approval.")
                .font(.system(size: 11.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
            Spacer(minLength: Spacing.s0)
        }
        .padding(.horizontal, Spacing.s1)
    }

    private var pastNote: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.check, size: 14, color: Theme.Color.appTextSecondary)
            Text("This call has already happened.")
                .font(.system(size: 11.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
            Spacer(minLength: Spacing.s0)
        }
        .padding(.horizontal, Spacing.s1)
    }

    private var cancelledBanner: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(alignment: .top, spacing: Spacing.s2) {
                Icon(.xCircle, size: 15, strokeWidth: 2.2, color: Theme.Color.error)
                VStack(alignment: .leading, spacing: Spacing.s1) {
                    Text(viewModel.cancelledOnLabel ?? "This booking was cancelled")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(Theme.Color.error)
                    Text("The slot was released. Nothing further is owed.")
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.error)
                    Button { viewModel.bookAgain() } label: {
                        HStack(spacing: Spacing.s1) {
                            Icon(.rotateCcw, size: 13, strokeWidth: 2.3, color: viewModel.accent)
                            Text("Book again")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundStyle(viewModel.accent)
                        }
                    }
                    .buttonStyle(.plain)
                    .padding(.top, Spacing.s1)
                }
                Spacer(minLength: Spacing.s0)
            }
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .fill(Theme.Color.errorBg)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                        .strokeBorder(Theme.Color.errorLight, lineWidth: 1)
                )
        )
    }

    private func policyCard(_ text: String) -> some View {
        HStack(alignment: .top, spacing: Spacing.s2) {
            Icon(.info, size: 14, color: Theme.Color.appTextSecondary)
            VStack(alignment: .leading, spacing: Spacing.s2) {
                Text(text)
                    .font(.system(size: 11.5))
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .fixedSize(horizontal: false, vertical: true)
                Button { viewModel.contactHost(openURL) } label: {
                    HStack(spacing: Spacing.s1) {
                        Icon(.mail, size: 12, strokeWidth: 2.2, color: viewModel.accent)
                        Text("Contact \(viewModel.hostContactName)")
                            .font(.system(size: 11.5, weight: .bold))
                            .foregroundStyle(viewModel.accent)
                    }
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("scheduling.inviteeManageBooking.contactHost")
            }
            Spacer(minLength: Spacing.s0)
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .fill(Theme.Color.appSurfaceSunken)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                        .strokeBorder(Theme.Color.appBorder, lineWidth: 1)
                )
        )
    }

    // MARK: - Token expired

    private var expiredHalo: some View {
        VStack(spacing: Spacing.s4) {
            Spacer(minLength: Spacing.s0)
            ZStack {
                Circle().fill(Theme.Color.warningBg).frame(width: 96, height: 96).opacity(0.6)
                Circle()
                    .fill(Theme.Color.warningBg)
                    .frame(width: 74, height: 74)
                    .overlay(Circle().strokeBorder(Theme.Color.warningLight, lineWidth: 2))
                    .overlay(Icon(.link, size: 32, strokeWidth: 1.9, color: Theme.Color.warning))
            }
            VStack(spacing: Spacing.s2) {
                Text("This link has expired")
                    .font(.system(size: 20, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                Text("For your security, manage links expire after a while. Request a fresh one and we'll email it to you.")
                    .font(.system(size: 12.5))
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 240)
            }
            Spacer(minLength: Spacing.s0)
            VStack(spacing: Spacing.s2) {
                ConfirmPrimaryButton(label: "Request a new link", icon: .mail, accent: Theme.Color.primary600) {
                    viewModel.contactHost(openURL)
                }
                Button { viewModel.contactHost(openURL) } label: {
                    Text("Contact host")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.Color.appTextStrong)
                        .frame(maxWidth: .infinity)
                        .frame(height: 38)
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("scheduling.inviteeManageBooking.expiredContactHost")
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.bottom, Spacing.s4)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(.horizontal, Spacing.s5)
    }

    // MARK: - Add to calendar

    private var addToCalendarSheet: some View {
        AddToCalendarSheet(
            viewModel: AddToCalendarViewModel(manageToken: viewModel.token, client: APIClient.shared),
            eventRecap: viewModel.eventRecap,
            onAppleCalendar: { showAddToCalendar = false },
            onGoogle: { showAddToCalendar = false },
            onOutlook: { showAddToCalendar = false },
            onICSReady: { data in
                showAddToCalendar = false
                shareItem = ICSShareItem(data: data)
            },
            onDone: { showAddToCalendar = false }
        )
        .presentationDetents([.medium])
        .presentationDragIndicator(.visible)
    }

    private var cancelSheet: some View {
        CancelBookingSheet(
            eventRecap: viewModel.eventRecap,
            policySentence: viewModel.policySentence,
            isCancelling: viewModel.actionInFlight,
            onConfirm: { reason in Task { await viewModel.cancel(reason: reason) } },
            onKeep: { viewModel.showCancelSheet = false }
        )
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    // MARK: - Loading / error

    private var loadingSkeleton: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                Shimmer(width: 96, height: 24, cornerRadius: Radii.pill)
                Shimmer(height: 150, cornerRadius: Radii.xl)
                Shimmer(width: 70, height: 12)
                Shimmer(height: 56, cornerRadius: Radii.lg)
                Shimmer(height: 56, cornerRadius: Radii.lg)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, Spacing.s3)
        }
        .accessibilityLabel("Loading your booking")
    }

    private func errorState(_ message: String) -> some View {
        VStack {
            Spacer(minLength: Spacing.s0)
            EmptyState(
                icon: .alertTriangle,
                headline: message,
                subcopy: "Check your connection and try again.",
                cta: .init(title: "Try again") { await viewModel.refresh() }
            )
            Spacer(minLength: Spacing.s0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

#if DEBUG
#Preview("Confirmed") {
    NavigationStack { InviteeManageBookingView(viewModel: .previewConfirmed()) }
}

#Preview("Window closed") {
    NavigationStack { InviteeManageBookingView(viewModel: .previewWindowClosed()) }
}

#Preview("Cancelled") {
    NavigationStack { InviteeManageBookingView(viewModel: .previewCancelled()) }
}

#Preview("Expired") {
    NavigationStack { InviteeManageBookingView(viewModel: .previewExpired()) }
}
#endif
