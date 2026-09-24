@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.ballot

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
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
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.place.BallotGovernments
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import app.pantopus.android.ui.theme.rememberReduceMotion
import kotlinx.coroutines.launch

/**
 * The governments view as a full-height sheet. "Close" and "Done" slide
 * it away before dismissing.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BallotGovernmentsSheet(
    governments: BallotGovernments,
    address: String,
    onDismiss: () -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val scope = rememberCoroutineScope()
    val close: () -> Unit = { scope.launch { sheetState.hide() }.invokeOnCompletion { onDismiss() } }
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = PantopusColors.appSurface,
        dragHandle = null,
    ) {
        BallotGovernmentsView(governments = governments, address = address, onClose = close)
    }
}

/**
 * The governments view (Board: The peel, with the proposed board "P0:
 * governments view"). The progress bar, the address with Skip, the stack
 * at the peel's geometry, then the story: each government lifts, takes
 * the green highlight and shows its caption for 1.2 s, ending on the
 * finished frame — "Your address" over the serif count, the names, and
 * Done over the boundary source. The middle scrolls on a short screen;
 * Done stays 24 above the bottom, as on the board.
 *
 * P0 captions carry the overline and the name only: the board's third
 * line says what each government decides this year, which needs contest
 * data (P1). The story plays once and holds the finished frame; Skip
 * jumps there, and reduced motion (or [animate] = false) starts there.
 * Parity twin of iOS `BallotGovernmentsView`.
 */
@Composable
fun BallotGovernmentsView(
    governments: BallotGovernments,
    address: String,
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
    animate: Boolean = true,
) {
    val story = remember(governments) { BallotStory(minOf(governments.items.size, BallotStackGeometry.layersFor(governments.count))) }
    val reduceMotion = rememberReduceMotion()
    var finished by remember { mutableStateOf(false) }
    val playing = animate && !reduceMotion && !finished && story.steps > 0
    var elapsed by remember { mutableFloatStateOf(0f) }
    LaunchedEffect(playing) {
        if (!playing) return@LaunchedEffect
        val start = withFrameNanos { it }
        while (elapsed < story.duration) {
            elapsed = withFrameNanos { (it - start) / 1_000_000_000f }
        }
        finished = true
    }
    val t = if (playing) elapsed else Float.POSITIVE_INFINITY
    Column(modifier = modifier.fillMaxSize().background(PantopusColors.appSurface)) {
        GovernmentsHeader(
            address = address,
            bar = story.bar(t),
            action = if (playing) "Skip" else "Close",
            onAction = if (playing) ({ finished = true }) else onClose,
        )
        Column(modifier = Modifier.weight(1f).verticalScroll(rememberScrollState())) {
            BallotStack(count = governments.count, story = if (playing) story else null, time = t)
            Box(modifier = Modifier.padding(horizontal = Spacing.s4)) {
                FinishedCaption(governments, Modifier.storyMotion(story, story.steps, t))
                if (playing) {
                    governments.items.take(story.steps).forEachIndexed { k, government ->
                        StepCaption(
                            overline = storyOverline(k + 1, governments.count, governments.countIsMinimum),
                            name = government.name,
                            modifier = Modifier.storyMotion(story, k, t).clearAndSetSemantics {},
                        )
                    }
                }
            }
        }
        Column(
            modifier = Modifier.padding(start = Spacing.s4, top = Spacing.s6, end = Spacing.s4, bottom = Spacing.s6),
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            BallotPrimaryButton(
                label = "Done",
                onClick = onClose,
                height = 50.dp,
                fontSize = 16.sp,
                modifier = Modifier.testTag("ballot.governments.done"),
            )
            Text(
                governments.sourceLine,
                style = BallotText.style(12.sp, lineHeight = 16.sp),
                color = PantopusColors.appTextMuted,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

/** "Government 2 of at least 5" — a P0 count is a minimum. */
fun storyOverline(
    k: Int,
    total: Int,
    minimum: Boolean,
): String = "Government $k of ${if (minimum) "at least " else ""}$total"

/** Step [k]'s caption fade and rise at [t]. */
private fun Modifier.storyMotion(
    story: BallotStory,
    k: Int,
    t: Float,
): Modifier =
    graphicsLayer {
        alpha = story.presence(k, t)
        translationY = story.captionOffset(k, t).dp.toPx()
    }

@Composable
private fun GovernmentsHeader(
    address: String,
    bar: Float,
    action: String,
    onAction: () -> Unit,
) {
    Column(
        modifier = Modifier.padding(start = Spacing.s4, top = Spacing.s4, end = Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(4.dp)
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.appBorder),
        ) {
            Box(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .graphicsLayer {
                            scaleX = bar
                            transformOrigin = TransformOrigin(0f, 0.5f)
                        }.clip(RoundedCornerShape(Radii.pill))
                        .background(PantopusColors.appText),
            )
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                address,
                style = BallotText.style(13.sp, FontWeight.SemiBold),
                color = PantopusColors.appTextSecondary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f),
            )
            Text(
                action,
                style = BallotText.style(14.sp, FontWeight.SemiBold),
                color = PantopusColors.primary700,
                modifier =
                    Modifier
                        .clickable(role = Role.Button, onClick = onAction)
                        .padding(start = Spacing.s3, top = 10.dp, bottom = 10.dp)
                        .testTag("ballot.governments.close"),
            )
        }
    }
}

@Composable
private fun StepCaption(
    overline: String,
    name: String,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(
            overline.uppercase(),
            style = BallotText.style(11.sp, FontWeight.SemiBold, letterSpacing = 0.77.sp),
            color = PantopusColors.home,
        )
        Text(name, style = BallotText.style(24.sp, FontWeight.Bold, 30.sp, (-0.36).sp), color = PantopusColors.appText)
    }
}

@Composable
private fun FinishedCaption(
    governments: BallotGovernments,
    modifier: Modifier = Modifier,
) {
    val count = if (governments.countIsMinimum) "at least ${governments.count}" else "${governments.count}"
    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(
            "YOUR ADDRESS",
            style = BallotText.style(11.sp, FontWeight.SemiBold, letterSpacing = 0.77.sp),
            color = PantopusColors.home,
        )
        Text(
            "You are standing in $count governments.",
            style = BallotText.style(30.sp, FontWeight.Bold, 34.sp, (-0.45).sp).copy(fontFamily = FontFamily.Serif),
            color = PantopusColors.appText,
            modifier = Modifier.semantics { heading() },
        )
        Text(
            "${governments.summary} ${governments.caveat}",
            style = BallotText.style(15.sp, lineHeight = 22.sp),
            color = PantopusColors.appTextStrong,
        )
    }
}
