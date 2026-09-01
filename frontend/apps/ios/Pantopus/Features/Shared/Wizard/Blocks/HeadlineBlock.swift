//
//  HeadlineBlock.swift
//  Pantopus
//
//  Wizard content block — H2 headline used at the top of most steps.
//

import SwiftUI

/// Big bold headline rendered above subcopy and form fields.
public struct HeadlineBlock: View {
    private let text: String
    private let subtitle: String?

    public init(_ text: String, subtitle: String? = nil) {
        self.text = text
        self.subtitle = subtitle
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text(text)
                .pantopusTextStyle(.h2)
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)
            if let subtitle {
                Text(subtitle)
                    .pantopusTextStyle(.body)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
