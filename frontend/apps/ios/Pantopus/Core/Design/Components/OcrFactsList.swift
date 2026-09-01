//
//  OcrFactsList.swift
//  Pantopus
//
//  A card of label/value rows "read off" a scanned document — the
//  `ExtractedFacts` ("Read from your scans") slot in the A17.14 Unboxing
//  flow. Each row is a small tinted icon chip + label + value (optionally
//  monospaced) + optional secondary note + optional trailing tag pill. The
//  card header carries a title and an optional status / confidence chip
//  (e.g. "Tap to edit" → "Saved", or "98% read").
//
//  Pure presentation: the consuming screen owns the OCR data (B2.4 stubs it
//  from sample data — no model runs in the primitive). Mirrors `OcrFactsList`
//  on Android.
//

import SwiftUI

/// Tone for the header status chip and per-row tag pill.
///
/// - `neutral` — muted surface + secondary text (e.g. an editable "Tap to
///   edit" hint).
/// - `success` — green tint (e.g. a locked "Saved" state, or a "2-yr"
///   warranty tag).
public enum OcrFactsTone: Sendable, Equatable {
    case neutral
    case success
}

/// The header accessory on an `OcrFactsList` — an icon + short label that
/// doubles as the editable/saved status and the optional confidence chip.
public struct OcrFactsStatus: Sendable, Equatable {
    public let icon: PantopusIcon
    public let text: String
    public let tone: OcrFactsTone

    public init(icon: PantopusIcon, text: String, tone: OcrFactsTone = .neutral) {
        self.icon = icon
        self.text = text
        self.tone = tone
    }
}

/// A trailing pill on a fact row (e.g. the `2-yr` warranty length).
public struct OcrFactTag: Sendable, Equatable {
    public let text: String
    public let tone: OcrFactsTone

    public init(text: String, tone: OcrFactsTone = .success) {
        self.text = text
        self.tone = tone
    }
}

/// One fact "read off" the scan.
public struct OcrFact: Identifiable, Sendable, Equatable {
    public let id: String
    public let icon: PantopusIcon
    public let label: String
    public let value: String
    /// When true the value renders monospaced (serials, tracking numbers).
    public let isCode: Bool
    /// Optional dimmer second line under the value (model number, store…).
    public let note: String?
    /// Optional trailing pill (e.g. `2-yr`).
    public let tag: OcrFactTag?

    public init(
        id: String = UUID().uuidString,
        icon: PantopusIcon,
        label: String,
        value: String,
        isCode: Bool = false,
        note: String? = nil,
        tag: OcrFactTag? = nil
    ) {
        self.id = id
        self.icon = icon
        self.label = label
        self.value = value
        self.isCode = isCode
        self.note = note
        self.tag = tag
    }
}

/// White card of OCR-extracted facts. Header title + optional status chip,
/// then one hairline-separated row per fact.
@MainActor
public struct OcrFactsList: View {
    private let title: String
    private let status: OcrFactsStatus?
    private let facts: [OcrFact]

    public init(title: String, status: OcrFactsStatus? = nil, facts: [OcrFact]) {
        self.title = title
        self.status = status
        self.facts = facts
    }

    public var body: some View {
        VStack(spacing: Spacing.s0) {
            header
            ForEach(Array(facts.enumerated()), id: \.element.id) { offset, fact in
                OcrFactRowView(fact: fact)
                if offset < facts.count - 1 {
                    Rectangle()
                        .fill(Theme.Color.appBorderSubtle)
                        .frame(height: 1)
                }
            }
        }
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .accessibilityElement(children: .contain)
    }

    private var header: some View {
        HStack(spacing: Spacing.s2) {
            Text(title)
                .pantopusTextStyle(.overline)
                .foregroundStyle(Theme.Color.appTextSecondary)
            Spacer(minLength: Spacing.s2)
            if let status {
                HStack(spacing: Spacing.s1) {
                    Icon(status.icon, size: 11, strokeWidth: 2, color: statusColor(status.tone))
                    Text(status.text)
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(statusColor(status.tone))
                }
            }
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(Theme.Color.appBorderSubtle)
                .frame(height: 1)
        }
    }

    private func statusColor(_ tone: OcrFactsTone) -> Color {
        switch tone {
        case .neutral: Theme.Color.appTextSecondary
        case .success: Theme.Color.success
        }
    }
}

private struct OcrFactRowView: View {
    let fact: OcrFact

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.s3) {
            RoundedRectangle(cornerRadius: Radii.sm, style: .continuous)
                .fill(Theme.Color.appSurfaceSunken)
                .frame(width: 24, height: 24)
                .overlay(Icon(fact.icon, size: 13, strokeWidth: 2, color: Theme.Color.appTextStrong))

            VStack(alignment: .leading, spacing: 1) {
                Text(fact.label)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                Text(fact.value)
                    .font(.system(size: 13, weight: .semibold))
                    .monospaced(fact.isCode)
                    .foregroundStyle(Theme.Color.appText)
                if let note = fact.note {
                    Text(note)
                        .font(.system(size: 11, weight: .regular))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            if let tag = fact.tag {
                Text(tag.text)
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(tagForeground(tag.tone))
                    .padding(.horizontal, Spacing.s2)
                    .padding(.vertical, 3)
                    .background(
                        Capsule().fill(tagBackground(tag.tone))
                    )
            }
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityLabel)
    }

    private var accessibilityLabel: String {
        var parts = ["\(fact.label): \(fact.value)"]
        if let note = fact.note { parts.append(note) }
        if let tag = fact.tag { parts.append(tag.text) }
        return parts.joined(separator: ", ")
    }

    private func tagForeground(_ tone: OcrFactsTone) -> Color {
        switch tone {
        case .neutral: Theme.Color.appTextSecondary
        case .success: Theme.Color.success
        }
    }

    private func tagBackground(_ tone: OcrFactsTone) -> Color {
        switch tone {
        case .neutral: Theme.Color.appSurfaceSunken
        case .success: Theme.Color.successBg
        }
    }
}

#Preview("Read from your scans") {
    let facts = [
        OcrFact(icon: .package, label: "Product", value: "Breville Barista Express", note: "BES870XL · Stainless"),
        OcrFact(icon: .hash, label: "Serial", value: "BES870-22F-091473", isCode: true),
        OcrFact(
            icon: .receipt,
            label: "Purchased",
            value: "May 28, 2026 · $699.95",
            note: "Williams Sonoma · card ••4417"
        ),
        OcrFact(
            icon: .shieldCheck,
            label: "Warranty until",
            value: "May 28, 2028",
            tag: OcrFactTag(text: "2-yr", tone: .success)
        )
    ]
    return VStack(spacing: Spacing.s4) {
        OcrFactsList(
            title: "Read from your scans",
            status: OcrFactsStatus(icon: .scanLine, text: "Tap to edit", tone: .neutral),
            facts: facts
        )
        OcrFactsList(
            title: "Read from your scans",
            status: OcrFactsStatus(icon: .lock, text: "Saved", tone: .success),
            facts: facts
        )
    }
    .padding(Spacing.s4)
    .background(Theme.Color.appBg)
}
