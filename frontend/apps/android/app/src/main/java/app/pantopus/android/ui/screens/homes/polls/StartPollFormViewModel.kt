@file:Suppress("PackageNaming", "MagicNumber", "TooManyFunctions", "LongMethod")

package app.pantopus.android.ui.screens.homes.polls

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.homes.CreatePollOption
import app.pantopus.android.data.api.models.homes.CreatePollRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomeMembersRepository
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.ui.screens.homes.invite_owner.ToastPayload
import app.pantopus.android.ui.theme.PantopusIcon
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.UUID
import javax.inject.Inject

/** Nav-arg key for the Start-a-Poll form route. */
const val START_POLL_HOME_ID_KEY = "homeId"

/**
 * Client-side poll kinds. Each maps to a backend `poll_type` via
 * [StartPollKind.wirePollType]; approval collapses to `multiple_choice`
 * because the backend has no separate approval shape today. Mirrors the
 * iOS `StartPollKind`.
 */
enum class StartPollKind(
    val label: String,
    val helper: String,
    val icon: PantopusIcon,
    val wirePollType: String,
    val allowsCustomOptions: Boolean,
) {
    SingleChoice(
        label = "Single choice",
        helper = "Voters pick one option.",
        icon = PantopusIcon.ClipboardList,
        wirePollType = "single_choice",
        allowsCustomOptions = true,
    ),
    MultiChoice(
        label = "Multi-choice",
        helper = "Voters pick any number of options.",
        icon = PantopusIcon.CheckCheck,
        wirePollType = "multiple_choice",
        allowsCustomOptions = true,
    ),
    Ranked(
        label = "Ranked",
        helper = "Voters rank the options in order.",
        icon = PantopusIcon.ListChecks,
        wirePollType = "ranking",
        allowsCustomOptions = true,
    ),
    YesNo(
        label = "Yes / No",
        helper = "Yes or No — a quick binary read.",
        icon = PantopusIcon.CheckCircle,
        wirePollType = "yes_no",
        allowsCustomOptions = false,
    ),
    Approval(
        label = "Approval",
        helper = "Voters approve every option they're okay with.",
        icon = PantopusIcon.ThumbsUp,
        wirePollType = "multiple_choice",
        allowsCustomOptions = true,
    ),
}

/** Audience visibility model. Mirrors the iOS `StartPollAudience`. */
sealed interface StartPollAudience {
    data object AllMembers : StartPollAudience

    data class SelectedMembers(
        val ids: Set<String>,
    ) : StartPollAudience

    val isSelective: Boolean
        get() = this is SelectedMembers

    val selectedIds: Set<String>
        get() =
            when (this) {
                is SelectedMembers -> ids
                AllMembers -> emptySet()
            }
}

/** One editable option row. */
data class StartPollOption(
    val id: String = UUID.randomUUID().toString(),
    val label: String = "",
    val isLocked: Boolean = false,
)

/** Slim member-row projection for the audience picker. */
data class StartPollMember(
    val id: String,
    val name: String,
)

/** Bounds for the form. Mirrors the iOS `StartPollBounds`. */
object StartPollBounds {
    const val MIN_OPTIONS = 2
    const val MAX_OPTIONS = 10
    const val QUESTION_MIN = 5
    const val QUESTION_MAX = 200

    /** `closesAt` must be at least this many seconds in the future. */
    const val CLOSE_MIN_SECONDS_AHEAD: Long = 60L * 60L
}

/** Render state for the form. */
sealed interface StartPollFormStatus {
    data object Editing : StartPollFormStatus

    data object Submitting : StartPollFormStatus

    data class Success(
        val pollId: String,
    ) : StartPollFormStatus

    data class Error(
        val message: String,
    ) : StartPollFormStatus
}

/** Aggregate UI state. */
data class StartPollUiState(
    val kind: StartPollKind = StartPollKind.SingleChoice,
    /** Initial kind — used by dirty-tracking so a user who landed on
     *  yes-no from the quickstart tile isn't "dirty" until they edit. */
    val initialKind: StartPollKind = kind,
    val question: String = "",
    val questionError: String? = null,
    val questionTouched: Boolean = false,
    val options: List<StartPollOption> = defaultOptionsForKind(StartPollKind.SingleChoice),
    val audience: StartPollAudience = StartPollAudience.AllMembers,
    val closesAt: LocalDateTime? = null,
    val isAnonymous: Boolean = false,
    val members: List<StartPollMember> = emptyList(),
    val isLoadingMembers: Boolean = false,
    val status: StartPollFormStatus = StartPollFormStatus.Editing,
    val toast: ToastPayload? = null,
    val shakeTrigger: Int = 0,
    val shouldDismiss: Boolean = false,
)

private fun defaultOptionsForKind(kind: StartPollKind): List<StartPollOption> =
    if (kind.allowsCustomOptions) {
        listOf(StartPollOption(label = ""), StartPollOption(label = ""))
    } else {
        listOf(
            StartPollOption(label = "Yes", isLocked = true),
            StartPollOption(label = "No", isLocked = true),
        )
    }

/**
 * ViewModel for the Start-a-Poll form (P2.5). POSTs `CreatePollRequest`
 * to `/api/homes/:id/polls` — `backend/routes/home.js:7058`.
 */
@HiltViewModel
class StartPollFormViewModel
    internal constructor(
        private val homesRepo: HomesRepository,
        private val membersRepo: HomeMembersRepository,
        savedStateHandle: SavedStateHandle,
        private val clock: () -> Instant = Instant::now,
        private val zone: () -> ZoneId = ZoneId::systemDefault,
    ) : ViewModel() {
        @Inject
        constructor(
            homesRepo: HomesRepository,
            membersRepo: HomeMembersRepository,
            savedStateHandle: SavedStateHandle,
        ) : this(homesRepo, membersRepo, savedStateHandle, Instant::now, ZoneId::systemDefault)

        private val homeId: String =
            requireNotNull(savedStateHandle.get<String>(START_POLL_HOME_ID_KEY)) {
                "StartPollFormViewModel requires a '$START_POLL_HOME_ID_KEY' nav arg."
            }

        private val _state = MutableStateFlow(StartPollUiState())
        val state: StateFlow<StartPollUiState> = _state.asStateFlow()

        // MARK: - Mutators

        fun updateQuestion(value: String) {
            _state.update { current ->
                current.copy(
                    question = value,
                    questionTouched = true,
                    questionError = validateQuestion(value),
                )
            }
        }

        fun setKind(next: StartPollKind) {
            _state.update { current ->
                if (next == current.kind) return@update current
                val options = reconfigureOptions(current.options, next)
                current.copy(kind = next, options = options)
            }
        }

        fun addOption() {
            _state.update { current ->
                if (!current.kind.allowsCustomOptions) return@update current
                if (current.options.size >= StartPollBounds.MAX_OPTIONS) return@update current
                current.copy(options = current.options + StartPollOption(label = ""))
            }
        }

        fun removeOption(id: String) {
            _state.update { current ->
                if (!current.kind.allowsCustomOptions) return@update current
                if (current.options.size <= StartPollBounds.MIN_OPTIONS) return@update current
                val index = current.options.indexOfFirst { it.id == id }
                if (index < 0 || current.options[index].isLocked) return@update current
                current.copy(options = current.options.toMutableList().also { it.removeAt(index) })
            }
        }

        fun updateOption(
            id: String,
            value: String,
        ) {
            _state.update { current ->
                val options =
                    current.options.map { opt ->
                        if (opt.id == id && !opt.isLocked) opt.copy(label = value) else opt
                    }
                current.copy(options = options)
            }
        }

        fun toggleMember(userId: String) {
            _state.update { current ->
                val next = current.audience.selectedIds.toMutableSet()
                if (next.contains(userId)) next.remove(userId) else next.add(userId)
                val audience =
                    if (next.isEmpty()) {
                        StartPollAudience.AllMembers
                    } else {
                        StartPollAudience.SelectedMembers(next)
                    }
                current.copy(audience = audience)
            }
        }

        fun selectAllMembers() {
            _state.update { it.copy(audience = StartPollAudience.AllMembers) }
        }

        fun setCloseDate(date: LocalDateTime?) {
            _state.update { it.copy(closesAt = date) }
        }

        fun setAnonymous(value: Boolean) {
            _state.update { it.copy(isAnonymous = value) }
        }

        fun dismissToast() {
            _state.update { it.copy(toast = null) }
        }

        fun acknowledgeDismiss() {
            _state.update { it.copy(shouldDismiss = false) }
        }

        // MARK: - Members hydration

        fun loadMembers() {
            _state.update { it.copy(isLoadingMembers = true) }
            viewModelScope.launch {
                val result = membersRepo.listOccupants(homeId)
                val members =
                    when (result) {
                        is NetworkResult.Success ->
                            result.data.occupants
                                .filter { it.isActive }
                                .map { occ ->
                                    StartPollMember(
                                        id = occ.userId,
                                        name = occ.displayName ?: occ.username ?: "Member",
                                    )
                                }.sortedBy { it.name.lowercase() }
                        is NetworkResult.Failure -> emptyList()
                    }
                _state.update { it.copy(members = members, isLoadingMembers = false) }
            }
        }

        // MARK: - Aggregate accessors

        fun isDirty(state: StartPollUiState = _state.value): Boolean =
            state.question.trim().isNotEmpty() ||
                state.closesAt != null ||
                state.isAnonymous ||
                state.audience.isSelective ||
                state.kind != state.initialKind ||
                state.options.any { !it.isLocked && it.label.trim().isNotEmpty() }

        fun isValid(state: StartPollUiState = _state.value): Boolean = firstValidationError(state) == null

        // MARK: - Validation

        /** First user-facing error, or `null` when the form is submittable. */
        fun firstValidationError(state: StartPollUiState = _state.value): String? =
            validateQuestion(state.question)
                ?: validateOptions(state)
                ?: validateCloseDate(state)

        private fun validateOptions(state: StartPollUiState): String? {
            if (!state.kind.allowsCustomOptions) return null
            val labels = state.options.map { it.label.trim() }.filter { it.isNotEmpty() }
            if (labels.size < StartPollBounds.MIN_OPTIONS) {
                return "Add at least ${StartPollBounds.MIN_OPTIONS} options."
            }
            val normalised = labels.map { it.lowercase() }.toSet()
            if (normalised.size < labels.size) return "Each option must be unique."
            return null
        }

        private fun validateCloseDate(state: StartPollUiState): String? {
            val closesAt = state.closesAt ?: return "Pick a close date."
            val cutoff = clock().plusSeconds(StartPollBounds.CLOSE_MIN_SECONDS_AHEAD)
            val closesInstant = closesAt.atZone(zone()).toInstant()
            if (closesInstant.isBefore(cutoff)) {
                return "Close date must be at least 1 hour in the future."
            }
            return null
        }

        private fun validateQuestion(value: String): String? {
            val trimmed = value.trim()
            return when {
                trimmed.isEmpty() -> "Question is required."
                trimmed.length < StartPollBounds.QUESTION_MIN ->
                    "Question must be at least ${StartPollBounds.QUESTION_MIN} characters."
                trimmed.length > StartPollBounds.QUESTION_MAX ->
                    "Question must be ${StartPollBounds.QUESTION_MAX} characters or fewer."
                else -> null
            }
        }

        // MARK: - Submit

        fun submit() {
            val snapshot = _state.value
            val error = firstValidationError(snapshot)
            if (error != null) {
                _state.update { current ->
                    current.copy(
                        questionTouched = true,
                        questionError = validateQuestion(current.question),
                        toast = ToastPayload(error, isError = true),
                        shakeTrigger = current.shakeTrigger + 1,
                    )
                }
                return
            }
            _state.update { it.copy(status = StartPollFormStatus.Submitting) }
            val request = buildRequest(snapshot)
            viewModelScope.launch {
                when (val result = homesRepo.createHomePoll(homeId, request)) {
                    is NetworkResult.Success -> {
                        _state.update {
                            it.copy(
                                status = StartPollFormStatus.Success(result.data.poll.id),
                                toast = ToastPayload("Poll started.", isError = false),
                            )
                        }
                        // Hold the success toast briefly so the overlay renders
                        // before the form pops.
                        kotlinx.coroutines.delay(1_500)
                        _state.update { it.copy(shouldDismiss = true) }
                    }
                    is NetworkResult.Failure -> {
                        val message = result.error.message ?: "Couldn't start the poll."
                        _state.update {
                            it.copy(
                                status = StartPollFormStatus.Error(message),
                                toast = ToastPayload(message, isError = true),
                            )
                        }
                    }
                }
            }
        }

        // MARK: - Wire shape

        internal fun buildRequest(state: StartPollUiState = _state.value): CreatePollRequest {
            val labels =
                if (state.kind.allowsCustomOptions) {
                    state.options.map { it.label.trim() }.filter { it.isNotEmpty() }
                } else {
                    state.options.map { it.label }
                }
            val closesIso =
                state.closesAt?.let {
                    val instant = it.atZone(zone()).toInstant()
                    DateTimeFormatter.ISO_INSTANT.format(instant)
                }
            return CreatePollRequest(
                title = state.question.trim(),
                description = null,
                pollType = state.kind.wirePollType,
                options = labels.map { CreatePollOption(label = it) },
                closesAt = closesIso,
                visibility = audienceWireValue(state),
            )
        }

        /**
         * Encode the audience selection + anonymity into the backend's
         * `visibility` field. `null` → server default (all members).
         * `selected:<ids>` records the audience for the renderer; the
         * `anonymous` flag rides alongside until a structured field lands.
         */
        private fun audienceWireValue(state: StartPollUiState): String? {
            val parts = mutableListOf<String>()
            val selected = (state.audience as? StartPollAudience.SelectedMembers)?.ids
            if (!selected.isNullOrEmpty()) {
                parts += "selected:" + selected.sorted().joinToString(",")
            }
            if (state.isAnonymous) parts += "anonymous"
            return if (parts.isEmpty()) null else parts.joinToString(";")
        }

        companion object {
            /**
             * Reconfigure the options list when the user switches kinds.
             *  - Switching to YesNo replaces the list with the locked pair.
             *  - Switching away from YesNo seeds two empty editable rows.
             *  - Switching between choice kinds preserves user-typed labels.
             */
            internal fun reconfigureOptions(
                current: List<StartPollOption>,
                next: StartPollKind,
            ): List<StartPollOption> {
                if (!next.allowsCustomOptions) return defaultOptionsForKind(next)
                if (current.any { it.isLocked }) return defaultOptionsForKind(next)
                if (current.size >= StartPollBounds.MIN_OPTIONS) return current
                val seeded = current.toMutableList()
                while (seeded.size < StartPollBounds.MIN_OPTIONS) {
                    seeded += StartPollOption(label = "")
                }
                return seeded
            }
        }
    }
