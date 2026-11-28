@file:Suppress("MagicNumber")
@file:OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)

package app.pantopus.android.ui.screens.feed.reinvented

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.reinvented.ReinventedAppliedFiltersDto
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.pulse.ReinventedFilterQuery
import app.pantopus.android.data.pulse.ReinventedFilterStore
import app.pantopus.android.data.pulse.ReinventedKeptFilters
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.Instant
import javax.inject.Inject

/*
 * PHASE-5 B on Android, in PHASE-6 A2's rail: the filters of the new Pulse (CONTRACT 10a). A Filters button first in the
 * rail, with a count while anything is on; a sheet from the bottom with What (kinds, several at once), When (the map's
 * time: "When" and the time row are one setting), From (everyone or connections only) and State (unanswered Asks, plans
 * with room, new since the last visit). The same filters hold on the list and the map; one plain line under the top line
 * says what is on, with one tap to clear. Heads-ups always show (the server keeps them in). The choice is kept on this
 * phone for this person. With nothing on, every read is exactly as before.
 */

/** The kinds, as the chips are named (CONTRACT 6a's chips but All). */
internal val REINVENTED_KINDS = listOf("live", "learn", "spots", "ask", "plans", "sports")

/** The sheet's When: the time row's four that the list can follow too. */
private val WHENS = listOf("live" to "Now", "today" to "Today", "tonight" to "Tonight", "weekend" to "This weekend")
private val STATES = listOf("unanswered" to "Unanswered Asks", "room" to "Plans with room")
private const val EVERYONE = "everyone"
private const val CONNECTIONS = "connections"

/** What is filtered: the kinds, who from, the states, and "New since your last visit". */
data class ReinventedFilters(
    val kinds: List<String> = emptyList(),
    val from: String = EVERYONE,
    val state: List<String> = emptyList(),
    val fresh: Boolean = false,
) {
    /** How many are on, the When included while it isn't Now. */
    fun count(time: String): Int {
        val others = (if (from == CONNECTIONS) 1 else 0) + (if (fresh) 1 else 0) + if (time != ReinventedMapState.LIVE) 1 else 0
        return kinds.size + state.size + others
    }

    /** One kind alone and nothing else (the time aside): today's chip for it, which the list reads as before. */
    fun chip(): String? = kinds.singleOrNull()?.takeIf { from == EVERYONE && state.isEmpty() && !fresh }

    /**
     * CONTRACT 10a's fields for the list (with `when`) or the map (without); null while none is on. On the list a lone
     * kind goes as its chip ([chip]) and only `when` (if any) as a filter.
     */
    fun query(
        time: String,
        since: String?,
        list: Boolean,
    ): ReinventedFilterQuery? {
        if (list && chip() != null) {
            return time.takeIf { it in setOf("today", "tonight", "weekend") }?.let { ReinventedFilterQuery(whenTime = it) }
        }
        val q =
            ReinventedFilterQuery(
                kinds = kinds.takeIf { it.isNotEmpty() }?.joinToString(","),
                whenTime = time.takeIf { list && it in setOf("today", "tonight", "weekend") },
                from = CONNECTIONS.takeIf { from == CONNECTIONS },
                state = state.takeIf { it.isNotEmpty() }?.joinToString(","),
                since = since.takeIf { fresh },
            )
        return q.takeUnless { it == ReinventedFilterQuery() }
    }

    /** The one plain line that says what is on ("Ask, Plans · Tonight · Connections only"); null while nothing is. */
    fun words(time: String): String? {
        val parts = mutableListOf<String>()
        if (kinds.isNotEmpty()) parts += kinds.joinToString(", ") { reinventedChipTitle(it) }
        if (time != ReinventedMapState.LIVE) parts += reinventedWhenWords(time)
        if (from == CONNECTIONS) parts += "Connections only"
        state.forEach { s -> STATES.firstOrNull { it.first == s }?.let { parts += it.second } }
        if (fresh) parts += "New since your last visit"
        return parts.takeIf { it.isNotEmpty() }?.joinToString(" · ")
    }
}

/**
 * The plain line under the top line (CONTRACT 10a): written from what the server says it applied to the map's answer
 * ([applied], the map takes no `when`: its time is its When), or from the phone's own choice while no answer has said.
 */
internal fun reinventedFilterLine(
    applied: ReinventedAppliedFiltersDto?,
    phone: ReinventedFilters,
    time: String,
): String? {
    applied ?: return phone.words(time)
    val parts = mutableListOf<String>()
    applied.kinds?.takeIf { it.isNotEmpty() }?.let { kinds -> parts += kinds.joinToString(", ") { reinventedChipTitle(it) } }
    if (time != ReinventedMapState.LIVE) parts += reinventedWhenWords(time)
    if (applied.from == CONNECTIONS) parts += "Connections only"
    applied.state.orEmpty().forEach { s -> STATES.firstOrNull { it.first == s }?.let { parts += it.second } }
    if (applied.since != null) parts += "New since your last visit"
    return parts.takeIf { it.isNotEmpty() }?.joinToString(" · ")
}

/**
 * The filters, kept on this phone for the signed-in person, and the time they last opened the new Pulse here (read once
 * per visit, then this visit is kept as the next "last visit"). It follows the person: another account signed in on the
 * same phone starts with its own kept choice (none, the first time) at once, without a relaunch. Only the new Pulse
 * makes it, so nothing is written to the phone while the switch is off; while it is on, the time row's choice and each
 * visit are kept as they happen.
 */
@HiltViewModel
class ReinventedFiltersViewModel
    @Inject
    constructor(
        private val store: ReinventedFilterStore,
        auth: AuthRepository,
    ) : ViewModel() {
        private var person: String? = null

        /** The time last opened here, or null on a first visit (then "New since your last visit" can't be chosen). */
        var since: String? by mutableStateOf(null)
            private set

        private val _filters = MutableStateFlow(ReinventedFilters())
        val filters: StateFlow<ReinventedFilters> = _filters.asStateFlow()

        /** The time row's choice kept with them, for the map to open on; null when none was kept. */
        var keptTime: String? by mutableStateOf(null)
            private set

        init {
            // At once, so the first reads already carry the kept choice; then whenever the signed-in person changes.
            load(signedIn(auth.state.value))
            viewModelScope.launch {
                auth.state.collect { state ->
                    val id = signedIn(state)
                    if (id != person) load(id)
                }
            }
        }

        private fun signedIn(state: AuthRepository.State): String? = (state as? AuthRepository.State.SignedIn)?.user?.id

        /** [id]'s kept choice and last visit (none for nobody signed in), and this visit kept as the next. */
        private fun load(id: String?) {
            person = id
            val kept = id?.let(store::read)
            since = id?.let { store.visit(it, Instant.now().toString()) }
            _filters.value =
                kept?.let {
                    ReinventedFilters(
                        kinds = it.kinds.filter { k -> k in REINVENTED_KINDS },
                        from = if (it.from == CONNECTIONS) CONNECTIONS else EVERYONE,
                        state = it.state.filter { s -> STATES.any { st -> st.first == s } },
                        fresh = it.fresh && since != null,
                    )
                } ?: ReinventedFilters()
            keptTime = kept?.time?.takeIf { t -> REINVENTED_TIMES.any { it.first == t } }
        }

        private val _noPlace = MutableStateFlow(false)

        /** "No place" in the sheet's header (PHASE-6 B): off at first, for this visit only. */
        val noPlace: StateFlow<Boolean> = _noPlace.asStateFlow()

        fun noPlace(on: Boolean) {
            _noPlace.value = on
        }

        fun set(
            next: ReinventedFilters,
            time: String,
        ) {
            _filters.value = next
            keep(time)
        }

        /** The time row changed: kept with the filters. */
        fun keep(time: String) {
            val id = person ?: return
            val now = _filters.value
            store.write(id, ReinventedKeptFilters(now.kinds, now.from, now.state, now.fresh, time))
        }

        fun clear(time: String) = set(ReinventedFilters(), time)

        /**
         * The Filters card's kinds, most used first by this person's own taps here (LEAD-8 10:13: PHASE-5 B's quick taps live
         * at the top of the card); the brief's order until there is a count, and for ties.
         */
        fun kindsMostUsed(): List<String> {
            val uses = person?.let(store::uses).orEmpty()
            return REINVENTED_KINDS.sortedByDescending { uses[it] ?: 0 }
        }

        /** A kind was turned on in the card: counted for its order. */
        fun usedKind(kind: String) {
            person?.let { store.used(it, kind) }
        }

        fun update(
            time: String,
            change: (ReinventedFilters) -> ReinventedFilters,
        ) {
            _filters.update(change)
            keep(time)
        }
    }

/** The rail's Filters button: a count dot while any is on. */
@Composable
internal fun ReinventedFiltersButton(
    count: Int,
    onClick: () -> Unit,
) {
    Box(
        contentAlignment = Alignment.Center,
        modifier =
            Modifier
                .size(44.dp)
                .clip(CircleShape)
                .clickable(role = Role.Button, onClick = onClick)
                .semantics { contentDescription = if (count == 0) "Filters" else "Filters, $count on" }
                .testTag("reinventedPulse.rail.filters"),
    ) {
        val on = count > 0
        Box(
            contentAlignment = Alignment.Center,
            modifier =
                Modifier
                    .size(36.dp)
                    .clip(CircleShape)
                    .background(if (on) PantopusColors.primary600 else PantopusColors.appSurface.copy(alpha = 0.92f))
                    .border(if (on) 0.dp else 1.dp, PantopusColors.appBorder.copy(alpha = 0.7f), CircleShape),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.SlidersHorizontal,
                contentDescription = null,
                size = 18.dp,
                strokeWidth = 2.2f,
                tint = if (on) Color.White else PantopusColors.appText,
            )
        }
        if (count > 0) {
            Box(
                contentAlignment = Alignment.Center,
                modifier =
                    Modifier
                        .align(Alignment.TopEnd)
                        .size(18.dp)
                        .clip(CircleShape)
                        .background(PantopusColors.appSurface)
                        .border(1.5.dp, PantopusColors.primary600, CircleShape)
                        .testTag("reinventedPulse.rail.filters.count"),
            ) {
                Text("$count", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = PantopusColors.primary600)
            }
        }
    }
}

/** The sheet with What, When, From and State, and Clear and Done at its foot. */
@Composable
@Suppress("LongParameterList") // The choice, its callbacks, and the kinds in the person's order.
internal fun ReinventedFiltersSheet(
    filters: ReinventedFilters,
    time: String,
    canFresh: Boolean,
    onFilters: (ReinventedFilters) -> Unit,
    onTime: (String) -> Unit,
    onClear: () -> Unit,
    onDismiss: () -> Unit,
    kinds: List<String> = REINVENTED_KINDS,
    onUsed: (String) -> Unit = {},
) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = PantopusColors.appBg,
        modifier = Modifier.testTag("reinventedPulse.filters"),
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp)
                    .navigationBarsPadding()
                    .padding(bottom = 12.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Text(
                "Filters",
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                modifier = Modifier.semantics { heading() },
            )
            Group("What") {
                kinds.forEach { kind ->
                    val on = kind in filters.kinds
                    Choice(reinventedChipTitle(kind), on, "reinventedPulse.filters.kind.$kind") {
                        if (!on) onUsed(kind)
                        onFilters(filters.copy(kinds = if (on) filters.kinds - kind else filters.kinds + kind))
                    }
                }
            }
            Group("When") {
                WHENS.forEach { (key, words) -> Choice(words, time == key, "reinventedPulse.filters.when.$key") { onTime(key) } }
            }
            Group("From") {
                Choice("Everyone", filters.from == EVERYONE, "reinventedPulse.filters.from.everyone") {
                    onFilters(filters.copy(from = EVERYONE))
                }
                Choice("Connections only", filters.from == CONNECTIONS, "reinventedPulse.filters.from.connections") {
                    onFilters(filters.copy(from = CONNECTIONS))
                }
            }
            Group("State") {
                STATES.forEach { (key, words) ->
                    val on = key in filters.state
                    Choice(words, on, "reinventedPulse.filters.state.$key") {
                        onFilters(filters.copy(state = if (on) filters.state - key else filters.state + key))
                    }
                }
                // Only once a last visit is kept here: it is sent as `since`.
                Choice(
                    "New since your last visit",
                    filters.fresh,
                    "reinventedPulse.filters.state.fresh",
                    enabled = canFresh || filters.fresh,
                ) { onFilters(filters.copy(fresh = !filters.fresh)) }
            }
            Text(
                "Safety notices always show.",
                fontSize = 12.sp,
                color = PantopusColors.appTextSecondary,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                FootButton("Clear", false, "reinventedPulse.filters.clear", onClear, Modifier.weight(1f))
                FootButton("Done", true, "reinventedPulse.filters.done", onDismiss, Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun Group(
    title: String,
    content: @Composable () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(title, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appTextSecondary)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) { content() }
    }
}

/** A chip 28 dp high (44 dp to the finger), 13 sp words. */
@Composable
private fun Choice(
    words: String,
    on: Boolean,
    tag: String,
    enabled: Boolean = true,
    onClick: () -> Unit,
) {
    val shape = RoundedCornerShape(percent = 50)
    Box(
        contentAlignment = Alignment.Center,
        modifier =
            Modifier
                .heightIn(min = 44.dp)
                .selectable(selected = on, enabled = enabled, role = Role.Checkbox, onClick = onClick)
                .alpha(if (enabled) 1f else 0.4f)
                .testTag(tag),
    ) {
        Text(
            words,
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            color = if (on) Color.White else PantopusColors.appText,
            modifier =
                Modifier
                    .clip(shape)
                    .background(if (on) PantopusColors.primary600 else PantopusColors.appSurface)
                    .border(1.dp, if (on) Color.Transparent else PantopusColors.appBorder, shape)
                    .heightIn(min = 28.dp)
                    .padding(horizontal = 12.dp, vertical = 5.dp),
        )
    }
}

@Composable
private fun FootButton(
    words: String,
    primary: Boolean,
    tag: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val shape = RoundedCornerShape(percent = 50)
    Box(
        contentAlignment = Alignment.Center,
        modifier =
            modifier
                .heightIn(min = 44.dp)
                .clip(shape)
                .background(if (primary) PantopusColors.primary600 else PantopusColors.appSurface)
                .border(1.dp, if (primary) Color.Transparent else PantopusColors.appBorder, shape)
                .clickable(role = Role.Button, onClick = onClick)
                .testTag(tag),
    ) {
        Text(words, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = if (primary) Color.White else PantopusColors.appText)
    }
}
