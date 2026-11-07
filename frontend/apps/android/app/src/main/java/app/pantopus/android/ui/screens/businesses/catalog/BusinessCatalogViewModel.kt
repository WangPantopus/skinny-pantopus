@file:Suppress("PackageNaming", "TooManyFunctions")

package app.pantopus.android.ui.screens.businesses.catalog

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.businesses.BusinessCatalogItemRequest
import app.pantopus.android.data.api.models.businesses.BusinessCatalogManagedItemDto
import app.pantopus.android.data.api.models.businesses.BusinessPermission
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.businesses.BusinessCatalogRepository
import app.pantopus.android.data.businesses.BusinessTeamRepository
import app.pantopus.android.ui.screens.businesses.BusinessAccessCheck
import app.pantopus.android.ui.screens.businesses.BusinessAccessState
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.util.UUID
import javax.inject.Inject

/**
 * Nav-arg key for the owned business UUID. The catalog manager is an
 * in-screen frame of the Business owner dashboard, so it resolves against
 * that route's `NavBackStackEntry` — the same `businessId` argument
 * `BusinessOwnerViewModel` reads.
 */
const val BUSINESS_CATALOG_BUSINESS_ID_KEY = "businessId"

private const val NO_CATALOG_ACCESS = "You don't have permission to manage this catalog."
private const val CATALOG_CHECK_FAILED = "Couldn't check catalog access. Your changes are kept. Retry to continue."

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
 * the list always reflects the server's `sort_order` / `status`. Each one
 * asks `GET /:businessId/me` first, and access is asked again on every return,
 * so a draft is only sent under a fresh answer. Mirrors iOS
 * `BusinessCatalogViewModel.swift`.
 */
@HiltViewModel
class BusinessCatalogViewModel
    @Inject
    constructor(
        private val repo: BusinessCatalogRepository,
        private val team: BusinessTeamRepository,
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

        private val _access = MutableStateFlow(BusinessCatalogAccess(isChecking = true))
        val access: StateFlow<BusinessCatalogAccess> = _access.asStateFlow()

        private val accessCheck = BusinessAccessCheck(viewModelScope, { team.access(businessId) }, ::applyAccess)
        private var fetchGeneration = 0

        // One client key per intended create, reused while the same item or category is retried, so a lost reply
        // can't add it twice. Cleared once the create sticks.
        private var pendingItemCreate: Pair<BusinessCatalogItemRequest, String>? = null
        private var pendingCategoryCreate: Pair<String, String>? = null

        fun load() {
            if (_state.value is BusinessCatalogUiState.Loaded) return
            _state.value = BusinessCatalogUiState.Loading
            viewModelScope.launch { checkThenFetch() }
        }

        fun refresh() {
            viewModelScope.launch { checkThenFetch() }
        }

        /** Every arrival: the first load, or a fresh check of what's allowed that keeps the list and any draft. */
        fun resume() {
            val current = _state.value
            if (current is BusinessCatalogUiState.Loaded || current is BusinessCatalogUiState.Empty) {
                retryAccess()
            } else {
                load()
            }
        }

        /** The screen left or the app went away: what was allowed no longer counts, and no late reply can restore it. */
        fun pause() {
            accessCheck.forget()
        }

        fun retryAccess() {
            viewModelScope.launch { accessCheck.confirm() }
        }

        private fun applyAccess(state: BusinessAccessState) {
            _access.value =
                when (state) {
                    BusinessAccessState.Unknown, BusinessAccessState.Checking -> _access.value.copy(isChecking = true, notice = null)
                    is BusinessAccessState.Known -> {
                        val canEditItems = state.access.allows(BusinessPermission.CATALOG_EDIT)
                        val canManage = state.access.allows(BusinessPermission.CATALOG_MANAGE)
                        BusinessCatalogAccess(
                            canEditItems = canEditItems,
                            canManage = canManage,
                            notice = NO_CATALOG_ACCESS.takeUnless { canEditItems || canManage },
                        )
                    }
                    BusinessAccessState.Refused -> BusinessCatalogAccess(notice = NO_CATALOG_ACCESS)
                    BusinessAccessState.Failed -> BusinessCatalogAccess(notice = CATALOG_CHECK_FAILED)
                }
        }

        fun dismissToast() {
            _toast.value = null
        }

        /** An editor's or panel's failure, cleared when it closes; success toasts keep their own timer. */
        fun dismissErrorToast() {
            if (_toast.value?.kind == BusinessCatalogToastKind.Error) _toast.value = null
        }

        // ---- Fetch ----------------------------------------------------

        /** The catalog stays closed until the business says this person may read it; a failed answer opens nothing. */
        private suspend fun checkThenFetch() {
            val request = ++fetchGeneration
            val answer = accessCheck.confirm()
            if (request != fetchGeneration || answer == BusinessAccessState.Unknown) return
            val access = (answer as? BusinessAccessState.Known)?.access
            when {
                answer == BusinessAccessState.Failed -> _state.value = BusinessCatalogUiState.Error(CATALOG_CHECK_FAILED)
                access?.allows(BusinessPermission.CATALOG_VIEW) == true -> fetch(request)
                else -> _state.value = BusinessCatalogUiState.Error(NO_CATALOG_ACCESS)
            }
        }

        private suspend fun fetch(request: Int = ++fetchGeneration) {
            val categoriesResult = repo.categories(businessId)
            if (request != fetchGeneration) return
            val categories =
                when (categoriesResult) {
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

            val itemsResult = repo.items(businessId)
            if (request != fetchGeneration) return
            when (itemsResult) {
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
                _toast.value = BusinessCatalogToast(draft.validationError ?: "Check the item details", BusinessCatalogToastKind.Error)
                onDone(false)
                return
            }
            val body = draft.asRequest()
            val pending = pendingItemCreate?.takeIf { it.first == body } ?: (body to UUID.randomUUID().toString())
            pendingItemCreate = pending
            val onCreated: (Boolean) -> Unit = { ok ->
                if (ok) pendingItemCreate = null
                onDone(ok)
            }
            mutate(BusinessPermission.CATALOG_EDIT, "Item added", onCreated) {
                repo.createItem(businessId, body.copy(clientRequestId = pending.second))
            }
        }

        /** `PATCH …/catalog/items/:itemId`. */
        fun updateItem(
            itemId: String,
            draft: BusinessCatalogItemDraft,
            onDone: (Boolean) -> Unit = {},
        ) {
            if (!draft.isValid) {
                _toast.value = BusinessCatalogToast(draft.validationError ?: "Check the item details", BusinessCatalogToastKind.Error)
                onDone(false)
                return
            }
            mutate(BusinessPermission.CATALOG_EDIT, "Item saved", onDone) { repo.updateItem(businessId, itemId, draft.asRequest()) }
        }

        /** `DELETE …/catalog/items/:itemId` — archives the item. */
        fun deleteItem(itemId: String) {
            mutate(BusinessPermission.CATALOG_MANAGE, "Item archived") { repo.deleteItem(businessId, itemId) }
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
            mutate(
                permission = BusinessPermission.CATALOG_EDIT,
                successText = null,
                onDone = { ok -> if (!ok) _state.value = current },
            ) {
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
            val pending = pendingCategoryCreate?.takeIf { it.first == trimmed } ?: (trimmed to UUID.randomUUID().toString())
            pendingCategoryCreate = pending
            val onCreated: (Boolean) -> Unit = { ok ->
                if (ok) pendingCategoryCreate = null
                onDone(ok)
            }
            mutate(BusinessPermission.CATALOG_MANAGE, "Category added", onCreated) {
                repo.createCategory(businessId, trimmed, pending.second)
            }
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
            mutate(BusinessPermission.CATALOG_MANAGE, "Category renamed", onDone) { repo.renameCategory(businessId, categoryId, trimmed) }
        }

        /** `DELETE …/catalog/categories/:catId` — soft-delete. */
        fun deleteCategory(categoryId: String) {
            mutate(BusinessPermission.CATALOG_MANAGE, "Category deleted") { repo.deleteCategory(businessId, categoryId) }
        }

        // ---- Plumbing --------------------------------------------------

        /**
         * Ask the server whether [permission] still holds, run the mutation,
         * surface a toast, then re-fetch. [onDone] gets true on success so
         * callers can keep / dismiss their editor sheet; a refusal sends nothing.
         */
        private fun mutate(
            permission: String,
            successText: String?,
            onDone: (Boolean) -> Unit = {},
            call: suspend () -> NetworkResult<*>,
        ) {
            if (_isMutating.value) {
                onDone(false)
                return
            }
            _isMutating.value = true
            _toast.value = null
            viewModelScope.launch {
                try {
                    mutationRefusal(permission)?.let { refusal ->
                        _toast.value = BusinessCatalogToast(refusal, BusinessCatalogToastKind.Error)
                        onDone(false)
                        return@launch
                    }
                    val result = call()
                    if (result is NetworkResult.Failure) {
                        _toast.value = BusinessCatalogToast(message(result.error), BusinessCatalogToastKind.Error)
                        onDone(false)
                        // Refused after the check said yes: the screen should show what's allowed now.
                        if (result.error is NetworkError.Forbidden) retryAccess()
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

        private suspend fun mutationRefusal(permission: String): String? =
            when (val answer = accessCheck.confirm()) {
                is BusinessAccessState.Known -> NO_CATALOG_ACCESS.takeUnless { answer.access.allows(permission) }
                BusinessAccessState.Refused -> NO_CATALOG_ACCESS
                else -> CATALOG_CHECK_FAILED
            }

        private fun message(error: NetworkError): String =
            when (error) {
                NetworkError.Forbidden -> NO_CATALOG_ACCESS
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
