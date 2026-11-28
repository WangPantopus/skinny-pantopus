@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.feed.living

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.pantopus.android.core.routing.DeepLinkRouter
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.living.ECHOES_NAMES
import app.pantopus.android.data.living.ECHOES_OFF
import app.pantopus.android.data.living.ECHOES_ON
import app.pantopus.android.data.living.LivingEchoLineDto
import app.pantopus.android.data.living.LivingEchoesDto
import app.pantopus.android.data.living.LivingRepository
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/*
 * "Pulse, reinvented" phase 4, Echoes and curiosity twins (PHASE-4 piece 6; CONTRACT 9e; the founder's decision 11), as
 * the iPhone's (`ReinventedEchoes.swift`) and the web's, in My Atlas. Four rules: opt-in, public places only, never at
 * home, and names show only when both people say yes. The choice is the person's own: off (the default: nothing about
 * them is matched and they see none), on (others see them only as a count), or names (their first name may show to
 * someone who also chose names). "You and 2 others caught tonight's sunset at Lacamas Lake." Nothing says which Moment
 * of theirs, where exactly or when exactly.
 */

data class LivingEchoesState(
    /** `off`, `on` or `names`; null until read. */
    val choice: String? = null,
    val found: LivingEchoesDto? = null,
    val saving: Boolean = false,
)

@HiltViewModel
class LivingEchoesViewModel
    @Inject
    constructor(
        private val repository: LivingRepository,
    ) : ViewModel() {
        private val _state = MutableStateFlow(LivingEchoesState())
        val state: StateFlow<LivingEchoesState> = _state.asStateFlow()

        /** The choice, and while the person takes part, today's echoes; nothing about echoes is read while it is off. */
        fun load() {
            viewModelScope.launch { read() }
        }

        fun set(next: String) {
            if (_state.value.saving) return
            _state.update { it.copy(saving = true) }
            viewModelScope.launch {
                repository.setEchoes(next)
                read()
                _state.update { it.copy(saving = false) }
            }
        }

        private suspend fun read() {
            val choice = (repository.echoesChoice() as? NetworkResult.Success)?.data ?: return
            val found = if (choice == ECHOES_OFF) null else (repository.echoes() as? NetworkResult.Success)?.data
            _state.update { it.copy(choice = choice, found = found) }
        }
    }

/** Echoes in My Atlas: the choice, and today's echoes and twins once the person takes part. */
@Composable
internal fun LivingEchoes(viewModel: LivingEchoesViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(viewModel) { viewModel.load() }
    val choice = state.choice ?: return
    Column(modifier = Modifier.fillMaxWidth().testTag("reinventedEchoes"), verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(
                    "Echoes: tell me when others caught the same moment",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appText,
                )
                Text(
                    "Only at public places, never at home. Others see you as a count.",
                    fontSize = 12.sp,
                    color = PantopusColors.appTextSecondary,
                )
            }
            Switch(
                checked = choice != ECHOES_OFF,
                onCheckedChange = { viewModel.set(if (it) ECHOES_ON else ECHOES_OFF) },
                enabled = !state.saving,
                modifier = Modifier.testTag("reinventedEchoes.on"),
            )
        }
        if (choice == ECHOES_OFF) return@Column
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                "Show my first name to others who show theirs",
                fontSize = 14.sp,
                color = PantopusColors.appText,
                modifier = Modifier.weight(1f),
            )
            Switch(
                checked = choice == ECHOES_NAMES,
                onCheckedChange = { viewModel.set(if (it) ECHOES_NAMES else ECHOES_ON) },
                enabled = !state.saving,
                modifier = Modifier.testTag("reinventedEchoes.names"),
            )
        }
        val found = state.found
        val lines = found?.let { it.echoes + it.twins }.orEmpty()
        when {
            lines.isNotEmpty() -> lines.forEach { EchoLine(it) }
            found != null -> Text("No echoes today yet.", fontSize = 13.sp, color = PantopusColors.appTextSecondary)
        }
    }
}

/** One line; an echo opens the person's own Moment, a twin is only words. */
@Composable
private fun EchoLine(line: LivingEchoLineDto) {
    val id = line.momentId
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurface, RoundedCornerShape(Radii.lg))
                .clickable(role = Role.Button, enabled = id != null) { DeepLinkRouter.handle("/moments/$id") }
                .padding(10.dp)
                .semantics(mergeDescendants = true) {},
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = if (id == null) PantopusIcon.Leaf else PantopusIcon.Sparkles,
            contentDescription = null,
            size = 15.dp,
            tint = PantopusColors.primary600,
        )
        val names = line.names.orEmpty().filter { it.isNotBlank() }
        Column {
            Text(line.line, fontSize = 14.sp, color = PantopusColors.appText)
            // Only the first names the server sends: people who chose names, and only when the reader did too.
            if (names.isNotEmpty()) {
                Text("With ${spoken(names)}", fontSize = 12.5.sp, color = PantopusColors.appTextSecondary)
            }
        }
    }
}

/** "Avi", "Avi and Maya", "Avi, Maya and Lee". */
private fun spoken(names: List<String>): String =
    if (names.size == 1) names.first() else names.dropLast(1).joinToString(", ") + " and " + names.last()
