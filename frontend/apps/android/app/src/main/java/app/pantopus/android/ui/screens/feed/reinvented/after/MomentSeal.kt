package app.pantopus.android.ui.screens.feed.reinvented.after

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.moments.MomentDto
import app.pantopus.android.data.api.models.reinvented.RelicDto
import app.pantopus.android.data.api.models.reinvented.unopenedSeal
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.moments.serverCode
import app.pantopus.android.data.plans.PlanLocationResolver
import app.pantopus.android.data.pulse.TogetherRepository
import app.pantopus.android.ui.screens.feed.reinvented.MomentPicture
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
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import javax.inject.Inject

/*
 * Relics and "Seal it" ("Pulse, reinvented" phase 3, PHASE-3 piece 7; CONTRACT 8g; iPhone's `MomentSeal.swift`, the
 * web's `seal/`): a Moment that opens later. A place relic is listed nowhere until it opens, but near where it was left:
 * "Relics near you" over the new Pulse's list once the Spots chip is picked, with "Open it" for a reader standing there.
 * The phone's position goes in the body of a request only, never kept. The author sees their own sealed Moment whole,
 * marked "Sealed" in the viewer. Readers never reach an unopened relic in the viewer (the server hides it).
 */

data class RelicsNearUi(
    val relics: List<RelicDto> = emptyList(),
    val opening: String? = null,
    val opened: MomentDto? = null,
    val problem: String? = null,
)

@HiltViewModel
class RelicsNearViewModel
    @Inject
    constructor(
        private val repository: TogetherRepository,
        private val locations: PlanLocationResolver,
    ) : ViewModel() {
        private val _ui = MutableStateFlow(RelicsNearUi())
        val ui: StateFlow<RelicsNearUi> = _ui.asStateFlow()

        /** The place relics within 300 m of where the phone is now. */
        fun read() {
            viewModelScope.launch {
                val here = locations.gpsFix()
                val relics =
                    if (here == null) {
                        emptyList()
                    } else {
                        (repository.relicsNear(here.latitude, here.longitude) as? NetworkResult.Success)?.data.orEmpty()
                    }
                _ui.update { it.copy(relics = relics) }
            }
        }

        /** Opens [relic] for a reader standing where it was left (a new fix: a cached one can be from before they walked). */
        fun open(relic: RelicDto) {
            if (_ui.value.opening != null) return
            _ui.update { it.copy(opening = relic.id, problem = null) }
            viewModelScope.launch {
                val here = locations.newFix()
                if (here == null) {
                    _ui.update { it.copy(opening = null, problem = "Allow your location to open it where it was left.") }
                    return@launch
                }
                when (val answer = repository.openRelic(relic.id, here.latitude, here.longitude)) {
                    is NetworkResult.Success -> _ui.update { it.copy(opening = null, opened = answer.data) }
                    is NetworkResult.Failure -> {
                        val notHere = answer.error.serverCode == "SEAL_NOT_HERE"
                        val words = if (notHere) "Stand where it was left to open it." else "It couldn’t open. Try again."
                        _ui.update { it.copy(opening = null, problem = words) }
                    }
                }
            }
        }

        fun closeOpened() = _ui.update { it.copy(opened = null) }
    }

/** "Relics near you": place relics near the phone, each opened by standing where it was left. */
@Composable
fun RelicsNearSection(viewModel: RelicsNearViewModel = hiltViewModel()) {
    val ui by viewModel.ui.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { viewModel.read() }
    ui.opened?.let { RelicOpenedSheet(it, onDismiss = viewModel::closeOpened) }
    if (ui.relics.isEmpty()) return
    Column(
        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4).testTag("reinventedPulse.relics"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            PantopusIconImage(icon = PantopusIcon.Lock, contentDescription = null, size = 15.dp, tint = PantopusColors.primary600)
            Text(
                "Relics near you",
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
                modifier = Modifier.semantics { heading() },
            )
        }
        ui.relics.forEach { relic -> RelicRow(relic, opening = ui.opening, onOpen = viewModel::open) }
        ui.problem?.let {
            Text(
                it,
                fontSize = 13.5.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.error,
                modifier = Modifier.testTag("reinventedPulse.relics.problem"),
            )
        }
    }
}

@Composable
private fun RelicRow(
    relic: RelicDto,
    opening: String?,
    onOpen: (RelicDto) -> Unit,
) {
    val shape = RoundedCornerShape(Radii.lg)
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(shape)
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, shape)
                .padding(Spacing.s3)
                .testTag("reinventedPulse.relics.${relic.id}"),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Text(
            relic.author?.name?.let { "$it left something here" } ?: "Something was left here",
            fontSize = 15.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
        )
        Text(relicMeta(relic), fontSize = 12.5.sp, color = PantopusColors.appTextSecondary)
        if (relic.here) {
            val busy = opening != null
            Box(
                modifier =
                    Modifier
                        .heightIn(min = 36.dp)
                        .clickable(enabled = !busy, role = Role.Button) { onOpen(relic) }
                        .testTag("reinventedPulse.relics.open"),
                contentAlignment = Alignment.CenterStart,
            ) {
                Text(
                    if (opening == relic.id) "Opening…" else "Open it",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.primary600,
                )
            }
        } else {
            Text("Walk to where it was left to open it.", fontSize = 12.5.sp, color = PantopusColors.appTextSecondary)
        }
    }
}

/** "Opens when you stand here · left Nov 20 · you're there", or "… · within 300 m". */
private fun relicMeta(relic: RelicDto): String {
    val left =
        relic.leftAt?.let { runCatching { Instant.parse(it) }.getOrNull() }
            ?.atZone(ZoneId.systemDefault())
            ?.format(DateTimeFormatter.ofPattern("MMM d", Locale.US))
            ?.let { "left $it" }
    return listOfNotNull(relic.hint, left, if (relic.here) "you’re there" else "within 300 m").joinToString(" · ")
}

/** The relic opened where it was left, whole for this reader; nothing is recorded. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun RelicOpenedSheet(
    moment: MomentDto,
    onDismiss: () -> Unit,
) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = PantopusColors.appBg,
        modifier = Modifier.testTag("reinventedPulse.relics.opened"),
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
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                PantopusIconImage(icon = PantopusIcon.Lock, contentDescription = null, size = 15.dp, tint = PantopusColors.primary600)
                Text(
                    "Opened where it was left",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.primary600,
                    modifier = Modifier.semantics { heading() },
                )
            }
            if (moment.kind == "text") {
                MomentPicture(moment, Modifier.fillMaxWidth().heightIn(min = TEXT_CARD_HEIGHT.dp).clip(RoundedCornerShape(Radii.lg)))
            } else {
                AsyncImage(
                    model = if (moment.kind == "video") moment.posterUrl ?: moment.mediaUrl else moment.mediaUrl,
                    contentDescription = moment.caption ?: "The picture that was left here",
                    contentScale = ContentScale.FillWidth,
                    modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(Radii.lg)).testTag("reinventedPulse.relics.picture"),
                )
            }
            moment.caption?.takeIf { it.isNotBlank() }?.let { Text(it, fontSize = 16.sp, color = PantopusColors.appText) }
            Text(
                "Left by ${moment.author.name?.ifBlank { null } ?: "someone"}",
                fontSize = 13.5.sp,
                color = PantopusColors.appTextSecondary,
            )
        }
    }
}

/** In the viewer's chip row, on one's own Moment that hasn't opened yet: "Sealed · Opens on Dec 25, 2026". */
@Composable
internal fun MomentSealMark(
    moment: MomentDto,
    mine: Boolean,
    modifier: Modifier = Modifier,
) {
    if (!mine) return
    val seal = moment.unopenedSeal ?: return
    val words = "Sealed · ${seal.hint ?: "only you see it until it opens"}"
    Row(
        modifier =
            modifier
                .clip(RoundedCornerShape(percent = 50))
                .background(Color.Black.copy(alpha = 0.45f))
                .padding(horizontal = 12.dp, vertical = 6.dp)
                .testTag("moments.viewer.sealed")
                .semantics(mergeDescendants = true) { contentDescription = words },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        PantopusIconImage(icon = PantopusIcon.Lock, contentDescription = null, size = 15.dp, tint = Color.White)
        Text(
            words,
            color = Color.White,
            fontSize = 13.5.sp,
            fontWeight = FontWeight.SemiBold,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

private const val TEXT_CARD_HEIGHT = 420
