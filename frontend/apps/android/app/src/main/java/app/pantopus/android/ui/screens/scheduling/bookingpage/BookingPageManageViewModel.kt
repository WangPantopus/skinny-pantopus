@file:Suppress("PackageNaming", "TooManyFunctions", "LongMethod", "CyclomaticComplexMethod", "ReturnCount")

package app.pantopus.android.ui.screens.scheduling.bookingpage

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.scheduling.BookingPageDto
import app.pantopus.android.data.api.models.scheduling.EventTypeDto
import app.pantopus.android.data.api.models.scheduling.UpdateBookingPageRequest
import app.pantopus.android.data.api.models.scheduling.UpdateEventTypeRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.scheduling.SchedulingError
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
import app.pantopus.android.data.scheduling.SchedulingOwner
import app.pantopus.android.data.scheduling.SchedulingRepository
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingRoutes
import app.pantopus.android.ui.screens.scheduling._shared.pillar
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.util.Locale
import javax.inject.Inject

/** The three publish states the status card switches between. */
enum class PageStatus { Draft, Live, Paused }

/** A bookable service row in the visibility card (mirrors an event type's `visibility`). */
data class ServiceToggleItem(
    val id: String,
    val name: String,
    val durationLabel: String,
    val locationMode: String?,
    val visible: Boolean,
)

/** The staged, editable booking-page form. Committed as a batch on Save. */
data class BookingPageForm(
    val pageId: String,
    val status: PageStatus,
    val slug: String,
    val title: String,
    val tagline: String,
    val intro: String,
    val confirmation: String,
    val listed: Boolean,
    val services: List<ServiceToggleItem>,
    val avatarInitials: String,
    val firstEventTypeId: String?,
)

/** Live availability of the edited slug. */
data class SlugCheckState(
    val checking: Boolean = false,
    val available: Boolean? = null,
    val taken: Boolean = false,
    val suggestions: List<String> = emptyList(),
)

sealed interface BookingPageManageUiState {
    data object Loading : BookingPageManageUiState

    /** H16 — day-one: no page set up / no services yet. CTA routes to the wizard. */
    data object NeedsSetup : BookingPageManageUiState

    data class Loaded(val form: BookingPageForm) : BookingPageManageUiState

    data class Error(val message: String) : BookingPageManageUiState
}

@HiltViewModel
class BookingPageManageViewModel
    @Inject
    constructor(
        private val repo: SchedulingRepository,
        private val errors: SchedulingErrorDecoder,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        // Owner comes from the route's ownerKind/ownerId query args (survives
        // process death and deep links); absent args mean Personal. This screen
        // SAVES against the owner (updateSlug/updateBookingPage), so a wrong
        // default would overwrite the personal page from a Business hub.
        private val owner: SchedulingOwner =
            SchedulingOwner.fromRoute(
                savedStateHandle[SchedulingRoutes.ARG_OWNER_KIND],
                savedStateHandle[SchedulingRoutes.ARG_OWNER_ID],
            )

        /** The resolved pillar for UI accent — derived from owner at init time. */
        val pillar: SchedulingPillar = owner.pillar()

        private val _state = MutableStateFlow<BookingPageManageUiState>(BookingPageManageUiState.Loading)
        val state: StateFlow<BookingPageManageUiState> = _state.asStateFlow()

        private val _slugCheck = MutableStateFlow(SlugCheckState())
        val slugCheck: StateFlow<SlugCheckState> = _slugCheck.asStateFlow()

        private val _saving = MutableStateFlow(false)
        val saving: StateFlow<Boolean> = _saving.asStateFlow()

        private val _toast = MutableStateFlow<String?>(null)
        val toast: StateFlow<String?> = _toast.asStateFlow()

        private var original: BookingPageForm? = null
        private var slugJob: Job? = null

        fun load() {
            _state.value = BookingPageManageUiState.Loading
            viewModelScope.launch {
                val pageDef = async { repo.getBookingPage(owner) }
                val typesDef = async { repo.getEventTypes(owner) }
                val pageResult = pageDef.await()
                val page =
                    when (pageResult) {
                        is NetworkResult.Success -> pageResult.data.page
                        is NetworkResult.Failure -> {
                            _state.value = BookingPageManageUiState.Error(message(pageResult.error))
                            return@launch
                        }
                    }
                // A FAILED event-types fetch must surface Error + retry — folding
                // it into an empty list would misclassify a configured account as
                // needs-setup on any transient network blip.
                val typesResult = typesDef.await()
                val types =
                    when (typesResult) {
                        is NetworkResult.Success -> typesResult.data.eventTypes
                        is NetworkResult.Failure -> {
                            _state.value = BookingPageManageUiState.Error(message(typesResult.error))
                            return@launch
                        }
                    }
                if (types.isEmpty() && !page.isLive) {
                    _state.value = BookingPageManageUiState.NeedsSetup
                    return@launch
                }
                val form = page.toForm(types)
                original = form
                _slugCheck.value = SlugCheckState(available = true)
                _state.value = BookingPageManageUiState.Loaded(form)
            }
        }

        fun refresh() = load()

        // ─── Edits ──────────────────────────────────────────────────────────

        private fun update(transform: (BookingPageForm) -> BookingPageForm) {
            val current = (_state.value as? BookingPageManageUiState.Loaded)?.form ?: return
            _state.value = BookingPageManageUiState.Loaded(transform(current))
        }

        fun setTitle(value: String) = update { it.copy(title = value, avatarInitials = initialsOf(value)) }

        fun setTagline(value: String) = update { it.copy(tagline = value) }

        fun setIntro(value: String) = update { it.copy(intro = value) }

        fun setConfirmation(value: String) = update { it.copy(confirmation = value) }

        fun setListed(listed: Boolean) = update { it.copy(listed = listed) }

        fun toggleStatus() =
            update {
                it.copy(
                    status =
                        when (it.status) {
                            PageStatus.Live -> PageStatus.Paused
                            PageStatus.Paused -> PageStatus.Live
                            PageStatus.Draft -> PageStatus.Live
                        },
                )
            }

        fun toggleService(id: String) =
            update { form ->
                form.copy(services = form.services.map { if (it.id == id) it.copy(visible = !it.visible) else it })
            }

        fun setSlug(value: String) {
            val cleaned = value.lowercase(Locale.US).filter { it.isLetterOrDigit() || it == '-' }
            update { it.copy(slug = cleaned) }
            if (cleaned == original?.slug) {
                slugJob?.cancel()
                _slugCheck.value = SlugCheckState(available = true)
                return
            }
            if (cleaned.length < SLUG_MIN) {
                slugJob?.cancel()
                _slugCheck.value = SlugCheckState(available = false)
                return
            }
            slugJob?.cancel()
            slugJob =
                viewModelScope.launch {
                    _slugCheck.value = SlugCheckState(checking = true)
                    delay(SLUG_DEBOUNCE_MS)
                    when (val r = repo.checkSlug(owner, cleaned)) {
                        is NetworkResult.Success ->
                            _slugCheck.value =
                                SlugCheckState(
                                    available = r.data.available,
                                    taken = !r.data.available,
                                    suggestions = r.data.suggestions,
                                )
                        is NetworkResult.Failure ->
                            _slugCheck.value = SlugCheckState(available = null)
                    }
                }
        }

        fun pickSuggestedSlug(slug: String) = setSlug(slug)

        // ─── Save ───────────────────────────────────────────────────────────

        val isDirty: Boolean
            get() = (_state.value as? BookingPageManageUiState.Loaded)?.form != original

        fun canSave(): Boolean {
            val form = (_state.value as? BookingPageManageUiState.Loaded)?.form ?: return false
            val orig = original ?: return false
            val slugOk = form.slug == orig.slug || (form.slug.length >= SLUG_MIN && !_slugCheck.value.taken)
            return form != orig && slugOk && !_saving.value
        }

        fun save() {
            val form = (_state.value as? BookingPageManageUiState.Loaded)?.form ?: return
            val orig = original ?: return
            if (!canSave()) return
            _saving.value = true
            viewModelScope.launch {
                if (form.slug != orig.slug) {
                    when (val r = repo.updateSlug(owner, form.slug)) {
                        is NetworkResult.Success -> Unit
                        is NetworkResult.Failure -> {
                            val decoded = errors.decode(r.error)
                            if (decoded is SchedulingError.SlugTaken) {
                                _slugCheck.value = SlugCheckState(available = false, taken = true, suggestions = decoded.suggestions)
                            } else {
                                _toast.value = "Couldn't save your link"
                            }
                            _saving.value = false
                            return@launch
                        }
                    }
                }
                val body =
                    UpdateBookingPageRequest(
                        title = form.title,
                        tagline = form.tagline,
                        intro = form.intro,
                        confirmationMessage = form.confirmation,
                        visibility = if (form.listed) VISIBILITY_LISTED else VISIBILITY_UNLISTED,
                        isLive = form.status != PageStatus.Draft,
                        isPaused = form.status == PageStatus.Paused,
                    )
                when (repo.updateBookingPage(owner, body)) {
                    is NetworkResult.Success -> Unit
                    is NetworkResult.Failure -> {
                        _toast.value = "Couldn't save changes"
                        _saving.value = false
                        return@launch
                    }
                }
                val changedServices = form.services.filter { svc -> orig.services.firstOrNull { it.id == svc.id }?.visible != svc.visible }
                var serviceError = false
                changedServices.forEach { svc ->
                    val body2 = UpdateEventTypeRequest(visibility = if (svc.visible) EVENT_VISIBLE else EVENT_HIDDEN)
                    if (repo.updateEventType(owner, svc.id, body2) is NetworkResult.Failure) serviceError = true
                }
                _saving.value = false
                _toast.value = if (serviceError) "Saved — some services didn't update" else "Saved"
                load()
            }
        }

        /** Danger: mint a fresh slug (invalidates the old public link). */
        fun regenerateLink() {
            _saving.value = true
            viewModelScope.launch {
                val result = repo.resetSlug(owner)
                _saving.value = false
                when (result) {
                    is NetworkResult.Success -> {
                        _toast.value = "New link ready"
                        load()
                    }
                    is NetworkResult.Failure -> _toast.value = "Couldn't regenerate the link"
                }
            }
        }

        fun flashToast(message: String) {
            _toast.value = message
        }

        fun consumeToast() {
            _toast.value = null
        }

        // ─── Navigation routes (carry this screen's owner onward) ───────────

        /** Manage → owner-side preview keeps the same owner context. */
        fun previewRoute(): String = SchedulingRoutes.publicPagePreview(owner.routeKind, owner.ownerRouteId)

        /** Fallback link into the owner's event-type catalog. */
        fun eventTypesRoute(): String = SchedulingRoutes.eventTypeList(owner.routeKind, owner.ownerRouteId)

        private fun message(error: app.pantopus.android.data.api.net.NetworkError): String =
            when (val decoded = errors.decode(error)) {
                is SchedulingError.Generic -> decoded.message
                else -> "We couldn't load your booking link."
            }

        private fun BookingPageDto.toForm(types: List<EventTypeDto>): BookingPageForm {
            val status =
                when {
                    !isLive -> PageStatus.Draft
                    isPaused -> PageStatus.Paused
                    else -> PageStatus.Live
                }
            val name = title.orEmpty()
            return BookingPageForm(
                pageId = id,
                status = status,
                slug = slug.orEmpty(),
                title = name,
                tagline = tagline.orEmpty(),
                intro = intro.orEmpty(),
                confirmation = confirmationMessage.orEmpty(),
                listed = (visibility ?: VISIBILITY_LISTED) == VISIBILITY_LISTED,
                services = types.map { it.toToggleItem() },
                avatarInitials = initialsOf(name),
                firstEventTypeId = types.firstOrNull()?.id,
            )
        }

        private fun EventTypeDto.toToggleItem(): ServiceToggleItem =
            ServiceToggleItem(
                id = id,
                name = name,
                durationLabel = "${defaultDuration ?: durations.firstOrNull() ?: 0} min",
                locationMode = locationMode,
                visible = (visibility ?: EVENT_VISIBLE) == EVENT_VISIBLE,
            )

        private companion object {
            const val SLUG_DEBOUNCE_MS = 400L
            const val SLUG_MIN = 3
            const val VISIBILITY_LISTED = "listed"
            const val VISIBILITY_UNLISTED = "unlisted"
            const val EVENT_VISIBLE = "public"
            const val EVENT_HIDDEN = "secret"
        }
    }

/** First-letter initials (up to two) for the avatar. */
internal fun initialsOf(name: String): String {
    val parts = name.trim().split(Regex("\\s+")).filter { it.isNotEmpty() }
    return when {
        parts.isEmpty() -> "?"
        parts.size == 1 -> parts[0].take(2).uppercase(Locale.US)
        else -> (parts[0].take(1) + parts[1].take(1)).uppercase(Locale.US)
    }
}

/** Lucide-ish icon for an event type's location mode. */
internal fun serviceIcon(locationMode: String?): app.pantopus.android.ui.theme.PantopusIcon =
    when (locationMode) {
        "video" -> app.pantopus.android.ui.theme.PantopusIcon.Video
        "phone" -> app.pantopus.android.ui.theme.PantopusIcon.Phone
        "in_person" -> app.pantopus.android.ui.theme.PantopusIcon.MapPin
        else -> app.pantopus.android.ui.theme.PantopusIcon.Calendar
    }
