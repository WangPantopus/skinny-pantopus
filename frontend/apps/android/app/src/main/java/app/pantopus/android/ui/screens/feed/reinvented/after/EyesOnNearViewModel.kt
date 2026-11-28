package app.pantopus.android.ui.screens.feed.reinvented.after

import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.reinvented.EyesOnAskDto
import app.pantopus.android.data.api.models.reinvented.PulseTravelDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.plans.PlanLocationResolver
import app.pantopus.android.data.pulse.TogetherRepository
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
import java.time.Instant
import javax.inject.Inject

/*
 * Eyes on ("Pulse, reinvented" phase 3, PHASE-3 piece 6; CONTRACT 8f; iPhone's `EyesOnNear.swift`, the web's `eyeson/`):
 * ask a place a question; people who are there now answer with a Live photo. Over the new Pulse's list only once the
 * Ask chip is picked (never beside what opens the tab). The phone's position goes in the body of one request only, and
 * is never kept. Nobody is told who is near a place.
 */

@HiltViewModel
class EyesOnNearViewModel
    @Inject
    constructor(
        private val repository: TogetherRepository,
        private val locations: PlanLocationResolver,
    ) : ViewModel() {
        private val _asks = MutableStateFlow<List<EyesOnAskDto>>(emptyList())
        val asks: StateFlow<List<EyesOnAskDto>> = _asks.asStateFlow()

        /** Others' open questions within reach of where the phone is now; one's own Ask isn't one to answer. */
        fun read(viewer: String?) {
            viewModelScope.launch {
                val here = locations.gpsFix()
                if (here == null) {
                    _asks.value = emptyList()
                    return@launch
                }
                val now = Instant.now()
                _asks.value =
                    when (val answer = repository.eyesOnNear(here.latitude, here.longitude)) {
                        is NetworkResult.Success ->
                            answer.data.filter { ask ->
                                ask.author?.id != viewer && (runCatching { Instant.parse(ask.until) }.getOrNull()?.isAfter(now) == true)
                            }
                        is NetworkResult.Failure -> emptyList()
                    }
            }
        }
    }

/** "Eyes on near you": open Asks about places near the phone, each answered with a Live photo from the Studio. */
@Composable
fun EyesOnNearSection(
    viewer: String?,
    viewModel: EyesOnNearViewModel = hiltViewModel(),
) {
    val asks by viewModel.asks.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { viewModel.read(viewer) }
    if (asks.isEmpty()) return
    Column(
        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4).testTag("reinventedPulse.eyesOn"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            PantopusIconImage(icon = PantopusIcon.Eye, contentDescription = null, size = 15.dp, tint = PantopusColors.primary600)
            Text(
                "Eyes on near you",
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
                modifier = Modifier.semantics { heading() },
            )
        }
        asks.forEach { ask -> AskRow(ask) }
    }
}

@Composable
private fun AskRow(ask: EyesOnAskDto) {
    val shape = RoundedCornerShape(Radii.lg)
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(shape)
                .border(1.dp, PantopusColors.appBorder, shape)
                .padding(Spacing.s3)
                .testTag("reinventedPulse.eyesOn.${ask.id}"),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Text(ask.question, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
        Text(meta(ask), fontSize = 12.5.sp, color = PantopusColors.appTextSecondary)
        Row(
            modifier =
                Modifier
                    .heightIn(min = 36.dp)
                    .clickable(role = Role.Button) {
                        // The Studio opens to answer it (`eyes_on_for`), as the web's and the iPhone's Studio do: Pulse's
                        // opener opens it ([TogetherStudioOpener]).
                        TogetherStudio.openFor(TogetherStudio.Context.EyesOnAnswer(ask.id, ask.question.take(QUESTION_SHOWN)))
                    }.testTag("reinventedPulse.eyesOn.answer"),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            PantopusIconImage(icon = PantopusIcon.Camera, contentDescription = null, size = 15.dp, tint = PantopusColors.primary600)
            Text("Answer with a Live photo", fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.primary600)
        }
    }
}

/** "Crown Park · Dana Ruiz · open until 4:30 PM · 2 Live answers". */
private fun meta(ask: EyesOnAskDto): String {
    val parts = mutableListOf<String>()
    ask.place?.let(parts::add)
    ask.author?.name?.let(parts::add)
    parts += "open until ${PulseTravelDto.clock(ask.until)}"
    if (ask.answers > 0) parts += "${ask.answers} ${if (ask.answers == 1) "Live answer" else "Live answers"}"
    return parts.joinToString(" · ")
}

private const val QUESTION_SHOWN = 80
