//
//  AddHomeDetailsSection.swift
//  Pantopus
//
//  A12.2 — the Add-Home wizard's property Details block. Ports RN's
//  `src/components/homes/DetailsStep.tsx`: a public-records card fed by
//  `POST /api/homes/property-suggestions` (ATTOM → heuristics → optional
//  LLM), followed by the eight editable fields — nickname, home type,
//  bedrooms, bathrooms, home size, lot size, year built and description.
//
//  It renders inside the wizard's Confirm step, directly under the
//  address confirmation, because that step is already "review what we
//  found for this property before continuing".
//

import SwiftUI

struct AddHomeDetailsSection: View {
    @Bindable var viewModel: AddHomeWizardViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            header
            if viewModel.isLoadingPropertySuggestions {
                PublicRecordsSkeleton()
            } else if viewModel.propertyLookupComplete {
                PublicRecordsCard(
                    hasRecord: viewModel.propertySuggestions?.hasAttomRecord ?? false,
                    message: viewModel.propertyLookupMessage,
                    fields: viewModel.propertySuggestions?.suggestions,
                    sources: viewModel.propertySuggestions?.fieldSources ?? [:]
                )
            }
            editableFields
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityIdentifier("addHomeDetailsSection")
    }

    // MARK: - Header

    private var header: some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            Text(headline)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
            Text(subcopy)
                .font(.system(size: 12.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// RN `DetailsStep.tsx:57-70`.
    private var headline: String {
        if viewModel.propertySuggestions?.hasAttomRecord == true {
            return "Review public property details"
        }
        return viewModel.propertyLookupComplete
            ? "Confirm property details"
            : "Tell us about your home"
    }

    private var subcopy: String {
        if viewModel.propertySuggestions?.hasAttomRecord == true {
            return "We found public records for this address. Check the details, "
                + "then edit anything that looks off."
        }
        return viewModel.propertyLookupComplete
            ? "Confirm the basic home details before continuing."
            : "All optional — you can always add these later."
    }

    // MARK: - Editable fields

    private var editableFields: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            Text("Editable details")
                .pantopusTextStyle(.overline)
                .foregroundStyle(Theme.Color.appTextSecondary)

            AddHomeTextField(
                label: "Nickname",
                placeholder: "e.g., Our Cozy Apartment",
                text: Binding(
                    get: { viewModel.form.details.nickname },
                    set: { viewModel.updateNickname($0) }
                ),
                identifier: "addHome_nickname"
            )

            homeTypeChips

            HStack(alignment: .top, spacing: Spacing.s2) {
                AddHomeTextField(
                    label: "Bedrooms",
                    placeholder: "3",
                    text: Binding(
                        get: { viewModel.form.details.bedrooms },
                        set: { viewModel.updateBedrooms($0) }
                    ),
                    keyboard: .numberPad,
                    identifier: "addHome_bedrooms"
                )
                AddHomeTextField(
                    label: "Bathrooms",
                    placeholder: "2",
                    text: Binding(
                        get: { viewModel.form.details.bathrooms },
                        set: { viewModel.updateBathrooms($0) }
                    ),
                    keyboard: .decimalPad,
                    identifier: "addHome_bathrooms"
                )
            }

            HStack(alignment: .top, spacing: Spacing.s2) {
                AddHomeTextField(
                    label: "Home size (sq ft)",
                    placeholder: "e.g. 1200",
                    text: Binding(
                        get: { viewModel.form.details.sqFt },
                        set: { viewModel.updateSqFt($0) }
                    ),
                    optional: true,
                    keyboard: .numberPad,
                    identifier: "addHome_sqFt"
                )
                AddHomeTextField(
                    label: "Lot size (sq ft)",
                    placeholder: "e.g. 5000",
                    text: Binding(
                        get: { viewModel.form.details.lotSqFt },
                        set: { viewModel.updateLotSqFt($0) }
                    ),
                    optional: true,
                    keyboard: .numberPad,
                    identifier: "addHome_lotSqFt"
                )
            }

            AddHomeTextField(
                label: "Year built",
                placeholder: "e.g. 2017",
                text: Binding(
                    get: { viewModel.form.details.yearBuilt },
                    set: { viewModel.updateYearBuilt($0) }
                ),
                optional: true,
                keyboard: .numberPad,
                identifier: "addHome_yearBuilt"
            )

            AddHomeTextField(
                label: "Description",
                placeholder: "Describe your home…",
                text: Binding(
                    get: { viewModel.form.details.description },
                    set: { viewModel.updateDescription($0) }
                ),
                optional: true,
                isMultiline: true,
                identifier: "addHome_description"
            )
        }
    }

    private var homeTypeChips: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text("Home Type")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextSecondary)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: Spacing.s2) {
                    ForEach(AddHomeHomeType.allCases, id: \.self) { type in
                        homeTypeChip(type)
                    }
                }
                .padding(.horizontal, 1)
            }
        }
        .accessibilityIdentifier("addHome_homeTypePicker")
    }

    private func homeTypeChip(_ type: AddHomeHomeType) -> some View {
        let isSelected = viewModel.form.details.homeType == type
        return Button {
            viewModel.selectHomeType(type)
        } label: {
            Text(type.label)
                .font(.system(size: 13, weight: isSelected ? .semibold : .regular))
                .foregroundStyle(isSelected ? Theme.Color.appTextInverse : Theme.Color.appText)
                .padding(.horizontal, Spacing.s3)
                .padding(.vertical, Spacing.s2)
                .background(isSelected ? Theme.Color.primary600 : Theme.Color.appSurface)
                .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: Radii.pill, style: .continuous)
                        .stroke(
                            isSelected ? Theme.Color.primary600 : Theme.Color.appBorder,
                            lineWidth: 1
                        )
                }
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
        .accessibilityIdentifier("addHome_homeType_\(type.rawValue)")
    }
}

// MARK: - Public records card

/// The "Public records (ATTOM)" card. Renders the structured fields the
/// lookup returned plus their provenance, or the explanatory copy when
/// nothing came back. Mirrors RN's `AttomStructuredFields` block
/// (`DetailsStep.tsx:72-111`).
private struct PublicRecordsCard: View {
    let hasRecord: Bool
    let message: String
    let fields: PropertySuggestionsFields?
    let sources: [String: String]

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text(hasRecord ? "Public records (ATTOM)" : "Public records")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextSecondary)
            Text(hasRecord ? "Data from public records via ATTOM." : message)
                .font(.system(size: 12.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .fixedSize(horizontal: false, vertical: true)
            if hasRecord, !rows.isEmpty {
                VStack(alignment: .leading, spacing: Spacing.s1) {
                    ForEach(rows, id: \.label) { row in
                        HStack(alignment: .firstTextBaseline, spacing: Spacing.s2) {
                            Text(row.label)
                                .pantopusTextStyle(.caption)
                                .foregroundStyle(Theme.Color.appTextSecondary)
                            Spacer(minLength: Spacing.s2)
                            Text(row.value)
                                .font(.system(size: 12, weight: .medium))
                                .foregroundStyle(Theme.Color.appText)
                            if let source = row.source {
                                Text(source.uppercased())
                                    .font(.system(size: 9, weight: .bold, design: .monospaced))
                                    .foregroundStyle(Theme.Color.appTextMuted)
                            }
                        }
                    }
                }
                .padding(.top, Spacing.s1)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Spacing.s3)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        }
        .accessibilityIdentifier("addHome_publicRecordsCard")
    }

    private struct Row {
        let label: String
        let value: String
        let source: String?
    }

    private var rows: [Row] {
        guard let fields else { return [] }
        var out: [Row] = []
        if let homeType = fields.homeType {
            out.append(Row(
                label: "Property type",
                value: AddHomeHomeType.from(canonical: homeType)?.label ?? homeType,
                source: sources["home_type"]
            ))
        }
        if let bedrooms = fields.bedrooms {
            out.append(Row(label: "Bedrooms", value: "\(bedrooms)", source: sources["bedrooms"]))
        }
        if let bathrooms = fields.bathrooms {
            let text = bathrooms == bathrooms.rounded()
                ? String(Int(bathrooms))
                : String(bathrooms)
            out.append(Row(label: "Bathrooms", value: text, source: sources["bathrooms"]))
        }
        if let sqFt = fields.sqFt {
            out.append(Row(label: "Home size", value: "\(sqFt) sq ft", source: sources["sq_ft"]))
        }
        if let lotSqFt = fields.lotSqFt {
            out.append(Row(
                label: "Lot size",
                value: "\(lotSqFt) sq ft",
                source: sources["lot_sq_ft"]
            ))
        }
        if let yearBuilt = fields.yearBuilt {
            out.append(Row(
                label: "Year built",
                value: "\(yearBuilt)",
                source: sources["year_built"]
            ))
        }
        return out
    }
}

/// Shimmer that mirrors the loaded public-records card geometry so the
/// lookup never shows a bare spinner.
private struct PublicRecordsSkeleton: View {
    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            ForEach(0..<4, id: \.self) { index in
                RoundedRectangle(cornerRadius: Radii.xs, style: .continuous)
                    .fill(Theme.Color.appSurfaceSunken)
                    .frame(height: 12)
                    .frame(maxWidth: index == 0 ? 140 : .infinity)
            }
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        }
        .accessibilityIdentifier("addHome_publicRecordsSkeleton")
        .accessibilityLabel("Looking up public property records")
    }
}

// MARK: - Shared editable field

/// Compact labelled text field used by the Details and Setup blocks.
struct AddHomeTextField: View {
    let label: String
    let placeholder: String
    @Binding var text: String
    var optional = false
    var keyboard: UIKeyboardType = .default
    var isMultiline = false
    var isSecure = false
    var errorText: String?
    var trailing: AnyView?
    let identifier: String

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            HStack(spacing: Spacing.s1) {
                Text(label)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                if optional {
                    Text("Optional")
                        .font(.system(size: 9, weight: .semibold))
                        .foregroundStyle(Theme.Color.appTextMuted)
                }
            }
            HStack(spacing: Spacing.s2) {
                field
                if let trailing { trailing }
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, isMultiline ? Spacing.s2 : Spacing.s3)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(
                        errorText == nil ? Theme.Color.appBorder : Theme.Color.error,
                        lineWidth: 1
                    )
            }
            if let errorText {
                Text(errorText)
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.error)
                    .accessibilityIdentifier("\(identifier)_error")
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder
    private var field: some View {
        if isMultiline {
            TextField(placeholder, text: $text, axis: .vertical)
                .lineLimit(3...6)
                .font(Theme.Font.role(.small))
                .foregroundStyle(Theme.Color.appText)
                .accessibilityIdentifier(identifier)
        } else if isSecure {
            SecureField(placeholder, text: $text)
                .font(Theme.Font.role(.small))
                .foregroundStyle(Theme.Color.appText)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .accessibilityIdentifier(identifier)
        } else {
            TextField(placeholder, text: $text)
                .font(Theme.Font.role(.small))
                .foregroundStyle(Theme.Color.appText)
                .keyboardType(keyboard)
                .autocorrectionDisabled(keyboard != .default)
                .accessibilityIdentifier(identifier)
        }
    }
}
