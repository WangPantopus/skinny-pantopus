//
//  RedactionScrim.swift
//  Pantopus
//
//  B1.3 — identity-preview primitive for A18.5 "View as".
//
//  An overlay you place over any field or section to show it's withheld
//  from the currently-previewed viewer. It blurs + dims the wrapped
//  content and floats a centred lock chip ("Hidden from public", caller-
//  supplied copy) in `appSurfaceSunken`. The `level` tunes how aggressive
//  the treatment is:
//
//    • .hidden  — fully withheld: heavy blur, opaque sunken wash, content
//                 dropped from the accessibility tree.
//    • .fuzzed  — obscured but shape-legible: medium blur + wash.
//    • .partial — a hint of redaction: light blur, faint wash (used when
//                 a coarse value still shows, e.g. "Maple Heights area").
//
//  Composes over arbitrary children, so the View-As render (B5.2) can wrap
//  whichever rows the privacy resolver marks hidden without bespoke markup.
//

import SwiftUI

/// How hard the scrim hides its content. Raw treatment values are
/// geometry/opacity, not on the design-token scale, so they live on the
/// enum rather than as `Spacing`/`Radii` tokens.
public enum RedactionLevel: String, Sendable, CaseIterable, Hashable {
    case hidden
    case fuzzed
    case partial

    /// Gaussian blur applied to the wrapped content (points).
    var blurRadius: CGFloat {
        switch self {
        case .hidden: 10
        case .fuzzed: 6
        case .partial: 3
        }
    }

    /// Opacity of the `appSurfaceSunken` wash drawn over the content.
    var scrimOpacity: Double {
        switch self {
        case .hidden: 0.6
        case .fuzzed: 0.4
        case .partial: 0.18
        }
    }

    /// Opacity the content is dimmed to beneath the wash.
    var contentOpacity: Double {
        switch self {
        case .hidden: 0.35
        case .fuzzed: 0.6
        case .partial: 0.85
        }
    }
}

/// Blur + wash + lock-chip overlay for withheld profile fields.
@MainActor
public struct RedactionScrim<Content: View>: View {
    private let level: RedactionLevel
    private let label: String
    private let showsChip: Bool
    private let content: Content

    /// - Parameters:
    ///   - level: How aggressively to hide the content.
    ///   - label: Lock-chip copy (e.g. "Hidden from public").
    ///   - showsChip: Hide the lock chip when false (wash only).
    ///   - content: The field/section being redacted.
    public init(
        level: RedactionLevel,
        label: String = "Hidden",
        showsChip: Bool = true,
        @ViewBuilder content: () -> Content
    ) {
        self.level = level
        self.label = label
        self.showsChip = showsChip
        self.content = content()
    }

    public var body: some View {
        ZStack {
            content
                .blur(radius: level.blurRadius)
                .opacity(level.contentOpacity)
                .accessibilityHidden(level == .hidden)

            Rectangle()
                .fill(Theme.Color.appSurfaceSunken)
                .opacity(level.scrimOpacity)
                .allowsHitTesting(false)

            if showsChip {
                lockChip
            }
        }
        .clipped()
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("redactionScrim")
    }

    private var lockChip: some View {
        HStack(spacing: Spacing.s1) {
            Icon(.lock, size: 12, color: Theme.Color.appTextSecondary)
            Text(label)
                .font(.system(size: 11.5, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s1)
        .background(
            Capsule(style: .continuous).fill(Theme.Color.appSurfaceSunken)
        )
        .overlay(
            Capsule(style: .continuous).strokeBorder(Theme.Color.appBorderStrong, lineWidth: 1)
        )
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(label)
        .accessibilityIdentifier("redactionScrim_lockChip")
    }
}

// MARK: - Preview

#Preview("RedactionScrim") {
    func sampleField(_ title: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            Text(title)
                .pantopusTextStyle(.overline)
                .foregroundStyle(Theme.Color.appTextMuted)
            Text(value)
                .font(.system(size: 13.5, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Spacing.s3)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
    }

    return VStack(spacing: Spacing.s4) {
        ForEach(RedactionLevel.allCases, id: \.self) { level in
            RedactionScrim(level: level, label: "Hidden from public") {
                sampleField("Contact", "(555) 010-2837")
            }
        }
    }
    .padding(Spacing.s4)
    .background(Theme.Color.appBg)
}
