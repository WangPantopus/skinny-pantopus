//
//  TodayDetailView.swift
//  Pantopus
//
//  A10.3 — Hub "Today" briefing. Reached from the Hub's Today card. A custom
//  `ScrollView { LazyVStack }` (not `ContentDetailShell`): a flat-colour hero
//  (no gradients on the mobile shell), a sun-arc card, weather-driven signal
//  rows, an "Around the block" list, and a quiet share card. Today always has
//  data, so the state machine is loading / populated / alert / error — no
//  empty state.
//

// swiftlint:disable file_length

import SwiftUI

struct TodayDetailView: View {
    @State private var viewModel: TodayDetailViewModel
    private let onBack: () -> Void
    private let onShare: () -> Void
    private let onMore: () -> Void
    private let onManage: () -> Void

    init(
        viewModel: TodayDetailViewModel = TodayDetailViewModel(),
        onBack: @escaping () -> Void = {},
        onShare: @escaping () -> Void = {},
        onMore: @escaping () -> Void = {},
        onManage: @escaping () -> Void = {}
    ) {
        _viewModel = State(initialValue: viewModel)
        self.onBack = onBack
        self.onShare = onShare
        self.onMore = onMore
        self.onManage = onManage
    }

    var body: some View {
        VStack(spacing: Spacing.s0) {
            TodayTopBar(
                title: viewModel.headerTitle,
                dateLabel: topBarDate,
                onBack: onBack,
                onShare: onShare,
                onMore: onMore
            )
            content
        }
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("todayDetail")
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .task { await viewModel.load() }
    }

    private var topBarDate: String? {
        switch viewModel.state {
        case let .populated(content), let .alert(content): content.dateLabel
        default: nil
        }
    }

    @ViewBuilder private var content: some View {
        switch viewModel.state {
        case .loading:
            loadingShell
        case let .populated(content):
            briefing(content)
        case let .alert(content):
            briefing(content)
        case let .error(message):
            errorShell(message)
        }
    }

    // MARK: - States

    private func briefing(_ content: TodayDetailContent) -> some View {
        ScrollView {
            LazyVStack(spacing: Spacing.s3) {
                TodayHero(content: content)
                    .padding(.top, Spacing.s3)

                TodaySectionCard(title: "Sun & sky") {
                    SunArcView(sunSky: content.sunSky)
                }
                .accessibilityIdentifier("todayDetailSunSky")

                TodaySectionCard(
                    title: content.signalsTitle,
                    accent: content.signalsAccent,
                    action: SectionAction(label: "Manage", identifier: "todaySignalsManage", handler: onManage)
                ) {
                    SignalsList(signals: content.signals)
                }
                .accessibilityIdentifier("todayDetailSignals")

                if !content.around.isEmpty {
                    TodaySectionCard(title: content.aroundTitle) {
                        AroundList(items: content.around)
                    }
                    .accessibilityIdentifier("todayDetailAround")
                }

                ShareCardView(share: content.share, onShare: onShare)
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.bottom, Spacing.s8)
        }
        .background(Theme.Color.appBg)
    }

    private var loadingShell: some View {
        ScrollView {
            LazyVStack(spacing: Spacing.s3) {
                Shimmer(height: 168, cornerRadius: Radii.xl).padding(.top, Spacing.s3)
                Shimmer(height: 120, cornerRadius: Radii.xl)
                Shimmer(height: 240, cornerRadius: Radii.xl)
                Shimmer(height: 92, cornerRadius: Radii.xl)
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.bottom, Spacing.s8)
        }
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("todayDetailLoading")
    }

    private func errorShell(_ message: String) -> some View {
        EmptyState(
            icon: .alertCircle,
            headline: "Couldn't load today",
            subcopy: message,
            cta: EmptyState.CTA(title: "Try again") { await viewModel.refresh() }
        )
        .accessibilityIdentifier("todayDetailError")
    }
}

// MARK: - Top bar

private struct TodayTopBar: View {
    var title: String = "Today"
    let dateLabel: String?
    let onBack: () -> Void
    let onShare: () -> Void
    let onMore: () -> Void

    var body: some View {
        HStack(spacing: Spacing.s2) {
            Button(action: onBack) {
                Icon(.chevronLeft, size: 22, color: Theme.Color.appText)
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Back")
            .accessibilityIdentifier("todayBackButton")

            Spacer(minLength: Spacing.s0)

            VStack(spacing: 2) {
                Text(title)
                    .pantopusTextStyle(.small)
                    .fontWeight(.semibold)
                    .foregroundStyle(Theme.Color.appText)
                    .accessibilityIdentifier("todayHeaderTitle")
                if let dateLabel {
                    Text(dateLabel)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextMuted)
                }
            }
            .accessibilityElement(children: .combine)
            .accessibilityAddTraits(.isHeader)

            Spacer(minLength: Spacing.s0)

            Button(action: onShare) {
                Icon(.share, size: 22, color: Theme.Color.appText)
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Share today's briefing")
            .accessibilityIdentifier("todayShareButton")

            Button(action: onMore) {
                Icon(.moreHorizontal, size: 22, color: Theme.Color.appText)
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("More options")
            .accessibilityIdentifier("todayMoreButton")
        }
        .padding(.horizontal, Spacing.s2)
        .frame(height: 48)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
        }
    }
}

// MARK: - Hero

private struct TodayHero: View {
    let content: TodayDetailContent

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            HStack(spacing: Spacing.s1) {
                Icon(content.isAlert ? .alertTriangle : .mapPin, size: 12, color: kickerColor)
                Text(content.kicker)
                    .pantopusTextStyle(.overline)
                    .foregroundStyle(kickerColor)
            }

            HStack(alignment: .top, spacing: Spacing.s3) {
                VStack(alignment: .leading, spacing: Spacing.s1) {
                    HStack(alignment: .firstTextBaseline, spacing: Spacing.s2) {
                        Text(content.temperature)
                            .pantopusTextStyle(.h1)
                            .foregroundStyle(Theme.Color.appText)
                        Text(content.condition)
                            .pantopusTextStyle(.body)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                    Text(content.highLowFeels)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                Spacer(minLength: Spacing.s2)
                ZStack {
                    RoundedRectangle(cornerRadius: Radii.xl)
                        .fill(Theme.Color.appSurfaceSunken)
                    Icon(content.glyph, size: 30, color: Theme.Color.primary600)
                }
                .frame(width: 56, height: 56)
                .accessibilityHidden(true)
            }

            if let ribbon = content.ribbon {
                TodayRibbon(ribbon: ribbon)
            }

            TodayChipFlow(spacing: Spacing.s2) {
                ForEach(content.chips) { chip in
                    HeroChip(chip: chip)
                }
            }
            .accessibilityIdentifier("todayDetailChips")
        }
        .padding(Spacing.s4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl))
        .pantopusShadow(.sm)
        .accessibilityIdentifier("todayDetailHero")
    }

    private var kickerColor: Color {
        content.isAlert ? Theme.Color.error : Theme.Color.primary600
    }
}

private struct TodayRibbon: View {
    let ribbon: TodayAlertRibbon

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.s2) {
            Icon(.alertTriangle, size: 16, color: Theme.Color.error)
            VStack(alignment: .leading, spacing: 2) {
                Text(ribbon.title)
                    .pantopusTextStyle(.caption)
                    .fontWeight(.semibold)
                    .foregroundStyle(Theme.Color.error)
                Text(ribbon.body)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextStrong)
            }
            Spacer(minLength: Spacing.s0)
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.errorBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md))
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("todayDetailRibbon")
    }
}

private struct HeroChip: View {
    let chip: TodayHeroChip

    var body: some View {
        HStack(spacing: Spacing.s1) {
            if let dot = chip.dotTone {
                Circle().fill(dot.foreground).frame(width: 7, height: 7)
            }
            Icon(chip.icon, size: 12, color: Theme.Color.appTextStrong)
            Text(chip.label)
                .pantopusTextStyle(.overline)
                .foregroundStyle(Theme.Color.appTextSecondary)
            Text(chip.value)
                .pantopusTextStyle(.caption)
                .fontWeight(.semibold)
                .foregroundStyle(Theme.Color.appText)
            if let scale = chip.scale {
                Text(scale)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
        }
        .padding(.vertical, Spacing.s1)
        .padding(.horizontal, Spacing.s2)
        .background(Theme.Color.appSurfaceSunken)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(chip.label) \(chip.value)\(chip.scale.map { ", \($0)" } ?? "")")
        .accessibilityIdentifier("todayChip-\(chip.label)")
    }
}

// MARK: - Section card

private struct SectionAction {
    let label: String
    let identifier: String
    let handler: () -> Void
}

private struct TodaySectionCard<Content: View>: View {
    let title: String
    var accent: TodayTone?
    var action: SectionAction?
    @ViewBuilder var content: () -> Content

    init(
        title: String,
        accent: TodayTone? = nil,
        action: SectionAction? = nil,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.title = title
        self.accent = accent
        self.action = action
        self.content = content
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            HStack(spacing: Spacing.s1) {
                if let accent {
                    Circle().fill(accent.foreground).frame(width: 6, height: 6)
                }
                Text(title)
                    .pantopusTextStyle(.overline)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .accessibilityAddTraits(.isHeader)
                Spacer(minLength: Spacing.s2)
                if let action {
                    Button(action: action.handler) {
                        Text(action.label)
                            .pantopusTextStyle(.caption)
                            .fontWeight(.semibold)
                            .foregroundStyle(Theme.Color.primary600)
                            .frame(minWidth: 44, minHeight: 44, alignment: .trailing)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("\(action.label) \(title)")
                    .accessibilityIdentifier(action.identifier)
                }
            }
            .frame(minHeight: 44)
            .padding(.horizontal, Spacing.s3)

            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl)
                .stroke(Theme.Color.appBorderSubtle, lineWidth: 1)
        )
        .pantopusShadow(.sm)
    }
}

// MARK: - Sun & sky

private struct SunArcView: View {
    let sunSky: TodaySunSky

    var body: some View {
        VStack(spacing: Spacing.s2) {
            GeometryReader { geo in
                let w = geo.size.width
                let h: CGFloat = 80
                let pad: CGFloat = 8
                let baseY = h - 6
                let peakY: CGFloat = 6
                let startX = pad
                let endX = w - pad
                let cx = w / 2
                let t = max(0, min(1, sunSky.progress))
                let sunX = (1 - t) * (1 - t) * startX + 2 * (1 - t) * t * cx + t * t * endX
                let sunY = (1 - t) * (1 - t) * baseY + 2 * (1 - t) * t * peakY + t * t * baseY

                ZStack {
                    Path { path in
                        path.move(to: CGPoint(x: 0, y: baseY))
                        path.addLine(to: CGPoint(x: w, y: baseY))
                    }
                    .stroke(Theme.Color.appBorder, style: StrokeStyle(lineWidth: 1, dash: [2, 4]))

                    Path { path in
                        path.move(to: CGPoint(x: startX, y: baseY))
                        path.addQuadCurve(to: CGPoint(x: endX, y: baseY), control: CGPoint(x: cx, y: peakY))
                    }
                    .stroke(Theme.Color.warning, style: StrokeStyle(lineWidth: 2.5, lineCap: .round))

                    Circle().fill(Theme.Color.warning.opacity(0.18))
                        .frame(width: 28, height: 28)
                        .position(x: sunX, y: sunY)
                    Circle().fill(Theme.Color.warning)
                        .frame(width: 20, height: 20)
                        .position(x: sunX, y: sunY)
                }
            }
            .frame(height: 80)
            .accessibilityHidden(true)

            HStack(alignment: .top) {
                sunLabel(sunSky.sunrise, caption: "Sunrise", alignment: .leading)
                Spacer(minLength: Spacing.s2)
                VStack(spacing: 1) {
                    Text(sunSky.phaseLabel)
                        .pantopusTextStyle(.overline)
                        .foregroundStyle(Theme.Color.warning)
                    Text(sunSky.daylight)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                Spacer(minLength: Spacing.s2)
                sunLabel(sunSky.sunset, caption: "Sunset", alignment: .trailing)
            }
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.bottom, Spacing.s3)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(
            "Sunrise \(sunSky.sunrise), sunset \(sunSky.sunset). \(sunSky.phaseLabel), \(sunSky.daylight)."
        )
    }

    private func sunLabel(_ value: String, caption: String, alignment: HorizontalAlignment) -> some View {
        VStack(alignment: alignment, spacing: 1) {
            Text(value)
                .pantopusTextStyle(.caption)
                .fontWeight(.semibold)
                .foregroundStyle(Theme.Color.appText)
            Text(caption)
                .pantopusTextStyle(.overline)
                .foregroundStyle(Theme.Color.appTextMuted)
        }
    }
}

// MARK: - Signals

private struct SignalsList: View {
    let signals: [TodaySignal]

    var body: some View {
        VStack(spacing: Spacing.s0) {
            ForEach(Array(signals.enumerated()), id: \.element.id) { index, signal in
                if index > 0 {
                    Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
                }
                SignalRow(signal: signal)
            }
        }
    }
}

private struct SignalRow: View {
    let signal: TodaySignal

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.s2) {
            ZStack {
                RoundedRectangle(cornerRadius: Radii.md).fill(signal.tone.tint)
                Icon(signal.icon, size: 15, color: signal.tone.foreground)
            }
            .frame(width: 32, height: 32)
            .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: Spacing.s1) {
                    Text(signal.title)
                        .pantopusTextStyle(.caption)
                        .fontWeight(.semibold)
                        .foregroundStyle(Theme.Color.appText)
                    if let severity = signal.severity {
                        SeverityPill(severity: severity)
                    }
                }
                Text(signal.body)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Spacer(minLength: Spacing.s2)

            Text(signal.timing)
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextMuted)
        }
        .padding(.vertical, Spacing.s3)
        .padding(.horizontal, Spacing.s3)
        .overlay(alignment: .leading) {
            if let severity = signal.severity {
                Rectangle()
                    .fill(severity.tone.foreground)
                    .frame(width: 4)
                    .frame(maxHeight: .infinity)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityText)
        .accessibilityIdentifier("todaySignal-\(signal.id)")
    }

    private var accessibilityText: String {
        let severity = signal.severity.map { "\($0.label). " } ?? ""
        return "\(severity)\(signal.title). \(signal.body) \(signal.timing)."
    }
}

private struct SeverityPill: View {
    let severity: TodaySignal.Severity

    var body: some View {
        Text(severity.label)
            .pantopusTextStyle(.overline)
            .foregroundStyle(severity.tone.foreground)
            .padding(.vertical, 1)
            .padding(.horizontal, Spacing.s1)
            .background(severity.tone.tint)
            .clipShape(Capsule())
    }
}

// MARK: - Around the block

private struct AroundList: View {
    let items: [TodayAroundItem]

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            ForEach(items) { item in
                HStack(spacing: Spacing.s2) {
                    Circle().fill(item.tone.foreground).frame(width: 6, height: 6)
                    Text(item.text)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextStrong)
                    Spacer(minLength: Spacing.s0)
                }
                .accessibilityElement(children: .combine)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, Spacing.s3)
        .padding(.bottom, Spacing.s3)
    }
}

// MARK: - Share card

private struct ShareCardView: View {
    let share: TodayShareCard
    let onShare: () -> Void

    var body: some View {
        HStack(spacing: Spacing.s3) {
            ZStack {
                RoundedRectangle(cornerRadius: Radii.lg).fill(Theme.Color.primary50)
                Icon(.share, size: 18, color: Theme.Color.primary600)
            }
            .frame(width: 40, height: 40)
            .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 2) {
                Text(share.title)
                    .pantopusTextStyle(.caption)
                    .fontWeight(.semibold)
                    .foregroundStyle(Theme.Color.appText)
                Text(share.subtitle)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }

            Spacer(minLength: Spacing.s2)

            Button(action: onShare) {
                HStack(spacing: Spacing.s1) {
                    Icon(.send, size: 13, color: Theme.Color.appTextInverse)
                    Text("Share")
                        .pantopusTextStyle(.caption)
                        .fontWeight(.semibold)
                        .foregroundStyle(Theme.Color.appTextInverse)
                }
                .padding(.horizontal, Spacing.s3)
                .frame(height: 44)
                .background(Theme.Color.primary600)
                .clipShape(Capsule())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Share")
            .accessibilityIdentifier("todayShareCardButton")
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl)
                .stroke(Theme.Color.appBorderSubtle, lineWidth: 1)
        )
        .pantopusShadow(.sm)
        .accessibilityIdentifier("todayDetailShareCard")
    }
}

// MARK: - Tone → colour mapping

private extension TodayTone {
    /// Foreground / accent colour (icon, dot, severity text).
    var foreground: Color {
        switch self {
        case .neutral: Theme.Color.appTextStrong
        case .personal: Theme.Color.personal
        case .home: Theme.Color.home
        case .business: Theme.Color.business
        case .success: Theme.Color.success
        case .warning: Theme.Color.warning
        case .error: Theme.Color.error
        }
    }

    /// Pale tinted background (icon tile, severity pill).
    var tint: Color {
        switch self {
        case .neutral: Theme.Color.appSurfaceSunken
        case .personal: Theme.Color.personalBg
        case .home: Theme.Color.homeBg
        case .business: Theme.Color.businessBg
        case .success: Theme.Color.successBg
        case .warning: Theme.Color.warningBg
        case .error: Theme.Color.errorBg
        }
    }
}

// MARK: - Flow layout (wraps the hero chip row on narrow widths)

private struct TodayChipFlow: Layout {
    var spacing: CGFloat

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache _: inout ()) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        var rowWidth: CGFloat = 0
        var rowHeight: CGFloat = 0
        var totalHeight: CGFloat = 0
        var maxRowWidth: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if rowWidth > 0, rowWidth + spacing + size.width > maxWidth {
                totalHeight += rowHeight + spacing
                maxRowWidth = max(maxRowWidth, rowWidth)
                rowWidth = size.width
                rowHeight = size.height
            } else {
                rowWidth += (rowWidth > 0 ? spacing : 0) + size.width
                rowHeight = max(rowHeight, size.height)
            }
        }
        totalHeight += rowHeight
        maxRowWidth = max(maxRowWidth, rowWidth)
        let width = maxWidth.isFinite ? maxWidth : maxRowWidth
        return CGSize(width: width, height: totalHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal _: ProposedViewSize, subviews: Subviews, cache _: inout ()) {
        var x = bounds.minX
        var y = bounds.minY
        var rowHeight: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x > bounds.minX, x + size.width > bounds.maxX {
                x = bounds.minX
                y += rowHeight + spacing
                rowHeight = 0
            }
            subview.place(at: CGPoint(x: x, y: y), anchor: .topLeading, proposal: ProposedViewSize(size))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
    }
}

// MARK: - Previews

#Preview("Populated") {
    TodayDetailView(viewModel: TodayDetailViewModel(content: TodaySampleData.populated))
}

#Preview("Alert") {
    TodayDetailView(viewModel: TodayDetailViewModel(content: TodaySampleData.alert))
}

#Preview("Loading") {
    TodayDetailView(viewModel: TodayDetailViewModel(state: .loading))
}

#Preview("Error") {
    TodayDetailView(viewModel: TodayDetailViewModel(state: .error(message: "Network unavailable.")))
}
