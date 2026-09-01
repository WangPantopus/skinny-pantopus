@file:Suppress("MagicNumber", "UnusedPrivateMember", "MatchingDeclarationName", "LongMethod", "LongParameterList", "VariableNaming")

package app.pantopus.android.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusElevations
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import app.pantopus.android.ui.theme.pantopusShadow

/** Style family for [PantopusButton]. */
enum class PantopusButtonKind { Primary, Ghost, Destructive }

/**
 * Core button. Prefer the typed wrappers below at call sites.
 *
 * Height floors at 44dp (iOS parity — Material's 48dp min-tap is
 * preserved via surrounding touch target). Loading state swaps the label
 * for a spinner; disabled state multiplies alpha by 0.5 and blocks clicks.
 */
@Composable
fun PantopusButton(
    title: String,
    kind: PantopusButtonKind,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    isLoading: Boolean = false,
    isEnabled: Boolean = true,
) {
    val (background, foreground, borderColor) =
        when (kind) {
            PantopusButtonKind.Primary ->
                Triple(PantopusColors.primary600, PantopusColors.appTextInverse, Color.Transparent)
            PantopusButtonKind.Ghost ->
                Triple(PantopusColors.appSurface, PantopusColors.appText, PantopusColors.appBorder)
            PantopusButtonKind.Destructive ->
                Triple(PantopusColors.error, PantopusColors.appTextInverse, Color.Transparent)
        }

    val clickable = isEnabled && !isLoading
    Box(
        modifier =
            modifier
                .fillMaxWidth()
                .heightIn(min = 44.dp)
                .alpha(if (isEnabled) 1f else 0.5f)
                .pantopusShadow(
                    if (kind == PantopusButtonKind.Primary) {
                        PantopusElevations.primary
                    } else {
                        PantopusElevations.sm
                    },
                    shape = RoundedCornerShape(Radii.lg),
                ).clip(RoundedCornerShape(Radii.lg))
                .background(background)
                .then(
                    if (borderColor == Color.Transparent) {
                        Modifier
                    } else {
                        Modifier.border(
                            width = 1.dp,
                            color = borderColor,
                            shape = RoundedCornerShape(Radii.lg),
                        )
                    },
                ).clickable(enabled = clickable, onClick = onClick)
                .padding(horizontal = Spacing.s4)
                .semantics {
                    contentDescription = title
                    role = Role.Button
                },
        contentAlignment = Alignment.Center,
    ) {
        if (isLoading) {
            CircularProgressIndicator(
                color = foreground,
                strokeWidth = 2.dp,
                modifier = Modifier.size(20.dp),
            )
        } else {
            Text(text = title, style = PantopusTextStyle.body, color = foreground)
        }
    }
}

/** Filled primary-action button. */
@Composable
fun PrimaryButton(
    title: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    isLoading: Boolean = false,
    isEnabled: Boolean = true,
) = PantopusButton(title, PantopusButtonKind.Primary, onClick, modifier, isLoading, isEnabled)

/** Outlined neutral button for secondary actions. */
@Composable
fun GhostButton(
    title: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    isLoading: Boolean = false,
    isEnabled: Boolean = true,
) = PantopusButton(title, PantopusButtonKind.Ghost, onClick, modifier, isLoading, isEnabled)

/** Filled error button for destructive flows. */
@Composable
fun DestructiveButton(
    title: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    isLoading: Boolean = false,
    isEnabled: Boolean = true,
) = PantopusButton(title, PantopusButtonKind.Destructive, onClick, modifier, isLoading, isEnabled)

@Preview(showBackground = true, widthDp = 360, heightDp = 320)
@Composable
private fun ButtonsPreview() {
    androidx.compose.foundation.layout.Column(
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        modifier = Modifier.padding(Spacing.s4).background(PantopusColors.appBg),
    ) {
        PrimaryButton(title = "Continue", onClick = {})
        PrimaryButton(title = "Signing in…", onClick = {}, isLoading = true)
        PrimaryButton(title = "Disabled", onClick = {}, isEnabled = false)
        GhostButton(title = "Skip", onClick = {})
        DestructiveButton(title = "Delete home", onClick = {})
    }
}
