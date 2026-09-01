//
//  ArticleBody.swift
//  Pantopus
//
//  `article` body slot for the Content Detail shell — the long-form reading
//  layout (eyebrow → title → byline → blocks → tags). Replaces the former
//  `LongFormBodyStub` NotYetAvailable placeholder. Mirrors the A10.4 Post
//  reading column (15pt body, comfortable line spacing) extended with
//  headings and pull quotes for long-form content.
//

import SwiftUI

/// One block in an article body. `paragraph` is the default reading run;
/// `heading` introduces a section; `quote` renders a left-barred pull quote.
public enum ArticleBlock: Sendable, Hashable {
    case heading(String)
    case paragraph(String)
    case quote(String)
}

/// Content payload for `ArticleBody`. All chrome above the blocks is
/// optional so the body works for a bare article as well as a titled one.
public struct ArticleBodyContent: Sendable, Hashable {
    public let eyebrow: String?
    public let title: String?
    public let meta: String?
    public let blocks: [ArticleBlock]
    public let tags: [String]

    public init(
        eyebrow: String? = nil,
        title: String? = nil,
        meta: String? = nil,
        blocks: [ArticleBlock],
        tags: [String] = []
    ) {
        self.eyebrow = eyebrow
        self.title = title
        self.meta = meta
        self.blocks = blocks
        self.tags = tags
    }
}

/// Long-form article reader. Renders an optional eyebrow / title / byline,
/// then the ordered blocks, then an optional tag row.
@MainActor
public struct ArticleBody: View {
    private let content: ArticleBodyContent

    public init(content: ArticleBodyContent) {
        self.content = content
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            if let eyebrow = content.eyebrow {
                Text(eyebrow.uppercased())
                    .pantopusTextStyle(.overline)
                    .foregroundStyle(Theme.Color.primary600)
            }
            if let title = content.title {
                Text(title)
                    .font(.system(size: PantopusTextStyle.h2.size, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityAddTraits(.isHeader)
            }
            if let meta = content.meta {
                Text(meta)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            ForEach(Array(content.blocks.enumerated()), id: \.offset) { _, block in
                blockView(block)
            }
            if !content.tags.isEmpty {
                tagRow
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, Spacing.s4)
        .accessibilityIdentifier("contentDetail.articleBody")
        .accessibilityElement(children: .contain)
    }

    @ViewBuilder
    private func blockView(_ block: ArticleBlock) -> some View {
        switch block {
        case let .heading(text):
            Text(text)
                .font(.system(size: PantopusTextStyle.h3.size, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, Spacing.s1)
        case let .paragraph(text):
            Text(text)
                .font(.system(size: 15))
                .foregroundStyle(Theme.Color.appTextStrong)
                .lineSpacing(5)
                .fixedSize(horizontal: false, vertical: true)
        case let .quote(text):
            HStack(alignment: .top, spacing: Spacing.s3) {
                Capsule()
                    .fill(Theme.Color.primary600)
                    .frame(width: 3)
                Text(text)
                    .font(.system(size: 15))
                    .italic()
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .lineSpacing(4)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.vertical, Spacing.s1)
        }
    }

    private var tagRow: some View {
        ContentDetailFlowLayout(spacing: 6) {
            ForEach(content.tags, id: \.self) { tag in
                HStack(spacing: Spacing.s1) {
                    Icon(.tag, size: 11, color: Theme.Color.primary700)
                    Text(tag)
                        .font(.system(size: PantopusTextStyle.caption.size, weight: .semibold))
                        .foregroundStyle(Theme.Color.primary700)
                }
                .padding(.horizontal, Spacing.s3)
                .padding(.vertical, Spacing.s1)
                .background(Theme.Color.primary100)
                .clipShape(Capsule())
            }
        }
        .padding(.top, Spacing.s1)
    }
}

#Preview("Article") {
    ScrollView {
        ArticleBody(
            content: ArticleBodyContent(
                eyebrow: "Neighborhood update",
                title: "What the new Elm Park crossing means for your morning",
                meta: "By Nadia Velez · 5 min read · Cambridge, MA",
                blocks: [
                    .paragraph(
                        "The city finished the raised crossing at 5th & Elm last week, and it's "
                            + "already changing how the block moves at 8am."
                    ),
                    .heading("Why it matters"),
                    .paragraph(
                        "Drivers now slow to about 12 mph at the table, which gives the school "
                            + "crowd a real gap to cross without the old curb-side scramble."
                    ),
                    .quote("It's the first time I've let my kid walk to the corner alone."),
                    .paragraph("Expect the striping to be finalized before the first frost.")
                ],
                tags: ["Safety", "Walkability", "Elm Park"]
            )
        )
        .padding(.vertical, Spacing.s4)
    }
    .background(Theme.Color.appBg)
}
