//
//  AddHomeFactQuestions.swift
//  Pantopus
//
//  One-tap answers for what the record lacks, above the fields they fill, when the
//  server sends them (`backend/services/householdFacts.js`).
//

import SwiftUI

/// What the building's own floor-plan sheet says, above the fields: this unit's plan with
/// "Is this your layout?", or the building's plans, labeled as the building's.
struct AddHomeFloorPlanCard: View {
    @Bindable var viewModel: AddHomeWizardViewModel

    var body: some View {
        if !viewModel.propertyLookupPending, let plan = viewModel.propertySuggestions?.floorPlan {
            VStack(alignment: .leading, spacing: Spacing.s2) {
                Text(plan.line)
                    .pantopusTextStyle(.small)
                    .foregroundStyle(Theme.Color.appText)
                    .fixedSize(horizontal: false, vertical: true)
                Text(plan.source)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                if let prompt = plan.prompt {
                    Text(prompt)
                        .pantopusTextStyle(.small)
                        .foregroundStyle(Theme.Color.appText)
                    ChipPicker(
                        options: [
                            ChipPicker.Option(id: "yes", label: "Yes"),
                            ChipPicker.Option(id: "no", label: "No")
                        ],
                        selection: Binding(
                            get: { viewModel.floorPlanAnswer },
                            set: { viewModel.floorPlanAnswer = $0 }
                        ),
                        identifier: "addHome_floorPlan"
                    )
                }
                if viewModel.floorPlanAnswer == "no" {
                    Text("Thanks. We'll check this layout with the building. Change anything that's different below.")
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .padding(Spacing.s3)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Color.appSurfaceSunken)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier("addHome_floorPlanCard")
        }
    }
}

struct AddHomeFactQuestions: View {
    @Bindable var viewModel: AddHomeWizardViewModel
    let bedroomsFocused: FocusState<Bool>.Binding
    let bathroomsFocused: FocusState<Bool>.Binding

    var body: some View {
        if !viewModel.propertyLookupPending, let questions = viewModel.propertySuggestions?.questions, !questions.isEmpty {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                ForEach(questions) { question in
                    let bedrooms = question.key == "bedrooms"
                    HouseholdQuestionRow(
                        question: question,
                        value: bedrooms ? viewModel.form.details.bedrooms : viewModel.form.details.bathrooms,
                        onAnswer: { answer in
                            if bedrooms {
                                viewModel.updateBedrooms(answer)
                            } else {
                                viewModel.updateBathrooms(answer)
                            }
                        },
                        onOther: {
                            if bedrooms {
                                bedroomsFocused.wrappedValue = true
                            } else {
                                bathroomsFocused.wrappedValue = true
                            }
                        }
                    )
                }
                if let page = viewModel.propertySuggestions?.countyPage {
                    HouseholdCountyPageLink(page: page)
                }
            }
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier("addHome_factQuestions")
        }
    }
}

/// Lets a screen put the cursor in a field it doesn't always name.
struct OptionalFocus: ViewModifier {
    let focused: FocusState<Bool>.Binding?

    func body(content: Content) -> some View {
        if let focused {
            content.focused(focused)
        } else {
            content
        }
    }
}
