//
//  MembershipDetailView.swift
//  Pantopus
//
//  A10.8 — Fan membership manage. Reached when a fan taps their active
//  tier on a creator's Audience Profile (the "You're a member" footer).
//  Top to bottom: 52pt top bar (back / "Membership" / share) → optional
//  SLA-missed refund banner → persona card → tier card (silver-tone strip
//  + renewal + payment) → verified benefits with the SLA promise inline →
//  Inbox card ("Open inbox" + remaining message-thread credits) → Change
//  tier primary (opens the real tier picker) → single-tap Cancel link →
//  "Reply window missed? Request a refund" → policy footnote.
//

// swiftlint:disable file_length type_body_length

import SwiftUI

public struct MembershipDetailView: View {
    @State private var viewModel: MembershipDetailViewModel
    private let onBack: @MainActor () -> Void
    private let onShare: @MainActor () -> Void
    private let onOpenPersona: @MainActor () -> Void
    private let onUpdatePayment: @MainActor () -> Void
    private let onCancel: @MainActor () -> Void
    /// Push the fan inbox for this persona (persona DMs, A15.5).
    private let onOpenInbox: @MainActor (String) -> Void

    public init(
        viewModel: MembershipDetailViewModel,
        onBack: @escaping @MainActor () -> Void = {},
        onShare: @escaping @MainActor () -> Void = {},
        onOpenPersona: @escaping @MainActor () -> Void = {},
        onUpdatePayment: @escaping @MainActor () -> Void = {},
        onCancel: @escaping @MainActor () -> Void = {},
        onOpenInbox: @escaping @MainActor (String) -> Void = { _ in }
    ) {
        _viewModel = State(initialValue: viewModel)
        self.onBack = onBack
        self.onShare = onShare
        self.onOpenPersona = onOpenPersona
        self.onUpdatePayment = onUpdatePayment
        self.onCancel = onCancel
        self.onOpenInbox = onOpenInbox
    }

    public var body: some View {
        VStack(spacing: Spacing.s0) {
            topBar
            content
        }
        .background(Theme.Color.appBg)
        .task { await viewModel.load() }
        .toolbar(.hidden, for: .tabBar)
        .sheet(isPresented: $viewModel.isTierPickerPresented) { tierPickerSheet }
        .sheet(isPresented: $viewModel.isRefundSheetPresented) { refundSheet }
        .accessibilityIdentifier("membershipDetail")
    }

    // MARK: - Top bar

    private var topBar: some View {
        HStack(spacing: Spacing.s0) {
            Button(action: onBack) {
                Icon(.chevronLeft, size: 22, color: Theme.Color.appText)
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Back")
            .accessibilityIdentifier("membershipDetailBackButton")
            Spacer()
            Text("Membership")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)
            Spacer()
            Button(action: onShare) {
                Icon(.share, size: 20, color: Theme.Color.appText)
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Share membership")
            .accessibilityIdentifier("membershipDetailShareButton")
        }
        .padding(.horizontal, Spacing.s2)
        .frame(height: 52)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
        }
    }

    // MARK: - State switch

    @ViewBuilder private var content: some View {
        switch viewModel.state {
        case .loading:
            loadingFrame
        case let .populated(loaded):
            loadedScroll(loaded, slaMissed: false)
        case let .slaMissed(loaded):
            loadedScroll(loaded, slaMissed: true)
        case let .error(message):
            errorFrame(message: message)
        }
    }

    private var loadingFrame: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s4) {
                Shimmer(height: 64, cornerRadius: Radii.lg)
                Shimmer(height: 184, cornerRadius: Radii.xl)
                Shimmer(height: 176, cornerRadius: Radii.lg)
                Shimmer(height: 50, cornerRadius: Radii.lg)
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s2)
        }
        .accessibilityIdentifier("membershipDetailLoading")
    }

    private func errorFrame(message: String) -> some View {
        VStack(spacing: Spacing.s3) {
            Spacer()
            Icon(.alertCircle, size: 40, color: Theme.Color.error)
            Text("Couldn't load membership")
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)
            Text(message)
                .font(.system(size: 13.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
            Button {
                Task { await viewModel.load() }
            } label: {
                Text("Try again")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
                    .padding(.horizontal, Spacing.s5)
                    .frame(height: 44)
                    .background(Theme.Color.primary600)
                    .clipShape(Capsule())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("membershipDetailRetry")
            Spacer()
        }
        .padding(Spacing.s5)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityIdentifier("membershipDetailError")
    }

    // MARK: - Loaded

    private func loadedScroll(_ loaded: MembershipDetailContent, slaMissed: Bool) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s4) {
                if let alert = loaded.slaAlert {
                    slaBanner(alert)
                }
                labeledSection("You support") {
                    PersonaCard(
                        name: loaded.persona.name,
                        initials: loaded.persona.initials,
                        subtitle: loaded.persona.subtitle,
                        pillar: loaded.persona.pillar,
                        pillarLabel: loaded.persona.pillarLabel,
                        verified: loaded.persona.verified,
                        identifier: "membershipDetailPersona",
                        onTap: onOpenPersona
                    )
                }
                labeledSection("Your membership") {
                    tierCard(loaded, slaMissed: slaMissed)
                }
                labeledSection("What you get") {
                    benefitsCard(loaded.benefits)
                }
                labeledSection("Messages") {
                    inboxCard(loaded)
                }
                if loaded.hasScheduledTierChange {
                    scheduledChangeBanner(loaded)
                }
                if let confirmation = viewModel.tierChangeConfirmation {
                    inlineNotice(confirmation, identifier: "membershipDetailTierChangeConfirmation")
                }
                if let confirmation = viewModel.refundConfirmation {
                    inlineNotice(confirmation, identifier: "membershipDetailRefundConfirmation")
                }
                if !loaded.isTerminal {
                    changeTierButton
                        .padding(.top, Spacing.s1)
                    cancelBlock
                }
                requestRefundLink
                policyFootnote(loaded.policyFootnote)
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s2)
            .padding(.bottom, Spacing.s5)
        }
        .accessibilityIdentifier("membershipDetailContent")
    }

    private func labeledSection(
        _ title: String,
        @ViewBuilder content: () -> some View
    ) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text(title.uppercased())
                .font(.system(size: 10.5, weight: .bold))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .kerning(0.7)
                .accessibilityAddTraits(.isHeader)
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - SLA banner (Frame 2)

    private func slaBanner(_ alert: MembershipSLAAlert) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            HStack(alignment: .top, spacing: Spacing.s3) {
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .fill(Theme.Color.warning)
                    .frame(width: 32, height: 32)
                    .overlay {
                        Icon(.alertTriangle, size: 17, strokeWidth: 2.3, color: Theme.Color.appTextInverse)
                    }
                VStack(alignment: .leading, spacing: 3) {
                    Text(alert.title)
                        .font(.system(size: 13.5, weight: .bold))
                        .foregroundStyle(Theme.Color.warning)
                    Text(alert.message)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextStrong)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            HStack(spacing: Spacing.s2) {
                Button {
                    viewModel.presentRefundSheet()
                } label: {
                    HStack(spacing: Spacing.s1) {
                        Icon(.handCoins, size: 13, color: Theme.Color.appTextInverse)
                        Text(alert.refundCtaLabel)
                            .font(.system(size: 12.5, weight: .bold))
                            .foregroundStyle(Theme.Color.appTextInverse)
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 40)
                    .background(Theme.Color.error)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                }
                .buttonStyle(.plain)
                .accessibilityLabel(alert.refundCtaLabel)
                .accessibilityIdentifier("membershipDetailRefundButton")

                Button {
                    viewModel.dismissSLAAlert()
                } label: {
                    Text(alert.dismissCtaLabel)
                        .font(.system(size: 12.5, weight: .semibold))
                        .foregroundStyle(Theme.Color.warning)
                        .frame(maxWidth: .infinity)
                        .frame(height: 40)
                        .overlay(
                            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                                .stroke(Theme.Color.warning, lineWidth: 1)
                        )
                }
                .buttonStyle(.plain)
                .accessibilityLabel(alert.dismissCtaLabel)
                .accessibilityIdentifier("membershipDetailSnoozeButton")
            }
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.warningBg)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.warningLight, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityIdentifier("membershipDetailSLABanner")
    }

    // MARK: - Tier card

    private func tierCard(_ loaded: MembershipDetailContent, slaMissed: Bool) -> some View {
        VStack(spacing: Spacing.s0) {
            tierStrip(loaded)
            renewalRow(loaded, slaMissed: slaMissed)
            Rectangle()
                .fill(Theme.Color.appBorderSubtle)
                .frame(height: 1)
                .padding(.leading, Spacing.s4)
            paymentRow(loaded)
        }
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .accessibilityIdentifier("membershipDetailTierCard")
    }

    private func tierStrip(_ loaded: MembershipDetailContent) -> some View {
        HStack(alignment: .top, spacing: Spacing.s2) {
            VStack(alignment: .leading, spacing: 2) {
                Text("Your tier")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .kerning(0.6)
                HStack(alignment: .firstTextBaseline, spacing: Spacing.s2) {
                    Text(loaded.tier.displayName)
                        .font(.system(size: 22, weight: .heavy))
                        .foregroundStyle(loaded.tier.fgColor)
                    ladderPill(loaded.tier)
                }
            }
            Spacer(minLength: Spacing.s2)
            VStack(alignment: .trailing, spacing: Spacing.s0) {
                Text(loaded.priceLabel)
                    .font(.system(size: 22, weight: .heavy))
                    .foregroundStyle(Theme.Color.appText)
                Text("/ \(loaded.periodLabel)")
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(loaded.tier.bgColor)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(
            "Your tier \(loaded.tier.displayName), "
                + "\(loaded.tier.ladderRank) of \(MembershipTier.ladderTotal), "
                + "\(loaded.priceLabel) per \(loaded.periodLabel)"
        )
    }

    private func ladderPill(_ tier: MembershipTier) -> some View {
        HStack(spacing: 3) {
            Icon(.crown, size: 10, strokeWidth: 2.2, color: Theme.Color.appTextSecondary)
            Text("\(tier.ladderRank) of \(MembershipTier.ladderTotal)")
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .kerning(0.3)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, 2)
        .background(Theme.Color.appSurface)
        .overlay(Capsule().stroke(Theme.Color.appBorder, lineWidth: 1))
        .clipShape(Capsule())
        .accessibilityHidden(true)
    }

    private func renewalRow(_ loaded: MembershipDetailContent, slaMissed: Bool) -> some View {
        tierInfoRow(
            TierInfoRowModel(
                icon: .calendarClock,
                iconBackground: Theme.Color.primary50,
                iconForeground: Theme.Color.primary600,
                label: "Next renewal",
                value: loaded.renewalLabel,
                valueColor: slaMissed ? Theme.Color.warning : Theme.Color.appText,
                trailingLabel: nil
            )
        )
        .accessibilityIdentifier("membershipDetailRenewalRow")
    }

    private func paymentRow(_ loaded: MembershipDetailContent) -> some View {
        Button(action: onUpdatePayment) {
            tierInfoRow(
                TierInfoRowModel(
                    icon: .wallet,
                    iconBackground: Theme.Color.appSurfaceSunken,
                    iconForeground: Theme.Color.appTextStrong,
                    label: "Payment",
                    value: loaded.paymentLabel,
                    valueColor: Theme.Color.appText,
                    trailingLabel: "Update"
                )
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Payment \(loaded.paymentLabel), update")
        .accessibilityIdentifier("membershipDetailPaymentRow")
    }

    private func tierInfoRow(_ row: TierInfoRowModel) -> some View {
        HStack(spacing: Spacing.s3) {
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .fill(row.iconBackground)
                .frame(width: 30, height: 30)
                .overlay { Icon(row.icon, size: 15, color: row.iconForeground) }
            VStack(alignment: .leading, spacing: 1) {
                Text(row.label)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                Text(row.value)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(row.valueColor)
            }
            Spacer(minLength: Spacing.s2)
            if let trailingLabel = row.trailingLabel {
                Text(trailingLabel)
                    .font(.system(size: 11.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.primary600)
                Icon(.chevronRight, size: 14, color: Theme.Color.appTextMuted)
            }
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Benefits

    private func benefitsCard(_ benefits: [MembershipBenefit]) -> some View {
        VStack(spacing: Spacing.s0) {
            ForEach(Array(benefits.enumerated()), id: \.element.id) { offset, benefit in
                benefitRow(benefit)
                if offset < benefits.count - 1 {
                    Rectangle()
                        .fill(Theme.Color.appBorderSubtle)
                        .frame(height: 1)
                        .padding(.leading, 50)
                }
            }
        }
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityIdentifier("membershipDetailBenefits")
    }

    private func benefitRow(_ benefit: MembershipBenefit) -> some View {
        HStack(alignment: .top, spacing: Spacing.s3) {
            RoundedRectangle(cornerRadius: Radii.sm, style: .continuous)
                .fill(Theme.Color.successBg)
                .frame(width: 26, height: 26)
                .overlay {
                    Icon(.check, size: 14, strokeWidth: 2.5, color: Theme.Color.success)
                }
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: Spacing.s1) {
                    Icon(benefit.icon, size: 13, color: Theme.Color.appTextSecondary)
                    Text(benefit.label)
                        .font(.system(size: 12.5, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                    if let badge = benefit.slaBadge {
                        StatusChip(badge, variant: .success)
                    }
                }
                Text(benefit.meta)
                    .font(.system(size: 10.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            Spacer(minLength: Spacing.s0)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(benefitAccessibilityLabel(benefit))
        .accessibilityIdentifier("membershipDetailBenefit_\(benefit.id)")
    }

    private func benefitAccessibilityLabel(_ benefit: MembershipBenefit) -> String {
        let badge = benefit.slaBadge.map { ". \($0)" } ?? ""
        return "\(benefit.label). \(benefit.meta)\(badge)"
    }

    // MARK: - Inbox card (RN "Open inbox" + quota footnote)

    private func inboxCard(_ loaded: MembershipDetailContent) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text("Inbox")
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            Text("DM the creator. Each new thread uses one of your monthly message credits.")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .fixedSize(horizontal: false, vertical: true)
            Button {
                onOpenInbox(loaded.personaId)
            } label: {
                HStack(spacing: Spacing.s2) {
                    Icon(.messageSquare, size: 15, color: Theme.Color.appTextInverse)
                    Text("Open inbox")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(Theme.Color.appTextInverse)
                }
                .padding(.horizontal, Spacing.s4)
                .frame(height: 42)
                .background(Theme.Color.primary600)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            }
            .buttonStyle(.plain)
            .disabled(loaded.personaId.isEmpty)
            .accessibilityLabel("Open inbox")
            .accessibilityIdentifier("membershipDetailOpenInbox")
            Text(loaded.inbox.footnote)
                .font(.system(size: 10.5))
                .foregroundStyle(Theme.Color.appTextMuted)
                .accessibilityIdentifier("membershipDetailInboxQuota")
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityIdentifier("membershipDetailInboxCard")
    }

    private func scheduledChangeBanner(_: MembershipDetailContent) -> some View {
        HStack(alignment: .top, spacing: Spacing.s2) {
            Icon(.calendarClock, size: 15, color: Theme.Color.primary700)
            Text("A tier change is scheduled — it takes effect at the end of this period.")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.primary700)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: Spacing.s0)
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.infoBg)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .stroke(Theme.Color.infoLight, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .accessibilityIdentifier("membershipDetailScheduledChange")
    }

    private func inlineNotice(_ text: String, identifier: String) -> some View {
        Text(text)
            .font(.system(size: 12, weight: .medium))
            .foregroundStyle(Theme.Color.success)
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityIdentifier(identifier)
    }

    // MARK: - Change tier + cancel

    private var changeTierButton: some View {
        Button {
            viewModel.presentTierPicker()
        } label: {
            HStack(spacing: Spacing.s2) {
                Icon(.arrowDownUp, size: 17, color: Theme.Color.appTextInverse)
                Text("Change tier")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 50)
            .background(Theme.Color.primary600)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Change tier")
        .accessibilityIdentifier("membershipDetailChangeTier")
    }

    private var cancelBlock: some View {
        VStack(spacing: Spacing.s2) {
            // Single-tap cancel by Pantopus policy — no confirm dialog,
            // no retention questions, no last-second offers. Posts to the
            // no-charge cancel route, then hands off to the host on success.
            Button(
                action: { Task { @MainActor in if await viewModel.cancel() { onCancel() } } },
                label: {
                    HStack(spacing: Spacing.s1) {
                        if viewModel.isCancelling {
                            ProgressView().tint(Theme.Color.error)
                        } else {
                            Icon(.x, size: 13, strokeWidth: 2.4, color: Theme.Color.error)
                        }
                        Text("Cancel membership")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(Theme.Color.error)
                    }
                    .frame(maxWidth: .infinity)
                    .frame(minHeight: 44)
                }
            )
            .buttonStyle(.plain)
            .disabled(viewModel.isCancelling)
            .accessibilityLabel("Cancel membership")
            .accessibilityIdentifier("membershipDetailCancel")
            if let actionError = viewModel.actionError {
                Text(actionError)
                    .font(.system(size: 11.5, weight: .medium))
                    .foregroundStyle(Theme.Color.error)
                    .multilineTextAlignment(.center)
                    .accessibilityIdentifier("membershipDetailCancelError")
            }
            VStack(spacing: 2) {
                Text("Single-tap cancel. No retention questions, no last-second offers.")
                    .font(.system(size: 10.5))
                    .foregroundStyle(Theme.Color.appTextMuted)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 260)
                Text("— Pantopus policy")
                    .font(.system(size: 10.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.top, Spacing.s2)
    }

    private func policyFootnote(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 10.5))
            .foregroundStyle(Theme.Color.appTextMuted)
            .multilineTextAlignment(.center)
            .frame(maxWidth: .infinity)
            .accessibilityIdentifier("membershipDetailPolicyFootnote")
    }

    // MARK: - Refund request

    private var requestRefundLink: some View {
        Button {
            viewModel.presentRefundSheet()
        } label: {
            Text("Reply window missed? Request a refund")
                .font(.system(size: 13, weight: .medium))
                .underline()
                .foregroundStyle(Theme.Color.appTextSecondary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .frame(minHeight: 44)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Request a refund")
        .accessibilityIdentifier("membershipDetailRequestRefund")
    }

    private var refundSheet: some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            Text("Request a refund")
                .font(.system(size: 20, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)
            Text(
                "If the creator missed the reply window they committed to, "
                    + "the unused portion of this period is refunded to your card "
                    + "and your membership is cancelled at the end of the period — "
                    + "you keep access until then."
            )
            .pantopusTextStyle(.small)
            .foregroundStyle(Theme.Color.appTextSecondary)
            .fixedSize(horizontal: false, vertical: true)

            HStack(alignment: .top, spacing: Spacing.s2) {
                Icon(.info, size: 15, color: Theme.Color.primary700)
                Text("Reason: the creator missed their reply-policy window.")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.Color.primary700)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: Spacing.s0)
            }
            .padding(Spacing.s3)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Color.infoBg)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            .accessibilityIdentifier("membershipDetailRefundReason")

            if let refundError = viewModel.refundError {
                Text(refundError)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Theme.Color.error)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityIdentifier("membershipDetailRefundError")
            }

            PrimaryButton(
                title: "Request refund",
                isLoading: viewModel.isRequestingRefund,
                isEnabled: !viewModel.isRequestingRefund
            ) {
                await viewModel.requestRefund()
            }
            .accessibilityIdentifier("membershipDetailRefundSubmit")

            Button {
                viewModel.isRefundSheetPresented = false
            } label: {
                Text("Not now")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .frame(maxWidth: .infinity)
                    .frame(height: 44)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("membershipDetailRefundDismiss")
            Spacer(minLength: Spacing.s0)
        }
        .padding(Spacing.s5)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .presentationDetents([.medium, .large])
        .accessibilityIdentifier("membershipRefundSheet")
    }

    // MARK: - Change-tier picker

    private var tierPickerSheet: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            Text("Change tier")
                .font(.system(size: 20, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)
            Text("Upgrades start right away. Downgrades take effect at the end of this period.")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .fixedSize(horizontal: false, vertical: true)

            if let actionError = viewModel.actionError {
                Text(actionError)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Theme.Color.error)
                    .accessibilityIdentifier("membershipTierPickerError")
            }

            if viewModel.tierOptions.isEmpty {
                EmptyState(
                    icon: .crown,
                    headline: "No other tiers",
                    subcopy: "This creator publishes a single tier right now."
                )
                .accessibilityIdentifier("membershipTierPickerEmpty")
            } else {
                ScrollView {
                    VStack(spacing: Spacing.s2) {
                        ForEach(viewModel.tierOptions) { option in
                            tierOptionRow(option)
                        }
                    }
                }
            }

            Button {
                viewModel.isTierPickerPresented = false
            } label: {
                Text("Cancel")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .frame(maxWidth: .infinity)
                    .frame(height: 44)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("membershipTierPickerDismiss")
        }
        .padding(Spacing.s5)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .presentationDetents([.medium, .large])
        .accessibilityIdentifier("membershipTierPicker")
    }

    private func tierOptionRow(_ option: MembershipTierOption) -> some View {
        Button {
            Task { @MainActor in await viewModel.changeTier(to: option) }
        } label: {
            HStack(alignment: .center, spacing: Spacing.s3) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(option.name)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                    Text(option.priceLabel)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                    Text(option.direction.timingNote)
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.appTextMuted)
                }
                Spacer(minLength: Spacing.s2)
                VStack(alignment: .trailing, spacing: Spacing.s1) {
                    Icon(
                        option.direction == .upgrade ? .trendingUp : .trendingDown,
                        size: 15,
                        color: option.direction == .upgrade ? Theme.Color.success : Theme.Color.warning
                    )
                    Text(option.direction.label)
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(
                            option.direction == .upgrade ? Theme.Color.success : Theme.Color.warning
                        )
                }
            }
            .padding(Spacing.s3)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        }
        .buttonStyle(.plain)
        .disabled(viewModel.isChangingTier)
        .accessibilityLabel(
            "\(option.direction.label) to \(option.name), \(option.priceLabel). "
                + option.direction.timingNote
        )
        .accessibilityIdentifier("membershipTierOption_\(option.rank)")
    }
}

private struct TierInfoRowModel {
    let icon: PantopusIcon
    let iconBackground: Color
    let iconForeground: Color
    let label: String
    let value: String
    let valueColor: Color
    let trailingLabel: String?
}

#Preview("Populated") {
    MembershipDetailView(
        viewModel: MembershipDetailViewModel(
            personaId: MembershipSampleData.personaId,
            content: MembershipSampleData.populated
        )
    )
}

#Preview("SLA missed") {
    MembershipDetailView(
        viewModel: MembershipDetailViewModel(personaId: MembershipSampleData.personaId, slaMissed: true)
    )
}
