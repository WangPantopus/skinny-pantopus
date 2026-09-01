@file:Suppress("PackageNaming", "TooManyFunctions", "MagicNumber")

package app.pantopus.android.ui.screens.businesses.page_editor

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.businesses.BusinessCatalogItemDto
import app.pantopus.android.data.api.models.businesses.BusinessDetailResponse
import app.pantopus.android.data.api.models.businesses.BusinessHoursDto
import app.pantopus.android.data.api.models.businesses.BusinessPublicResponse
import app.pantopus.android.data.api.models.businesses.SetBusinessHoursRequest
import app.pantopus.android.data.api.models.businesses.UpdateBusinessRequest
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.businesses.BusinessesRepository
import app.pantopus.android.data.network.NetworkMonitor
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/** Nav-arg key for the business UUID. */
const val EDIT_BUSINESS_PAGE_BUSINESS_ID_KEY = "businessId"

/** Shown when the only pending edits are media the editor can't upload yet. */
private const val MEDIA_ONLY_MESSAGE = "Photo upload isn't available yet."

/**
 * Address edits need a `BusinessLocation` row to PATCH. The editor can't
 * create one (creation runs the address decision engine), so the edit is
 * refused loudly instead of being dropped behind a "Saved" toast.
 */
private const val NO_LOCATION_MESSAGE =
    "This business has no location yet — add one before editing the address."

/**
 * `GET /api/businesses/:businessId` answers for any signed-in viewer, so a
 * deep link (`pantopus://businesses/:id/page-editor`) would otherwise open a
 * fully functional editor for someone with no write access.
 */
private const val NO_ACCESS_MESSAGE = "You don't have access to edit this business."

private const val OFFLINE_MESSAGE = "You're offline. Try again when you're back online."

private const val COUNTRY_CODE_PREFIX = "+1"

/** Why a save can't be attempted. [Address] also paints the field inline. */
private sealed interface SaveBlock {
    val message: String

    data class Toast(override val message: String) : SaveBlock

    data class Address(override val message: String) : SaveBlock
}

/**
 * P4.2 / WS2.3 — A13.10 Edit Business Page. Profile-form editor wired to
 * business APIs (not the RN block CMS).
 */
@HiltViewModel
class EditBusinessPageViewModel
    @Inject
    constructor(
        savedStateHandle: SavedStateHandle,
        private val businesses: BusinessesRepository,
        private val networkMonitor: NetworkMonitor,
    ) : ViewModel() {
        private val businessId: String =
            requireNotNull(savedStateHandle[EDIT_BUSINESS_PAGE_BUSINESS_ID_KEY]) {
                "EditBusinessPageViewModel requires a '$EDIT_BUSINESS_PAGE_BUSINESS_ID_KEY' nav arg."
            }

        private val _state = MutableStateFlow<EditBusinessPageUiState>(EditBusinessPageUiState.Loading)
        val state: StateFlow<EditBusinessPageUiState> = _state.asStateFlow()

        private val _toast = MutableStateFlow<String?>(null)
        val toast: StateFlow<String?> = _toast.asStateFlow()

        private val _showsDiscardConfirm = MutableStateFlow(false)
        val showsDiscardConfirm: StateFlow<Boolean> = _showsDiscardConfirm.asStateFlow()

        private var localPreviewPersistenceEnabled = false
        private var hasLoadedOnce = false
        private var primaryLocationId: String? = null

        /**
         * Full jsonb objects as the server last returned them — the PATCH
         * route replaces `social_links` / `attributes` wholesale, so an edit
         * has to be merged into these before it goes back up.
         */
        private var loadedSocialLinks: Map<String, String> = emptyMap()
        private var loadedAttributes: Map<String, Any?> = emptyMap()

        /** Whether the stored phone carried a `+1` the loader stripped. */
        private var loadedPhoneHadCountryCode = false
        private var isSaving = false

        fun load() {
            if (localPreviewPersistenceEnabled) return
            if (hasLoadedOnce && _state.value is EditBusinessPageUiState.Loaded) return
            viewModelScope.launch { fetch(showLoading = true) }
        }

        fun refresh() {
            if (localPreviewPersistenceEnabled) return
            viewModelScope.launch { fetch(showLoading = true) }
        }

        /** Test-only: seed the loaded state directly. */
        fun seedForPreview(content: EditBusinessPageContent) {
            localPreviewPersistenceEnabled = true
            hasLoadedOnce = true
            _state.value = EditBusinessPageUiState.Loaded(content)
        }

        fun update(
            key: EditBusinessPageFieldKey,
            value: String,
        ) {
            val current = _state.value as? EditBusinessPageUiState.Loaded ?: return
            val content = current.content
            val next =
                when (key) {
                    EditBusinessPageFieldKey.Name ->
                        content.copy(name = content.name.copy(current = value))
                    EditBusinessPageFieldKey.Tagline ->
                        content.copy(tagline = content.tagline.copy(current = value))
                    EditBusinessPageFieldKey.Category ->
                        content.copy(category = content.category.copy(current = value))
                    EditBusinessPageFieldKey.Price ->
                        content.copy(price = content.price.copy(current = value))
                    EditBusinessPageFieldKey.Description -> {
                        val desc = content.description as? EditBusinessPageDescriptionState.Field ?: return
                        content.copy(
                            description =
                                desc.copy(
                                    field =
                                        desc.field.copy(
                                            current = value.take(desc.charLimit),
                                        ),
                                ),
                        )
                    }
                    EditBusinessPageFieldKey.Phone ->
                        content.copy(phone = content.phone.copy(current = value))
                    EditBusinessPageFieldKey.Email ->
                        content.copy(email = content.email.copy(current = value))
                    EditBusinessPageFieldKey.Website ->
                        content.copy(website = content.website.copy(current = value))
                    EditBusinessPageFieldKey.BookingLink -> {
                        val booking =
                            content.bookingLink
                                ?: EditBusinessPageField(original = "", current = "")
                        content.copy(bookingLink = booking.copy(current = value))
                    }
                    EditBusinessPageFieldKey.Address,
                    EditBusinessPageFieldKey.City,
                    EditBusinessPageFieldKey.State,
                    EditBusinessPageFieldKey.Zip,
                    ->
                        content.copy(location = updatedLocation(content.location, key, value))
                }
            _state.value = EditBusinessPageUiState.Loaded(EditBusinessPageMapper.withRecomputedMode(next))
        }

        /**
         * Applies an address-component edit while leaving the other
         * components untouched — the street line never absorbs the locality.
         */
        private fun updatedLocation(
            location: EditBusinessPageLocation,
            key: EditBusinessPageFieldKey,
            value: String,
        ): EditBusinessPageLocation =
            location.copy(
                address =
                    if (key == EditBusinessPageFieldKey.Address) {
                        location.address.copy(current = value)
                    } else {
                        location.address
                    },
                city =
                    if (key == EditBusinessPageFieldKey.City) {
                        location.city.copy(current = value)
                    } else {
                        location.city
                    },
                state =
                    if (key == EditBusinessPageFieldKey.State) {
                        location.state.copy(current = value)
                    } else {
                        location.state
                    },
                zip =
                    if (key == EditBusinessPageFieldKey.Zip) {
                        location.zip.copy(current = value)
                    } else {
                        location.zip
                    },
                error = null,
            )

        fun beginDescriptionEditing() {
            val current = _state.value as? EditBusinessPageUiState.Loaded ?: return
            if (current.content.description !is EditBusinessPageDescriptionState.Prompt) return
            val next =
                current.content.copy(
                    description =
                        EditBusinessPageDescriptionState.Field(
                            field = EditBusinessPageField(original = "", current = ""),
                            charLimit = 600,
                        ),
                )
            _state.value = EditBusinessPageUiState.Loaded(EditBusinessPageMapper.withRecomputedMode(next))
        }

        fun save() {
            viewModelScope.launch { persist(successToast = "Saved") }
        }

        fun saveDraft() {
            viewModelScope.launch { persist(successToast = "Draft saved") }
        }

        fun publish() {
            viewModelScope.launch {
                val current = _state.value as? EditBusinessPageUiState.Loaded ?: return@launch
                if (localPreviewPersistenceEnabled) {
                    _toast.value = "Published"
                    return@launch
                }
                val mode = current.content.mode
                if (mode is EditBusinessPageMode.Setup && mode.remaining > 0) {
                    _toast.value = "Finish the remaining sections before publishing."
                    return@launch
                }
                if (!persist(successToast = null)) return@launch
                when (val result = businesses.publishBusiness(businessId)) {
                    is NetworkResult.Success -> {
                        _toast.value = "Published"
                        fetch(showLoading = false)
                    }
                    is NetworkResult.Failure -> {
                        _toast.value = result.error.message
                    }
                }
            }
        }

        fun discardRequested() {
            _showsDiscardConfirm.value = true
        }

        fun cancelDiscard() {
            _showsDiscardConfirm.value = false
        }

        fun discardConfirmed() {
            val current = _state.value as? EditBusinessPageUiState.Loaded ?: return
            _state.value =
                EditBusinessPageUiState.Loaded(
                    EditBusinessPageMapper.withRecomputedMode(revertToOriginal(current.content)),
                )
            _showsDiscardConfirm.value = false
            _toast.value = "Edits discarded"
        }

        fun dismissToast() {
            _toast.value = null
        }

        private suspend fun fetch(showLoading: Boolean) {
            if (showLoading) _state.value = EditBusinessPageUiState.Loading
            when (val detailResult = businesses.business(businessId)) {
                is NetworkResult.Failure -> {
                    _state.value =
                        if (detailResult.error is NetworkError.NotFound) {
                            EditBusinessPageUiState.Empty
                        } else {
                            EditBusinessPageUiState.Error(detailResult.error.message)
                        }
                    hasLoadedOnce = false
                }
                is NetworkResult.Success -> applyDetail(detailResult.data)
            }
        }

        private suspend fun applyDetail(detail: BusinessDetailResponse) {
            if (detail.access?.hasAccess != true) {
                _state.value = EditBusinessPageUiState.Error(NO_ACCESS_MESSAGE)
                hasLoadedOnce = false
                return
            }
            val location =
                detail.profile?.primaryLocation
                    ?: detail.locations.firstOrNull { it.isPrimary == true }
                    ?: detail.locations.firstOrNull()
            primaryLocationId = location?.id
            loadedSocialLinks = EditBusinessPageMapper.stringMap(detail.profile?.socialLinks)
            loadedAttributes = detail.profile?.attributes.orEmpty()
            loadedPhoneHadCountryCode =
                detail.profile?.publicPhone.orEmpty().trim().startsWith(COUNTRY_CODE_PREFIX)

            var hours = fetchHours(location?.id)
            // Owner-scoped catalog first. `/public/:username` 404s until the
            // profile is published, so deriving Services from it alone left
            // the setup checklist permanently short one item and made publish
            // unreachable for every unpublished business.
            var catalog = fetchOwnerCatalog()
            val publicPayload = fetchPublicPayload(detail.business.username)
            if (publicPayload != null) {
                if (catalog == null) catalog = publicPayload.catalog
                if (hours.isEmpty()) hours = publicPayload.hours
            }

            _state.value =
                EditBusinessPageUiState.Loaded(
                    EditBusinessPageMapper.content(detail, hours, catalog.orEmpty()),
                )
            hasLoadedOnce = true
        }

        /** Owner/staff catalog read; `null` when the call didn't answer. */
        private suspend fun fetchOwnerCatalog(): List<BusinessCatalogItemDto>? =
            when (val result = businesses.catalogItems(businessId)) {
                is NetworkResult.Success -> result.data.items
                is NetworkResult.Failure -> null
            }

        private suspend fun fetchHours(locationId: String?): List<BusinessHoursDto> {
            if (locationId == null) return emptyList()
            return when (val result = businesses.locationHours(businessId, locationId)) {
                is NetworkResult.Success -> result.data.hours
                is NetworkResult.Failure -> emptyList()
            }
        }

        /** Public payload folds in hours + catalog; a failure is not fatal. */
        private suspend fun fetchPublicPayload(username: String?): BusinessPublicResponse? {
            if (username.isNullOrBlank()) return null
            return when (val result = businesses.publicBusiness(username)) {
                is NetworkResult.Success -> result.data
                is NetworkResult.Failure -> null
            }
        }

        private suspend fun persist(successToast: String?): Boolean {
            val content = (_state.value as? EditBusinessPageUiState.Loaded)?.content ?: return false
            if (localPreviewPersistenceEnabled) return persistLocally(content, successToast)
            val block = saveBlock(content)
            if (block != null) {
                applySaveBlock(content, block)
                return false
            }
            // Single-flight: a second tap while a save is in flight is a no-op.
            return !isSaving && runSave(content, successToast)
        }

        private fun persistLocally(
            content: EditBusinessPageContent,
            successToast: String?,
        ): Boolean {
            _state.value = EditBusinessPageUiState.Loaded(promoteCurrentToOriginal(content))
            if (successToast != null) _toast.value = successToast
            return true
        }

        /** Reason the save can't be attempted, or null when it can. */
        private fun saveBlock(content: EditBusinessPageContent): SaveBlock? {
            if (isMediaOnlyEdit(content)) return SaveBlock.Toast(MEDIA_ONLY_MESSAGE)
            return addressBlock(content) ?: offlineBlock()
        }

        private fun isMediaOnlyEdit(content: EditBusinessPageContent): Boolean =
            hasUnresolvedMediaDirty(content) &&
                EditBusinessPageMapper.unsavedCount(content) == mediaDirtyCount(content)

        /** Address problems also paint the field inline, so they stay typed. */
        private fun addressBlock(content: EditBusinessPageContent): SaveBlock.Address? {
            EditBusinessPageMapper.locationValidationError(content.location)?.let {
                return SaveBlock.Address(it)
            }
            if (content.location.hasAddressEdits && primaryLocationId == null) {
                return SaveBlock.Address(NO_LOCATION_MESSAGE)
            }
            return null
        }

        private fun offlineBlock(): SaveBlock? = if (networkMonitor.isOnline.value) null else SaveBlock.Toast(OFFLINE_MESSAGE)

        private fun applySaveBlock(
            content: EditBusinessPageContent,
            block: SaveBlock,
        ) {
            if (block is SaveBlock.Address) {
                _state.value =
                    EditBusinessPageUiState.Loaded(
                        content.copy(location = content.location.copy(error = block.message)),
                    )
            }
            _toast.value = block.message
        }

        private suspend fun runSave(
            content: EditBusinessPageContent,
            successToast: String?,
        ): Boolean {
            isSaving = true
            try {
                val failure = pushProfile(content) ?: pushLocation(content) ?: pushHours(content)
                if (failure != null) {
                    _toast.value = failure
                    return false
                }
                _state.value =
                    EditBusinessPageUiState.Loaded(
                        EditBusinessPageMapper.withRecomputedMode(savedContent(content)),
                    )
                if (successToast != null) _toast.value = successToast
                return true
            } finally {
                isSaving = false
            }
        }

        /** Each `push…` returns the message to surface, or null on success. */
        private suspend fun pushProfile(content: EditBusinessPageContent): String? {
            val patch = buildPatch(content)
            if (!patchHasValues(patch)) return null
            return when (val result = businesses.updateBusiness(businessId, patch)) {
                is NetworkResult.Failure -> result.error.message
                is NetworkResult.Success -> {
                    rememberSavedPatch(patch)
                    null
                }
            }
        }

        private suspend fun pushLocation(content: EditBusinessPageContent): String? {
            if (!content.location.hasAddressEdits) return null
            val locationId = primaryLocationId ?: return NO_LOCATION_MESSAGE
            return failureMessage(
                businesses.updateLocation(
                    businessId,
                    locationId,
                    EditBusinessPageMapper.locationPayload(content.location),
                ),
            )
        }

        private suspend fun pushHours(content: EditBusinessPageContent): String? {
            val body = EditBusinessPageMapper.hoursPayload(content.hours) ?: return null
            val locationId = primaryLocationId ?: return null
            return failureMessage(
                businesses.setLocationHours(businessId, locationId, SetBusinessHoursRequest(body)),
            )
        }

        private fun <T> failureMessage(result: NetworkResult<T>): String? =
            when (result) {
                is NetworkResult.Failure -> result.error.message
                is NetworkResult.Success -> null
            }

        /**
         * Re-bases the merge sources on what the server now stores, so a
         * second save in the same session doesn't re-send a stale jsonb
         * object and resurrect keys the first save removed.
         */
        private fun rememberSavedPatch(patch: UpdateBusinessRequest) {
            patch.socialLinks?.let { loadedSocialLinks = it }
            patch.attributes?.let { loadedAttributes = it }
            patch.publicPhone?.let {
                loadedPhoneHadCountryCode = it.trim().startsWith(COUNTRY_CODE_PREFIX)
            }
        }

        /** Saved state, keeping the media dirt the save couldn't clear. */
        private fun savedContent(content: EditBusinessPageContent): EditBusinessPageContent {
            var cleaned = promoteCurrentToOriginal(content)
            val banner = content.banner
            if (banner is EditBusinessPageBannerState.Filled && banner.dirty) {
                cleaned = cleaned.copy(banner = banner)
            }
            if (content.gallery.freshAddTile) {
                cleaned = cleaned.copy(gallery = content.gallery)
            }
            return cleaned
        }

        private fun buildPatch(content: EditBusinessPageContent): UpdateBusinessRequest {
            var request = UpdateBusinessRequest()
            if (content.name.isDirty) {
                request = request.copy(name = content.name.current.trim())
            }
            if (content.tagline.isDirty) {
                request = request.copy(tagline = content.tagline.current)
            }
            if (content.category.isDirty) {
                request =
                    request.copy(
                        categories =
                            content.category.current
                                .split("·")
                                .map { it.trim() }
                                .filter { it.isNotEmpty() },
                    )
            }
            val desc = content.description
            if (desc is EditBusinessPageDescriptionState.Field && desc.field.isDirty) {
                request = request.copy(description = desc.field.current)
            }
            if (content.phone.isDirty) {
                request =
                    request.copy(
                        publicPhone =
                            EditBusinessPageMapper.restorePhonePrefix(
                                content.phone.current,
                                loadedPhoneHadCountryCode,
                            ),
                    )
            }
            if (content.email.isDirty) {
                request = request.copy(publicEmail = content.email.current)
            }
            if (content.website.isDirty) {
                request = request.copy(website = EditBusinessPageMapper.normalizeWebsite(content.website.current))
            }
            val booking = content.bookingLink
            if (booking != null && booking.isDirty) {
                request =
                    request.copy(
                        socialLinks =
                            EditBusinessPageMapper.mergedSocialLinks(
                                existing = loadedSocialLinks,
                                booking = EditBusinessPageMapper.normalizeWebsite(booking.current),
                            ),
                    )
            }
            if (content.price.isDirty) {
                request =
                    request.copy(
                        attributes =
                            EditBusinessPageMapper.mergedAttributes(
                                existing = loadedAttributes,
                                priceLevel = content.price.current,
                            ),
                    )
            }
            return request
        }

        private fun patchHasValues(patch: UpdateBusinessRequest): Boolean =
            patch.name != null ||
                patch.tagline != null ||
                patch.description != null ||
                patch.categories != null ||
                patch.publicEmail != null ||
                patch.publicPhone != null ||
                patch.website != null ||
                patch.socialLinks != null ||
                patch.attributes != null ||
                patch.isPublished != null

        private fun hasUnresolvedMediaDirty(content: EditBusinessPageContent): Boolean {
            val banner = content.banner
            if (banner is EditBusinessPageBannerState.Filled && banner.dirty) return true
            return content.gallery.freshAddTile
        }

        private fun mediaDirtyCount(content: EditBusinessPageContent): Int {
            var count = 0
            val banner = content.banner
            if (banner is EditBusinessPageBannerState.Filled && banner.dirty) count++
            if (content.gallery.freshAddTile) count++
            return count
        }

        private fun promoteCurrentToOriginal(content: EditBusinessPageContent): EditBusinessPageContent =
            content.copy(
                mode = zeroUnsaved(content.mode),
                banner = content.banner.cleaned(),
                name = content.name.cleaned(),
                tagline = content.tagline.cleaned(),
                category = content.category.cleaned(),
                price = content.price.cleaned(),
                description = content.description.cleaned(),
                hours = content.hours.cleaned(),
                services = content.services.cleaned(),
                gallery = content.gallery.cleaned(),
                phone = content.phone.cleaned(),
                email = content.email.cleaned(),
                website = content.website.cleaned(),
                bookingLink = content.bookingLink?.cleaned(),
                location = content.location.cleaned(),
            )

        private fun revertToOriginal(content: EditBusinessPageContent): EditBusinessPageContent =
            content.copy(
                mode = zeroUnsaved(content.mode),
                banner = content.banner.cleaned(),
                name = content.name.reverted(),
                tagline = content.tagline.reverted(),
                category = content.category.reverted(),
                price = content.price.reverted(),
                description = content.description.reverted(),
                hours = content.hours.cleaned(),
                services = content.services.cleaned(),
                gallery = content.gallery.cleaned(),
                phone = content.phone.reverted(),
                email = content.email.reverted(),
                website = content.website.reverted(),
                bookingLink = content.bookingLink?.reverted(),
                location = content.location.reverted(),
            )

        private fun zeroUnsaved(mode: EditBusinessPageMode): EditBusinessPageMode =
            when (mode) {
                is EditBusinessPageMode.Published -> mode.copy(unsavedCount = 0)
                is EditBusinessPageMode.Setup -> mode
            }
    }

private fun EditBusinessPageField.cleaned(): EditBusinessPageField =
    EditBusinessPageField(original = current, current = current, placeholder = placeholder)

private fun EditBusinessPageField.reverted(): EditBusinessPageField =
    EditBusinessPageField(original = original, current = original, placeholder = placeholder)

private fun EditBusinessPageBannerState.cleaned(): EditBusinessPageBannerState =
    when (this) {
        EditBusinessPageBannerState.Empty -> this
        is EditBusinessPageBannerState.Filled -> copy(dirty = false)
    }

private fun EditBusinessPageDescriptionState.cleaned(): EditBusinessPageDescriptionState =
    when (this) {
        is EditBusinessPageDescriptionState.Field -> copy(field = field.cleaned())
        is EditBusinessPageDescriptionState.Prompt -> this
    }

private fun EditBusinessPageDescriptionState.reverted(): EditBusinessPageDescriptionState =
    when (this) {
        is EditBusinessPageDescriptionState.Field -> copy(field = field.reverted())
        is EditBusinessPageDescriptionState.Prompt -> this
    }

private fun EditBusinessPageHoursState.cleaned(): EditBusinessPageHoursState =
    when (this) {
        is EditBusinessPageHoursState.Rows -> copy(rows = rows.map { it.copy(isDirty = false) })
        is EditBusinessPageHoursState.QuickApply -> this
    }

private fun EditBusinessPageServicesState.cleaned(): EditBusinessPageServicesState =
    when (this) {
        is EditBusinessPageServicesState.Chips -> copy(chips = chips.map { it.copy(isFresh = false) })
        is EditBusinessPageServicesState.Prompt -> this
    }

private fun EditBusinessPageGalleryState.cleaned(): EditBusinessPageGalleryState = copy(freshAddTile = false)

private fun EditBusinessPageLocation.cleaned(): EditBusinessPageLocation =
    copy(
        address = address.cleaned(),
        city = city.cleaned(),
        state = state.cleaned(),
        zip = zip.cleaned(),
        error = null,
        pinDirty = false,
    )

private fun EditBusinessPageLocation.reverted(): EditBusinessPageLocation =
    copy(
        address = address.reverted(),
        city = city.reverted(),
        state = state.reverted(),
        zip = zip.reverted(),
        error = null,
        pinDirty = false,
    )
