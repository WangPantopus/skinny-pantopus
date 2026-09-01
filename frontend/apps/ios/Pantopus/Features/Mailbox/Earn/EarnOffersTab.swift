//
//  EarnOffersTab.swift
//  Pantopus
//
//  The `Offers` tab of A10.11 Earn — the paid-offer wall RN ships at
//  `src/app/mailbox/earn.tsx`. Balance hero (server numbers only), the
//  daily-cap banner, then the envelope list. The sibling `Earnings` tab
//  keeps the existing earnings summary + history dashboard.
//

import SwiftUI
import UIKit

struct EarnOffersTab: View {
    let viewModel: EarnOffersViewModel

    var body: some View {
        ZStack(alignment: .bottom) {
            content
            if let toast = viewModel.toast {
                ToastView(message: toast)
                    .padding(.bottom, Spacing.s10)
                    .transition(.opacity)
                    .accessibilityIdentifier("earnOffersToast")
            }
        }
        .background(Theme.Color.appBg)
        .task { await viewModel.loadIfNeeded() }
        .alert(
            "Offer code",
            isPresented: Binding(
                get: { viewModel.revealedCode != nil },
                set: { if !$0 { viewModel.dismissRevealedCode() } }
            ),
            presenting: viewModel.revealedCode
        ) { revealed in
            if let code = revealed.code {
                Button("Copy code") { UIPasteboard.general.string = code }
            }
            Button("Done", role: .cancel) { viewModel.dismissRevealedCode() }
        } message: { revealed in
            Text(
                revealed.code.map { "\(revealed.businessName): \($0)" }
                    ?? "\(revealed.businessName) hasn't attached a code to this offer."
            )
        }
    }

    @ViewBuilder private var content: some View {
        switch viewModel.state {
        case .loading:
            loadingShell
        case let .loaded(balance, offers):
            wall(balance: balance, offers: offers)
        case let .empty(balance):
            emptyWall(balance: balance)
        case let .error(message):
            ErrorState(headline: "Couldn't load offers", message: message) {
                await viewModel.refresh()
            }
            .accessibilityIdentifier("earnOffersError")
        }
    }

    // MARK: - Loaded

    private func wall(balance: EarnOffersBalance, offers: [EarnOfferItem]) -> some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: Spacing.s0) {
                hero(balance)
                capBanner
                sectionOverline("Offers for you")
                VStack(spacing: Spacing.s3) {
                    ForEach(offers) { offer in
                        EarnOfferCard(
                            offer: offer,
                            isBusy: viewModel.busyOfferIDs.contains(offer.id),
                            onOpen: { Task { await viewModel.open(offer.id) } },
                            onSave: { Task { await viewModel.save(offer.id) } },
                            onReveal: { Task { await viewModel.reveal(offer.id) } }
                        )
                    }
                }
                disclaimer
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s3)
            .padding(.bottom, Spacing.s10)
        }
        .refreshable { await viewModel.refresh() }
        .accessibilityIdentifier("earnOffersWall")
    }

    // MARK: - Empty

    private func emptyWall(balance: EarnOffersBalance) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s0) {
                hero(balance)
                capBanner
                EmptyState(
                    icon: .mailOpen,
                    headline: "No offers yet",
                    subcopy: "When businesses have offers for your area, they'll appear here.",
                    tint: Theme.Color.warmAmberBg,
                    accent: Theme.Color.warmAmber
                )
                .padding(.top, Spacing.s8)
                .accessibilityIdentifier("earnOffersEmpty")
                disclaimer
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s3)
            .padding(.bottom, Spacing.s10)
        }
        .refreshable { await viewModel.refresh() }
    }

    // MARK: - Pieces

    private func hero(_ balance: EarnOffersBalance) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            BalanceHero(
                overline: "Your earnings",
                amount: balance.total,
                currencyCode: "USD",
                split: [
                    .init(
                        icon: .handCoins,
                        overline: "Available",
                        value: "$" + balance.available,
                        note: nil
                    ),
                    .init(
                        icon: .clock,
                        overline: "Pending",
                        value: "$" + balance.pending,
                        note: balance.hasPending ? "verifying" : nil
                    )
                ]
            )
            .accessibilityIdentifier("earnOffersBalanceHero")
            Text("Tap offer envelopes to earn · up to 10 a day")
                .font(.system(size: 11))
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
    }

    @ViewBuilder private var capBanner: some View {
        if let notice = viewModel.capNotice {
            HStack(alignment: .top, spacing: Spacing.s3) {
                Icon(.hourglass, size: 18, strokeWidth: 2.2, color: Theme.Color.warmAmber)
                VStack(alignment: .leading, spacing: 2) {
                    Text(notice.headline)
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                    Text(notice.body)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: Spacing.s2)
                Button { viewModel.dismissCapNotice() } label: {
                    Icon(.x, size: 16, color: Theme.Color.appTextMuted)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Dismiss daily cap notice")
                .accessibilityIdentifier("earnDailyCapDismiss")
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Color.warmAmberBg)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg + 2, style: .continuous))
            .padding(.top, Spacing.s3)
            .accessibilityIdentifier("earnDailyCapBanner")
        }
    }

    private func sectionOverline(_ title: String) -> some View {
        Text(title)
            .font(.system(size: 10.5, weight: .bold))
            .tracking(0.8)
            .textCase(.uppercase)
            .foregroundStyle(Theme.Color.appTextSecondary)
            .padding(.top, Spacing.s4)
            .padding(.bottom, Spacing.s2)
    }

    private var disclaimer: some View {
        Text(
            """
            Businesses pay to reach you. You get paid to engage.
            Earnings reflect after a short verification window.
            """
        )
        .font(.system(size: 10.5))
        .foregroundStyle(Theme.Color.appTextMuted)
        .multilineTextAlignment(.center)
        .frame(maxWidth: .infinity)
        .padding(.top, Spacing.s5)
        .accessibilityIdentifier("earnOffersDisclaimer")
    }

    // MARK: - Loading

    private var loadingShell: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s4) {
                Shimmer(height: 168, cornerRadius: Radii.xl + 2)
                Shimmer(height: 132, cornerRadius: Radii.xl)
                Shimmer(height: 132, cornerRadius: Radii.xl)
                Shimmer(height: 132, cornerRadius: Radii.xl)
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s3)
            .padding(.bottom, Spacing.s8)
        }
        .accessibilityIdentifier("earnOffersLoading")
    }
}

#Preview("Offers · loaded") {
    EarnOffersTab(
        viewModel: EarnOffersViewModel(
            state: .loaded(
                balance: EarnOffersBalance(
                    total: "1.25",
                    available: "0.75",
                    pending: "0.50",
                    hasPending: true
                ),
                offers: [
                    EarnOfferItem(
                        id: "1",
                        businessName: "Corner Bakery",
                        initials: "CB",
                        title: "Free coffee with any pastry",
                        subtitle: "Weekdays before 11am",
                        expiryLabel: "Offer expires Mar 4",
                        payoutLabel: "25¢",
                        engagement: .unopened
                    ),
                    EarnOfferItem(
                        id: "2",
                        businessName: "Ridgeline Hardware",
                        initials: "RH",
                        title: "$10 off orders over $50",
                        subtitle: nil,
                        expiryLabel: "Limited time",
                        payoutLabel: "50¢",
                        engagement: .earned
                    )
                ]
            )
        )
    )
}

#Preview("Offers · empty") {
    EarnOffersTab(viewModel: EarnOffersViewModel(state: .empty(balance: .zero)))
}

#Preview("Offers · error") {
    EarnOffersTab(
        viewModel: EarnOffersViewModel(state: .error(message: "Network unavailable."))
    )
}
