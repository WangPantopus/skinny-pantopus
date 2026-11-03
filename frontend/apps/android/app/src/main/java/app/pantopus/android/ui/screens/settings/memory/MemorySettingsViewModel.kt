@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.settings.memory

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.ai.AIMemoryRepository
import app.pantopus.android.data.api.models.ai.AIMemoryItemDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.ui.components.ToastKind
import app.pantopus.android.ui.components.ToastMessage
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListBanner
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListGroup
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListRow
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListUiState
import app.pantopus.android.ui.screens.shared.grouped_list.RowControl
import app.pantopus.android.ui.screens.shared.grouped_list.RowMenuAction
import app.pantopus.android.ui.theme.PantopusIcon
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import javax.inject.Inject

/**
 * Settings → Privacy → What Pantopus remembers (AI assistant phase 3 contract §5.7): what the person asked the
 * assistant to remember, which only they see. Each item can be edited (a fact's words) or deleted from its row's
 * menu, everything can be forgotten at once, and once a year the list asks "Still right?" with Looks right.
 */
@HiltViewModel
class MemorySettingsViewModel
    @Inject
    constructor(
        private val memory: AIMemoryRepository,
    ) : ViewModel() {
        val title: String = "What Pantopus remembers"

        private val _state = MutableStateFlow<GroupedListUiState>(GroupedListUiState.Loading)
        val state: StateFlow<GroupedListUiState> = _state.asStateFlow()

        /** True once a read found nothing saved: the screen shows the empty text under its header line. */
        private val _isEmpty = MutableStateFlow(false)
        val isEmpty: StateFlow<Boolean> = _isEmpty.asStateFlow()

        /** "It's been a year. Still right?" while a review is due. */
        private val _banner = MutableStateFlow<GroupedListBanner?>(null)
        val banner: StateFlow<GroupedListBanner?> = _banner.asStateFlow()

        private val _refreshing = MutableStateFlow(false)
        val refreshing: StateFlow<Boolean> = _refreshing.asStateFlow()

        private val _toast = MutableStateFlow<ToastMessage?>(null)
        val toast: StateFlow<ToastMessage?> = _toast.asStateFlow()

        /** The fact being edited, with its draft words; null while no editor is open. */
        private val _editing = MutableStateFlow<Editing?>(null)
        val editing: StateFlow<Editing?> = _editing.asStateFlow()

        /** How many items "Forget everything" would delete, while its confirmation is up. */
        private val _confirmForgetAll = MutableStateFlow<Int?>(null)
        val confirmForgetAll: StateFlow<Int?> = _confirmForgetAll.asStateFlow()

        /** A change is on its way (Forget everything, Looks right): their buttons wait. */
        private val _busy = MutableStateFlow(false)
        val busy: StateFlow<Boolean> = _busy.asStateFlow()

        data class Editing(
            val id: String,
            val text: String,
            val saving: Boolean = false,
            val error: String? = null,
        )

        private var items: List<AIMemoryItemDto> = emptyList()
        private var reviewDue: Boolean = false
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
                when (val result = memory.list()) {
                    is NetworkResult.Success -> {
                        items = result.data.items
                        reviewDue = isDue(result.data.reviewDueAt)
                        loaded = true
                        rebuild()
                    }
                    is NetworkResult.Failure ->
                        if (loaded) {
                            // The list on screen stays; only the refresh failed.
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
            if (rowId == ROW_FORGET_ALL && items.isNotEmpty() && !_busy.value) _confirmForgetAll.value = items.size
        }

        fun onRowMenu(
            rowId: String,
            actionId: String,
        ) {
            val item = items.firstOrNull { it.id == rowId } ?: return
            when (actionId) {
                ACTION_EDIT -> if (item.kind == KIND_FACT) _editing.value = Editing(item.id, item.fact)
                ACTION_DELETE -> forget(item)
            }
        }

        fun onEditText(text: String) {
            _editing.value = _editing.value?.copy(text = text, error = null)
        }

        fun dismissEdit() {
            if (_editing.value?.saving != true) _editing.value = null
        }

        /** Saves the new words; the server checks them as a new fact, and its reason shows in the editor. */
        fun saveEdit() {
            val editing = _editing.value ?: return
            val fact = editing.text.trim()
            if (editing.saving || fact.length !in FACT_LENGTH) return
            if (fact == items.firstOrNull { it.id == editing.id }?.fact) {
                _editing.value = null
                return
            }
            _editing.value = editing.copy(saving = true, error = null)
            viewModelScope.launch {
                when (val result = memory.edit(editing.id, fact)) {
                    is NetworkResult.Success -> {
                        _editing.value = null
                        items = items.map { if (it.id == result.data.id) result.data else it }
                        // Editing an item counts as reviewing it; the next read says whether others are still due.
                        rebuild()
                        _toast.value = ToastMessage("Saved.", ToastKind.Success)
                    }
                    is NetworkResult.Failure -> {
                        if (result.error is NetworkError.NotFound) {
                            _editing.value = null
                            dropItem(editing.id)
                            _toast.value = ToastMessage("That item was already deleted.", ToastKind.Neutral)
                        } else {
                            _editing.value = _editing.value?.copy(saving = false, error = result.error.message)
                        }
                    }
                }
            }
        }

        private fun forget(item: AIMemoryItemDto) {
            viewModelScope.launch {
                when (val result = memory.forget(item.id)) {
                    is NetworkResult.Success -> {
                        dropItem(item.id)
                        _toast.value = ToastMessage("Deleted.", ToastKind.Success)
                    }
                    is NetworkResult.Failure ->
                        if (result.error is NetworkError.NotFound) {
                            // Gone already (another phone): the list catches up.
                            dropItem(item.id)
                        } else {
                            _toast.value = ToastMessage("Couldn't delete it. ${result.error.message}", ToastKind.Error)
                        }
                }
            }
        }

        fun dismissForgetAll() {
            if (!_busy.value) _confirmForgetAll.value = null
        }

        fun confirmForgetAll() {
            if (_busy.value) return
            _busy.value = true
            viewModelScope.launch {
                when (val result = memory.forgetAll()) {
                    is NetworkResult.Success -> {
                        _confirmForgetAll.value = null
                        items = emptyList()
                        reviewDue = false
                        rebuild()
                        _toast.value = ToastMessage("Pantopus forgot everything you saved.", ToastKind.Success)
                    }
                    is NetworkResult.Failure -> {
                        _confirmForgetAll.value = null
                        _toast.value = ToastMessage("Couldn't forget everything. ${result.error.message}", ToastKind.Error)
                    }
                }
                _busy.value = false
            }
        }

        /** "Looks right": every item counts as reviewed for another year. */
        fun lookRight() {
            if (_busy.value) return
            _busy.value = true
            viewModelScope.launch {
                when (val result = memory.reviewed()) {
                    is NetworkResult.Success -> {
                        reviewDue = isDue(result.data.reviewDueAt)
                        rebuild()
                        _toast.value = ToastMessage("Thanks. Pantopus will ask again next year.", ToastKind.Success)
                    }
                    is NetworkResult.Failure ->
                        _toast.value = ToastMessage("Couldn't save that. ${result.error.message}", ToastKind.Error)
                }
                _busy.value = false
            }
        }

        private fun dropItem(id: String) {
            items = items.filterNot { it.id == id }
            if (items.isEmpty()) reviewDue = false
            rebuild()
        }

        private fun rebuild() {
            _isEmpty.value = items.isEmpty()
            _banner.value =
                if (reviewDue && items.isNotEmpty()) {
                    GroupedListBanner(
                        icon = PantopusIcon.History,
                        title = "It's been a year. Still right?",
                        subtitle = "Keep, edit or delete what's here.",
                        actionLabel = "Looks right",
                        actionTestTag = TAG_LOOKS_RIGHT,
                    )
                } else {
                    null
                }
            if (items.isEmpty()) {
                _state.value = GroupedListUiState.Loaded(groups = emptyList())
                return
            }
            val groups =
                listOf(
                    GroupedListGroup(
                        id = "items",
                        overline = if (items.size == 1) "1 thing saved" else "${items.size} things saved",
                        helper = if (items.size >= NEAR_LIMIT) "Pantopus can remember $LIMIT things. Delete some to make room." else null,
                        rows = items.map(::row),
                    ),
                    GroupedListGroup(
                        id = "forget",
                        rows =
                            listOf(
                                GroupedListRow(
                                    id = ROW_FORGET_ALL,
                                    label = "Forget everything",
                                    control = RowControl.Chevron,
                                    destructive = true,
                                    testTag = TAG_FORGET_ALL,
                                ),
                            ),
                    ),
                )
            _state.value = GroupedListUiState.Loaded(groups = groups)
        }

        private fun row(item: AIMemoryItemDto): GroupedListRow =
            GroupedListRow(
                id = item.id,
                label = item.fact,
                subtext = caption(item),
                control =
                    RowControl.Menu(
                        listOfNotNull(
                            RowMenuAction(ACTION_EDIT, "Edit", PantopusIcon.Pencil, testTag = TAG_EDIT).takeIf { item.kind == KIND_FACT },
                            RowMenuAction(ACTION_DELETE, "Delete", PantopusIcon.Trash2, destructive = true, testTag = TAG_DELETE),
                        ),
                    ),
                testTag = TAG_ROW,
            )

        companion object {
            const val TAG_LIST = "memory.list"
            const val TAG_ROW = "memory.row"
            const val TAG_EDIT = "memory.edit"
            const val TAG_DELETE = "memory.delete"
            const val TAG_FORGET_ALL = "memory.forgetAll"
            const val TAG_FORGET_ALL_CONFIRM = "memory.forgetAll.confirm"
            const val TAG_LOOKS_RIGHT = "memory.lookRight"
            const val TAG_EDITOR = "memory.editor"
            const val TAG_EDITOR_FIELD = "memory.editor.field"
            const val TAG_EDITOR_SAVE = "memory.editor.save"

            /** A fact's length, as the server checks it (§5.1). */
            val FACT_LENGTH = 3..280

            private const val ROW_FORGET_ALL = "forgetAll"
            private const val ACTION_EDIT = "edit"
            private const val ACTION_DELETE = "delete"
            private const val KIND_FACT = "fact"
            private const val LIMIT = 100
            private const val NEAR_LIMIT = 90

            private val TOPICS =
                mapOf(
                    "you" to "About you",
                    "household" to "Household",
                    "home" to "Home",
                    "plans" to "Plans",
                    "nearby" to "Nearby",
                    "other" to "Other",
                )

            /**
             * "Home · Maple St · Private · From a chat on Oct 22": the topic, the home, "Private" for a sensitive item and
             * where it came from. An item whose home the person left says it isn't used.
             */
            internal fun caption(
                item: AIMemoryItemDto,
                zone: ZoneId = ZoneId.systemDefault(),
                now: Instant = Instant.now(),
            ): String {
                val about =
                    if (item.inUse == false) {
                        listOf("Not used: you're no longer in this home")
                    } else {
                        listOfNotNull(
                            if (item.kind == "plan_alert") "Plan alert" else TOPICS[item.topic],
                            item.home?.label?.trim()?.ifEmpty { null },
                        )
                    }
                val onlyWhenAsked = "Private".takeIf { item.sensitive == true }
                val fromChat = item.from?.at?.let { day(it, zone, now) }?.let { "From a chat on $it" }
                val saved = fromChat ?: item.createdAt?.let { day(it, zone, now) }?.let { "Saved $it" }
                return (about + listOfNotNull(onlyWhenAsked, saved)).joinToString(" · ")
            }

            private fun day(
                iso: String,
                zone: ZoneId,
                now: Instant,
            ): String? {
                val date = runCatching { Instant.parse(iso) }.getOrNull()?.atZone(zone)?.toLocalDate() ?: return null
                val pattern = if (date.year == now.atZone(zone).year) "MMM d" else "MMM d, yyyy"
                return date.format(DateTimeFormatter.ofPattern(pattern, Locale.US))
            }

            private fun isDue(reviewDueAt: String?): Boolean =
                reviewDueAt?.let { runCatching { Instant.parse(it) }.getOrNull() }?.let { !it.isAfter(Instant.now()) } == true
        }
    }
