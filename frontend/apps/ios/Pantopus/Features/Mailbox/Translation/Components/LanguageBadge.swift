//
//  LanguageBadge.swift
//  Pantopus
//
//  A17.13 — the "ES → EN" language badge. Source / target code pills plus a
//  detection line that flips from "Auto-detected · 98% match" to
//  "Confirmed translation" once the user confirms.
//

import SwiftUI

struct LanguageBadge: View {
    let languages: TranslationLanguages
    let confirmed: Bool

    private let pillHeight: CGFloat = 34
    private let pillMinWidth: CGFloat = 38

    var body: some View {
        TranslationCard {
            HStack(spacing: Spacing.s3) {
                HStack(spacing: Spacing.s2) {
                    LangPill(code: languages.sourceCode, style: .muted, height: pillHeight, minWidth: pillMinWidth)
                    Icon(.arrowRight, size: 16, color: Theme.Color.appTextMuted)
                    LangPill(code: languages.targetCode, style: .accent, height: pillHeight, minWidth: pillMinWidth)
                }
                VStack(alignment: .leading, spacing: Spacing.s1) {
                    Text("\(languages.sourceName) → \(languages.targetName)")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                        .fixedSize(horizontal: false, vertical: true)
                    detectionLine
                }
                Spacer(minLength: Spacing.s0)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityText)
        .accessibilityIdentifier("translation_languageBadge")
    }

    private var detectionLine: some View {
        HStack(spacing: Spacing.s1) {
            if confirmed {
                Icon(.badgeCheck, size: 12, color: Theme.Color.success)
                Text("Confirmed translation")
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            } else {
                Icon(.scanLine, size: 12, color: Theme.Color.appTextSecondary)
                Text(detectionText)
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
        }
    }

    /// The translator only reports a confidence on surfaces that measure
    /// one; without it the badge says "Auto-detected" and stops there.
    private var detectionText: String {
        guard let confidence = languages.confidence else { return "Auto-detected" }
        return "Auto-detected · \(confidence)% match"
    }

    private var accessibilityText: String {
        let detail: String = if confirmed {
            "Confirmed translation"
        } else if let confidence = languages.confidence {
            "Auto-detected, \(confidence) percent match"
        } else {
            "Auto-detected"
        }
        return "\(languages.sourceName) to \(languages.targetName). \(detail)"
    }
}

/// A single language-code pill (e.g. "ES" / "EN").
struct LangPill: View {
    enum Style { case muted, accent }

    let code: String
    let style: Style
    let height: CGFloat
    let minWidth: CGFloat

    var body: some View {
        Text(code)
            .font(.system(size: 13, weight: .heavy))
            .tracking(0.5)
            .foregroundStyle(style == .accent ? Theme.Color.appTextInverse : Theme.Color.appTextStrong)
            .frame(minWidth: minWidth)
            .frame(height: height)
            .padding(.horizontal, Spacing.s2)
            .background(style == .accent ? Theme.Color.categoryTranslation : Theme.Color.appSurfaceSunken)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(style == .accent ? Color.clear : Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            .accessibilityHidden(true)
    }
}

#if DEBUG
#Preview("Language badge") {
    VStack(spacing: Spacing.s4) {
        LanguageBadge(
            languages: MailTranslationSampleData.letter().languages,
            confirmed: false
        )
        LanguageBadge(
            languages: MailTranslationSampleData.letter().languages,
            confirmed: true
        )
    }
    .padding(Spacing.s4)
    .background(Theme.Color.appBg)
}
#endif
