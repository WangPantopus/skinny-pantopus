@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "TooManyFunctions")

package app.pantopus.android.ui.screens.homes.emergency

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.homes.CreateEmergencyRequest
import app.pantopus.android.data.api.models.homes.HomeEmergencyDto
import app.pantopus.android.data.api.models.homes.OccupantDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomeMembersRepository
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.ui.screens.shared.form.FormFieldState
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.Instant
import javax.inject.Inject

/** Nav-arg key for the home id. */
const val ADD_EMERGENCY_HOME_ID_KEY = "homeId"

/** Nav-arg key for an optional emergency id (edit mode). */
const val ADD_EMERGENCY_ITEM_ID_KEY = "emergencyId"

/**
 * Snapshot of an emergency item used to seed the form in edit mode and
 * surfaced back on commit so the detail screen can re-render. Mirrors
 * `EmergencyFormDraft.swift` on iOS.
 */
data class EmergencyFormDraft(
    val id: String,
    val category: EmergencyFormCategory,
    val title: String,
    val severity: EmergencySeverity?,
    val details: String,
    val verifiedByUserId: String?,
    val lastUpdated: Instant,
) {
    companion object {
        /**
         * Build a draft from a backend DTO. Returns `null` when the
         * DTO's type doesn't map to one of the seven form categories
         * (legacy list-of-rows types like `shutoff_water` aren't
         * editable through this form).
         */
        fun from(dto: HomeEmergencyDto): EmergencyFormDraft? {
            val category = EmergencyFormCategory.fromType(dto.type) ?: return null
            return EmergencyFormDraft(
                id = dto.id,
                category = category,
                title = dto.label,
                severity = EmergencySeverity.fromValue(dto.details?.get("severity")),
                details = dto.details?.get("detail").orEmpty(),
                verifiedByUserId = dto.details?.get("verified_by"),
                lastUpdated = parseInstant(dto.updatedAt) ?: parseInstant(dto.createdAt) ?: Instant.now(),
            )
        }

        private fun parseInstant(iso: String?): Instant? =
            try {
                iso?.let { Instant.parse(it) }
            } catch (_: Throwable) {
                null
            }
    }
}

/** Aggregate UI state for the Add Emergency Info form. */
data class AddEmergencyInfoUiState(
    val mode: Mode = Mode.Create,
    val category: EmergencyFormCategory = EmergencyFormCategory.Other,
    val severity: EmergencySeverity? = null,
    val verifiedByUserId: String? = null,
    val titleField: FormFieldState = FormFieldState(id = "title"),
    val detailsField: FormFieldState = FormFieldState(id = "details"),
    val members: List<OccupantDto> = emptyList(),
    val isSaving: Boolean = false,
    val toast: EmergencyToast? = null,
    val shouldDismiss: Boolean = false,
) {
    sealed interface Mode {
        data object Create : Mode

        data class Edit(val draft: EmergencyFormDraft) : Mode
    }

    val isValid: Boolean
        get() =
            titleField.value.trim().isNotEmpty() &&
                titleField.error == null &&
                detailsField.error == null

    val isDirty: Boolean
        get() {
            return when (mode) {
                is Mode.Create ->
                    titleField.value.trim().isNotEmpty() ||
                        detailsField.value.isNotEmpty() ||
                        severity != null ||
                        verifiedByUserId != null ||
                        category != EmergencyFormCategory.Other
                is Mode.Edit -> {
                    val draft = mode.draft
                    titleField.isDirty ||
                        detailsField.isDirty ||
                        category != draft.category ||
                        severity != draft.severity ||
                        verifiedByUserId != draft.verifiedByUserId
                }
            }
        }

    /** Resolved verified-by display label, when the picker has loaded. */
    fun verifiedByLabel(): String? =
        verifiedByUserId?.let { uid ->
            members
                .firstOrNull { it.userId == uid }
                ?.let { it.displayName ?: it.username }
        }
}

/** Tone + text payload the form turns into a snackbar / toast. */
data class EmergencyToast(
    val text: String,
    val isError: Boolean,
)

/**
 * P2.8 — Add / Edit Emergency Info form view-model. Mirrors the iOS
 * `AddEmergencyInfoFormViewModel`. On submit:
 *   create → `POST /api/homes/:id/emergencies` (route
 *            `backend/routes/home.js:5650`).
 *   edit   → local commit; backend has no PUT handler yet.
 */
@HiltViewModel
class AddEmergencyInfoFormViewModel
    @Inject
    constructor(
        private val homesRepo: HomesRepository,
        private val membersRepo: HomeMembersRepository,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        private val homeId: String =
            checkNotNull(savedStateHandle.get<String>(ADD_EMERGENCY_HOME_ID_KEY)) {
                "AddEmergencyInfoFormViewModel requires a $ADD_EMERGENCY_HOME_ID_KEY nav argument"
            }

        /**
         * Optional nav arg: when present the form opens in edit mode
         * and seeds itself from the parent list (no GET-by-id route).
         */
        private val editEmergencyId: String? =
            savedStateHandle.get<String>(ADD_EMERGENCY_ITEM_ID_KEY)

        private val _state = MutableStateFlow(AddEmergencyInfoUiState())
        val state: StateFlow<AddEmergencyInfoUiState> = _state.asStateFlow()

        private var onCreated: (HomeEmergencyDto) -> Unit = {}
        private var onUpdated: (EmergencyFormDraft) -> Unit = {}

        init {
            // Auto-seed for edit mode by fetching the parent list and
            // finding the row by id.
            editEmergencyId?.let { id -> viewModelScope.launch { seedFromList(id) } }
        }

        /**
         * Wire navigation callbacks.
         */
        fun configure(
            editDraft: EmergencyFormDraft? = null,
            onCreated: (HomeEmergencyDto) -> Unit = {},
            onUpdated: (EmergencyFormDraft) -> Unit = {},
        ) {
            this.onCreated = onCreated
            this.onUpdated = onUpdated
            // An explicit draft from a non-nav caller (legacy / tests)
            // overrides the nav-arg seed.
            if (editDraft != null) {
                applyEditSeed(editDraft)
            }
        }

        private suspend fun seedFromList(id: String) {
            when (val result = homesRepo.getHomeEmergencies(homeId)) {
                is NetworkResult.Success -> {
                    val dto = result.data.emergencies.firstOrNull { it.id == id } ?: return
                    EmergencyFormDraft.from(dto)?.let { applyEditSeed(it) }
                }
                is NetworkResult.Failure -> Unit
            }
        }

        private fun applyEditSeed(draft: EmergencyFormDraft) {
            _state.update { current ->
                current.copy(
                    mode = AddEmergencyInfoUiState.Mode.Edit(draft),
                    category = draft.category,
                    severity = draft.severity,
                    verifiedByUserId = draft.verifiedByUserId,
                    titleField =
                        FormFieldState(id = "title", value = draft.title, originalValue = draft.title),
                    detailsField =
                        FormFieldState(
                            id = "details",
                            value = draft.details,
                            originalValue = draft.details,
                        ),
                )
            }
        }

        // MARK: - Field updates

        fun setCategory(category: EmergencyFormCategory) {
            _state.update { current ->
                val nextSeverity = if (category.supportsSeverity) current.severity else null
                current.copy(category = category, severity = nextSeverity)
            }
        }

        fun setSeverity(severity: EmergencySeverity?) {
            _state.update { it.copy(severity = severity) }
        }

        fun setVerifiedBy(userId: String?) {
            _state.update { it.copy(verifiedByUserId = userId) }
        }

        fun updateTitle(value: String) {
            _state.update { current ->
                val snapshot =
                    current.titleField.copy(
                        value = value,
                        touched = true,
                        error = validateTitle(value),
                    )
                current.copy(titleField = snapshot)
            }
        }

        fun updateDetails(value: String) {
            _state.update { current ->
                val snapshot =
                    current.detailsField.copy(
                        value = value,
                        touched = true,
                        error = validateDetails(value),
                    )
                current.copy(detailsField = snapshot)
            }
        }

        fun dismissToast() {
            _state.update { it.copy(toast = null) }
        }

        fun acknowledgeDismiss() {
            _state.update { it.copy(shouldDismiss = false) }
        }

        // MARK: - Members

        fun loadMembers() {
            if (_state.value.members.isNotEmpty()) return
            viewModelScope.launch {
                when (val result = membersRepo.listOccupants(homeId)) {
                    is NetworkResult.Success ->
                        _state.update {
                            it.copy(members = result.data.occupants.filter { occupant -> occupant.isActive })
                        }
                    is NetworkResult.Failure ->
                        // Verified-by is optional — silently swallow.
                        Unit
                }
            }
        }

        // MARK: - Submit

        fun submit() {
            val invalid = validateAll()
            if (invalid != null) {
                _state.update { it.copy(toast = EmergencyToast("Fix the highlighted fields.", isError = true)) }
                return
            }
            val current = _state.value
            if (!current.isDirty || !current.isValid) return

            when (val mode = current.mode) {
                AddEmergencyInfoUiState.Mode.Create -> submitCreate()
                is AddEmergencyInfoUiState.Mode.Edit -> submitEdit(mode.draft)
            }
        }

        /**
         * Compose the backend `details` map. Public so tests can lock
         * the serialisation contract without standing up the network
         * layer.
         */
        fun buildDetailsMap(): Map<String, String> {
            val current = _state.value
            val out = mutableMapOf<String, String>()
            val trimmedDetail = current.detailsField.value.trim()
            if (trimmedDetail.isNotEmpty()) out["detail"] = trimmedDetail
            current.severity?.let { out["severity"] = it.id }
            current.verifiedByUserId?.takeIf { it.isNotEmpty() }?.let { out["verified_by"] = it }
            return out
        }

        // MARK: - Private

        private fun submitCreate() {
            _state.update { it.copy(isSaving = true) }
            viewModelScope.launch {
                val current = _state.value
                val request =
                    CreateEmergencyRequest(
                        type = current.category.backendType,
                        label = current.titleField.value.trim(),
                        location = null,
                        details = buildDetailsMap().takeIf { it.isNotEmpty() },
                    )
                when (val result = homesRepo.createHomeEmergency(homeId, request)) {
                    is NetworkResult.Success -> {
                        onCreated(result.data.emergency)
                        _state.update {
                            it.copy(
                                isSaving = false,
                                toast = EmergencyToast("Saved.", isError = false),
                                shouldDismiss = true,
                            )
                        }
                    }
                    is NetworkResult.Failure ->
                        _state.update {
                            it.copy(
                                isSaving = false,
                                toast = EmergencyToast(result.error.message ?: "Couldn't save.", isError = true),
                            )
                        }
                }
            }
        }

        private fun submitEdit(originalDraft: EmergencyFormDraft) {
            // Backend has no PUT handler today — commit locally and
            // surface the new draft to the parent navigator.
            val current = _state.value
            val draft =
                EmergencyFormDraft(
                    id = originalDraft.id,
                    category = current.category,
                    title = current.titleField.value.trim(),
                    severity = current.severity,
                    details = current.detailsField.value,
                    verifiedByUserId = current.verifiedByUserId,
                    lastUpdated = Instant.now(),
                )
            onUpdated(draft)
            _state.update {
                it.copy(
                    toast = EmergencyToast("Saved.", isError = false),
                    shouldDismiss = true,
                )
            }
        }

        private fun validateAll(): String? {
            var firstError: String? = null
            _state.update { current ->
                val title =
                    current.titleField.copy(
                        touched = true,
                        error = validateTitle(current.titleField.value),
                    )
                val details =
                    current.detailsField.copy(
                        touched = true,
                        error = validateDetails(current.detailsField.value),
                    )
                if (firstError == null) firstError = title.error ?: details.error
                current.copy(titleField = title, detailsField = details)
            }
            return firstError
        }

        companion object {
            fun validateTitle(value: String): String? {
                val trimmed = value.trim()
                if (trimmed.isEmpty()) return "Title is required."
                if (trimmed.length > 255) return "Title is too long."
                return null
            }

            fun validateDetails(value: String): String? {
                if (value.length > 2000) return "Details are too long."
                return null
            }
        }
    }
