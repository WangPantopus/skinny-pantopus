//
//  BusinessPageBlockPreview.swift
//  Pantopus
//
//  C4 — read-only rendering of page blocks. Mirrors RN
//  `src/components/business/blocks/BlockRenderer.tsx`; used by both the
//  builder's preview mode and the public named-page section reached from
//  `pantopus://b/:username/:slug`.
//

import SwiftUI

/// Renders a visible, sorted block list.
@MainActor
public struct BusinessPageBlocksPreview: View {
    private let blocks: [BusinessPageBlock]

    public init(blocks: [BusinessPageBlock]) {
        self.blocks = blocks
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            ForEach(visibleBlocks) { block in
                BusinessPageBlockPreview(block: block)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityIdentifier("businessPageBlocks.preview")
    }

    private var visibleBlocks: [BusinessPageBlock] {
        blocks.filter(\.isVisible).sorted { $0.sortOrder < $1.sortOrder }
    }
}

/// One block rendered the way a visitor sees it.
@MainActor
public struct BusinessPageBlockPreview: View {
    private let block: BusinessPageBlock

    public init(block: BusinessPageBlock) {
        self.block = block
    }

    public var body: some View {
        switch block.kind {
        case .hero: hero
        case .text: text
        case .gallery: gallery
        case .catalogGrid: headingWithNote("Catalog items appear here on the live page.")
        case .hours: headingWithNote("Hours are pulled from your business locations.")
        case .locationsMap: headingWithNote("Locations are pulled from your business settings.")
        case .cta: cta
        case .faq: faq
        case .reviews: headingWithNote("Reviews are pulled from your profile.")
        case .stats: stats
        case .team: headingWithNote("Team members will be displayed here.")
        case .contactForm: headingWithNote("Visitors can send you a message here.")
        case .embed: embed
        case .postsFeed: headingWithNote("Posts will appear here when available.")
        case .divider: divider
        case let .unknown(raw): unknown(raw)
        }
    }

    // MARK: - Cases

    private var hero: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text(block.headline.isEmpty ? "Welcome" : block.headline)
                .pantopusTextStyle(.h2)
                .foregroundStyle(Theme.Color.appTextInverse)
            if !block.subhead.isEmpty {
                Text(block.subhead)
                    .pantopusTextStyle(.small)
                    .foregroundStyle(Theme.Color.appTextInverse.opacity(0.85))
            }
            buttonRow(block.buttonList(key: "cta"), onDark: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Spacing.s5)
        .background(Theme.Color.business)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
    }

    private var text: some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            if !block.heading.isEmpty {
                Text(block.heading)
                    .pantopusTextStyle(.h3)
                    .foregroundStyle(Theme.Color.appTextStrong)
            }
            if !block.body.isEmpty {
                Text(block.body)
                    .pantopusTextStyle(.small)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var gallery: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            headingText
            LazyVGrid(columns: Array(repeating: GridItem(spacing: Spacing.s2), count: 3), spacing: Spacing.s2) {
                ForEach(0..<min(block.imageCount, 6), id: \.self) { _ in
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .fill(Theme.Color.appSurfaceSunken)
                        .aspectRatio(1, contentMode: .fit)
                        .overlay {
                            Icon(.image, size: 20, color: Theme.Color.appTextMuted)
                        }
                }
            }
        }
    }

    private var cta: some View {
        VStack(spacing: Spacing.s2) {
            Text(block.heading.isEmpty ? "Get in touch" : block.heading)
                .pantopusTextStyle(.h3)
                .foregroundStyle(Theme.Color.appTextStrong)
            if !block.subhead.isEmpty {
                Text(block.subhead)
                    .pantopusTextStyle(.small)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .multilineTextAlignment(.center)
            }
            buttonRow(block.buttonList(key: "buttons"), onDark: false)
        }
        .frame(maxWidth: .infinity)
        .padding(Spacing.s5)
        .background(Theme.Color.businessBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
    }

    private var faq: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            headingText
            ForEach(Array(block.faqItems.enumerated()), id: \.offset) { _, item in
                VStack(alignment: .leading, spacing: Spacing.s1) {
                    Text(item.question.isEmpty ? "Question" : item.question)
                        .pantopusTextStyle(.body)
                        .foregroundStyle(Theme.Color.appTextStrong)
                    if !item.answer.isEmpty {
                        Text(item.answer)
                            .pantopusTextStyle(.small)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(Spacing.s3)
                .background(Theme.Color.appSurface)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .strokeBorder(Theme.Color.appBorder, lineWidth: 1)
                }
            }
        }
    }

    private var stats: some View {
        LazyVGrid(columns: Array(repeating: GridItem(spacing: Spacing.s2), count: 2), spacing: Spacing.s2) {
            ForEach(Array(block.stats.enumerated()), id: \.offset) { _, stat in
                VStack(spacing: Spacing.s1) {
                    Text(stat.value)
                        .pantopusTextStyle(.h2)
                        .foregroundStyle(Theme.Color.appTextStrong)
                    Text(stat.label)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                .frame(maxWidth: .infinity)
                .padding(Spacing.s3)
                .background(Theme.Color.appSurfaceSunken)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            }
        }
    }

    private var embed: some View {
        VStack(spacing: Spacing.s1) {
            Icon(.globe, size: 24, color: Theme.Color.appTextMuted)
            Text(block.url.isEmpty ? "No embed URL" : "Embedded: \(block.url)")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextMuted)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(Spacing.s5)
        .background(Theme.Color.appSurfaceSunken)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
    }

    private var divider: some View {
        Rectangle()
            .fill(Theme.Color.appBorder)
            .frame(height: 1)
            .padding(.vertical, Spacing.s2)
    }

    private func unknown(_ raw: String) -> some View {
        HStack(spacing: Spacing.s2) {
            Icon(.package, size: 16, color: Theme.Color.appTextMuted)
            Text("Unsupported block “\(raw)” — update the app to see it.")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextMuted)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Spacing.s3)
        .background(Theme.Color.appSurfaceSunken)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
    }

    // MARK: - Pieces

    @ViewBuilder private var headingText: some View {
        if !block.heading.isEmpty {
            Text(block.heading)
                .pantopusTextStyle(.h3)
                .foregroundStyle(Theme.Color.appTextStrong)
        }
    }

    private func headingWithNote(_ note: String) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            headingText
            Text(note)
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextMuted)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder private func buttonRow(
        _ buttons: [BusinessPageBlockButton],
        onDark: Bool
    ) -> some View {
        if !buttons.isEmpty {
            HStack(spacing: Spacing.s2) {
                ForEach(Array(buttons.enumerated()), id: \.offset) { index, button in
                    Text(button.label.isEmpty ? "Learn More" : button.label)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(pillForeground(index: index, onDark: onDark))
                        .padding(.horizontal, Spacing.s4)
                        .padding(.vertical, Spacing.s2)
                        .background(pillBackground(index: index, onDark: onDark))
                        .clipShape(RoundedRectangle(cornerRadius: Radii.sm, style: .continuous))
                }
            }
        }
    }

    private func pillBackground(index: Int, onDark: Bool) -> Color {
        if onDark {
            return index == 0 ? Theme.Color.appSurface : Theme.Color.appTextInverse.opacity(0.2)
        }
        return index == 0 ? Theme.Color.business : Theme.Color.appSurface
    }

    private func pillForeground(index: Int, onDark: Bool) -> Color {
        if onDark {
            return index == 0 ? Theme.Color.business : Theme.Color.appTextInverse
        }
        return index == 0 ? Theme.Color.appTextInverse : Theme.Color.appTextStrong
    }
}
