//
//  DocMetaStrip.swift
//  Pantopus
//
//  A19 legal scaffold — a thin "Last updated · version" meta strip that sits
//  directly beneath the legal-document top bar. Sunken surface, a leading
//  clock glyph, and the date + version emphasised against muted label text.
//
//  Shared by A19.1 Privacy Policy + A19.2 Terms of Service (one scaffold;
//  only the date / version copy changes per document).
//

import SwiftUI

/// A sunken meta strip reading "Last updated: <date> · Version <version>".
/// Labels render in `appTextSecondary`; the date + version are emphasised in
/// `appTextStrong`; the leading `clock` glyph sits in `appTextMuted` — the
/// exact tone split the design's `MetaStrip` uses.
public struct DocMetaStrip: View {
    private let lastUpdated: String
    private let version: String

    public init(lastUpdated: String, version: String) {
        self.lastUpdated = lastUpdated
        self.version = version
    }

    public var body: some View {
        HStack(spacing: 6) {
            Icon(.clock, size: 11, strokeWidth: 2, color: Theme.Color.appTextMuted)
            metaText
        }
        .padding(.horizontal, Spacing.s5)
        .padding(.vertical, 9)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurfaceSunken)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(Theme.Color.appBorder)
                .frame(height: 1)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Last updated \(lastUpdated), version \(version)")
        .accessibilityIdentifier("docMetaStrip")
    }

    private var metaText: some View {
        (
            Text("Last updated: ").foregroundColor(Theme.Color.appTextSecondary)
                + Text(lastUpdated).foregroundColor(Theme.Color.appTextStrong).fontWeight(.semibold)
                + Text("  ·  ").foregroundColor(Theme.Color.appTextMuted)
                + Text("Version ").foregroundColor(Theme.Color.appTextSecondary)
                + Text(version).foregroundColor(Theme.Color.appTextStrong).fontWeight(.semibold)
        )
        .font(.system(size: 11, weight: .medium))
        .lineLimit(1)
        .minimumScaleFactor(0.8)
    }
}

#Preview("Privacy + Terms") {
    VStack(spacing: Spacing.s4) {
        DocMetaStrip(lastUpdated: "October 1, 2025", version: "3.2")
        DocMetaStrip(lastUpdated: "February 14, 2026", version: "5.0")
    }
    .padding(.vertical, Spacing.s4)
    .background(Theme.Color.appSurface)
}
