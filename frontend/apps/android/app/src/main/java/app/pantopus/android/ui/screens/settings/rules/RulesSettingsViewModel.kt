@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.settings.rules

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.ai.AIRulesRepository
import app.pantopus.android.data.api.models.ai.AIRuleDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.ui.components.ToastKind
import app.pantopus.android.ui.components.ToastMessage
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListGroup
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListRow
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListUiState
import app.pantopus.android.ui.screens.shared.grouped_list.RowControl
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import javax.inject.Inject

/**
 * Settings → Privacy → What Pantopus does for you (AI assistant phase 3 contract §18.5): the person's standing rules.
 * Each shows its sentence with a switch, a weekly plan's "Until Sat, Jan 16" with Extend, why it paused, its last runs
 * (each opening its plan) and Delete with a confirmation.
 */
@HiltViewModel
class RulesSettingsViewModel
    @Inject
    constructor(
        private val rules: AIRulesRepository,
    ) : ViewModel() {
        val title: String = "What Pantopus does for you"

        private val _state = MutableStateFlow<GroupedListUiState>(GroupedListUiState.Loading)
        val state: StateFlow<GroupedListUiState> = _state.asStateFlow()

        private val _isEmpty = MutableStateFlow(false)
        val isEmpty: StateFlow<Boolean> = _isEmpty.asStateFlow()

        private val _footer = MutableStateFlow<String?>(null)
        val footer: StateFlow<String?> = _footer.asStateFlow()

        private val _refreshing = MutableStateFlow(false)
        val refreshing: StateFlow<Boolean> = _refreshing.asStateFlow()

        private val _toast = MutableStateFlow<ToastMessage?>(null)
        val toast: StateFlow<ToastMessage?> = _toast.asStateFlow()

        /** The rule whose Delete waits for its confirmation. */
        private val _confirmDelete = MutableStateFlow<AIRuleDto?>(null)
        val confirmDelete: StateFlow<AIRuleDto?> = _confirmDelete.asStateFlow()

        /** A run's plan to open with the deep-link router. */
        private val _openLink = MutableSharedFlow<String>(extraBufferCapacity = 1)
        val openLink: SharedFlow<String> = _openLink.asSharedFlow()

        private var list: List<AIRuleDto> = emptyList()
        private var limit: Int = DEFAULT_LIMIT

        /** Rules with a change on its way: their switch and buttons wait. */
        private val saving = mutableSetOf<String>()

        /** A switch flipped while its change is on its way shows where the person put it. */
        private val requested = mutableMapOf<String, Boolean>()
        private var loaded = false
        private var reading = false

        fun load() = read(pull = false)

        fun refresh() = read(pull = true)

        private fun read(pull: Boolean) {
            if (reading) return
            reading = true
            _refreshing.value = pull && loaded
            if (!loaded) _state.value = GroupedListUiState.Loading
            viewModelScope.launch {
                when (val result = rules.list()) {
                    is NetworkResult.Success -> {
                        list = result.data.rules
                        limit = result.data.limit ?: DEFAULT_LIMIT
                        loaded = true
                        rebuild()
                    }
                    is NetworkResult.Failure ->
                        if (loaded) {
                            _toast.value = ToastMessage("Couldn't refresh. ${result.error.message}", ToastKind.Error)
                        } else {
                            _state.value = GroupedListUiState.Error(result.error.message)
                        }
                }
                reading = false
                _refreshing.value = false
            }
        }

        fun consumeToast() {
            _toast.value = null
        }

        fun onTapRow(rowId: String) {
            val (what, id) = rowId.split(':', limit = 2).takeIf { it.size == 2 }?.let { it[0] to it[1] } ?: return
            when (what) {
                ROW_EXTEND -> extend(id)
                ROW_DELETE -> list.firstOrNull { it.id == id }?.takeIf { it.id !in saving }?.let { _confirmDelete.value = it }
                ROW_RUN -> {
                    val (ruleId, index) = id.split(':', limit = 2).takeIf { it.size == 2 } ?: return
                    val run = list.firstOrNull { it.id == ruleId }?.runs?.getOrNull(index.toIntOrNull() ?: return)
                    run?.link?.let { _openLink.tryEmit(it) }
                }
            }
        }

        fun onToggle(
            rowId: String,
            isOn: Boolean,
        ) {
            val id = rowId.removePrefix("$ROW_SWITCH:").takeIf { it != rowId } ?: return
            if (id in saving) return
            requested[id] = isOn
            change(id, if (isOn) "Turned on." else "Turned off.") { rules.setEnabled(id, isOn) }
        }

        private fun extend(id: String) {
            if (id in saving) return
            change(id, null) { rules.extend(id) }
        }

        private fun change(
            id: String,
            done: String?,
            send: suspend () -> NetworkResult<AIRuleDto>,
        ) {
            saving += id
            rebuild()
            viewModelScope.launch {
                when (val result = send()) {
                    is NetworkResult.Success -> {
                        list = list.map { if (it.id == id) result.data else it }
                        val message = done ?: result.data.endsAt?.let { "Runs until ${day(it)}." } ?: "Extended."
                        _toast.value = ToastMessage(message, ToastKind.Success)
                    }
                    is NetworkResult.Failure ->
                        if (result.error is NetworkError.NotFound) {
                            list = list.filterNot { it.id == id }
                        } else {
                            // The switch goes back; the server says why (a rule that can't run says so).
                            _toast.value = ToastMessage(result.error.message, ToastKind.Error)
                        }
                }
                saving -= id
                requested -= id
                rebuild()
            }
        }

        fun dismissDelete() {
            _confirmDelete.value = null
        }

        fun confirmDelete() {
            val rule = _confirmDelete.value ?: return
            _confirmDelete.value = null
            saving += rule.id
            rebuild()
            viewModelScope.launch {
                when (val result = rules.delete(rule.id)) {
                    is NetworkResult.Success -> {
                        list = list.filterNot { it.id == rule.id }
                        _toast.value = ToastMessage("Deleted. Pantopus won't do it anymore.", ToastKind.Success)
                    }
                    is NetworkResult.Failure ->
                        if (result.error is NetworkError.NotFound) {
                            list = list.filterNot { it.id == rule.id }
                        } else {
                            _toast.value = ToastMessage("Couldn't delete it. ${result.error.message}", ToastKind.Error)
                        }
                }
                saving -= rule.id
                rebuild()
            }
        }

        private fun rebuild() {
            _isEmpty.value = list.isEmpty()
            _footer.value = if (list.isEmpty()) null else "Pantopus can keep up to $limit of these."
            _state.value = GroupedListUiState.Loaded(groups = list.map(::group))
        }

        private fun group(rule: AIRuleDto): GroupedListGroup {
            val busy = rule.id in saving
            val rows =
                buildList {
                    add(
                        GroupedListRow(
                            id = "$ROW_SWITCH:${rule.id}",
                            label = rule.summary,
                            subtext = statusLine(rule),
                            control = RowControl.Toggle(requested[rule.id] ?: rule.enabled),
                            testTag = TAG_ROW,
                            toggleEnabled = !busy,
                            toggleTestTag = TAG_SWITCH,
                        ),
                    )
                    // A weekly plan runs for a set time: "Until Sat, Jan 16", with Extend.
                    if (rule.kind == KIND_PLAN_REPEAT) {
                        rule.endsAt?.let { ends ->
                            add(
                                GroupedListRow(
                                    id = "$ROW_EXTEND:${rule.id}",
                                    label = "Until ${day(ends)}",
                                    control =
                                        RowControl.ChipStatus(
                                            if (busy) "Extending…" else "Extend",
                                            RowControl.ChipTone.Info,
                                            includesChevron = false,
                                        ),
                                    testTag = TAG_EXTEND,
                                ),
                            )
                        }
                    }
                    rule.runs.forEachIndexed { index, run ->
                        add(
                            GroupedListRow(
                                id = "$ROW_RUN:${rule.id}:$index",
                                label = run.label ?: if (run.status == "error") "Couldn't run" else "Done",
                                subtext = if (run.status == "error") "Pantopus couldn't do it this time." else null,
                                control = if (run.link != null) RowControl.Chevron else RowControl.None,
                                testTag = TAG_RUN,
                            ),
                        )
                    }
                    add(
                        GroupedListRow(
                            id = "$ROW_DELETE:${rule.id}",
                            label = "Delete this rule",
                            control = RowControl.Chevron,
                            destructive = true,
                            testTag = TAG_DELETE,
                        ),
                    )
                }
            return GroupedListGroup(
                id = rule.id,
                overline = if (rule.kind == KIND_PLAN_REPEAT) "Weekly plan" else "Pickup reminder",
                helper = if (rule.runs.isEmpty()) null else "Last runs, newest first.",
                rows = rows,
            )
        }

        companion object {
            const val TAG_LIST = "rules.list"
            const val TAG_ROW = "rules.row"
            const val TAG_SWITCH = "rules.switch"
            const val TAG_EXTEND = "rules.extend"
            const val TAG_RUN = "rules.run"
            const val TAG_DELETE = "rules.delete"
            const val TAG_DELETE_CONFIRM = "rules.delete.confirm"

            private const val ROW_SWITCH = "switch"
            private const val ROW_EXTEND = "extend"
            private const val ROW_RUN = "run"
            private const val ROW_DELETE = "delete"
            private const val KIND_PLAN_REPEAT = "plan_repeat"
            private const val DEFAULT_LIMIT = 5

            /** On, off, or why it stopped on its own (contract §18.2's paused reasons). */
            internal fun statusLine(rule: AIRuleDto): String =
                when {
                    rule.enabled -> "On. Pantopus tells you each time."
                    rule.pausedReason == "nobody_came" -> "Paused: nobody joined two weeks in a row."
                    rule.pausedReason == "cannot_post" -> "Paused: Pantopus couldn't post it."
                    rule.pausedReason == "ended" -> "Ended: its 12 weeks are up. Extend it to keep going."
                    rule.pausedReason == "member_left" ->
                        "Paused: that person left the household, or you can no longer assign tasks there."
                    else -> "Off."
                }

            /** "Sat, Jan 16", on this phone's calendar. */
            internal fun day(
                iso: String,
                zone: ZoneId = ZoneId.systemDefault(),
            ): String =
                runCatching { Instant.parse(iso).atZone(zone).format(DateTimeFormatter.ofPattern("EEE, MMM d", Locale.US)) }
                    .getOrDefault(iso)
        }
    }
