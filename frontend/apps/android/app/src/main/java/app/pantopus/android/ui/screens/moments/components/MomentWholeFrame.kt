package app.pantopus.android.ui.screens.moments.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.unit.IntOffset
import androidx.core.graphics.drawable.toBitmap
import app.pantopus.android.data.api.models.moments.MomentDto
import app.pantopus.android.ui.screens.moments.compose.marks.MomentPlacementPainter
import coil.imageLoader
import coil.request.ImageRequest
import coil.request.SuccessResult
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlin.math.min

/** A whole Moment's backdrop is read from a copy this small when its author's colours didn't come with it. */
private const val BACKDROP_READ_PX = 96

/**
 * "Pulse, reinvented" (PHASE-5 A, CONTRACT 10c), for a reader whose switch is [on]: a whole Moment (a photo, or a video
 * drawn whole, `whole: true`) shows exactly as its author approved it, on every screen shape: its picture as large as
 * fits, never cut, on its backdrop (its author's two colours, or ones read from the picture as Resize reads them),
 * carried on above and below it. [content] (the picture and what lies on it: stamps, dots, items) lies over the
 * picture's own frame there, as it lies over a picture that fills the screen. Anything else: [content] as today.
 */
@Composable
fun MomentWholeFrame(
    moment: MomentDto,
    on: Boolean,
    content: @Composable () -> Unit,
) {
    val width = moment.width ?: 0
    val height = moment.height ?: 0
    val whole = on && moment.whole && moment.kind in WHOLE_KINDS && width > 0 && height > 0
    if (!whole) {
        content()
    } else {
        val backdrop = rememberWholeBackdrop(moment)
        BoxWithConstraints(modifier = Modifier.fillMaxSize().testTag("moments.viewer.whole")) {
            val screen = Size(constraints.maxWidth.toFloat(), constraints.maxHeight.toFloat())
            val shape = width.toFloat() / height
            val w = min(screen.width, screen.height * shape)
            val h = w / shape
            val frame = Rect(Offset((screen.width - w) / 2, (screen.height - h) / 2), Size(w, h))
            val top = Color(backdrop?.top ?: android.graphics.Color.BLACK)
            val bottom = Color(backdrop?.bottom ?: android.graphics.Color.BLACK)
            Box(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .background(Brush.verticalGradient(listOf(top, bottom), startY = frame.top, endY = frame.bottom))
                        .clearAndSetSemantics {},
            )
            val density = LocalDensity.current
            Box(
                modifier =
                    Modifier
                        .offset { IntOffset(frame.left.toInt(), frame.top.toInt()) }
                        .size(with(density) { frame.width.toDp() }, with(density) { frame.height.toDp() }),
            ) { content() }
        }
    }
}

private val WHOLE_KINDS = setOf("photo", "video")

/** The author's two colours, else the picture's own (the poster's for a video), read once it has loaded. */
@Composable
private fun rememberWholeBackdrop(moment: MomentDto): MomentPlacementPainter.Backdrop? {
    val given =
        moment.backdrop?.let { colours ->
            runCatching {
                val parse = android.graphics.Color::parseColor
                MomentPlacementPainter.Backdrop(parse(colours.top), parse(colours.bottom))
            }.getOrNull()
        }
    val context = LocalContext.current
    val url = if (moment.kind == "video") moment.posterUrl else moment.mediaUrl
    val read by produceState<MomentPlacementPainter.Backdrop?>(null, moment.id, given == null) {
        if (given != null || url == null) return@produceState
        val request =
            ImageRequest
                .Builder(context)
                .data(url)
                .size(BACKDROP_READ_PX)
                .allowHardware(false)
                .build()
        val bitmap = (context.imageLoader.execute(request) as? SuccessResult)?.drawable?.toBitmap() ?: return@produceState
        value = withContext(Dispatchers.Default) { MomentPlacementPainter.backdrop(bitmap) }
    }
    return given ?: read
}
