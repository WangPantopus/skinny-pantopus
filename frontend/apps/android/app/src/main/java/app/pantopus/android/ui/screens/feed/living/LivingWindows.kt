@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.feed.living

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.living.LivingRepository
import app.pantopus.android.data.living.LivingWindowDto
import app.pantopus.android.data.moments.serverCode
import app.pantopus.android.ui.components.keepsKeyboard
import app.pantopus.android.ui.theme.PantopusColors
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
 * "Pulse, reinvented" phase 4, homes talk to homes (PHASE-4 piece 7; CONTRACT 9f), as the iPhone's
 * (`ReinventedWindows.swift`) and the web's: a circle member who lives at a home may show a window for it to that circle
 * (their own choice, per circle, off by default); it lights when they shared something today, and never says what,
 * where, how many or when. Nothing about the home itself (its place, address, name, who lives there) is read or shown.
 * In Close circle the windows of the person's circles show as a row; on a circle's page the person picks whether to
 * show their own.
 */

@HiltViewModel
class LivingWindowsViewModel
    @Inject
    constructor(
        private val repository: LivingRepository,
    ) : ViewModel() {
        private val _windows = MutableStateFlow<List<LivingWindowDto>>(emptyList())
        val windows: StateFlow<List<LivingWindowDto>> = _windows.asStateFlow()

        fun load() {
            viewModelScope.launch {
                val answer = repository.windows() as? NetworkResult.Success ?: return@launch
                _windows.value = answer.data
            }
        }
    }

/** In Close circle: the windows the person's circles show, lit when someone there shared today. Nothing with none. */
@Composable
internal fun LivingWindowsRow(viewModel: LivingWindowsViewModel = hiltViewModel()) {
    val windows by viewModel.windows.collectAsStateWithLifecycle()
    LaunchedEffect(viewModel) { viewModel.load() }
    if (windows.isEmpty()) return
    Column(
        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4).testTag("reinventedWindows"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Text(
            "Windows",
            fontSize = 15.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
            modifier = Modifier.semantics { heading() },
        )
        Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            windows.forEach { WindowTile(it) }
        }
    }
}

@Composable
private fun WindowTile(window: LivingWindowDto) {
    val glow = LivingPalette.lantern
    val dark = PantopusColors.momentCardSkyBottom
    Column(
        modifier =
            Modifier
                .width(130.dp)
                .background(PantopusColors.appSurface, RoundedCornerShape(Radii.lg))
                .padding(10.dp)
                .semantics(mergeDescendants = true) {
                    contentDescription = "${window.label}, ${window.circle}" + if (window.lit) ", shared today" else ""
                },
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Canvas(
            modifier =
                Modifier
                    .size(width = 44.dp, height = 34.dp)
                    .drawBehind {
                        if (window.lit) {
                            drawCircle(
                                Brush.radialGradient(
                                    listOf(glow.copy(alpha = 0.8f), glow.copy(alpha = 0f)),
                                    center = center,
                                    radius = size.width,
                                ),
                                radius = size.width,
                                center = center,
                            )
                        }
                    }.clearAndSetSemantics {},
        ) {
            drawRoundRect(color = if (window.lit) glow else dark, cornerRadius = androidx.compose.ui.geometry.CornerRadius(6.dp.toPx()))
            // The window's cross bars.
            val bar = Color.Black.copy(alpha = 0.35f)
            drawLine(bar, Offset(size.width / 2, 0f), Offset(size.width / 2, size.height), strokeWidth = 2.dp.toPx())
            drawLine(bar, Offset(0f, size.height / 2), Offset(size.width, size.height / 2), strokeWidth = 2.dp.toPx())
        }
        Text(window.label, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText, maxLines = 1)
        Text(if (window.lit) "Shared today" else window.circle, fontSize = 12.sp, color = PantopusColors.appTextSecondary, maxLines = 1)
    }
}

data class LivingWindowChoiceState(
    val read: Boolean = false,
    val label: String? = null,
    val saving: Boolean = false,
    val error: String? = null,
)

/** One circle's window choice; keyed by the circle on the page. */
@HiltViewModel
class LivingWindowChoiceViewModel
    @Inject
    constructor(
        private val repository: LivingRepository,
    ) : ViewModel() {
        private val _state = MutableStateFlow(LivingWindowChoiceState())
        val state: StateFlow<LivingWindowChoiceState> = _state.asStateFlow()

        fun load(circleId: String) {
            viewModelScope.launch {
                val answer = repository.myWindow(circleId) as? NetworkResult.Success ?: return@launch
                _state.update { it.copy(read = true, label = answer.data) }
            }
        }

        /** Shows the window named [label], or stops showing it with null; [then] runs when it went through. */
        fun send(
            circleId: String,
            label: String?,
            then: () -> Unit,
        ) {
            if (_state.value.saving) return
            _state.update { it.copy(saving = true, error = null) }
            viewModelScope.launch {
                when (val answer = repository.setWindow(circleId, label)) {
                    is NetworkResult.Success -> {
                        _state.update { it.copy(saving = false, label = label) }
                        then()
                    }
                    is NetworkResult.Failure -> {
                        val words =
                            if (answer.error.serverCode == "WINDOW_NO_HOME") {
                                "Only someone who lives at a home can show a window."
                            } else {
                                "That didn't save. Try again."
                            }
                        _state.update { it.copy(saving = false, error = words) }
                    }
                }
            }
        }
    }

/** On a circle's page, under "Keep faded": "Show a window for my home to this circle", and its name. */
@Composable
internal fun LivingCircleWindowChoice(
    circleId: String,
    viewModel: LivingWindowChoiceViewModel = hiltViewModel(key = "living-window-$circleId"),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    var editing by rememberSaveable(circleId) { mutableStateOf(false) }
    var writing by rememberSaveable(circleId) { mutableStateOf("") }
    LaunchedEffect(circleId) { viewModel.load(circleId) }
    val label = state.label
    Column(modifier = Modifier.fillMaxWidth().testTag("reinventedWindows.choice"), verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text("Show a window for my home to this circle", fontSize = 13.5.sp, color = PantopusColors.appText)
                Text(
                    "It lights when I share something, and never says what or where.",
                    fontSize = 12.sp,
                    color = PantopusColors.appTextSecondary,
                )
            }
            Switch(
                checked = label != null || editing,
                onCheckedChange = { on -> if (on) editing = true else viewModel.send(circleId, null) { editing = false } },
                enabled = state.read && !state.saving,
                modifier = Modifier.testTag("reinventedWindows.switch"),
            )
        }
        when {
            editing ->
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    val shape = RoundedCornerShape(10.dp)
                    BasicTextField(
                        value = writing,
                        onValueChange = { writing = it.take(30) },
                        singleLine = true,
                        textStyle = TextStyle(color = PantopusColors.appText, fontSize = 15.sp),
                        cursorBrush = SolidColor(PantopusColors.appText),
                        modifier =
                            Modifier
                                .weight(1f)
                                .keepsKeyboard()
                                .background(PantopusColors.appSurface, shape)
                                .border(1.dp, PantopusColors.appBorder, shape)
                                .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                                .testTag("reinventedWindows.label"),
                        decorationBox = { inner ->
                            Box {
                                if (writing.isEmpty()) {
                                    Text(
                                        "Its name, like Mom and Dad's",
                                        fontSize = 15.sp,
                                        color = PantopusColors.appTextSecondary,
                                    )
                                }
                                inner()
                            }
                        },
                    )
                    TextButton(
                        onClick = {
                            viewModel.send(circleId, writing.trim()) {
                                editing = false
                                writing = ""
                            }
                        },
                        enabled = writing.isNotBlank() && !state.saving,
                        modifier = Modifier.testTag("reinventedWindows.show"),
                    ) { Text("Show it") }
                }
            label != null -> Text("Shown as “$label”", fontSize = 12.sp, color = PantopusColors.appTextSecondary)
        }
        state.error?.let { Text(it, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.error) }
    }
}
