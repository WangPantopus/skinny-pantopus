//
//  LegalSection.swift
//  Pantopus
//
//  A19 legal scaffold — a numbered H2 section heading with a stable scroll
//  anchor. The mono section number sits in `primary600`; the title in
//  `primary700`. `anchorID` ("sec-<number>") is applied via `.id` so an
//  enclosing `ScrollViewReader` can scroll the section into view when the
//  reader taps a `LegalTOCCard` row.
//

import SwiftUI

/// A primary-tinted, numbered section heading for the long-form legal docs.
/// `number` is the 1-based section index (matching the `LegalTOCCard` chip);
/// `anchorID` is the matching scroll anchor.
public struct LegalSection: View {
    private let number: Int
    private let title: String

    public init(number: Int, title: String) {
        self.number = number
        self.title = title
    }

    /// Stable scroll anchor — the native mirror of the design's `id="sec-{n}"`.
    /// A parent `ScrollViewReader` jumps here with `proxy.scrollTo(anchorID)`.
    public var anchorID: String {
        "sec-\(number)"
    }

    public var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: Spacing.s2) {
            Text(String(format: "%02d", number))
                .font(.system(size: 11, weight: .bold, design: .monospaced))
                .foregroundColor(Theme.Color.primary600)
            Text(title)
                .font(.system(size: 18, weight: .bold))
                .foregroundColor(Theme.Color.primary700)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.top, 28)
        .padding(.bottom, 10)
        .id(anchorID)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isHeader)
        .accessibilityIdentifier("legalSection_\(number)")
    }
}

#Preview("Sections") {
    VStack(alignment: .leading, spacing: Spacing.s0) {
        LegalSection(number: 1, title: "Overview")
        LegalSection(number: 2, title: "Information we collect")
        LegalSection(number: 10, title: "Changes to this policy")
    }
    .padding(.horizontal, Spacing.s5)
    .background(Theme.Color.appSurface)
}
