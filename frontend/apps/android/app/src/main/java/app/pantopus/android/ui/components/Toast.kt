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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.tooling.preview.Preview
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
 * The matching [ToastHost] consumes [current] and dismisses after
 * [autoDismissMillis].
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
 * Pill-shaped transient banner — mirrors iOS `ToastView`. The host
 * floats this at the bottom of the screen; auto-dismiss happens at the
 * [ToastHost] layer so callers can leave the controller value set.
 */
@Composable
fun Toast(
    message: ToastMessage,
    modifier: Modifier = Modifier,
) {
    val (background, foreground) = toastPalette(message.kind)
    Box(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.pill))
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
        )
    }
}

/**
 * Top-level host. Wrap inside [PantopusTheme] at the root so every screen
 * shares the same toast surface. Listens to [controller], renders the
 * current toast as an animated bottom-anchored pill, and dismisses after
 * [autoDismissMillis] (default 3 s).
 *
 * Posts a TalkBack announcement on first frame so the user is notified
 * even when the toast is off-screen (live region only fires when the node
 * is initially attached, so we double-up with `announceForAccessibility`).
 */
@Composable
fun ToastHost(
    controller: ToastController,
    modifier: Modifier = Modifier,
    autoDismissMillis: Long = AUTO_DISMISS_MILLIS,
) {
    val current by controller.current.collectAsStateWithLifecycle()
    val view = LocalView.current

    LaunchedEffect(current?.id) {
        val message = current ?: return@LaunchedEffect
        // Belt-and-braces — Compose's `liveRegion` covers the on-attach
        // read; `announceForAccessibility` covers TalkBack users who
        // toggle the reader mid-toast.
        view.announceForAccessibility(message.text)
        delay(autoDismissMillis)
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
