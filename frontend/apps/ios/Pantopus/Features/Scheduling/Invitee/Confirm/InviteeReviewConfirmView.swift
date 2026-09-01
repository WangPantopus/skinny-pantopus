//
//  InviteeReviewConfirmView.swift
//  Pantopus
//
//  D2 Review & Confirm / Checkout (Stream I6). The who/what/when/where summary
//  with the booker's answers, an optional invoice-style price block + Stripe
//  payment section (behind `SchedulingFeatureFlags.paidEnabled`), a refund line,
//  and a sticky Confirm / Pay & book CTA. A 409 surfaces the Foundation
//  `SlotTakenSheet`; nothing is charged. Renders loading / ready / confirming /
//  error, wrapped in the offline banner.
//

import SwiftUI

// swiftlint:disable:next type_body_length
struct InviteeReviewConfirmView: View {
    @State private var viewModel: InviteeReviewConfirmViewModel
    @Environment(\.dismiss) private var dismiss

    init(viewModel: InviteeReviewConfirmViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    var body: some View {
        @Bindable var viewModel = viewModel
        return content
            .background(Theme.Color.appBg)
            .navigationTitle("Review & confirm")
            .navigationBarTitleDisplayMode(.inline)
            .task { await viewModel.load() }
            .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
            .accessibilityIdentifier("scheduling.inviteeReviewConfirm")
            .sheet(isPresented: $viewModel.showSlotTakenSheet) { slotTakenSheet }
            .sheet(isPresented: $viewModel.showPolicySheet) {
                CancellationPolicySheet(policy: viewModel.policyDisplay, accent: viewModel.accent) {
                    viewModel.showPolicySheet = false
                }
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
            }
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .loading:
            loadingScroll
        case .ready, .confirming:
            reviewScroll
        case let .error(message):
            errorState(message)
        }
    }

    private var reviewScroll: some View {
        ScrollView {
            VStack(spacing: Spacing.s3) {
                if let banner = viewModel.inlineBanner {
                    ConfirmBanner(tone: banner.tone, icon: banner.icon, title: banner.title, message: banner.message)
                }
                if viewModel.slotTakenActive { slotTakenBanner }
                Group {
                    BookingSummaryCard(summary: viewModel.summary, showAnswers: true)
                    if viewModel.showsPaidSurfaces { priceSection }
                    refundLink
                    // ApplyCreditRow: dashed-border tappable button (design Frames 1–5).
                    // Backend doesn't expose credit/promo data yet; rendered as a
                    // placeholder (no action) so the design structure is present.
                    if viewModel.showsPaidSurfaces { applyCreditRow }
                    if viewModel.showsPaidSurfaces { paymentSection }
                    if viewModel.needsDetails { needDetailsNote }
                }
                .opacity(viewModel.state == .confirming ? 0.85 : 1)
                .disabled(viewModel.state == .confirming)
            }
            .padding(.horizontal, 13)
            .padding(.vertical, Spacing.s3)
        }
        .safeAreaInset(edge: .bottom) { footer }
    }

    private var footer: some View {
        ConfirmFooter {
            if viewModel.state == .confirming {
                ConfirmShimmerButton(label: "Confirming your booking")
            } else {
                ConfirmPrimaryButton(
                    label: viewModel.ctaLabel,
                    icon: viewModel.ctaIcon,
                    accent: viewModel.accent,
                    isDisabled: viewModel.needsDetails
                ) {
                    Task { await viewModel.confirm() }
                }
                .accessibilityIdentifier("scheduling.inviteeReviewConfirm.cta")
            }
            if viewModel.showsPaidSurfaces {
                HStack(spacing: Spacing.s1) {
                    Icon(.info, size: 11, color: Theme.Color.appTextMuted)
                    Text("We'll confirm once payment clears.")
                        .font(.system(size: 10))
                        .foregroundStyle(Theme.Color.appTextMuted)
                }
            }
        }
    }

    // MARK: - Price block

    private var priceSection: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            ConfirmOverline("Price")
            totalsBox
            if viewModel.isDeposit { depositNote }
            // CreditChip: shown when a credit row (credit:true) is present in
            // the totals (Frame 4 · Package credit applied). Backend doesn't yet
            // expose credit data — chip renders when the ViewModel emits a credit
            // row, so it's ready once that data flows.
            if viewModel.hasCreditApplied { creditChip }
        }
    }

    /// "1 session credit applied" green pill (design Frame 4, below the totals box).
    private var creditChip: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.ticketCheck, size: 13, strokeWidth: 2.2, color: Theme.Color.success)
            Text("1 session credit applied")
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(Theme.Color.success)
        }
        .padding(.horizontal, Spacing.s2 + 2)
        .padding(.vertical, 5)
        .background(Theme.Color.successBg)
        .overlay(Capsule().strokeBorder(Theme.Color.successLight, lineWidth: 1))
        .clipShape(Capsule())
    }

    private var totalsBox: some View {
        let price = viewModel.eventType?.priceCents ?? 0
        let deposit = viewModel.eventType?.depositCents ?? 0
        let currency = viewModel.eventType?.currency
        return VStack(spacing: Spacing.s0) {
            // Itemized fee rows (the lead line item is the priced event; fee/tax
            // breakdown rows are deferred — the model exposes no fee/tax fields).
            ForEach(Array(viewModel.priceRows.enumerated()), id: \.offset) { _, row in
                priceLineRow(row)
            }
            Rectangle()
                .fill(Theme.Color.appBorder)
                .frame(height: 1)
                .padding(.top, Spacing.s2)
                .padding(.bottom, 6)
            if viewModel.isDeposit {
                totalRow(title: "Due now", amount: ConfirmFormat.money(cents: deposit, currency: currency), hero: true)
                HStack(alignment: .firstTextBaseline) {
                    Text("Balance at your visit")
                        .font(.system(size: 11.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                    Spacer()
                    Text(ConfirmFormat.money(cents: price - deposit, currency: currency))
                        .font(.system(size: 13, weight: .semibold))
                        .monospacedDigit()
                        .foregroundStyle(Theme.Color.appTextStrong)
                }
                .padding(.top, 6)
            } else {
                totalRow(title: "Total", amount: ConfirmFormat.money(cents: price, currency: currency), hero: true)
            }
        }
        .padding(.horizontal, 13)
        .padding(.vertical, Spacing.s2)
        .background(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .fill(Theme.Color.appSurfaceMuted)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                        .strokeBorder(Theme.Color.appBorder, lineWidth: 1)
                )
        )
    }

    private func priceLineRow(_ row: InviteeReviewConfirmViewModel.PriceRow) -> some View {
        HStack {
            Text(row.label)
                .font(.system(size: 12.5, weight: row.strong ? .semibold : .medium))
                .foregroundStyle(row.strong ? Theme.Color.appText : Theme.Color.appTextStrong)
            Spacer()
            Text(row.amount)
                .font(.system(size: 12.5, weight: row.credit ? .bold : (row.strong ? .semibold : .medium)))
                .monospacedDigit()
                .foregroundStyle(row.credit ? Theme.Color.success : (row.strong ? Theme.Color.appText : Theme.Color.appTextStrong))
        }
        .padding(.vertical, Spacing.s1)
    }

    private func totalRow(title: String, amount: String, hero _: Bool) -> some View {
        HStack(alignment: .firstTextBaseline) {
            Text(title)
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            Spacer()
            Text(amount)
                .font(.system(size: 22, weight: .heavy))
                .monospacedDigit()
                .foregroundStyle(viewModel.accent)
        }
    }

    private var depositNote: some View {
        // Bold the "<amount> deposit" span, matching the JSX `DepositNote` <b>.
        (
            Text("You pay a ")
                + Text("\(viewModel.depositAmountLabel) deposit").fontWeight(.bold).foregroundColor(Theme.Color.appTextStrong)
                + Text(" now. The rest is due at your visit.")
        )
        .font(.system(size: 11))
        .foregroundStyle(Theme.Color.appTextSecondary)
        .fixedSize(horizontal: false, vertical: true)
    }

    /// "Apply package credit or promo code" dashed-border button (design Frames 1–4).
    /// When a credit is already applied (Frame 4) the label switches to
    /// "Credit applied · use a different one". Backend credit/promo endpoint is
    /// not yet wired — button is present as the designed placeholder.
    private var applyCreditRow: some View {
        Button {} label: {
            HStack(spacing: Spacing.s2) {
                Icon(.tag, size: 15, color: viewModel.accent)
                Text(viewModel.hasCreditApplied ? "Credit applied · use a different one" : "Apply package credit or promo code")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Icon(.chevronRight, size: 15, color: Theme.Color.appTextMuted)
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, Spacing.s2 + 2)
            .frame(maxWidth: .infinity)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .strokeBorder(style: StrokeStyle(lineWidth: 1, dash: [4]))
                    .foregroundStyle(Theme.Color.appBorderStrong)
            )
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("scheduling.inviteeReviewConfirm.applyCredit")
    }

    private var refundLink: some View {
        Button { viewModel.showPolicySheet = true } label: {
            HStack(spacing: Spacing.s1) {
                Icon(.shieldCheck, size: 13, color: Theme.Color.appTextMuted)
                Text(viewModel.refundSummary)
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                Text("Refund policy")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(viewModel.accent)
                Spacer(minLength: Spacing.s0)
            }
        }
        .buttonStyle(.plain)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Payment

    private var paymentSection: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            ConfirmOverline("Payment")
            HStack(spacing: Spacing.s3) {
                Icon(.creditCard, size: 16, strokeWidth: 2.1, color: viewModel.accent)
                    .frame(width: 30, height: 30)
                    .background(DiscoveryTheme.accentBg(forOwnerType: viewModel.page?.ownerType))
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                VStack(alignment: .leading, spacing: 1) {
                    Text("Payment method")
                        .font(.system(size: 12.5, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                    Text("Choose a card or Apple Pay")
                        .font(.system(size: 10.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: Spacing.s0)
                Icon(.chevronRight, size: 15, color: Theme.Color.appTextMuted)
            }
            .padding(Spacing.s3)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .fill(Theme.Color.appSurface)
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                            .strokeBorder(Theme.Color.primary200, lineWidth: 1.5)
                    )
            )
            HStack(spacing: Spacing.s1) {
                Icon(.lock, size: 12, color: Theme.Color.appTextMuted)
                Text("Payments secured by Stripe")
                    .font(.system(size: 10.5))
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
            .frame(maxWidth: .infinity)
        }
    }

    // MARK: - Banners / states

    private var slotTakenBanner: some View {
        ConfirmBanner(
            tone: .error,
            icon: .calendarX,
            title: "This time was just taken",
            message: viewModel.slotTakenBannerBody,
            linkLabel: "See other times"
        ) { viewModel.presentSlotTaken() }
    }

    private var needDetailsNote: some View {
        Button { dismiss() } label: {
            ConfirmBanner(
                tone: .info,
                icon: .info,
                title: "Add your details to continue",
                message: "Head back to enter your name and email."
            )
        }
        .buttonStyle(.plain)
    }

    private var slotTakenSheet: some View {
        SlotTakenSheet(
            mode: viewModel.slotTakenAlternatives.isEmpty ? .fullyBooked : .alternatives,
            alternatives: viewModel.slotTakenAlternatives,
            takenTimeLabel: viewModel.slotTakenLabel,
            timeZoneIdentifier: viewModel.tz,
            accent: viewModel.accent,
            onSelect: { alternative in Task { await viewModel.selectAlternative(alternative) } },
            onPickAnotherTime: {
                // Signal the relay, then start the D2 → D1 → C6 unwind; D1
                // continues it and the picker consumes the taken slot.
                viewModel.pickAnotherTime()
                dismiss()
            }
        )
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    private func errorState(_ message: String) -> some View {
        VStack {
            Spacer(minLength: Spacing.s0)
            EmptyState(
                icon: .alertTriangle,
                headline: message,
                subcopy: "Your time is still held — try again.",
                cta: .init(title: "Try again") { await viewModel.refresh() }
            )
            Spacer(minLength: Spacing.s0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var loadingScroll: some View {
        ScrollView {
            VStack(spacing: Spacing.s3) {
                Shimmer(height: 200, cornerRadius: Radii.xl)
                Shimmer(height: 80, cornerRadius: Radii.lg)
            }
            .padding(.horizontal, 13)
            .padding(.vertical, Spacing.s3)
        }
        .accessibilityLabel("Loading review")
    }
}

#if DEBUG
#Preview("Free") {
    NavigationStack { InviteeReviewConfirmView(viewModel: .previewFree()) }
}

#Preview("Paid") {
    NavigationStack { InviteeReviewConfirmView(viewModel: .previewPaid()) }
}
#endif
