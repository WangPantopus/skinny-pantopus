@file:Suppress("MagicNumber", "MatchingDeclarationName", "UnusedPrivateMember")

package app.pantopus.android.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.layout
import androidx.compose.ui.platform.LocalAccessibilityManager
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.Dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.util.UUID

/**
 * Visual role for [Toast]. Mirrors `Toast.swift`'s `ToastKind` and extends
 * with `Warning` + `Info` so the kind palette lines up with the design
 * token palette (`success / warning / error / info`). The iOS contract's
 * three cases (`success / error / neutral`) map to [Success] / [Error] /
 * [Neutral].
 */
enum class ToastKind { Success, Warning, Error, Info, Neutral }

/**
 * Payload for a single transient toast. ID is auto-generated so callers
 * can `.show("Saved")` without juggling identity.
 */
data class ToastMessage(
    val text: String,
    val kind: ToastKind = ToastKind.Neutral,
    val id: String = UUID.randomUUID().toString(),
)

/**
 * StateFlow holder for the current toast. Inject a single instance at the
 * app graph root and call [show] / [success] / [error] from view-models.
 * The matching [ToastHost] consumes [current] and allows time to read it.
 */
class ToastController {
    private val _current = MutableStateFlow<ToastMessage?>(null)
    val current: StateFlow<ToastMessage?> = _current.asStateFlow()

    fun show(message: ToastMessage) {
        _current.value = message
    }

    fun show(
        text: String,
        kind: ToastKind = ToastKind.Neutral,
    ) {
        show(ToastMessage(text = text, kind = kind))
    }

    fun success(text: String) = show(text, ToastKind.Success)

    fun warning(text: String) = show(text, ToastKind.Warning)

    fun error(text: String) = show(text, ToastKind.Error)

    fun info(text: String) = show(text, ToastKind.Info)

    fun dismiss() {
        _current.value = null
    }
}

/**
 * Transient banner — mirrors iOS `ToastView`. A message that fits on one
 * line is a pill; a longer one wraps, centred, under corners that stay
 * clear of its first and last lines, and keeps 16 dp from each side of
 * the screen. The host floats this at the bottom of the screen;
 * auto-dismiss happens at the [ToastHost] layer so callers can leave the
 * controller value set.
 */
@Composable
fun Toast(
    message: ToastMessage,
    modifier: Modifier = Modifier,
) {
    val (background, foreground) = toastPalette(message.kind)
    var wraps by remember(message.text) { mutableStateOf(false) }
    Box(
        modifier =
            modifier
                .clearOfSides(Spacing.s4)
                .clip(RoundedCornerShape(if (wraps) Radii.xl else Radii.pill))
                .background(background)
                .padding(horizontal = Spacing.s4, vertical = Spacing.s2)
                .semantics {
                    contentDescription = message.text
                    liveRegion = LiveRegionMode.Polite
                },
    ) {
        Text(
            text = message.text,
            style = PantopusTextStyle.small,
            color = foreground,
            textAlign = TextAlign.Center,
            onTextLayout = { wraps = it.lineCount > 1 },
        )
    }
}

/**
 * Narrows the widest the toast may grow by [margin] on each side, so a long
 * message wraps clear of the screen's edges while a short one keeps its
 * size and place.
 */
private fun Modifier.clearOfSides(margin: Dp): Modifier =
    layout { measurable, constraints ->
        val maxWidth =
            if (constraints.hasBoundedWidth) {
                (constraints.maxWidth - (margin * 2).roundToPx()).coerceAtLeast(constraints.minWidth)
            } else {
                constraints.maxWidth
            }
        val placeable = measurable.measure(constraints.copy(maxWidth = maxWidth))
        layout(placeable.width, placeable.height) { placeable.place(0, 0) }
    }

/**
 * Top-level host. Wrap inside [PantopusTheme] at the root so every screen
 * shares the same toast surface. Listens to [controller], renders the
 * current toast as an animated bottom-anchored banner. The default dwell
 * grows with the message (3–7 s), then respects the accessibility timeout.
 * [autoDismissMillis] can override the base dwell for a specific host.
 *
 * Posts a TalkBack announcement on first frame so the user is notified
 * even when the toast is off-screen (live region only fires when the node
 * is initially attached, so we double-up with `announceForAccessibility`).
 */
@Composable
fun ToastHost(
    controller: ToastController,
    modifier: Modifier = Modifier,
    autoDismissMillis: Long? = null,
) {
    val current by controller.current.collectAsStateWithLifecycle()
    val view = LocalView.current
    val accessibilityManager = LocalAccessibilityManager.current

    LaunchedEffect(current?.id, autoDismissMillis, accessibilityManager) {
        val message = current ?: return@LaunchedEffect
        // Belt-and-braces — Compose's `liveRegion` covers the on-attach
        // read; `announceForAccessibility` covers TalkBack users who
        // toggle the reader mid-toast.
        view.announceForAccessibility(message.text)
        val duration = autoDismissMillis ?: toastDurationMillis(message.text)
        delay(
            accessibilityManager?.calculateRecommendedTimeoutMillis(
                originalTimeoutMillis = duration,
                containsText = true,
            ) ?: duration,
        )
        if (controller.current.value?.id == message.id) {
            controller.dismiss()
        }
    }

    Box(
        modifier = modifier.fillMaxSize(),
        contentAlignment = Alignment.BottomCenter,
    ) {
        AnimatedVisibility(
            visible = current != null,
            enter = fadeIn() + slideInVertically(initialOffsetY = { it / 2 }),
            exit = fadeOut() + slideOutVertically(targetOffsetY = { it / 2 }),
        ) {
            val message = current
            if (message != null) {
                Toast(
                    message = message,
                    modifier = Modifier.padding(bottom = Spacing.s10),
                )
            }
        }
    }
}

private fun toastPalette(kind: ToastKind): Pair<Color, Color> {
    // Alpha matches iOS `Toast.swift`:
    //   success / error → palette @ 0.95
    //   neutral         → appText @ 0.90
    //   warning / info  → palette @ 0.95 (Android extension; iOS adds when needed)
    val fg = PantopusColors.appTextInverse
    return when (kind) {
        ToastKind.Success -> PantopusColors.success.copy(alpha = SEMANTIC_ALPHA) to fg
        ToastKind.Warning -> PantopusColors.warning.copy(alpha = SEMANTIC_ALPHA) to fg
        ToastKind.Error -> PantopusColors.error.copy(alpha = SEMANTIC_ALPHA) to fg
        ToastKind.Info -> PantopusColors.info.copy(alpha = SEMANTIC_ALPHA) to fg
        ToastKind.Neutral -> PantopusColors.appText.copy(alpha = NEUTRAL_ALPHA) to fg
    }
}

private const val SEMANTIC_ALPHA = 0.95f
private const val NEUTRAL_ALPHA = 0.9f

private const val AUTO_DISMISS_MILLIS = 3_000L
private const val MAX_DISMISS_MILLIS = 7_000L
private const val MILLIS_PER_CHARACTER = 60L

/** Keep brief confirmations familiar while giving explanatory errors time to be read. */
fun toastDurationMillis(
    text: String,
    minimumMillis: Long = AUTO_DISMISS_MILLIS,
): Long = (text.length * MILLIS_PER_CHARACTER).coerceIn(minimumMillis, MAX_DISMISS_MILLIS)

@Preview(showBackground = true, widthDp = 360, heightDp = 240)
@Composable
private fun ToastPreview() {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appBg)
                .padding(Spacing.s4),
        verticalArrangement =
            androidx.compose.foundation.layout.Arrangement
                .spacedBy(Spacing.s2),
    ) {
        Toast(ToastMessage("Saved", ToastKind.Success))
        Toast(ToastMessage("Heads up — review needed", ToastKind.Warning))
        Toast(ToastMessage("Couldn't send. Try again.", ToastKind.Error))
        Toast(ToastMessage("New tip available", ToastKind.Info))
        Toast(ToastMessage("Draft restored", ToastKind.Neutral))
    }
}
