//
//  DataRow.swift
//  Pantopus
//
//  Read-only label / value row for detail surfaces. The label sits left
//  with an optional secondary line beneath it; the value sits right and
//  can render monospaced (`mono`) or carry the amber mismatch treatment
//  (`mismatch`: tint + leading rule + alert icon) when external sources
//  disagree. An optional trailing `flag` chip is also supported. Compose
//  several inside a padding-free card.
//

import SwiftUI

/// A single label/value row with optional sub-text and status flag.
@MainActor
public struct DataRow: View {
    /// Optional trailing badge rendered next to the value.
    public struct Flag: Sendable {
        public let text: String
        public let variant: StatusChipVariant

        public init(_ text: String, variant: StatusChipVariant = .neutral) {
            self.text = text
            self.variant = variant
        }
    }

    private let label: String
    private let value: String
    private let sub: String?
    private let mono: Bool
    private let mismatch: Bool
    private let flag: Flag?
    private let identifier: String?

    public init(
        label: String,
        value: String,
        sub: String? = nil,
        mono: Bool = false,
        mismatch: Bool = false,
        flag: Flag? = nil,
        identifier: String? = nil
    ) {
        self.label = label
        self.value = value
        self.sub = sub
        self.mono = mono
        self.mismatch = mismatch
        self.flag = flag
        self.identifier = identifier
    }

    public var body: some View {
        HStack(alignment: .top, spacing: Spacing.s3) {
            VStack(alignment: .leading, spacing: Spacing.s1) {
                Text(label)
                    .pantopusTextStyle(.small)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                if let sub {
                    Text(sub)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextMuted)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            Spacer(minLength: Spacing.s2)
            HStack(spacing: Spacing.s2) {
                if mismatch {
                    Icon(.alertTriangle, size: 13, color: Theme.Color.warning)
                }
                valueText
                if let flag {
                    StatusChip(flag.text, variant: flag.variant)
                }
            }
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(mismatch ? Theme.Color.warningBg : Color.clear)
        .overlay(alignment: .leading) {
            if mismatch {
                Rectangle()
                    .fill(Theme.Color.warning)
                    .frame(width: 3)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityText)
        .modifier(DataRowIdentifier(identifier: identifier))
    }

    @ViewBuilder private var valueText: some View {
        if mono {
            Text(value)
                .font(.system(.body, design: .monospaced))
                .foregroundStyle(Theme.Color.appText)
                .multilineTextAlignment(.trailing)
        } else {
            Text(value)
                .pantopusTextStyle(.small)
                .foregroundStyle(Theme.Color.appText)
                .multilineTextAlignment(.trailing)
        }
    }

    private var accessibilityText: String {
        var parts = ["\(label), \(value)"]
        if let sub { parts.append(sub) }
        if mismatch { parts.append("Sources disagree") }
        if let flag { parts.append(flag.text) }
        return parts.joined(separator: ", ")
    }
}

/// Conditional `accessibilityIdentifier` so the combined row keeps a single
/// stable id for UI tests while leaving it unset when no id is supplied.
private struct DataRowIdentifier: ViewModifier {
    let identifier: String?

    func body(content: Content) -> some View {
        if let identifier {
            content.accessibilityIdentifier(identifier)
        } else {
            content
        }
    }
}

#Preview("Data rows") {
    VStack(spacing: Spacing.s0) {
        DataRow(label: "Year built", value: "1998", mono: true)
        Divider().background(Theme.Color.appBorderSubtle)
        DataRow(label: "Square footage", value: "2,140 sq ft", sub: "Heated area", mono: true)
        Divider().background(Theme.Color.appBorderSubtle)
        DataRow(
            label: "Bedrooms",
            value: "2 · county says 3",
            sub: "Edited Apr 4, 2026",
            mono: true,
            mismatch: true
        )
        Divider().background(Theme.Color.appBorderSubtle)
        DataRow(label: "HOA", value: "Maplewood Ridge", flag: .init("Active", variant: .success))
    }
    .background(Theme.Color.appSurface)
    .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
    .padding()
    .background(Theme.Color.appBg)
}
