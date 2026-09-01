@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.inbox.chat

import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import kotlin.math.roundToInt

private val ActionWidth = 140.dp
private val MuteTint = PantopusColors.appTextSecondary
private val HideTint = PantopusColors.appTextStrong

@Composable
fun SwipeableConversationRow(
    content: ConversationRowContent,
    onTap: () -> Unit,
    onMute: () -> Unit,
    onHide: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var offsetPx by remember(content.id) { mutableFloatStateOf(0f) }
    val revealPx = with(androidx.compose.ui.platform.LocalDensity.current) { ActionWidth.toPx() }
    val animatedOffset by animateFloatAsState(
        targetValue = offsetPx,
        animationSpec = spring(stiffness = Spring.StiffnessMedium),
        label = "conversationSwipeOffset",
    )

    Box(
        modifier =
            modifier
                .fillMaxWidth()
                .testTag("swipeableConversationRow_${content.id}"),
    ) {
        Row(
            modifier =
                Modifier
                    .align(Alignment.CenterEnd)
                    .width(ActionWidth)
                    .fillMaxHeight(),
        ) {
            SwipeActionButton(
                icon = if (content.isMuted) PantopusIcon.Bell else PantopusIcon.BellOff,
                label = if (content.isMuted) "Unmute" else "Mute",
                tint = MuteTint,
                testTag = "conversationRow.swipeMute_${content.id}",
                onClick = {
                    offsetPx = 0f
                    onMute()
                },
                modifier = Modifier.weight(1f),
            )
            SwipeActionButton(
                icon = PantopusIcon.Archive,
                label = "Hide",
                tint = HideTint,
                testTag = "conversationRow.swipeHide_${content.id}",
                onClick = {
                    offsetPx = 0f
                    onHide()
                },
                modifier = Modifier.weight(1f),
            )
        }
        Box(
            modifier =
                Modifier
                    .offset { IntOffset(animatedOffset.roundToInt(), 0) }
                    .pointerInput(content.id) {
                        detectHorizontalDragGestures(
                            onHorizontalDrag = { _, dragAmount ->
                                offsetPx = (offsetPx + dragAmount).coerceIn(-revealPx, 0f)
                            },
                            onDragEnd = {
                                offsetPx =
                                    if (offsetPx < -revealPx / 2f) {
                                        -revealPx
                                    } else {
                                        0f
                                    }
                            },
                        )
                    },
        ) {
            ConversationRow(content = content, onTap = onTap)
        }
    }
}

@Composable
private fun SwipeActionButton(
    icon: PantopusIcon,
    label: String,
    tint: Color,
    testTag: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier =
            modifier
                .fillMaxHeight()
                .background(tint)
                .clickable(onClick = onClick)
                .testTag(testTag),
        contentAlignment = Alignment.Center,
    ) {
        androidx.compose.foundation.layout.Column(
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            PantopusIconImage(
                icon = icon,
                contentDescription = label,
                size = 17.dp,
                tint = PantopusColors.appTextInverse,
            )
            Text(
                text = label,
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appTextInverse,
            )
        }
    }
}
