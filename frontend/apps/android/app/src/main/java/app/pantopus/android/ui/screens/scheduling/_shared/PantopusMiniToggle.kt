@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.scheduling._shared

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusElevations
import app.pantopus.android.ui.theme.pantopusShadow

private const val TOGGLE_ANIM_MS = 150

/**
 * The Calendarly mini toggle — the design's 32×18 capsule control
 * (scheduling-hub-frames.jsx `Toggle`, onboarding-shell.jsx "iOS 32×18
 * toggles", scheduling-setup-frames.jsx DayRow), NOT the 52×32 Material 3
 * [androidx.compose.material3.Switch].
 *
 * Track fills with [accent] when on / `appBorderStrong` when off; the white
 * thumb is inset 2dp and slides left→right over 150ms, mirroring iOS
 * `SetupMiniToggle` (SetupKit.swift). Interactive callers get toggleable
 * (switch-role) semantics; pass `onCheckedChange = null` for a display-only
 * capsule.
 *
 * Track geometry is parameterized because other surfaces reuse the control at
 * a slightly larger 36×20 size; the corner radius is always trackHeight/2.
 */
@Composable
fun PantopusMiniToggle(
    checked: Boolean,
    onCheckedChange: ((Boolean) -> Unit)?,
    accent: Color,
    modifier: Modifier = Modifier,
    trackWidth: Dp = 32.dp,
    trackHeight: Dp = 18.dp,
    thumbSize: Dp = 14.dp,
) {
    val inset = (trackHeight - thumbSize) / 2
    val trackColor by animateColorAsState(
        targetValue = if (checked) accent else PantopusColors.appBorderStrong,
        animationSpec = tween(TOGGLE_ANIM_MS),
        label = "miniToggleTrack",
    )
    val thumbOffset by animateDpAsState(
        targetValue = if (checked) trackWidth - thumbSize - inset else inset,
        animationSpec = tween(TOGGLE_ANIM_MS),
        label = "miniToggleThumb",
    )
    Box(
        modifier =
            modifier
                .width(trackWidth)
                .height(trackHeight)
                .clip(CircleShape)
                .background(trackColor)
                .then(
                    if (onCheckedChange != null) {
                        Modifier.toggleable(value = checked, role = Role.Switch, onValueChange = onCheckedChange)
                    } else {
                        Modifier
                    },
                ),
        contentAlignment = Alignment.CenterStart,
    ) {
        Box(
            modifier =
                Modifier
                    .offset(x = thumbOffset)
                    .size(thumbSize)
                    .pantopusShadow(PantopusElevations.sm, CircleShape)
                    .clip(CircleShape)
                    .background(PantopusColors.appSurface),
        )
    }
}
