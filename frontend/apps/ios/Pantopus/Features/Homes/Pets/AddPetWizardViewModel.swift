//
//  AddPetWizardViewModel.swift
//  Pantopus
//
//  T5.2.1 — Three-step wizard for adding (or editing) a pet. Conforms to
//  the shared `WizardModel` so `WizardShell` drives the top bar,
//  progress, and sticky CTA without bespoke chrome.
//
//  Steps:
//    1. Species — picker over PetSpecies cases.
//    2. Basics — name (required) + breed (optional).
//    3. Details — photo URL, vet name, vet phone, notes (all optional).
//
//  The vet pair mirrors RN's "Vet name / phone" field
//  (`src/app/homes/[id]/pets.tsx:108`) split across the two columns the
//  backend actually stores (`vet_name` / `vet_phone`,
//  `createPetSchema` at `backend/routes/home.js:6978-6979`).
//
//  On the last step, the primary CTA POSTs `/api/homes/:id/pets` (or
//  PUTs `/api/homes/:id/pets/:petId` in edit mode) and emits the
//  resulting `PetDTO` via `pendingEvent` so the host view can dismiss
//  and feed the list VM.
//

import Foundation
import Observation

/// Discrete steps in the wizard.
public enum AddPetStep: Int, CaseIterable, Sendable, Equatable {
    case species
    case basics
    case details

    public var title: String {
        switch self {
        case .species: "Pick a species"
        case .basics: "What's their name?"
        case .details: "Anything else?"
        }
    }

    public var subcopy: String {
        switch self {
        case .species: "Sets the icon and chip colour we'll use across the home."
        case .basics: "Name is required. Breed is optional and shows under the name."
        case .details: "Vet contact and notes show on the row so sitters see the most important info first."
        }
    }

    /// 1-of-3 readout in the top-bar.
    public var stepNumber: Int {
        rawValue + 1
    }
}

/// Form snapshot. Lives on the VM and is sent over the wire on submit.
public struct AddPetForm: Sendable, Equatable {
    public var species: PetSpecies
    public var name: String
    public var breed: String
    public var photoUrl: String
    public var vetName: String
    public var vetPhone: String
    public var notes: String

    public init(
        species: PetSpecies = .dog,
        name: String = "",
        breed: String = "",
        photoUrl: String = "",
        vetName: String = "",
        vetPhone: String = "",
        notes: String = ""
    ) {
        self.species = species
        self.name = name
        self.breed = breed
        self.photoUrl = photoUrl
        self.vetName = vetName
        self.vetPhone = vetPhone
        self.notes = notes
    }
}

/// Outbound event the host view reacts to.
public enum AddPetEvent: Sendable, Equatable {
    case submitted(PetDTO)
    case dismiss
}

/// Drives the Add / Edit Pet wizard.
@Observable
@MainActor
final class AddPetWizardViewModel: WizardModel {
    /// Active step.
    private(set) var currentStep: AddPetStep = .species
    /// Editable form snapshot.
    var form: AddPetForm
    /// Inline error banner copy (per-step or submit failures).
    private(set) var errorMessage: String?
    /// Set after a successful submit; the view reads this and dismisses.
    var pendingEvent: AddPetEvent?

    /// `createPetSchema`'s `vet_name: Joi.string().max(200)`
    /// (`backend/routes/home.js:6978`).
    static let vetNameMaxLength = 200
    /// `createPetSchema`'s `vet_phone: Joi.string().max(30)`
    /// (`backend/routes/home.js:6979`).
    static let vetPhoneMaxLength = 30

    private let homeId: String
    /// Non-nil = edit mode; the submit calls PUT instead of POST.
    private let editingId: String?
    private let api: APIClient
    private var isSubmitting = false

    init(homeId: String, existing: PetDTO? = nil, api: APIClient = .shared) {
        self.homeId = homeId
        self.api = api
        if let existing {
            editingId = existing.id
            form = AddPetForm(
                species: PetSpecies.parse(existing.species),
                name: existing.name,
                breed: existing.breed ?? "",
                photoUrl: existing.photoUrl ?? "",
                vetName: existing.vetName ?? "",
                vetPhone: existing.vetPhone ?? "",
                notes: existing.notes ?? ""
            )
        } else {
            editingId = nil
            form = AddPetForm()
        }
    }

    /// True when editing an existing pet (PUT) vs. adding (POST).
    var isEditing: Bool {
        editingId != nil
    }

    /// True when the form snapshot differs from the inception state.
    var isDirty: Bool {
        if isEditing { return true }
        // For Add mode, dirty as soon as the user changes anything off
        // the default species/name/breed.
        return form != AddPetForm()
    }

    // MARK: - Chrome

    var chrome: WizardChrome {
        WizardChrome(
            title: isEditing ? "Edit pet" : "Add a pet",
            progressLabel: .stepOf(current: currentStep.stepNumber, total: AddPetStep.allCases.count),
            progressFraction: Double(currentStep.stepNumber) / Double(AddPetStep.allCases.count),
            leading: currentStep == .species ? .close : .back,
            primaryCTALabel: primaryLabel,
            primaryCTAEnabled: primaryEnabled,
            secondaryCTA: nil,
            isSubmitting: isSubmitting,
            dirty: isDirty,
            showsProgressBar: true
        )
    }

    private var primaryLabel: String {
        switch currentStep {
        case .species, .basics: "Next"
        case .details: isEditing ? "Save changes" : "Add pet"
        }
    }

    private var primaryEnabled: Bool {
        switch currentStep {
        case .species: true
        case .basics: !form.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        case .details: !form.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        }
    }

    // MARK: - WizardModel

    func leadingTapped() {
        errorMessage = nil
        if currentStep == .species {
            pendingEvent = .dismiss
            return
        }
        guard let previous = AddPetStep(rawValue: currentStep.rawValue - 1) else { return }
        currentStep = previous
        Analytics.track(.screenPetsWizardStepViewed(
            stepNumber: currentStep.stepNumber,
            stepName: String(describing: currentStep)
        ))
    }

    func discardConfirmed() {
        pendingEvent = .dismiss
    }

    func primaryTapped() {
        errorMessage = nil
        if currentStep != .details {
            guard let next = AddPetStep(rawValue: currentStep.rawValue + 1) else { return }
            currentStep = next
            Analytics.track(.screenPetsWizardStepViewed(
                stepNumber: currentStep.stepNumber,
                stepName: String(describing: currentStep)
            ))
            return
        }
        Task { await submit() }
    }

    // MARK: - Form mutations

    func setSpecies(_ species: PetSpecies) {
        form.species = species
    }

    func setName(_ value: String) {
        form.name = value
    }

    func setBreed(_ value: String) {
        form.breed = value
    }

    func setPhotoUrl(_ value: String) {
        form.photoUrl = value
    }

    func setVetName(_ value: String) {
        form.vetName = String(value.prefix(Self.vetNameMaxLength))
    }

    func setVetPhone(_ value: String) {
        form.vetPhone = String(value.prefix(Self.vetPhoneMaxLength))
    }

    func setNotes(_ value: String) {
        form.notes = value
    }

    // MARK: - Submit

    private func submit() async {
        guard !isSubmitting else { return }
        isSubmitting = true
        defer { isSubmitting = false }
        let trimmedName = form.name.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedBreed = form.breed.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedPhoto = form.photoUrl.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedVetName = form.vetName.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedVetPhone = form.vetPhone.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedNotes = form.notes.trimmingCharacters(in: .whitespacesAndNewlines)
        do {
            let response: PetResponse
            if let petId = editingId {
                let request = UpdatePetRequest(
                    name: trimmedName,
                    species: form.species.rawValue,
                    breed: trimmedBreed.isEmpty ? nil : trimmedBreed,
                    vetName: trimmedVetName.isEmpty ? nil : trimmedVetName,
                    vetPhone: trimmedVetPhone.isEmpty ? nil : trimmedVetPhone,
                    photoUrl: trimmedPhoto.isEmpty ? nil : trimmedPhoto,
                    notes: trimmedNotes.isEmpty ? nil : trimmedNotes
                )
                response = try await api.request(
                    HomesEndpoints.updatePet(homeId: homeId, petId: petId, request: request)
                )
            } else {
                let request = CreatePetRequest(
                    name: trimmedName,
                    species: form.species.rawValue,
                    breed: trimmedBreed.isEmpty ? nil : trimmedBreed,
                    vetName: trimmedVetName.isEmpty ? nil : trimmedVetName,
                    vetPhone: trimmedVetPhone.isEmpty ? nil : trimmedVetPhone,
                    photoUrl: trimmedPhoto.isEmpty ? nil : trimmedPhoto,
                    notes: trimmedNotes.isEmpty ? nil : trimmedNotes
                )
                response = try await api.request(
                    HomesEndpoints.createPet(homeId: homeId, request: request)
                )
            }
            pendingEvent = .submitted(response.pet)
        } catch {
            errorMessage = (error as? APIError)?.errorDescription
                ?? "Couldn't save the pet. Try again."
        }
    }
}
