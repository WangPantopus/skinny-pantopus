@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.moments.fieldcard

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.moments.MomentDotDto
import app.pantopus.android.data.api.models.moments.MomentPlayBoxDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.moments.MomentMediaFile
import app.pantopus.android.data.moments.fieldcard.MomentFieldCardRepository
import app.pantopus.android.ui.screens.moments.compose.MomentsComposeViewModel
import app.pantopus.android.ui.screens.moments.studio.studioPair
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Spacing
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject
import kotlin.math.roundToInt

/*
 * "Pulse, reinvented" phase 2, a thing to name in the Studio (CONTRACT 7c `thing`, 7d), as the iPhone's Illuminate: on a
 * photo of its own (not a before and after), while the author keeps Pantopus AI on, Illuminate offers "A thing to name".
 * Its outline (a square around the dot, a quarter of the picture's width to start) is what a reader's tap shows the
 * model; the author may write their own guess. Nothing is named in the Studio: the first reader's tap does that.
 */

/** A thing's outline starts at a quarter of the picture's width. */
const val THING_SIZE = 0.24

/** The author's Pantopus AI choice, read once when Illuminate opens (null until read; unread counts as off). */
@HiltViewModel
class MomentsStudioThingsViewModel
    @Inject
    constructor(
        repository: MomentFieldCardRepository,
    ) : ViewModel() {
        private val _on = MutableStateFlow<Boolean?>(null)
        val on: StateFlow<Boolean?> = _on.asStateFlow()

        init {
            viewModelScope.launch { _on.value = (repository.pantopusAi() as? NetworkResult.Success)?.data }
        }
    }

/** Whether Illuminate offers "A thing to name" now: a photo of its own, and the author keeps Pantopus AI on. */
@Composable
fun studioOffersThings(
    things: MomentsStudioThingsViewModel = hiltViewModel(),
    compose: MomentsComposeViewModel = hiltViewModel(),
): Boolean {
    val on by things.on.collectAsStateWithLifecycle()
    val state by compose.state.collectAsStateWithLifecycle()
    return on == true && state.media is MomentMediaFile.Photo && state.studioPair == null
}

/** A thing's outline as it goes out: a square around its dot, inside the picture (`w` while editing is its size). */
fun thingBox(dot: MomentDotDto): MomentPlayBoxDto {
    val size = (dot.box?.w ?: THING_SIZE).coerceIn(0.1, 0.8)
    val x = (dot.x - size / 2).coerceIn(0.0, 1 - size)
    val y = (dot.y - size / 2).coerceIn(0.0, 1 - size)
    return MomentPlayBoxDto(x = (x * 1000).roundToInt() / 1000.0, y = (y * 1000).roundToInt() / 1000.0, w = size, h = size)
}

/** A new thing dot's outline size. */
fun newThingBox(): MomentPlayBoxDto = MomentPlayBoxDto(0.0, 0.0, THING_SIZE, THING_SIZE)

/** What a thing dot holds in Illuminate: the author's own guess and how much of the picture its outline takes. */
@Composable
fun MomentsStudioThingEditor(
    dot: MomentDotDto,
    onChange: (MomentDotDto) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        val shape = RoundedCornerShape(14.dp)
        val label = dot.label.orEmpty()
        BasicTextField(
            value = label,
            onValueChange = { onChange(dot.copy(label = it.take(MomentDotDto.LABEL_LETTERS))) },
            textStyle = TextStyle(color = Color.White, fontSize = 15.sp),
            cursorBrush = SolidColor(Color.White),
            modifier =
                Modifier
                    .fillMaxWidth()
                    .testTag("moments.studio.dot.thingLabel")
                    .semantics { contentDescription = "What you think it is (optional)" },
            decorationBox = { field ->
                Box(
                    contentAlignment = Alignment.CenterStart,
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .height(44.dp)
                            .clip(shape)
                            .background(PantopusColors.studioPillFill)
                            .border(1.dp, PantopusColors.studioPillOutline, shape)
                            .padding(horizontal = 12.dp),
                ) {
                    if (label.isEmpty()) Text("What you think it is (optional)", color = PantopusColors.studioPillSecondary, fontSize = 15.sp)
                    field()
                }
            },
        )
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            OutlineChip("Smaller outline", PantopusIcon.Minus, "moments.studio.illuminate.smaller") { onChange(resized(dot, -0.06)) }
            OutlineChip("Bigger outline", PantopusIcon.Plus, "moments.studio.illuminate.bigger") { onChange(resized(dot, 0.06)) }
        }
        Text(
            "A reader's tap names it with a source (Pantopus AI). It always says “likely”, and people can correct it.",
            color = PantopusColors.studioPillSecondary,
            fontSize = 13.sp,
        )
    }
}

private fun resized(
    dot: MomentDotDto,
    step: Double,
): MomentDotDto {
    val size = ((dot.box?.w ?: THING_SIZE) + step).coerceIn(0.1, 0.8)
    return dot.copy(box = MomentPlayBoxDto(0.0, 0.0, size, size))
}

@Composable
private fun OutlineChip(
    words: String,
    icon: PantopusIcon,
    tag: String,
    onClick: () -> Unit,
) {
    val shape = RoundedCornerShape(19.dp)
    Row(
        modifier =
            Modifier
                .clip(shape)
                .background(PantopusColors.studioPillFill)
                .border(1.dp, PantopusColors.studioPillOutline, shape)
                .clickable(role = Role.Button, onClick = onClick)
                .padding(horizontal = 12.dp, vertical = Spacing.s2)
                .testTag(tag)
                .clearAndSetSemantics {
                    contentDescription = words
                },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 15.dp, strokeWidth = 2.2f, tint = Color.White)
        Text(words, color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
    }
}

/**
 * A thing's outline over the Studio's picture (what a reader's tap will show the model): a dashed square around the dot,
 * placed in the picture's frame ([left], [top], [width], [height] in px). Not touchable.
 */
@Composable
fun StudioThingOutline(
    dot: MomentDotDto,
    left: Float,
    top: Float,
    width: Float,
    height: Float,
) {
    val box = thingBox(dot)
    val density = LocalDensity.current.density
    val x = left + box.x.toFloat() * width
    val y = top + box.y.toFloat() * height
    val w = box.w.toFloat() * width
    val h = box.h.toFloat() * height
    Canvas(
        modifier =
            Modifier
                .offset { IntOffset(x.roundToInt(), y.roundToInt()) }
                .size((w / density).dp, (h / density).dp)
                .clearAndSetSemantics {},
    ) {
        drawRoundRect(
            color = Color.White,
            cornerRadius = CornerRadius(10.dp.toPx()),
            style = Stroke(width = 2.dp.toPx(), pathEffect = PathEffect.dashPathEffect(floatArrayOf(7.dp.toPx(), 5.dp.toPx()))),
        )
    }
}
