//
//  MomentsStudioTray.swift
//  Pantopus
//
//  The Studio's "Stamps and Play" tray (board B5, "Pulse, reinvented" phase 0 step 3), opened from the rail. Phase 0
//  has the stamps Pantopus checked: the postmark, the weather, the elevation, the place, the time, the sunset and the
//  miles from home. Nobody can type them: the server reads each one for this spot now (CONTRACT 2a) and fills it again
//  when the Moment is posted. A stamp the server can't give here isn't offered; one already on the picture shows as
//  picked, and a tap takes it off again. The Play kinds, Sound and voice, and cutouts come with later steps.
//

import SwiftUI

struct MomentsStudioTray: View {
    let model: MomentsComposerModel
    let stamps: MomentsStudioStamps
    let onDone: () -> Void

    var body: some View {
        // Scrolls: phase 2's Play maker can be taller than the sheet.
        ScrollView {
            content
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, Spacing.s4)
                .padding(.top, Spacing.s5)
                .padding(.bottom, Spacing.s4)
        }
        .task { if stamps.reading != .read { await stamps.read(model: model) } }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("moments.studio.tray")
    }

    private var content: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            HStack(alignment: .firstTextBaseline, spacing: Spacing.s2) {
                Text("Checked by Pantopus")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                    .accessibilityAddTraits(.isHeader)
                Text("Nobody can type these")
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            switch stamps.reading {
            case .reading:
                ProgressView()
                    .frame(maxWidth: .infinity, minHeight: 120)
                    .accessibilityLabel("Reading this spot")
            case .failed:
                Text("Couldn't read this spot. Try again in a moment.")
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .frame(maxWidth: .infinity, minHeight: 80, alignment: .leading)
                Button("Try again") { Task { await stamps.read(model: model) } }
                    .accessibilityIdentifier("moments.studio.tray.retry")
            case .read:
                if stamps.offered(for: model).isEmpty {
                    Text("There are no stamps for this spot.")
                        .font(.system(size: 14))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                } else {
                    MomentsStudioTrayFlow(spacing: Spacing.s2) {
                        ForEach(stamps.offered(for: model), id: \.self) { kind in chip(kind) }
                    }
                }
            }
            if model.offersLooks, model.studioPair == nil {
                MomentsStudioLooksRow(model: model)
            }
            if !model.stripPartners.isEmpty, model.studioPair == nil {
                MomentsStudioStripRow(model: model, onDone: onDone)
            }
            if model.offersBeforeAfter || model.studioPair != nil {
                MomentsStudioBeforeAfterRow(model: model, onDone: onDone)
            }
            if model.studioCutoutSurface != nil {
                MomentsStudioYourCutouts(model: model, onPlaced: onDone)
            }
            if model.offersGuess {
                MomentsStudioGuessRow(model: model)
            }
            // Phase 2's playable items (`MomentsStudioPlayMaker`).
            MomentsStudioPlayMaker(model: model, onDone: onDone)
        }
    }

    private func chip(_ kind: MomentStampKind) -> some View {
        let placed = model.studioStamps.contains { $0.kind == kind }
        let words = kind == .postmark ? "Postmark" : MomentStampView.words(kind, stamps.values[kind])
        return Button {
            if placed {
                model.studioStamps.removeAll { $0.kind == kind }
            } else {
                stamps.place(kind, on: model)
                onDone()
            }
        } label: {
            HStack(spacing: 6) {
                Icon(MomentStampView.icon(kind), size: 16, strokeWidth: 2.2, color: placed ? .white : Theme.Color.primaryTint)
                Text(words)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(placed ? Color.white : Theme.Color.appText)
                    .lineLimit(1)
            }
            .padding(.horizontal, 12)
            .frame(height: 28)
            .background(Capsule().fill(placed ? Theme.Color.primarySolid : Theme.Color.appSurfaceRaised))
            .overlay(Capsule().stroke(Theme.Color.appBorder, lineWidth: placed ? 0 : 1))
            // One step smaller to the eye (PHASE-6 C), 44 pt to the finger.
            .frame(minHeight: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(MomentStampView.name(kind)): \(words)")
        .accessibilityHint(placed ? "Takes it off the picture" : "Puts it on the picture")
        .accessibilityAddTraits(placed ? [.isButton, .isSelected] : .isButton)
        .accessibilityIdentifier("moments.studio.tray.\(kind.rawValue)")
    }
}

/// Chips in rows, each row as full as it fits (B5's tray).
struct MomentsStudioTrayFlow: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache _: inout ()) -> CGSize {
        let rows = arrange(width: proposal.width ?? .infinity, subviews: subviews)
        let height = rows.map(\.height).reduce(0, +) + spacing * CGFloat(max(rows.count - 1, 0))
        return CGSize(width: proposal.width ?? rows.map(\.width).max() ?? 0, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal _: ProposedViewSize, subviews: Subviews, cache _: inout ()) {
        var y = bounds.minY
        for row in arrange(width: bounds.width, subviews: subviews) {
            var x = bounds.minX
            for index in row.items {
                let size = subviews[index].sizeThatFits(.unspecified)
                subviews[index].place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
                x += size.width + spacing
            }
            y += row.height + spacing
        }
    }

    private struct Row {
        var items: [Int] = []
        var width: CGFloat = 0
        var height: CGFloat = 0
    }

    private func arrange(width: CGFloat, subviews: Subviews) -> [Row] {
        var rows: [Row] = [Row()]
        for index in subviews.indices {
            let size = subviews[index].sizeThatFits(.unspecified)
            let needed = rows[rows.count - 1].items.isEmpty ? size.width : rows[rows.count - 1].width + spacing + size.width
            if needed > width, !rows[rows.count - 1].items.isEmpty {
                rows.append(Row())
            }
            var row = rows[rows.count - 1]
            row.width = row.items.isEmpty ? size.width : row.width + spacing + size.width
            row.height = max(row.height, size.height)
            row.items.append(index)
            rows[rows.count - 1] = row
        }
        return rows
    }
}
