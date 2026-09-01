//
//  SavedPlacesViewModel.swift
//  Pantopus
//
//  BLOCK 2E — "Saved places". Mirrors the Following ViewModel + service
//  pattern: a cached row array, a `state` enum the view renders from,
//  optimistic row mutations that roll back on failure, and a transient toast.
//  Removal is optimistic and surfaces an Undo snackbar that re-POSTs the
//  place; the upsert route makes that re-save idempotent.
//

import SwiftUI

@Observable
@MainActor
public final class SavedPlacesViewModel {
    // MARK: - Observed surface

    public private(set) var state: SavedPlacesViewState = .loading
    public private(set) var selectedFilter: SavedPlaceFilter = .all

    /// Bound to the view's `.sheet(item:)` — the row whose overflow menu is
    /// open. `nil` dismisses the action sheet.
    public var actionTarget: SavedPlaceActionTarget?

    /// Bound to the Undo snackbar. Set right after an optimistic removal.
    public var undo: SavedPlaceUndo?

    /// Transient confirmation / error banner.
    public var toast: ToastMessage?

    // MARK: - Dependencies

    private let api: APIClient
    private let onBack: @MainActor () -> Void
    private let onExplore: @MainActor () -> Void
    private let onOpenMap: @MainActor (_ latitude: Double, _ longitude: Double, _ label: String) -> Void
    private let now: @Sendable () -> Date

    // MARK: - Cache

    private var items: [SavedPlaceDTO] = []
    private var loadedAtLeastOnce = false

    public convenience init(
        onBack: @escaping @MainActor () -> Void = {},
        onExplore: @escaping @MainActor () -> Void = {},
        onOpenMap: @escaping @MainActor (Double, Double, String) -> Void = { _, _, _ in },
        now: @escaping @Sendable () -> Date = { Date() }
    ) {
        self.init(
            api: .shared,
            onBack: onBack,
            onExplore: onExplore,
            onOpenMap: onOpenMap,
            now: now
        )
    }

    init(
        api: APIClient,
        onBack: @escaping @MainActor () -> Void = {},
        onExplore: @escaping @MainActor () -> Void = {},
        onOpenMap: @escaping @MainActor (Double, Double, String) -> Void = { _, _, _ in },
        now: @escaping @Sendable () -> Date = { Date() }
    ) {
        self.api = api
        self.onBack = onBack
        self.onExplore = onExplore
        self.onOpenMap = onOpenMap
        self.now = now
    }

    // MARK: - Loading

    public func load() async {
        if !loadedAtLeastOnce { state = .loading }
        await fetch()
    }

    public func refresh() async {
        await fetch()
    }

    private func fetch() async {
        do {
            let response: SavedPlacesListResponse = try await api.request(
                SavedPlacesEndpoints.list()
            )
            items = response.savedPlaces
            loadedAtLeastOnce = true
            rebuild()
        } catch {
            if !loadedAtLeastOnce {
                let message = (error as? APIError)?.errorDescription
                    ?? "Couldn't load your saved places."
                state = .error(message: message)
            } else {
                toast = ToastMessage(text: "Couldn't refresh.", kind: .error)
            }
        }
    }

    /// Recomputes `state` from the cached rows + the active filter. A filter
    /// that no longer matches anything (e.g. the last Home place was removed)
    /// falls back to `.all`.
    private func rebuild() {
        guard !items.isEmpty else {
            state = .empty
            return
        }
        let filters = SavedPlacesProjection.presentFilters(from: items)
        if !filters.contains(selectedFilter) { selectedFilter = .all }
        let rows = SavedPlacesProjection.rows(from: items, filter: selectedFilter, now: now())
        state = .loaded(rows: rows, filters: filters, total: items.count)
    }

    // MARK: - Filtering

    public func selectFilter(_ filter: SavedPlaceFilter) {
        guard filter != selectedFilter else { return }
        selectedFilter = filter
        rebuild()
    }

    // MARK: - Navigation passthroughs

    public func back() {
        onBack()
    }

    public func explore() {
        onExplore()
    }

    // MARK: - Row action sheet

    public func openActions(for row: SavedPlaceRow) {
        actionTarget = row.actionTarget
    }

    public func openActions(for target: SavedPlaceActionTarget) {
        actionTarget = target
    }

    public func closeActions() {
        actionTarget = nil
    }

    /// "Open on map" — hand the coordinate up to the host (Explore map).
    public func openMap(_ target: SavedPlaceActionTarget) {
        actionTarget = nil
        onOpenMap(target.latitude, target.longitude, target.label)
    }

    // MARK: - Remove + Undo

    /// Optimistically drop the row and fire the DELETE, then surface an Undo
    /// snackbar. A failed DELETE rolls the row back; a tapped Undo re-POSTs.
    public func remove(_ target: SavedPlaceActionTarget) async {
        actionTarget = nil
        guard let index = items.firstIndex(where: { $0.id == target.id }) else { return }
        let removed = items[index]
        let previous = items
        items.remove(at: index)
        rebuild()
        undo = SavedPlaceUndo(dto: removed, index: index)
        do {
            try await api.request(SavedPlacesEndpoints.remove(id: target.id))
        } catch {
            items = previous
            rebuild()
            undo = nil
            let message = (error as? APIError)?.errorDescription
                ?? "Couldn't remove \(target.label)."
            toast = ToastMessage(text: message, kind: .error)
        }
    }

    /// Re-save the just-removed place at its original position. The POST upsert
    /// returns a fresh row (a new id), which replaces the optimistic copy.
    public func undoRemove() async {
        guard let snapshot = undo else { return }
        undo = nil
        let dto = snapshot.dto
        let target = min(max(0, snapshot.index), items.count)
        items.insert(dto, at: target)
        rebuild()
        do {
            let response = try await api.request(
                SavedPlacesEndpoints.save(SavePlaceBody(from: dto)),
                as: SavedPlaceResponse.self
            )
            if let i = items.firstIndex(where: { $0.id == dto.id }) {
                items[i] = response.savedPlace
                rebuild()
            }
        } catch {
            if let i = items.firstIndex(where: { $0.id == dto.id }) {
                items.remove(at: i)
                rebuild()
            }
            toast = ToastMessage(text: "Couldn't restore \(dto.label).", kind: .error)
        }
    }

    /// The Undo snackbar timed out — commit the removal silently.
    public func dismissUndo() {
        undo = nil
    }
}

#if DEBUG
extension SavedPlacesViewModel {
    /// Seed a loaded state from sample rows without touching the network —
    /// used by previews and snapshot fixtures.
    static func previewLoaded() -> SavedPlacesViewModel {
        let vm = SavedPlacesViewModel()
        vm.items = SavedPlacesSampleData.rows
        vm.loadedAtLeastOnce = true
        vm.rebuild()
        return vm
    }

    static func previewEmpty() -> SavedPlacesViewModel {
        let vm = SavedPlacesViewModel()
        vm.loadedAtLeastOnce = true
        vm.rebuild()
        return vm
    }
}

/// Sample payload mirroring the BLOCK 2E design frames (Portland, OR).
enum SavedPlacesSampleData {
    static func place(
        _ id: String,
        _ label: String,
        _ type: String,
        daysAgo: Double
    ) -> SavedPlaceDTO {
        let date = Date().addingTimeInterval(-daysAgo * 86400)
        let iso = ISO8601DateFormatter().string(from: date)
        return SavedPlaceDTO(
            id: id,
            label: label,
            placeType: type,
            latitude: 45.5152,
            longitude: -122.6784,
            city: "Portland",
            state: "OR",
            sourceId: nil,
            geocodePlaceId: nil,
            createdAt: iso
        )
    }

    static let rows: [SavedPlaceDTO] = [
        place("1", "Mom\u{2019}s house", "home", daysAgo: 21),
        place("2", "The Studio", "work", daysAgo: 40),
        place("3", "Lan Su Garden", "saved", daysAgo: 1),
        place("4", "Blue Bottle Coffee", "saved", daysAgo: 5),
        place("5", "Mt. Tabor Park", "saved", daysAgo: 7)
    ]
}
#endif
