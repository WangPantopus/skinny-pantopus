@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.moments.studio

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.moments.MomentPlayBoxDto
import app.pantopus.android.data.api.models.moments.MomentPlayItemDto
import app.pantopus.android.data.api.models.moments.MomentPlayKinds
import app.pantopus.android.ui.screens.moments.components.movingWordsColor
import app.pantopus.android.ui.screens.moments.components.stampFrame
import app.pantopus.android.ui.theme.PantopusColors

/*
 * "Pulse, reinvented" phase 2 in the Studio (CONTRACT 7g; as on iPhone): the makers of fog-wipe (the photo opens frosted
 * for others) and the swatch slider (colours to try over one part of the photo), on a photo only, one of each on a post.
 * The viewer draws them (components/MomentPlayFogSwatch.kt).
 */

/** The most colours on one swatch (CONTRACT 7g). */
internal const val MOST_SWATCH_COLORS = 6

/** Where a new swatch's box starts: the middle of the photo. */
internal val STARTING_SWATCH_BOX = MomentPlayBoxDto(x = 0.3, y = 0.35, w = 0.4, h = 0.3)

/** The smallest a swatch's box may be, as a share of the photo each way. */
private const val SMALLEST_BOX = 0.08

/** A fog or a swatch as it goes out (CONTRACT 7g); null when it isn't whole. A photo only: the caller checks. */
internal fun MomentPlayItemDto.sentPhotoLayer(): MomentPlayItemDto? =
    when (kind) {
        MomentPlayKinds.FOG -> MomentPlayItemDto(id = id, kind = kind, x = 0.5, y = 0.5)
        MomentPlayKinds.SWATCH -> {
            val paints = colors.orEmpty().filter { it.matches(HEX) }.distinct().take(MOST_SWATCH_COLORS)
            box?.kept()?.let { kept -> copy(colors = paints, box = kept).takeIf { paints.isNotEmpty() } }
        }
        else -> null
    }

private val HEX = Regex("^#[0-9A-Fa-f]{6}$")

/** The box inside the photo, no smaller than [SMALLEST_BOX] each way. */
private fun MomentPlayBoxDto.kept(): MomentPlayBoxDto {
    val width = w.coerceIn(SMALLEST_BOX, 1.0)
    val height = h.coerceIn(SMALLEST_BOX, 1.0)
    return MomentPlayBoxDto(x = x.coerceIn(0.0, 1.0 - width), y = y.coerceIn(0.0, 1.0 - height), w = width, h = height)
}

/**
 * The swatch's box on the Studio's photo: a dashed outline with its first colour faint inside; one finger drags it, two
 * fingers size it. Nothing shows without a swatch.
 */
@Composable
internal fun StudioSwatchBoxLayer(
    items: List<MomentPlayItemDto>,
    picture: IntSize?,
    enabled: Boolean,
    onItems: (List<MomentPlayItemDto>) -> Unit,
    onOpen: (String) -> Unit,
) {
    val swatch = items.firstOrNull { it.kind == MomentPlayKinds.SWATCH && it.box != null } ?: return
    val box = swatch.box ?: return
    val current by rememberUpdatedState(items)
    BoxWithConstraints(modifier = Modifier.fillMaxSize().testTag("moments.studio.swatch")) {
        val frame = stampFrame(picture, constraints.maxWidth.toFloat(), constraints.maxHeight.toFloat())
        val density = LocalDensity.current.density
        val shape = RoundedCornerShape(6.dp)
        val left = (frame.left + box.x.toFloat() * frame.width) / density
        val top = (frame.top + box.y.toFloat() * frame.height) / density
        Box(
            modifier =
                Modifier
                    .offset(left.dp, top.dp)
                    .size((box.w.toFloat() * frame.width / density).dp, (box.h.toFloat() * frame.height / density).dp)
                    .border(2.dp, Color.White, shape)
                    .studioItemDrag()
                    .pointerInput(swatch.id, enabled) {
                        if (!enabled) return@pointerInput
                        detectTransformGestures { _, pan, zoom, _ ->
                            onItems(
                                current.map { item ->
                                    val now = item.box
                                    if (item.id != swatch.id || now == null) {
                                        item
                                    } else {
                                        val w = now.w * zoom
                                        val h = now.h * zoom
                                        val moved =
                                            MomentPlayBoxDto(
                                                x = now.x + pan.x / frame.width + (now.w - w) / 2,
                                                y = now.y + pan.y / frame.height + (now.h - h) / 2,
                                                w = w,
                                                h = h,
                                            )
                                        item.copy(box = moved.kept())
                                    }
                                },
                            )
                        }
                    }.pointerInput(swatch.id, enabled) {
                        if (!enabled) return@pointerInput
                        detectTapGestures { onOpen(swatch.id) }
                    }.semantics { contentDescription = "Swatch slider's part of the photo. Opens it. Drag to move it." },
        ) {
            swatch.colors?.firstOrNull()?.let { first ->
                Box(Modifier.fillMaxSize().paintedWith(movingWordsColor(first)))
            }
            Text(
                text = "Swatch",
                color = Color.White,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                modifier =
                    Modifier
                        .align(Alignment.TopStart)
                        .padding(4.dp)
                        .paintedWith(PantopusColors.studioBar)
                        .padding(horizontal = 4.dp),
            )
        }
    }
}

/** A faint fill of [color] (the try-on's look in the viewer). */
private fun Modifier.paintedWith(color: Color): Modifier = background(color.copy(alpha = 0.35f))
