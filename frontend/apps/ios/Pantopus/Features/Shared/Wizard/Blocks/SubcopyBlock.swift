//
//  SubcopyBlock.swift
//  Pantopus
//
//  Wizard content block — secondary supporting copy under the headline.
//

import SwiftUI

/// Body-weight supporting paragraph that sits beneath a `HeadlineBlock`.
public struct SubcopyBlock: View {
    private let text: String

    public init(_ text: String) {
        self.text = text
    }

    public var body: some View {
        Text(text)
            .pantopusTextStyle(.body)
            .foregroundStyle(Theme.Color.appTextSecondary)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}
