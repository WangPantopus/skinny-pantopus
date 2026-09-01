@file:Suppress("PackageNaming", "LongMethod", "LongParameterList", "MagicNumber", "TooManyFunctions")

package app.pantopus.android.ui.screens.homes.accesscodes

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.homes.CreateAccessSecretRequest
import app.pantopus.android.data.api.models.homes.HomeAccessSecretDto
import app.pantopus.android.data.api.models.homes.UpdateAccessSecretRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomeMembersRepository
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.ui.screens.shared.form.FormAggregate
import app.pantopus.android.ui.screens.shared.form.FormFieldState
import app.pantopus.android.ui.screens.shared.form.FormValidator
import app.pantopus.android.ui.screens.shared.form.all
import app.pantopus.android.ui.screens.shared.form.maxLength
import app.pantopus.android.ui.screens.shared.form.required
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/** Nav-arg keys for the Add / Edit Access Code form. */
const val EDIT_ACCESS_CODE_HOME_ID_KEY = "homeId"
const val EDIT_ACCESS_CODE_SECRET_ID_KEY = "secretId"
const val EDIT_ACCESS_CODE_CATEGORY_KEY = "category"

/** Stable identifiers for every editable Access Code field. */
enum class EditAccessCodeField(
    val key: String,
) {
    Category("category"),
    Label("label"),
    Value("value"),
    Notes("notes"),
    SharedWith("sharedWith"),
}

/**
 * The four scopes the backend persists on `HomeAccessSecret.visibility`
 * (`schema.sql:281 home_record_visibility ENUM`).
 *
 * Rendered as a "Shared with" picker on the form. Labels intentionally
 * reference the household-member roster so the picker reads as a roster
 * scope chooser rather than a generic enum.
 */
enum class AccessVisibility(
    val wire: String,
) {
    /** Visible to anyone with viewing access (members + guests). */
    Everyone("public"),

    /** Every active household member. Backend default. */
    Members("members"),

    /** Roles with `members.manage` — owners, admins, managers. */
    Managers("managers"),

    /** Owners only. */
    Sensitive("sensitive"),
    ;

    /** Headline copy. */
    val headline: String
        get() =
            when (this) {
                Everyone -> "Everyone with access"
                Members -> "All household members"
                Managers -> "Owners & managers"
                Sensitive -> "Owners only (sensitive)"
            }

    /** Secondary copy under the headline. */
    val subcopy: String
        get() =
            when (this) {
                Everyone -> "Members, guests, and anyone given a visitor pass."
                Members -> "Every active member of this household."
                Managers -> "Roles with access management — owners, admins, and managers."
                Sensitive -> "Visible only to verified owners."
            }

    companion object {
        /** Backend default mirrors `schema.sql:6004 DEFAULT 'members'`. */
        val Default: AccessVisibility = Members

        /**
         * Display order on the picker. Most-permissive on the left so
         * the user reads the scope as a tightening selector L→R.
         */
        val displayOrder: List<AccessVisibility> =
            listOf(Everyone, Members, Managers, Sensitive)

        fun fromWire(wire: String?): AccessVisibility? = entries.firstOrNull { it.wire == wire }
    }
}

/** Lightweight household-member summary projected from `/occupants`. */
data class AccessRosterMember(
    val id: String,
    val displayName: String,
    val role: String?,
    val canManageAccess: Boolean,
    val canViewSensitive: Boolean,
)

/** Tiny tone+text bundle the screen turns into a transient toast. */
data class EditAccessCodeToast(
    val text: String,
    val isError: Boolean,
)

/** Aggregate UI state for the Add / Edit Access Code form. */
data class EditAccessCodeUiState(
    val fields: Map<EditAccessCodeField, FormFieldState> =
        EditAccessCodeField.entries.associateWith { FormFieldState(id = it.key) },
    val category: AccessCategory = AccessCategory.Wifi,
    val visibility: AccessVisibility = AccessVisibility.Default,
    val isRevealed: Boolean = false,
    val isSaving: Boolean = false,
    val isEditing: Boolean = false,
    val loadError: String? = null,
    val roster: List<AccessRosterMember> = emptyList(),
    val toast: EditAccessCodeToast? = null,
    val shouldDismiss: Boolean = false,
) {
    val aggregate: FormAggregate
        get() = FormAggregate.from(EditAccessCodeField.entries.mapNotNull { fields[it] })

    /** Required: label + value. Notes + visibility are optional. */
    val isValid: Boolean
        get() {
            val labelOk = fields[EditAccessCodeField.Label]?.value?.trim()?.isNotEmpty() == true
            val valueOk = fields[EditAccessCodeField.Value]?.value?.trim()?.isNotEmpty() == true
            return aggregate.isValid && labelOk && valueOk
        }

    val isDirty: Boolean get() = aggregate.isDirty

    /** Form title — different for add vs edit. */
    val title: String get() = if (isEditing) "Edit access code" else "Add access code"
}

/**
 * Add (no secretId) / Edit (with secretId) access code. POSTs or PUTs
 * `/api/homes/:id/access[/:secretId]`. The household-member roster is
 * fetched independently so the "Shared with" picker can render roster-
 * aware copy ("All 4 members") even on the create path.
 */
@HiltViewModel
class EditAccessCodeFormViewModel
    @Inject
    constructor(
        private val homes: HomesRepository,
        private val members: HomeMembersRepository,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        val homeId: String =
            requireNotNull(savedStateHandle[EDIT_ACCESS_CODE_HOME_ID_KEY]) {
                "EditAccessCodeFormViewModel requires a '$EDIT_ACCESS_CODE_HOME_ID_KEY' nav arg."
            }

        // Compose Navigation passes empty strings for missing query
        // params, so coerce blanks to null before deciding which pose
        // (add vs edit) the form should adopt.
        val secretId: String? =
            savedStateHandle.get<String?>(EDIT_ACCESS_CODE_SECRET_ID_KEY)?.takeIf { it.isNotBlank() }
        private val initialCategoryRaw: String? =
            savedStateHandle.get<String?>(EDIT_ACCESS_CODE_CATEGORY_KEY)?.takeIf { it.isNotBlank() }

        private val _state =
            MutableStateFlow(
                EditAccessCodeUiState(
                    isEditing = secretId != null,
                    category =
                        initialCategoryRaw
                            ?.let { raw -> AccessCategory.entries.firstOrNull { it.wire == raw } }
                            ?: AccessCategory.Wifi,
                ),
            )
        val state: StateFlow<EditAccessCodeUiState> = _state.asStateFlow()

        /** Routing callback wired by the screen — runs the platform clipboard. */
        var clipboardHandler: ((String) -> Unit) = { _ -> }

        private var toastJob: Job? = null

        init {
            seedDefaultFields()
        }

        /** Bound by the screen before the first render. */
        fun bindClipboard(handler: (String) -> Unit) {
            clipboardHandler = handler
        }

        /** Load the existing secret (when editing) plus the household roster. */
        fun load() {
            viewModelScope.launch {
                loadRoster()
                secretId?.let { loadSecret(it) }
            }
        }

        // ─── Field updates ────────────────────────────────────────

        fun update(
            field: EditAccessCodeField,
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

        fun selectCategory(category: AccessCategory) {
            _state.update { current ->
                if (current.category == category) return@update current
                val snapshot =
                    current.fields[EditAccessCodeField.Category]?.copy(
                        value = category.wire,
                        touched = true,
                        error = null,
                    ) ?: FormFieldState(id = EditAccessCodeField.Category.key, value = category.wire, touched = true)
                current.copy(
                    category = category,
                    fields = current.fields + (EditAccessCodeField.Category to snapshot),
                )
            }
        }

        fun selectVisibility(scope: AccessVisibility) {
            _state.update { current ->
                if (current.visibility == scope) return@update current
                val snapshot =
                    current.fields[EditAccessCodeField.SharedWith]?.copy(
                        value = scope.wire,
                        touched = true,
                        error = null,
                    ) ?: FormFieldState(id = EditAccessCodeField.SharedWith.key, value = scope.wire, touched = true)
                current.copy(
                    visibility = scope,
                    fields = current.fields + (EditAccessCodeField.SharedWith to snapshot),
                )
            }
        }

        /** Flip the masked / revealed pose of the value field. */
        fun toggleReveal() {
            _state.update { it.copy(isRevealed = !it.isRevealed) }
        }

        /** Copy the current value field through the bound clipboard handler. */
        fun copyValue() {
            val raw = (_state.value.fields[EditAccessCodeField.Value]?.value ?: "").trim()
            if (raw.isEmpty()) return
            clipboardHandler(raw)
            showToast("Copied", isError = false)
        }

        fun dismissToast() {
            _state.update { it.copy(toast = null) }
        }

        fun acknowledgeDismiss() {
            _state.update { it.copy(shouldDismiss = false) }
        }

        // ─── Roster-aware visibility helpers ───────────────────────

        /** Roster-aware summary string for the picker chip. */
        fun rosterSummary(scope: AccessVisibility): String {
            val members = _state.value.roster
            val count = members.size
            return when (scope) {
                AccessVisibility.Everyone ->
                    if (count == 0) scope.headline else "Everyone ($count members + guests)"
                AccessVisibility.Members ->
                    if (count == 0) scope.headline else "All household members ($count)"
                AccessVisibility.Managers ->
                    members.count { it.canManageAccess }.let { managers ->
                        if (managers == 0) scope.headline else "Owners & managers ($managers)"
                    }
                AccessVisibility.Sensitive ->
                    members.count { it.role?.lowercase() == "owner" }.let { owners ->
                        if (owners == 0) scope.headline else "Owners only ($owners)"
                    }
            }
        }

        /**
         * Names of members the selected visibility scope grants access
         * to. Drives the inline "Shared with" preview strip so the
         * scope picker stays visibly tied to the roster.
         */
        fun sharedWithNames(): List<String> {
            val members = _state.value.roster
            return when (_state.value.visibility) {
                AccessVisibility.Everyone, AccessVisibility.Members -> members.map { it.displayName }
                AccessVisibility.Managers -> members.filter { it.canManageAccess }.map { it.displayName }
                AccessVisibility.Sensitive ->
                    members.filter { it.role?.lowercase() == "owner" }.map { it.displayName }
            }
        }

        // ─── Submit ────────────────────────────────────────────────

        fun submit() {
            if (validateAll() != null) {
                showToast("Fix the highlighted field.", isError = true)
                return
            }
            _state.update { it.copy(isSaving = true) }
            viewModelScope.launch {
                val current = _state.value
                val label = current.fields[EditAccessCodeField.Label]?.value.orEmpty().trim()
                val value = current.fields[EditAccessCodeField.Value]?.value.orEmpty().trim()
                val notesRaw = current.fields[EditAccessCodeField.Notes]?.value.orEmpty().trim()
                val notes = notesRaw.ifEmpty { null }
                val accessType = current.category.backendAccessType
                val visibilityWire = current.visibility.wire

                val result =
                    if (secretId != null) {
                        homes.updateHomeAccessSecret(
                            homeId = homeId,
                            secretId = secretId,
                            request =
                                UpdateAccessSecretRequest(
                                    accessType = accessType,
                                    label = label,
                                    secretValue = value,
                                    notes = notes,
                                    visibility = visibilityWire,
                                ),
                        )
                    } else {
                        homes.createHomeAccessSecret(
                            homeId = homeId,
                            request =
                                CreateAccessSecretRequest(
                                    accessType = accessType,
                                    label = label,
                                    secretValue = value,
                                    notes = notes,
                                    visibility = visibilityWire,
                                ),
                        )
                    }
                when (result) {
                    is NetworkResult.Success -> {
                        _state.update {
                            it.copy(
                                isSaving = false,
                                toast =
                                    EditAccessCodeToast(
                                        text = if (secretId != null) "Code updated." else "Code added.",
                                        isError = false,
                                    ),
                            )
                        }
                        // Hold the success toast briefly before dismissing.
                        delay(800)
                        _state.update { it.copy(shouldDismiss = true) }
                    }
                    is NetworkResult.Failure -> {
                        _state.update {
                            it.copy(
                                isSaving = false,
                                toast =
                                    EditAccessCodeToast(
                                        text = result.error.message,
                                        isError = true,
                                    ),
                            )
                        }
                    }
                }
            }
        }

        // ─── Validation ─────────────────────────────────────────────

        private fun validator(field: EditAccessCodeField): FormValidator =
            when (field) {
                EditAccessCodeField.Category ->
                    FormValidator { v ->
                        if (AccessCategory.entries.any { it.wire == v }) null else "Pick a category."
                    }
                EditAccessCodeField.Label ->
                    FormValidator.all(listOf(FormValidator.required("Label"), FormValidator.maxLength(120)))
                EditAccessCodeField.Value ->
                    FormValidator.all(listOf(FormValidator.required("Code"), FormValidator.maxLength(512)))
                EditAccessCodeField.Notes -> FormValidator.maxLength(2000)
                EditAccessCodeField.SharedWith ->
                    FormValidator { v ->
                        if (AccessVisibility.fromWire(v) != null) null else "Pick a visibility scope."
                    }
            }

        @Suppress("ReturnCount")
        fun validateAll(): EditAccessCodeField? {
            var firstInvalid: EditAccessCodeField? = null
            _state.update { current ->
                val updated =
                    current.fields.mapValues { (field, snapshot) ->
                        val message = validator(field).validate(snapshot.value)
                        if (firstInvalid == null && message != null) firstInvalid = field
                        snapshot.copy(error = message, touched = true)
                    }
                current.copy(fields = updated)
            }
            // Additional gate: required label / value.
            val current = _state.value
            val labelEmpty =
                current.fields[EditAccessCodeField.Label]?.value?.trim().isNullOrEmpty()
            val valueEmpty =
                current.fields[EditAccessCodeField.Value]?.value?.trim().isNullOrEmpty()
            if (firstInvalid == null) {
                if (labelEmpty) {
                    firstInvalid = EditAccessCodeField.Label
                } else if (valueEmpty) {
                    firstInvalid = EditAccessCodeField.Value
                }
            }
            return firstInvalid
        }

        // ─── Hydration ─────────────────────────────────────────────

        private suspend fun loadRoster() {
            when (val result = members.listOccupants(homeId)) {
                is NetworkResult.Success -> {
                    val roster =
                        result.data.occupants
                            .filter { it.isActive }
                            .map { occupant ->
                                AccessRosterMember(
                                    id = occupant.userId,
                                    displayName =
                                        occupant.displayName ?: occupant.username ?: "Member",
                                    role = occupant.role,
                                    canManageAccess = occupant.canManageAccess ?: false,
                                    canViewSensitive = occupant.canViewSensitive ?: false,
                                )
                            }
                    _state.update { it.copy(roster = roster) }
                }
                is NetworkResult.Failure -> {
                    // Roster fetch is non-fatal; the picker still works
                    // with the bare scope labels. The strip just stays
                    // empty.
                    _state.update { it.copy(roster = emptyList()) }
                }
            }
        }

        private suspend fun loadSecret(secretId: String) {
            // Backend has no GET-one endpoint — fetch the list and pick
            // the matching row. Cheap because the calling screen has
            // typically warmed the cache already.
            when (val result = homes.getHomeAccessSecrets(homeId)) {
                is NetworkResult.Success -> {
                    val secret = result.data.secrets.firstOrNull { it.id == secretId }
                    if (secret == null) {
                        _state.update { it.copy(loadError = "Couldn't find that access code.") }
                        return
                    }
                    hydrate(secret)
                }
                is NetworkResult.Failure ->
                    _state.update { it.copy(loadError = "Couldn't load access code. Try again.") }
            }
        }

        private fun hydrate(secret: HomeAccessSecretDto) {
            val category = AccessCategory.from(secret.accessType)
            val visibility =
                AccessVisibility.fromWire(secret.visibility) ?: AccessVisibility.Default
            _state.update { current ->
                val fields =
                    current.fields +
                        listOf(
                            EditAccessCodeField.Category to seeded(EditAccessCodeField.Category, category.wire),
                            EditAccessCodeField.Label to seeded(EditAccessCodeField.Label, secret.label),
                            EditAccessCodeField.Value to seeded(EditAccessCodeField.Value, secret.secretValue),
                            EditAccessCodeField.Notes to seeded(EditAccessCodeField.Notes, secret.notes.orEmpty()),
                            EditAccessCodeField.SharedWith to seeded(EditAccessCodeField.SharedWith, visibility.wire),
                        )
                current.copy(
                    category = category,
                    visibility = visibility,
                    fields = fields,
                )
            }
        }

        // ─── Helpers ───────────────────────────────────────────────

        private fun seedDefaultFields() {
            _state.update { current ->
                val initial = current.category
                val initialVis = current.visibility
                val fields =
                    EditAccessCodeField.entries.associateWith { field ->
                        val initialValue =
                            when (field) {
                                EditAccessCodeField.Category -> initial.wire
                                EditAccessCodeField.SharedWith -> initialVis.wire
                                else -> ""
                            }
                        seeded(field, initialValue)
                    }
                current.copy(fields = fields)
            }
        }

        private fun seeded(
            field: EditAccessCodeField,
            value: String,
        ) = FormFieldState(
            id = field.key,
            value = value,
            originalValue = value,
            touched = false,
            error = validator(field).validate(value),
        )

        private fun showToast(
            text: String,
            isError: Boolean,
        ) {
            _state.update { it.copy(toast = EditAccessCodeToast(text = text, isError = isError)) }
            toastJob?.cancel()
            toastJob =
                viewModelScope.launch {
                    delay(TOAST_DURATION_MS)
                    _state.update { it.copy(toast = null) }
                }
        }

        companion object {
            private const val TOAST_DURATION_MS = 1_800L
        }
    }
