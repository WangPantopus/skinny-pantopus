//
//  PaperStack.swift
//  Pantopus
//
//  Multi-page tilted paper sheets used as the document-preview hero
//  on archival mail variants (A17.10 Records). Three z-stacked
//  PaperSheets at -3° / +1° / -1° rotations communicate "this is an
//  archival document, not a notification."
//
//  Design reference: `docs/designs/A17/records.jsx` (PaperStack) and
//  `docs/new-design-parity.md` § A17.10.
//

import SwiftUI

/// Three z-stacked tilted paper sheets. Caller-supplied `content`
/// renders inside the front sheet's safe area; the back two sheets are
/// always rendered as muted decoration with shim lines.
@MainActor
public struct PaperStack<Content: View>: View {
    private let content: () -> Content

    public init(@ViewBuilder content: @escaping () -> Content = { EmptyView() }) {
        self.content = content
    }

    public var body: some View {
        ZStack {
            // Back sheet — rotated -3°, muted fill, decorative shim lines.
            PaperSheet(tone: .muted)
                .rotationEffect(.degrees(-3))
                .offset(x: -10, y: 6)

            // Middle sheet — rotated +1°, muted fill.
            PaperSheet(tone: .muted)
                .rotationEffect(.degrees(1))
                .offset(x: 10, y: 3)

            // Front sheet — rotated -1°, paper-white, holds the
            // caller-supplied overlay above the shim-line preview.
            PaperSheet(tone: .paper) {
                content()
            }
            .rotationEffect(.degrees(-1))
        }
        .frame(width: 320, height: 384)
        .accessibilityElement(children: .contain)
    }
}

/// A single 280×360pt paper sheet — paper-white background, hairline
/// border, and a deterministic 6-line content preview underneath any
/// caller-supplied overlay.
@MainActor
private struct PaperSheet<Overlay: View>: View {
    enum Tone { case paper, muted }

    let tone: Tone
    let overlay: Overlay

    init(tone: Tone, @ViewBuilder overlay: () -> Overlay = { EmptyView() }) {
        self.tone = tone
        self.overlay = overlay()
    }

    var body: some View {
        ZStack(alignment: .topLeading) {
            background
            shimLines
                .padding(Spacing.s4)
            overlay
                .padding(Spacing.s4)
        }
        .frame(width: 280, height: 360)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xs, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xs, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .shadow(color: shadowColor, radius: shadowRadius, x: 0, y: shadowY)
    }

    private var background: some View {
        Group {
            switch tone {
            case .paper: Theme.Color.appSurface
            case .muted: Theme.Color.appSurfaceSunken
            }
        }
    }

    private var shimLines: some View {
        // Six shim-lines as content preview — alternating heading (dark,
        // 5pt) and body (light, 3pt) — matches the design's letterhead
        // shimmer pattern at our 280pt page width.
        let widths: [CGFloat] = [0.38, 0.62, 0.55, 0.42, 0.74, 0.68]
        let isHeading: [Bool] = [true, false, false, true, false, false]
        return VStack(alignment: .leading, spacing: Spacing.s1) {
            ForEach(0..<6, id: \.self) { index in
                Capsule()
                    .fill(isHeading[index]
                        ? Theme.Color.appTextStrong.opacity(0.85)
                        : Theme.Color.appBorderStrong)
                    .frame(height: isHeading[index] ? 5 : 3)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .frame(width: nil)
                    .scaleEffect(x: widths[index], y: 1, anchor: .leading)
                if index == 2 {
                    Spacer().frame(height: Spacing.s1)
                }
            }
            Spacer()
        }
    }

    private var shadowColor: Color {
        switch tone {
        case .paper: Color.black.opacity(0.14)
        case .muted: Color.black.opacity(0.08)
        }
    }

    private var shadowRadius: CGFloat {
        switch tone {
        case .paper: 8
        case .muted: 4
        }
    }

    private var shadowY: CGFloat {
        switch tone {
        case .paper: 6
        case .muted: 2
        }
    }
}

#Preview("PaperStack") {
    PaperStack {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            Text("MERIDIAN WEALTH")
                .font(.system(size: 11, weight: .heavy))
                .foregroundStyle(Theme.Color.appText)
            Text("Q1 2026 Statement")
                .font(.system(size: 9))
                .foregroundStyle(Theme.Color.appTextSecondary)
            Spacer()
        }
    }
    .padding(Spacing.s4)
    .background(Theme.Color.appBg)
}
