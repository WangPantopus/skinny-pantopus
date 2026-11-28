package app.pantopus.android.ui.screens.feed.reinvented.after

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.moments.MomentDto
import app.pantopus.android.data.api.models.reinvented.RetakeDto
import app.pantopus.android.data.api.models.reinvented.shownRetake
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.pulse.TogetherRepository
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import coil.compose.AsyncImage
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject
import kotlin.math.roundToInt

/*
 * Retake ("Pulse, reinvented" phase 3, PHASE-3 piece 1; board B13; CONTRACT 8e; iPhone's `MomentRetake.swift`): stand
 * where someone stood. A Retake is its first Moment and the frames people added from the same spot; it stays. In Pulse
 * it is one row ("Retake · 4 frames") that opens the Retake; in the viewer a chip opens it too. There a reader drags
 * through the frames by date and season and, where they may, adds their own: the Studio opens with the first picture as
 * a ghost to line up with. Only while the switch is on (a Moment carries `retake` only then).
 */

/** The Retake open, from Pulse ([fromList]) or over the viewer ([inViewer]), one at a time: the start's id. */
internal object MomentRetakeState {
    val fromList = mutableStateOf<String?>(null)
    val inViewer = mutableStateOf<String?>(null)

    /** A Moment of a Retake opens the Retake; anything else opens as before (false). */
    fun opens(moment: MomentDto): Boolean {
        val retake = moment.shownRetake ?: return false
        fromList.value = retake.startId
        return true
    }

    /** "Add your frame": the Retake closes, then the Studio opens over Pulse with its first picture as a ghost. */
    fun addFrame(retake: RetakeDto) {
        fromList.value = null
        inViewer.value = null
        TogetherStudio.openFor(
            TogetherStudio.Context.RetakeFrame(retake.startId, retake.title, retake.frames.firstOrNull()?.picture),
        )
    }
}

data class MomentRetakeUi(
    val id: String? = null,
    val retake: RetakeDto? = null,
    val failed: Boolean = false,
)

@HiltViewModel
class MomentRetakeViewModel
    @Inject
    constructor(
        private val repository: TogetherRepository,
    ) : ViewModel() {
        private val _ui = MutableStateFlow(MomentRetakeUi())
        val ui: StateFlow<MomentRetakeUi> = _ui.asStateFlow()

        fun read(id: String) {
            _ui.value = MomentRetakeUi(id = id)
            viewModelScope.launch {
                val answer = repository.retake(id)
                if (_ui.value.id != id) return@launch
                _ui.value =
                    when (answer) {
                        is NetworkResult.Success -> MomentRetakeUi(id = id, retake = answer.data)
                        is NetworkResult.Failure -> MomentRetakeUi(id = id, failed = true)
                    }
            }
        }
    }

/** Pulse's list opens a Retake here (`ReinventedPulseScreen`). */
@Composable
fun MomentRetakeListSheet() {
    val id = MomentRetakeState.fromList.value ?: return
    MomentRetakeSheet(id, onAdd = MomentRetakeState::addFrame) { MomentRetakeState.fromList.value = null }
}

/**
 * In the viewer's chip row: "Retake · 4 frames", opening the Retake over the viewer (which holds still meanwhile).
 * [onClose] closes the viewer before "Add your frame" opens the Studio.
 */
@Composable
internal fun MomentRetakeChip(
    moment: MomentDto,
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val retake = moment.shownRetake ?: return
    DisposableEffect(moment.id) { onDispose { MomentRetakeState.inViewer.value = null } }
    val spoken = "${retake.tag}. Opens the Retake's frames"
    Row(
        modifier =
            modifier
                .clip(RoundedCornerShape(percent = 50))
                .background(Color.Black.copy(alpha = 0.45f))
                .border(1.dp, Color.White.copy(alpha = 0.35f), RoundedCornerShape(percent = 50))
                .clickable(role = Role.Button) { MomentRetakeState.inViewer.value = retake.startId }
                .padding(horizontal = 12.dp, vertical = 6.dp)
                .testTag("moments.viewer.retake")
                .semantics(mergeDescendants = true) { contentDescription = spoken },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        PantopusIconImage(icon = PantopusIcon.History, contentDescription = null, size = 15.dp, tint = Color.White)
        Text(retake.tag, color = Color.White, fontSize = 13.5.sp, fontWeight = FontWeight.SemiBold)
    }
    val open = MomentRetakeState.inViewer.value ?: return
    MomentRetakeSheet(
        open,
        onAdd = { found ->
            onClose()
            MomentRetakeState.addFrame(found)
        },
    ) { MomentRetakeState.inViewer.value = null }
}

/** The Retake: its frames, oldest first, dragged through with one slider; "Add your frame" where allowed. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun MomentRetakeSheet(
    id: String,
    onAdd: (RetakeDto) -> Unit,
    viewModel: MomentRetakeViewModel = hiltViewModel(),
    onDismiss: () -> Unit,
) {
    val ui by viewModel.ui.collectAsStateWithLifecycle()
    LaunchedEffect(id) { viewModel.read(id) }
    val retake = ui.retake.takeIf { ui.id == id }
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = PantopusColors.appBg,
        modifier = Modifier.testTag("together.retake"),
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = Spacing.s4)
                    .padding(bottom = Spacing.s5)
                    .navigationBarsPadding(),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            RetakeHeader(retake)
            when {
                retake == null -> Note(if (ui.failed && ui.id == id) "This Retake couldn't load." else "Loading…")
                retake.frames.isEmpty() -> Note("No frames you can see yet.")
                else -> RetakeFrames(retake, onAdd)
            }
        }
    }
}

@Composable
private fun RetakeHeader(retake: RetakeDto?) {
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text("RETAKE", fontSize = 12.5.sp, fontWeight = FontWeight.Bold, color = PantopusColors.primary600)
        Text(
            retake?.title ?: "…",
            fontSize = 22.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
            modifier = Modifier.semantics { heading() }.testTag("together.retake.title"),
        )
        if (retake != null) {
            val count = retake.frames.size
            val who = retake.startedBy?.name ?: retake.startedBy?.firstName ?: "someone"
            Text(
                listOfNotNull(retake.placeLabel, "started by $who", "$count ${if (count == 1) "frame" else "frames"}").joinToString(" · "),
                fontSize = 13.5.sp,
                color = PantopusColors.appTextSecondary,
                modifier = Modifier.testTag("together.retake.line"),
            )
        }
    }
}

@Composable
private fun RetakeFrames(
    retake: RetakeDto,
    onAdd: (RetakeDto) -> Unit,
) {
    val last = retake.frames.lastIndex
    // The newest frame first; the slider goes back to the first picture.
    var at by remember(retake.startId, last) { mutableFloatStateOf(last.toFloat()) }
    val index = at.roundToInt().coerceIn(0, last)
    val frame = retake.frames[index]
    val who = frame.author?.name ?: frame.author?.firstName ?: "Someone"
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 240.dp)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurfaceSunken)
                .semantics(mergeDescendants = true) { contentDescription = "${frame.label}, $who" },
    ) {
        AsyncImage(
            model = frame.picture,
            contentDescription = null,
            contentScale = ContentScale.Fit,
            modifier = Modifier.fillMaxWidth().height(380.dp).testTag("together.retake.frame"),
        )
        Text(
            frame.label,
            color = Color.White,
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            modifier =
                Modifier
                    .padding(Spacing.s3)
                    .clip(RoundedCornerShape(percent = 50))
                    .background(Color.Black.copy(alpha = 0.55f))
                    .padding(horizontal = 10.dp, vertical = 5.dp)
                    .testTag("together.retake.frameLabel"),
        )
    }
    Text(
        "$who ${if (index == 0) "took the first picture" else "stood here too"}",
        fontSize = 14.sp,
        color = PantopusColors.appText,
        modifier = Modifier.testTag("together.retake.who"),
    )
    if (retake.frames.size > 1) {
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(
                "Frame ${index + 1} of ${retake.frames.size}",
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appTextSecondary,
                modifier = Modifier.testTag("together.retake.count"),
            )
            Slider(
                value = at,
                onValueChange = { at = it },
                valueRange = 0f..last.toFloat(),
                steps = (last - 1).coerceAtLeast(0),
                colors = SliderDefaults.colors(thumbColor = PantopusColors.primary600, activeTrackColor = PantopusColors.primary600),
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .testTag("together.retake.scrub")
                        .semantics {
                            contentDescription = "Frame"
                            stateDescription = frame.label
                        },
            )
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(retake.frames.first().dateLabel, fontSize = 12.sp, color = PantopusColors.appTextSecondary)
                Text(retake.frames.last().dateLabel, fontSize = 12.sp, color = PantopusColors.appTextSecondary)
            }
        }
    }
    RetakeActions(retake, onAdd)
}

@Composable
private fun RetakeActions(
    retake: RetakeDto,
    onAdd: (RetakeDto) -> Unit,
) {
    Column(modifier = Modifier.padding(top = Spacing.s2), verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        if (retake.wantToGo > 0) Note("${retake.wantToGo} want to go")
        if (retake.canAdd) {
            Note("Stand where the first picture was taken to add your frame. It stays in this Retake.")
            Row(
                modifier =
                    Modifier
                        .height(44.dp)
                        .clip(RoundedCornerShape(percent = 50))
                        .background(PantopusColors.primary600)
                        .clickable(role = Role.Button) { onAdd(retake) }
                        .padding(horizontal = Spacing.s4)
                        .testTag("together.retake.add"),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                PantopusIconImage(icon = PantopusIcon.Camera, contentDescription = null, size = 18.dp, tint = Color.White)
                Text("Add your frame", color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
            }
        } else {
            // `can_add` is false only for the 6-hour rule (CONTRACT 8e): say that, in the server's own words.
            Note("You added a frame here a little while ago. Come back later in the day.")
        }
    }
}

@Composable
private fun Note(words: String) {
    Text(words, fontSize = 14.sp, color = PantopusColors.appTextSecondary)
}
