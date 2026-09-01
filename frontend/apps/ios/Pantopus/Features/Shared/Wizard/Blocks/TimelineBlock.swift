//
//  TimelineBlock.swift
//  Pantopus
//
//  Wizard content block — small horizontal timeline with one stage
//  highlighted as the current step. Used by P20's claim ownership
//  Step 3 (success) to show the verification path ahead.
//

import SwiftUI

/// One stage in the timeline.
public struct TimelineBlockStage: Sendable, Identifiable, Equatable {
    public let id: String
    public let label: String

    public init(id: String, label: String) {
        self.id = id
        self.label = label
    }
}

/// Horizontal timeline with progress dots and connecting line.
@MainActor
public struct TimelineBlock: View {
    private let stages: [TimelineBlockStage]
    private let currentStageId: String

    public init(stages: [TimelineBlockStage], currentStageId: String) {
        self.stages = stages
        self.currentStageId = currentStageId
    }

    public var body: some View {
        let currentIndex = stages.firstIndex { $0.id == currentStageId } ?? 0
        VStack(spacing: Spacing.s2) {
            HStack(spacing: Spacing.s0) {
                ForEach(Array(stages.enumerated()), id: \.element.id) { index, _ in
                    StageDot(state: stateFor(index: index, currentIndex: currentIndex))
                    if index != stages.count - 1 {
                        Rectangle()
                            .fill(
                                index < currentIndex
                                    ? Theme.Color.primary600
                                    : Theme.Color.appBorder
                            )
                            .frame(height: 2)
                    }
                }
            }
            HStack(spacing: Spacing.s0) {
                ForEach(Array(stages.enumerated()), id: \.element.id) { index, stage in
                    Text(stage.label)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(
                            index == currentIndex
                                ? Theme.Color.primary600
                                : Theme.Color.appTextSecondary
                        )
                        .frame(maxWidth: .infinity, alignment: alignment(for: index))
                }
            }
        }
        .padding(.vertical, Spacing.s3)
        .padding(.horizontal, Spacing.s4)
        .background(Theme.Color.appSurfaceMuted)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Verification timeline. Current stage: \(stages[currentIndex].label).")
    }

    private func alignment(for index: Int) -> Alignment {
        if index == 0 { return .leading }
        if index == stages.count - 1 { return .trailing }
        return .center
    }

    private func stateFor(index: Int, currentIndex: Int) -> StageDotState {
        if index < currentIndex { return .done }
        if index == currentIndex { return .current }
        return .upcoming
    }
}

private enum StageDotState { case done, current, upcoming }

private struct StageDot: View {
    let state: StageDotState

    var body: some View {
        ZStack {
            Circle().fill(fillColor).frame(width: 14, height: 14)
            if state == .current {
                Circle().stroke(Theme.Color.primary600, lineWidth: 2).frame(width: 22, height: 22)
            }
            if state == .done {
                Icon(.check, size: 10, color: Theme.Color.appTextInverse)
            }
        }
        .frame(width: 22, height: 22)
        .accessibilityHidden(true)
    }

    private var fillColor: Color {
        switch state {
        case .done: Theme.Color.primary600
        case .current: Theme.Color.appSurface
        case .upcoming: Theme.Color.appBorder
        }
    }
}

#Preview {
    TimelineBlock(
        stages: [
            TimelineBlockStage(id: "submitted", label: "Submitted"),
            TimelineBlockStage(id: "review", label: "Under review"),
            TimelineBlockStage(id: "complete", label: "Complete")
        ],
        currentStageId: "submitted"
    )
    .padding()
    .background(Theme.Color.appBg)
}
