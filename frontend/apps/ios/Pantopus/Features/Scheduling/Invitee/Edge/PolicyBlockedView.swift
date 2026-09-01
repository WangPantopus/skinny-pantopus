//
//  PolicyBlockedView.swift
//  Pantopus
//
//  D10 Reschedule/Cancel Cutoff & Policy-Blocked (Stream I7). Shows the booking
//  summary, the honest policy note (deadlines surfaced from `actions`), and the
//  right affordances per state — free-to-change action rows, or the cutoff /
//  partial-refund / off-platform docks. Reuses the Foundation
//  `CancellationPolicySheet` for the full wording. Tokens only.
//

import SwiftUI

struct PolicyBlockedView: View {
    @State private var viewModel: PolicyBlockedViewModel
    @State private var confirmCancel = false
    @Environment(\.openURL) private var openURL
    @Environment(\.dismiss) private var dismiss

    init(viewModel: PolicyBlockedViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    var body: some View {
        content
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Theme.Color.appBg)
            .navigationTitle("Your booking")
            .navigationBarTitleDisplayMode(.inline)
            .task { await viewModel.load() }
            .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
            .confirmationDialog(
                "Cancel this booking?",
                isPresented: $confirmCancel,
                titleVisibility: .visible
            ) {
                Button("Cancel booking", role: .destructive) { Task { await viewModel.cancel() } }
                Button("Keep my booking", role: .cancel) {}
            }
            .accessibilityIdentifier("scheduling.policyBlocked")
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .loading:
            loading
        case let .loaded(response, policy):
            loaded(response, policy: policy)
        case .cancelled:
            cancelledConfirmation
        case let .error(message):
            EmptyState(
                icon: .alertCircle,
                headline: "Something went wrong",
                subcopy: message,
                cta: .init(title: "Try again") { await viewModel.refresh() }
            )
        }
    }

    private var loading: some View {
        VStack(spacing: Spacing.s3) {
            ForEach(0..<3, id: \.self) { _ in
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .fill(Theme.Color.appSurfaceSunken)
                    .frame(height: 88)
            }
        }
        .padding(Spacing.s4)
        .frame(maxHeight: .infinity, alignment: .top)
        .accessibilityLabel("Loading")
    }

    // MARK: - Loaded

    private func loaded(_ response: ManageBookingResponse, policy: PolicyState) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                SchedulingStatusPill(status: response.booking.status)
                summaryCard(response)
                policyNote(response, policy: policy)
                if case let .withinPolicy(canReschedule, canCancel, freeUntil) = policy {
                    manageRows(response, canReschedule: canReschedule, canCancel: canCancel, freeUntil: freeUntil)
                }
                if case let .rescheduleCutoff(_, cancelUntil) = policy, cancelUntil != nil {
                    cancelInsteadLink
                }
                seePolicyLink
            }
            .padding(Spacing.s4)
        }
        .safeAreaInset(edge: .bottom) { dock(response, policy: policy) }
        .sheet(isPresented: $viewModel.showPolicySheet) {
            CancellationPolicySheet(
                policy: viewModel.policyDisplay(response),
                accent: EdgeOwnerTheme.accent(forOwnerType: response.page?.ownerType)
            ) { viewModel.showPolicySheet = false }
                .presentationDetents([.medium, .large])
        }
    }

    private func summaryCard(_ response: ManageBookingResponse) -> some View {
        let tz = viewModel.tz(response)
        let ownerType = response.page?.ownerType
        return VStack(alignment: .leading, spacing: Spacing.s3) {
            HStack(spacing: Spacing.s3) {
                EdgePillarAvatar(name: response.page?.title, ownerType: ownerType, size: 34)
                VStack(alignment: .leading, spacing: 2) {
                    Text(response.eventType?.name ?? "Your booking")
                        .font(.system(size: 13.5, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                    HStack(spacing: Spacing.s1) {
                        if let host = response.page?.title {
                            Text(host)
                                .font(.system(size: 11))
                                .foregroundStyle(Theme.Color.appTextSecondary)
                        }
                        Circle()
                            .fill(EdgeOwnerTheme.accent(forOwnerType: ownerType))
                            .frame(width: 5, height: 5)
                        Text(EdgeOwnerTheme.owner(forOwnerType: ownerType).theme.title)
                            .font(.system(size: 9.5, weight: .semibold))
                            .foregroundStyle(EdgeOwnerTheme.accent(forOwnerType: ownerType))
                    }
                }
                Spacer(minLength: 0)
            }
            Divider().background(Theme.Color.appBorder)
            HStack(spacing: Spacing.s2) {
                Icon(.calendar, size: 15, color: Theme.Color.appTextSecondary)
                Text(EdgeFormat.dayTimeRange(
                    startUTC: response.booking.startAt,
                    endUTC: response.booking.endAt,
                    tz: tz
                ) ?? "—")
                    .font(.system(size: 12.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                Spacer(minLength: Spacing.s2)
                EdgeTimezonePill(tz: tz, accent: EdgeOwnerTheme.accent(forOwnerType: ownerType))
            }
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
    }

    private func policyNote(_ response: ManageBookingResponse, policy: PolicyState) -> some View {
        let copy = PolicyCopy.note(for: policy, response: response, tz: viewModel.tz(response))
        return EdgeNoteCard(
            icon: copy.icon,
            tone: copy.tone,
            title: copy.title,
            message: copy.body,
            stillNote: copy.still
        )
    }

    private func manageRows(
        _ response: ManageBookingResponse,
        canReschedule: Bool,
        canCancel: Bool,
        freeUntil: String?
    ) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            EdgeOverline(text: "Manage")
            if canReschedule {
                EdgeActionRow(
                    icon: .calendarClock,
                    title: "Reschedule",
                    subtitle: "Pick a new time that works for you.",
                    tone: .info
                ) { viewModel.reschedule() }
            }
            if canCancel {
                EdgeActionRow(
                    icon: .xCircle,
                    title: "Cancel booking",
                    subtitle: cancelSubtitle(freeUntil: freeUntil, tz: viewModel.tz(response)),
                    tone: .error
                ) { confirmCancel = true }
            }
        }
        .padding(.top, Spacing.s1)
    }

    private func cancelSubtitle(freeUntil: String?, tz: String) -> String {
        if let until = EdgeFormat.deadline(freeUntil, tz: tz) {
            return "Free until \(until) · full refund."
        }
        return "Free cancellation."
    }

    private var cancelInsteadLink: some View {
        Button { confirmCancel = true } label: {
            HStack(spacing: Spacing.s1) {
                Icon(.xCircle, size: 14, strokeWidth: 2.3, color: Theme.Color.primary600)
                Text("Cancel instead")
                    .font(.system(size: 12.5, weight: .bold))
                    .foregroundStyle(Theme.Color.primary600)
            }
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.plain)
        .padding(.top, Spacing.s1)
    }

    private var seePolicyLink: some View {
        Button { viewModel.showPolicySheet = true } label: {
            Text("See full cancellation policy")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .frame(maxWidth: .infinity)
        }
        .buttonStyle(.plain)
        .padding(.top, Spacing.s2)
        .accessibilityIdentifier("scheduling.policyBlocked.seePolicy")
    }

    // MARK: - Dock

    @ViewBuilder
    private func dock(_ response: ManageBookingResponse, policy: PolicyState) -> some View {
        switch policy {
        case .withinPolicy:
            EmptyView()
        case .rescheduleCutoff, .cancelCutoffNoRefund:
            EdgeDock {
                GhostButton(title: "Keep my booking") { dismiss() }
                hostGhostButton(title: "Message host") { messageHost(response) }
            }
        case let .partialRefund(refundCents, _, _):
            EdgeDock {
                DestructiveButton(
                    title: refundCTATitle(refundCents, response: response),
                    isLoading: viewModel.isCancelling
                ) { confirmCancel = true }
                GhostButton(title: "Keep my booking") { dismiss() }
            }
        case .changeNotAllowed:
            EdgeDock {
                PrimaryButton(title: "Message host") { messageHost(response) }
                GhostButton(title: "Keep my booking") { dismiss() }
            }
        }
    }

    private func refundCTATitle(_ refundCents: Int, response: ManageBookingResponse) -> String {
        if let money = EdgeFormat.money(cents: refundCents, currency: response.payment?.currency) {
            return "Cancel and refund \(money)"
        }
        return "Cancel and refund"
    }

    private func hostGhostButton(title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: Spacing.s2) {
                Icon(.messageCircle, size: 16, color: Theme.Color.primary600)
                Text(title)
                    .font(.system(size: 13.5, weight: .bold))
                    .foregroundStyle(Theme.Color.primary600)
            }
            .frame(maxWidth: .infinity, minHeight: 44)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(Theme.Color.primary100, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    private func messageHost(_ response: ManageBookingResponse) {
        guard let slug = response.page?.slug, let url = URL(string: "https://pantopus.com/book/\(slug)") else { return }
        openURL(url)
    }

    // MARK: - Cancelled

    private var cancelledConfirmation: some View {
        VStack(spacing: Spacing.s4) {
            Spacer(minLength: 0)
            EdgeIconHalo(icon: .checkCircle, tone: .success, size: 84)
            VStack(spacing: Spacing.s2) {
                Text("Your booking is cancelled")
                    .font(.system(size: 19, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                Text("The slot was released. Any refund you're due is on its way.")
                    .font(.system(size: 12.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 250)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, Spacing.s5)
        .safeAreaInset(edge: .bottom) {
            EdgeDock { PrimaryButton(title: "Done") { dismiss() } }
        }
    }
}

// MARK: - Per-state policy copy

private enum PolicyCopy {
    struct Note {
        let icon: PantopusIcon
        let tone: EdgeTone
        let title: String
        let body: String
        let still: String?
    }

    static func note(for policy: PolicyState, response: ManageBookingResponse, tz: String) -> Note {
        let host = response.page?.title ?? "your host"
        switch policy {
        case let .withinPolicy(_, _, freeUntil):
            let until = EdgeFormat.deadline(freeUntil, tz: tz)
            return Note(
                icon: .shieldCheck,
                tone: .success,
                title: "You're free to change this",
                body: until.map { "Reschedule or cancel at no charge until \($0)." }
                    ?? "Reschedule or cancel at no charge.",
                still: nil
            )
        case let .rescheduleCutoff(deadline, cancelUntil):
            return Note(
                icon: .clockAlert,
                tone: .warning,
                title: "Reschedule window has closed",
                body: deadline.flatMap { EdgeFormat.deadline($0, tz: tz) }
                    .map { "Free reschedules ended \($0)." } ?? "The free reschedule window has passed.",
                still: cancelUntil.flatMap { EdgeFormat.deadline($0, tz: tz) }
                    .map { "Cancelling is still open until \($0)." }
            )
        case let .cancelCutoffNoRefund(deadline):
            return Note(
                icon: .fileWarning,
                tone: .warning,
                title: "It's too late to cancel for a refund",
                body: deadline.flatMap { EdgeFormat.deadline($0, tz: tz) }
                    .map { "Free cancellation ended \($0)." } ?? "The free cancellation window has passed.",
                still: "You can still cancel without a refund, or message \(host)."
            )
        case let .partialRefund(refundCents, paidCents, fullRefundUntil):
            let refund = EdgeFormat.money(cents: refundCents, currency: response.payment?.currency) ?? "part"
            let paid = EdgeFormat.money(cents: paidCents, currency: response.payment?.currency) ?? "what you paid"
            let pct = paidCents > 0 ? Int((Double(refundCents) / Double(paidCents) * 100).rounded()) : 0
            return Note(
                icon: .fileWarning,
                tone: .warning,
                title: "You'll get a \(pct)% refund",
                body: "Cancelling now refunds \(refund) of the \(paid) you paid.",
                still: fullRefundUntil.flatMap { EdgeFormat.deadline($0, tz: tz) }
                    .map { "Cancel before \($0) for a full refund." }
            )
        case .changeNotAllowed:
            return Note(
                icon: .fileWarning,
                tone: .warning,
                title: "This booking can't be changed online",
                body: "\(host) handles reschedules and cancellations directly for this event type.",
                still: "Message \(host) and they'll sort out any change with you."
            )
        }
    }
}

#if DEBUG
#Preview("Cancel cutoff") {
    NavigationStack {
        PolicyBlockedView(viewModel: .preview(.cancelCutoffNoRefund(deadline: "2026-06-16T16:30:00Z")))
    }
}

#Preview("Within policy") {
    NavigationStack {
        PolicyBlockedView(viewModel: .preview(.withinPolicy(canReschedule: true, canCancel: true, freeUntil: "2026-06-16T16:30:00Z")))
    }
}
#endif
