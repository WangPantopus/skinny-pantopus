//
//  PillarStrip.swift
//  Pantopus
//
//  Profile / persona "strength" strip: a labelled percentage with a
//  proportional fill bar. Used by the Professional Profile and Edit Persona
//  surfaces to show how complete an identity is. `tint` accepts an identity
//  pillar colour (Personal / Home / Business) and defaults to primary.
//

import SwiftUI

/// Labelled strength bar with a proportional, tinted fill.
@MainActor
public struct PillarStrip: View {
    private let title: String
    private let percent: Int
    private let tint: Color
    private let caption: String?
    private let identifier: String?

    public init(
        title: String,
        percent: Int,
        tint: Color = Theme.Color.primary600,
        caption: String? = nil,
        identifier: String? = nil
    ) {
        self.title = title
        self.percent = max(0, min(100, percent))
        self.tint = tint
        self.caption = caption
        self.identifier = identifier
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(spacing: Spacing.s2) {
                Text(title)
                    .pantopusTextStyle(.small)
                    .foregroundStyle(Theme.Color.appText)
                Spacer(minLength: Spacing.s2)
                Text("\(percent)%")
                    .pantopusTextStyle(.small)
                    .foregroundStyle(tint)
            }
            GeometryReader { proxy in
                ZStack(alignment: .leading) {
                    Capsule(style: .continuous)
                        .fill(Theme.Color.appSurfaceSunken)
                    Capsule(style: .continuous)
                        .fill(tint)
                        .frame(width: max(0, proxy.size.width * CGFloat(percent) / 100))
                }
            }
            .frame(height: 8)
            if let caption {
                Text(caption)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityText)
        .modifier(PillarStripIdentifier(identifier: identifier))
    }

    private var accessibilityText: String {
        if let caption {
            "\(title), \(percent) percent. \(caption)"
        } else {
            "\(title), \(percent) percent"
        }
    }
}

/// Conditional `accessibilityIdentifier` for the combined strength element.
private struct PillarStripIdentifier: ViewModifier {
    let identifier: String?

    func body(content: Content) -> some View {
        if let identifier {
            content.accessibilityIdentifier(identifier)
        } else {
            content
        }
    }
}

#Preview("Pillar strength") {
    VStack(alignment: .leading, spacing: Spacing.s5) {
        PillarStrip(
            title: "Profile strength",
            percent: 82,
            tint: Theme.Color.business,
            caption: "Add service areas to reach 100%"
        )
        PillarStrip(title: "Personal", percent: 45, tint: Theme.Color.personal)
        PillarStrip(title: "Home", percent: 100, tint: Theme.Color.home, caption: "Complete")
    }
    .padding()
    .background(Theme.Color.appBg)
}
