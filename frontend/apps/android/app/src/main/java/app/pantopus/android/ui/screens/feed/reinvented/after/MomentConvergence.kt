package app.pantopus.android.ui.screens.feed.reinvented.after

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.moments.MomentDto
import app.pantopus.android.data.api.models.reinvented.ConvergenceDto
import app.pantopus.android.data.api.models.reinvented.PulseTravelDto
import app.pantopus.android.data.api.models.reinvented.SkyStripDayDto
import app.pantopus.android.data.api.models.reinvented.shownConvergence
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.pulse.TogetherRepository
import app.pantopus.android.ui.screens.feed.reinvented.MomentPicture
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale
import javax.inject.Inject

/*
 * Convergences and the sky strip ("Pulse, reinvented" phase 3, PHASE-3 piece 2; board B14; CONTRACT 8h; iPhone's
 * `MomentConvergence.swift`, the web's `sky/Convergence.tsx`): a piece is every photo that joined one real window (a
 * sunset or a first snow photographed by several people in the same minutes). In Pulse it is one row ("Tonight's sky")
 * that opens the piece; in the viewer a chip opens it too. A sunset piece also shows the place's sunsets, one line of
 * bands a day. Only while the switch is on (a Moment carries `convergence` only then).
 */

/** The piece open, from Pulse ([fromList]) or over the viewer ([inViewer]), one at a time: its id. */
internal object MomentConvergenceState {
    val fromList = mutableStateOf<String?>(null)
    val inViewer = mutableStateOf<String?>(null)

    /** A Moment of a piece opens the piece; anything else opens as before (false). */
    fun opens(moment: MomentDto): Boolean {
        val sky = moment.shownConvergence ?: return false
        fromList.value = sky.id
        return true
    }
}

data class MomentConvergenceUi(
    val id: String? = null,
    val piece: ConvergenceDto? = null,
    val strip: List<SkyStripDayDto> = emptyList(),
    val failed: Boolean = false,
)

@HiltViewModel
class MomentConvergenceViewModel
    @Inject
    constructor(
        private val repository: TogetherRepository,
    ) : ViewModel() {
        private val _ui = MutableStateFlow(MomentConvergenceUi())
        val ui: StateFlow<MomentConvergenceUi> = _ui.asStateFlow()

        fun read(id: String) {
            _ui.value = MomentConvergenceUi(id = id)
            viewModelScope.launch {
                val answer = repository.convergence(id)
                if (_ui.value.id != id) return@launch
                val piece = (answer as? NetworkResult.Success)?.data
                _ui.value = MomentConvergenceUi(id = id, piece = piece, failed = piece == null)
                // The place's sunsets; left out when they can't load.
                if (piece?.sunset == true) {
                    val days = (repository.skyStrip(id, STRIP_DAYS) as? NetworkResult.Success)?.data.orEmpty()
                    if (_ui.value.id == id) _ui.value = _ui.value.copy(strip = days)
                }
            }
        }

        private companion object {
            const val STRIP_DAYS = 30
        }
    }

/** Pulse's list opens a piece here (`ReinventedPulseScreen`). */
@Composable
fun MomentConvergenceListSheet() {
    val id = MomentConvergenceState.fromList.value ?: return
    MomentConvergenceSheet(id) { MomentConvergenceState.fromList.value = null }
}

/** In the viewer's chip row: "Tonight's sky", opening the piece over the viewer (which holds still meanwhile). */
@Composable
internal fun MomentConvergenceChip(
    moment: MomentDto,
    modifier: Modifier = Modifier,
) {
    val sky = moment.shownConvergence ?: return
    DisposableEffect(moment.id) { onDispose { MomentConvergenceState.inViewer.value = null } }
    val spoken = "${sky.tag}. Opens every photo of this sky"
    Row(
        modifier =
            modifier
                .clip(RoundedCornerShape(percent = 50))
                .background(Color.Black.copy(alpha = 0.45f))
                .border(1.dp, Color.White.copy(alpha = 0.35f), RoundedCornerShape(percent = 50))
                .clickable(role = Role.Button) { MomentConvergenceState.inViewer.value = sky.id }
                .padding(horizontal = 12.dp, vertical = 6.dp)
                .testTag("moments.viewer.sky")
                .semantics(mergeDescendants = true) { contentDescription = spoken },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        PantopusIconImage(icon = PantopusIcon.Sun, contentDescription = null, size = 15.dp, tint = Color.White)
        Text(sky.tag, color = Color.White, fontSize = 13.5.sp, fontWeight = FontWeight.SemiBold)
    }
    val open = MomentConvergenceState.inViewer.value ?: return
    MomentConvergenceSheet(open) { MomentConvergenceState.inViewer.value = null }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun MomentConvergenceSheet(
    id: String,
    viewModel: MomentConvergenceViewModel = hiltViewModel(),
    onDismiss: () -> Unit,
) {
    val ui by viewModel.ui.collectAsStateWithLifecycle()
    LaunchedEffect(id) { viewModel.read(id) }
    val piece = ui.piece.takeIf { ui.id == id }
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = PantopusColors.appBg,
        modifier = Modifier.testTag("together.sky"),
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
            if (piece == null) {
                SkyNote(if (ui.failed && ui.id == id) "This couldn’t load." else "Loading…")
            } else {
                SkyHeader(piece)
                if (piece.bands.isNotEmpty()) Bands(piece.bands, height = 28.dp, Modifier.testTag("together.sky.bands"))
                Photos(piece.moments)
                SkyNote("Never made up: it opens only when several people take Live photos of the real sky here.")
                if (piece.sunset && ui.strip.isNotEmpty()) SkyStrip(ui.strip)
            }
        }
    }
}

@Composable
private fun SkyHeader(piece: ConvergenceDto) {
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(
            piece.name,
            fontSize = 22.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
            modifier = Modifier.semantics { heading() }.testTag("together.sky.title"),
        )
        val span =
            if (piece.open) {
                "Open now · until ${PulseTravelDto.clock(piece.closesAt)}"
            } else {
                "${PulseTravelDto.clock(piece.openedAt)} to ${PulseTravelDto.clock(piece.closesAt)}"
            }
        val count = piece.moments.size
        Text(
            "$span · $count ${if (count == 1) "photo" else "photos"}",
            fontSize = 13.5.sp,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.testTag("together.sky.window"),
        )
    }
}

/** The colours of a sky, side by side. */
@Composable
private fun Bands(
    colours: List<String>,
    height: Dp,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .height(height)
                .clip(RoundedCornerShape(6.dp))
                .clearAndSetSemantics { contentDescription = "The colours of its sky" },
    ) {
        colours.forEach { hex -> Box(Modifier.weight(1f).fillMaxSize().background(skyColor(hex))) }
    }
}

/** The piece's photos, two to a row, each clipped to its cell, with whose it is. */
@Composable
private fun Photos(moments: List<MomentDto>) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2), modifier = Modifier.testTag("together.sky.photos")) {
        moments.chunked(2).forEach { pair ->
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2), modifier = Modifier.fillMaxWidth()) {
                pair.forEach { moment ->
                    Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Box(Modifier.fillMaxWidth().aspectRatio(PHOTO_RATIO).clip(RoundedCornerShape(Radii.md))) {
                            MomentPicture(moment, Modifier.fillMaxSize())
                        }
                        Text(
                            moment.author.firstName ?: moment.author.name ?: "Someone",
                            fontSize = 12.5.sp,
                            color = PantopusColors.appTextSecondary,
                        )
                    }
                }
                if (pair.size == 1) Spacer(Modifier.weight(1f))
            }
        }
    }
}

/** "This place's sunsets": one line of bands a day, for 30 days. */
@Composable
private fun SkyStrip(days: List<SkyStripDayDto>) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.testTag("together.sky.strip")) {
        Text("This place’s sunsets", fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
        days.forEach { day ->
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                Text(dayLabel(day.date), fontSize = 12.sp, color = PantopusColors.appTextSecondary, modifier = Modifier.width(56.dp))
                Bands(day.bands, height = 14.dp, Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun SkyNote(words: String) {
    Text(words, fontSize = 14.sp, color = PantopusColors.appTextSecondary)
}

/** A band's colour from `#RRGGBB`; a soft grey for anything else. */
private fun skyColor(hex: String): Color =
    runCatching { Color(android.graphics.Color.parseColor(if (hex.startsWith("#")) hex else "#$hex")) }
        .getOrDefault(Color.Gray.copy(alpha = 0.4f))

/** "Nov 27" for `2026-11-27`. */
private fun dayLabel(date: String): String =
    runCatching { LocalDate.parse(date).format(DateTimeFormatter.ofPattern("MMM d", Locale.US)) }.getOrDefault(date)

private const val PHOTO_RATIO = 0.75f
