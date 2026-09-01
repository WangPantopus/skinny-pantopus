//
//  InviteeConfirmedView.swift
//  Pantopus
//
//  D3 Booking Confirmed / Thank-You (Stream I6). The success screen built to the
//  Calendarly design: a centered halo hero (success green check / info-blue
//  hourglass for pending approval), confetti on mount (suppressed under reduced
//  motion), the summary card, an optional receipt capsule, an add-to-calendar
//  cluster, a manage note, and a sticky dock. Renders loading / loaded / error.
//

import SwiftUI

// swiftlint:disable:next type_body_length
struct InviteeConfirmedView: View {
    @State private var viewModel: InviteeConfirmedViewModel
    @State private var showAddToCalendar = false
    @State private var shareItem: ICSShareItem?
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    init(viewModel: InviteeConfirmedViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    var body: some View {
        content
            .background(Theme.Color.appBg)
            .navigationBarBackButtonHidden(true)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button { dismiss() } label: { Icon(.x, size: 20, color: Theme.Color.appTextStrong) }
                        .accessibilityLabel("Close")
                }
            }
            .task { await viewModel.load() }
            .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
            .accessibilityIdentifier("scheduling.inviteeConfirmed")
            .sheet(isPresented: $showAddToCalendar) { addToCalendarSheet }
            .sheet(item: $shareItem) { item in ICSShareSheet(item: item) }
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .loading:
            loadingState
        case .loaded:
            loadedScroll
        case let .error(message):
            errorState(message)
        }
    }

    private var loadedScroll: some View {
        ScrollView {
            VStack(spacing: Spacing.s4) {
                hero
                if viewModel.isPending { timelineCard
                    etaPill
                }
                BookingSummaryCard(summary: viewModel.summary, hostPrefix: true, showPillar: false)
                if viewModel.showsReceipt { receiptCapsule }
                // Design FramePending omits CalendarCluster — only show it once the booking is confirmed.
                if !viewModel.isPending {
                    CalendarClusterView(accent: viewModel.accent) { showAddToCalendar = true }
                }
                manageNote
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.vertical, Spacing.s2)
        }
        .overlay(alignment: .top) {
            if !reduceMotion { ConfettiBurst().allowsHitTesting(false) }
        }
        .safeAreaInset(edge: .bottom) { dock }
    }

    // MARK: - Hero

    private var hero: some View {
        VStack(spacing: Spacing.s4) {
            HaloBadge(
                icon: viewModel.isPending ? .hourglass : .checkCircle2,
                tone: viewModel.isPending ? .info : .success,
                animated: !reduceMotion
            )
            VStack(spacing: Spacing.s2) {
                Text(viewModel.heroTitle)
                    .font(.system(size: 21, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                    .multilineTextAlignment(.center)
                Text(viewModel.heroBody)
                    .font(.system(size: 12.5))
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 248)
            }
        }
        .padding(.top, Spacing.s2)
    }

    private var timelineCard: some View {
        ConfirmCard {
            ZStack(alignment: .top) {
                timelineRail
                HStack(alignment: .top, spacing: Spacing.s0) {
                    ForEach(Array(viewModel.timelineSteps.enumerated()), id: \.offset) { index, step in
                        timelineStep(step, isLast: index == viewModel.timelineSteps.count - 1)
                    }
                }
            }
        }
    }

    /// The connecting rail behind the nodes: a grey track spanning the inner 2/3
    /// (node centers sit at 1/6, 1/2, 5/6) with a blue fill up to the active node.
    private var timelineRail: some View {
        GeometryReader { geo in
            let inset = geo.size.width / 6
            let span = geo.size.width - inset * 2
            ZStack(alignment: .leading) {
                Capsule().fill(Theme.Color.appBorder)
                    .frame(width: span, height: 2)
                Capsule().fill(Theme.Color.primary600)
                    .frame(width: span * timelineFill, height: 2)
            }
            .offset(x: inset, y: 14)
        }
        .frame(height: 28)
    }

    /// Progress fraction of the rail: 0 at submitted, 1/2 while awaiting host.
    private var timelineFill: CGFloat {
        let steps = viewModel.timelineSteps
        if steps.allSatisfy({ $0.state == .done }) { return 1 }
        if steps.contains(where: { $0.state == .current }) { return 0.5 }
        return 0
    }

    // swiftlint:disable large_tuple
    private func timelineStep(
        _ step: (label: String, sub: String?, state: InviteeConfirmedViewModel.TimelineStepState),
        isLast _: Bool
    ) -> some View { // swiftlint:enable large_tuple
        VStack(spacing: Spacing.s2) {
            ZStack {
                Circle()
                    .fill(stepFill(step.state))
                    .frame(width: 28, height: 28)
                    .overlay {
                        if step.state == .pending {
                            Circle().strokeBorder(Theme.Color.appBorderStrong, lineWidth: 1.5)
                        }
                    }
                switch step.state {
                case .done: Icon(.check, size: 14, strokeWidth: 3, color: Theme.Color.appTextInverse)
                case .current: Circle().fill(Theme.Color.appTextInverse).frame(width: 8, height: 8)
                case .pending: EmptyView()
                }
            }
            VStack(spacing: 2) {
                Text(step.label)
                    .font(.system(size: 10.5, weight: step.state == .pending ? .regular : .bold))
                    .foregroundStyle(step.state == .pending ? Theme.Color.appTextSecondary : Theme.Color.appText)
                    .multilineTextAlignment(.center)
                if let sub = step.sub {
                    Text(sub)
                        .font(.system(size: 9, weight: .medium))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .multilineTextAlignment(.center)
                }
            }
        }
        .frame(maxWidth: .infinity)
    }

    private func stepFill(_ state: InviteeConfirmedViewModel.TimelineStepState) -> Color {
        switch state {
        case .done: Theme.Color.success
        case .current: Theme.Color.primary600
        case .pending: Theme.Color.appSurface
        }
    }

    private var etaPill: some View {
        HStack(spacing: Spacing.s1) {
            Icon(.clock, size: 12, strokeWidth: 2.4, color: Theme.Color.primary700)
            Text("Hosts usually reply within a day")
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(Theme.Color.primary700)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2)
        .background(Theme.Color.primary50)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.pill, style: .continuous)
                .strokeBorder(Theme.Color.primary200, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
    }

    // MARK: - Receipt

    private var receiptCapsule: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(spacing: Spacing.s2) {
                Icon(.badgeCheck, size: 16, strokeWidth: 2.2, color: Theme.Color.success)
                Text(viewModel.receiptTitle)
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Theme.Color.success)
                Spacer(minLength: Spacing.s0)
                if let amount = viewModel.receiptAmount {
                    Text(amount)
                        .font(.system(size: 15, weight: .heavy))
                        .monospacedDigit()
                        .foregroundStyle(Theme.Color.success)
                }
            }
            if let balance = viewModel.depositBalanceLabel {
                Text(balance)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(Theme.Color.success)
            }
            Rectangle()
                .fill(Theme.Color.successLight)
                .frame(height: 1)
                .padding(.top, Spacing.s1)
            if viewModel.receiptProcessing {
                HStack(spacing: Spacing.s2) {
                    Icon(.mail, size: 13, color: Theme.Color.appTextMuted)
                    Shimmer(height: 11, cornerRadius: Radii.sm)
                }
                .accessibilityLabel("Sending your receipt")
            } else {
                HStack(spacing: Spacing.s1) {
                    Icon(.mailCheck, size: 13, color: Theme.Color.success)
                    Text("Receipt emailed to you")
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.appTextStrong)
                }
            }
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .fill(Theme.Color.successBg)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                        .strokeBorder(Theme.Color.successLight, lineWidth: 1)
                )
        )
    }

    private var manageNote: some View {
        Button { viewModel.openManage() } label: {
            HStack(alignment: .top, spacing: Spacing.s2) {
                Icon(.settings2, size: 14, color: Theme.Color.appTextMuted)
                Text("Need to change it? ")
                    .font(.system(size: 11.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    + Text("Reschedule or cancel")
                    .font(.system(size: 11.5, weight: .bold))
                    .foregroundStyle(viewModel.accent)
                    + Text(" anytime.")
                    .font(.system(size: 11.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                Spacer(minLength: Spacing.s0)
            }
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("scheduling.inviteeConfirmed.manage")
    }

    // MARK: - Dock

    private var dock: some View {
        ConfirmFooter {
            if viewModel.isPending {
                ConfirmPrimaryButton(label: "Done", icon: .check, accent: viewModel.accent) { dismiss() }
                secondaryButton("Message host") {
                    if let url = viewModel.messageHostURL { openURL(url) }
                }
            } else {
                ConfirmPrimaryButton(label: "Add to calendar", icon: .calendarPlus, accent: viewModel.accent) {
                    showAddToCalendar = true
                }
                secondaryButton("Done") { dismiss() }
            }
        }
    }

    private func secondaryButton(_ label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextStrong)
                .frame(maxWidth: .infinity)
                .frame(height: 38)
        }
        .buttonStyle(.plain)
    }

    // MARK: - Add to calendar

    private var addToCalendarSheet: some View {
        AddToCalendarSheet(
            viewModel: AddToCalendarViewModel(manageToken: viewModel.manageToken, client: APIClient.shared),
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

    // MARK: - States

    private var loadingState: some View {
        VStack(spacing: Spacing.s4) {
            Spacer()
            Shimmer(width: 104, height: 104, cornerRadius: Radii.pill)
            Shimmer(width: 160, height: 18)
            Shimmer(height: 120, cornerRadius: Radii.xl).padding(.horizontal, Spacing.s4)
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityLabel("Loading confirmation")
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

// MARK: - Halo badge

struct HaloBadge: View {
    enum Tone { case success, info }
    let icon: PantopusIcon
    let tone: Tone
    var animated = true
    @State private var pulse = false

    var body: some View {
        ZStack {
            Circle()
                .fill(background)
                .frame(width: 104, height: 104)
                .scaleEffect(pulse ? 1.12 : 1)
                .opacity(pulse ? 0.2 : 0.55)
            Circle().fill(background).frame(width: 84, height: 84)
            Circle()
                .fill(background)
                .frame(width: 80, height: 80)
                .overlay(Circle().strokeBorder(ring, lineWidth: 2))
                .overlay(Icon(icon, size: 38, strokeWidth: 1.9, color: foreground))
        }
        .onAppear {
            guard animated else { return }
            withAnimation(.easeInOut(duration: 2.4).repeatForever(autoreverses: true)) { pulse = true }
        }
        .accessibilityHidden(true)
    }

    private var background: Color {
        tone == .success ? Theme.Color.successBg : Theme.Color.primary50
    }

    private var ring: Color {
        tone == .success ? Theme.Color.successLight : Theme.Color.primary200
    }

    private var foreground: Color {
        tone == .success ? Theme.Color.success : Theme.Color.primary600
    }
}

// MARK: - Confetti

struct ConfettiBurst: View {
    private let pieces = 16
    private let palette: [Color] = [
        Theme.Color.primary600, Theme.Color.success, Theme.Color.warning,
        Theme.Color.business, Theme.Color.primary400
    ]
    @State private var fall = false

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .top) {
                ForEach(0..<pieces, id: \.self) { index in
                    piece(index: index, containerWidth: geo.size.width)
                }
            }
            .frame(maxWidth: .infinity)
        }
        .frame(height: 300)
        .onAppear { fall = true }
    }

    /// Split out of `body` with fully-annotated locals: as one chained expression
    /// inside ForEach this exceeded the Swift type-checker's budget outright
    /// ("unable to type-check this expression in reasonable time").
    @ViewBuilder
    private func piece(index: Int, containerWidth: CGFloat) -> some View {
        let size: CGSize = .init(
            width: index % 3 == 0 ? 5 : 6,
            height: index % 2 == 0 ? 9 : 6
        )
        let spread: Double = (0.06 + Double(index) * 0.056).truncatingRemainder(dividingBy: 0.94)
        let xPosition: CGFloat = containerWidth * CGFloat(spread)
        let yPosition: CGFloat = fall ? 280 : -14
        let duration: Double = 1.8 + Double(index % 5) * 0.25
        let delay: Double = Double(index % 8) * 0.12

        RoundedRectangle(cornerRadius: 1.5)
            .fill(palette[index % palette.count])
            .frame(width: size.width, height: size.height)
            .position(x: xPosition, y: yPosition)
            .rotationEffect(.degrees(fall ? 420 : 0))
            .opacity(fall ? 0 : 1)
            .animation(.easeIn(duration: duration).delay(delay), value: fall)
    }
}

// MARK: - ICS share

struct ICSShareItem: Identifiable {
    let id = UUID()
    let data: Data
}

struct ICSShareSheet: UIViewControllerRepresentable {
    let item: ICSShareItem

    func makeUIViewController(context _: Context) -> UIActivityViewController {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("invite.ics")
        try? item.data.write(to: url)
        return UIActivityViewController(activityItems: [url], applicationActivities: nil)
    }

    func updateUIViewController(_: UIActivityViewController, context _: Context) {}
}

#if DEBUG
#Preview("Confirmed") {
    NavigationStack { InviteeConfirmedView(viewModel: .previewConfirmed()) }
}

#Preview("Pending") {
    NavigationStack { InviteeConfirmedView(viewModel: .previewPending()) }
}

#Preview("Paid") {
    NavigationStack { InviteeConfirmedView(viewModel: .previewPaid()) }
}

#Preview("Deposit") {
    NavigationStack { InviteeConfirmedView(viewModel: .previewDeposit()) }
}

#Preview("Email sending") {
    NavigationStack { InviteeConfirmedView(viewModel: .previewSending()) }
}
#endif
