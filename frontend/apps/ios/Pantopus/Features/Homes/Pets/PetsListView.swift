//
//  PetsListView.swift
//  Pantopus
//
//  T5.2.1 — Thin wrapper around `ListOfRowsView`. The data source carries
//  rows + chrome; the view dispatches model `pendingEvent`s to the Add
//  wizard sheet, the Edit wizard sheet, and a delete confirm.
//

import SwiftUI

/// Pushed onto the Hub stack from `HomeDashboardView`. Reaches
/// `GET/POST/PUT/DELETE /api/homes/:id/pets`.
public struct PetsListView: View {
    @State private var viewModel: PetsListViewModel
    @State private var addingPet = false
    @State private var editingPet: PetDTO?
    @State private var deleteConfirm: DeleteTarget?

    private let homeId: String

    public init(homeId: String) {
        self.homeId = homeId
        _viewModel = State(initialValue: PetsListViewModel(homeId: homeId))
    }

    public var body: some View {
        ListOfRowsView(dataSource: viewModel)
            .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
            .accessibilityIdentifier("petsList")
            .onAppear { Analytics.track(.screenPetsListViewed) }
            .onChange(of: viewModel.pendingEvent) { _, event in
                handle(event)
            }
            .sheet(isPresented: $addingPet) {
                AddPetWizardView(homeId: homeId) { created in
                    addingPet = false
                    if let created { viewModel.handleCreated(created) }
                }
            }
            .sheet(item: $editingPet) { pet in
                AddPetWizardView(homeId: homeId, existing: pet) { updated in
                    editingPet = nil
                    if let updated { viewModel.handleUpdated(updated) }
                }
            }
            .alert(
                "Remove pet?",
                isPresented: Binding(
                    get: { deleteConfirm != nil },
                    set: { if !$0 { deleteConfirm = nil } }
                ),
                presenting: deleteConfirm
            ) { target in
                Button("Remove \(target.name)", role: .destructive) {
                    Task { await viewModel.deletePet(petId: target.id) }
                    deleteConfirm = nil
                }
                .accessibilityIdentifier("petsList_deleteConfirm")
                Button("Cancel", role: .cancel) { deleteConfirm = nil }
            } message: { target in
                Text("\(target.name) will be removed from this home.")
            }
    }

    private func handle(_ event: PetsListEvent?) {
        guard let event else { return }
        switch event {
        case .openAdd:
            addingPet = true
        case let .openEdit(petId):
            if let pet = viewModel.cachedPet(withId: petId) {
                editingPet = pet
            }
        case let .confirmDelete(petId, name):
            deleteConfirm = DeleteTarget(id: petId, name: name)
        }
        viewModel.pendingEvent = nil
    }

    private struct DeleteTarget: Identifiable, Equatable {
        let id: String
        let name: String
    }
}

#Preview {
    NavigationStack {
        PetsListView(homeId: "preview-home-id")
    }
}
