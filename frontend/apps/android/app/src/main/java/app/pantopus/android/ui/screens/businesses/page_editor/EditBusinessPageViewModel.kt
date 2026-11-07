@file:Suppress("PackageNaming", "TooManyFunctions", "MagicNumber", "LargeClass")

package app.pantopus.android.ui.screens.businesses.page_editor

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.businesses.BusinessAccessDto
import app.pantopus.android.data.api.models.businesses.BusinessCatalogItemDto
import app.pantopus.android.data.api.models.businesses.BusinessDetailResponse
import app.pantopus.android.data.api.models.businesses.BusinessHoursDto
import app.pantopus.android.data.api.models.businesses.BusinessPermission
import app.pantopus.android.data.api.models.businesses.BusinessPublicResponse
import app.pantopus.android.data.api.models.businesses.SetBusinessHoursRequest
import app.pantopus.android.data.api.models.businesses.UpdateBusinessRequest
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.businesses.BusinessTeamRepository
import app.pantopus.android.data.businesses.BusinessesRepository
import app.pantopus.android.data.network.NetworkMonitor
import app.pantopus.android.data.upload.UploadFile
import app.pantopus.android.data.upload.UploadRepository
import app.pantopus.android.ui.screens.businesses.BusinessAccessCheck
import app.pantopus.android.ui.screens.businesses.BusinessAccessState
import app.pantopus.android.ui.screens.businesses.canEditHours
import app.pantopus.android.ui.screens.businesses.canManageCatalog
import app.pantopus.android.ui.screens.businesses.canUsePageEditor
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimSessionScopeFactory
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.util.UUID
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
private const val LOAD_CHECK_FAILED = "Couldn't check edit access. Please try again."
private const val ACCESS_CHECK_FAILED = "Couldn't check edit access. Your changes are kept. Retry to continue."
private const val SESSION_CHANGED = "Your session changed. Reopen the business to continue."
private const val NO_PROFILE_ACCESS = "You don't have permission to edit this business's profile. Your changes are kept."
private const val NO_LOCATION_ACCESS = "You don't have permission to edit this business's location. Your changes are kept."
private const val NO_HOURS_ACCESS = "You don't have permission to edit business hours. Your changes are kept."
private const val WRITE_REFUSED = "You don't have permission to make this change. Your changes are kept."
private const val NO_CATALOG_ACCESS = "You don't have permission to manage this catalog."
private const val CATALOG_CHECK_FAILED = "Couldn't check catalog access. Please try again."
private const val OWNER_ONLY_CLOSE = "Only an owner can close this business."
private const val CLOSE_CHECK_FAILED = "Couldn't check your access, so the business wasn't closed. Please try again."

private const val OFFLINE_MESSAGE = "You're offline. Try again when you're back online."
private const val MAX_WEEKLY_HOURS_ROWS = 7
private const val TOO_MANY_HOURS_MESSAGE =
    "A week can hold 7 sets of hours, and this one has more. Mark a day with two sets as closed to save. Your edits are kept."
private val WEEKEND_DAY_LABELS = setOf("Sun", "Sat")

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
 *
 * Current access comes from `GET /:businessId/me`, asked on entry, on every
 * return and before a save, publish, upload or close, as on iOS. While access
 * is off the draft stays on screen, locked, with a notice that offers a retry.
 */
@HiltViewModel
class EditBusinessPageViewModel
    @Inject
    constructor(
        savedStateHandle: SavedStateHandle,
        private val businesses: BusinessesRepository,
        private val networkMonitor: NetworkMonitor,
        private val uploads: UploadRepository,
        private val team: BusinessTeamRepository,
        sessions: HomeClaimSessionScopeFactory,
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

        /** The banner or logo being uploaded, if any; one at a time. */
        private val _uploadingMedia = MutableStateFlow<EditBusinessMediaKind?>(null)
        val uploadingMedia: StateFlow<EditBusinessMediaKind?> = _uploadingMedia.asStateFlow()

        private val _access = MutableStateFlow(EditBusinessPageAccess(isChecking = true))
        val access: StateFlow<EditBusinessPageAccess> = _access.asStateFlow()

        private val _showsCatalog = MutableStateFlow(false)
        val showsCatalog: StateFlow<Boolean> = _showsCatalog.asStateFlow()

        private val session = sessions.create(viewModelScope)
        private val accessCheck = BusinessAccessCheck(viewModelScope, { team.access(businessId) }, ::applyAccess)
        private var loadGeneration = 0
        private var isOpeningCatalog = false

        private val _isClosing = MutableStateFlow(false)
        val isClosing: StateFlow<Boolean> = _isClosing.asStateFlow()
        private val _closeError = MutableStateFlow<String?>(null)
        val closeError: StateFlow<String?> = _closeError.asStateFlow()
        private val _businessClosed = MutableStateFlow(false)
        val businessClosed: StateFlow<Boolean> = _businessClosed.asStateFlow()

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
        private var savedHours: EditBusinessPageHoursState? = null

        fun prepareClosure() {
            _closeError.value = null
        }

        fun closeBusiness() {
            // Not tied to the last answer: a failed check clears it, and the dialog's retry has to survive that.
            if (_isClosing.value || _state.value !is EditBusinessPageUiState.Loaded) return
            if (isSaving || _uploadingMedia.value != null) {
                _closeError.value = "Wait for the current save or upload to finish, then try again."
                return
            }
            _isClosing.value = true
            _closeError.value = null
            viewModelScope.launch {
                val refusal = closeRefusal()
                if (refusal != null) {
                    _closeError.value = refusal
                    _isClosing.value = false
                    return@launch
                }
                when (val result = businesses.closeBusiness(businessId)) {
                    is NetworkResult.Success -> _businessClosed.value = true
                    is NetworkResult.Failure -> {
                        _closeError.value = result.error.displayMessage("Couldn't close the business. Please try again.")
                        _isClosing.value = false
                    }
                }
            }
        }

        /** Every arrival: the first load, or a fresh check of what's allowed that keeps the draft on screen. */
        fun resume() {
            if (localPreviewPersistenceEnabled) return
            if (hasLoadedOnce && _state.value is EditBusinessPageUiState.Loaded) {
                retryAccess()
            } else {
                refresh()
            }
        }

        /** The screen left or the app went away: what was allowed no longer counts, and no late reply can restore it. */
        fun pause() {
            if (localPreviewPersistenceEnabled) return
            loadGeneration++
            accessCheck.forget()
        }

        fun refresh() {
            if (localPreviewPersistenceEnabled) return
            viewModelScope.launch { fetch(showLoading = true) }
        }

        fun retryAccess() {
            if (localPreviewPersistenceEnabled) return
            viewModelScope.launch { accessCheck.confirm() }
        }

        /** Test-only: seed the loaded state directly. */
        fun seedForPreview(content: EditBusinessPageContent) {
            savedHours = content.hours
            localPreviewPersistenceEnabled = true
            hasLoadedOnce = true
            _access.value = EditBusinessPageAccess.Full
            _state.value = EditBusinessPageUiState.Loaded(content)
        }

        private fun applyAccess(state: BusinessAccessState) {
            val current = _access.value
            // A toast held back behind the notice is out of date once the notice goes.
            if (current.notice != null) _toast.value = null
            _access.value =
                when (state) {
                    BusinessAccessState.Unknown, BusinessAccessState.Checking -> current.copy(isChecking = true, notice = null)
                    is BusinessAccessState.Known -> accessFrom(state.access)
                    BusinessAccessState.Refused -> EditBusinessPageAccess(notice = NO_ACCESS_MESSAGE)
                    BusinessAccessState.Failed -> EditBusinessPageAccess(notice = ACCESS_CHECK_FAILED)
                }
        }

        private fun accessFrom(access: BusinessAccessDto): EditBusinessPageAccess =
            EditBusinessPageAccess(
                canEditProfile = access.allows(BusinessPermission.PROFILE_EDIT),
                canEditLocation = access.allows(BusinessPermission.LOCATIONS_EDIT),
                canEditHours = access.canEditHours,
                canManageCatalog = access.canManageCatalog,
                canClose = access.hasAccess && access.isOwner,
                notice = NO_ACCESS_MESSAGE.takeUnless { access.canUsePageEditor },
            )

        /** What the server says now, or null when it refused, the read failed or the session changed. */
        private suspend fun currentAccess(): BusinessAccessDto? =
            (accessCheck.confirm() as? BusinessAccessState.Known)?.access?.takeIf { session.isCurrent }

        private fun accessFailure(): String = if (session.isCurrent) _access.value.notice ?: ACCESS_CHECK_FAILED else SESSION_CHANGED

        private fun showAccessNotice(message: String) {
            _toast.value = null
            _access.value = _access.value.copy(notice = message)
        }

        private suspend fun closeRefusal(): String? {
            val answer = accessCheck.confirm()
            return when {
                !session.isCurrent -> SESSION_CHANGED
                answer is BusinessAccessState.Known -> OWNER_ONLY_CLOSE.takeUnless { answer.access.isOwner }
                answer == BusinessAccessState.Refused -> OWNER_ONLY_CLOSE
                else -> CLOSE_CHECK_FAILED
            }
        }

        /** Reuses the catalog manager without leaving unsaved profile fields, after asking whether it's still allowed. */
        fun openCatalog() {
            if (isOpeningCatalog || isSaving) return
            isOpeningCatalog = true
            viewModelScope.launch {
                val access = currentAccess()
                when {
                    access == null -> _toast.value = CATALOG_CHECK_FAILED
                    access.canManageCatalog -> _showsCatalog.value = true
                    else -> _toast.value = NO_CATALOG_ACCESS
                }
                isOpeningCatalog = false
            }
        }

        fun closeCatalog() {
            _showsCatalog.value = false
            reloadServices()
        }

        fun updateHoursDay(
            id: String,
            value: EditBusinessPageHoursRow.State,
        ) {
            changeHours { rows -> EditBusinessPageMapper.withRowHours(rows, savedHours?.rows.orEmpty(), id, value) }
        }

        fun applyWeekdayHours() {
            changeHours { rows ->
                rows.map { row ->
                    row.copy(
                        state =
                            if (row.dayLabel !in WEEKEND_DAY_LABELS) {
                                EditBusinessPageHoursRow.State.Open(
                                    "9:00 AM",
                                    "5:00 PM",
                                )
                            } else {
                                EditBusinessPageHoursRow.State.Closed
                            },
                        isDirty = true,
                    )
                }
            }
        }

        private fun changeHours(transform: (List<EditBusinessPageHoursRow>) -> List<EditBusinessPageHoursRow>) {
            val access = _access.value
            if (isSaving || access.isChecking || !access.canEditHours) return
            if (!localPreviewPersistenceEnabled && primaryLocationId == null) {
                _toast.value = "Add a business location before setting hours."
                return
            }
            val current = (_state.value as? EditBusinessPageUiState.Loaded)?.content ?: return
            val rows =
                when (val hours = current.hours) {
                    is EditBusinessPageHoursState.Rows -> hours.rows
                    is EditBusinessPageHoursState.QuickApply -> hours.rows
                }
            val next =
                current.copy(
                    hours =
                        EditBusinessPageHoursState.Rows(
                            transform(rows),
                            "Tap a day to edit its hours. Save to apply your changes.",
                        ),
                )
            _state.value = EditBusinessPageUiState.Loaded(EditBusinessPageMapper.withRecomputedMode(next))
        }

        fun reloadServices() {
            viewModelScope.launch {
                when (val result = businesses.catalogItems(businessId)) {
                    is NetworkResult.Success -> {
                        val current = (_state.value as? EditBusinessPageUiState.Loaded)?.content ?: return@launch
                        val next = current.copy(services = EditBusinessPageMapper.mapServices(result.data.items))
                        _state.value = EditBusinessPageUiState.Loaded(EditBusinessPageMapper.withRecomputedMode(next))
                    }
                    is NetworkResult.Failure ->
                        _toast.value = result.error.displayMessage("Couldn't refresh services. Open services to try again.")
                }
            }
        }

        fun update(
            key: EditBusinessPageFieldKey,
            value: String,
        ) {
            if (!canChange(key)) return
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
                    EditBusinessPageFieldKey.Suite,
                    EditBusinessPageFieldKey.City,
                    EditBusinessPageFieldKey.State,
                    EditBusinessPageFieldKey.Zip,
                    ->
                        content.copy(location = updatedLocation(content.location, key, value))
                }
            _state.value = EditBusinessPageUiState.Loaded(EditBusinessPageMapper.withRecomputedMode(next))
        }

        private fun canChange(key: EditBusinessPageFieldKey): Boolean {
            val access = _access.value
            val allowed =
                when (key) {
                    EditBusinessPageFieldKey.Address,
                    EditBusinessPageFieldKey.Suite,
                    EditBusinessPageFieldKey.City,
                    EditBusinessPageFieldKey.State,
                    EditBusinessPageFieldKey.Zip,
                    -> access.canEditLocation
                    else -> access.canEditProfile
                }
            return allowed && !isSaving && !access.isChecking
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
                suite =
                    if (key == EditBusinessPageFieldKey.Suite) {
                        location.suite.copy(current = value)
                    } else {
                        location.suite
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
            if (_access.value.isChecking || !_access.value.canEditProfile) return
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
                if (current.content.missingPublishRequirements > 0) {
                    _toast.value = "Add a business name and category before publishing."
                    return@launch
                }
                if (!persist(successToast = null)) return@launch
                val access = currentAccess()
                if (access == null) {
                    showAccessNotice(accessFailure())
                    return@launch
                }
                if (!access.allows(BusinessPermission.PROFILE_EDIT)) {
                    showAccessNotice(NO_PROFILE_ACCESS)
                    return@launch
                }
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
            // A save in flight sends the draft it started with; discarding now would leave it saved anyway.
            if (isSaving) return
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

        /**
         * Upload a picked banner or logo. The server writes it onto the
         * business profile itself, so it shows as saved (not a pending edit).
         */
        fun uploadMedia(
            kind: EditBusinessMediaKind,
            bytes: ByteArray,
            mimeType: String,
        ) {
            if (_uploadingMedia.value != null || _state.value !is EditBusinessPageUiState.Loaded) return
            _uploadingMedia.value = kind
            viewModelScope.launch {
                val access = currentAccess()
                if (access == null || !access.allows(BusinessPermission.PROFILE_EDIT)) {
                    showAccessNotice(if (access == null) accessFailure() else NO_PROFILE_ACCESS)
                    _uploadingMedia.value = null
                    return@launch
                }
                // Randomised name, as in the create wizard: the picker's file
                // name never reaches storage or access logs.
                val file =
                    UploadFile(
                        filename = "business-${kind.apiType}-${UUID.randomUUID().toString().take(8)}.${extensionFor(mimeType)}",
                        mimeType = mimeType,
                        bytes = bytes,
                    )
                when (val result = uploads.uploadBusinessMedia(businessId, kind.apiType, file)) {
                    is NetworkResult.Success -> {
                        (_state.value as? EditBusinessPageUiState.Loaded)?.let { current ->
                            val next = withUploadedMedia(current.content, kind, result.data.url)
                            _state.value = EditBusinessPageUiState.Loaded(EditBusinessPageMapper.withRecomputedMode(next))
                        }
                        _toast.value = if (kind == EditBusinessMediaKind.Banner) "Banner updated." else "Logo updated."
                    }
                    is NetworkResult.Failure ->
                        _toast.value = "Couldn't upload the ${kind.apiType}. ${result.error.message}"
                }
                _uploadingMedia.value = null
            }
        }

        private suspend fun fetch(showLoading: Boolean) {
            val request = ++loadGeneration
            if (showLoading) _state.value = EditBusinessPageUiState.Loading
            val (detailResult, answer) =
                coroutineScope {
                    val accessRead = async { accessCheck.confirm() }
                    businesses.business(businessId) to accessRead.await()
                }
            if (request != loadGeneration) return
            if (detailResult is NetworkResult.Failure && detailResult.error is NetworkError.NotFound) {
                _state.value = EditBusinessPageUiState.Empty
                hasLoadedOnce = false
                return
            }
            val access = (answer as? BusinessAccessState.Known)?.access
            when {
                !session.isCurrent -> showLoadError(SESSION_CHANGED)
                answer == BusinessAccessState.Failed -> showLoadError(LOAD_CHECK_FAILED)
                access == null || !access.canUsePageEditor -> showLoadError(NO_ACCESS_MESSAGE)
                detailResult is NetworkResult.Failure -> showLoadError(detailResult.error.message)
                detailResult is NetworkResult.Success -> applyDetail(detailResult.data, access, request)
            }
        }

        private fun showLoadError(message: String) {
            _state.value = EditBusinessPageUiState.Error(message)
            hasLoadedOnce = false
        }

        private suspend fun applyDetail(
            detail: BusinessDetailResponse,
            access: BusinessAccessDto,
            request: Int,
        ) {
            if (detail.access?.hasAccess != true) {
                showLoadError(NO_ACCESS_MESSAGE)
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

            // Hours come only from this location's own read: the public payload holds every location's,
            // and saving a week built from it, or from nothing, would replace what is saved. Someone who can't
            // read them sees an empty section they can't edit (`canEditHours`); the refusal doesn't close the editor.
            val hours = if (access.allows(BusinessPermission.HOURS_VIEW)) fetchHours(location?.id) else emptyList()
            // Owner-scoped catalog first. `/public/:username` 404s until the
            // profile is published, so deriving Services from it alone left
            // the setup checklist permanently short one item and made publish
            // unreachable for every unpublished business.
            var catalog = if (access.allows(BusinessPermission.CATALOG_VIEW)) fetchOwnerCatalog() else emptyList()
            val publicPayload = fetchPublicPayload(detail.business.username)
            if (publicPayload != null) {
                if (catalog == null) catalog = publicPayload.catalog
            }

            if (request != loadGeneration) return
            if (hours == null || catalog == null) {
                showLoadError("Couldn't load business hours and services. Please try again.")
                return
            }

            val content = EditBusinessPageMapper.content(detail, hours, catalog)
            savedHours = content.hours
            _state.value = EditBusinessPageUiState.Loaded(content)
            hasLoadedOnce = true
        }

        /** Owner/staff catalog read; `null` when the call didn't answer. */
        private suspend fun fetchOwnerCatalog(): List<BusinessCatalogItemDto>? =
            when (val result = businesses.catalogItems(businessId)) {
                is NetworkResult.Success -> result.data.items
                is NetworkResult.Failure -> null
            }

        private suspend fun fetchHours(locationId: String?): List<BusinessHoursDto>? {
            if (locationId == null) return emptyList()
            return when (val result = businesses.locationHours(businessId, locationId)) {
                is NetworkResult.Success -> result.data.hours
                is NetworkResult.Failure -> null
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
            val saved = promoteCurrentToOriginal(content)
            savedHours = saved.hours
            _state.value = EditBusinessPageUiState.Loaded(saved)
            if (successToast != null) _toast.value = successToast
            return true
        }

        /** Reason the save can't be attempted, or null when it can. */
        private fun saveBlock(content: EditBusinessPageContent): SaveBlock? {
            if (isMediaOnlyEdit(content)) return SaveBlock.Toast(MEDIA_ONLY_MESSAGE)
            return addressBlock(content) ?: hoursBlock(content) ?: offlineBlock()
        }

        /** The hours API takes at most 7 rows, so a longer week can't be saved until it shrinks. */
        private fun hoursBlock(content: EditBusinessPageContent): SaveBlock? {
            val rows = EditBusinessPageMapper.hoursPayload(content.hours)?.size ?: 0
            return if (rows > MAX_WEEKLY_HOURS_ROWS) SaveBlock.Toast(TOO_MANY_HOURS_MESSAGE) else null
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
                saveRefusal(content)?.let { refusal ->
                    showAccessNotice(refusal)
                    return false
                }
                val failure =
                    sessionFailure() ?: pushProfile(content)
                        ?: sessionFailure() ?: pushLocation(content)
                        ?: sessionFailure() ?: pushHours(content)
                if (failure != null) {
                    _toast.value = failure
                    return false
                }
                val saved = savedContent(content)
                _state.value =
                    EditBusinessPageUiState.Loaded(
                        EditBusinessPageMapper.withRecomputedMode(saved.copy(hours = savedHours ?: saved.hours)),
                    )
                if (successToast != null) _toast.value = successToast
                return true
            } finally {
                isSaving = false
            }
        }

        /**
         * Asks the server first, and refuses the whole save if any changed section is no longer allowed, so no part of
         * it goes out and the draft stays. Null when it can go ahead.
         */
        private suspend fun saveRefusal(content: EditBusinessPageContent): String? {
            val access = currentAccess() ?: return accessFailure()
            return when {
                patchHasValues(buildPatch(content)) && !access.allows(BusinessPermission.PROFILE_EDIT) -> NO_PROFILE_ACCESS
                content.location.hasAddressEdits && !access.allows(BusinessPermission.LOCATIONS_EDIT) -> NO_LOCATION_ACCESS
                EditBusinessPageMapper.hoursPayload(content.hours) != null && !access.canEditHours -> NO_HOURS_ACCESS
                else -> null
            }
        }

        private fun sessionFailure(): String? = SESSION_CHANGED.takeUnless { session.isCurrent }

        /** Refused after the check said yes: the draft stays, and the screen learns what's allowed now. */
        private fun writeFailure(error: NetworkError): String {
            if (error !is NetworkError.Forbidden) return error.message
            retryAccess()
            return WRITE_REFUSED
        }

        /** Each `push…` returns the message to surface, or null on success. */
        private suspend fun pushProfile(content: EditBusinessPageContent): String? {
            val patch = buildPatch(content)
            if (!patchHasValues(patch)) return null
            return when (val result = businesses.updateBusiness(businessId, patch)) {
                is NetworkResult.Failure -> writeFailure(result.error)
                is NetworkResult.Success -> {
                    rememberSavedPatch(patch)
                    null
                }
            }
        }

        private suspend fun pushLocation(content: EditBusinessPageContent): String? {
            if (!content.location.hasAddressEdits) return null
            val locationId = primaryLocationId ?: return NO_LOCATION_MESSAGE
            val result =
                businesses.updateLocation(
                    businessId,
                    locationId,
                    EditBusinessPageMapper.locationPayload(content.location),
                )
            val refusal =
                ((result as? NetworkResult.Failure)?.error as? NetworkError.ClientError)
                    ?.takeIf { it.code == 409 || it.code == 422 }
                    ?: return failureMessage(result)
            // The address check refused it: the reason also stays under Address, and the edits stay.
            (_state.value as? EditBusinessPageUiState.Loaded)?.let { loaded ->
                _state.value =
                    EditBusinessPageUiState.Loaded(
                        loaded.content.copy(location = loaded.content.location.copy(error = refusal.message)),
                    )
            }
            return refusal.message
        }

        private suspend fun pushHours(content: EditBusinessPageContent): String? {
            val body = EditBusinessPageMapper.hoursPayload(content.hours) ?: return null
            val locationId = primaryLocationId ?: return "Add a business location before setting hours."
            return when (val result = businesses.setLocationHours(businessId, locationId, SetBusinessHoursRequest(body))) {
                is NetworkResult.Failure -> writeFailure(result.error)
                is NetworkResult.Success -> {
                    // Later edits compare with, and send back, what the server now holds.
                    val saved = result.data.hours
                    savedHours = if (saved.isEmpty()) content.hours.cleaned() else EditBusinessPageMapper.mapHours(saved)
                    null
                }
            }
        }

        private fun <T> failureMessage(result: NetworkResult<T>): String? =
            when (result) {
                is NetworkResult.Failure -> writeFailure(result.error)
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

        private fun revertToOriginal(content: EditBusinessPageContent): EditBusinessPageContent =
            content.copy(
                mode = zeroUnsaved(content.mode),
                banner = content.banner.cleaned(),
                name = content.name.reverted(),
                tagline = content.tagline.reverted(),
                category = content.category.reverted(),
                price = content.price.reverted(),
                description = content.description.reverted(),
                hours = savedHours ?: content.hours.cleaned(),
                services = content.services.cleaned(),
                gallery = content.gallery.cleaned(),
                phone = content.phone.reverted(),
                email = content.email.reverted(),
                website = content.website.reverted(),
                bookingLink = content.bookingLink?.reverted(),
                location = content.location.reverted(),
            )
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

private fun zeroUnsaved(mode: EditBusinessPageMode): EditBusinessPageMode =
    when (mode) {
        is EditBusinessPageMode.Published -> mode.copy(unsavedCount = 0)
        is EditBusinessPageMode.Setup -> mode
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
        suite = suite.cleaned(),
        city = city.cleaned(),
        state = state.cleaned(),
        zip = zip.cleaned(),
        error = null,
        pinDirty = false,
    )

private fun EditBusinessPageLocation.reverted(): EditBusinessPageLocation =
    copy(
        address = address.reverted(),
        suite = suite.reverted(),
        city = city.reverted(),
        state = state.reverted(),
        zip = zip.reverted(),
        error = null,
        pinDirty = false,
    )

/** The content with a freshly uploaded image, already saved on the server. */
private fun withUploadedMedia(
    content: EditBusinessPageContent,
    kind: EditBusinessMediaKind,
    url: String,
): EditBusinessPageContent =
    when (kind) {
        EditBusinessMediaKind.Banner ->
            content.copy(banner = EditBusinessPageBannerState.Filled(dirty = false, imageUrl = url))
        EditBusinessMediaKind.Logo ->
            content.copy(
                logo = EditBusinessPageLogoState.Filled(initial = content.name.original.take(1).uppercase(), imageUrl = url),
            )
    }

private fun extensionFor(mimeType: String): String =
    when (mimeType.lowercase()) {
        "image/png" -> "png"
        "image/webp" -> "webp"
        "image/heic", "image/heif" -> "heic"
        else -> "jpg"
    }
