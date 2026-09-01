//
//  BusinessCatalogEndpoints.swift
//  Pantopus
//
//  Owner-side catalog CRUD + reorder, and the "post as this business"
//  create. Kept out of `BusinessesEndpoints.swift` (which is heavily
//  shared) so the catalog manager owns one cohesive surface.
//
//  Every helper names its backend route file + line. All routes are
//  permission-gated server side (`catalog.manage` / `catalog.edit` for
//  the catalog, `profile.edit` for the business post).
//

import Foundation

/// Endpoints backing the owner catalog manager.
public enum BusinessCatalogEndpoints {
    // MARK: - Categories

    /// `GET /api/businesses/:businessId/catalog/categories` — active
    /// categories, `sort_order` ascending. Requires `catalog.view`.
    /// Route `backend/routes/businesses.js:2247`.
    public static func categories(businessId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/businesses/\(businessId)/catalog/categories")
    }

    /// `POST /api/businesses/:businessId/catalog/categories` — create a
    /// category. Body `createCategorySchema` (`name` required). Requires
    /// `catalog.manage`. Route `backend/routes/businesses.js:2215`.
    public static func createCategory(
        businessId: String,
        body: BusinessCatalogCategoryRequest
    ) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/businesses/\(businessId)/catalog/categories",
            body: body
        )
    }

    /// `PATCH /api/businesses/:businessId/catalog/categories/:catId` —
    /// rename / re-describe a category. Requires `catalog.manage`.
    /// Route `backend/routes/businesses.js:2277`.
    public static func updateCategory(
        businessId: String,
        categoryId: String,
        body: BusinessCatalogCategoryRequest
    ) -> Endpoint {
        Endpoint(
            method: .patch,
            path: "/api/businesses/\(businessId)/catalog/categories/\(categoryId)",
            body: body
        )
    }

    /// `DELETE /api/businesses/:businessId/catalog/categories/:catId` —
    /// soft-delete (`is_active = false`). Requires `catalog.manage`.
    /// Route `backend/routes/businesses.js:2308`.
    public static func deleteCategory(businessId: String, categoryId: String) -> Endpoint {
        Endpoint(
            method: .delete,
            path: "/api/businesses/\(businessId)/catalog/categories/\(categoryId)"
        )
    }

    // MARK: - Items

    /// `GET /api/businesses/:businessId/catalog/items` decoded with the
    /// owner-editable row shape (`status` / `sort_order` / `category_id`).
    /// Route `backend/routes/businesses.js:2386`.
    public static func items(businessId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/businesses/\(businessId)/catalog/items")
    }

    /// `POST /api/businesses/:businessId/catalog/items` — create an item.
    /// Body `createCatalogItemSchema` (`name` required). Requires
    /// `catalog.edit`. Route `backend/routes/businesses.js:2339`.
    public static func createItem(
        businessId: String,
        body: BusinessCatalogItemRequest
    ) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/businesses/\(businessId)/catalog/items",
            body: body
        )
    }

    /// `PATCH /api/businesses/:businessId/catalog/items/:itemId` — update
    /// an item. Body `updateCatalogItemSchema` (at least one key).
    /// Requires `catalog.edit`. Route `backend/routes/businesses.js:2425`.
    public static func updateItem(
        businessId: String,
        itemId: String,
        body: BusinessCatalogItemRequest
    ) -> Endpoint {
        Endpoint(
            method: .patch,
            path: "/api/businesses/\(businessId)/catalog/items/\(itemId)",
            body: body
        )
    }

    /// `DELETE /api/businesses/:businessId/catalog/items/:itemId` —
    /// archives the item (`status = 'archived'`). Requires
    /// `catalog.manage`. Route `backend/routes/businesses.js:2469`.
    public static func deleteItem(businessId: String, itemId: String) -> Endpoint {
        Endpoint(
            method: .delete,
            path: "/api/businesses/\(businessId)/catalog/items/\(itemId)"
        )
    }

    /// `POST /api/businesses/:businessId/catalog/items/reorder` — bulk
    /// `sort_order` write. Body `{ items: [{ id, sort_order }] }`.
    /// Requires `catalog.edit`. Route `backend/routes/businesses.js:2504`.
    public static func reorderItems(
        businessId: String,
        body: BusinessCatalogReorderRequest
    ) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/businesses/\(businessId)/catalog/items/reorder",
            body: body
        )
    }
}
