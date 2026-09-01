//
//  GigFulfillmentPanel.swift
//  Pantopus
//
//  Live fulfillment stepper for urgent / starts-asap tasks — the native
//  counterpart of RN's `ActiveTaskPanel` timeline
//  (`components/gig-detail-v2/ActiveTaskPanel.tsx:204`). Reads
//  `GET /api/gigs/:gigId/active-status` and advances via
//  `POST /api/gigs/:gigId/status`; the view-model owns both calls.
//
//  Renders under the generic Phase-5 "Task progress" strip: that one
//  tracks the *gig* lifecycle (assigned → confirmed), this one the
//  helper's *live* position inside it (on the way → arrived → in
//  progress → completed).
//

import SwiftUI

struct GigFulfillmentPanel: View {
    let status: GigFulfillmentStatus?
    let etaLabel: String?
    /// `nil` when this viewer has no rung to advance right now.
    let nextAction: (status: GigFulfillmentStatus, label: String)?
    let isBusy: Bool
    let onAdvance: @MainActor (GigFulfillmentStatus) -> Void

    /// Rung the stepper is currently lit up to, or `nil` before the
    /// helper says anything. RN `STATUS_ORDER` (`ActiveTaskPanel.tsx:37`).
    private var currentStepIndex: Int {
        status?.stepIndex ?? -1
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            header
            if let etaLabel {
                etaStrip(etaLabel)
            }
            timeline
            if let nextAction {
                advanceButton(nextAction)
            }
        }
        .padding(Spacing.s3)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .padding(.horizontal, Spacing.s5)
        .padding(.top, 22)
        .accessibilityIdentifier("gigDetail.fulfillmentPanel")
    }

    private var header: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.zap, size: 15, strokeWidth: 2.2, color: Theme.Color.warning)
            Text("Live status")
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            Spacer(minLength: Spacing.s2)
            statusBadge
        }
    }

    /// RN's `getStatusBadge` — "Waiting" until the helper moves.
    private var statusBadge: some View {
        Text(status?.badgeLabel ?? "Waiting")
            .font(.system(size: 11, weight: .bold))
            .foregroundStyle(status == nil ? Theme.Color.appTextSecondary : Theme.Color.primary700)
            .padding(.horizontal, 10)
            .padding(.vertical, Spacing.s1)
            .background(status == nil ? Theme.Color.appSurfaceSunken : Theme.Color.primary50)
            .clipShape(Capsule())
            .accessibilityIdentifier("gigDetail.fulfillmentBadge")
    }

    private func etaStrip(_ label: String) -> some View {
        HStack(spacing: 6) {
            Icon(.navigation, size: 13, strokeWidth: 2.4, color: Theme.Color.primary600)
            Text(label)
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(Theme.Color.primary700)
            Spacer()
        }
        .padding(.horizontal, 10)
        .padding(.vertical, Spacing.s2)
        .background(Theme.Color.primary50)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .accessibilityIdentifier("gigDetail.fulfillmentEta")
    }

    private var timeline: some View {
        HStack(spacing: Spacing.s0) {
            ForEach(GigFulfillmentStep.allCases, id: \.rawValue) { step in
                let reached = currentStepIndex >= step.rawValue
                VStack(spacing: Spacing.s1) {
                    ZStack {
                        Circle()
                            .fill(reached ? Theme.Color.success : Theme.Color.appSurfaceSunken)
                            .frame(width: 20, height: 20)
                        Icon(
                            reached ? .check : Self.icon(for: step),
                            size: 10,
                            strokeWidth: 3,
                            color: reached ? Theme.Color.appTextInverse : Theme.Color.appTextSecondary
                        )
                    }
                    Text(step.label)
                        .font(.system(size: 9, weight: reached ? .bold : .medium))
                        .foregroundStyle(reached ? Theme.Color.appText : Theme.Color.appTextSecondary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                }
                .frame(maxWidth: .infinity)
                if step != GigFulfillmentStep.allCases.last {
                    Rectangle()
                        .fill(currentStepIndex > step.rawValue ? Theme.Color.success : Theme.Color.appBorder)
                        .frame(height: 2)
                        .frame(maxWidth: 24)
                        .padding(.bottom, 14)
                }
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Live status: \(status?.badgeLabel ?? "Waiting")")
        .accessibilityIdentifier("gigDetail.fulfillmentTimeline")
    }

    private func advanceButton(_ action: (status: GigFulfillmentStatus, label: String)) -> some View {
        Button {
            onAdvance(action.status)
        } label: {
            HStack(spacing: 6) {
                Icon(Self.icon(forAdvance: action.status), size: 14, strokeWidth: 2.2, color: Theme.Color.appTextInverse)
                Text(action.label)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 40)
            .background(Theme.Color.primary600)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        }
        .buttonStyle(.plain)
        .disabled(isBusy)
        .opacity(isBusy ? 0.6 : 1)
        .accessibilityIdentifier("gigDetail.fulfillmentAdvance")
    }

    private static func icon(for step: GigFulfillmentStep) -> PantopusIcon {
        switch step {
        case .onTheWay: .car
        case .arrived: .mapPin
        case .inProgress: .hammer
        case .completed: .checkCircle
        }
    }

    private static func icon(forAdvance status: GigFulfillmentStatus) -> PantopusIcon {
        switch status {
        case .onTheWay: .car
        case .arrived, .pickedUp: .mapPin
        case .droppedOff, .inProgress: .check
        }
    }
}
