@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.mailbox.cards

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.BottomSheetDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.mailbox.CardTown
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.mailbox.HolidayCardsRepository
import app.pantopus.android.data.network.NetworkMonitor
import app.pantopus.android.ui.components.firstTapClosesKeyboard
import app.pantopus.android.ui.components.sheetKeyboardRules
import app.pantopus.android.ui.screens.mailbox.components.mailMessage
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Spacing
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/** "Where does it start?": what was typed, the towns found for it, the nearest town to offer, and what went wrong. */
data class CardTownState(
    val query: String = "",
    val towns: List<CardTown> = emptyList(),
    /** The town nearest where the person is ("Use Vancouver, WA"); null when there's none to offer. */
    val suggested: CardTown? = null,
    val looking: Boolean = false,
    /** A town is being kept. */
    val keeping: Boolean = false,
    val problem: String? = null,
    /** Typed something and nothing matched. */
    val nothing: Boolean = false,
)

/**
 * The town a travelling card starts from, or passes on from, for someone with no home and no town yet (travelling card
 * plan Part 2, decision D4): asked once, kept in their profile's town fields. Reads `GET /api/mailbox/cards/towns` and
 * keeps the town with `PUT /api/mailbox/cards/town`.
 */
@HiltViewModel
class CardTownViewModel
    @Inject
    constructor(
        private val repo: HolidayCardsRepository,
        private val network: NetworkMonitor,
    ) : ViewModel() {
        private val _state = MutableStateFlow(CardTownState())
        val state: StateFlow<CardTownState> = _state.asStateFlow()
        private val typed = MutableStateFlow("")

        init {
            // The town to offer, from where the person is.
            viewModelScope.launch {
                (repo.towns(null) as? NetworkResult.Success)?.data?.suggested?.let { near -> _state.update { it.copy(suggested = near) } }
            }
            // The towns for what's typed, a quarter second after the typing stops.
            viewModelScope.launch {
                typed.collectLatest { raw ->
                    val q = raw.trim()
                    if (q.length < 2) {
                        _state.update { it.copy(towns = emptyList(), looking = false, nothing = false) }
                        return@collectLatest
                    }
                    delay(TOWN_SEARCH_PAUSE_MS)
                    _state.update { it.copy(looking = true, problem = null) }
                    when (val result = repo.towns(q)) {
                        is NetworkResult.Success ->
                            _state.update { it.copy(towns = result.data.towns, looking = false, nothing = result.data.towns.isEmpty()) }
                        is NetworkResult.Failure ->
                            _state.update {
                                it.copy(
                                    looking = false,
                                    problem = result.error.mailMessage(online = network.isOnline.value, doing = "look up towns"),
                                )
                            }
                    }
                }
            }
        }

        fun onQuery(text: String) {
            _state.update { it.copy(query = text) }
            typed.value = text
        }

        /** Keeps [town] as theirs; [onKept] gets its words ("Vancouver, WA") once the server has it. */
        fun choose(
            town: CardTown,
            onKept: (String) -> Unit,
        ) {
            if (_state.value.keeping) return
            _state.update { it.copy(keeping = true, problem = null) }
            viewModelScope.launch {
                when (val result = repo.keepTown(town.id)) {
                    is NetworkResult.Success -> {
                        _state.update { it.copy(keeping = false) }
                        onKept(result.data ?: town.label)
                    }
                    is NetworkResult.Failure ->
                        _state.update {
                            it.copy(
                                keeping = false,
                                problem = result.error.mailMessage(online = network.isOnline.value, doing = "keep your town"),
                            )
                        }
                }
            }
        }
    }

/** The towns are looked up this long after the typing stops. */
private const val TOWN_SEARCH_PAUSE_MS = 250L

/**
 * "Where does it start?" (travelling card plan Part 2): one small sheet with "Your town or ZIP code", the towns that
 * match, and "Use Vancouver, WA" when the phone's place gives one. Choosing keeps the town and calls [onKept] with it;
 * the sheet is asked once. Pass it on asks with the same sheet (Part 4).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun CardTownSheet(
    onKept: (town: String) -> Unit,
    onDismiss: () -> Unit,
    model: CardTownViewModel = hiltViewModel(),
) {
    val state by model.state.collectAsStateWithLifecycle()
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = PantopusColors.cardDesk,
        dragHandle = { BottomSheetDefaults.DragHandle(color = PantopusColors.cardFieldEdge) },
        modifier = Modifier.sheetKeyboardRules().testTag("cardTownSheet"),
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(start = Spacing.s5, end = Spacing.s5, bottom = Spacing.s6),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            Text(
                "Where does it start?",
                fontFamily = FontFamily.Serif,
                fontSize = 24.sp,
                lineHeight = 30.sp,
                color = PantopusColors.cardTextStrong,
                modifier = Modifier.semantics { heading() },
            )
            DeskField(
                value = state.query,
                onValueChange = model::onQuery,
                placeholder = "Your town or ZIP code",
                label = "Your town or ZIP code",
                leadingSearch = true,
                imeAction = ImeAction.Search,
                tag = "cardTownField",
            )
            Column(modifier = Modifier.firstTapClosesKeyboard().semantics { liveRegion = LiveRegionMode.Polite }) {
                state.towns.forEachIndexed { index, town ->
                    if (index > 0) HorizontalDivider(color = PantopusColors.cardFieldEdge)
                    TownRow(town.label, enabled = !state.keeping, tag = "cardTown.${town.id}") { model.choose(town, onKept) }
                }
                when {
                    state.looking && state.towns.isEmpty() -> TownLine("Looking…")
                    state.nothing -> TownLine("No town by that name or ZIP code. Try another spelling.")
                }
            }
            state.suggested?.let { near ->
                CardButton(
                    "Use ${near.label}",
                    onClick = { model.choose(near, onKept) },
                    kind = CardButtonKind.Paper,
                    enabled = !state.keeping,
                    busy = state.keeping,
                    modifier = Modifier.testTag("cardTownUseNearest"),
                )
            }
            state.problem?.let {
                Text(
                    it,
                    fontSize = 14.sp,
                    lineHeight = 20.sp,
                    color = PantopusColors.cardWax,
                    modifier = Modifier.semantics { liveRegion = LiveRegionMode.Assertive }.testTag("cardTownProblem"),
                )
            }
        }
    }
}

/** One town found: its name and state, 48 dp to touch. */
@Composable
private fun TownRow(
    words: String,
    enabled: Boolean,
    tag: String,
    onClick: () -> Unit,
) {
    Text(
        words,
        fontSize = 16.sp,
        lineHeight = 22.sp,
        color = PantopusColors.cardTextStrong,
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 48.dp)
                .clickable(enabled = enabled, role = Role.Button, onClick = onClick)
                .padding(vertical = 13.dp)
                .testTag(tag),
    )
}

@Composable
private fun TownLine(words: String) {
    Text(
        words,
        fontSize = 14.sp,
        lineHeight = 20.sp,
        color = PantopusColors.cardTextQuiet,
        modifier = Modifier.padding(vertical = Spacing.s2),
    )
}
