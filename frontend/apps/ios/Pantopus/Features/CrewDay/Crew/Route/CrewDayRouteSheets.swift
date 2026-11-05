//
//  CrewDayRouteSheets.swift
//  Pantopus
//
//  The route's two sheets (board `Route`, sheet onMyWay and late): On my
//  way ("expected" a one-hour window from now, 15 minutes earlier or later)
//  and Running late (every home not done moves back 30, 60 or 90 minutes,
//  and each one is told).
//

import SwiftUI

struct CrewDayOnMyWaySheet: View {
    let viewModel: CrewDayRouteViewModel
    let home: CrewDayHomeDTO
    @State private var start = CrewDayOnMyWaySheet.defaultStart()
    @Environment(\.dismiss) private var dismiss

    /// From now, rounded up to the next quarter hour.
    static func defaultStart(now: Date = Date()) -> Date {
        let quarter: TimeInterval = 15 * 60
        return Date(timeIntervalSinceReferenceDate: (now.timeIntervalSinceReferenceDate / quarter).rounded(.up) * quarter)
    }

    private var end: Date {
        start.addingTimeInterval(3600)
    }

    private var timezone: String? {
        viewModel.route?.timezone
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s4) {
                CrewDaySheetHeader(title: "On my way to \(CrewDayRouteCopy.place(home))") { dismiss() }
                Text("\(CrewDayRouteCopy.who(home)) gets a push with this window and can tell you when the gate is ready.")
                    .planFont(.body)
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .fixedSize(horizontal: false, vertical: true)
                CrewDayExpectedWindow(start: $start, timezone: timezone)
                if let error = viewModel.actionError { CrewDayErrorText(text: error, identifier: "crewDayRouteOnMyWayError") }
                Button {
                    Task { if await viewModel.onMyWay(home, start: start, end: end) { dismiss() } }
                } label: {
                    PlanButtonLabel(title: "Tell \(CrewDayRouteCopy.who(home))", isLoading: viewModel.working)
                }
                .crewDayButton(.primary)
                .disabled(viewModel.working)
                .accessibilityIdentifier("crewDayRouteOnMyWaySend")
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.bottom, Spacing.s4)
        }
        .scrollBounceBehavior(.basedOnSize)
        .crewDaySheetDetents([.medium])
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("crewDayRouteOnMyWaySheet")
    }
}

/// "Expected": a one-hour window, 15 minutes earlier (not before a quarter hour ago) or later. The time wraps at
/// the large text sizes, and VoiceOver adjusts it with a swipe up or down.
struct CrewDayExpectedWindow: View {
    @Binding var start: Date
    let timezone: String?

    private var window: String {
        CrewDayFormat.window(from: start, to: start.addingTimeInterval(3600), timezone: timezone)
    }

    private var canGoEarlier: Bool {
        start > Date().addingTimeInterval(-15 * 60)
    }

    var body: some View {
        CrewDayHeaderRow {
            // The time itself is the "Expected" VoiceOver stop.
            Text("Expected").planFont(.label).foregroundStyle(Theme.Color.appTextSecondary).accessibilityHidden(true)
        } trailing: {
            HStack(spacing: Spacing.s3) {
                stepper(icon: .minus, label: "15 minutes earlier") { start = start.addingTimeInterval(-15 * 60) }
                    .disabled(!canGoEarlier)
                Text(window)
                    .planFont(.bodyStrong)
                    .monospacedDigit()
                    .foregroundStyle(Theme.Color.appText)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityLabel("Expected")
                    .accessibilityValue(window)
                    .accessibilityAdjustableAction { direction in
                        switch direction {
                        case .increment: start = start.addingTimeInterval(15 * 60)
                        case .decrement: if canGoEarlier { start = start.addingTimeInterval(-15 * 60) }
                        @unknown default: break
                        }
                    }
                    .accessibilityIdentifier("crewDayRouteOnMyWayTime")
                stepper(icon: .plus, label: "15 minutes later") { start = start.addingTimeInterval(15 * 60) }
            }
        }
    }

    private func stepper(icon: PantopusIcon, label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Icon(icon, size: 18, color: Theme.Color.appText)
                .frame(width: 44, height: 44)
                .background(Circle().fill(Theme.Color.appSurfaceSunken))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }
}

struct CrewDayRunningLateSheet: View {
    let viewModel: CrewDayRouteViewModel
    @State private var minutes = 30
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s4) {
                CrewDaySheetHeader(title: "Running late?") { dismiss() }
                Text("Every home that isn't done moves back by the same amount, and each one is told.")
                    .planFont(.body)
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .fixedSize(horizontal: false, vertical: true)
                Text.planOverline("How late")
                CrewDayButtonRow(spacing: Spacing.s2) {
                    ForEach([30, 60, 90], id: \.self) { value in
                        let selected = minutes == value
                        Button { minutes = value } label: {
                            Text("\(value) min")
                                .planFont(selected ? .bodyStrong : .body)
                                .foregroundStyle(selected ? Theme.Color.primary700 : Theme.Color.appText)
                                .frame(maxWidth: .infinity, minHeight: 44)
                                .background(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                                    .fill(selected ? Theme.Color.primary50 : Theme.Color.appSurface))
                                .overlay(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                                    .stroke(selected ? Theme.Color.primary700 : Theme.Color.appBorderStrong, lineWidth: 1))
                        }
                        .buttonStyle(.plain)
                        .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
                        .accessibilityIdentifier("crewDayRouteLate_\(value)")
                    }
                }
                Text(preview)
                    .planFont(.body)
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityIdentifier("crewDayRouteLatePreview")
                if let error = viewModel.actionError { CrewDayErrorText(text: error, identifier: "crewDayRouteLateError") }
                Button {
                    Task { if await viewModel.runningLate(minutes: minutes) { dismiss() } }
                } label: {
                    PlanButtonLabel(title: "Tell \(CrewDayFormat.homes(count))", isLoading: viewModel.working)
                }
                .crewDayButton(.primary)
                .disabled(viewModel.working || viewModel.lateHomes.isEmpty)
                .accessibilityIdentifier("crewDayRouteLateSend")
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.bottom, Spacing.s4)
        }
        .scrollBounceBehavior(.basedOnSize)
        .crewDaySheetDetents([.medium, .large])
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("crewDayRouteLateSheet")
    }

    private var count: Int {
        viewModel.lateHomes.count
    }

    /// "4 homes get a new arrival time. 123 Maple Lane moves to 10:30–11:30 AM."
    private var preview: String {
        guard !viewModel.lateHomes.isEmpty else { return "Every home on this date is done." }
        let lead = count == 1 ? "1 home gets a new arrival time." : "\(count) homes get a new arrival time."
        guard let first = viewModel.lateHomes.first else { return lead }
        let tz = viewModel.route?.timezone
        let shift = TimeInterval(minutes * 60)
        let window: String = if let start = CrewDayFormat.instant(first.eta?.start), let end = CrewDayFormat.instant(first.eta?.end) {
            CrewDayFormat.window(from: start.addingTimeInterval(shift), to: end.addingTimeInterval(shift), timezone: tz)
        } else {
            CrewDayRunningLateSheet.shifted(first.windowStart, first.windowEnd, minutes: minutes)
        }
        return "\(lead) \(CrewDayRouteCopy.place(first)) moves to \(window)."
    }

    /// "9 AM–1 PM" moved back by some minutes ("9:30 AM–1:30 PM").
    static func shifted(_ start: String?, _ end: String?, minutes: Int) -> String {
        func move(_ value: String?) -> String? {
            guard let value else { return nil }
            let parts = value.split(separator: ":").compactMap { Int($0) }
            guard let hour = parts.first else { return value }
            let total = hour * 60 + (parts.count > 1 ? parts[1] : 0) + minutes
            return String(format: "%02d:%02d", (total / 60) % 24, total % 60)
        }
        return CrewDayFormat.window(move(start), move(end))
    }
}
