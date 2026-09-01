package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.businesses.BusinessCatalogCategoriesResponse
import app.pantopus.android.data.api.models.businesses.BusinessCatalogCategoryRequest
import app.pantopus.android.data.api.models.businesses.BusinessCatalogCategoryResponse
import app.pantopus.android.data.api.models.businesses.BusinessCatalogItemEnvelope
import app.pantopus.android.data.api.models.businesses.BusinessCatalogItemRequest
import app.pantopus.android.data.api.models.businesses.BusinessCatalogManagedItemsResponse
import app.pantopus.android.data.api.models.businesses.BusinessCatalogMessageResponse
import app.pantopus.android.data.api.models.businesses.BusinessCatalogReorderRequest
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path

/**
 * Owner-side catalog CRUD. Kept off [BusinessesApi] (which is heavily
 * shared) so the catalog manager owns one cohesive surface.
 *
 * Every route is permission-gated server side: `catalog.manage` for
 * category writes + item delete, `catalog.edit` for item create / update /
 * reorder, `catalog.view` for the reads.
 *
 * iOS twin: `Core/Networking/Endpoints/BusinessCatalogEndpoints.swift`.
 */
interface BusinessCatalogApi {
    /**
     * `GET /api/businesses/:businessId/catalog/categories` — active
     * categories, `sort_order` ascending.
     * Route `backend/routes/businesses.js:2247`.
     */
    @GET("api/businesses/{businessId}/catalog/categories")
    suspend fun categories(
        @Path("businessId") businessId: String,
    ): BusinessCatalogCategoriesResponse

    /**
     * `POST /api/businesses/:businessId/catalog/categories` — create a
     * category (`name` required).
     * Route `backend/routes/businesses.js:2215`.
     */
    @POST("api/businesses/{businessId}/catalog/categories")
    suspend fun createCategory(
        @Path("businessId") businessId: String,
        @Body body: BusinessCatalogCategoryRequest,
    ): BusinessCatalogCategoryResponse

    /**
     * `PATCH /api/businesses/:businessId/catalog/categories/:catId` —
     * rename / re-describe a category.
     * Route `backend/routes/businesses.js:2277`.
     */
    @PATCH("api/businesses/{businessId}/catalog/categories/{categoryId}")
    suspend fun updateCategory(
        @Path("businessId") businessId: String,
        @Path("categoryId") categoryId: String,
        @Body body: BusinessCatalogCategoryRequest,
    ): BusinessCatalogCategoryResponse

    /**
     * `DELETE /api/businesses/:businessId/catalog/categories/:catId` —
     * soft-delete (`is_active = false`).
     * Route `backend/routes/businesses.js:2308`.
     */
    @DELETE("api/businesses/{businessId}/catalog/categories/{categoryId}")
    suspend fun deleteCategory(
        @Path("businessId") businessId: String,
        @Path("categoryId") categoryId: String,
    ): BusinessCatalogMessageResponse

    /**
     * `GET /api/businesses/:businessId/catalog/items` decoded with the
     * owner-editable row shape (`status` / `sort_order` / `category_id`).
     * Route `backend/routes/businesses.js:2386`.
     */
    @GET("api/businesses/{businessId}/catalog/items")
    suspend fun items(
        @Path("businessId") businessId: String,
    ): BusinessCatalogManagedItemsResponse

    /**
     * `POST /api/businesses/:businessId/catalog/items` — create an item.
     * Route `backend/routes/businesses.js:2339`.
     */
    @POST("api/businesses/{businessId}/catalog/items")
    suspend fun createItem(
        @Path("businessId") businessId: String,
        @Body body: BusinessCatalogItemRequest,
    ): BusinessCatalogItemEnvelope

    /**
     * `PATCH /api/businesses/:businessId/catalog/items/:itemId` — update an
     * item. Route `backend/routes/businesses.js:2425`.
     */
    @PATCH("api/businesses/{businessId}/catalog/items/{itemId}")
    suspend fun updateItem(
        @Path("businessId") businessId: String,
        @Path("itemId") itemId: String,
        @Body body: BusinessCatalogItemRequest,
    ): BusinessCatalogItemEnvelope

    /**
     * `DELETE /api/businesses/:businessId/catalog/items/:itemId` — archives
     * the item (`status = 'archived'`).
     * Route `backend/routes/businesses.js:2469`.
     */
    @DELETE("api/businesses/{businessId}/catalog/items/{itemId}")
    suspend fun deleteItem(
        @Path("businessId") businessId: String,
        @Path("itemId") itemId: String,
    ): BusinessCatalogMessageResponse

    /**
     * `POST /api/businesses/:businessId/catalog/items/reorder` — bulk
     * `sort_order` write, body `{ items: [{ id, sort_order }] }`.
     * Route `backend/routes/businesses.js:2504`.
     */
    @POST("api/businesses/{businessId}/catalog/items/reorder")
    suspend fun reorderItems(
        @Path("businessId") businessId: String,
        @Body body: BusinessCatalogReorderRequest,
    ): BusinessCatalogMessageResponse
}
