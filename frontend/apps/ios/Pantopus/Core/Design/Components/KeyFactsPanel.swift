//
//  KeyFactsPanel.swift
//  Pantopus
//
//  Sunken-surface card of key/value rows. Values flagged `isCode` render
//  monospace with a copy-to-clipboard button.
//

import SwiftUI
import UIKit

/// One row in a `KeyFactsPanel`.
public struct KeyFactRow: Identifiable, Sendable {
    public let id: String
    public let label: String
    public let value: String
    /// When true the value renders monospace and gets a copy button.
    public let isCode: Bool

    public init(id: String = UUID().uuidString, label: String, value: String, isCode: Bool = false) {
        self.id = id
        self.label = label
        self.value = value
        self.isCode = isCode
    }
}

/// Sunken-surface K/V card.
@MainActor
public struct KeyFactsPanel: View {
    private let rows: [KeyFactRow]

    public init(rows: [KeyFactRow]) {
        self.rows = rows
    }

    public var body: some View {
        VStack(spacing: Spacing.s0) {
            ForEach(Array(rows.enumerated()), id: \.element.id) { offset, row in
                KeyFactRowView(row: row)
                if offset < rows.count - 1 {
                    Divider().background(Theme.Color.appBorderSubtle)
                }
            }
        }
        .padding(Spacing.s3)
        .background(Theme.Color.appSurfaceSunken)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
    }
}

private struct KeyFactRowView: View {
    let row: KeyFactRow
    @State private var justCopied = false

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: Spacing.s3) {
            Text(row.label)
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .frame(minWidth: 96, alignment: .leading)
            Spacer(minLength: Spacing.s0)
            if row.isCode {
                Text(row.value)
                    .pantopusTextStyle(.small)
                    .monospaced()
                    .foregroundStyle(Theme.Color.appText)
                    .textSelection(.enabled)
                Button {
                    UIPasteboard.general.string = row.value
                    justCopied = true
                    Task { @MainActor in
                        try? await Task.sleep(nanoseconds: 1_400_000_000)
                        justCopied = false
                    }
                } label: {
                    Icon(justCopied ? .check : .copy, size: 16, color: Theme.Color.primary600)
                }
                .frame(minWidth: 44, minHeight: 44)
                .accessibilityLabel(justCopied ? "Copied" : "Copy \(row.label)")
            } else {
                Text(row.value)
                    .pantopusTextStyle(.small)
                    .foregroundStyle(Theme.Color.appText)
                    .multilineTextAlignment(.trailing)
            }
        }
        .padding(.vertical, Spacing.s2)
    }
}

#Preview {
    KeyFactsPanel(rows: [
        KeyFactRow(label: "Order ID", value: "PAN-48291", isCode: true),
        KeyFactRow(label: "Placed", value: "Mar 18, 2026"),
        KeyFactRow(label: "Tracking", value: "1Z999AA10123456784", isCode: true),
        KeyFactRow(label: "Status", value: "Out for delivery")
    ])
    .padding()
    .background(Theme.Color.appBg)
}
