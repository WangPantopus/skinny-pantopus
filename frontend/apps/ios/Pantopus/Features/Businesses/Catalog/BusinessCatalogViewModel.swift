//
//  BusinessCatalogViewModel.swift
//  Pantopus
//
//  Owner catalog manager. Every mutation the React Native `CatalogTab`
//  exposes is live here:
//    · items      POST / PATCH / DELETE `…/catalog/items[/:itemId]`
//    · reorder    POST `…/catalog/items/reorder` (move up / move down)
//    · categories POST / PATCH / DELETE `…/catalog/categories[/:catId]`
//
//  Mutations are awaited (not optimistic) and followed by a re-fetch, so
//  the list always reflects the server's `sort_order` / `status`.
//

import Foundation
import Logging
import Observation

/// View-model for the owner catalog manager.
@MainActor
@Observable
public final class BusinessCatalogViewModel {
    /// Render state.
    public private(set) var state: BusinessCatalogState = .loading

    /// True while a create / update / delete / reorder round-trip is in
    /// flight — dims the reorder chevrons and disables the editor CTA.
    public private(set) var isMutating = false

    /// Surfaced by the view as a bottom toast.
    public var toast: ToastMessage?

    private let businessId: String
    private let client: APIClient
    private let logger = Logger(label: "app.pantopus.ios.BusinessCatalog")

    /// - Parameters:
    ///   - businessId: The owned business id.
    ///   - client: Injectable for tests. Internal because `APIClient` is
    ///     module-internal (see `MembersListViewModel.swift:204`).
    init(businessId: String, client: APIClient = .shared) {
        self.businessId = businessId
        self.client = client
    }

    // MARK: - Load

    public func load() async {
        state = .loading
        await fetch()
    }

    public func refresh() async {
        await fetch()
    }

    private func fetch() async {
        let categories: [BusinessCatalogCategoryRow]
        do {
            let response: BusinessCatalogCategoriesResponse = try await client.request(
                BusinessCatalogEndpoints.categories(businessId: businessId)
            )
            categories = response.categories.map {
                BusinessCatalogCategoryRow(
                    id: $0.id,
                    name: $0.name,
                    detail: $0.description?.isEmpty == false ? $0.description : nil
                )
            }
        } catch let error as APIError {
            state = .error(message: message(for: error, fallback: "Couldn't load your catalog"))
            return
        } catch {
            state = .error(message: "Couldn't load your catalog")
            return
        }

        do {
            let response: BusinessCatalogManagedItemsResponse = try await client.request(
                BusinessCatalogEndpoints.items(businessId: businessId)
            )
            let rows = response.items
                .filter { $0.status != BusinessCatalogStatus.archived.rawValue }
                .map(row)
            state = rows.isEmpty
                ? .empty(categories: categories)
                : .loaded(BusinessCatalogContent(items: rows, categories: categories))
        } catch let error as APIError {
            state = .error(message: message(for: error, fallback: "Couldn't load your catalog"))
        } catch {
            state = .error(message: "Couldn't load your catalog")
        }
    }

    // MARK: - Items

    /// `POST …/catalog/items`. Returns true when the item was created.
    @discardableResult
    public func createItem(_ draft: BusinessCatalogItemDraft) async -> Bool {
        guard draft.isValid else {
            toast = ToastMessage(text: "Name is required", kind: .error)
            return false
        }
        return await mutate(successText: "Item added") {
            _ = try await self.client.request(
                BusinessCatalogEndpoints.createItem(
                    businessId: self.businessId,
                    body: draft.asRequest()
                ),
                as: BusinessCatalogItemEnvelope.self
            )
        }
    }

    /// `PATCH …/catalog/items/:itemId`. Returns true when the edit stuck.
    @discardableResult
    public func updateItem(id: String, draft: BusinessCatalogItemDraft) async -> Bool {
        guard draft.isValid else {
            toast = ToastMessage(text: "Name is required", kind: .error)
            return false
        }
        return await mutate(successText: "Item saved") {
            _ = try await self.client.request(
                BusinessCatalogEndpoints.updateItem(
                    businessId: self.businessId,
                    itemId: id,
                    body: draft.asRequest()
                ),
                as: BusinessCatalogItemEnvelope.self
            )
        }
    }

    /// `DELETE …/catalog/items/:itemId` — archives the item.
    public func deleteItem(id: String) async {
        await mutate(successText: "Item archived") {
            _ = try await self.client.request(
                BusinessCatalogEndpoints.deleteItem(businessId: self.businessId, itemId: id),
                as: BusinessMutationMessageResponse.self
            )
        }
    }

    /// Move an item one slot up / down and persist the whole ordering via
    /// `POST …/catalog/items/reorder` — the same shape RN's chevrons send.
    public func move(itemId: String, direction: BusinessCatalogMoveDirection) async {
        guard case let .loaded(content) = state else { return }
        guard let index = content.items.firstIndex(where: { $0.id == itemId }) else { return }
        let target = direction == .up ? index - 1 : index + 1
        guard target >= 0, target < content.items.count else { return }

        var reordered = content.items
        reordered.swapAt(index, target)
        let entries = reordered.enumerated().map {
            BusinessCatalogReorderEntry(id: $1.id, sortOrder: $0)
        }

        // Optimistic local reorder so the list doesn't wait a round-trip.
        state = .loaded(BusinessCatalogContent(items: reordered, categories: content.categories))
        let ok = await mutate(successText: nil) {
            _ = try await self.client.request(
                BusinessCatalogEndpoints.reorderItems(
                    businessId: self.businessId,
                    body: BusinessCatalogReorderRequest(items: entries)
                ),
                as: BusinessMutationMessageResponse.self
            )
        }
        if !ok {
            // Roll back to the pre-move ordering.
            state = .loaded(content)
        }
    }

    // MARK: - Categories

    /// `POST …/catalog/categories`.
    @discardableResult
    public func createCategory(name: String) async -> Bool {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            toast = ToastMessage(text: "Category name is required", kind: .error)
            return false
        }
        return await mutate(successText: "Category added") {
            _ = try await self.client.request(
                BusinessCatalogEndpoints.createCategory(
                    businessId: self.businessId,
                    body: BusinessCatalogCategoryRequest(name: trimmed)
                ),
                as: BusinessCatalogCategoryResponse.self
            )
        }
    }

    /// `PATCH …/catalog/categories/:catId`.
    @discardableResult
    public func renameCategory(id: String, name: String) async -> Bool {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            toast = ToastMessage(text: "Category name is required", kind: .error)
            return false
        }
        return await mutate(successText: "Category renamed") {
            _ = try await self.client.request(
                BusinessCatalogEndpoints.updateCategory(
                    businessId: self.businessId,
                    categoryId: id,
                    body: BusinessCatalogCategoryRequest(name: trimmed)
                ),
                as: BusinessCatalogCategoryResponse.self
            )
        }
    }

    /// `DELETE …/catalog/categories/:catId` — soft-delete.
    public func deleteCategory(id: String) async {
        await mutate(successText: "Category deleted") {
            _ = try await self.client.request(
                BusinessCatalogEndpoints.deleteCategory(
                    businessId: self.businessId,
                    categoryId: id
                ),
                as: BusinessMutationMessageResponse.self
            )
        }
    }

    // MARK: - Plumbing

    /// Run a mutation, surface a toast, then re-fetch. Returns true on
    /// success so callers can keep / dismiss their editor sheet.
    @discardableResult
    private func mutate(
        successText: String?,
        _ body: @escaping () async throws -> Void
    ) async -> Bool {
        guard !isMutating else { return false }
        isMutating = true
        defer { isMutating = false }
        do {
            try await body()
            if let successText {
                toast = ToastMessage(text: successText, kind: .success)
            }
            await fetch()
            return true
        } catch let error as APIError {
            let text = message(for: error, fallback: "Something went wrong. Try again.")
            logger.warning("Catalog mutation failed: \(error)")
            toast = ToastMessage(text: text, kind: .error)
            return false
        } catch {
            logger.warning("Catalog mutation failed: \(error)")
            toast = ToastMessage(text: "Something went wrong. Try again.", kind: .error)
            return false
        }
    }

    private func message(for error: APIError, fallback: String) -> String {
        switch error {
        case .forbidden:
            "You don't have permission to manage this catalog."
        case .notFound:
            "This business no longer exists."
        default:
            error.errorDescription ?? fallback
        }
    }

    private func row(_ dto: BusinessCatalogManagedItemDTO) -> BusinessCatalogItemRow {
        BusinessCatalogItemRow(
            id: dto.id,
            name: dto.name,
            description: dto.description,
            kind: BusinessCatalogKind.from(dto.kind),
            status: BusinessCatalogStatus(rawValue: dto.status ?? "active") ?? .active,
            priceCents: dto.priceCents,
            priceMaxCents: dto.priceMaxCents,
            priceUnit: dto.priceUnit,
            durationMinutes: dto.durationMinutes,
            isFeatured: dto.isFeatured ?? false,
            taxDeductible: dto.taxDeductible ?? false,
            suggestedAmounts: dto.suggestedAmounts ?? [],
            categoryId: dto.categoryId,
            categoryName: dto.category?.name
        )
    }
}

/// Direction for the move-up / move-down reorder affordance.
public enum BusinessCatalogMoveDirection: Sendable, Hashable {
    case up
    case down
}
