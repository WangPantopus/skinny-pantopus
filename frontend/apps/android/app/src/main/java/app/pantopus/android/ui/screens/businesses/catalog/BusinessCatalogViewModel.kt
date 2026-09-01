@file:Suppress("PackageNaming", "TooManyFunctions")

package app.pantopus.android.ui.screens.businesses.catalog

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.businesses.BusinessCatalogManagedItemDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.businesses.BusinessCatalogRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Nav-arg key for the owned business UUID. The catalog manager is an
 * in-screen frame of the Business owner dashboard, so it resolves against
 * that route's `NavBackStackEntry` — the same `businessId` argument
 * `BusinessOwnerViewModel` reads.
 */
const val BUSINESS_CATALOG_BUSINESS_ID_KEY = "businessId"

/** Toast kinds surfaced by the catalog manager. */
enum class BusinessCatalogToastKind { Success, Error }

/** A transient message shown at the bottom of the catalog frame. */
data class BusinessCatalogToast(
    val text: String,
    val kind: BusinessCatalogToastKind,
)

/**
 * Owner catalog manager. Every mutation the React Native `CatalogTab`
 * exposes is live here:
 *  - items      POST / PATCH / DELETE `…/catalog/items[/:itemId]`
 *  - reorder    POST `…/catalog/items/reorder` (move up / move down)
 *  - categories POST / PATCH / DELETE `…/catalog/categories[/:catId]`
 *
 * Mutations are awaited (not optimistic) and followed by a re-fetch, so
 * the list always reflects the server's `sort_order` / `status`. Mirrors
 * iOS `BusinessCatalogViewModel.swift`.
 */
@HiltViewModel
class BusinessCatalogViewModel
    @Inject
    constructor(
        private val repo: BusinessCatalogRepository,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        private val businessId: String =
            requireNotNull(savedStateHandle[BUSINESS_CATALOG_BUSINESS_ID_KEY]) {
                "BusinessCatalogViewModel requires a '$BUSINESS_CATALOG_BUSINESS_ID_KEY' nav arg."
            }

        private val _state = MutableStateFlow<BusinessCatalogUiState>(BusinessCatalogUiState.Loading)
        val state: StateFlow<BusinessCatalogUiState> = _state.asStateFlow()

        /**
         * True while a create / update / delete / reorder round-trip is in
         * flight — dims the reorder chevrons and disables the editor CTA.
         */
        private val _isMutating = MutableStateFlow(false)
        val isMutating: StateFlow<Boolean> = _isMutating.asStateFlow()

        private val _toast = MutableStateFlow<BusinessCatalogToast?>(null)
        val toast: StateFlow<BusinessCatalogToast?> = _toast.asStateFlow()

        fun load() {
            if (_state.value is BusinessCatalogUiState.Loaded) return
            _state.value = BusinessCatalogUiState.Loading
            viewModelScope.launch { fetch() }
        }

        fun refresh() {
            viewModelScope.launch { fetch() }
        }

        fun dismissToast() {
            _toast.value = null
        }

        // ---- Fetch ----------------------------------------------------

        private suspend fun fetch() {
            val categories =
                when (val categoriesResult = repo.categories(businessId)) {
                    is NetworkResult.Failure -> {
                        _state.value = BusinessCatalogUiState.Error(message(categoriesResult.error))
                        return
                    }
                    is NetworkResult.Success ->
                        categoriesResult.data.categories.map {
                            BusinessCatalogCategoryRow(
                                id = it.id,
                                name = it.name,
                                detail = it.description?.takeIf { desc -> desc.isNotEmpty() },
                            )
                        }
                }

            when (val itemsResult = repo.items(businessId)) {
                is NetworkResult.Failure -> _state.value = BusinessCatalogUiState.Error(message(itemsResult.error))
                is NetworkResult.Success -> {
                    val rows =
                        itemsResult.data.items
                            .filter { it.status != BusinessCatalogStatus.Archived.wire }
                            .map(::row)
                    _state.value =
                        if (rows.isEmpty()) {
                            BusinessCatalogUiState.Empty(categories)
                        } else {
                            BusinessCatalogUiState.Loaded(BusinessCatalogContent(rows, categories))
                        }
                }
            }
        }

        // ---- Items ----------------------------------------------------

        /** `POST …/catalog/items`. [onDone] receives true when it stuck. */
        fun createItem(
            draft: BusinessCatalogItemDraft,
            onDone: (Boolean) -> Unit = {},
        ) {
            if (!draft.isValid) {
                _toast.value = BusinessCatalogToast("Name is required", BusinessCatalogToastKind.Error)
                onDone(false)
                return
            }
            mutate("Item added", onDone) { repo.createItem(businessId, draft.asRequest()) }
        }

        /** `PATCH …/catalog/items/:itemId`. */
        fun updateItem(
            itemId: String,
            draft: BusinessCatalogItemDraft,
            onDone: (Boolean) -> Unit = {},
        ) {
            if (!draft.isValid) {
                _toast.value = BusinessCatalogToast("Name is required", BusinessCatalogToastKind.Error)
                onDone(false)
                return
            }
            mutate("Item saved", onDone) { repo.updateItem(businessId, itemId, draft.asRequest()) }
        }

        /** `DELETE …/catalog/items/:itemId` — archives the item. */
        fun deleteItem(itemId: String) {
            mutate("Item archived") { repo.deleteItem(businessId, itemId) }
        }

        /**
         * Move an item one slot up / down and persist the whole ordering via
         * `POST …/catalog/items/reorder` — the same shape RN's chevrons send.
         */
        fun move(
            itemId: String,
            direction: BusinessCatalogMoveDirection,
        ) {
            val current = _state.value as? BusinessCatalogUiState.Loaded ?: return
            val items = current.content.items
            val index = items.indexOfFirst { it.id == itemId }
            if (index < 0) return
            val target = if (direction == BusinessCatalogMoveDirection.Up) index - 1 else index + 1
            if (target < 0 || target >= items.size) return

            val reordered = items.toMutableList()
            reordered[index] = items[target]
            reordered[target] = items[index]

            // Optimistic local reorder so the list doesn't wait a round-trip.
            _state.value = BusinessCatalogUiState.Loaded(current.content.copy(items = reordered))
            mutate(successText = null, onDone = { ok -> if (!ok) _state.value = current }) {
                repo.reorderItems(businessId, reordered.map { it.id })
            }
        }

        // ---- Categories -----------------------------------------------

        /** `POST …/catalog/categories`. */
        fun createCategory(
            name: String,
            onDone: (Boolean) -> Unit = {},
        ) {
            val trimmed = name.trim()
            if (trimmed.isEmpty()) {
                _toast.value = BusinessCatalogToast("Category name is required", BusinessCatalogToastKind.Error)
                onDone(false)
                return
            }
            mutate("Category added", onDone) { repo.createCategory(businessId, trimmed) }
        }

        /** `PATCH …/catalog/categories/:catId`. */
        fun renameCategory(
            categoryId: String,
            name: String,
            onDone: (Boolean) -> Unit = {},
        ) {
            val trimmed = name.trim()
            if (trimmed.isEmpty()) {
                _toast.value = BusinessCatalogToast("Category name is required", BusinessCatalogToastKind.Error)
                onDone(false)
                return
            }
            mutate("Category renamed", onDone) { repo.renameCategory(businessId, categoryId, trimmed) }
        }

        /** `DELETE …/catalog/categories/:catId` — soft-delete. */
        fun deleteCategory(categoryId: String) {
            mutate("Category deleted") { repo.deleteCategory(businessId, categoryId) }
        }

        // ---- Plumbing --------------------------------------------------

        /**
         * Run a mutation, surface a toast, then re-fetch. [onDone] gets true
         * on success so callers can keep / dismiss their editor sheet.
         */
        private fun mutate(
            successText: String?,
            onDone: (Boolean) -> Unit = {},
            call: suspend () -> NetworkResult<*>,
        ) {
            if (_isMutating.value) {
                onDone(false)
                return
            }
            _isMutating.value = true
            viewModelScope.launch {
                try {
                    val result = call()
                    if (result is NetworkResult.Failure) {
                        _toast.value = BusinessCatalogToast(message(result.error), BusinessCatalogToastKind.Error)
                        onDone(false)
                    } else {
                        successText?.let {
                            _toast.value = BusinessCatalogToast(it, BusinessCatalogToastKind.Success)
                        }
                        fetch()
                        onDone(true)
                    }
                } finally {
                    _isMutating.value = false
                }
            }
        }

        private fun message(error: NetworkError): String =
            when (error) {
                NetworkError.Forbidden -> "You don't have permission to manage this catalog."
                NetworkError.NotFound -> "This business no longer exists."
                else -> error.message
            }

        private fun row(dto: BusinessCatalogManagedItemDto): BusinessCatalogItemRow =
            BusinessCatalogItemRow(
                id = dto.id,
                name = dto.name,
                description = dto.description,
                kind = BusinessCatalogKind.from(dto.kind),
                status = BusinessCatalogStatus.from(dto.status),
                priceCents = dto.priceCents,
                priceMaxCents = dto.priceMaxCents,
                priceUnit = dto.priceUnit,
                durationMinutes = dto.durationMinutes,
                isFeatured = dto.isFeatured == true,
                taxDeductible = dto.taxDeductible == true,
                suggestedAmounts = dto.suggestedAmounts.orEmpty(),
                categoryId = dto.categoryId,
                categoryName = dto.category?.name,
            )
    }
