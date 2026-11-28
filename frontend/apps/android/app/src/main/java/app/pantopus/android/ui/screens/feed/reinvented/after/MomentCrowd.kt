package app.pantopus.android.ui.screens.feed.reinvented.after

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
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
import androidx.compose.runtime.mutableStateMapOf
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
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.moments.MomentDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.pulse.TogetherRepository
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import coil.compose.AsyncImage
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import javax.inject.Inject
import kotlin.math.roundToInt

/*
 * The crowd freeze ("Pulse, reinvented" phase 3, PHASE-3 piece 3; CONTRACT 8i; iPhone's `MomentCrowd.swift`, the web's
 * `crowd/Crowd.tsx`): one scene taken from many phones at one time. The server finds the other Live photos and videos
 * taken within a minute and 150 m (shared with people nearby, that this reader may see; three at least), ordered around
 * the scene, and the reader walks around it with one slider. In the viewer a chip "Seen from 4 phones" opens it; a sky
 * piece's photos open it too. Nothing is stored. Only while the switch is on (the viewer's chip row draws only then).
 */

/** The scenes read so far, by Moment: read once per Moment while the app runs, the first time the viewer shows it. */
internal object MomentCrowdState {
    data class Scene(
        val center: String,
        val moments: List<MomentDto>,
    )

    val scenes = mutableStateMapOf<String, Scene>()

    /** Moments asked about (or being asked about); a read that was cut off is asked again next time. */
    val asked = mutableSetOf<String>()

    /** The Moment whose scene is open over the viewer (the viewer holds still meanwhile). */
    val inViewer = mutableStateOf<String?>(null)
}

@HiltViewModel
class MomentCrowdViewModel
    @Inject
    constructor(
        private val repository: TogetherRepository,
    ) : ViewModel() {
        /** Reads the scene around [moment] once (a photo or a video only). */
        fun ask(moment: MomentDto) {
            if (moment.kind == "text") return
            read(moment.id)
        }

        /** Reads the scene around [id] unless it was read already; [done] once it is known. */
        fun read(
            id: String,
            done: () -> Unit = {},
        ) {
            if (!MomentCrowdState.asked.add(id)) {
                done()
                return
            }
            viewModelScope.launch {
                try {
                    val crowd = (repository.crowd(id) as? NetworkResult.Success)?.data
                    if (crowd != null && crowd.moments.size >= MIN_PHONES) {
                        MomentCrowdState.scenes[id] = MomentCrowdState.Scene(crowd.center.ifBlank { id }, crowd.moments)
                    }
                } catch (cut: CancellationException) {
                    MomentCrowdState.asked.remove(id)
                    throw cut
                } finally {
                    done()
                }
            }
        }

        private companion object {
            const val MIN_PHONES = 3
        }
    }

/** The scene around [moment], once read; the first call asks for it. */
@Composable
internal fun rememberCrowdScene(
    moment: MomentDto,
    viewModel: MomentCrowdViewModel = hiltViewModel(),
): MomentCrowdState.Scene? {
    LaunchedEffect(moment.id) { viewModel.ask(moment) }
    return MomentCrowdState.scenes[moment.id]
}

/** In the viewer's chip row: "Seen from 4 phones" when others caught the same scene. */
@Composable
internal fun MomentCrowdChip(
    moment: MomentDto,
    modifier: Modifier = Modifier,
) {
    val scene = rememberCrowdScene(moment) ?: return
    DisposableEffect(moment.id) { onDispose { MomentCrowdState.inViewer.value = null } }
    val words = "Seen from ${scene.moments.size} phones"
    Row(
        modifier =
            modifier
                .clip(RoundedCornerShape(percent = 50))
                .background(Color.Black.copy(alpha = 0.45f))
                .border(1.dp, Color.White.copy(alpha = 0.35f), RoundedCornerShape(percent = 50))
                .clickable(role = Role.Button) { MomentCrowdState.inViewer.value = moment.id }
                .padding(horizontal = 12.dp, vertical = 6.dp)
                .testTag("moments.viewer.crowd")
                .semantics(mergeDescendants = true) { contentDescription = "$words. Opens the scene from every phone" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        PantopusIconImage(icon = PantopusIcon.Users, contentDescription = null, size = 15.dp, tint = Color.White)
        Text(words, color = Color.White, fontSize = 13.5.sp, fontWeight = FontWeight.SemiBold)
    }
    val open = MomentCrowdState.inViewer.value ?: return
    MomentCrowdSheet(open) { MomentCrowdState.inViewer.value = null }
}

/** The scene from every phone around [id]: one picture at a time, one slider around it. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun MomentCrowdSheet(
    id: String,
    viewModel: MomentCrowdViewModel = hiltViewModel(),
    onDismiss: () -> Unit,
) {
    var loaded by remember(id) { mutableStateOf(MomentCrowdState.scenes[id] != null) }
    LaunchedEffect(id) { viewModel.read(id) { loaded = true } }
    val scene = MomentCrowdState.scenes[id]
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = PantopusColors.appBg,
        modifier = Modifier.testTag("together.crowd"),
    ) {
        Column(
            modifier =
                Modifier
                    .keepsSheetStill()
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = Spacing.s4)
                    .padding(bottom = Spacing.s5)
                    .navigationBarsPadding(),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(
                    "The scene from ${scene?.moments?.size ?: "…"} phones",
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appText,
                    modifier = Modifier.semantics { heading() }.testTag("together.crowd.title"),
                )
                Text(
                    "Taken within a minute of each other, around one place.",
                    fontSize = 13.5.sp,
                    color = PantopusColors.appTextSecondary,
                )
            }
            if (scene == null) {
                Text(
                    if (loaded) "Not enough phones caught this scene." else "Loading…",
                    fontSize = 14.sp,
                    color = PantopusColors.appTextSecondary,
                    modifier = Modifier.testTag("together.crowd.note"),
                )
            } else {
                SceneFrame(scene)
            }
        }
    }
}

@Composable
private fun SceneFrame(scene: MomentCrowdState.Scene) {
    val last = scene.moments.lastIndex
    val start = scene.moments.indexOfFirst { it.id == scene.center }.coerceAtLeast(0)
    var at by remember(scene) { mutableStateOf(start.toFloat()) }
    val index = at.roundToInt().coerceIn(0, last)
    val moment = scene.moments[index]
    val whose = moment.author.name ?: "Someone"
    // One box for every phone's picture, so a tall one never pushes "Walk around it" off the screen while scrubbing.
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(PICTURE_HEIGHT.dp)
                .clip(RoundedCornerShape(Radii.lg))
                .background(Color.Black)
                .semantics { contentDescription = moment.caption ?: "$whose’s view" }
                .testTag("together.crowd.picture"),
    ) {
        AsyncImage(
            model = if (moment.kind == "video") moment.posterUrl ?: moment.mediaUrl else moment.mediaUrl,
            contentDescription = null,
            contentScale = ContentScale.Fit,
            modifier = Modifier.fillMaxSize(),
        )
        Text(
            listOfNotNull(moment.author.name, clockWithSeconds(moment.createdAt)).joinToString(" · "),
            color = Color.White,
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            modifier =
                Modifier
                    .padding(Spacing.s2)
                    .clip(RoundedCornerShape(percent = 50))
                    .background(Color.Black.copy(alpha = 0.5f))
                    .padding(horizontal = 10.dp, vertical = 5.dp)
                    .testTag("together.crowd.whose"),
        )
    }
    if (last > 0) {
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("Walk around it", fontSize = 13.5.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
            Slider(
                value = index.toFloat(),
                onValueChange = { at = it },
                valueRange = 0f..last.toFloat(),
                steps = (last - 1).coerceAtLeast(0),
                colors = SliderDefaults.colors(thumbColor = PantopusColors.primary600, activeTrackColor = PantopusColors.primary600),
                modifier = Modifier.testTag("together.crowd.scrub").semantics { stateDescription = "$whose’s view" },
            )
        }
    }
}

/** "7:06:18 PM" for an ISO time; null when it can't be read. */
private fun clockWithSeconds(iso: String?): String? =
    iso?.let { runCatching { Instant.parse(it) }.getOrNull() }
        ?.atZone(ZoneId.systemDefault())
        ?.format(DateTimeFormatter.ofPattern("h:mm:ss a", Locale.US))

/** The picture's box: room for the heading, the picture and the slider on a small phone. */
private const val PICTURE_HEIGHT = 400
