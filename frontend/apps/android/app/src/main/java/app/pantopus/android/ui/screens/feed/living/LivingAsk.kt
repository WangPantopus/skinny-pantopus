@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.feed.living

import android.content.Context
import android.media.AudioDeviceInfo
import android.media.AudioManager
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.media3.common.AudioAttributes
import androidx.media3.common.MediaItem
import androidx.media3.exoplayer.ExoPlayer
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.living.LivingAskMatchDto
import app.pantopus.android.data.living.LivingRepository
import app.pantopus.android.data.living.searchRefusal
import app.pantopus.android.data.pulse.ReinventedBox
import app.pantopus.android.ui.screens.feed.reinvented.ReinventedMapItem
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject
import kotlin.math.cos

/*
 * "Pulse, reinvented" phase 4, Ask the map (PHASE-4 piece 3; CONTRACT 9b), as the iPhone's (`ReinventedAskTheMap.swift`)
 * and the web's (`AskTheMap.tsx`): at the Pulse map's Map height, type "cozy study cafe" and the pins in view that match
 * light up while the rest dim. The words and the map's own box and time go in a POST body, never in an address, and are
 * never kept. The server answers only what this reader's map already shows for the time in view; the map lights those,
 * each with the words it matched.
 */

/** What the map was asked, and the pins it lit. */
data class LivingAskState(
    val q: String? = null,
    /** The map's pin ids (`ring-…`, `mark-…`, `kept-…`) that matched, with the words each matched; null while not asked. */
    val lit: Map<String, List<String>>? = null,
    val more: Boolean = false,
    val asking: Boolean = false,
    val error: String? = null,
    /** How many of the pins in view are lit. */
    val shown: Int = 0,
    /** Listen to the town (CONTRACT 9g) is on. */
    val listening: Boolean = false,
    /** The Moment whose place sound plays now. */
    val playing: String? = null,
    /** None of the Moments in view kept a place sound. */
    val quiet: Boolean = false,
    /** Headphones (wired, USB or Bluetooth) are on: no "Best with headphones." */
    val headphones: Boolean = false,
)

/**
 * Ask the map, and Listen to the town. One per Pulse screen (the bar and the map share it through `hiltViewModel()`):
 * the map tells it the box, time and pins it shows once it settles ([mapAt]); the bar asks, and turns Listen on or off.
 *
 * Listen to the town (PHASE-4 piece 7; CONTRACT 9g), as the iPhone's (`ReinventedTownSound.swift`): with Listen on, the
 * map plays the place sound kept with the Moment nearest its middle, and as the map is dragged across the town the sound
 * changes. Only what an author kept as place sound for people nearby (never a voice or a whisper); the server decides
 * which. Best with headphones, and it says so. It stops when Listen goes off or the bar leaves the screen.
 */
@HiltViewModel
class LivingAskViewModel
    @Inject
    constructor(
        private val repository: LivingRepository,
        @ApplicationContext private val context: Context,
    ) : ViewModel() {
        private val _state = MutableStateFlow(LivingAskState())
        val state: StateFlow<LivingAskState> = _state.asStateFlow()

        private var box: ReinventedBox? = null
        private var time: String? = null
        private var items: List<ReinventedMapItem> = emptyList()
        private var matches: List<LivingAskMatchDto> = emptyList()
        private var asking: Job? = null
        private var hearing: Job? = null
        private var player: ExoPlayer? = null

        /** The map settled on [next] for [at], showing [shown]. A new time clears what was asked. */
        fun mapAt(
            next: ReinventedBox?,
            at: String,
            shown: List<ReinventedMapItem>,
        ) {
            if (time != null && at != time) clear()
            box = next ?: box
            time = at
            items = shown
            if (_state.value.lit != null) light()
            if (_state.value.listening) hear()
        }

        fun toggleListen() {
            if (_state.value.listening) {
                stopListening()
            } else {
                _state.update { it.copy(listening = true, headphones = headphonesOn()) }
                hear()
            }
        }

        /** Listen off: the sound stops at once. */
        fun stopListening() {
            hearing?.cancel()
            player?.release()
            player = null
            if (_state.value.listening) _state.update { it.copy(listening = false, playing = null, quiet = false) }
        }

        /** Plays the place sound nearest the map's middle, if it isn't the one playing. */
        private fun hear() {
            val area = box ?: return
            val at = time ?: return
            hearing?.cancel()
            hearing =
                viewModelScope.launch {
                    val sounds = (repository.sounds(area, at) as? NetworkResult.Success)?.data ?: return@launch
                    if (!_state.value.listening) return@launch
                    val middleLat = (area.south + area.north) / 2
                    val middleLng = (area.west + area.east) / 2
                    val nearest =
                        sounds.minByOrNull { sound ->
                            val dLat = sound.latitude - middleLat
                            val dLng = (sound.longitude - middleLng) * cos(Math.toRadians(middleLat))
                            dLat * dLat + dLng * dLng
                        }
                    if (nearest == null) {
                        player?.release()
                        player = null
                        _state.update { it.copy(playing = null, quiet = true, headphones = headphonesOn()) }
                        return@launch
                    }
                    _state.update { it.copy(quiet = false, headphones = headphonesOn()) }
                    if (nearest.momentId == _state.value.playing) return@launch
                    _state.update { it.copy(playing = nearest.momentId) }
                    play(nearest.url)
                }
        }

        private fun play(url: String) {
            player?.release()
            player =
                ExoPlayer.Builder(context).build().apply {
                    // Mixes with what else plays, as the iPhone's: no audio focus taken.
                    setAudioAttributes(AudioAttributes.DEFAULT, false)
                    setMediaItem(MediaItem.fromUri(url))
                    prepare()
                    playWhenReady = true
                }
        }

        private fun headphonesOn(): Boolean {
            val audio = context.getSystemService(AudioManager::class.java) ?: return false
            return audio.getDevices(AudioManager.GET_DEVICES_OUTPUTS).any { it.type in HEADPHONES }
        }

        override fun onCleared() {
            player?.release()
            player = null
        }

        fun ask(text: String) {
            val q = text.trim().take(MAX_WORDS)
            val area = box ?: return
            val at = time ?: return
            if (q.length < 2) return
            asking?.cancel()
            _state.update { it.copy(asking = true, error = null) }
            asking =
                viewModelScope.launch {
                    when (val answer = repository.askMap(q, area, at)) {
                        is NetworkResult.Success -> {
                            matches = answer.data.matches
                            _state.update { it.copy(q = q, more = answer.data.more, asking = false) }
                            light()
                        }
                        is NetworkResult.Failure -> _state.update { it.copy(asking = false, error = searchRefusal(answer.error)) }
                    }
                }
        }

        /** Every pin back. */
        fun clear() {
            asking?.cancel()
            matches = emptyList()
            _state.value = LivingAskState()
        }

        /** A Moment lights its ring (or the reader's own kept pin); a post lights its mark. */
        private fun light() {
            val byMoment = mutableMapOf<String, String>()
            val byPost = mutableMapOf<String, String>()
            items.forEach { item ->
                when (item) {
                    is ReinventedMapItem.Ring -> item.ring.moments.forEach { byMoment[it.id] = item.id }
                    is ReinventedMapItem.Kept -> byMoment[item.kept.moment.id] = item.id
                    is ReinventedMapItem.Mark -> byPost[item.mark.post.id] = item.id
                    is ReinventedMapItem.Ticket -> Unit
                }
            }
            val lit = mutableMapOf<String, MutableList<String>>()
            matches.forEach { match ->
                val pin = (if (match.type == "post") byPost[match.id] else byMoment[match.id]) ?: return@forEach
                val words = lit.getOrPut(pin) { mutableListOf() }
                match.words.filterNot { it in words }.forEach { words += it }
            }
            _state.update { it.copy(lit = lit, shown = lit.size) }
        }

        private companion object {
            const val MAX_WORDS = 100
            val HEADPHONES =
                setOf(
                    AudioDeviceInfo.TYPE_WIRED_HEADPHONES,
                    AudioDeviceInfo.TYPE_WIRED_HEADSET,
                    AudioDeviceInfo.TYPE_BLUETOOTH_A2DP,
                    AudioDeviceInfo.TYPE_USB_HEADSET,
                    AudioDeviceInfo.TYPE_BLE_HEADSET,
                )
        }
    }

/** The bar under the time row at the Map height: "Ask the map", and what it lit. Leaving the bar brings every pin back. */
@Composable
internal fun LivingAskBar(
    modifier: Modifier = Modifier,
    viewModel: LivingAskViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    var text by rememberSaveable { mutableStateOf("") }
    val focus = LocalFocusManager.current
    DisposableEffect(viewModel) {
        onDispose {
            viewModel.clear()
            viewModel.stopListening()
        }
    }
    Column(
        modifier = modifier.fillMaxWidth().padding(horizontal = Spacing.s4).padding(top = Spacing.s2),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        val shape = RoundedCornerShape(percent = 50)
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            LivingSearchBox(
                text = text,
                look = ASK_LOOK,
                mode =
                    when {
                        state.asking -> LivingSearchMode.BUSY
                        state.lit != null || text.isNotEmpty() -> LivingSearchMode.CLEARABLE
                        else -> LivingSearchMode.PLAIN
                    },
                onText = { text = it },
                onSearch = {
                    viewModel.ask(text)
                    focus.clearFocus()
                },
                onClear = {
                    text = ""
                    viewModel.clear()
                },
                modifier = Modifier.weight(1f),
            )
            ListenButton(state.listening, viewModel::toggleListen)
        }
        said(state)?.let {
            Text(
                it,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                modifier =
                    Modifier
                        .background(PantopusColors.appSurface.copy(alpha = 0.92f), shape)
                        .padding(horizontal = Spacing.s3, vertical = 5.dp)
                        .testTag("reinventedPulse.ask.said"),
            )
        }
    }
}

private val ASK_LOOK =
    LivingSearchLook(
        hint = "Ask the map: cozy study cafe",
        fieldTag = "reinventedPulse.ask.field",
        clearTag = "reinventedPulse.ask.clear",
        clearWords = "Clear and show every pin",
        pill = true,
    )

/** A search box asking (a spinner, no typing), holding words or a result (a clear button), or empty. */
internal enum class LivingSearchMode { PLAIN, CLEARABLE, BUSY }

/** How a search box looks and is named: its hint, its tags and the words for its clear button. */
internal data class LivingSearchLook(
    val hint: String,
    val fieldTag: String,
    val clearTag: String,
    val clearWords: String,
    /** A pill 40 dp high (the map's), else a rounded box 42 dp high (My Atlas's). */
    val pill: Boolean,
)

/** A search box: the field with its icon and hint, and while it holds words (or a result), its clear button. */
@Composable
internal fun LivingSearchBox(
    text: String,
    look: LivingSearchLook,
    mode: LivingSearchMode,
    onText: (String) -> Unit,
    onSearch: () -> Unit,
    onClear: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val shape = if (look.pill) RoundedCornerShape(percent = 50) else RoundedCornerShape(Radii.lg)
    BasicTextField(
        value = text,
        onValueChange = onText,
        singleLine = true,
        enabled = mode != LivingSearchMode.BUSY,
        textStyle = TextStyle(color = PantopusColors.appText, fontSize = 15.sp),
        cursorBrush = SolidColor(PantopusColors.appText),
        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
        keyboardActions = KeyboardActions(onSearch = { onSearch() }),
        modifier = modifier.fillMaxWidth().testTag(look.fieldTag),
        decorationBox = { inner ->
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .height(if (look.pill) 40.dp else 42.dp)
                        .background(PantopusColors.appSurface, shape)
                        .border(1.dp, PantopusColors.appBorder, shape)
                        .padding(start = Spacing.s3, end = Spacing.s1),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Search,
                    contentDescription = null,
                    size = 15.dp,
                    tint = PantopusColors.appTextSecondary,
                )
                Box(Modifier.weight(1f)) {
                    if (text.isEmpty()) Text(look.hint, fontSize = 15.sp, color = PantopusColors.appTextSecondary)
                    inner()
                }
                when {
                    mode == LivingSearchMode.BUSY -> CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp)
                    mode == LivingSearchMode.CLEARABLE ->
                        Box(
                            contentAlignment = Alignment.Center,
                            modifier =
                                Modifier
                                    .size(32.dp)
                                    .clickable(role = Role.Button, onClick = onClear)
                                    .semantics { contentDescription = look.clearWords }
                                    .testTag(look.clearTag),
                        ) {
                            PantopusIconImage(
                                icon = PantopusIcon.X,
                                contentDescription = null,
                                size = 15.dp,
                                tint = PantopusColors.appTextSecondary,
                            )
                        }
                }
            }
        },
    )
}

/** Listen to the town (CONTRACT 9g), beside the bar. */
@Composable
private fun ListenButton(
    listening: Boolean,
    onToggle: () -> Unit,
) {
    Box(
        contentAlignment = Alignment.Center,
        modifier =
            Modifier
                .size(40.dp)
                .background(if (listening) PantopusColors.primary600 else PantopusColors.appSurface, CircleShape)
                .border(if (listening) 0.dp else 1.dp, PantopusColors.appBorder, CircleShape)
                .clickable(role = Role.Button, onClick = onToggle)
                .semantics { contentDescription = if (listening) "Stop listening to the town" else "Listen to the town" }
                .testTag("reinventedPulse.listen"),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Volume2,
            contentDescription = null,
            size = 16.dp,
            tint = if (listening) Color.White else PantopusColors.appText,
        )
    }
}

/** While listening: what it hears. */
private fun heard(state: LivingAskState): String? {
    if (!state.listening) return null
    if (state.quiet) return "No place sounds here. Move the map to listen elsewhere."
    val hint = if (state.headphones) "" else " Best with headphones."
    return (if (state.playing == null) "Listening to the town." else "Hearing the place nearest the middle.") + hint
}

/** "3 lit for "cafe"", or that nothing here matched, or why it couldn't ask, or what Listen hears. */
private fun said(state: LivingAskState): String? {
    val q = state.q
    return when {
        state.error != null -> state.error
        state.lit == null -> heard(state)
        q == null -> null
        state.shown == 0 -> "Nothing here for “$q”. Move the map or try other words."
        else -> "${state.shown} lit for “$q”" + if (state.more) ", and more beyond these" else ""
    }
}

/**
 * A pin on the Pulse map while it shows what it was asked: lit, with the words it matched over it, or dimmed. While
 * nothing was asked ([lit] null) it is exactly [content].
 */
@Composable
internal fun LivingLitPin(
    id: String,
    lit: Map<String, List<String>>?,
    content: @Composable () -> Unit,
) {
    val words = lit?.get(id)
    when {
        lit == null -> content()
        words == null -> Box(Modifier.alpha(0.28f)) { content() }
        else -> LitWithWords(words) { content() }
    }
}

/** The pin with its matched words in a small label over it; the pin's bottom still stands on its point. */
@Composable
private fun LitWithWords(
    words: List<String>,
    content: @Composable () -> Unit,
) {
    Layout(
        modifier = Modifier.semantics { stateDescription = "Matches ${words.joinToString(", ")}" },
        content = {
            content()
            Text(
                words.take(3).joinToString(" · "),
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White,
                maxLines = 1,
                modifier =
                    Modifier
                        .background(PantopusColors.primary600, RoundedCornerShape(percent = 50))
                        .padding(horizontal = 8.dp, vertical = 3.dp),
            )
        },
    ) { measurables, constraints ->
        val pin = measurables[0].measure(constraints)
        val label = measurables[1].measure(androidx.compose.ui.unit.Constraints())
        // The pin keeps its own size, so it still stands on its point; the label sits over its top, centred.
        layout(pin.width, pin.height) {
            pin.place(0, 0)
            label.place((pin.width - label.width) / 2, -label.height - 4)
        }
    }
}
