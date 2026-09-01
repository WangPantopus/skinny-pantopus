//
//  MyBusinessesView.swift
//  Pantopus
//
//  A08 — "My businesses". Bespoke avatar-first row list tinted with the
//  Business identity violet. Renders the enriched
//  `GET /api/businesses/my-businesses` projection (stats / team /
//  verification) as A08 cards, with a violet building FAB and a
//  proof-led empty state. The "Primary" badge from the design is omitted
//  (no primary-business concept in the backend).
//

import SwiftUI

struct MyBusinessesView: View {
    @State private var viewModel: MyBusinessesViewModel

    init(viewModel: MyBusinessesViewModel = MyBusinessesViewModel()) {
        _viewModel = State(initialValue: viewModel)
    }

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            content
            if showsFab {
                AddBusinessFab(action: viewModel.onRegister)
                    .padding(Spacing.s4)
            }
        }
        .background(Theme.Color.appBg)
        .navigationTitle(viewModel.title)
        .navigationBarTitleDisplayMode(.inline)
        .accessibilityIdentifier("myBusinessesContainer")
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .task { await viewModel.load() }
        .onAppear { Analytics.track(.screenMyBusinessesViewed) }
    }

    /// The FAB hides on the empty state (the empty state owns the create CTA).
    private var showsFab: Bool {
        if case .empty = viewModel.state { return false }
        return true
    }

    @ViewBuilder private var content: some View {
        switch viewModel.state {
        case .loading:
            MyBusinessesSkeleton()
        case let .loaded(cards):
            loadedList(cards)
        case .empty:
            MyBusinessesEmptyView(
                onCreate: viewModel.onRegister,
                onClaim: viewModel.onClaim
            )
        case let .error(message):
            MyBusinessesErrorView(message: message) {
                Task { await viewModel.load() }
            }
        }
    }

    private func loadedList(_ cards: [BusinessCardModel]) -> some View {
        ScrollView {
            VStack(spacing: Spacing.s3) {
                BusinessesIntroCard(count: cards.count)
                ForEach(cards) { card in
                    BusinessCardView(model: card) {
                        viewModel.onOpenBusiness(card.id)
                    }
                }
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s3)
            .padding(.bottom, 96)
        }
        .refreshable { await viewModel.refresh() }
    }
}

// MARK: - Intro card

private struct BusinessesIntroCard: View {
    let count: Int

    var body: some View {
        HStack(spacing: Spacing.s3) {
            Icon(.building2, size: 18, color: Theme.Color.business)
                .frame(width: 36, height: 36)
                .background(Theme.Color.appSurface)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.sm, style: .continuous)
                        .stroke(Theme.Color.businessBg, lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: Radii.sm, style: .continuous))
            VStack(alignment: .leading, spacing: 2) {
                Text(count == 1 ? "1 verified business" : "\(count) verified businesses")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                Text("Tap any business to manage its inbox, gigs, and reviews")
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s3)
        .background(Theme.Color.businessBg.opacity(0.4))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.businessBg, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("myBusinessesIntroCard")
    }
}

// MARK: - Business card

private struct BusinessCardView: View {
    let model: BusinessCardModel
    let onOpen: () -> Void

    var body: some View {
        Button(action: onOpen) {
            VStack(alignment: .leading, spacing: Spacing.s0) {
                HStack(alignment: .top, spacing: Spacing.s3) {
                    BusinessLogoTile(model: model)
                    contentColumn
                    Spacer(minLength: Spacing.s1)
                    Icon(.chevronRight, size: 18, color: Theme.Color.appTextSecondary)
                        .padding(.top, 2)
                }
                if model.pending {
                    PendingStrip(onResume: onOpen)
                        .padding(.top, Spacing.s3)
                } else {
                    StatsBand(model: model)
                        .padding(.top, Spacing.s3)
                }
            }
            .padding(Spacing.s3)
            .background(Theme.Color.appSurface)
            .overlay(cardBorder)
            .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(a11yLabel)
        .accessibilityIdentifier("businessCard.\(model.id)")
    }

    @ViewBuilder private var cardBorder: some View {
        if model.pending {
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .strokeBorder(
                    Theme.Color.warningBg,
                    style: StrokeStyle(lineWidth: 1, dash: [4, 3])
                )
        } else {
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        }
    }

    private var contentColumn: some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            Text(model.name)
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
                .lineLimit(1)
            HStack(spacing: Spacing.s1) {
                if let cat = model.categoryLabel {
                    Text(cat)
                        .font(.system(size: 11.5, weight: .semibold))
                        .foregroundStyle(Theme.Color.appTextStrong)
                        .lineLimit(1)
                    Text("·")
                        .font(.system(size: 11.5))
                        .foregroundStyle(Theme.Color.appTextMuted)
                }
                Icon(.mapPin, size: 11, color: Theme.Color.appTextMuted)
                Text(model.locality)
                    .font(.system(size: 11.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .lineLimit(1)
            }
            HStack(spacing: Spacing.s2) {
                if let role = model.role {
                    StatusChip(role.label, variant: role.variant, icon: role.icon)
                }
                if model.teamCount > 0 {
                    HStack(spacing: Spacing.s1) {
                        TeamStack(initials: model.teamInitials, total: model.teamCount)
                        Text("\(model.teamCount) on team")
                            .font(.system(size: 11))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                }
            }
            .padding(.top, 2)
        }
    }

    private var a11yLabel: String {
        var parts = [model.name]
        if let cat = model.categoryLabel { parts.append(cat) }
        parts.append(model.locality)
        if let role = model.role { parts.append(role.label) }
        if model.pending {
            parts.append("Verification pending")
        } else {
            parts.append("\(model.openChats) open chats")
            parts.append("\(model.bookingsThisWeek) bookings this week")
            if model.reviewCount > 0 { parts.append("rated \(model.ratingText)") }
        }
        return parts.joined(separator: ", ")
    }
}

// MARK: - Logo tile

private struct BusinessLogoTile: View {
    let model: BusinessCardModel

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            ZStack {
                RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                    .fill(model.pending ? Theme.Color.warning : model.category.fill)
                if let url = model.logoURL {
                    AsyncImage(url: url) { image in
                        image.resizable().aspectRatio(contentMode: .fill)
                    } placeholder: {
                        glyph
                    }
                    .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
                } else {
                    glyph
                }
            }
            .frame(width: 56, height: 56)

            if model.verified {
                badge(icon: .check, fill: Theme.Color.business, foreground: Theme.Color.appTextInverse)
            } else {
                badge(icon: .hourglass, fill: Theme.Color.appSurface, foreground: Theme.Color.warning)
            }
        }
    }

    private var glyph: some View {
        Icon(model.category.icon, size: 26, strokeWidth: 1.9, color: Theme.Color.appTextInverse)
    }

    private func badge(icon: PantopusIcon, fill: Color, foreground: Color) -> some View {
        Icon(icon, size: 11, strokeWidth: 3, color: foreground)
            .frame(width: 20, height: 20)
            .background(fill)
            .clipShape(Circle())
            .overlay(
                Circle().strokeBorder(Theme.Color.appSurface, lineWidth: 2)
            )
            .offset(x: 3, y: 3)
    }
}

// MARK: - Team stack

private struct TeamStack: View {
    let initials: [String]
    let total: Int

    private let tones: [StatusChipVariant] = [.business, .personal, .warning, .success]

    var body: some View {
        let overflow = total - initials.count
        HStack(spacing: -6) {
            ForEach(Array(initials.enumerated()), id: \.offset) { index, text in
                chip(text: text, variant: tones[index % tones.count])
            }
            if overflow > 0 {
                chip(text: "+\(overflow)", variant: .neutral)
            }
        }
    }

    private func chip(text: String, variant: StatusChipVariant) -> some View {
        Text(text)
            .font(.system(size: 8.5, weight: .bold))
            .foregroundStyle(toneForeground(variant))
            .frame(width: 20, height: 20)
            .background(Circle().fill(toneBackground(variant)))
            .overlay(Circle().strokeBorder(Theme.Color.appSurface, lineWidth: 1.5))
    }

    private func toneBackground(_ variant: StatusChipVariant) -> Color {
        switch variant {
        case .business: Theme.Color.businessBg
        case .personal: Theme.Color.personalBg
        case .warning: Theme.Color.warningBg
        case .success: Theme.Color.successBg
        default: Theme.Color.appSurfaceSunken
        }
    }

    private func toneForeground(_ variant: StatusChipVariant) -> Color {
        switch variant {
        case .business: Theme.Color.business
        case .personal: Theme.Color.personal
        case .warning: Theme.Color.warning
        case .success: Theme.Color.success
        default: Theme.Color.appTextSecondary
        }
    }
}

// MARK: - Stats band

private struct StatsBand: View {
    let model: BusinessCardModel

    var body: some View {
        HStack(spacing: Spacing.s0) {
            cell(icon: .messageSquare, value: "\(model.openChats)", sub: nil, label: "Open chats")
            divider
            cell(icon: .calendarCheck, value: "\(model.bookingsThisWeek)", sub: nil, label: "This week")
            divider
            cell(
                icon: .star,
                value: model.ratingText,
                sub: model.reviewCount > 0 ? "(\(model.reviewCount))" : nil,
                label: "Rating"
            )
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2)
        .background(Theme.Color.appSurfaceSunken)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
    }

    private var divider: some View {
        Rectangle()
            .fill(Theme.Color.appBorder)
            .frame(width: 1, height: 26)
            .padding(.horizontal, Spacing.s2)
    }

    private func cell(icon: PantopusIcon, value: String, sub: String?, label: String) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            HStack(spacing: Spacing.s1) {
                Icon(icon, size: 12, color: Theme.Color.appTextSecondary)
                HStack(alignment: .firstTextBaseline, spacing: 3) {
                    Text(value)
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                    if let sub {
                        Text(sub)
                            .font(.system(size: 10.5, weight: .semibold))
                            .foregroundStyle(Theme.Color.appTextMuted)
                    }
                }
            }
            Text(label)
                .font(.system(size: 10))
                .foregroundStyle(Theme.Color.appTextMuted)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - Pending strip

private struct PendingStrip: View {
    let onResume: () -> Void

    var body: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.hourglass, size: 14, color: Theme.Color.warning)
            VStack(alignment: .leading, spacing: 1) {
                Text("Verification pending")
                    .font(.system(size: 11.5, weight: .bold))
                    .foregroundStyle(Theme.Color.warning)
                Text("Earn the violet verified mark")
                    .font(.system(size: 10.5))
                    .foregroundStyle(Theme.Color.warning.opacity(0.85))
            }
            Spacer(minLength: 0)
            HStack(spacing: Spacing.s1) {
                Text("Verify")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Theme.Color.warning)
                Icon(.arrowRight, size: 11, color: Theme.Color.warning)
            }
            .padding(.horizontal, Spacing.s2)
            .frame(height: 26)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(Theme.Color.warningBg, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2)
        .background(Theme.Color.warningBg.opacity(0.5))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .stroke(Theme.Color.warningBg, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
    }
}

// MARK: - FAB

private struct AddBusinessFab: View {
    let action: @Sendable () -> Void

    var body: some View {
        Button(action: action) {
            Icon(.building2, size: 24, color: Theme.Color.appTextInverse)
                .frame(width: 60, height: 60)
                .background(
                    LinearGradient(
                        colors: [Theme.Color.business, Theme.Color.businessDark],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .clipShape(Circle())
                .pantopusShadow(WizardIdentity.business.ctaShadow)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Create a business")
        .accessibilityIdentifier("myBusinessesFab")
    }
}

#Preview {
    NavigationStack { MyBusinessesView() }
}
