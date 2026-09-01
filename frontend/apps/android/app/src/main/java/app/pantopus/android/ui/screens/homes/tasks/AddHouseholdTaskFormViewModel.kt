@file:Suppress("PackageNaming", "MagicNumber", "TooManyFunctions", "LongMethod", "LongParameterList")

package app.pantopus.android.ui.screens.homes.tasks

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.homes.CreateHomeTaskRequest
import app.pantopus.android.data.api.models.homes.HomeTaskDto
import app.pantopus.android.data.api.models.homes.OccupantDto
import app.pantopus.android.data.api.models.homes.UpdateHomeTaskRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomeMembersRepository
import app.pantopus.android.data.homes.HomeTasksRepository
import app.pantopus.android.ui.screens.shared.form.FormAggregate
import app.pantopus.android.ui.screens.shared.form.FormFieldState
import app.pantopus.android.ui.screens.shared.form.FormValidator
import app.pantopus.android.ui.screens.shared.form.all
import app.pantopus.android.ui.screens.shared.form.maxLength
import app.pantopus.android.ui.screens.shared.form.required
import app.pantopus.android.ui.theme.PantopusIcon
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.util.Locale
import javax.inject.Inject

/** Nav arg keys for the Add / Edit Household Task form. */
const val ADD_HOUSEHOLD_TASK_HOME_ID_KEY = "homeId"
const val ADD_HOUSEHOLD_TASK_TASK_ID_KEY = "taskId"

/**
 * Form-level category — distinct from the display-only
 * [HouseholdTaskCategory] palette (which infers from a free-form
 * title). These seven values are the user-pickable bucket from the
 * P2.4 prompt. The wire payload sets `task_type` based on [taskType]
 * — the backend's `task_type` enum is `chore / shopping / project /
 * reminder / repair` and the seven design buckets collapse into that
 * vocabulary.
 */
enum class AddHouseholdTaskFormCategory(val rawValue: String) {
    Cleaning("cleaning"),
    Cooking("cooking"),
    Shopping("shopping"),
    Yardwork("yardwork"),
    Pets("pets"),
    Repairs("repairs"),
    Other("other"),
    ;

    val label: String
        get() =
            when (this) {
                Cleaning -> "Cleaning"
                Cooking -> "Cooking"
                Shopping -> "Shopping"
                Yardwork -> "Yardwork"
                Pets -> "Pets"
                Repairs -> "Repairs"
                Other -> "Other"
            }

    val icon: PantopusIcon
        get() =
            when (this) {
                Cleaning -> PantopusIcon.Sparkles
                Cooking -> PantopusIcon.Utensils
                Shopping -> PantopusIcon.ShoppingBag
                Yardwork -> PantopusIcon.Leaf
                Pets -> PantopusIcon.PawPrint
                Repairs -> PantopusIcon.Hammer
                Other -> PantopusIcon.CheckCircle
            }

    /** Wire `task_type` value (one of the 5 backend buckets). */
    val taskType: String
        get() =
            when (this) {
                Shopping -> "shopping"
                Repairs -> "repair"
                else -> "chore"
            }

    companion object {
        fun fromRawValue(rawValue: String?): AddHouseholdTaskFormCategory = entries.firstOrNull { it.rawValue == rawValue } ?: Other

        /** Best-guess inference from an existing task's `task_type` +
         *  title — used in Edit mode to preselect the picker. */
        fun from(
            taskType: String?,
            title: String?,
        ): AddHouseholdTaskFormCategory {
            val lower = title.orEmpty().lowercase(Locale.US)
            val titleMatch =
                titleCategoryRules.firstOrNull { (_, needles) ->
                    lower.isNotEmpty() && matchAny(lower, needles)
                }?.first

            return titleMatch ?: when (taskType?.lowercase(Locale.US)) {
                "shopping" -> Shopping
                "repair" -> Repairs
                else -> Other
            }
        }

        private val titleCategoryRules: List<Pair<AddHouseholdTaskFormCategory, List<String>>> =
            listOf(
                Cooking to listOf("cook", "meal", "dinner", "lunch", "breakfast"),
                Cleaning to
                    listOf(
                        "dish", "clean", "vacuum", "dust", "mop", "wipe",
                        "scrub", "sweep", "tidy", "bathroom", "bedroom",
                    ),
                Cleaning to listOf("trash", "garbage", "recycle", "recycling", "compost"),
                Yardwork to
                    listOf(
                        "water plants", "plants", "garden", "mow", "lawn",
                        "rake", "leaves", "yard", "weed",
                    ),
                Pets to listOf("dog", "cat", "puppy", " pet ", "litter box", "vet "),
                Repairs to listOf("fix", "repair", "replace", "patch", "screw", "leak"),
                Shopping to
                    listOf(
                        "costco", "grocery", "groceries", "shopping",
                        "shop ", "pickup", "pick up", "store run",
                        "errand", "buy ",
                    ),
            )

        private fun matchAny(
            haystack: String,
            needles: List<String>,
        ): Boolean = needles.any { haystack.contains(it) }
    }
}

/**
 * The five recurrence options exposed by the form. [Custom] reveals
 * the "every N days / weeks / months" sub-form.
 */
enum class AddHouseholdTaskRecurrence(val rawValue: String) {
    OneTime("one_time"),
    Daily("daily"),
    Weekly("weekly"),
    Monthly("monthly"),
    Custom("custom"),
    ;

    val label: String
        get() =
            when (this) {
                OneTime -> "One-time"
                Daily -> "Daily"
                Weekly -> "Weekly"
                Monthly -> "Monthly"
                Custom -> "Custom"
            }

    val isRecurring: Boolean get() = this != OneTime

    companion object {
        fun fromRawValue(rawValue: String?): AddHouseholdTaskRecurrence = entries.firstOrNull { it.rawValue == rawValue } ?: OneTime
    }
}

/** Unit for the custom recurrence sub-form. */
enum class AddHouseholdTaskCustomUnit(val rawValue: String) {
    Days("days"),
    Weeks("weeks"),
    Months("months"),
    ;

    val label: String
        get() =
            when (this) {
                Days -> "Days"
                Weeks -> "Weeks"
                Months -> "Months"
            }

    val rruleFreq: String
        get() =
            when (this) {
                Days -> "DAILY"
                Weeks -> "WEEKLY"
                Months -> "MONTHLY"
            }

    companion object {
        fun fromRawValue(rawValue: String?): AddHouseholdTaskCustomUnit = entries.firstOrNull { it.rawValue == rawValue } ?: Weeks
    }
}

/**
 * Stable identifiers for every editable field. Non-enum payload uses
 * [FormFieldState] for dirty + validation tracking; the typed enums
 * above ride alongside via the stable rawValue mapping.
 */
enum class AddHouseholdTaskField(val key: String) {
    Title("title"),
    Category("category"),
    AssignedTo("assignedTo"),
    Recurrence("recurrence"),
    CustomInterval("customInterval"),
    CustomUnit("customUnit"),
    DueAt("dueAt"),
    Notes("notes"),
}

/** One assignable member surfaced by the picker. */
data class HouseholdTaskAssignableMember(
    val id: String,
    val displayName: String,
    val initials: String,
) {
    companion object {
        fun from(occupant: OccupantDto): HouseholdTaskAssignableMember? {
            if (!occupant.isActive) return null
            val name =
                occupant.displayName?.trim()
                    ?: occupant.username?.trim()
                    ?: ""
            val display =
                if (name.isEmpty()) {
                    "Member ${occupant.userId.take(4).uppercase(Locale.US)}"
                } else {
                    name
                }
            val initialsBuf =
                display.split(' ').take(2).mapNotNull { it.firstOrNull()?.toString() }
                    .joinToString("")
                    .uppercase(Locale.US)
            return HouseholdTaskAssignableMember(
                id = occupant.userId,
                displayName = display,
                initials = initialsBuf.ifEmpty { "··" },
            )
        }
    }
}

/** Render state for the Add / Edit Household Task form. */
sealed interface AddHouseholdTaskFormUiState {
    data object Loading : AddHouseholdTaskFormUiState

    data object Editing : AddHouseholdTaskFormUiState

    data class Error(val message: String) : AddHouseholdTaskFormUiState
}

/** Tone-tagged transient message surfaced by the form. */
data class AddHouseholdTaskToast(
    val text: String,
    val isError: Boolean,
)

/**
 * P2.4 — Backs `AddHouseholdTaskFormScreen`. Drives both Add
 * (`POST /api/homes/:id/tasks`, route `backend/routes/home.js:4238`)
 * and Edit (`PUT /api/homes/:id/tasks/:taskId`, route
 * `backend/routes/home.js:4308`) of one household chore. The two
 * modes share the same fields, layout, and validators — only the
 * load behavior (Edit hydrates from the existing task) and the
 * submit verb (Add → POST, Edit → PUT) differ.
 *
 * Backend constraints worth knowing:
 *  - The PUT allowlist (`home.js:4316`) does **not** include
 *    `recurrence_rule`. The wire body carries it (so when the
 *    backend catches up nothing changes here) but the server
 *    silently drops it today. Mirrored on iOS.
 *  - `assigned_to` is a single user uuid column. The prompt asks
 *    for multi-select; the wire forces single-select. The picker
 *    UI is single-select with "Unassigned (any member)" as the
 *    default. When schema grows a multi-assignee column the picker
 *    can widen.
 */
@HiltViewModel
class AddHouseholdTaskFormViewModel
    @Inject
    constructor(
        private val tasksRepo: HomeTasksRepository,
        private val membersRepo: HomeMembersRepository,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        val homeId: String =
            checkNotNull(savedStateHandle.get<String>(ADD_HOUSEHOLD_TASK_HOME_ID_KEY)) {
                "AddHouseholdTaskFormViewModel requires a $ADD_HOUSEHOLD_TASK_HOME_ID_KEY nav arg"
            }

        /** Null in Add mode, the task id in Edit mode. */
        val taskId: String? = savedStateHandle.get<String>(ADD_HOUSEHOLD_TASK_TASK_ID_KEY)

        val isEditing: Boolean get() = taskId != null

        private val _state =
            MutableStateFlow<AddHouseholdTaskFormUiState>(
                if (taskId == null) AddHouseholdTaskFormUiState.Editing else AddHouseholdTaskFormUiState.Loading,
            )
        val state: StateFlow<AddHouseholdTaskFormUiState> = _state.asStateFlow()

        private val _fields =
            MutableStateFlow(
                AddHouseholdTaskField.entries.associateWith {
                    val value = defaultValue(it)
                    FormFieldState(id = it.key, value = value, originalValue = value)
                },
            )
        val fields: StateFlow<Map<AddHouseholdTaskField, FormFieldState>> = _fields.asStateFlow()

        init {
            // Re-run validators against seed values so the initial
            // aggregate matches the schema's view of "valid".
            primeErrors()
        }

        private val _isSaving = MutableStateFlow(false)
        val isSaving: StateFlow<Boolean> = _isSaving.asStateFlow()

        private val _toast = MutableStateFlow<AddHouseholdTaskToast?>(null)
        val toast: StateFlow<AddHouseholdTaskToast?> = _toast.asStateFlow()

        private val _shouldDismiss = MutableStateFlow(false)
        val shouldDismiss: StateFlow<Boolean> = _shouldDismiss.asStateFlow()

        private val _shakeTrigger = MutableStateFlow(0)
        val shakeTrigger: StateFlow<Int> = _shakeTrigger.asStateFlow()

        private val _createdTaskId = MutableStateFlow<String?>(null)
        val createdTaskId: StateFlow<String?> = _createdTaskId.asStateFlow()

        private val _assignableMembers = MutableStateFlow<List<HouseholdTaskAssignableMember>>(emptyList())
        val assignableMembers: StateFlow<List<HouseholdTaskAssignableMember>> = _assignableMembers.asStateFlow()

        val aggregate: FormAggregate
            get() = FormAggregate.from(AddHouseholdTaskField.entries.mapNotNull { _fields.value[it] })

        val isValid: Boolean get() = aggregate.isValid

        /** Add mode treats every field as "new" so Save is reachable
         *  on the first edit. Edit mode keeps the dirty gate. */
        val isDirty: Boolean get() = if (isEditing) aggregate.isDirty else true

        val selectedCategory: AddHouseholdTaskFormCategory
            get() = AddHouseholdTaskFormCategory.fromRawValue(_fields.value[AddHouseholdTaskField.Category]?.value)

        val selectedRecurrence: AddHouseholdTaskRecurrence
            get() = AddHouseholdTaskRecurrence.fromRawValue(_fields.value[AddHouseholdTaskField.Recurrence]?.value)

        val selectedCustomUnit: AddHouseholdTaskCustomUnit
            get() = AddHouseholdTaskCustomUnit.fromRawValue(_fields.value[AddHouseholdTaskField.CustomUnit]?.value)

        val selectedAssigneeId: String?
            get() = _fields.value[AddHouseholdTaskField.AssignedTo]?.value?.takeIf { it.isNotEmpty() }

        val showsCustomRecurrenceSubForm: Boolean
            get() = selectedRecurrence == AddHouseholdTaskRecurrence.Custom

        // ── Lifecycle ─────────────────────────────────────────

        /**
         * Initial load. Add mode only fetches the assignee roster;
         * Edit mode also fetches the task itself (via the list
         * endpoint — no GET-by-id today) and hydrates the field map.
         */
        fun load() {
            if (taskId == null) {
                viewModelScope.launch { loadMembers() }
                return
            }
            _state.value = AddHouseholdTaskFormUiState.Loading
            viewModelScope.launch {
                when (val result = tasksRepo.getHomeTasks(homeId)) {
                    is NetworkResult.Success -> {
                        val match = result.data.tasks.firstOrNull { it.id == taskId }
                        if (match == null) {
                            _state.value = AddHouseholdTaskFormUiState.Error("Couldn't find that task.")
                        } else {
                            hydrate(match)
                            _state.value = AddHouseholdTaskFormUiState.Editing
                            loadMembers()
                        }
                    }
                    is NetworkResult.Failure -> {
                        _state.value =
                            AddHouseholdTaskFormUiState.Error(
                                result.error.message.ifBlank { "Couldn't load the task." },
                            )
                    }
                }
            }
        }

        fun refresh() = load()

        fun update(
            field: AddHouseholdTaskField,
            value: String,
        ) {
            val map = _fields.value.toMutableMap()
            val snapshot = map[field] ?: FormFieldState(id = field.key)
            map[field] =
                snapshot.copy(
                    value = value,
                    touched = true,
                    error = validator(field).validate(value),
                )
            _fields.value = map
        }

        fun selectCategory(category: AddHouseholdTaskFormCategory) {
            update(AddHouseholdTaskField.Category, category.rawValue)
        }

        /** Clears custom-only fields when switching away from custom so a
         *  stale interval doesn't survive into the wire body, and re-runs
         *  the custom-interval validator on the way in so a previously
         *  typed bad value surfaces an error immediately. */
        fun selectRecurrence(recurrence: AddHouseholdTaskRecurrence) {
            update(AddHouseholdTaskField.Recurrence, recurrence.rawValue)
            if (recurrence != AddHouseholdTaskRecurrence.Custom) {
                update(AddHouseholdTaskField.CustomInterval, "1")
                update(AddHouseholdTaskField.CustomUnit, AddHouseholdTaskCustomUnit.Weeks.rawValue)
            } else {
                // Re-validate the current customInterval value against the
                // now-active strict rule without flipping the touched flag.
                val map = _fields.value.toMutableMap()
                val snapshot = map[AddHouseholdTaskField.CustomInterval] ?: return
                map[AddHouseholdTaskField.CustomInterval] =
                    snapshot.copy(error = validator(AddHouseholdTaskField.CustomInterval).validate(snapshot.value))
                _fields.value = map
            }
        }

        fun selectCustomUnit(unit: AddHouseholdTaskCustomUnit) {
            update(AddHouseholdTaskField.CustomUnit, unit.rawValue)
        }

        /** Single-select assignee; pass `null` for "Unassigned (any member)". */
        fun selectAssignee(memberId: String?) {
            update(AddHouseholdTaskField.AssignedTo, memberId.orEmpty())
        }

        fun setDueDate(isoDay: String?) {
            update(AddHouseholdTaskField.DueAt, isoDay.orEmpty())
        }

        fun dismissToast() {
            _toast.value = null
        }

        fun acknowledgeDismiss() {
            _shouldDismiss.value = false
        }

        // ── Submit ────────────────────────────────────────────

        /** Run every validator. Returns the first invalid field id. */
        fun validateAll(): AddHouseholdTaskField? {
            var firstInvalid: AddHouseholdTaskField? = null
            val map = _fields.value.toMutableMap()
            for (field in AddHouseholdTaskField.entries) {
                val snapshot = map[field] ?: FormFieldState(id = field.key)
                val message = validator(field).validate(snapshot.value)
                map[field] = snapshot.copy(error = message, touched = true)
                if (firstInvalid == null && message != null) firstInvalid = field
            }
            _fields.value = map
            return firstInvalid
        }

        fun save() {
            if (_isSaving.value) return
            val invalid = validateAll()
            if (invalid != null) {
                _shakeTrigger.value = _shakeTrigger.value + 1
                _toast.value = AddHouseholdTaskToast("Fix the highlighted field.", isError = true)
                return
            }
            _isSaving.value = true
            viewModelScope.launch {
                val result =
                    if (taskId != null) {
                        tasksRepo.updateHomeTask(homeId, taskId, buildUpdateRequest())
                    } else {
                        tasksRepo.createHomeTask(homeId, buildCreateRequest())
                    }
                when (result) {
                    is NetworkResult.Success -> {
                        val saved = result.data.task
                        if (taskId == null) {
                            _createdTaskId.value = saved.id
                        } else {
                            hydrate(saved)
                        }
                        _toast.value =
                            AddHouseholdTaskToast(
                                if (taskId == null) "Task added." else "Task updated.",
                                isError = false,
                            )
                        _shouldDismiss.value = true
                    }
                    is NetworkResult.Failure -> {
                        _toast.value =
                            AddHouseholdTaskToast(
                                result.error.message.ifBlank {
                                    if (taskId == null) "Couldn't add the task." else "Couldn't update the task."
                                },
                                isError = true,
                            )
                    }
                }
                _isSaving.value = false
            }
        }

        // ── Members ───────────────────────────────────────────

        private suspend fun loadMembers() {
            when (val result = membersRepo.listOccupants(homeId)) {
                is NetworkResult.Success -> {
                    _assignableMembers.value = result.data.occupants.mapNotNull(HouseholdTaskAssignableMember::from)
                }
                is NetworkResult.Failure -> {
                    // Picker shows only "Unassigned (any member)" — editor
                    // doesn't gate on the roster.
                    _assignableMembers.value = emptyList()
                }
            }
        }

        // ── Hydration ─────────────────────────────────────────

        private fun hydrate(task: HomeTaskDto) {
            seed(AddHouseholdTaskField.Title, task.title)
            seed(AddHouseholdTaskField.Notes, task.description.orEmpty())
            seed(AddHouseholdTaskField.AssignedTo, task.assignedTo.orEmpty())
            seed(AddHouseholdTaskField.DueAt, isoDayOnly(task.dueAt).orEmpty())
            val category = AddHouseholdTaskFormCategory.from(task.taskType, task.title)
            seed(AddHouseholdTaskField.Category, category.rawValue)
            val parsed = parseRecurrence(task.recurrenceRule)
            seed(AddHouseholdTaskField.Recurrence, parsed.recurrence.rawValue)
            seed(AddHouseholdTaskField.CustomInterval, parsed.interval.toString())
            seed(AddHouseholdTaskField.CustomUnit, parsed.unit.rawValue)
            primeErrors()
        }

        private fun defaultValue(field: AddHouseholdTaskField): String =
            when (field) {
                AddHouseholdTaskField.Category -> AddHouseholdTaskFormCategory.Other.rawValue
                AddHouseholdTaskField.Recurrence -> AddHouseholdTaskRecurrence.OneTime.rawValue
                AddHouseholdTaskField.CustomInterval -> "1"
                AddHouseholdTaskField.CustomUnit -> AddHouseholdTaskCustomUnit.Weeks.rawValue
                else -> ""
            }

        private fun seed(
            field: AddHouseholdTaskField,
            value: String,
        ) {
            val map = _fields.value.toMutableMap()
            map[field] =
                FormFieldState(
                    id = field.key,
                    value = value,
                    originalValue = value,
                    touched = false,
                    error = validator(field).validate(value),
                )
            _fields.value = map
        }

        /** Re-run every validator without flipping touched flags. */
        private fun primeErrors() {
            val map = _fields.value.toMutableMap()
            for (field in AddHouseholdTaskField.entries) {
                val snapshot = map[field] ?: continue
                map[field] = snapshot.copy(error = validator(field).validate(snapshot.value))
            }
            _fields.value = map
        }

        // ── Validators ────────────────────────────────────────

        private fun validator(field: AddHouseholdTaskField): FormValidator =
            when (field) {
                AddHouseholdTaskField.Title ->
                    FormValidator.all(listOf(FormValidator.required("Title"), FormValidator.maxLength(80)))
                AddHouseholdTaskField.Recurrence ->
                    FormValidator { value ->
                        if (AddHouseholdTaskRecurrence.entries.any { it.rawValue == value }) {
                            null
                        } else {
                            "Pick a recurrence."
                        }
                    }
                AddHouseholdTaskField.Category ->
                    FormValidator { value ->
                        if (AddHouseholdTaskFormCategory.entries.any { it.rawValue == value }) {
                            null
                        } else {
                            "Pick a category."
                        }
                    }
                AddHouseholdTaskField.CustomInterval ->
                    FormValidator { value ->
                        if (selectedRecurrence != AddHouseholdTaskRecurrence.Custom) {
                            null
                        } else {
                            val n = value.trim().toIntOrNull()
                            when {
                                n == null ->
                                    "Enter a whole number of ${selectedCustomUnit.label.lowercase(Locale.US)}."
                                n < 1 -> "Must be at least 1."
                                n > 365 -> "Must be 365 or fewer."
                                else -> null
                            }
                        }
                    }
                AddHouseholdTaskField.CustomUnit ->
                    FormValidator { value ->
                        if (AddHouseholdTaskCustomUnit.entries.any { it.rawValue == value }) {
                            null
                        } else {
                            "Pick a unit."
                        }
                    }
                else -> FormValidator { null }
            }

        // ── Wire payload ──────────────────────────────────────

        private fun buildCreateRequest(): CreateHomeTaskRequest {
            val snapshot = wireSnapshot()
            return CreateHomeTaskRequest(
                taskType = snapshot.taskType,
                title = snapshot.title,
                description = snapshot.description,
                assignedTo = snapshot.assignedTo,
                dueAt = snapshot.dueAt,
                recurrenceRule = snapshot.recurrenceRule,
                priority = null,
            )
        }

        private fun buildUpdateRequest(): UpdateHomeTaskRequest {
            val snapshot = wireSnapshot()
            return UpdateHomeTaskRequest(
                status = null,
                title = snapshot.title,
                description = snapshot.description,
                assignedTo = snapshot.assignedTo,
                dueAt = snapshot.dueAt,
                // See top-of-file note: backend allowlist drops
                // recurrence_rule today. We still send it so the wire
                // tracks user intent.
                recurrenceRule = snapshot.recurrenceRule,
                priority = null,
                completedAt = null,
            )
        }

        private data class WireSnapshot(
            val taskType: String,
            val title: String,
            val description: String?,
            val assignedTo: String?,
            val dueAt: String?,
            val recurrenceRule: String?,
        )

        private fun wireSnapshot(): WireSnapshot {
            val map = _fields.value
            val title = (map[AddHouseholdTaskField.Title]?.value ?: "").trim()
            val notes = (map[AddHouseholdTaskField.Notes]?.value ?: "").trim()
            val assignee = (map[AddHouseholdTaskField.AssignedTo]?.value ?: "").trim()
            val due = (map[AddHouseholdTaskField.DueAt]?.value ?: "").trim()
            return WireSnapshot(
                taskType = selectedCategory.taskType,
                title = title,
                description = notes.ifEmpty { null },
                assignedTo = assignee.ifEmpty { null },
                dueAt = due.ifEmpty { null },
                recurrenceRule = buildRecurrenceRule(),
            )
        }

        private fun buildRecurrenceRule(): String? =
            when (selectedRecurrence) {
                AddHouseholdTaskRecurrence.OneTime -> null
                AddHouseholdTaskRecurrence.Daily -> "FREQ=DAILY"
                AddHouseholdTaskRecurrence.Weekly -> "FREQ=WEEKLY"
                AddHouseholdTaskRecurrence.Monthly -> "FREQ=MONTHLY"
                AddHouseholdTaskRecurrence.Custom -> {
                    val interval =
                        (_fields.value[AddHouseholdTaskField.CustomInterval]?.value?.toIntOrNull() ?: 1)
                            .coerceAtLeast(1)
                    "FREQ=${selectedCustomUnit.rruleFreq};INTERVAL=$interval"
                }
            }

        companion object {
            /** Drop the time-of-day portion of an ISO timestamp so the
             *  date picker only edits the day. */
            fun isoDayOnly(iso: String?): String? {
                if (iso.isNullOrEmpty()) return null
                val tIndex = iso.indexOf('T')
                if (tIndex > 0) return iso.substring(0, tIndex)
                return iso.take(10).ifEmpty { null }
            }

            data class ParsedRecurrence(
                val recurrence: AddHouseholdTaskRecurrence,
                val interval: Int,
                val unit: AddHouseholdTaskCustomUnit,
            )

            /** Map a server `recurrence_rule` to the form's picker
             *  selections. INTERVAL > 1 lands on Custom so the
             *  round-trip is editable. */
            fun parseRecurrence(rule: String?): ParsedRecurrence {
                val raw = rule?.trim()?.lowercase(Locale.US).orEmpty()
                if (raw.isEmpty()) {
                    return ParsedRecurrence(AddHouseholdTaskRecurrence.OneTime, 1, AddHouseholdTaskCustomUnit.Weeks)
                }
                val interval = parseInterval(raw)
                val baseRecurrence: AddHouseholdTaskRecurrence
                val unit: AddHouseholdTaskCustomUnit
                when {
                    raw.contains("freq=daily") -> {
                        baseRecurrence = AddHouseholdTaskRecurrence.Daily
                        unit = AddHouseholdTaskCustomUnit.Days
                    }
                    raw.contains("freq=weekly") -> {
                        baseRecurrence = AddHouseholdTaskRecurrence.Weekly
                        unit = AddHouseholdTaskCustomUnit.Weeks
                    }
                    raw.contains("freq=monthly") -> {
                        baseRecurrence = AddHouseholdTaskRecurrence.Monthly
                        unit = AddHouseholdTaskCustomUnit.Months
                    }
                    else ->
                        return ParsedRecurrence(
                            AddHouseholdTaskRecurrence.Custom,
                            1,
                            AddHouseholdTaskCustomUnit.Weeks,
                        )
                }
                return if (interval <= 1) {
                    ParsedRecurrence(baseRecurrence, 1, unit)
                } else {
                    ParsedRecurrence(AddHouseholdTaskRecurrence.Custom, interval, unit)
                }
            }

            private fun parseInterval(lowered: String): Int {
                val key = "interval="
                val start = lowered.indexOf(key)
                if (start < 0) return 1
                val tail = lowered.substring(start + key.length)
                val token = tail.substringBefore(';').trim()
                return token.toIntOrNull() ?: 1
            }
        }
    }
