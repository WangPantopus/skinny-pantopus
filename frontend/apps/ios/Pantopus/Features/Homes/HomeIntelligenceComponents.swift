//
//  HomeIntelligenceComponents.swift
//  Pantopus
//
//  The Home Intelligence stack rendered under the dashboard's Overview
//  tab: health-score ring, seasonal checklist, property value, and bill
//  trends. Mirrors RN's `components/home/{HealthScoreRing,
//  SeasonalChecklist,PropertyValueCard,BillTrendChart}.tsx`.
//
//  Every card owns its four states (loading / loaded / empty / error) so
//  a single failing read never blanks the dashboard.
//
// swiftlint:disable file_length large_tuple

import SwiftUI

// MARK: - Health score ring

/// `GET /api/homes/:id/health-score` — 0-100 composite with the single
/// highest-leverage next action.
struct HealthScoreRingCard: View {
    let state: HomeIntelligenceCardState<HomeHealthScoreDTO>
    /// Receives a dashboard action id ("view_bills", "view_emergency", …).
    let onAction: (String) -> Void
    let onRetry: () -> Void

    private static let ringSize: CGFloat = 120
    private static let ringWidth: CGFloat = 8

    var body: some View {
        DashboardCard(title: "Home health", accent: Theme.Color.home) {
            switch state {
            case .loading:
                loadingBody
            case .forbidden:
                unavailableBody(message: "You don't have access to this home's health score.")
            case let .failed(message):
                errorBody(message: message)
            case let .loaded(score):
                if score.isBrandNewHome {
                    onboardingBody
                } else {
                    scoreBody(score)
                }
            }
        }
        .accessibilityIdentifier("homeDashboard_healthScoreCard")
    }

    // MARK: States

    private var loadingBody: some View {
        VStack(spacing: Spacing.s3) {
            Shimmer(width: Self.ringSize, height: Self.ringSize, cornerRadius: Self.ringSize / 2)
            Shimmer(width: 180, height: 12)
            Shimmer(width: 120, height: 12)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Spacing.s2)
    }

    private func errorBody(message: String) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text("Couldn't load home health")
                .pantopusTextStyle(.small)
                .fontWeight(.semibold)
                .foregroundStyle(Theme.Color.appText)
            Text(message)
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .frame(maxWidth: .infinity, alignment: .leading)
            Button(action: onRetry) {
                Text("Retry")
                    .pantopusTextStyle(.caption)
                    .fontWeight(.semibold)
                    .foregroundStyle(Theme.Color.primary600)
                    .frame(minHeight: 44)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("homeDashboard_healthScoreRetry")
        }
        .padding(.vertical, Spacing.s2)
    }

    private func unavailableBody(message: String) -> some View {
        Text(message)
            .pantopusTextStyle(.caption)
            .foregroundStyle(Theme.Color.appTextSecondary)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.vertical, Spacing.s2)
    }

    private var onboardingBody: some View {
        VStack(spacing: Spacing.s3) {
            ZStack {
                Circle().fill(Theme.Color.homeBg).frame(width: 64, height: 64)
                Icon(.home, size: 28, color: Theme.Color.home)
            }
            Text("Let's set up your home")
                .pantopusTextStyle(.body)
                .fontWeight(.semibold)
                .foregroundStyle(Theme.Color.appText)
            Text("Complete these steps to see your Home Health Score")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)

            VStack(spacing: Spacing.s2) {
                quickWin(icon: .siren, label: "Add an emergency contact", actionId: "view_emergency")
                quickWin(icon: .fileText, label: "Upload a home document", actionId: "view_docs")
                quickWin(icon: .users, label: "Invite a household member", actionId: "add_member")
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Spacing.s2)
    }

    private func quickWin(icon: PantopusIcon, label: String, actionId: String) -> some View {
        Button { onAction(actionId) } label: {
            HStack(spacing: Spacing.s3) {
                Icon(icon, size: 18, color: Theme.Color.primary600)
                Text(label)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appText)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Icon(.chevronRight, size: 14, color: Theme.Color.appTextMuted)
            }
            .padding(.horizontal, Spacing.s3)
            .frame(minHeight: 44)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("homeDashboard_healthQuickWin_\(actionId)")
    }

    private func scoreBody(_ score: HomeHealthScoreDTO) -> some View {
        let tint = Self.tint(for: score.score)
        return VStack(spacing: Spacing.s3) {
            ZStack {
                Circle()
                    .stroke(Theme.Color.appSurfaceSunken, lineWidth: Self.ringWidth)
                Circle()
                    .trim(from: 0, to: min(max(Double(score.score) / 100, 0), 1))
                    .stroke(tint, style: StrokeStyle(lineWidth: Self.ringWidth, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                VStack(spacing: Spacing.s0) {
                    Text("\(score.score)")
                        .font(.system(size: 34, weight: .bold))
                        .foregroundStyle(tint)
                    Text("/100")
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
            .frame(width: Self.ringSize, height: Self.ringSize)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Home health score \(score.score) out of 100")

            if let issue = score.topIssue {
                Text(issue)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .multilineTextAlignment(.center)
                    .lineLimit(2)
            }

            if let action = score.topAction, let actionId = Self.actionId(for: action.route) {
                Button { onAction(actionId) } label: {
                    HStack(spacing: Spacing.s1) {
                        Text(action.label)
                            .pantopusTextStyle(.caption)
                            .fontWeight(.semibold)
                            .foregroundStyle(tint)
                        Icon(.arrowRight, size: 12, color: tint)
                    }
                    .padding(.horizontal, Spacing.s4)
                    .frame(minHeight: 44)
                    .overlay(Capsule().stroke(tint.opacity(0.4), lineWidth: 1))
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("homeDashboard_healthTopAction")
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Spacing.s2)
    }

    private static func tint(for score: Int) -> Color {
        if score >= 75 { return Theme.Color.success }
        if score >= 40 { return Theme.Color.warning }
        return Theme.Color.error
    }

    /// Map the backend's `topAction.route` (`homeHealthService.js:129`)
    /// onto a dashboard action id. `/dashboard` targets the checklist card
    /// directly below, so it renders no chip.
    static func actionId(for route: String) -> String? {
        let path = route.split(separator: "/").last.map(String.init) ?? ""
        switch path {
        case "maintenance": return "view_maintenance"
        case "bills": return "view_bills"
        case "emergency": return "view_emergency"
        case "members": return "add_member"
        case "documents", "docs": return "view_docs"
        default: return nil
        }
    }
}

// MARK: - Seasonal checklist

/// `GET /api/homes/:id/seasonal-checklist` +
/// `PATCH …/seasonal-checklist/:itemId`.
struct SeasonalChecklistCard: View {
    let state: HomeIntelligenceCardState<SeasonalChecklistDTO>
    let pendingItemIds: Set<String>
    let onComplete: (String) -> Void
    let onSkip: (String) -> Void
    let onHireHelp: (SeasonalChecklistItemDTO) -> Void
    let onGenerate: () -> Void
    let onRetry: () -> Void

    @State private var carryoverExpanded = false

    var body: some View {
        DashboardCard(title: "Seasonal checklist", accent: Theme.Color.success) {
            switch state {
            case .loading:
                loadingBody
            case .forbidden:
                Text("You don't have access to this home's checklist.")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, Spacing.s2)
            case let .failed(message):
                errorBody(message: message)
            case let .loaded(checklist):
                if checklist.items.isEmpty {
                    emptyBody
                } else {
                    loadedBody(checklist)
                }
            }
        }
        .accessibilityIdentifier("homeDashboard_seasonalChecklistCard")
    }

    private var loadingBody: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            Shimmer(width: 160, height: 14)
            Shimmer(height: 4, cornerRadius: Radii.xs)
            ForEach(0..<3, id: \.self) { _ in
                Shimmer(height: 20)
            }
        }
        .padding(.vertical, Spacing.s2)
    }

    private func errorBody(message: String) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text("Couldn't load the seasonal checklist")
                .pantopusTextStyle(.small)
                .fontWeight(.semibold)
                .foregroundStyle(Theme.Color.appText)
            Text(message)
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .frame(maxWidth: .infinity, alignment: .leading)
            Button(action: onRetry) {
                Text("Retry")
                    .pantopusTextStyle(.caption)
                    .fontWeight(.semibold)
                    .foregroundStyle(Theme.Color.primary600)
                    .frame(minHeight: 44)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("homeDashboard_seasonalChecklistRetry")
        }
        .padding(.vertical, Spacing.s2)
    }

    private var emptyBody: some View {
        VStack(spacing: Spacing.s2) {
            Icon(.leaf, size: 28, color: Theme.Color.primary600)
            Text("Your seasonal checklist is ready")
                .pantopusTextStyle(.small)
                .fontWeight(.semibold)
                .foregroundStyle(Theme.Color.appText)
            Text("Get personalized seasonal tasks for your home")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
            Button(action: onGenerate) {
                HStack(spacing: Spacing.s2) {
                    Icon(.sparkles, size: 14, color: Theme.Color.appTextInverse)
                    Text("Generate checklist")
                        .pantopusTextStyle(.small)
                        .fontWeight(.semibold)
                        .foregroundStyle(Theme.Color.appTextInverse)
                }
                .padding(.horizontal, Spacing.s4)
                .frame(minHeight: 44)
                .background(Theme.Color.primary600)
                .clipShape(Capsule())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("homeDashboard_seasonalGenerateCTA")
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Spacing.s3)
    }

    private func loadedBody(_ checklist: SeasonalChecklistDTO) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(spacing: Spacing.s2) {
                Icon(Self.seasonIcon(checklist.season.key), size: 18, color: Theme.Color.primary600)
                Text(checklist.season.label)
                    .pantopusTextStyle(.small)
                    .fontWeight(.semibold)
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(1)
                Spacer(minLength: Spacing.s2)
                Text("\(checklist.progress.completed)/\(checklist.progress.total) done")
                    .pantopusTextStyle(.caption)
                    .fontWeight(.semibold)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }

            ProgressTrack(percentage: checklist.progress.percentage)

            VStack(spacing: Spacing.s0) {
                ForEach(checklist.items) { item in
                    row(item)
                }
            }

            if let carryover = checklist.carryover, !carryover.items.isEmpty {
                Button { carryoverExpanded.toggle() } label: {
                    HStack(spacing: Spacing.s2) {
                        Icon(
                            carryoverExpanded ? .chevronDown : .chevronRight,
                            size: 14,
                            color: Theme.Color.appTextSecondary
                        )
                        Text("From last season (\(carryover.season.label))")
                            .pantopusTextStyle(.caption)
                            .fontWeight(.semibold)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        Text("\(carryover.items.count) remaining")
                            .pantopusTextStyle(.caption)
                            .foregroundStyle(Theme.Color.appTextMuted)
                    }
                    .frame(minHeight: 44)
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("homeDashboard_seasonalCarryoverToggle")

                if carryoverExpanded {
                    VStack(spacing: Spacing.s0) {
                        ForEach(carryover.items) { item in
                            row(item)
                        }
                    }
                }
            }
        }
        .padding(.vertical, Spacing.s1)
    }

    private func row(_ item: SeasonalChecklistItemDTO) -> some View {
        let pending = pendingItemIds.contains(item.id)
        let done = item.isResolved
        return HStack(spacing: Spacing.s2) {
            Button { if !done { onComplete(item.id) } } label: {
                Icon(Self.statusIcon(item.status), size: 22, color: Self.statusTint(item.status))
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            .disabled(done || pending)
            .accessibilityIdentifier("homeDashboard_seasonalItemToggle_\(item.id)")
            .accessibilityLabel("Mark \(item.title) complete")

            VStack(alignment: .leading, spacing: Spacing.s0) {
                Text(item.title)
                    .pantopusTextStyle(.small)
                    .foregroundStyle(done ? Theme.Color.appTextSecondary : Theme.Color.appText)
                    .strikethrough(done)
                    .lineLimit(1)
                if let description = item.description, !done, !description.isEmpty {
                    Text(description)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .lineLimit(1)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            if item.status == "pending" {
                Button { onSkip(item.id) } label: {
                    Icon(.x, size: 16, color: Theme.Color.appTextSecondary)
                        .frame(width: 44, height: 44)
                }
                .buttonStyle(.plain)
                .disabled(pending)
                .accessibilityIdentifier("homeDashboard_seasonalItemSkip_\(item.id)")
                .accessibilityLabel("Skip \(item.title)")

                if item.gigCategory != nil {
                    Button { onHireHelp(item) } label: {
                        Text("Hire")
                            .pantopusTextStyle(.caption)
                            .fontWeight(.bold)
                            .foregroundStyle(Theme.Color.appTextInverse)
                            .padding(.horizontal, Spacing.s3)
                            .frame(minHeight: 32)
                            .background(Theme.Color.primary600)
                            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("homeDashboard_seasonalItemHire_\(item.id)")
                    .accessibilityLabel("Hire help for \(item.title)")
                }
            }
        }
        .opacity(pending ? 0.5 : 1)
    }

    static func seasonIcon(_ key: String) -> PantopusIcon {
        if key.contains("winter") || key.contains("ice") { return .snowflake }
        if key.contains("summer") || key.contains("dry") { return .sun }
        if key.contains("smoke") { return .cloud }
        if key.contains("holiday") { return .gift }
        return .leaf
    }

    private static func statusIcon(_ status: String) -> PantopusIcon {
        switch status {
        case "completed": .checkCircle
        case "skipped": .xCircle
        case "hired": .briefcase
        default: .circle
        }
    }

    private static func statusTint(_ status: String) -> Color {
        switch status {
        case "completed": Theme.Color.success
        case "skipped": Theme.Color.appTextSecondary
        case "hired": Theme.Color.business
        default: Theme.Color.appTextMuted
        }
    }
}

private struct ProgressTrack: View {
    let percentage: Int

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule().fill(Theme.Color.appSurfaceSunken)
                Capsule()
                    .fill(tint)
                    .frame(width: geo.size.width * min(max(Double(percentage) / 100, 0), 1))
            }
        }
        .frame(height: 4)
    }

    private var tint: Color {
        if percentage >= 100 { return Theme.Color.success }
        if percentage >= 50 { return Theme.Color.warning }
        return Theme.Color.primary600
    }
}

// MARK: - Property value

/// `GET /api/homes/:id/property-value`.
struct PropertyValueCard: View {
    let state: HomeIntelligenceCardState<HomePropertyValueDTO>
    let onRetry: () -> Void

    var body: some View {
        DashboardCard(title: "Estimated home value", accent: Theme.Color.primary600) {
            switch state {
            case .loading:
                VStack(alignment: .leading, spacing: Spacing.s2) {
                    Shimmer(width: 140, height: 28)
                    Shimmer(width: 120, height: 12)
                    Shimmer(width: 180, height: 12)
                }
                .padding(.vertical, Spacing.s2)
            case .forbidden:
                note("You don't have access to this home's valuation.")
            case let .failed(message):
                VStack(alignment: .leading, spacing: Spacing.s2) {
                    Text("Couldn't load the property value")
                        .pantopusTextStyle(.small)
                        .fontWeight(.semibold)
                        .foregroundStyle(Theme.Color.appText)
                    Text(message)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    Button(action: onRetry) {
                        Text("Retry")
                            .pantopusTextStyle(.caption)
                            .fontWeight(.semibold)
                            .foregroundStyle(Theme.Color.primary600)
                            .frame(minHeight: 44)
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("homeDashboard_propertyValueRetry")
                }
                .padding(.vertical, Spacing.s2)
            case let .loaded(value):
                if let estimate = value.estimatedValue {
                    loadedBody(value, estimate: estimate)
                } else {
                    unavailableBody
                }
            }
        }
        .accessibilityIdentifier("homeDashboard_propertyValueCard")
    }

    private func note(_ text: String) -> some View {
        Text(text)
            .pantopusTextStyle(.caption)
            .foregroundStyle(Theme.Color.appTextSecondary)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.vertical, Spacing.s2)
    }

    private var unavailableBody: some View {
        VStack(spacing: Spacing.s2) {
            Icon(.trendingUp, size: 26, color: Theme.Color.primary600)
            Text("Property insights coming soon")
                .pantopusTextStyle(.small)
                .fontWeight(.semibold)
                .foregroundStyle(Theme.Color.appText)
            Text("We'll show your home's estimated value once your address is fully verified.")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Spacing.s3)
    }

    private func loadedBody(_ value: HomePropertyValueDTO, estimate: Double) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text(HomeDashboardProjection.fullCurrency(estimate))
                .font(.system(size: 28, weight: .bold))
                .foregroundStyle(Theme.Color.appText)

            if let low = value.valueRangeLow, let high = value.valueRangeHigh {
                Text(
                    "\(HomeDashboardProjection.compactCurrency(low)) - "
                        + HomeDashboardProjection.compactCurrency(high)
                )
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
            }

            if let trend = trendMeta(value.zipMedianSalePriceTrend) {
                HStack(spacing: Spacing.s1) {
                    Icon(trend.icon, size: 14, color: trend.color)
                    Text(trend.label)
                        .pantopusTextStyle(.caption)
                        .fontWeight(.semibold)
                        .foregroundStyle(trend.color)
                }
            }

            if !details(value).isEmpty {
                Text(details(value).joined(separator: " - "))
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }

            if let updated = HomeDashboardProjection.monthYear(value.lastUpdated) {
                Text("Updated \(updated)")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, Spacing.s1)
    }

    private func details(_ value: HomePropertyValueDTO) -> [String] {
        var chips: [String] = []
        if let year = value.yearBuilt { chips.append("Built \(year)") }
        if let sqft = value.sqft { chips.append("\(sqft) sqft") }
        return chips
    }

    private func trendMeta(_ trend: String?) -> (icon: PantopusIcon, color: Color, label: String)? {
        switch trend {
        case "up": (.arrowUp, Theme.Color.success, "Trending up in your ZIP")
        case "down": (.arrowDown, Theme.Color.error, "Trending down in your ZIP")
        case "flat": (.arrowRight, Theme.Color.appTextSecondary, "Flat trend in your ZIP")
        default: nil
        }
    }
}

// MARK: - Bill trends

/// `GET /api/homes/:id/bill-trends`. 403s for members without finance
/// permission — the card hides itself in that case.
struct BillTrendsCard: View {
    let state: HomeIntelligenceCardState<HomeBillTrendsDTO>
    let onRetry: () -> Void

    var body: some View {
        Group {
            switch state {
            case .forbidden:
                EmptyView()
            default:
                DashboardCard(title: "Bill trends", accent: Theme.Color.warning) {
                    content
                }
                .accessibilityIdentifier("homeDashboard_billTrendsCard")
            }
        }
    }

    @ViewBuilder
    private var content: some View {
        switch state {
        case .loading:
            VStack(alignment: .leading, spacing: Spacing.s2) {
                Shimmer(height: 16)
                Shimmer(height: 16)
            }
            .padding(.vertical, Spacing.s2)
        case .forbidden:
            EmptyView()
        case let .failed(message):
            VStack(alignment: .leading, spacing: Spacing.s2) {
                Text("Couldn't load bill trends")
                    .pantopusTextStyle(.small)
                    .fontWeight(.semibold)
                    .foregroundStyle(Theme.Color.appText)
                Text(message)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Button(action: onRetry) {
                    Text("Retry")
                        .pantopusTextStyle(.caption)
                        .fontWeight(.semibold)
                        .foregroundStyle(Theme.Color.primary600)
                        .frame(minHeight: 44)
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("homeDashboard_billTrendsRetry")
            }
            .padding(.vertical, Spacing.s2)
        case let .loaded(trends):
            if trends.billsByType.isEmpty {
                Text("Mark a bill as paid to start tracking your monthly trend.")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, Spacing.s2)
            } else {
                VStack(spacing: Spacing.s0) {
                    ForEach(trends.billsByType.keys.sorted(), id: \.self) { key in
                        if let series = trends.billsByType[key] {
                            BillTrendRow(
                                billType: key,
                                series: series,
                                benchmark: trends.benchmarks[key]
                            )
                        }
                    }
                }
            }
        }
    }
}

private struct BillTrendRow: View {
    let billType: String
    let series: HomeBillTrendSeriesDTO
    let benchmark: HomeBillBenchmarkDTO?

    var body: some View {
        HStack(spacing: Spacing.s3) {
            VStack(alignment: .leading, spacing: Spacing.s0) {
                Text(HomeDashboardProjection.humanized(billType) ?? billType)
                    .pantopusTextStyle(.small)
                    .fontWeight(.semibold)
                    .foregroundStyle(Theme.Color.appText)
                if let note = benchmarkNote {
                    Text(note)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .lineLimit(2)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            if let latest = series.amounts.first {
                Text(HomeDashboardProjection.fullCurrency(latest))
                    .pantopusTextStyle(.small)
                    .fontWeight(.semibold)
                    .foregroundStyle(Theme.Color.appText)
            }
        }
        .padding(.vertical, Spacing.s3)
        .accessibilityElement(children: .combine)
    }

    private var benchmarkNote: String? {
        guard let benchmark else {
            return series.months.first
        }
        if benchmark.insufficientData {
            return benchmark.message ?? "Not enough neighbors for comparison yet"
        }
        guard let neighborCents = benchmark.avgAmounts.first, let mine = series.amounts.first else {
            return series.months.first
        }
        let neighbors = neighborCents / 100
        let label = HomeDashboardProjection.fullCurrency(neighbors)
        if mine > neighbors { return "Above the \(label) neighborhood average" }
        if mine < neighbors { return "Below the \(label) neighborhood average" }
        return "In line with the \(label) neighborhood average"
    }
}
