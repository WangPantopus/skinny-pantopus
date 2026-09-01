//
//  FormFieldsBlock.swift
//  Pantopus
//
//  Wizard content block — wraps a stack of input fields in a white surface
//  card with consistent padding so different steps render identically.
//

import SwiftUI

/// Container for a step's form fields. Pass any number of `PantopusTextField`
/// (or other inputs) and they'll be vertically stacked with the design-
/// spec gap and padding.
public struct FormFieldsBlock<Content: View>: View {
    private let content: Content

    public init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            content
        }
        .padding(Spacing.s4)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
    }
}
