//
//  SourcePill.swift
//  Pantopus
//
//  Small pill badge used to surface the provenance / sync status of an
//  external data source (county records, MLS, owner
//  confirmation). Tone drives the colour pair; an optional leading icon
//  reinforces the status. Decorative by itself — compose inside a labelled
//  row so VoiceOver reads source + status together.
//

import SwiftUI

/// Colour tone for a `SourcePill`.
public enum SourcePillTone: Sendable, Hashable {
    case success
    case warning
    case error
    case neutral
}

/// Uppercase status pill: optional icon + label on a tinted capsule.
@MainActor
public struct SourcePill: View {
    private let label: String
    private let tone: SourcePillTone
    private let icon: PantopusIcon?

    public init(_ label: String, tone: SourcePillTone = .neutral, icon: PantopusIcon? = nil) {
        self.label = label
        self.tone = tone
        self.icon = icon
    }

    public var body: some View {
        HStack(spacing: Spacing.s1) {
            if let icon {
                Icon(icon, size: 11, color: foreground)
            }
            Text(label)
                .pantopusTextStyle(.overline)
                .foregroundStyle(foreground)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, Spacing.s1)
        .background(background)
        .clipShape(Capsule())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(label)
    }

    private var background: Color {
        switch tone {
        case .success: Theme.Color.successBg
        case .warning: Theme.Color.warningBg
        case .error: Theme.Color.errorBg
        case .neutral: Theme.Color.appSurfaceSunken
        }
    }

    private var foreground: Color {
        switch tone {
        case .success: Theme.Color.success
        case .warning: Theme.Color.warning
        case .error: Theme.Color.error
        case .neutral: Theme.Color.appTextSecondary
        }
    }
}

#Preview("Source pills") {
    HStack(spacing: Spacing.s2) {
        SourcePill("Synced", tone: .success, icon: .check)
        SourcePill("Mismatch", tone: .warning, icon: .alertTriangle)
        SourcePill("Failed", tone: .error, icon: .alertCircle)
        SourcePill("Pending")
    }
    .padding()
    .background(Theme.Color.appBg)
}
