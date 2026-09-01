@file:Suppress("PackageNaming", "MagicNumber", "TooManyFunctions")

package app.pantopus.android.ui.screens.homes.guests

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.homes.CreateGuestPassRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomeGuestPassesRepository
import app.pantopus.android.ui.components.ChipPickerOption
import app.pantopus.android.ui.screens.shared.form.FormFieldState
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.ZoneId
import java.time.temporal.TemporalAdjusters
import javax.inject.Inject

/** Nav-arg key for the home id consumed via [SavedStateHandle]. */
const val ADD_GUEST_HOME_ID_KEY = "homeId"

/** Tone + text payload the form turns into a transient toast. */
data class GuestToast(
    val text: String,
    val isError: Boolean,
)

/**
 * Aggregate UI state for the Add Guest form. Mirrors iOS
 * `AddGuestFormViewModel`'s exposed state: name / contact / welcome are
 * tracked as [FormFieldState]s, duration is a single-select chip id, and
 * allowed-areas is a set of chip ids.
 */
data class AddGuestUiState(
    val homeTitle: String = "",
    val homeSubtitle: String = "",
    val nameField: FormFieldState = FormFieldState(id = "name"),
    val contactField: FormFieldState = FormFieldState(id = "contact"),
    val welcomeField: FormFieldState = FormFieldState(id = "welcome"),
    val duration: String? = null,
    val selectedAreas: Set<String> = emptySet(),
    val customStartLabel: String? = null,
    val customEndLabel: String? = null,
    val customStartEpochDay: Long? = null,
    val customEndEpochDay: Long? = null,
    val isSaving: Boolean = false,
    val toast: GuestToast? = null,
    val shouldDismiss: Boolean = false,
    /**
     * A13.6 — set once the pass is created. Carries the raw one-time
     * `token` (composed into a public viewer URL) so the screen can fire
     * the OS share sheet. Cleared by `acknowledgeShare()`.
     */
    val createdShare: GuestPassShare? = null,
) {
    val durationOptions: List<ChipPickerOption> get() = AddGuestSampleData.durationOptions
    val areaOptions: List<ChipPickerOption> get() = AddGuestSampleData.areaOptions
    val welcomeMaxLength: Int get() = AddGuestSampleData.WELCOME_MAX_LENGTH

    /** First word of the entered name, if any. */
    val firstName: String?
        get() = nameField.value.trim().split(" ").firstOrNull()?.takeIf { it.isNotEmpty() }

    /** Required: name non-empty, contact valid (email OR phone), duration chosen. */
    val isValid: Boolean
        get() =
            nameField.value.trim().isNotEmpty() &&
                isGuestContactValid(contactField.value) &&
                duration != null

    /** Any input touched — drives the dirty-close confirm in `FormShell`. */
    val isDirty: Boolean
        get() =
            nameField.value.trim().isNotEmpty() ||
                contactField.value.isNotEmpty() ||
                duration != null ||
                selectedAreas.isNotEmpty() ||
                welcomeField.value.isNotEmpty()

    /** Italic helper under the duration chips. Mirrors the design copy. */
    val durationHint: String
        get() =
            when (duration) {
                "2h" -> "Two-hour pass · auto-revokes after"
                "today" -> "Today until 11:59 PM · auto-revokes after"
                "weekend" -> "Sat 12:00 AM → Sun 11:59 PM · auto-revokes after"
                AddGuestSampleData.DURATION_CUSTOM_ID ->
                    if (customStartLabel != null && customEndLabel != null) {
                        "$customStartLabel → $customEndLabel · auto-revokes after"
                    } else {
                        "Pick a custom date range"
                    }
                else -> "Pick how long the pass is good for."
            }

    /** Italic helper under the allowed-areas chips. */
    val areasHint: String
        get() =
            if (selectedAreas.isEmpty()) {
                "Front door only, unless you add more."
            } else {
                val possessive = firstName?.let { "$it's" } ?: "Their"
                "$possessive pass unlocks only what you pick."
            }
}

/**
 * A13.1 — Add Guest form view-model. [submit] issues the pass via
 * `POST /api/homes/:id/guest-passes` (route `backend/routes/homeIam.js:667`),
 * raises a success toast ("Pass sent to <name>") and publishes
 * [AddGuestUiState.createdShare] — the one-time share token composed into a
 * viewer link. The screen offers the OS share sheet (RN parity:
 * `src/app/homes/[id]/share.tsx:60-82`) and then calls [acknowledgeShare],
 * which flips [AddGuestUiState.shouldDismiss] so the host pops the form.
 * The contact, welcome note, and allowed-area chips are UI affordances the
 * create endpoint doesn't model, so they stay local.
 */
@HiltViewModel
class AddGuestFormViewModel
    @Inject
    constructor(
        savedStateHandle: SavedStateHandle,
        private val guestPassesRepo: HomeGuestPassesRepository,
    ) : ViewModel() {
        private val homeId: String = savedStateHandle.get<String>(ADD_GUEST_HOME_ID_KEY) ?: ""

        private val _state =
            MutableStateFlow(
                AddGuestSampleData.homeContext(homeId).let { ctx ->
                    AddGuestUiState(homeTitle = ctx.title, homeSubtitle = ctx.subtitle)
                },
            )
        val state: StateFlow<AddGuestUiState> = _state.asStateFlow()

        fun updateName(value: String) {
            _state.update { it.copy(nameField = it.nameField.copy(value = value, touched = true)) }
        }

        fun updateContact(value: String) {
            _state.update {
                it.copy(
                    contactField =
                        it.contactField.copy(
                            value = value,
                            touched = true,
                            error = validateGuestContact(value),
                        ),
                )
            }
        }

        fun updateWelcome(value: String) {
            val clipped = value.take(AddGuestSampleData.WELCOME_MAX_LENGTH)
            _state.update { it.copy(welcomeField = it.welcomeField.copy(value = clipped, touched = true)) }
        }

        fun setDuration(id: String?) {
            _state.update { it.copy(duration = id) }
        }

        fun setAreas(areas: Set<String>) {
            _state.update { it.copy(selectedAreas = areas) }
        }

        fun setCustomRange(
            startLabel: String,
            endLabel: String,
            startEpochDay: Long,
            endEpochDay: Long,
        ) {
            _state.update {
                it.copy(
                    duration = AddGuestSampleData.DURATION_CUSTOM_ID,
                    customStartLabel = startLabel,
                    customEndLabel = endLabel,
                    customStartEpochDay = startEpochDay,
                    customEndEpochDay = endEpochDay,
                )
            }
        }

        fun clearCustomRange() {
            _state.update {
                val nextDuration =
                    if (it.duration == AddGuestSampleData.DURATION_CUSTOM_ID) null else it.duration
                it.copy(
                    duration = nextDuration,
                    customStartLabel = null,
                    customEndLabel = null,
                    customStartEpochDay = null,
                    customEndEpochDay = null,
                )
            }
        }

        fun submit() {
            val current = _state.value
            if (!current.isValid || current.isSaving) return
            _state.update { it.copy(isSaving = true) }
            viewModelScope.launch {
                val window = guestPassWindow(current)
                val request =
                    CreateGuestPassRequest(
                        label = current.nameField.value.trim(),
                        kind = "guest",
                        durationHours = window.durationHours,
                        startAt = window.startAt,
                        endAt = window.endAt,
                    )
                when (val result = guestPassesRepo.create(homeId, request)) {
                    is NetworkResult.Success -> {
                        val firstName = _state.value.firstName
                        val name = firstName ?: "your guest"
                        // The raw token is returned exactly once
                        // (homeIam.js:762-767) — this is the only moment a
                        // shareable link can be built.
                        val share =
                            GuestPassShare(
                                id = result.data.pass.id,
                                guestName = firstName.orEmpty(),
                                url = GuestPassShare.urlForToken(result.data.token),
                            )
                        _state.update {
                            it.copy(
                                isSaving = false,
                                toast = GuestToast("Pass sent to $name", isError = false),
                                createdShare = share,
                            )
                        }
                    }
                    is NetworkResult.Failure -> {
                        _state.update {
                            it.copy(
                                isSaving = false,
                                toast =
                                    GuestToast(
                                        result.error.message.ifEmpty { "Couldn't issue the pass. Try again." },
                                        isError = true,
                                    ),
                            )
                        }
                    }
                }
            }
        }

        fun dismissToast() {
            _state.update { it.copy(toast = null) }
        }

        fun acknowledgeDismiss() {
            _state.update { it.copy(shouldDismiss = false) }
        }

        /**
         * A13.6 — called by the screen once the user has either shared the
         * new pass or declined. Clears the offer and asks the host to pop
         * the form.
         */
        fun acknowledgeShare() {
            _state.update { it.copy(createdShare = null, shouldDismiss = true) }
        }

        // ─── Guest-pass window ──────────────────────────────────────

        private data class GuestPassWindow(
            val durationHours: Int? = null,
            val startAt: String? = null,
            val endAt: String? = null,
        )

        /**
         * Maps the selected duration chip to the backend timing fields.
         * The handler resolves `end_at` > `duration_hours` > template
         * default, so the 2-hour preset sends a relative duration while
         * the dated presets send absolute ISO `start`/`end` stamps.
         * Mirrors iOS `AddGuestFormViewModel.guestPassWindow()`.
         */
        private fun guestPassWindow(state: AddGuestUiState): GuestPassWindow {
            val zone = ZoneId.systemDefault()
            return when (state.duration) {
                "2h" -> GuestPassWindow(durationHours = 2)
                "today" ->
                    GuestPassWindow(
                        endAt = LocalDate.now(zone).plusDays(1).atStartOfDay(zone).toInstant().toString(),
                    )
                "weekend" -> {
                    val saturday = LocalDate.now(zone).with(TemporalAdjusters.nextOrSame(DayOfWeek.SATURDAY))
                    val monday = saturday.plusDays(2)
                    GuestPassWindow(
                        startAt = saturday.atStartOfDay(zone).toInstant().toString(),
                        endAt = monday.atStartOfDay(zone).toInstant().toString(),
                    )
                }
                AddGuestSampleData.DURATION_CUSTOM_ID -> {
                    val start = state.customStartEpochDay
                    val end = state.customEndEpochDay
                    if (start != null && end != null) {
                        GuestPassWindow(
                            startAt = LocalDate.ofEpochDay(start).atStartOfDay(zone).toInstant().toString(),
                            endAt = LocalDate.ofEpochDay(end).plusDays(1).atStartOfDay(zone).toInstant().toString(),
                        )
                    } else {
                        GuestPassWindow(durationHours = 2)
                    }
                }
                else -> GuestPassWindow(durationHours = 2)
            }
        }
    }

// ─── Validation — top-level so the UiState getters + VM share them ──────

internal fun validateGuestContact(raw: String): String? {
    val trimmed = raw.trim()
    if (trimmed.isEmpty()) return null
    return if (isGuestContactValid(trimmed)) null else "Enter a valid email or phone number."
}

internal fun isGuestContactValid(raw: String): Boolean {
    val trimmed = raw.trim()
    if (trimmed.isEmpty()) return false
    return matchesGuestEmail(trimmed) || matchesGuestPhone(trimmed)
}

private val guestEmailRegex = Regex("^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$")
private val guestPhoneAllowed = Regex("^[0-9 +()\\-.]+$")

private fun matchesGuestEmail(value: String): Boolean = guestEmailRegex.matches(value)

private fun matchesGuestPhone(value: String): Boolean {
    if (!guestPhoneAllowed.matches(value)) return false
    val digits = value.count { it.isDigit() }
    return digits in 7..15
}
