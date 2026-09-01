//
//  InsightsPeriodFilterSheet.swift
//  Pantopus
//
//  H13 Insights Period & Filter Sheet (Stream I17). The shared bottom sheet that
//  drives the date window (presets + custom range, ≤ 365 days) and optional
//  event-type / team-member multi-selects for every insights screen. Presented
//  locally from each screen's period chip — it has no route. Every picker is a
//  real labeled control reachable at the largest dynamic-type size.
//

import SwiftUI

struct InsightsPeriodFilterSheet: View {
    let eventTypeOptions: [InsightsFilterOption]
    let memberOptions: [InsightsFilterOption]
    var accent: Color = Theme.Color.primary600
    let onApply: (InsightsFilter) -> Void

    @State private var working: InsightsFilter
    @Environment(\.dismiss) private var dismiss

    init(
        initial: InsightsFilter,
        eventTypeOptions: [InsightsFilterOption],
        memberOptions: [InsightsFilterOption],
        accent: Color = Theme.Color.primary600,
        onApply: @escaping (InsightsFilter) -> Void
    ) {
        self.eventTypeOptions = eventTypeOptions
        self.memberOptions = memberOptions
        self.accent = accent
        self.onApply = onApply
        _working = State(initialValue: initial)
    }

    var body: some View {
        VStack(spacing: Spacing.s0) {
            header
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.s4) {
                    dateRangeCard
                    if !eventTypeOptions.isEmpty {
                        multiSelectCard(
                            title: "Event type",
                            allLabel: "All event types",
                            options: eventTypeOptions,
                            selection: eventTypeBinding
                        )
                    }
                    if !memberOptions.isEmpty {
                        multiSelectCard(
                            title: "Team member",
                            allLabel: "Everyone",
                            options: memberOptions,
                            selection: memberBinding
                        )
                    }
                    Color.clear.frame(height: Spacing.s10)
                }
                .padding(.horizontal, Spacing.s3)
                .padding(.top, Spacing.s3)
            }
            applyBar
        }
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("scheduling.insights.filterSheet")
    }

    // MARK: Header

    private var header: some View {
        VStack(spacing: Spacing.s2) {
            Capsule().fill(Theme.Color.appBorder).frame(width: 36, height: 5).padding(.top, Spacing.s2)
            HStack {
                Button("Reset") { working = .default }
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .accessibilityIdentifier("scheduling.insights.filterReset")
                Spacer()
                Text("Filter insights")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                    .accessibilityAddTraits(.isHeader)
                Spacer()
                Button(action: { dismiss() }, label: {
                    Icon(.x, size: 18, color: Theme.Color.appTextSecondary)
                        .frame(width: 32, height: 32)
                })
                .accessibilityLabel("Close")
            }
            .padding(.horizontal, Spacing.s3)
        }
        .padding(.bottom, Spacing.s2)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottom) { Rectangle().fill(Theme.Color.appBorder).frame(height: 1) }
    }

    // MARK: Date range

    private var dateRangeCard: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            InsightsOverline(text: "Date range")
            VStack(spacing: 0) {
                ForEach(InsightsPeriod.allCases) { period in
                    radioRow(period)
                    if period != InsightsPeriod.allCases.last {
                        Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
                    }
                }
                if working.period == .custom {
                    Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
                    customRange
                }
            }
            .padding(.horizontal, 13)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous).stroke(Theme.Color.appBorder, lineWidth: 1))
            .pantopusShadow(.sm)
        }
    }

    private func radioRow(_ period: InsightsPeriod) -> some View {
        Button {
            if period == .custom { seedCustomIfNeeded() }
            working.period = period
        } label: {
            HStack {
                Text(period.title)
                    .font(.system(size: 13.5, weight: .medium))
                    .foregroundStyle(Theme.Color.appText)
                Spacer()
                InsightsRadioDot(selected: working.period == period, accent: accent)
            }
            .padding(.vertical, 12)
            .frame(minHeight: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(working.period == period ? [.isButton, .isSelected] : .isButton)
    }

    private var customRange: some View {
        VStack(spacing: Spacing.s2) {
            DatePicker("Start", selection: startBinding, in: ...Date(), displayedComponents: .date)
                .font(.system(size: 13))
                .tint(accent)
            DatePicker("End", selection: endBinding, in: ...Date(), displayedComponents: .date)
                .font(.system(size: 13))
                .tint(accent)
            HStack {
                Icon(.calendar, size: 13, color: Theme.Color.appTextMuted)
                Text(customSummary)
                    .font(.system(size: 11.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                Spacer()
            }
            .padding(.top, 2)
        }
        .padding(.vertical, 12)
    }

    // MARK: Multi-select

    private func multiSelectCard(
        title: String,
        allLabel: String,
        options: [InsightsFilterOption],
        selection: Binding<Set<String>>
    ) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            InsightsOverline(text: title)
            VStack(spacing: 0) {
                selectRow(label: allLabel, selected: selection.wrappedValue.isEmpty) {
                    selection.wrappedValue = []
                }
                ForEach(options) { option in
                    Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
                    selectRow(label: option.name, selected: selection.wrappedValue.contains(option.id)) {
                        toggle(option.id, in: selection)
                    }
                }
            }
            .padding(.horizontal, 13)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous).stroke(Theme.Color.appBorder, lineWidth: 1))
            .pantopusShadow(.sm)
        }
    }

    private func selectRow(label: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack {
                Text(label)
                    .font(.system(size: 13.5, weight: .medium))
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(1)
                Spacer()
                if selected {
                    Icon(.check, size: 16, strokeWidth: 2.6, color: accent)
                }
            }
            .padding(.vertical, 12)
            .frame(minHeight: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
    }

    // MARK: Apply

    private var applyBar: some View {
        VStack(spacing: 0) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
            Button(action: {
                onApply(working)
                dismiss()
            }, label: {
                Text(applyLabel)
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
                    .frame(maxWidth: .infinity)
                    .frame(height: 50)
                    .background(accent)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            })
            .padding(Spacing.s3)
            .accessibilityIdentifier("scheduling.insights.filterApply")
        }
        .background(Theme.Color.appSurface)
    }

    private var applyLabel: String {
        let count = working.activeFilterCount
        return count > 0 ? "Apply (\(count) filter\(count == 1 ? "" : "s"))" : "Apply"
    }

    // MARK: Bindings & helpers

    private var eventTypeBinding: Binding<Set<String>> {
        Binding(get: { working.eventTypeIds }, set: { working.eventTypeIds = $0 })
    }

    private var memberBinding: Binding<Set<String>> {
        Binding(get: { working.memberIds }, set: { working.memberIds = $0 })
    }

    private var startBinding: Binding<Date> {
        Binding(
            get: { working.customStart ?? Calendar.current.date(byAdding: .day, value: -30, to: Date()) ?? Date() },
            set: { working.customStart = $0 }
        )
    }

    private var endBinding: Binding<Date> {
        Binding(get: { working.customEnd ?? Date() }, set: { working.customEnd = $0 })
    }

    private var customSummary: String {
        let start = startBinding.wrappedValue
        let end = endBinding.wrappedValue
        return "\(InsightsFormat.shortDay(min(start, end))) – \(InsightsFormat.shortDay(max(start, end)))"
    }

    private func seedCustomIfNeeded() {
        if working.customStart == nil { working.customStart = Calendar.current.date(byAdding: .day, value: -30, to: Date()) }
        if working.customEnd == nil { working.customEnd = Date() }
    }

    private func toggle(_ id: String, in selection: Binding<Set<String>>) {
        if selection.wrappedValue.contains(id) {
            selection.wrappedValue.remove(id)
        } else {
            selection.wrappedValue.insert(id)
        }
    }
}

/// A 22pt radio control: filled ring when selected.
private struct InsightsRadioDot: View {
    let selected: Bool
    let accent: Color

    var body: some View {
        ZStack {
            Circle()
                .stroke(selected ? accent : Theme.Color.appBorder, lineWidth: 2)
                .frame(width: 20, height: 20)
            if selected {
                Circle().fill(accent).frame(width: 11, height: 11)
            }
        }
        .accessibilityHidden(true)
    }
}

#if DEBUG
#Preview {
    InsightsPeriodFilterSheet(
        initial: .default,
        eventTypeOptions: [.init(id: "1", name: "Intro call"), .init(id: "2", name: "Deep dive")],
        memberOptions: [],
        accent: Theme.Color.business
    ) { _ in }
}
#endif
