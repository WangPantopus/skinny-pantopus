//
//  ViewAsView.swift
//  Pantopus
//
//  B5.2 (A18.5) — "View as" identity preview. A `ViewerPicker` at the top
//  ("Preview your profile as": Public · Persona audience · Neighbor ·
//  Connection · Gig participant · Household) drives a live render of YOUR
//  profile as that audience sees it. Fields the audience can't see render
//  behind a `RedactionScrim` (heavy lock chip); switching the chip re-
//  resolves the whole card. There is no primary action — the rendered card
//  IS the output; the only nav affordances are the top-bar Edit pill and
//  the inline "Manage privacy" link (→ A14.7 Privacy).
//
//  Layout mirrors `docs/designs/A18/view-as-frames.jsx`: TopBarVA →
//  ChipRowVA (the `ViewerPicker` primitive) → PreviewRenderVA (banner +
//  head + badges + fields + context strip) → PrivacyFooterVA.
//

// swiftlint:disable file_length

import SwiftUI

@MainActor
public struct ViewAsView: View {
    @State private var viewModel: ViewAsViewModel
    private let onBack: @MainActor () -> Void
    private let onManagePrivacy: @MainActor () -> Void
    private let onEdit: @MainActor () -> Void

    public init(
        viewModel: ViewAsViewModel = ViewAsViewModel(),
        onBack: @escaping @MainActor () -> Void = {},
        onManagePrivacy: @escaping @MainActor () -> Void = {},
        onEdit: @escaping @MainActor () -> Void = {}
    ) {
        _viewModel = State(initialValue: viewModel)
        self.onBack = onBack
        self.onManagePrivacy = onManagePrivacy
        self.onEdit = onEdit
    }

    public var body: some View {
        VStack(spacing: Spacing.s0) {
            ViewAsTopBar(onBack: onBack, onEdit: onEdit)
            ViewerPicker(
                selection: viewModel.selected,
                title: "Preview your profile as"
            ) { viewModel.select($0) }
            content
        }
        .background(Theme.Color.appBg)
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .accessibilityIdentifier("viewAs")
        .task { await viewModel.load() }
    }

    @ViewBuilder private var content: some View {
        switch viewModel.state {
        case .loading:
            ViewAsLoadingLayout()
        case let .loaded(loaded):
            VStack(spacing: Spacing.s0) {
                ScrollView {
                    ViewAsPreviewCard(render: loaded.render)
                        .padding(Spacing.s4)
                }
                .accessibilityIdentifier("viewAsContent")
                ViewAsPrivacyFooter(
                    text: loaded.render.footerText,
                    onManagePrivacy: onManagePrivacy
                )
            }
        }
    }
}

// MARK: - Top bar

@MainActor
struct ViewAsTopBar: View {
    let onBack: @MainActor () -> Void
    let onEdit: @MainActor () -> Void

    var body: some View {
        ZStack {
            Text("View as")
                .font(.system(size: 15, weight: .bold))
                .tracking(-0.15)
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)

            HStack {
                Button(action: onBack) {
                    Icon(.chevronLeft, size: 20, strokeWidth: 2.2, color: Theme.Color.appText)
                        .frame(width: 36, height: 36)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Back")
                .accessibilityIdentifier("viewAsBackButton")

                Spacer()

                Button(action: onEdit) {
                    HStack(spacing: Spacing.s1) {
                        Icon(.slidersHorizontal, size: 13, strokeWidth: 2.2, color: Theme.Color.appTextSecondary)
                        Text("Edit")
                            .font(.system(size: 12.5, weight: .semibold))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                    .padding(.horizontal, Spacing.s3)
                    .frame(height: 30)
                    .background(Capsule(style: .continuous).fill(Theme.Color.appSurfaceSunken))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Edit profile")
                .accessibilityIdentifier("viewAsEditButton")
            }
        }
        .padding(.horizontal, Spacing.s2)
        .frame(height: 52)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
        }
    }
}

// MARK: - Loading

@MainActor
struct ViewAsLoadingLayout: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                Shimmer(height: 44, cornerRadius: Radii.lg)
                HStack(spacing: Spacing.s3) {
                    Shimmer(width: 60, height: 60, cornerRadius: 30)
                    VStack(alignment: .leading, spacing: Spacing.s2) {
                        Shimmer(width: 150, height: 18, cornerRadius: Radii.sm)
                        Shimmer(width: 110, height: 12, cornerRadius: Radii.sm)
                    }
                    Spacer(minLength: Spacing.s0)
                }
                Shimmer(height: 26, cornerRadius: Radii.pill)
                ForEach(0..<5, id: \.self) { _ in
                    Shimmer(height: 46, cornerRadius: Radii.md)
                }
            }
            .padding(Spacing.s5)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .padding(Spacing.s4)
        }
        .accessibilityIdentifier("viewAsLoading")
    }
}

// MARK: - Preview render card

@MainActor
struct ViewAsPreviewCard: View {
    let render: ViewAsRender

    var body: some View {
        VStack(spacing: Spacing.s0) {
            ViewAsBannerStrip(banner: render.banner)
            ViewAsProfileHead(head: render.head)
            ViewAsBadgeRow(badges: render.badges)
            VStack(spacing: Spacing.s0) {
                ForEach(render.fields) { ViewAsFieldRow(field: $0) }
            }
            .padding(.horizontal, Spacing.s4)
            ViewAsContextStrip(note: render.note)
        }
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(render.banner.tone.cardBorder, lineWidth: 1.5)
        )
        .pantopusShadow(.lg)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("viewAsPreviewCard")
    }
}

// MARK: - Banner strip

@MainActor
struct ViewAsBannerStrip: View {
    let banner: ViewAsBanner

    var body: some View {
        HStack(spacing: Spacing.s2) {
            ZStack {
                Circle()
                    .fill(Theme.Color.appSurface)
                    .overlay(Circle().strokeBorder(banner.tone.bannerBorder, lineWidth: 1))
                Icon(banner.icon, size: 14, strokeWidth: 2.2, color: banner.tone.accent)
            }
            .frame(width: 26, height: 26)

            VStack(alignment: .leading, spacing: Spacing.s0) {
                Text("Viewing as \(banner.viewerLabel)")
                    .font(.system(size: 12.5, weight: .bold))
                    .tracking(-0.05)
                    .foregroundStyle(banner.tone.foreground)
                Text(banner.subtitle)
                    .font(.system(size: 10.5, weight: .medium))
                    .foregroundStyle(banner.tone.foreground.opacity(0.85))
            }

            Spacer(minLength: Spacing.s0)

            LiveBadge(tone: banner.tone.accent)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, 9)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(banner.tone.bannerBg)
        .overlay(alignment: .bottom) {
            Rectangle().fill(banner.tone.bannerBorder).frame(height: 1)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Viewing as \(banner.viewerLabel). \(banner.subtitle). Live.")
        .accessibilityIdentifier("viewAsBanner")
    }
}

// MARK: - Profile head

@MainActor
struct ViewAsProfileHead: View {
    let head: ViewAsHead

    var body: some View {
        HStack(spacing: Spacing.s3) {
            ZStack(alignment: .bottomTrailing) {
                Circle()
                    .fill(
                        LinearGradient(
                            colors: head.avatarTone.gradient,
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 60, height: 60)
                    .overlay(
                        Text(head.initials)
                            .font(.system(size: 22, weight: .bold))
                            .tracking(-0.5)
                            .foregroundStyle(Theme.Color.appTextInverse)
                    )
                if head.verified {
                    ZStack {
                        Circle().fill(Theme.Color.primary600)
                        Icon(.check, size: 11, strokeWidth: 3.4, color: Theme.Color.appTextInverse)
                    }
                    .frame(width: 22, height: 22)
                    .overlay(Circle().strokeBorder(Theme.Color.appSurface, lineWidth: 2.5))
                    .offset(x: 2, y: 2)
                }
            }
            .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: Spacing.s0) {
                Text(head.name)
                    .font(.system(size: 18, weight: .bold))
                    .tracking(-0.3)
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(1)
                if let handle = head.handle {
                    Text(handle)
                        .font(.system(size: 12.5, weight: .medium))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .lineLimit(1)
                        .padding(.top, 1)
                }
                ViewAsIdentityChip(identity: head.identity)
                    .padding(.top, Spacing.s1)
            }
            Spacer(minLength: Spacing.s0)
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s4)
        .padding(.bottom, Spacing.s1)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(head.name), \(head.identity.label) identity\(head.verified ? ", verified" : "")")
    }
}

@MainActor
private struct ViewAsIdentityChip: View {
    let identity: ViewAsIdentityPill

    var body: some View {
        HStack(spacing: Spacing.s1) {
            Icon(.user, size: 11, strokeWidth: 2.4, color: identity.foreground)
            Text(identity.label)
                .font(.system(size: 10.5, weight: .bold))
                .tracking(0.02)
                .foregroundStyle(identity.foreground)
        }
        .padding(.horizontal, Spacing.s2)
        .frame(height: 21)
        .background(Capsule(style: .continuous).fill(identity.background))
    }
}

// MARK: - Verification badges

@MainActor
struct ViewAsBadgeRow: View {
    let badges: [ViewAsBadge]

    var body: some View {
        FlowLayoutViewAs(spacing: Spacing.s1) {
            ForEach(badges) { ViewAsBadgePill(badge: $0) }
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s2)
        .padding(.bottom, 14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityIdentifier("viewAsBadges")
    }
}

@MainActor
private struct ViewAsBadgePill: View {
    let badge: ViewAsBadge

    var body: some View {
        HStack(spacing: 5) {
            Icon(badge.isOn ? badge.icon : .lock, size: 12, strokeWidth: 2.3, color: foreground)
            Text(badge.label)
                .font(.system(size: 11, weight: .semibold))
                .tracking(-0.02)
                .foregroundStyle(foreground)
        }
        .padding(.horizontal, Spacing.s2)
        .frame(height: 26)
        .background(Capsule(style: .continuous).fill(background))
        .overlay(Capsule(style: .continuous).strokeBorder(border, lineWidth: 1))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(badge.isOn ? "\(badge.label)" : "\(badge.label), not shown")
        .accessibilityIdentifier("viewAsBadge_\(badge.id)")
    }

    private var foreground: Color {
        badge.isOn ? Theme.Color.success : Theme.Color.appTextMuted
    }

    private var background: Color {
        badge.isOn ? Theme.Color.successBg : Theme.Color.appSurfaceSunken
    }

    private var border: Color {
        badge.isOn ? Theme.Color.successLight : Theme.Color.appBorder
    }
}

// MARK: - Field row

@MainActor
struct ViewAsFieldRow: View {
    let field: ViewAsField

    var body: some View {
        HStack(spacing: 11) {
            ZStack {
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .fill(field.disclosure.isHidden ? Theme.Color.appSurfaceSunken : Theme.Color.primary50)
                Icon(
                    field.disclosure.isHidden ? .lock : field.icon,
                    size: 14,
                    strokeWidth: 2.2,
                    color: field.disclosure.isHidden ? Theme.Color.appTextMuted : Theme.Color.primary600
                )
            }
            .frame(width: 30, height: 30)

            VStack(alignment: .leading, spacing: 2) {
                Text(field.label.uppercased())
                    .font(.system(size: 10.5, weight: .bold))
                    .tracking(0.4)
                    .foregroundStyle(Theme.Color.appTextMuted)
                valueArea
            }

            Spacer(minLength: Spacing.s0)

            if !field.disclosure.isHidden {
                Icon(.eye, size: 14, strokeWidth: 2, color: Theme.Color.primary400)
            }
        }
        .padding(.vertical, 11)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityText)
        .accessibilityIdentifier("viewAsField_\(field.id)")
    }

    @ViewBuilder private var valueArea: some View {
        if let value = field.disclosure.shownValue {
            Text(value)
                .font(.system(size: 13.5, weight: .semibold))
                .tracking(-0.05)
                .foregroundStyle(Theme.Color.appText)
                .lineLimit(1)
        } else {
            // Withheld — wrap a privacy-safe placeholder bar in the
            // RedactionScrim primitive so the heavy lock chip floats over
            // a blurred field shape (the real value is never rendered).
            RedactionScrim(level: .hidden, label: "Hidden") {
                RoundedRectangle(cornerRadius: Radii.xs, style: .continuous)
                    .fill(Theme.Color.appBorderStrong)
                    .frame(width: 104, height: 10)
                    .frame(maxWidth: .infinity, minHeight: 22, alignment: .leading)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private var accessibilityText: String {
        if let value = field.disclosure.shownValue {
            return "\(field.label): \(value)"
        }
        return "\(field.label): hidden from this viewer"
    }
}

// MARK: - Context strip

@MainActor
struct ViewAsContextStrip: View {
    let note: ViewAsContextNote

    var body: some View {
        HStack(alignment: .center, spacing: 9) {
            Icon(note.icon, size: 16, strokeWidth: 2, color: note.tone.accent)
            Text(note.text)
                .font(.system(size: 11.5, weight: .semibold))
                .foregroundStyle(note.tone.noteForeground)
                .lineSpacing(2)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, 11)
        .background(note.tone.bannerBg)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(note.tone.bannerBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s1)
        .padding(.bottom, Spacing.s4)
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Privacy footer

@MainActor
struct ViewAsPrivacyFooter: View {
    let text: String
    let onManagePrivacy: @MainActor () -> Void

    var body: some View {
        Button(action: onManagePrivacy) {
            HStack(alignment: .top, spacing: Spacing.s2) {
                Icon(.shieldCheck, size: 16, strokeWidth: 2, color: Theme.Color.primary600)
                    .padding(.top, 1)
                (
                    Text("\(text) ")
                        .font(.system(size: 11.5))
                        .foregroundColor(Theme.Color.appTextSecondary)
                        + Text("Manage privacy")
                        .font(.system(size: 11.5, weight: .bold))
                        .foregroundColor(Theme.Color.primary600)
                )
                .multilineTextAlignment(.leading)
                Spacer(minLength: Spacing.s0)
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s3)
            .padding(.bottom, Spacing.s5)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Color.appSurface)
        }
        .buttonStyle(.plain)
        .overlay(alignment: .top) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
        }
        .accessibilityLabel("\(text) Manage privacy")
        .accessibilityAddTraits(.isButton)
        .accessibilityIdentifier("viewAsManagePrivacy")
    }
}

// MARK: - Tone palette

extension ViewAsTone {
    var accent: Color {
        switch self {
        case .info: Theme.Color.primary600
        case .restricted: Theme.Color.warning
        }
    }

    var foreground: Color {
        switch self {
        case .info: Theme.Color.primary700
        case .restricted: Theme.Color.warning
        }
    }

    var noteForeground: Color {
        switch self {
        case .info: Theme.Color.primary700
        case .restricted: Theme.Color.warning
        }
    }

    var bannerBg: Color {
        switch self {
        case .info: Theme.Color.primary50
        case .restricted: Theme.Color.warningBg
        }
    }

    var bannerBorder: Color {
        switch self {
        case .info: Theme.Color.primary100
        case .restricted: Theme.Color.warningLight
        }
    }

    var cardBorder: Color {
        switch self {
        case .info: Theme.Color.primary200
        case .restricted: Theme.Color.warningLight
        }
    }
}

// MARK: - Flow layout

/// Minimal wrapping flow layout for the verification-badge row.
private struct FlowLayoutViewAs: Layout {
    let spacing: CGFloat

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache _: inout ()) -> CGSize {
        let width = proposal.width ?? 0
        var x: CGFloat = 0
        var rowHeight: CGFloat = 0
        var total: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x + size.width > width {
                total += rowHeight + spacing
                x = size.width + spacing
                rowHeight = size.height
            } else {
                x += size.width + spacing
                rowHeight = max(rowHeight, size.height)
            }
        }
        total += rowHeight
        return CGSize(width: width, height: total)
    }

    func placeSubviews(in bounds: CGRect, proposal _: ProposedViewSize, subviews: Subviews, cache _: inout ()) {
        var x = bounds.minX
        var y = bounds.minY
        var rowHeight: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x + size.width > bounds.maxX {
                x = bounds.minX
                y += rowHeight + spacing
                rowHeight = 0
            }
            view.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
    }
}

// MARK: - Preview

#Preview("Connection") {
    ViewAsView(viewModel: ViewAsViewModel(selected: .connection, startLoaded: true))
}

#Preview("Public") {
    ViewAsView(viewModel: ViewAsViewModel(selected: .public, startLoaded: true))
}

#Preview("Loading") {
    ViewAsView(viewModel: ViewAsViewModel(selected: .connection, startLoaded: false))
}
