@file:Suppress("PackageNaming", "MagicNumber", "TooManyFunctions", "LongMethod")

package app.pantopus.android.ui.screens.support_trains.edit_signup

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.support_trains.SupportTrainReservationDto
import app.pantopus.android.data.support_trains.SupportTrainReservationsStore
import app.pantopus.android.ui.screens.shared.form.FormAggregate
import app.pantopus.android.ui.screens.shared.form.FormFieldState
import app.pantopus.android.ui.screens.shared.form.FormValidator
import app.pantopus.android.ui.screens.shared.form.all
import app.pantopus.android.ui.screens.shared.form.maxLength
import app.pantopus.android.ui.screens.shared.form.timeHHmm
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import javax.inject.Inject

/** Stable identifiers for every editable Edit Signup field. */
enum class EditSignupField(val key: String) {
    /**
     * Meal description for cook / groceries, restaurant name for
     * takeout. The active label + placeholder swap on
     * `contributionMode`.
     */
    Contribution("contribution"),

    /** `HH:mm` drop-off time within the recipient's slot window. */
    DropoffTime("dropoffTime"),

    /**
     * Organizer-only dietary / accommodation notes
     * (`private_note_to_organizer`).
     */
    DietaryNotes("dietaryNotes"),
}

/** Tiny tone+text bundle the screen turns into a toast. */
data class EditSignupToastPayload(
    val text: String,
    val isError: Boolean,
)

/** Aggregate UI state for the Edit Signup form. */
data class EditSignupUiState(
    val reservation: SupportTrainReservationDto? = null,
    val fields: Map<EditSignupField, FormFieldState> =
        EditSignupField.entries.associateWith { FormFieldState(id = it.key) },
    val isSaving: Boolean = false,
    val toast: EditSignupToastPayload? = null,
    val shouldDismiss: Boolean = false,
    /** True once the staged seed could not be found — surfaces an error CTA. */
    val isMissingSeed: Boolean = false,
) {
    val aggregate: FormAggregate
        get() = FormAggregate.from(EditSignupField.entries.mapNotNull { fields[it] })

    val isValid: Boolean get() = aggregate.isValid
    val isDirty: Boolean get() = aggregate.isDirty

    val contributionLabel: String
        get() =
            when (reservation?.contributionMode) {
                "cook" -> "Meal description"
                "groceries" -> "Groceries description"
                "takeout" -> "Restaurant"
                else -> "Contribution"
            }

    val contributionPlaceholder: String
        get() =
            when (reservation?.contributionMode) {
                "cook" -> "e.g. Veggie chili with cornbread"
                "groceries" -> "e.g. Pantry staples + fresh produce"
                "takeout" -> "e.g. Sweetgreen on Market"
                else -> "What you're bringing"
            }

    val contributionMapsToRestaurant: Boolean
        get() = reservation?.contributionMode == "takeout"
}

/**
 * P3.7 — Edit Signup form ViewModel. Mirrors iOS
 * `EditSignupFormViewModel` exactly: prefills from the seed
 * reservation, validates on every keystroke, and on Save writes an
 * optimistic patch into [SupportTrainReservationsStore] so the
 * Review-signups list reflects the edit when the user pops back. The
 * backend `PATCH …/reservations/:reservationId` route lands
 * separately — until then the store's patch is the user-facing source
 * of truth (matches the optimistic-confirm precedent on
 * `ReviewSignupsViewModel.confirm`).
 */
@HiltViewModel
class EditSignupFormViewModel
    @Inject
    constructor(
        private val store: SupportTrainReservationsStore,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        private val reservationId: String =
            savedStateHandle.get<String>(RESERVATION_ID_KEY).orEmpty()

        private val _state = MutableStateFlow(EditSignupUiState())
        val state: StateFlow<EditSignupUiState> = _state.asStateFlow()

        init {
            // Pull the staged seed the list screen dropped before
            // navigating. If the user got here via a deep link (or the
            // process restarted) the seed will be null and we surface
            // an error CTA in the UI rather than rendering a blank form.
            val seed = store.consumeStaged()
            if (seed == null || (reservationId.isNotEmpty() && seed.id != reservationId)) {
                _state.update { it.copy(isMissingSeed = true) }
            } else {
                _state.update {
                    it.copy(
                        reservation = seed,
                        fields = seedFields(seed),
                    )
                }
            }
        }

        /**
         * Update a field's value and re-run its validator. Idempotent —
         * setting a field to its current value clears any prior error.
         */
        fun update(
            field: EditSignupField,
            value: String,
        ) {
            _state.update { current ->
                val snapshot =
                    current.fields[field]?.copy(
                        value = value,
                        touched = true,
                        error = validator(field).validate(value),
                    ) ?: FormFieldState(id = field.key, value = value, touched = true)
                current.copy(fields = current.fields + (field to snapshot))
            }
        }

        fun dismissToast() {
            _state.update { it.copy(toast = null) }
        }

        fun acknowledgeDismiss() {
            _state.update { it.copy(shouldDismiss = false) }
        }

        /** Run all validators. Returns the first invalid field, if any. */
        fun validateAll(): EditSignupField? {
            var firstInvalid: EditSignupField? = null
            _state.update { current ->
                val updated =
                    current.fields.mapValues { (field, snapshot) ->
                        val message = validator(field).validate(snapshot.value)
                        if (firstInvalid == null && message != null) firstInvalid = field
                        snapshot.copy(error = message, touched = true)
                    }
                current.copy(fields = updated)
            }
            return firstInvalid
        }

        /**
         * Commit the edit. Builds the patched DTO, writes it into the
         * shared store, surfaces a success toast, and flips
         * `shouldDismiss` after a beat so the host nav-pops the form.
         */
        fun submit() {
            if (_state.value.reservation == null) return
            if (validateAll() != null) {
                _state.update {
                    it.copy(
                        toast = EditSignupToastPayload("Fix the highlighted field.", isError = true),
                    )
                }
                return
            }
            val updated = buildUpdatedReservation() ?: return
            _state.update { it.copy(isSaving = true) }
            store.applyPatch(updated)
            viewModelScope.launch {
                _state.update {
                    it.copy(
                        isSaving = false,
                        toast = EditSignupToastPayload("Signup updated.", isError = false),
                    )
                }
                // Hold the success toast on screen briefly before the host
                // pops the nav stack — mirrors iOS cadence.
                delay(700)
                _state.update { it.copy(shouldDismiss = true) }
            }
        }

        // MARK: - Private

        private fun validator(field: EditSignupField): FormValidator =
            when (field) {
                // Optional on the wire (Joi `.allow(null, '')`) but
                // capped at 200 chars to match the reserve schema.
                EditSignupField.Contribution -> FormValidator.all(listOf(FormValidator.maxLength(200)))
                EditSignupField.DropoffTime -> FormValidator.all(listOf(FormValidator.timeHHmm()))
                EditSignupField.DietaryNotes -> FormValidator.all(listOf(FormValidator.maxLength(1000)))
            }

        private fun buildUpdatedReservation(): SupportTrainReservationDto? {
            val current = _state.value
            val seed = current.reservation ?: return null

            val trimmedContribution =
                (current.fields[EditSignupField.Contribution]?.value ?: "").trim()
            val trimmedNotes =
                (current.fields[EditSignupField.DietaryNotes]?.value ?: "").trim()

            val dishTitle: String?
            val restaurantName: String?
            if (current.contributionMapsToRestaurant) {
                dishTitle = seed.dishTitle
                restaurantName = trimmedContribution.ifEmpty { null }
            } else {
                dishTitle = trimmedContribution.ifEmpty { null }
                restaurantName = seed.restaurantName
            }

            val arrival = newArrivalIso(seed)
            return seed.copy(
                dishTitle = dishTitle,
                restaurantName = restaurantName,
                estimatedArrivalAt = arrival,
                privateNoteToOrganizer = trimmedNotes.ifEmpty { null },
                // Bumping `updatedAt` flips the row to the "Edited" chip
                // in the list view — same client-side derivation
                // `SupportTrainReservationDto.wasEdited` uses.
                updatedAt = isoNow(),
            )
        }

        /**
         * Build the new `estimated_arrival_at` ISO string by overlaying
         * the picked `HH:mm` on the seed arrival date. Falls back to
         * the seed value when no time is set or the seed arrival is
         * missing / unparseable.
         */
        private fun newArrivalIso(seed: SupportTrainReservationDto): String? {
            val value = (_state.value.fields[EditSignupField.DropoffTime]?.value ?: "").trim()
            if (value.isEmpty()) return seed.estimatedArrivalAt
            val (hour, minute) =
                runCatching {
                    val parts = value.split(":")
                    parts[0].toInt() to parts[1].toInt()
                }.getOrNull() ?: return seed.estimatedArrivalAt
            val zone = ZoneId.systemDefault()
            val base: ZonedDateTime =
                runCatching { Instant.parse(seed.estimatedArrivalAt ?: "") }
                    .getOrNull()
                    ?.atZone(zone)
                    ?: ZonedDateTime.now(zone)
            val composed =
                base
                    .withHour(hour)
                    .withMinute(minute)
                    .withSecond(0)
                    .withNano(0)
            return composed.withZoneSameInstant(ZoneOffset.UTC).format(ISO_FMT)
        }

        private fun seedFields(seed: SupportTrainReservationDto): Map<EditSignupField, FormFieldState> {
            val contributionOriginal =
                if (seed.contributionMode == "takeout") {
                    seed.restaurantName.orEmpty()
                } else {
                    seed.dishTitle.orEmpty()
                }
            val dropoffOriginal = formatDropoffTime(seed)
            val dietaryOriginal = seed.privateNoteToOrganizer.orEmpty()
            return mapOf(
                EditSignupField.Contribution to
                    FormFieldState(
                        id = EditSignupField.Contribution.key,
                        value = contributionOriginal,
                        originalValue = contributionOriginal,
                    ),
                EditSignupField.DropoffTime to
                    FormFieldState(
                        id = EditSignupField.DropoffTime.key,
                        value = dropoffOriginal,
                        originalValue = dropoffOriginal,
                    ),
                EditSignupField.DietaryNotes to
                    FormFieldState(
                        id = EditSignupField.DietaryNotes.key,
                        value = dietaryOriginal,
                        originalValue = dietaryOriginal,
                    ),
            )
        }

        private fun formatDropoffTime(seed: SupportTrainReservationDto): String {
            val iso = seed.estimatedArrivalAt ?: return ""
            return runCatching {
                val zone = ZoneId.systemDefault()
                val zdt = Instant.parse(iso).atZone(zone)
                TIME_FMT.format(zdt)
            }.getOrDefault("")
        }

        private fun isoNow(): String = ISO_FMT.format(ZonedDateTime.now(ZoneOffset.UTC))

        companion object {
            /**
             * Nav-arg key for the reservation UUID this screen edits.
             * Mirrors `ChildRoutes.EDIT_SIGNUP_ID_KEY` in
             * `RootTabScreen.kt`.
             */
            const val RESERVATION_ID_KEY = "reservationId"

            private val TIME_FMT: DateTimeFormatter = DateTimeFormatter.ofPattern("HH:mm")
            private val ISO_FMT: DateTimeFormatter = DateTimeFormatter.ISO_OFFSET_DATE_TIME
        }
    }
