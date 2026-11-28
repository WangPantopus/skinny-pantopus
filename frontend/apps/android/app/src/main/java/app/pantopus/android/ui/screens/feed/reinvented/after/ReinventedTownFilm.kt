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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.moments.MomentDto
import app.pantopus.android.data.api.models.reinvented.TownFilmDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.plans.PlanLocationResolver
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
import java.time.LocalTime
import javax.inject.Inject

/*
 * "Tonight in <town>" ("Pulse, reinvented" phase 3, PHASE-3 piece 10; board B12; CONTRACT 8k; iPhone's
 * `ReinventedTownFilm.swift`, the web's `pulse/TownFilm.tsx`): from 8 pm until 4 am, the town's film of that day's
 * Moments, only where a town has enough (the server's rule: 8 Moments by 4 people, each shared with people nearby, still
 * live or kept by its author). Asked only from the loaded list of Around me's whole list, and only in the evening by the
 * phone's own clock, at most every 15 minutes, so nothing competes with what opens the tab. The phone's position goes in
 * the body only; the server keeps nothing. A tap plays the film in today's viewer, oldest first.
 */

/** The evening's film, read at most every [EVERY_MS] while Pulse shows it (kept across Pulse's screens). */
internal object TownFilmState {
    val film = MutableStateFlow<TownFilmDto?>(null)
    var readAt = 0L

    /** From 8 pm until 4 am by the phone's own clock. */
    fun evening(now: LocalTime = LocalTime.now()): Boolean = now.hour >= EVENING_HOUR || now.hour < NIGHT_END_HOUR

    const val EVERY_MS = 15 * 60_000L
    private const val EVENING_HOUR = 20
    private const val NIGHT_END_HOUR = 4
}

@HiltViewModel
class ReinventedTownFilmViewModel
    @Inject
    constructor(
        private val repository: TogetherRepository,
        private val locations: PlanLocationResolver,
    ) : ViewModel() {
        val film: StateFlow<TownFilmDto?> = TownFilmState.film.asStateFlow()

        fun read() {
            if (!TownFilmState.evening()) {
                TownFilmState.film.value = null
                return
            }
            val now = System.currentTimeMillis()
            if (now - TownFilmState.readAt < TownFilmState.EVERY_MS) return
            viewModelScope.launch {
                val here = locations.gpsFix() ?: return@launch
                TownFilmState.readAt = System.currentTimeMillis()
                TownFilmState.film.value = (repository.townFilm(here.latitude, here.longitude) as? NetworkResult.Success)?.data
            }
        }
    }

/** Over Around me's list in the evening: "Tonight in Camas · 12 Moments by 6 people today"; a tap plays them. */
@Composable
fun ReinventedTownFilmCard(
    onPlay: (List<MomentDto>) -> Unit,
    viewModel: ReinventedTownFilmViewModel = hiltViewModel(),
) {
    LaunchedEffect(Unit) { viewModel.read() }
    val film by viewModel.film.collectAsStateWithLifecycle()
    val shown = film?.takeIf { TownFilmState.evening() && it.moments.isNotEmpty() } ?: return
    val town = shown.town?.takeIf { it.isNotBlank() && it != UNNAMED }
    val title = town?.let { "Tonight in $it" } ?: "Tonight around you"
    val count = shown.count.takeIf { it > 0 } ?: shown.moments.size
    val line = "$count Moments by ${shown.people} people today"
    val cover =
        shown.moments.firstNotNullOfOrNull {
            when (it.kind) {
                "video" -> it.posterUrl
                "photo" -> it.mediaUrl
                else -> null
            }
        }
    val shape = RoundedCornerShape(Radii.lg)
    Row(
        modifier =
            Modifier
                .padding(horizontal = Spacing.s4)
                .fillMaxWidth()
                .clip(shape)
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, shape)
                .clickable(role = Role.Button) { onPlay(shown.moments) }
                .padding(Spacing.s3)
                .testTag("reinventedPulse.townFilm")
                .clearAndSetSemantics {
                    contentDescription = "$title: play $count Moments from today"
                    role = Role.Button
                },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            Modifier.size(COVER.dp).clip(RoundedCornerShape(Radii.md)).background(PantopusColors.appSurfaceRaised),
            contentAlignment = Alignment.Center,
        ) {
            if (cover != null) {
                AsyncImage(model = cover, contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
            } else {
                PantopusIconImage(
                    icon = PantopusIcon.Video,
                    contentDescription = null,
                    size = 22.dp,
                    tint = PantopusColors.appTextSecondary,
                )
            }
        }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(title, fontSize = 16.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appText)
            Text(line, fontSize = 13.sp, color = PantopusColors.appTextSecondary)
        }
        PantopusIconImage(icon = PantopusIcon.Play, contentDescription = null, size = 18.dp, tint = PantopusColors.primary600)
    }
}

/** The label the server gives a place it can't name: then the card says "around you". */
private const val UNNAMED = "Nearby"
private const val COVER = 56
