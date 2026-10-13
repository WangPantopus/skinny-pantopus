//
//  PlanChoiceChips.swift
//  Pantopus
//
//  Board P2 "Choices · ChoiceChip": selected is fill, outline and a check.
//  Under about 360 pt of width, or at large text, a chip group becomes
//  full-width rows with a trailing check (BRIEF journey 13).
//

import SwiftUI

struct PlanChoiceOption<ID: Hashable>: Identifiable {
    let id: ID
    let label: String
    var isEnabled = true
}

struct PlanChoiceChips<ID: Hashable>: View {
    let options: [PlanChoiceOption<ID>]
    let isSelected: (ID) -> Bool
    let onTap: (ID) -> Void
    /// What the group is, for VoiceOver ("Who's coming").
    let groupLabel: String
    var identifier: String?

    @Environment(\.dynamicTypeSize) private var typeSize
    @State private var width: CGFloat = 400

    var body: some View {
        Group {
            if typeSize.isAccessibilitySize || width < 360 {
                rows
            } else {
                PlanFlowLayout(spacing: Spacing.s2) {
                    ForEach(options) { chip($0) }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(GeometryReader { geo in
            Color.clear.onAppear { width = geo.size.width }
                .onChange(of: geo.size.width) { _, new in width = new }
        })
        .accessibilityElement(children: .contain)
        .accessibilityLabel(groupLabel)
    }

    private func chip(_ option: PlanChoiceOption<ID>) -> some View {
        let selected = isSelected(option.id)
        return Button { onTap(option.id) } label: {
            HStack(spacing: 6) {
                if selected { Icon(.check, size: 14, strokeWidth: 2.6, color: Theme.Color.primary700) }
                Text(option.label)
                    .planFont(.smallStrong)
                    .foregroundStyle(selected ? Theme.Color.primary700 : Theme.Color.appText)
                    .lineLimit(1)
            }
            .padding(.horizontal, 13)
            .frame(minHeight: 34)
            .background(Capsule().fill(selected ? Theme.Color.primary50 : Color.clear))
            .overlay(Capsule().stroke(selected ? Theme.Color.primary700 : Theme.Color.appTextSecondary, lineWidth: 1))
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .frame(minHeight: 44)
        .disabled(!option.isEnabled)
        .opacity(option.isEnabled ? 1 : 0.5)
        .accessibilityLabel(option.label)
        .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
        .accessibilityIdentifier(identifier.map { "\($0).\(option.label)" } ?? option.label)
    }

    private var rows: some View {
        VStack(spacing: 0) {
            ForEach(Array(options.enumerated()), id: \.element.id) { index, option in
                let selected = isSelected(option.id)
                Button { onTap(option.id) } label: {
                    HStack(spacing: Spacing.s3) {
                        Text(option.label)
                            .planFont(.body)
                            .foregroundStyle(Theme.Color.appText)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .fixedSize(horizontal: false, vertical: true)
                        if selected { Icon(.check, size: 22, strokeWidth: 2.6, color: Theme.Color.primary600) }
                    }
                    .padding(.vertical, 10)
                    .frame(minHeight: 52)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .disabled(!option.isEnabled)
                .opacity(option.isEnabled ? 1 : 0.5)
                .accessibilityLabel(option.label)
                .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
                if index < options.count - 1 { Divider().overlay(Theme.Color.appBorder) }
            }
        }
        .padding(.horizontal, 14)
        .background(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous).fill(Theme.Color.appSurface))
        .overlay(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous).stroke(Theme.Color.appBorder, lineWidth: 1))
    }
}

/// Left-to-right wrapping layout for chips.
struct PlanFlowLayout: Layout {
    var spacing: CGFloat

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache _: inout ()) -> CGSize {
        let rows = arrange(width: proposal.width ?? .infinity, subviews: subviews)
        let height = rows.reduce(0) { $0 + $1.height } + spacing * CGFloat(max(rows.count - 1, 0))
        let width = rows.map(\.width).max() ?? 0
        return CGSize(width: proposal.width ?? width, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal _: ProposedViewSize, subviews: Subviews, cache _: inout ()) {
        var y = bounds.minY
        for row in arrange(width: bounds.width, subviews: subviews) {
            var x = bounds.minX
            for index in row.indices {
                let size = subviews[index].sizeThatFits(.unspecified)
                subviews[index].place(at: CGPoint(x: x, y: y + (row.height - size.height) / 2), proposal: ProposedViewSize(size))
                x += size.width + spacing
            }
            y += row.height + spacing
        }
    }

    private struct Row {
        var indices: [Int] = []
        var width: CGFloat = 0
        var height: CGFloat = 0
    }

    private func arrange(width: CGFloat, subviews: Subviews) -> [Row] {
        var rows: [Row] = []
        var current = Row()
        for index in subviews.indices {
            let size = subviews[index].sizeThatFits(.unspecified)
            let needed = current.indices.isEmpty ? size.width : current.width + spacing + size.width
            if needed > width, !current.indices.isEmpty {
                rows.append(current)
                current = Row()
            }
            current.width = current.indices.isEmpty ? size.width : current.width + spacing + size.width
            current.height = max(current.height, size.height)
            current.indices.append(index)
        }
        if !current.indices.isEmpty { rows.append(current) }
        return rows
    }
}
