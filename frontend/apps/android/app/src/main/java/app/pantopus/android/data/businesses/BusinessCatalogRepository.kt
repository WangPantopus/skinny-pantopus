package app.pantopus.android.data.businesses

import app.pantopus.android.data.api.models.businesses.BusinessCatalogCategoriesResponse
import app.pantopus.android.data.api.models.businesses.BusinessCatalogCategoryRequest
import app.pantopus.android.data.api.models.businesses.BusinessCatalogCategoryResponse
import app.pantopus.android.data.api.models.businesses.BusinessCatalogItemEnvelope
import app.pantopus.android.data.api.models.businesses.BusinessCatalogItemRequest
import app.pantopus.android.data.api.models.businesses.BusinessCatalogManagedItemsResponse
import app.pantopus.android.data.api.models.businesses.BusinessCatalogMessageResponse
import app.pantopus.android.data.api.models.businesses.BusinessCatalogReorderEntry
import app.pantopus.android.data.api.models.businesses.BusinessCatalogReorderRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.BusinessCatalogApi
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Wraps the owner catalog CRUD endpoints in the [NetworkResult] taxonomy.
 * Backs the catalog manager frame of the Business owner dashboard.
 *
 * iOS twin: `BusinessCatalogViewModel` calls the endpoints directly via
 * `APIClient` (iOS has no repository layer).
 */
@Singleton
open class BusinessCatalogRepository
    @Inject
    constructor(
        private val api: BusinessCatalogApi,
    ) {
        /** Active categories, `sort_order` ascending. */
        open suspend fun categories(businessId: String): NetworkResult<BusinessCatalogCategoriesResponse> =
            safeApiCall { api.categories(businessId) }

        /** Owner-editable catalog rows (includes drafts + archived). */
        open suspend fun items(businessId: String): NetworkResult<BusinessCatalogManagedItemsResponse> =
            safeApiCall { api.items(businessId) }

        /** Create a category (`name` required). */
        open suspend fun createCategory(
            businessId: String,
            name: String,
        ): NetworkResult<BusinessCatalogCategoryResponse> =
            safeApiCall { api.createCategory(businessId, BusinessCatalogCategoryRequest(name = name)) }

        /** Rename a category. */
        open suspend fun renameCategory(
            businessId: String,
            categoryId: String,
            name: String,
        ): NetworkResult<BusinessCatalogCategoryResponse> =
            safeApiCall {
                api.updateCategory(businessId, categoryId, BusinessCatalogCategoryRequest(name = name))
            }

        /** Soft-delete a category. */
        open suspend fun deleteCategory(
            businessId: String,
            categoryId: String,
        ): NetworkResult<BusinessCatalogMessageResponse> = safeApiCall { api.deleteCategory(businessId, categoryId) }

        /** Create a catalog item. */
        open suspend fun createItem(
            businessId: String,
            body: BusinessCatalogItemRequest,
        ): NetworkResult<BusinessCatalogItemEnvelope> = safeApiCall { api.createItem(businessId, body) }

        /** Update a catalog item. */
        open suspend fun updateItem(
            businessId: String,
            itemId: String,
            body: BusinessCatalogItemRequest,
        ): NetworkResult<BusinessCatalogItemEnvelope> = safeApiCall { api.updateItem(businessId, itemId, body) }

        /** Archive a catalog item (`status = 'archived'`). */
        open suspend fun deleteItem(
            businessId: String,
            itemId: String,
        ): NetworkResult<BusinessCatalogMessageResponse> = safeApiCall { api.deleteItem(businessId, itemId) }

        /** Persist a new ordering — `{ items: [{ id, sort_order }] }`. */
        open suspend fun reorderItems(
            businessId: String,
            orderedIds: List<String>,
        ): NetworkResult<BusinessCatalogMessageResponse> =
            safeApiCall {
                api.reorderItems(
                    businessId,
                    BusinessCatalogReorderRequest(
                        items = orderedIds.mapIndexed { index, id -> BusinessCatalogReorderEntry(id, index) },
                    ),
                )
            }
    }
