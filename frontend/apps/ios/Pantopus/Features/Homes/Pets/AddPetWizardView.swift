//
//  AddPetWizardView.swift
//  Pantopus
//
//  T5.2.1 — UI for the Add / Edit Pet wizard. Composes `WizardShell`
//  with three step bodies and dispatches the VM's `pendingEvent` to the
//  caller via `onClose`.
//

import SwiftUI

/// Presented as a sheet from `PetsListView`. Calls `onClose` with the
/// newly-created or -updated pet (or nil on dismiss without submit).
public struct AddPetWizardView: View {
    @State private var viewModel: AddPetWizardViewModel
    private let onClose: (PetDTO?) -> Void

    public init(
        homeId: String,
        existing: PetDTO? = nil,
        onClose: @escaping (PetDTO?) -> Void
    ) {
        _viewModel = State(initialValue: AddPetWizardViewModel(
            homeId: homeId,
            existing: existing
        ))
        self.onClose = onClose
    }

    public var body: some View {
        WizardShell(model: viewModel) {
            stepBody
            if let error = viewModel.errorMessage {
                AddPetErrorBanner(message: error)
            }
        }
        .onChange(of: viewModel.pendingEvent) { _, event in
            handle(event)
        }
        .onAppear {
            Analytics.track(
                .screenPetsWizardStepViewed(
                    stepNumber: viewModel.currentStep.stepNumber,
                    stepName: String(describing: viewModel.currentStep)
                )
            )
        }
        .accessibilityIdentifier("addPetWizard")
    }

    @ViewBuilder
    private var stepBody: some View {
        switch viewModel.currentStep {
        case .species:
            SpeciesStep(viewModel: viewModel)
        case .basics:
            BasicsStep(viewModel: viewModel)
        case .details:
            DetailsStep(viewModel: viewModel)
        }
    }

    private func handle(_ event: AddPetEvent?) {
        guard let event else { return }
        switch event {
        case .dismiss:
            onClose(nil)
        case let .submitted(pet):
            onClose(pet)
        }
        viewModel.pendingEvent = nil
    }
}

// MARK: - Step 1: Species

private struct SpeciesStep: View {
    @Bindable var viewModel: AddPetWizardViewModel

    var body: some View {
        HeadlineBlock(AddPetStep.species.title)
        SubcopyBlock(AddPetStep.species.subcopy)
        // Two-column grid feels right at phone widths and lets every
        // canonical species be tappable without scrolling.
        let columns = [
            GridItem(.flexible(), spacing: Spacing.s2),
            GridItem(.flexible(), spacing: Spacing.s2)
        ]
        LazyVGrid(columns: columns, spacing: Spacing.s2) {
            ForEach(PetSpecies.allCases, id: \.self) { species in
                SpeciesTile(
                    species: species,
                    isSelected: viewModel.form.species == species
                ) {
                    viewModel.setSpecies(species)
                }
            }
        }
    }
}

private struct SpeciesTile: View {
    let species: PetSpecies
    let isSelected: Bool
    let onTap: () -> Void

    var body: some View {
        let palette = species.palette
        Button(action: onTap) {
            HStack(spacing: Spacing.s2) {
                ZStack {
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .fill(
                            LinearGradient(
                                colors: [palette.iconBackground.start, palette.iconBackground.end],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                    Icon(palette.icon, size: 22, color: palette.iconForeground)
                }
                .frame(width: 44, height: 44)
                Text(species.label)
                    .pantopusTextStyle(.body)
                    .foregroundStyle(Theme.Color.appText)
                Spacer()
            }
            .padding(Spacing.s3)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(
                        isSelected ? Theme.Color.primary600 : Theme.Color.appBorder,
                        lineWidth: isSelected ? 2 : 1
                    )
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("addPet_species_\(species.rawValue)")
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }
}

// MARK: - Step 2: Basics

private struct BasicsStep: View {
    @Bindable var viewModel: AddPetWizardViewModel

    var body: some View {
        HeadlineBlock(AddPetStep.basics.title)
        SubcopyBlock(AddPetStep.basics.subcopy)
        FormFieldsBlock {
            PantopusTextField(
                "Name",
                text: Binding(
                    get: { viewModel.form.name },
                    set: { viewModel.setName($0) }
                ),
                placeholder: "Mango",
                identifier: "addPet_name"
            )
            PantopusTextField(
                "Breed (optional)",
                text: Binding(
                    get: { viewModel.form.breed },
                    set: { viewModel.setBreed($0) }
                ),
                placeholder: "Golden Retriever",
                identifier: "addPet_breed"
            )
        }
    }
}

// MARK: - Step 3: Details

private struct DetailsStep: View {
    @Bindable var viewModel: AddPetWizardViewModel

    var body: some View {
        HeadlineBlock(AddPetStep.details.title)
        SubcopyBlock(AddPetStep.details.subcopy)
        FormFieldsBlock {
            PantopusTextField(
                "Photo URL (optional)",
                text: Binding(
                    get: { viewModel.form.photoUrl },
                    set: { viewModel.setPhotoUrl($0) }
                ),
                placeholder: "https://…/mango.jpg",
                keyboardType: .URL,
                identifier: "addPet_photoUrl"
            )
            PantopusTextField(
                "Vet name (optional)",
                text: Binding(
                    get: { viewModel.form.vetName },
                    set: { viewModel.setVetName($0) }
                ),
                placeholder: "Bay Area Animal Hospital",
                identifier: "addPet_vetName"
            )
            PantopusTextField(
                "Vet phone (optional)",
                text: Binding(
                    get: { viewModel.form.vetPhone },
                    set: { viewModel.setVetPhone($0) }
                ),
                placeholder: "(415) 555-0142",
                keyboardType: .phonePad,
                contentType: .telephoneNumber,
                identifier: "addPet_vetPhone"
            )
            VStack(alignment: .leading, spacing: Spacing.s1) {
                Text("Notes")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                TextEditor(text: Binding(
                    get: { viewModel.form.notes },
                    set: { viewModel.setNotes($0) }
                ))
                .frame(minHeight: 96)
                .padding(Spacing.s2)
                .background(Theme.Color.appSurface)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .stroke(Theme.Color.appBorder, lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                .accessibilityIdentifier("addPet_notes")
            }
        }
    }
}

// MARK: - Helpers

private struct AddPetErrorBanner: View {
    let message: String

    var body: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.alertCircle, size: 18, color: Theme.Color.error)
            Text(message)
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.error)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(Spacing.s3)
        .background(Theme.Color.errorBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .accessibilityIdentifier("addPetErrorBanner")
    }
}

#Preview {
    AddPetWizardView(homeId: "preview-home") { _ in }
}
