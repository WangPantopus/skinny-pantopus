//
//  FormFieldGroup.swift
//  Pantopus
//
//  UPPERCASE overline + white surface card wrapping a stack of fields.
//

import SwiftUI

/// Visual grouping of form fields with an UPPERCASE overline header.
@MainActor
public struct FormFieldGroup<Content: View>: View {
    private let title: String
    private let content: Content

    public init(_ title: String, @ViewBuilder content: () -> Content) {
        self.title = title
        self.content = content()
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text(title.uppercased())
                .pantopusTextStyle(.overline)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .padding(.horizontal, Spacing.s4)
                .accessibilityAddTraits(.isHeader)
            VStack(alignment: .leading, spacing: Spacing.s3) {
                content
            }
            .padding(Spacing.s4)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .padding(.horizontal, Spacing.s4)
        }
    }
}
