//
//  PropertyCorrectionView.swift
//  Pantopus
//
//  A13 — Request property correction wizard. Mirrors Android
//  `PropertyCorrectionScreen`.
//

import SwiftUI

public struct PropertyCorrectionView: View {
    @State private var field = "bedrooms"
    @State private var source = "county"
    @State private var note = ""

    private let onBack: @MainActor () -> Void

    private static let fields = ["bedrooms", "bathrooms", "sqft", "year_built", "address"]
    private static let sources = ["county", "owner", "unsure"]

    public init(
        homeId _: String,
        onBack: @escaping @MainActor () -> Void
    ) {
        self.onBack = onBack
    }

    public var body: some View {
        FormShell(
            title: "Request correction",
            leading: .back,
            rightActionLabel: "Send",
            // No correction endpoint exists yet — the action stays disabled
            // instead of faking a send.
            isValid: PropertyCorrectionViewModel.isSubmissionAvailable,
            isDirty: false,
            onClose: onBack,
            onCommit: {},
            content: { formBody }
        )
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("propertyCorrection")
    }

    private var formBody: some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            Text(PropertyCorrectionViewModel.unavailableNotice)
                .font(.system(size: 13))
                .foregroundStyle(Theme.Color.warning)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityIdentifier("propertyCorrectionUnavailable")
            Text(
                "Tell us what's wrong with the property record. " +
                    "We'll review against county data and owner-confirmed facts."
            )
            .pantopusTextStyle(.small)
            .foregroundStyle(Theme.Color.appTextSecondary)
            .fixedSize(horizontal: false, vertical: true)

            FormFieldGroup("Which field looks wrong?") {
                chipRow(options: Self.fields, selected: field) { field = $0 }
            }

            FormFieldGroup("Which source should we trust?") {
                chipRow(options: Self.sources, selected: source) { source = $0 }
            }

            FormFieldGroup("What should it say?") {
                PantopusTextField(
                    "Details",
                    text: $note,
                    placeholder: "Describe the correct value and any context…",
                    // Lands on the field itself so it matches Android's
                    // `fieldTestTag` rather than the wrapping stack.
                    identifier: "propertyCorrection_note"
                )
            }
        }
        .padding(Spacing.s4)
    }

    private func chipRow(
        options: [String],
        selected: String,
        onSelect: @escaping (String) -> Void
    ) -> some View {
        LazyVGrid(
            columns: [GridItem(.adaptive(minimum: 100), spacing: Spacing.s2)],
            spacing: Spacing.s2
        ) {
            ForEach(options, id: \.self) { option in
                Button {
                    onSelect(option)
                } label: {
                    Text(option.replacingOccurrences(of: "_", with: " "))
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(selected == option ? Theme.Color.primary700 : Theme.Color.appTextSecondary)
                        .padding(.horizontal, Spacing.s3)
                        .padding(.vertical, Spacing.s2)
                        .frame(maxWidth: .infinity)
                        .background(selected == option ? Theme.Color.primary50 : Theme.Color.appSurface)
                        .overlay(
                            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                                .stroke(
                                    selected == option ? Theme.Color.primary200 : Theme.Color.appBorder,
                                    lineWidth: 1
                                )
                        )
                        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                }
                .buttonStyle(.plain)
            }
        }
    }
}
