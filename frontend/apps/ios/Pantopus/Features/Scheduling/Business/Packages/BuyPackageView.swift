//
//  BuyPackageView.swift
//  Pantopus
//
//  G10 Buy Package (customer) — Stream I15. Checkout sheet-style screen: owner
//  card, order summary with per-session math, eligibility, policy footnote, and
//  a Pay CTA that presents Stripe PaymentSheet. Matches `buypackage-frames.jsx`.
//  Tokens only.
//

import SwiftUI

struct BuyPackageView: View {
    @State private var model: BuyPackageViewModel
    @Environment(\.dismiss) private var dismiss

    init(
        owner: SchedulingOwner,
        packageId: String,
        push: @escaping @MainActor (SchedulingRoute) -> Void,
        client: SchedulingClient = .shared
    ) {
        // Construct the presenter in the init body (not a default arg) so the
        // @MainActor initialiser is evaluated in-context, mirroring the VM build.
        _model = State(wrappedValue: BuyPackageViewModel(
            owner: owner,
            packageId: packageId,
            push: push,
            client: client,
            presenter: StripePaymentSheetPresenter()
        ))
    }

    var body: some View {
        VStack(spacing: Spacing.s0) {
            PkgTopBar(title: "Buy package") { dismiss() }
            content
        }
        .background(Theme.Color.appBg)
        .navigationBarBackButtonHidden(true)
        .task { await model.load() }
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .accessibilityIdentifier("scheduling.buyPackage")
    }

    @ViewBuilder
    private var content: some View {
        switch model.phase {
        case .loading:
            loadingBody
        case .comingSoon:
            PkgComingSoon(title: "Packages")
        case let .error(message):
            PkgErrorState(message: message) { Task { await model.load() } }
        case .ready:
            if model.payState == .paid { paidBody } else { checkout }
        }
    }

    // MARK: Checkout

    private var checkout: some View {
        // Declined (frame 3) and already-owns-credits (frame 4) drop the intro
        // caption + eligibility row to keep the sheet focused, matching the JSX.
        let isDeclined = if case .declined = model.payState { true } else { false }
        let hasUpsell = model.existingCredit != nil
        return VStack(spacing: Spacing.s0) {
            ScrollView {
                VStack(spacing: Spacing.s3) {
                    if !isDeclined && !hasUpsell && !model.isGuest {
                        Text("Save by buying sessions up front.")
                            .font(.system(size: 11.5))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    if case let .declined(message) = model.payState { declinedBanner(message) }
                    ownerCard
                    if let credit = model.existingCredit { upsellBanner(credit) }
                    summaryCard
                    if !isDeclined && !hasUpsell { eligibleRow }
                    if model.isGuest { guestEmailCard }
                    payMethodRow
                    footnote
                    Color.clear.frame(height: Spacing.s4)
                }
                .padding(.horizontal, Spacing.s4)
                .padding(.top, Spacing.s3)
            }
            PkgDock {
                PkgPrimaryButton(
                    label: model.payButtonLabel,
                    icon: .lock,
                    loading: model.payState == .paying
                ) { Task { await model.pay() } }
            }
        }
    }

    private var ownerCard: some View {
        HStack(spacing: 11) {
            ZStack {
                Circle().fill(SchedulingGradient.linear(for: model.theme.title.lowercased()))
                Icon(model.theme.icon, size: 18, color: Theme.Color.appTextInverse)
            }
            .frame(width: 38, height: 38)
            VStack(alignment: .leading, spacing: 1) {
                HStack(spacing: 5) {
                    Text(model.package?.name ?? "Package")
                        .font(.system(size: 13.5, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(1)
                    Icon(.badgeCheck, size: 14, color: model.accent)
                }
                Text("\(model.theme.title) provider")
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            Spacer()
        }
        .padding(.horizontal, 13)
        .padding(.vertical, 11)
        .background(Theme.Color.appSurface)
        .overlay(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous).stroke(Theme.Color.appBorder, lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .pantopusShadow(.sm)
    }

    private var summaryCard: some View {
        let sessions = model.package?.sessionsCount ?? 0
        return PkgCard {
            Text(model.package?.name ?? "Package")
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            line(label: "\(sessions) session\(sessions == 1 ? "" : "s") × \(model.perSessionLabel)", value: model.totalLabel)
            line(label: "Per session", value: model.perSessionLabel)
            Divider()
                .background(Theme.Color.appBorder)
                .padding(.vertical, 3)
            line(label: "Total", value: model.totalLabel, strong: true)
        }
    }

    private func line(label: String, value: String, strong: Bool = false) -> some View {
        HStack {
            Text(label)
                .font(.system(size: strong ? 13.5 : 12.5, weight: strong ? .bold : .medium))
                .foregroundStyle(strong ? Theme.Color.appText : Theme.Color.appTextStrong)
            Spacer()
            Text(value)
                .font(.system(size: strong ? 16 : 13, weight: .bold))
                .monospacedDigit()
                .foregroundStyle(Theme.Color.appText)
        }
    }

    private var eligibleRow: some View {
        HStack(alignment: .top, spacing: 10) {
            Icon(.ticketCheck, size: 16, color: model.accent)
                .padding(.top, 1)
            VStack(alignment: .leading, spacing: 2) {
                Text("Use credits on")
                    .font(.system(size: 11.5, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                Text(model.package?.eventTypeId == nil ? "All of this provider's services" : "The selected service")
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.appTextStrong)
                Text("Credits expire 1 year after purchase")
                    .font(.system(size: 10.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .padding(.top, 2)
            }
            Spacer()
        }
        .padding(.horizontal, 13)
        .padding(.vertical, 11)
        .background(model.theme.accentBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
    }

    /// Saved payment-method row (buypackage frames 1-4). View-only structure —
    /// the actual card on file + selector are not yet wired (deferred backend);
    /// tapping today simply presents the Stripe sheet via the Pay CTA.
    private var payMethodRow: some View {
        HStack(spacing: 11) {
            Icon(.creditCard, size: 16, color: Theme.Color.stripeBrand)
                .frame(width: 34, height: 24)
                .background(Theme.Color.appSurfaceSunken)
                .clipShape(RoundedRectangle(cornerRadius: Radii.sm, style: .continuous))
            Text("Add a payment method")
                .font(.system(size: 12.5, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
            Spacer()
            Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
        }
        .padding(.horizontal, 13)
        .padding(.vertical, 11)
        .background(Theme.Color.appSurface)
        .overlay(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).stroke(Theme.Color.appBorder, lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
    }

    /// Guest-email card (buypackage frame 2). View-only — the email input +
    /// "Sign in" link are not yet bound to an auth/receipt endpoint.
    private var guestEmailCard: some View {
        PkgCard {
            Text("Email")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextStrong)
            Text("you@email.com")
                .font(.system(size: 12.5))
                .foregroundStyle(Theme.Color.appTextMuted)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 11)
                .padding(.vertical, 10)
                .overlay(RoundedRectangle(cornerRadius: Radii.md, style: .continuous).stroke(Theme.Color.appBorder, lineWidth: 1.5))
            (
                Text("We'll send your receipt and credits here. ")
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    + Text("Sign in").foregroundStyle(Theme.Color.primary600).fontWeight(.bold)
            )
            .font(.system(size: 10.5))
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private var footnote: some View {
        Text("Free cancellation up to 24 hours before. After that, no refund. Use your credits any time before they expire.")
            .font(.system(size: 10.5))
            .foregroundStyle(Theme.Color.appTextSecondary)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func declinedBanner(_ message: String) -> some View {
        PkgNote(tone: .error, icon: .creditCard, text: message)
    }

    private func upsellBanner(_ credit: PackageCreditDTO) -> some View {
        VStack(spacing: 10) {
            HStack(alignment: .top, spacing: 9) {
                Icon(.ticket, size: 16, color: Theme.Color.info)
                    .padding(.top, 1)
                let remaining = credit.remainingSessions ?? 0
                let plural = remaining == 1 ? "" : "s"
                Text("You already have \(remaining) credit\(plural) left on this package.")
                    .font(.system(size: 11.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            PkgGhostButton(label: "Use a credit instead") { model.useCreditInstead() }
        }
        .padding(.horizontal, 13)
        .padding(.vertical, 12)
        .background(Theme.Color.infoBg)
        .overlay(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous).stroke(Theme.Color.infoLight, lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
    }

    // MARK: Paid / loading

    private var paidBody: some View {
        VStack(spacing: Spacing.s4) {
            Spacer()
            ZStack {
                Circle().fill(Theme.Color.successBg).frame(width: 72, height: 72)
                Icon(.checkCircle, size: 34, color: Theme.Color.success)
            }
            Text("Credits added")
                .pantopusTextStyle(.h3)
                .foregroundStyle(Theme.Color.appText)
            Text("Your package credits are ready. Book a session any time before they expire.")
                .font(.system(size: 13.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 280)
            Spacer()
            PkgPrimaryButton(label: "View my packages", icon: .tag) { model.useCreditInstead() }
                .padding(.horizontal, Spacing.s4)
            PkgGhostButton(label: "Done") { dismiss() }
                .padding(.horizontal, Spacing.s4)
                .padding(.bottom, Spacing.s6)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.Color.appBg)
    }

    private var loadingBody: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            ForEach(0..<3, id: \.self) { _ in Shimmer(height: 72, cornerRadius: Radii.xl) }
            Spacer()
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s3)
    }
}
