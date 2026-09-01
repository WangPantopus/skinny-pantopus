//
//  FormBanner.swift
//  Pantopus
//
//  A13.14 — form-level alert banner pinned to the top of a form body. Used by
//  Change Password to summarise a rejected submit ("Couldn't update
//  password"). Lives in the Password feature for now; promote to
//  `Core/Design/Components` if a second form needs it.
//

import SwiftUI

/// Tone of a `FormBanner`. `error` paints the red error palette; `info`
/// paints the sky/primary palette.
public enum FormBannerTone: Sendable {
    case error
    case info
}

/// Title + supporting line inside a tinted, bordered card with a leading
/// status icon.
@MainActor
public struct FormBanner: View {
    private let tone: FormBannerTone
    private let title: String
    private let message: String?

    public init(tone: FormBannerTone = .error, title: String, message: String? = nil) {
        self.tone = tone
        self.title = title
        self.message = message
    }

    public var body: some View {
        HStack(alignment: .top, spacing: Spacing.s2) {
            Icon(icon, size: 16, color: foreground)
                .padding(.top, 1)
            VStack(alignment: .leading, spacing: Spacing.s1) {
                Text(title)
                    .font(.system(size: 12.5, weight: .bold))
                    .foregroundStyle(foreground)
                if let message {
                    Text(message)
                        .font(.system(size: 11.5))
                        .foregroundStyle(foreground.opacity(0.85))
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s3)
        .background(background)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(border, lineWidth: 1)
        )
        .accessibilityElement(children: .combine)
        .accessibilityLabel(message.map { "\(title). \($0)" } ?? title)
        .accessibilityIdentifier("passwordChangeFormBanner")
    }

    private var icon: PantopusIcon {
        tone == .error ? .alertCircle : .info
    }

    private var foreground: Color {
        tone == .error ? Theme.Color.error : Theme.Color.primary700
    }

    private var background: Color {
        tone == .error ? Theme.Color.errorBg : Theme.Color.primary50
    }

    private var border: Color {
        tone == .error ? Theme.Color.errorLight : Theme.Color.primary200
    }
}

#Preview {
    VStack(spacing: Spacing.s3) {
        FormBanner(
            tone: .error,
            title: "Couldn't update password",
            message: "Fix the two highlighted fields and try again. Three more attempts before a 15-minute cooldown."
        )
        FormBanner(
            tone: .info,
            title: "Heads up",
            message: "You'll be signed out of other devices after updating."
        )
    }
    .padding(Spacing.s4)
    .background(Theme.Color.appBg)
}
