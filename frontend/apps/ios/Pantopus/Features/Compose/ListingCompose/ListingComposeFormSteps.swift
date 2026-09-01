//
//  ListingComposeFormSteps.swift
//  Pantopus
//
//  Form-entry step components for the Snap & Sell listing wizard.
//

import SwiftUI

struct ListingComposeTitleCategoryStep: View {
    @Bindable var viewModel: ListingComposeWizardViewModel

    var body: some View {
        HeadlineBlock("Name it & pick a category")
        SubcopyBlock("Keep the title short and specific — buyers scan in a glance.")
        FormFieldsBlock {
            PantopusTextField(
                "Title",
                text: titleBinding,
                placeholder: "Moving boxes — bundle of 18",
                state: titleFieldState,
                identifier: "listingCompose_title"
            )
            TitleCountLabel(length: viewModel.trimmedTitle.count)
        }
        Text("Category")
            .pantopusTextStyle(.caption)
            .foregroundStyle(Theme.Color.appTextSecondary)
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityAddTraits(.isHeader)
        VStack(spacing: Spacing.s2) {
            ForEach(ListingComposeCategory.allCases, id: \.self) { category in
                CategoryRow(
                    category: category,
                    isSelected: viewModel.form.category == category
                ) {
                    viewModel.setCategory(category)
                }
            }
        }
    }

    private var titleBinding: Binding<String> {
        Binding(
            get: { viewModel.form.title },
            set: { viewModel.setTitle($0) }
        )
    }

    private var titleFieldState: PantopusFieldState {
        let length = viewModel.trimmedTitle.count
        if length == 0 { return .default }
        if length < ListingComposeFormState.titleMinLength {
            return .error("Title must be at least \(ListingComposeFormState.titleMinLength) characters.")
        }
        if length > ListingComposeFormState.titleMaxLength {
            return .error("Title must be at most \(ListingComposeFormState.titleMaxLength) characters.")
        }
        return .valid
    }
}

private struct TitleCountLabel: View {
    let length: Int

    var body: some View {
        Text("\(length)/\(ListingComposeFormState.titleMaxLength)")
            .pantopusTextStyle(.caption)
            .foregroundStyle(Theme.Color.appTextSecondary)
            .frame(maxWidth: .infinity, alignment: .trailing)
    }
}

private struct CategoryRow: View {
    let category: ListingComposeCategory
    let isSelected: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(alignment: .top, spacing: Spacing.s3) {
                ZStack {
                    Circle()
                        .stroke(
                            isSelected ? Theme.Color.primary600 : Theme.Color.appBorder,
                            lineWidth: 2
                        )
                        .frame(width: 22, height: 22)
                    if isSelected {
                        Circle().fill(Theme.Color.primary600).frame(width: 12, height: 12)
                    }
                }
                VStack(alignment: .leading, spacing: Spacing.s1) {
                    Text(category.label)
                        .pantopusTextStyle(.body)
                        .foregroundStyle(Theme.Color.appText)
                    Text(category.subtitle)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                Spacer()
            }
            .padding(Spacing.s3)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(
                        isSelected ? Theme.Color.primary600 : Theme.Color.appBorder,
                        lineWidth: isSelected ? 2 : 1
                    )
            )
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("listingCompose_category_\(category.rawValue)")
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }
}

struct ListingComposeConditionDescriptionStep: View {
    @Bindable var viewModel: ListingComposeWizardViewModel

    var body: some View {
        HeadlineBlock("Condition & details")
        SubcopyBlock("Buyers want to know what they're getting before they message you.")
        if let category = viewModel.form.category, category.requiresCondition {
            Text("Condition")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .accessibilityAddTraits(.isHeader)
            VStack(spacing: Spacing.s2) {
                ForEach(ListingComposeCondition.allCases, id: \.self) { condition in
                    ConditionRow(
                        condition: condition,
                        isSelected: viewModel.form.condition == condition
                    ) {
                        viewModel.setCondition(condition)
                    }
                }
            }
        }
        Text("Description")
            .pantopusTextStyle(.caption)
            .foregroundStyle(Theme.Color.appTextSecondary)
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityAddTraits(.isHeader)
        VStack(alignment: .leading, spacing: Spacing.s1) {
            TextEditor(text: bodyBinding)
                .frame(minHeight: 128)
                .padding(Spacing.s2)
                .background(Theme.Color.appSurface)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .stroke(descriptionBorderColor, lineWidth: 1)
                )
                .accessibilityIdentifier("listingCompose_description")
            DescriptionCountLabel(length: viewModel.trimmedDescription.count)
        }
    }

    private var bodyBinding: Binding<String> {
        Binding(
            get: { viewModel.form.bodyText },
            set: { viewModel.setBody($0) }
        )
    }

    private var descriptionBorderColor: Color {
        let length = viewModel.trimmedDescription.count
        if length == 0 { return Theme.Color.appBorder }
        if length < ListingComposeFormState.descriptionMinLength { return Theme.Color.error }
        if length > ListingComposeFormState.descriptionMaxLength { return Theme.Color.error }
        return Theme.Color.appBorder
    }
}

private struct ConditionRow: View {
    let condition: ListingComposeCondition
    let isSelected: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(alignment: .top, spacing: Spacing.s3) {
                ZStack {
                    Circle()
                        .stroke(
                            isSelected ? Theme.Color.primary600 : Theme.Color.appBorder,
                            lineWidth: 2
                        )
                        .frame(width: 22, height: 22)
                    if isSelected {
                        Circle().fill(Theme.Color.primary600).frame(width: 12, height: 12)
                    }
                }
                VStack(alignment: .leading, spacing: Spacing.s1) {
                    Text(condition.label)
                        .pantopusTextStyle(.body)
                        .foregroundStyle(Theme.Color.appText)
                    Text(condition.subtitle)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                Spacer()
            }
            .padding(Spacing.s3)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(
                        isSelected ? Theme.Color.primary600 : Theme.Color.appBorder,
                        lineWidth: isSelected ? 2 : 1
                    )
            )
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("listingCompose_condition_\(condition.rawValue)")
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }
}

private struct DescriptionCountLabel: View {
    let length: Int

    var body: some View {
        let bounds = "\(length)/\(ListingComposeFormState.descriptionMaxLength)"
        let needsMore = length > 0 && length < ListingComposeFormState.descriptionMinLength
        HStack {
            if needsMore {
                Text("At least \(ListingComposeFormState.descriptionMinLength) characters")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.error)
            }
            Spacer()
            Text(bounds)
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
    }
}

struct ListingComposePriceStep: View {
    @Bindable var viewModel: ListingComposeWizardViewModel

    var body: some View {
        HeadlineBlock("Pricing & fulfillment")
        SubcopyBlock("Choose how to price it and how the buyer will receive it.")
        Text("Pricing")
            .pantopusTextStyle(.caption)
            .foregroundStyle(Theme.Color.appTextSecondary)
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityAddTraits(.isHeader)
        VStack(spacing: Spacing.s2) {
            ForEach(ListingComposePriceKind.allCases, id: \.self) { kind in
                PriceKindRow(
                    kind: kind,
                    isSelected: viewModel.form.priceKind == kind
                ) {
                    viewModel.setPriceKind(kind)
                }
            }
        }
        if viewModel.form.priceKind == .fixed || viewModel.form.priceKind == .negotiable {
            FormFieldsBlock {
                PantopusTextField(
                    "Amount (USD)",
                    text: amountBinding,
                    placeholder: "0.00",
                    state: amountFieldState,
                    keyboardType: .decimalPad,
                    identifier: "listingCompose_priceAmount"
                )
            }
        }
        Text("Fulfillment")
            .pantopusTextStyle(.caption)
            .foregroundStyle(Theme.Color.appTextSecondary)
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityAddTraits(.isHeader)
        VStack(spacing: Spacing.s2) {
            ForEach(ListingComposeFulfillment.allCases, id: \.self) { kind in
                FulfillmentRow(
                    kind: kind,
                    isSelected: viewModel.form.fulfillment == kind
                ) {
                    viewModel.setFulfillment(kind)
                }
            }
        }
    }

    private var amountBinding: Binding<String> {
        Binding(
            get: { viewModel.form.priceAmount },
            set: { viewModel.setPriceAmount($0) }
        )
    }

    private var amountFieldState: PantopusFieldState {
        if viewModel.form.priceAmount.isEmpty { return .default }
        guard let value = viewModel.parsedPrice, value > 0 else {
            return .error("Enter an amount greater than zero.")
        }
        return .valid
    }
}

private struct PriceKindRow: View {
    let kind: ListingComposePriceKind
    let isSelected: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(alignment: .top, spacing: Spacing.s3) {
                ZStack {
                    Circle()
                        .stroke(
                            isSelected ? Theme.Color.primary600 : Theme.Color.appBorder,
                            lineWidth: 2
                        )
                        .frame(width: 22, height: 22)
                    if isSelected {
                        Circle().fill(Theme.Color.primary600).frame(width: 12, height: 12)
                    }
                }
                VStack(alignment: .leading, spacing: Spacing.s1) {
                    Text(kind.label)
                        .pantopusTextStyle(.body)
                        .foregroundStyle(Theme.Color.appText)
                    Text(kind.subtitle)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                Spacer()
            }
            .padding(Spacing.s3)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(
                        isSelected ? Theme.Color.primary600 : Theme.Color.appBorder,
                        lineWidth: isSelected ? 2 : 1
                    )
            )
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("listingCompose_priceKind_\(kind.rawValue)")
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }
}

private struct FulfillmentRow: View {
    let kind: ListingComposeFulfillment
    let isSelected: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(alignment: .top, spacing: Spacing.s3) {
                ZStack {
                    Circle()
                        .stroke(
                            isSelected ? Theme.Color.primary600 : Theme.Color.appBorder,
                            lineWidth: 2
                        )
                        .frame(width: 22, height: 22)
                    if isSelected {
                        Circle().fill(Theme.Color.primary600).frame(width: 12, height: 12)
                    }
                }
                VStack(alignment: .leading, spacing: Spacing.s1) {
                    Text(kind.label)
                        .pantopusTextStyle(.body)
                        .foregroundStyle(Theme.Color.appText)
                    Text(kind.subtitle)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                Spacer()
            }
            .padding(Spacing.s3)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(
                        isSelected ? Theme.Color.primary600 : Theme.Color.appBorder,
                        lineWidth: isSelected ? 2 : 1
                    )
            )
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("listingCompose_fulfillment_\(kind.rawValue)")
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }
}

struct ListingComposeLocationStep: View {
    @Bindable var viewModel: ListingComposeWizardViewModel

    var body: some View {
        HeadlineBlock("Where will the handoff happen?")
        SubcopyBlock(
            "Your exact address is only shared with the buyer after both sides commit."
        )
        VStack(spacing: Spacing.s2) {
            ForEach(ListingComposeLocationKind.allCases, id: \.self) { kind in
                LocationKindRow(
                    kind: kind,
                    isSelected: viewModel.form.locationKind == kind
                ) {
                    viewModel.setLocationKind(kind)
                }
            }
        }
        if viewModel.form.locationKind == .meetPoint {
            FormFieldsBlock {
                PantopusTextField(
                    "Meet point name",
                    text: locationLabelBinding,
                    placeholder: "Lincoln Park bandshell",
                    identifier: "listingCompose_locationLabel"
                )
            }
        }
    }

    private var locationLabelBinding: Binding<String> {
        Binding(
            get: { viewModel.form.locationLabel },
            set: { viewModel.setLocationLabel($0) }
        )
    }
}

private struct LocationKindRow: View {
    let kind: ListingComposeLocationKind
    let isSelected: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(alignment: .top, spacing: Spacing.s3) {
                ZStack {
                    Circle()
                        .stroke(
                            isSelected ? Theme.Color.primary600 : Theme.Color.appBorder,
                            lineWidth: 2
                        )
                        .frame(width: 22, height: 22)
                    if isSelected {
                        Circle().fill(Theme.Color.primary600).frame(width: 12, height: 12)
                    }
                }
                VStack(alignment: .leading, spacing: Spacing.s1) {
                    Text(kind.label)
                        .pantopusTextStyle(.body)
                        .foregroundStyle(Theme.Color.appText)
                    Text(kind.subtitle)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                Spacer()
            }
            .padding(Spacing.s3)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(
                        isSelected ? Theme.Color.primary600 : Theme.Color.appBorder,
                        lineWidth: isSelected ? 2 : 1
                    )
            )
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("listingCompose_locationKind_\(kind.rawValue)")
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }
}
