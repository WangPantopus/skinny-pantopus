@file:Suppress("PackageNaming", "TooManyFunctions")

package app.pantopus.android.ui.screens.scheduling.packages

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.scheduling.CreatePackageRequest
import app.pantopus.android.data.api.models.scheduling.PackageDto
import app.pantopus.android.data.api.models.scheduling.UpdatePackageRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.scheduling.SchedulingError
import app.pantopus.android.data.scheduling.SchedulingErrorDecoder
import app.pantopus.android.data.scheduling.SchedulingFeatureFlags
import app.pantopus.android.data.scheduling.SchedulingOwner
import app.pantopus.android.data.scheduling.SchedulingRepository
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingRoutes
import app.pantopus.android.ui.screens.scheduling._shared.pillar
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/** Credit-expiry window (design's `Segmented`). View-only — no `expiry` column. */
enum class PackageExpiry(val label: String) {
    NinetyDays("90 days"),
    OneYear("1 year"),
    Never("Never"),
}

/** A selectable "redeems against" event type tile. */
data class EventTypeOption(
    val id: String,
    val name: String,
    val durationLabel: String,
)

/** The editable G9 form. */
data class PackageEditorForm(
    val name: String = "",
    val description: String = "",
    val sessionsCount: Int = DEFAULT_SESSIONS,
    val priceText: String = "",
    val selectedEventTypeId: String? = null,
    val expiry: PackageExpiry = PackageExpiry.OneYear,
    val isActive: Boolean = true,
    val nameError: Boolean = false,
) {
    val isValid: Boolean get() = name.trim().isNotEmpty() && sessionsCount >= 1

    /** Dirty-tracking key — excludes the transient [nameError]. */
    fun key() = copy(nameError = false)

    companion object {
        const val DEFAULT_SESSIONS = 5
    }
}

/** G9 Create / Edit Package UI state. */
sealed interface PackageEditorUiState {
    data object Loading : PackageEditorUiState

    data object ComingSoon : PackageEditorUiState

    data class Error(val message: String) : PackageEditorUiState

    data class Content(
        val form: PackageEditorForm,
        val eventTypes: List<EventTypeOption>,
        val isEditing: Boolean,
        val saving: Boolean,
        val isDirty: Boolean,
        val pillar: SchedulingPillar,
        /**
         * True when the package has active credit holders (sold_count > 0).
         * Sessions and Redeems-against tiles are read-only in this state (design
         * Frame 4 — "has active buyers" locked state).
         */
        val locked: Boolean = false,
    ) : PackageEditorUiState {
        val isValid: Boolean get() = form.isValid
    }
}

/**
 * G9 Create / Edit Package (owner) — Stream A15. One scrolling form with live
 * per-session math: name, eligible event type, sessions, price, active. Wires
 * `POST /packages` (create) and `PUT /packages/:id` (edit). Behind
 * [SchedulingFeatureFlags]. Mirrors iOS `PackageEditorViewModel` /
 * `createpackage-frames.jsx`.
 *
 * Backend note: the packages table has no `description` or `expiry` column
 * (`POST /packages` accepts name/sessions_count/price_cents/currency/
 * event_type_id/is_active only) and `event_type_id` is a single uuid
 * (null = all services). The design's Description/Expiry cards + multi-select
 * tiles are therefore not persisted and stay view-only (flagged for a backend
 * follow-up). Price 0 is a valid free package server-side, so price > 0 is not
 * enforced.
 */
@HiltViewModel
class PackageEditorViewModel
    @Inject
    constructor(
        savedStateHandle: SavedStateHandle,
        private val repo: SchedulingRepository,
        private val auth: AuthRepository,
        private val errors: SchedulingErrorDecoder,
        private val flags: SchedulingFeatureFlags,
        private val ownerRelay: PackagesOwnerRelay,
    ) : ViewModel() {
        private val packageId: String =
            savedStateHandle.get<String>(
                SchedulingRoutes.ARG_PACKAGE_ID,
            ).orEmpty()
        private val isEditing: Boolean = packageId.isNotBlank() && packageId != NEW_PACKAGE_ID

        private val _state = MutableStateFlow<PackageEditorUiState>(PackageEditorUiState.Loading)
        val state: StateFlow<PackageEditorUiState> = _state.asStateFlow()

        /** One-shot transient message (save failures). */
        private val _toast = MutableStateFlow<String?>(null)
        val toast: StateFlow<String?> = _toast.asStateFlow()

        private var owner: SchedulingOwner = SchedulingOwner.Personal
        private var form = PackageEditorForm()
        private var snapshot = PackageEditorForm()
        private var eventTypes: List<EventTypeOption> = emptyList()
        private var saving = false
        private var started = false

        /** True when the package has sold credits (sessions/eligibility locked). */
        private var hasActiveBuyers = false

        fun start() {
            if (started) return
            started = true
            owner = ownerRelay.consume() ?: resolveOwner()
            load()
        }

        fun load() {
            viewModelScope.launch {
                if (!flags.paidSchedulingEnabled) {
                    _state.value = PackageEditorUiState.ComingSoon
                    return@launch
                }
                _state.value = PackageEditorUiState.Loading
                // Event types power the "redeems against" tiles — best-effort.
                eventTypes =
                    (repo.getEventTypes(owner) as? NetworkResult.Success)?.data?.eventTypes
                        ?.filter { it.isActive != false }
                        ?.map {
                            EventTypeOption(
                                it.id,
                                it.name,
                                durationLabel(it.defaultDuration ?: it.durations.firstOrNull()),
                            )
                        }
                        ?: emptyList()

                if (isEditing) {
                    when (val result = repo.getPackages(owner)) {
                        is NetworkResult.Success -> {
                            val pkg = result.data.packages.firstOrNull { it.id == packageId }
                            if (pkg == null) {
                                _state.value =
                                    PackageEditorUiState.Error(
                                        "That package no longer exists.",
                                    )
                                return@launch
                            }
                            hasActiveBuyers = (pkg.soldCount ?: 0) > 0
                            form = seed(pkg)
                        }
                        is NetworkResult.Failure -> {
                            _state.value =
                                PackageEditorUiState.Error(
                                    errors.decode(result.error).message(),
                                )
                            return@launch
                        }
                    }
                }
                snapshot = form
                pushContent()
            }
        }

        // ─── Field edits ─────────────────────────────────────────────────────────

        fun onName(value: String) = update { it.copy(name = value, nameError = false) }

        fun onDescription(value: String) = update { it.copy(description = value) }

        fun onSessions(value: Int) = update { it.copy(sessionsCount = value.coerceIn(1, MAX_SESSIONS)) }

        fun onPrice(value: String) = update { it.copy(priceText = value) }

        fun selectEventType(id: String?) =
            update {
                it.copy(selectedEventTypeId = if (it.selectedEventTypeId == id) null else id)
            }

        fun onExpiry(value: PackageExpiry) = update { it.copy(expiry = value) }

        fun onActive(value: Boolean) = update { it.copy(isActive = value) }

        // ─── Save ────────────────────────────────────────────────────────────────

        fun save(onDone: () -> Unit) {
            if (!form.isValid) {
                update { it.copy(nameError = it.name.trim().isEmpty()) }
                return
            }
            saving = true
            pushContent()
            viewModelScope.launch {
                val priceCents = PackagesMoney.parseCents(form.priceText) ?: 0
                val name = form.name.trim()
                val result =
                    if (isEditing) {
                        repo.updatePackage(
                            owner,
                            packageId,
                            UpdatePackageRequest(
                                name = name,
                                sessionsCount = form.sessionsCount,
                                priceCents = priceCents,
                                currency = CURRENCY,
                                eventTypeId = form.selectedEventTypeId,
                                isActive = form.isActive,
                            ),
                        )
                    } else {
                        repo.createPackage(
                            owner,
                            CreatePackageRequest(
                                name = name,
                                sessionsCount = form.sessionsCount,
                                priceCents = priceCents,
                                currency = CURRENCY,
                                eventTypeId = form.selectedEventTypeId,
                                isActive = form.isActive,
                            ),
                        )
                    }
                saving = false
                when (result) {
                    is NetworkResult.Success -> {
                        snapshot = form
                        onDone()
                    }
                    is NetworkResult.Failure -> {
                        val decoded = errors.decode(result.error)
                        if (decoded is SchedulingError.Validation && decoded.details.any { it.field == "name" }) {
                            update { it.copy(nameError = true) }
                        } else {
                            pushContent()
                        }
                        _toast.value = decoded.message()
                    }
                }
            }
        }

        fun toastConsumed() {
            _toast.value = null
        }

        // ─── Helpers ───────────────────────────────────────────────────────────────

        private inline fun update(transform: (PackageEditorForm) -> PackageEditorForm) {
            form = transform(form)
            pushContent()
        }

        private fun pushContent() {
            _state.value =
                PackageEditorUiState.Content(
                    form = form,
                    eventTypes = eventTypes,
                    isEditing = isEditing,
                    saving = saving,
                    isDirty = form.key() != snapshot.key(),
                    pillar = owner.pillar(),
                    locked = hasActiveBuyers,
                )
        }

        private fun seed(pkg: PackageDto): PackageEditorForm =
            PackageEditorForm(
                name = pkg.name,
                sessionsCount = (pkg.sessionsCount).coerceAtLeast(1),
                priceText =
                    pkg.priceCents.takeIf { it > 0 }
                        ?.let { String.format(java.util.Locale.US, "%.2f", it / CENTS_PER_UNIT) }
                        ?: "",
                selectedEventTypeId = pkg.eventTypeId,
                isActive = pkg.isActive ?: true,
            )

        private fun durationLabel(minutes: Int?): String = if (minutes != null && minutes > 0) "$minutes min" else ""

        private fun resolveOwner(): SchedulingOwner =
            (auth.state.value as? AuthRepository.State.SignedIn)?.user?.id
                ?.let { SchedulingOwner.Business(it) }
                ?: SchedulingOwner.Personal

        private fun SchedulingError.message(): String =
            when (this) {
                is SchedulingError.Generic -> message
                is SchedulingError.Secret -> "Only the owner can edit packages."
                else -> "Couldn't save the package."
            }

        companion object {
            const val NEW_PACKAGE_ID = "new"
            private const val MAX_SESSIONS = 1000
            private const val CURRENCY = "USD"
            private const val CENTS_PER_UNIT = 100.0
        }
    }
