//
//  SideBySide.swift
//  Pantopus
//
//  A17.13 — the two body renderers behind the ViewToggle:
//   · SideBySideView — paragraph-aligned original ↔ English columns in a
//     paper serif, with the glossary term highlighted inline.
//   · TranslationReadingView — a clean single-language reading view on warm
//     paper (the confirmed-state default + the "Original" toggle option).
//  Both share one serif paragraph renderer so the highlight stays identical.
//

import SwiftUI

private let hairlineThickness: CGFloat = 1

// MARK: - Shared serif paragraph renderer

enum TranslationLetterText {
    /// Font-determining inputs grouped so `make` stays within the parameter
    /// budget: the point size plus the two paragraph-role flags.
    struct Style {
        let size: CGFloat
        let isHeading: Bool
        let isSignoff: Bool

        /// Build the style for a paragraph, using `lead` for heading /
        /// sign-off lines and `body` for everything else.
        init(paragraph: TranslationParagraph, body: CGFloat, lead: CGFloat) {
            size = paragraph.isHeading || paragraph.isSignoff ? lead : body
            isHeading = paragraph.isHeading
            isSignoff = paragraph.isSignoff
        }
    }

    /// Build a serif `Text` for one paragraph, optionally highlighting the
    /// first occurrence of `highlight` in the translation accent.
    static func make(
        _ string: String,
        highlight: String?,
        style: Style,
        baseColor: Color
    ) -> Text {
        var attributed = AttributedString(string)
        attributed.font = baseFont(style: style)
        attributed.foregroundColor = baseColor
        if let highlight, !highlight.isEmpty, let range = attributed.range(of: highlight) {
            attributed[range].backgroundColor = Theme.Color.categoryTranslationBg
            attributed[range].foregroundColor = Theme.Color.categoryTranslationInk
            attributed[range].font = .system(size: style.size, weight: .semibold, design: .serif).italic()
        }
        return Text(attributed)
    }

    private static func baseFont(style: Style) -> Font {
        if style.isHeading { return .system(size: style.size, weight: .bold, design: .serif) }
        if style.isSignoff { return .system(size: style.size, weight: .regular, design: .serif).italic() }
        return .system(size: style.size, weight: .regular, design: .serif)
    }
}

// MARK: - Side-by-side comparison

struct SideBySideView: View {
    let content: MailTranslationContent
    /// Stub-TTS handler — taps on a column's play button read that side.
    let onListen: (TranslationListenColumn) -> Void

    private let cellBodySize: CGFloat = 12.5
    private let cellLeadSize: CGFloat = 13

    var body: some View {
        VStack(spacing: Spacing.s0) {
            headerRow
            hairline
            ForEach(Array(content.paragraphs.enumerated()), id: \.element.id) { index, paragraph in
                paragraphRow(paragraph)
                if index < content.paragraphs.count - 1 {
                    hairline
                }
            }
        }
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: hairlineThickness)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .accessibilityIdentifier("translation_sideBySide")
    }

    private var headerRow: some View {
        HStack(spacing: Spacing.s0) {
            columnHeader(
                label: "Original · \(content.languages.sourceCode)",
                accent: false,
                column: .original
            )
            verticalRule
            columnHeader(label: content.languages.targetName, accent: true, column: .translated)
        }
    }

    private func columnHeader(label: String, accent: Bool, column: TranslationListenColumn) -> some View {
        HStack(spacing: Spacing.s1) {
            Circle()
                .fill(accent ? Theme.Color.categoryTranslation : Theme.Color.appTextMuted)
                .frame(width: dotSize, height: dotSize)
            Text(label.uppercased())
                .font(.system(size: 10, weight: .bold))
                .tracking(0.6)
                .foregroundStyle(accent ? Theme.Color.categoryTranslation : Theme.Color.appTextSecondary)
                .lineLimit(1)
            Spacer(minLength: Spacing.s0)
            ListenButton(accent: accent) { onListen(column) }
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2)
    }

    private func paragraphRow(_ paragraph: TranslationParagraph) -> some View {
        HStack(alignment: .top, spacing: Spacing.s0) {
            cell(
                TranslationLetterText.make(
                    paragraph.original,
                    highlight: nil,
                    style: .init(paragraph: paragraph, body: cellBodySize, lead: cellLeadSize),
                    baseColor: Theme.Color.appTextSecondary
                )
            )
            verticalRule
            cell(
                TranslationLetterText.make(
                    paragraph.english,
                    highlight: content.highlightTerm,
                    style: .init(paragraph: paragraph, body: cellBodySize, lead: cellLeadSize),
                    baseColor: Theme.Color.appText
                )
            )
        }
    }

    private func cell(_ text: Text) -> some View {
        text
            .lineSpacing(2)
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .topLeading)
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, Spacing.s3)
    }

    private var hairline: some View {
        Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: hairlineThickness)
    }

    private var verticalRule: some View {
        Rectangle().fill(Theme.Color.appBorderSubtle).frame(width: hairlineThickness)
    }

    private let dotSize: CGFloat = 6
}

// MARK: - Clean reading view (paper)

struct TranslationReadingView: View {
    let content: MailTranslationContent
    /// `.translated` shows English; `.original` shows the source language.
    let showing: TranslationViewMode
    let onSelect: (TranslationViewMode) -> Void
    /// Stub-TTS handler — reads whichever language is showing.
    let onListen: (TranslationListenColumn) -> Void

    private let bodySize: CGFloat = 14.5
    private let leadSize: CGFloat = 15
    private let dotSize: CGFloat = 6

    private var showingOriginal: Bool {
        showing == .original
    }

    var body: some View {
        VStack(spacing: Spacing.s0) {
            header
            hairline
            paper
        }
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: hairlineThickness)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .accessibilityIdentifier("translation_readingView")
    }

    private var header: some View {
        HStack(spacing: Spacing.s2) {
            HStack(spacing: Spacing.s1) {
                Circle()
                    .fill(showingOriginal ? Theme.Color.appTextMuted : Theme.Color.categoryTranslation)
                    .frame(width: dotSize, height: dotSize)
                Text(headerTitle.uppercased())
                    .font(.system(size: 10, weight: .bold))
                    .tracking(0.6)
                    .foregroundStyle(showingOriginal ? Theme.Color.appTextSecondary : Theme.Color.categoryTranslation)
                    .lineLimit(1)
            }
            Spacer(minLength: Spacing.s0)
            ListenButton(accent: !showingOriginal) {
                onListen(showingOriginal ? .original : .translated)
            }
            Button {
                onSelect(showingOriginal ? .translated : .original)
            } label: {
                HStack(spacing: Spacing.s1) {
                    Icon(.arrowRightLeft, size: 12, color: Theme.Color.primary600)
                    Text(showingOriginal ? "Show translation" : "Show original")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(Theme.Color.primary600)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("translation_readingView_swap")
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, Spacing.s3)
    }

    private var paper: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            ForEach(Array(content.paragraphs.enumerated()), id: \.element.id) { index, paragraph in
                TranslationLetterText.make(
                    showingOriginal ? paragraph.original : paragraph.english,
                    highlight: showingOriginal ? nil : content.highlightTerm,
                    style: .init(paragraph: paragraph, body: bodySize, lead: leadSize),
                    baseColor: Theme.Color.categoryTranslationPaperInk
                )
                .lineSpacing(4)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.bottom, index < content.paragraphs.count - 1 ? Spacing.s3 : Spacing.s0)
            }
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, Spacing.s4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.categoryTranslationPaper)
    }

    private var headerTitle: String {
        showingOriginal ? "Original · \(content.languages.sourceName)" : "\(content.languages.targetName) translation"
    }

    private var hairline: some View {
        Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: hairlineThickness)
    }
}

// MARK: - Listen (stub TTS) button

/// Small circular "play" button used on the column / reading-view headers to
/// read a column aloud. Real audio is out of scope (B2.3) — the screen wires
/// it to a toast so the control is never a dead tap.
struct ListenButton: View {
    let accent: Bool
    let action: () -> Void

    private let buttonSize: CGFloat = 26

    var body: some View {
        Button(action: action) {
            Icon(.play, size: 11, color: accent ? Theme.Color.categoryTranslation : Theme.Color.appTextSecondary)
                .frame(width: buttonSize, height: buttonSize)
                .background(accent ? Theme.Color.categoryTranslationBg : Theme.Color.appSurfaceSunken)
                .clipShape(Circle())
        }
        .buttonStyle(.plain)
        .frame(minWidth: 44, minHeight: 44)
        .accessibilityLabel(accent ? "Listen to the translation" : "Listen to the original")
        .accessibilityIdentifier("translation_listen_\(accent ? "translated" : "original")")
    }
}

#if DEBUG
#Preview("Side by side") {
    ScrollView {
        SideBySideView(content: MailTranslationSampleData.letter()) { _ in }
            .padding(Spacing.s4)
    }
    .background(Theme.Color.appBg)
}

#Preview("Reading view") {
    VStack(spacing: Spacing.s4) {
        TranslationReadingView(
            content: MailTranslationSampleData.letter(),
            showing: .translated,
            onSelect: { _ in },
            onListen: { _ in }
        )
        TranslationReadingView(
            content: MailTranslationSampleData.letter(),
            showing: .original,
            onSelect: { _ in },
            onListen: { _ in }
        )
    }
    .padding(Spacing.s4)
    .background(Theme.Color.appBg)
}
#endif
