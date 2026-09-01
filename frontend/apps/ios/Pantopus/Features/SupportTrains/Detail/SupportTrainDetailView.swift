//
//  SupportTrainDetailView.swift
//  Pantopus
//
//  A10.9 — Participant-facing Support Train detail screen. Distinct
//  from the organizer review queue (`ReviewSignupsView`). Composes
//  the bespoke recipient + type-dates cards, the shared `SlotCalendar`
//  primitive, two row stacks, and a sticky dock that flips between a
//  single `Sign up for a slot` CTA (populated) and a split
//  `Send a card` / `Join as backup` pair (fully covered).
//

// swiftlint:disable file_length type_body_length

import SwiftUI

@MainActor
public struct SupportTrainDetailView: View {
    @State private var viewModel: SupportTrainDetailViewModel
    private let onBack: @MainActor () -> Void
    private let onOpenManage: (@MainActor () -> Void)?
    private let onShare: (@MainActor () -> Void)?
    private let onSignUp: (@MainActor () -> Void)?
    private let onEditSlot: (@MainActor (SlotRowContent) -> Void)?
    private let onSendCard: (@MainActor () -> Void)?
    private let onJoinAsBackup: (@MainActor () -> Void)?
    private let onMessageHost: (@MainActor () -> Void)?
    private let isOrganizer: Bool

    public init(
        viewModel: SupportTrainDetailViewModel,
        isOrganizer: Bool = false,
        onBack: @escaping @MainActor () -> Void = {},
        onOpenManage: (@MainActor () -> Void)? = nil,
        onShare: (@MainActor () -> Void)? = nil,
        onSignUp: (@MainActor () -> Void)? = nil,
        onEditSlot: (@MainActor (SlotRowContent) -> Void)? = nil,
        onSendCard: (@MainActor () -> Void)? = nil,
        onJoinAsBackup: (@MainActor () -> Void)? = nil,
        onMessageHost: (@MainActor () -> Void)? = nil
    ) {
        _viewModel = State(initialValue: viewModel)
        self.isOrganizer = isOrganizer
        self.onBack = onBack
        self.onOpenManage = onOpenManage
        self.onShare = onShare
        self.onSignUp = onSignUp
        self.onEditSlot = onEditSlot
        self.onSendCard = onSendCard
        self.onJoinAsBackup = onJoinAsBackup
        self.onMessageHost = onMessageHost
    }

    /// Confirm target for "Leave this slot" — RN gates the cancel behind
    /// an alert naming the slot (`src/app/support-trains/[id].tsx:331`).
    @State private var pendingLeave: SlotRowContent?

    public var body: some View {
        VStack(spacing: Spacing.s0) {
            topBar
            content
        }
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("supportTrainDetail")
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .task { await viewModel.load() }
        .overlay(alignment: .bottom) { toastOverlay }
        .sheet(item: $viewModel.reserveSelection) { selection in
            reserveSheet(selection)
        }
        .alert(
            "Leave this slot?",
            isPresented: Binding(
                get: { pendingLeave != nil },
                set: { if !$0 { pendingLeave = nil } }
            ),
            presenting: pendingLeave
        ) { row in
            Button("Keep signup", role: .cancel) { pendingLeave = nil }
            Button("Leave slot", role: .destructive) {
                let reservationId = row.reservationId
                pendingLeave = nil
                guard let reservationId else { return }
                Task { await viewModel.leaveSlot(reservationId: reservationId, reason: nil) }
            }
        } message: { row in
            Text("Leave \(row.title) on \(row.dayLabel) \(row.dateLabel)? This reopens the date for someone else.")
        }
        .alert(
            "Something went wrong",
            isPresented: Binding(
                get: { viewModel.actionError != nil },
                set: { if !$0 { viewModel.acknowledgeActionError() } }
            )
        ) {
            Button("OK", role: .cancel) { viewModel.acknowledgeActionError() }
        } message: {
            Text(viewModel.actionError ?? "")
        }
    }

    @ViewBuilder
    private func reserveSheet(_ selection: ReserveSheetSelection) -> some View {
        if let content = viewModel.currentContent {
            ReserveSlotSheet(
                selection: selection,
                options: content.reserveOptions,
                context: content.reserveContext,
                isSubmitting: viewModel.isSubmitting,
                onSubmit: { slotId, body in
                    await viewModel.reserve(slotId: slotId, body: body)
                },
                onClose: { viewModel.dismissReserve() }
            )
        }
    }

    @ViewBuilder
    private var toastOverlay: some View {
        if let toast = viewModel.toast {
            Text(toast)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextInverse)
                .padding(.horizontal, Spacing.s4)
                .padding(.vertical, Spacing.s2)
                .background(Capsule().fill(Theme.Color.appText))
                .padding(.bottom, Spacing.s12)
                .task(id: toast) {
                    try? await Task.sleep(nanoseconds: 2_500_000_000)
                    viewModel.acknowledgeToast()
                }
                .transition(.opacity)
                .accessibilityIdentifier("supportTrainDetailToast")
        }
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .loading:
            loadingShell
        case let .loaded(loaded):
            loadedBody(loaded)
        case let .error(message):
            errorShell(message)
        }
    }

    private func loadedBody(_ content: SupportTrainDetailContent) -> some View {
        VStack(spacing: Spacing.s0) {
            ScrollView(.vertical, showsIndicators: true) {
                LazyVStack(alignment: .leading, spacing: Spacing.s0) {
                    if let banner = content.celebrationBanner {
                        CelebrationBanner(content: banner)
                            .padding(.top, Spacing.s3)
                            .padding(.bottom, Spacing.s1)
                    }

                    overline("For")
                    RecipientCard(content: content.recipient)

                    overline("The train")
                    TypeDatesCard(content: content.typeDates)

                    overline("Slot calendar")
                    calendarCard(days: content.calendarDays)

                    ForEach(content.sections) { section in
                        overline(section.overline, action: section.actionLabel)
                        VStack(spacing: Spacing.s2) {
                            ForEach(section.rows) { row in
                                VStack(spacing: Spacing.s2) {
                                    SlotRow(
                                        content: row,
                                        onSignUp: signUpAction(for: row),
                                        onEdit: editAction(for: row)
                                    )
                                    commitmentActions(for: row, content: content)
                                }
                            }
                        }
                    }

                    if let address = content.exactAddress {
                        overline("Delivery address")
                        exactAddressCard(address, instructions: content.deliveryInstructions)
                    }

                    HostedByRow(content: content.hostedBy, onMessageHost: onMessageHost)
                        .padding(.top, Spacing.s3)

                    Spacer().frame(height: Spacing.s3)
                }
                .padding(.horizontal, Spacing.s4)
                .padding(.bottom, Spacing.s6)
            }
            .background(Theme.Color.appBg)

            dock(content.dock)
        }
    }

    private func signUpAction(for row: SlotRowContent) -> (@MainActor () -> Void)? {
        guard row.state == .open else { return nil }
        return {
            viewModel.startReserve(slotId: row.slotId)
            onSignUp?()
        }
    }

    /// Helper-side actions under the viewer's own commitment rows —
    /// `POST …/deliver` and `POST …/cancel` with `helper_reason`
    /// (RN `handleLeaveSlot`, `src/app/support-trains/[id].tsx:322`).
    /// Recipients / organizers get `POST …/confirm` on a delivered row.
    @ViewBuilder
    private func commitmentActions(
        for row: SlotRowContent,
        content: SupportTrainDetailContent
    ) -> some View {
        if row.mine, let reservationId = row.reservationId {
            HStack(spacing: Spacing.s2) {
                if row.canMarkDelivered {
                    rowActionButton(
                        title: "Mark delivered",
                        icon: .check,
                        identifier: "supportTrainMarkDeliveredButton"
                    ) {
                        Task { await viewModel.markDelivered(reservationId: reservationId) }
                    }
                }
                if row.reservationStatus == "delivered",
                   content.viewerRole == .recipient || content.viewerRole.isOrganizer {
                    rowActionButton(
                        title: "Confirm delivery",
                        icon: .checkCircle,
                        identifier: "supportTrainConfirmDeliveryButton"
                    ) {
                        Task { await viewModel.confirmDelivery(reservationId: reservationId) }
                    }
                }
                if row.canLeaveSlot {
                    rowActionButton(
                        title: "Leave slot",
                        icon: .x,
                        identifier: "supportTrainLeaveSlotButton",
                        destructive: true
                    ) {
                        pendingLeave = row
                    }
                }
                Spacer(minLength: Spacing.s0)
            }
            .padding(.bottom, Spacing.s1)
        }
    }

    private func rowActionButton(
        title: String,
        icon: PantopusIcon,
        identifier: String,
        destructive: Bool = false,
        action: @escaping @MainActor () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: Spacing.s1) {
                Icon(icon, size: 13, color: destructive ? Theme.Color.error : Theme.Color.appText)
                Text(title)
                    .font(.system(size: 12.5, weight: .semibold))
                    .foregroundStyle(destructive ? Theme.Color.error : Theme.Color.appText)
            }
            .padding(.horizontal, Spacing.s3)
            .frame(height: 34)
            .background(destructive ? Theme.Color.errorBg : Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(destructive ? Theme.Color.errorLight : Theme.Color.appBorder, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .disabled(viewModel.isSubmitting)
        .accessibilityIdentifier(identifier)
    }

    /// The exact address only ever renders from the server payload — it
    /// is re-fetched (and re-gated) on every load, never cached locally.
    private func exactAddressCard(_ address: String, instructions: String?) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(spacing: Spacing.s2) {
                Icon(.mapPin, size: 15, color: Theme.Color.primary600)
                Text(address)
                    .font(.system(size: 13.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if let instructions, !instructions.isEmpty {
                Text(instructions)
                    .font(.system(size: 12.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .accessibilityIdentifier("supportTrainExactAddressCard")
    }

    private func editAction(for row: SlotRowContent) -> (@MainActor () -> Void)? {
        guard row.mine else { return nil }
        return { onEditSlot?(row) }
    }

    private func overline(_ label: String, action: String? = nil) -> some View {
        HStack(alignment: .firstTextBaseline) {
            Text(label)
                .font(.system(size: 10.5, weight: .bold))
                .textCase(.uppercase)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .accessibilityAddTraits(.isHeader)
            Spacer(minLength: Spacing.s2)
            if let action {
                Button {
                    // The "See all" actions all currently surface as the
                    // same in-screen drilldown — defer the navigation
                    // hook to a follow-up. Keep the affordance so the
                    // visual contract stays true to the design.
                } label: {
                    Text(action)
                        .font(.system(size: 11.5, weight: .semibold))
                        .foregroundStyle(Theme.Color.primary600)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("\(action) \(label)")
                .accessibilityIdentifier("supportTrainSeeAll-\(label)")
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.top, Spacing.s4)
        .padding(.bottom, Spacing.s2)
    }

    private func calendarCard(days: [SlotCalendarDay]) -> some View {
        VStack {
            SlotCalendar(days: days) { _ in viewModel.startReserve() }
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .center)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .pantopusShadow(.sm)
    }

    private func dock(_ dock: SupportTrainDock) -> some View {
        VStack(spacing: Spacing.s0) {
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
            Group {
                switch dock {
                case let .signUp(label):
                    PrimarySignUpCTA(label: label) {
                        viewModel.startReserve()
                        onSignUp?()
                    }
                case .sendCardAndBackup:
                    SplitCoveredDock(onSendCard: onSendCard, onJoinAsBackup: onJoinAsBackup)
                }
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.vertical, Spacing.s3)
        }
        .background(Theme.Color.appBg)
    }

    private var loadingShell: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                Shimmer(height: 100, cornerRadius: Radii.lg).padding(.top, Spacing.s3)
                Shimmer(height: 130, cornerRadius: Radii.lg)
                Shimmer(height: 240, cornerRadius: Radii.lg)
                Shimmer(height: 64, cornerRadius: Radii.lg)
                Shimmer(height: 64, cornerRadius: Radii.lg)
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.bottom, Spacing.s8)
        }
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("supportTrainDetailLoading")
    }

    private func errorShell(_ message: String) -> some View {
        EmptyState(
            icon: .alertCircle,
            headline: "Couldn't load support train",
            subcopy: message,
            cta: EmptyState.CTA(title: "Try again") { await viewModel.refresh() }
        )
        .accessibilityIdentifier("supportTrainDetailError")
    }

    // MARK: - Top bar

    private var topBar: some View {
        HStack(spacing: Spacing.s2) {
            Button(action: onBack) {
                Icon(.chevronLeft, size: 22, color: Theme.Color.appText)
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Back")
            .accessibilityIdentifier("supportTrainDetailBackButton")

            Spacer(minLength: Spacing.s0)

            Text("Support train")
                .pantopusTextStyle(.small)
                .fontWeight(.semibold)
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)

            Spacer(minLength: Spacing.s0)

            if let onShare {
                Button(action: onShare) {
                    Icon(.share, size: 20, color: Theme.Color.appText)
                        .frame(width: 44, height: 44)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Share train")
                .accessibilityIdentifier("supportTrainDetailShareButton")
            }
            Menu {
                if isOrganizer, let onOpenManage {
                    Button {
                        onOpenManage()
                    } label: {
                        Label("Manage signups", systemImage: "list.bullet.rectangle")
                    }
                }
                Button {
                    onMessageHost?()
                } label: {
                    Label("Message the host", systemImage: "message")
                }
                Button(role: .destructive) {
                    // Report sheet wiring is a follow-up — keep the
                    // affordance visible for parity with the design.
                } label: {
                    Label("Report this train", systemImage: "flag")
                }
            } label: {
                Icon(.moreHorizontal, size: 22, color: Theme.Color.appText)
                    .frame(width: 44, height: 44)
            }
            .accessibilityLabel("More options")
            .accessibilityIdentifier("supportTrainDetailMoreButton")
        }
        .padding(.horizontal, Spacing.s2)
        .frame(height: 48)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
        }
    }
}

// MARK: - Banner

@MainActor
private struct CelebrationBanner: View {
    let content: SupportTrainDetailContent.CelebrationBanner

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.s3) {
            ZStack {
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .fill(Theme.Color.success)
                Icon(.partyPopper, size: 18, strokeWidth: 2.2, color: Theme.Color.appTextInverse)
            }
            .frame(width: 36, height: 36)
            .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 2) {
                Text(content.title)
                    .font(.system(size: 13.5, weight: .bold))
                    .foregroundStyle(Theme.Color.success)
                Text(content.body)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.success)
                    .opacity(0.9)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.successBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.successLight, lineWidth: 1)
        )
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(content.title). \(content.body)")
        .accessibilityIdentifier("supportTrainCelebrationBanner")
    }
}

// MARK: - Hosted by

@MainActor
private struct HostedByRow: View {
    let content: HostedByFooter
    let onMessageHost: (@MainActor () -> Void)?

    var body: some View {
        Button {
            onMessageHost?()
        } label: {
            HStack(spacing: Spacing.s2) {
                ZStack {
                    Circle()
                        .fill(
                            LinearGradient(
                                colors: [Theme.Color.errorLight, Theme.Color.error],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                    Text(content.organizerInitials)
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(Theme.Color.appTextInverse)
                }
                .frame(width: 24, height: 24)
                .accessibilityHidden(true)

                HStack(spacing: Spacing.s1) {
                    Text("Hosted by ")
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                    Text(content.organizerDisplayName)
                        .pantopusTextStyle(.caption)
                        .fontWeight(.semibold)
                        .foregroundStyle(Theme.Color.appTextStrong)
                    if let hint = content.neighborHint {
                        Text("· \(hint)")
                            .pantopusTextStyle(.caption)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                Icon(.messageSquare, size: 14, color: Theme.Color.appTextMuted)
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, Spacing.s2)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(Theme.Color.appBorderSubtle, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Hosted by \(content.organizerDisplayName)\(content.neighborHint.map { ", \($0)" } ?? "")")
        .accessibilityIdentifier("supportTrainHostedBy")
    }
}

// MARK: - Dock CTAs

@MainActor
private struct PrimarySignUpCTA: View {
    let label: String
    let onTap: @MainActor () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: Spacing.s2) {
                Icon(.calendar, size: 17, color: Theme.Color.appTextInverse)
                Text(label)
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 50)
            .background(Theme.Color.primary600)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .pantopusShadow(.primary)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
        .accessibilityIdentifier("supportTrainSignUpCTA")
    }
}

@MainActor
private struct SplitCoveredDock: View {
    let onSendCard: (@MainActor () -> Void)?
    let onJoinAsBackup: (@MainActor () -> Void)?

    var body: some View {
        HStack(spacing: Spacing.s2) {
            Button(
                action: { onSendCard?() },
                label: {
                    HStack(spacing: Spacing.s1) {
                        Icon(.mail, size: 14, color: Theme.Color.appText)
                        Text("Send a card")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(Theme.Color.appText)
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 46)
                    .background(Theme.Color.appSurface)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                            .stroke(Theme.Color.appBorder, lineWidth: 1)
                    )
                }
            )
            .buttonStyle(.plain)
            .accessibilityLabel("Send a card")
            .accessibilityIdentifier("supportTrainSendCardCTA")

            Button(
                action: { onJoinAsBackup?() },
                label: {
                    HStack(spacing: Spacing.s1) {
                        Icon(.userPlus, size: 14, color: Theme.Color.appTextInverse)
                        Text("Join as backup")
                            .font(.system(size: 13, weight: .bold))
                            .foregroundStyle(Theme.Color.appTextInverse)
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 46)
                    .background(Theme.Color.primary600)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                    .pantopusShadow(.primary)
                }
            )
            .buttonStyle(.plain)
            .accessibilityLabel("Join as backup")
            .accessibilityIdentifier("supportTrainJoinBackupCTA")
        }
    }
}

// MARK: - Previews

#Preview("Populated") {
    SupportTrainDetailView(
        viewModel: SupportTrainDetailViewModel(content: SupportTrainDetailSampleData.populated)
    )
}

#Preview("Fully covered") {
    SupportTrainDetailView(
        viewModel: SupportTrainDetailViewModel(content: SupportTrainDetailSampleData.fullyCovered)
    )
}

#Preview("Loading") {
    SupportTrainDetailView(
        viewModel: SupportTrainDetailViewModel(seedState: .loading)
    )
}

#Preview("Error") {
    SupportTrainDetailView(
        viewModel: SupportTrainDetailViewModel(seedState: .error(message: "Network unavailable."))
    )
}
