//
//  AddHomeFactQuestions.swift
//  Pantopus
//
//  One-tap answers for what the record lacks, above the fields they fill, when the
//  server sends them (`backend/services/householdFacts.js`).
//

import SwiftUI

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
