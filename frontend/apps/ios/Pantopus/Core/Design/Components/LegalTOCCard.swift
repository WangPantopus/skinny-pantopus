//
//  LegalTOCCard.swift
//  Pantopus
//
//  A19 legal scaffold — a collapsible "Jump to section" table of contents.
//  The header toggles open/closed; each expanded row is a numbered section
//  link. State is owned by the host screen (it animates the toggle and
//  scrolls to the chosen section); the card itself is stateless.
//

import SwiftUI

/// A collapsible table-of-contents card. Bind `isOpen` + `onToggle` for the
/// header chevron, `items` for the section titles, and `onJump` for a row tap.
/// `onJump`'s index is the 0-based position in `items`; the matching heading
/// is `LegalSection(number: index + 1)`.
public struct LegalTOCCard: View {
    private let items: [String]
    private let isOpen: Bool
    private let onToggle: () -> Void
    private let onJump: (Int) -> Void

    public init(
        items: [String],
        isOpen: Bool,
        onToggle: @escaping () -> Void,
        onJump: @escaping (Int) -> Void
    ) {
        self.items = items
        self.isOpen = isOpen
        self.onToggle = onToggle
        self.onJump = onJump
    }

    public var body: some View {
        VStack(spacing: Spacing.s0) {
            header
            if isOpen {
                hairline
                rows
            }
        }
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .strokeBorder(Theme.Color.appBorder, lineWidth: 1)
        )
        .shadow(color: Theme.Color.appText.opacity(0.04), radius: 2, x: 0, y: 1)
        .accessibilityIdentifier("legalTOCCard")
    }

    // MARK: - Header

    private var header: some View {
        Button(action: onToggle) {
            HStack(spacing: Spacing.s2) {
                Icon(.list, size: 14, strokeWidth: 2.2, color: Theme.Color.primary600)
                Text("Jump to section")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundColor(Theme.Color.appText)
                Spacer(minLength: Spacing.s2)
                if !isOpen {
                    Text("\(items.count) sections")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundColor(Theme.Color.appTextSecondary)
                }
                Icon(
                    isOpen ? .chevronUp : .chevronDown,
                    size: 16,
                    color: Theme.Color.appTextSecondary
                )
            }
            .padding(.horizontal, 14)
            .padding(.vertical, Spacing.s3)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("legalTOCCard_toggle")
        .accessibilityLabel("Jump to section")
        .accessibilityValue("\(items.count) sections, \(isOpen ? "expanded" : "collapsed")")
        .accessibilityHint(isOpen ? "Collapses the table of contents" : "Expands the table of contents")
    }

    // MARK: - Rows

    private var rows: some View {
        VStack(spacing: Spacing.s0) {
            ForEach(Array(items.enumerated()), id: \.offset) { index, title in
                Button(action: { onJump(index) }, label: {
                    row(index: index, title: title)
                })
                .buttonStyle(.plain)
                .accessibilityIdentifier("legalTOCCard_row_\(index)")
                .accessibilityLabel(title)
                .accessibilityHint("Jumps to section \(index + 1)")

                if index < items.count - 1 {
                    hairline
                }
            }
        }
        .padding(.top, Spacing.s1)
        .padding(.bottom, 6)
    }

    private func row(index: Int, title: String) -> some View {
        HStack(spacing: 10) {
            Text(String(format: "%02d", index + 1))
                .font(.system(size: 10.5, weight: .bold))
                .foregroundColor(Theme.Color.primary700)
                .frame(width: 22, height: 22)
                .background(
                    RoundedRectangle(cornerRadius: Radii.sm, style: .continuous)
                        .fill(Theme.Color.primary50)
                )
            Text(title)
                .font(.system(size: 12.5, weight: .medium))
                .foregroundColor(Theme.Color.appTextStrong)
                .frame(maxWidth: .infinity, alignment: .leading)
            Icon(.chevronRight, size: 13, strokeWidth: 2, color: Theme.Color.appTextMuted)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 9)
        .contentShape(Rectangle())
    }

    private var hairline: some View {
        Rectangle()
            .fill(Theme.Color.appBorderSubtle)
            .frame(height: 1)
    }
}

#Preview("Expanded") {
    LegalTOCCard(
        items: [
            "Overview", "Information we collect", "How we use it",
            "Identity pillars & privacy", "Sharing & disclosure"
        ],
        isOpen: true,
        onToggle: {},
        onJump: { _ in }
    )
    .padding(Spacing.s5)
    .background(Theme.Color.appSurface)
}

#Preview("Collapsed") {
    LegalTOCCard(
        items: Array(repeating: "Section", count: 10),
        isOpen: false,
        onToggle: {},
        onJump: { _ in }
    )
    .padding(Spacing.s5)
    .background(Theme.Color.appSurface)
}
