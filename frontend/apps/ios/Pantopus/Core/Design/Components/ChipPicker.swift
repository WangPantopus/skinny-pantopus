//
//  ChipPicker.swift
//  Pantopus
//
//  Wrapping group of selectable pill chips. The single-select initializer
//  behaves like a radio group (one id at a time); the multi-select
//  initializer behaves like a checkbox group (a set of ids). Selection is
//  hoisted through a `Binding`.
//

import SwiftUI

/// Token-styled chip group with single- and multi-select modes.
@MainActor
public struct ChipPicker: View {
    /// One selectable chip.
    public struct Option: Identifiable, Hashable, Sendable {
        public let id: String
        public let label: String
        public let icon: PantopusIcon?

        public init(id: String, label: String, icon: PantopusIcon? = nil) {
            self.id = id
            self.label = label
            self.icon = icon
        }

        /// Convenience when the visible label is also the stable id.
        public init(_ label: String, icon: PantopusIcon? = nil) {
            self.init(id: label, label: label, icon: icon)
        }
    }

    private enum Mode { case single, multi }

    /// Selected-chip appearance.
    ///
    /// - `filled`: solid `primary600` fill with inverse text/icon — the
    ///   default high-emphasis treatment.
    /// - `tinted`: pale `primary50` wash with a `primary100` border and
    ///   `primary600` icon / `primary700` text — the soft treatment the
    ///   A13.1 Add Guest design uses for its duration + areas chips.
    public enum Style: Sendable { case filled, tinted }

    private let options: [Option]
    private let mode: Mode
    private let style: Style
    private let identifier: String?
    @Binding private var single: String?
    @Binding private var multi: Set<String>

    /// Single-select picker. `selection` holds the chosen id (or `nil`).
    /// Tapping the chosen chip again clears the selection.
    public init(
        options: [Option],
        selection: Binding<String?>,
        style: Style = .filled,
        identifier: String? = nil
    ) {
        self.options = options
        mode = .single
        self.style = style
        self.identifier = identifier
        _single = selection
        _multi = .constant([])
    }

    /// Multi-select picker. `selection` holds the set of chosen ids.
    public init(
        options: [Option],
        selection: Binding<Set<String>>,
        style: Style = .filled,
        identifier: String? = nil
    ) {
        self.options = options
        mode = .multi
        self.style = style
        self.identifier = identifier
        _single = .constant(nil)
        _multi = selection
    }

    public var body: some View {
        ChipFlowLayout(spacing: Spacing.s2) {
            ForEach(options) { option in
                chip(for: option)
            }
        }
    }

    @ViewBuilder
    private func chip(for option: Option) -> some View {
        let selected = isSelected(option.id)
        Button {
            toggle(option.id)
        } label: {
            HStack(spacing: Spacing.s1) {
                if let icon = option.icon {
                    Icon(icon, size: 16, color: iconColor(selected: selected))
                }
                Text(option.label)
                    .pantopusTextStyle(.small)
                    .foregroundStyle(foregroundColor(selected: selected))
            }
            .padding(.horizontal, Spacing.s3)
            .frame(minHeight: 36)
            .background(backgroundColor(selected: selected))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.pill, style: .continuous)
                    .stroke(borderColor(selected: selected), lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
        }
        .buttonStyle(.plain)
        .frame(minWidth: 44, minHeight: 44)
        .accessibilityIdentifier(identifier.map { "\($0).\(option.id)" } ?? option.id)
        .accessibilityLabel(option.label)
        .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
    }

    private func isSelected(_ id: String) -> Bool {
        switch mode {
        case .single: single == id
        case .multi: multi.contains(id)
        }
    }

    private func toggle(_ id: String) {
        switch mode {
        case .single:
            single = (single == id) ? nil : id
        case .multi:
            if multi.contains(id) { multi.remove(id) } else { multi.insert(id) }
        }
    }

    // MARK: - Style-aware colors

    private func backgroundColor(selected: Bool) -> Color {
        guard selected else { return Theme.Color.appSurface }
        return style == .tinted ? Theme.Color.primary50 : Theme.Color.primary600
    }

    private func borderColor(selected: Bool) -> Color {
        guard selected else { return Theme.Color.appBorder }
        return style == .tinted ? Theme.Color.primary100 : Color.clear
    }

    private func foregroundColor(selected: Bool) -> Color {
        guard selected else { return Theme.Color.appText }
        return style == .tinted ? Theme.Color.primary700 : Theme.Color.appTextInverse
    }

    private func iconColor(selected: Bool) -> Color {
        guard selected else { return Theme.Color.appText }
        return style == .tinted ? Theme.Color.primary600 : Theme.Color.appTextInverse
    }
}

/// Left-to-right wrapping layout for the chip group. Kept private so the
/// component stays self-contained within `Core/Design`.
private struct ChipFlowLayout: Layout {
    var spacing: CGFloat

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache _: inout ()) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        var x: CGFloat = 0
        var rowHeight: CGFloat = 0
        var totalHeight: CGFloat = 0
        var maxRowWidth: CGFloat = 0

        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x + size.width > maxWidth, x > 0 {
                totalHeight += rowHeight + spacing
                maxRowWidth = max(maxRowWidth, x - spacing)
                x = 0
                rowHeight = 0
            }
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }

        totalHeight += rowHeight
        maxRowWidth = max(maxRowWidth, x - spacing)
        return CGSize(width: maxRowWidth, height: totalHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache _: inout ()) {
        let maxWidth = proposal.width ?? bounds.width
        var x: CGFloat = bounds.minX
        var y: CGFloat = bounds.minY
        var rowHeight: CGFloat = 0

        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x + size.width > bounds.minX + maxWidth, x > bounds.minX {
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

#Preview("Single + Multi") {
    @Previewable @State var single: String? = "owner"
    @Previewable @State var multi = Set(["wifi", "gate"])
    return VStack(alignment: .leading, spacing: Spacing.s4) {
        ChipPicker(
            options: [
                .init(id: "owner", label: "Owner"),
                .init(id: "tenant", label: "Tenant"),
                .init(id: "guest", label: "Guest")
            ],
            selection: $single
        )
        ChipPicker(
            options: [
                .init(id: "wifi", label: "Wi-Fi", icon: .wifi),
                .init(id: "gate", label: "Gate", icon: .lock),
                .init(id: "alarm", label: "Alarm", icon: .shield)
            ],
            selection: $multi
        )
    }
    .padding()
    .background(Theme.Color.appBg)
}
