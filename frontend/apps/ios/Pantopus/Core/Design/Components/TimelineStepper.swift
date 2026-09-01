//
//  TimelineStepper.swift
//  Pantopus
//
//  Vertical stepper. Completed steps show a green check, the current step
//  gets a primary-tinted dot with an animated pulse ring (respects Reduce
//  Motion), upcoming steps render as muted outline circles.
//

import SwiftUI

/// Lifecycle state of a single step.
public enum TimelineStepState: Sendable {
    case done, current, upcoming
}

/// One step row.
public struct TimelineStep: Identifiable, Sendable {
    public let id: String
    public let title: String
    public let subtitle: String?
    public let state: TimelineStepState

    public init(
        id: String = UUID().uuidString,
        title: String,
        subtitle: String? = nil,
        state: TimelineStepState
    ) {
        self.id = id
        self.title = title
        self.subtitle = subtitle
        self.state = state
    }
}

/// Vertical timeline.
@MainActor
public struct TimelineStepper: View {
    private let steps: [TimelineStep]

    public init(steps: [TimelineStep]) {
        self.steps = steps
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            ForEach(Array(steps.enumerated()), id: \.element.id) { offset, step in
                HStack(alignment: .top, spacing: Spacing.s3) {
                    TimelineMarker(state: step.state, isLast: offset == steps.count - 1)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(step.title)
                            .pantopusTextStyle(.body)
                            .foregroundStyle(titleColor(for: step.state))
                        if let subtitle = step.subtitle {
                            Text(subtitle)
                                .pantopusTextStyle(.caption)
                                .foregroundStyle(Theme.Color.appTextSecondary)
                        }
                    }
                    .padding(.bottom, offset == steps.count - 1 ? 0 : Spacing.s4)
                }
                .accessibilityElement(children: .combine)
                .accessibilityLabel("\(stateLabel(for: step.state)): \(step.title)")
            }
        }
    }

    private func titleColor(for state: TimelineStepState) -> Color {
        switch state {
        case .done: Theme.Color.appText
        case .current: Theme.Color.appText
        case .upcoming: Theme.Color.appTextMuted
        }
    }

    private func stateLabel(for state: TimelineStepState) -> String {
        switch state {
        case .done: "Completed"
        case .current: "Current step"
        case .upcoming: "Upcoming"
        }
    }
}

private struct TimelineMarker: View {
    let state: TimelineStepState
    let isLast: Bool

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var pulse = false

    var body: some View {
        VStack(spacing: Spacing.s0) {
            ZStack {
                switch state {
                case .done:
                    Circle().fill(Theme.Color.success).frame(width: 20, height: 20)
                    Icon(.check, size: 12, color: Theme.Color.appTextInverse)
                case .current:
                    if !reduceMotion {
                        Circle()
                            .stroke(Theme.Color.primary600.opacity(0.3), lineWidth: 2)
                            .frame(width: 28, height: 28)
                            .scaleEffect(pulse ? 1.4 : 1)
                            .opacity(pulse ? 0 : 1)
                            .animation(
                                .easeOut(duration: 1.2).repeatForever(autoreverses: false),
                                value: pulse
                            )
                    }
                    Circle().fill(Theme.Color.primary600).frame(width: 20, height: 20)
                    Circle().fill(Theme.Color.appTextInverse).frame(width: 6, height: 6)
                case .upcoming:
                    Circle()
                        .stroke(Theme.Color.appBorderStrong, lineWidth: 2)
                        .frame(width: 20, height: 20)
                }
            }
            .onAppear {
                if state == .current, !reduceMotion { pulse = true }
            }
            if !isLast {
                Rectangle()
                    .fill(state == .done ? Theme.Color.success : Theme.Color.appBorder)
                    .frame(width: 2)
                    .frame(maxHeight: .infinity)
            }
        }
        .frame(width: 28)
    }
}

#Preview {
    TimelineStepper(steps: [
        .init(title: "Order placed", subtitle: "Mar 17", state: .done),
        .init(title: "In transit", subtitle: "Mar 18", state: .done),
        .init(title: "Out for delivery", subtitle: "Today", state: .current),
        .init(title: "Delivered", state: .upcoming)
    ])
    .padding()
    .background(Theme.Color.appBg)
}
