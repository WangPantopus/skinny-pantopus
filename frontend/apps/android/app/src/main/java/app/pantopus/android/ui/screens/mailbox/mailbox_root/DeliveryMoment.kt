@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.mailbox.mailbox_root

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.mailbox.components.MailboxDrawing
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Spacing
import app.pantopus.android.ui.theme.rememberReduceMotion
import kotlinx.coroutines.delay

/**
 * The delivery moment (drawing `R2-Delivery`): the first time the Mailbox opens after a round that brought mail, the
 * mailbox door opens and today's stack slides out, in under 2 seconds. A tap skips it; Remove animations skips it
 * entirely. [onDone] runs once either way, so the round isn't played again.
 */
@Composable
fun DeliveryMoment(
    count: Int,
    /** "this morning" for the morning round; "today" for mail that came later in the day. */
    cameWhen: String,
    onDone: () -> Unit,
) {
    val reduceMotion = rememberReduceMotion()
    if (reduceMotion) {
        LaunchedEffect(Unit) { onDone() }
        return
    }
    val veil = remember { Animatable(0f) }
    val door = remember { Animatable(0f) }
    val slide = remember { Animatable(0f) }
    LaunchedEffect(Unit) {
        veil.animateTo(1f, tween(180))
        door.animateTo(1f, tween(520, easing = FastOutSlowInEasing))
        slide.animateTo(1f, tween(620, easing = FastOutSlowInEasing))
        delay(220)
        veil.animateTo(0f, tween(260))
        onDone()
    }
    val pieces = if (count == 1) "1 piece came" else "$count pieces came"
    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .graphicsLayer { alpha = veil.value }
                .background(PantopusColors.appBg)
                .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null, onClick = onDone)
                .clearAndSetSemantics {
                    contentDescription = "Your mail is here. $pieces $cameWhen."
                    liveRegion = LiveRegionMode.Polite
                }.testTag("mailDeliveryMoment"),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
            Box(contentAlignment = Alignment.TopCenter) {
                MailboxDrawing(modifier = Modifier.size(220.dp), doorOpen = door.value, mailInside = slide.value < 0.2f)
                // Today's stack, sliding out of the open door and fanning down.
                listOf(
                    Triple(PantopusColors.mailLetterPaper, -3f, 0),
                    Triple(PantopusColors.appSurface, 2f, 1),
                    Triple(PantopusColors.primary900, -1.2f, 2),
                ).forEach { (paper, tilt, index) ->
                    Box(
                        modifier =
                            Modifier
                                .size(width = 150.dp, height = 46.dp)
                                .graphicsLayer {
                                    val travel = (slide.value - index * 0.12f).coerceIn(0f, 1f)
                                    alpha = if (travel > 0f) 1f else 0f
                                    translationY = (126 + travel * (110 + index * 52)).dp.toPx()
                                    rotationZ = tilt * travel
                                    scaleX = 0.6f + 0.4f * travel
                                    scaleY = 0.6f + 0.4f * travel
                                }.background(paper, RoundedCornerShape(4.dp))
                                .border(1.dp, PantopusColors.mailLetterEdge, RoundedCornerShape(4.dp)),
                    )
                }
            }
            Spacer(Modifier.height(Spacing.s8 + 140.dp))
            Text("Your mail is here", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appText)
            Text("$pieces $cameWhen.", fontSize = 15.sp, color = PantopusColors.appTextSecondary)
        }
    }
}
