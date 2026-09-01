//
//  PetsListViewModel.swift
//  Pantopus
//
//  T5.2.1 — Backs `PetsListView`. Reads `GET /api/homes/:id/pets` and
//  projects each `PetDTO` onto a `RowModel` using shape **E** (64pt
//  rounded-square thumbnail leading + inline species chip + breed
//  subtitle + notes preview + kebab trailing). FAB opens the Add Pet
//  wizard; the wizard POSTs `/api/homes/:id/pets`. Kebab opens an
//  action sheet with Edit (PUT) and Delete (DELETE).
//

import Foundation
import Observation
import SwiftUI

/// Surfaced to the view so it can present sheets / confirms / pickers in
/// response to model events without the model needing to hold view state.
public enum PetsListEvent: Sendable, Equatable {
    case openAdd
    case openEdit(petId: String)
    case confirmDelete(petId: String, name: String)
}

/// `@Observable` data source for the Pets list screen.
@Observable
@MainActor
final class PetsListViewModel: ListOfRowsDataSource {
    let title = "Pets"

    var topBarAction: TopBarAction? {
        // Design ships both a top-bar plus and a FAB. Spec says "if both,
        // pick FAB" — drop the top-bar plus on mobile to avoid two
        // identical-intent affordances on a 360pt phone.
        nil
    }

    let tabs: [ListOfRowsTab] = []
    var selectedTab: String = ""

    var fab: FABAction? {
        // 52pt secondary-create matches the design at pets-frames.jsx:78.
        FABAction(
            icon: .plusCircle,
            accessibilityLabel: "Add a pet",
            variant: .secondaryCreate
        ) { @Sendable [weak self] in
            Task { @MainActor in self?.pendingEvent = .openAdd }
        }
    }

    private(set) var state: ListOfRowsState = .loading

    /// Event the view should react to. Set by row handlers; cleared by
    /// the view after dispatching.
    var pendingEvent: PetsListEvent?

    private let homeId: String
    private let api: APIClient
    /// Cached list — used for optimistic delete rollback.
    private var pets: [PetDTO] = []

    init(homeId: String, api: APIClient = .shared) {
        self.homeId = homeId
        self.api = api
    }

    // MARK: - ListOfRowsDataSource

    func load() async {
        if case .loaded = state { return }
        state = .loading
        await fetch()
    }

    func refresh() async {
        await fetch()
    }

    func loadMoreIfNeeded() async {
        // Backend doesn't paginate /pets.
    }

    // MARK: - Mutations

    /// Insert a pet returned from the Add wizard at the top of the list,
    /// mirroring the backend's `order by created_at desc` semantics.
    func handleCreated(_ pet: PetDTO) {
        pets.insert(pet, at: 0)
        applyState()
    }

    /// Apply an Edit-wizard result in place. No-op when the pet has
    /// disappeared in the meantime (e.g. deleted in another session).
    func handleUpdated(_ pet: PetDTO) {
        guard let idx = pets.firstIndex(where: { $0.id == pet.id }) else { return }
        pets[idx] = pet
        applyState()
    }

    /// Look up a cached pet by id — used by the view to seed the Edit
    /// wizard with the latest row payload.
    func cachedPet(withId id: String) -> PetDTO? {
        pets.first { $0.id == id }
    }

    /// Optimistic delete with rollback on failure. The action-sheet
    /// confirm has already fired by the time this is invoked.
    func deletePet(petId: String) async {
        guard let idx = pets.firstIndex(where: { $0.id == petId }) else { return }
        let previous = pets
        pets.remove(at: idx)
        applyState()
        do {
            let _: EmptyResponse = try await api.request(
                HomesEndpoints.deletePet(homeId: homeId, petId: petId)
            )
        } catch {
            pets = previous
            applyState()
        }
    }

    // MARK: - Private

    private func fetch() async {
        do {
            let response: PetsResponse = try await api.request(
                HomesEndpoints.listPets(homeId: homeId)
            )
            pets = response.pets
            applyState()
        } catch {
            state = .error(
                message: (error as? APIError)?.errorDescription
                    ?? "Couldn't load pets. Try again."
            )
        }
    }

    private func applyState() {
        guard !pets.isEmpty else {
            state = .empty(
                ListOfRowsState.EmptyContent(
                    icon: .pawPrint,
                    headline: "No pets yet",
                    subcopy:
                    "Add your pets so household members and pet-sitters " +
                        "have the info they need.",
                    ctaTitle: "Add a pet"
                ) { @Sendable [weak self] in
                    Task { @MainActor in self?.pendingEvent = .openAdd }
                }
            )
            return
        }
        state = .loaded(
            sections: [RowSection(rows: pets.map { row(for: $0) })],
            hasMore: false
        )
    }

    private func row(for pet: PetDTO) -> RowModel {
        let species = PetSpecies.parse(pet.species)
        let palette = species.palette
        let thumbnailImage: ThumbnailImage =
            if let urlString = pet.photoUrl?.nilIfEmpty, let url = URL(string: urlString) {
                .url(url, fallback: palette.icon, gradient: palette.iconBackground)
            } else {
                .icon(palette.icon, gradient: palette.iconBackground)
            }
        return RowModel(
            id: pet.id,
            title: pet.name,
            subtitle: pet.breed?.nilIfEmpty,
            template: .avatarKebab,
            leading: .thumbnail(image: thumbnailImage, size: .large),
            trailing: .kebab,
            onTap: { @Sendable [weak self] in
                Task { @MainActor in self?.pendingEvent = .openEdit(petId: pet.id) }
            },
            onSecondary: { @Sendable [weak self] in
                Task { @MainActor in
                    self?.pendingEvent = .confirmDelete(petId: pet.id, name: pet.name)
                }
            },
            body: pet.notes?.nilIfEmpty,
            inlineChip: RowChip(
                text: species.label,
                tint: .custom(
                    background: palette.chipBackground,
                    foreground: palette.chipForeground
                )
            ),
            chips: Self.vetChips(for: pet)
        )
    }

    /// Vet contact pill under the row body — RN's expanded pet card
    /// (`src/app/homes/[id]/pets.tsx:133 + 155-160`) joins `vet_name`
    /// and `vet_phone` with "·" behind a medkit icon.
    private static func vetChips(for pet: PetDTO) -> [RowChip]? {
        let parts = [pet.vetName?.nilIfEmpty, pet.vetPhone?.nilIfEmpty].compactMap { $0 }
        guard !parts.isEmpty else { return nil }
        return [
            RowChip(
                text: parts.joined(separator: " · "),
                icon: .stethoscope,
                tint: .custom(
                    background: Theme.Color.appSurfaceSunken,
                    foreground: Theme.Color.appTextSecondary
                )
            )
        ]
    }
}

private extension String {
    var nilIfEmpty: String? {
        isEmpty ? nil : self
    }
}
