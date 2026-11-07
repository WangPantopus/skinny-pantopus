@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.feed.pulse

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntRect
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Popup
import androidx.compose.ui.window.PopupPositionProvider
import androidx.compose.ui.window.PopupProperties
import app.pantopus.android.data.api.models.posts.PostReactionEmoji
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusElevations
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import app.pantopus.android.ui.theme.pantopusShadow

/** Clear room around the picker's capsule, inside its popup, so the capsule's shadow isn't cut off. */
private val ShadowRoom = Spacing.s2

/**
 * The emoji picker for a post's reaction (its card's reaction pill, its page's add-reaction button): the seven emoji
 * ([PostReactionEmoji]) in a capsule just above the control that opened it, or below it when there's no room above.
 * The viewer's current emoji is selected, and picking it again takes the reaction away; [onPick] gets the emoji
 * tapped, and the caller closes the picker. Back or a tap outside closes it too.
 */
@Composable
fun PulseReactionPicker(
    selected: PostReactionEmoji?,
    onPick: (PostReactionEmoji) -> Unit,
    onDismiss: () -> Unit,
) {
    val density = LocalDensity.current
    val position =
        remember(density) {
            with(density) {
                AboveAnchorPosition(gap = Spacing.s1.roundToPx(), shadowRoom = ShadowRoom.roundToPx(), margin = Spacing.s2.roundToPx())
            }
        }
    Popup(
        popupPositionProvider = position,
        onDismissRequest = onDismiss,
        properties = PopupProperties(focusable = true),
    ) {
        val shape = RoundedCornerShape(Radii.pill)
        Row(
            modifier =
                Modifier
                    .padding(ShadowRoom)
                    .pantopusShadow(PantopusElevations.md, shape)
                    .clip(shape)
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorder, shape)
                    .padding(horizontal = Spacing.s1, vertical = 2.dp)
                    .testTag("pulseReactionPicker"),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            PostReactionEmoji.entries.forEach { emoji ->
                ReactionOption(emoji = emoji, isSelected = emoji == selected, onPick = { onPick(emoji) })
            }
        }
    }
}

/** One emoji: a 40dp circle (tinted when it's the viewer's) in a 44dp touch target, read by its name ("Love"). */
@Composable
private fun ReactionOption(
    emoji: PostReactionEmoji,
    isSelected: Boolean,
    onPick: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .size(44.dp)
                .clip(CircleShape)
                .testTag("pulseReactionOption_${emoji.key}")
                .clickable(role = Role.Button, onClick = onPick)
                .clearAndSetSemantics {
                    contentDescription = emoji.label
                    selected = isSelected
                }.padding(2.dp),
        contentAlignment = Alignment.Center,
    ) {
        Box(
            modifier =
                Modifier
                    .fillMaxSize()
                    .clip(CircleShape)
                    .background(if (isSelected) PantopusColors.primary100 else Color.Transparent)
                    .then(
                        if (isSelected) {
                            Modifier.border(1.dp, PantopusColors.primary700.copy(alpha = 0.25f), CircleShape)
                        } else {
                            Modifier
                        },
                    ),
            contentAlignment = Alignment.Center,
        ) {
            Text(text = emoji.emoji, fontSize = 22.sp)
        }
    }
}

/**
 * Puts the popup's capsule [gap] px above its anchor (below it when the window has no room above), lined up with the
 * anchor's leading edge and kept [margin] px inside the window. The popup is [shadowRoom] px larger than the capsule on
 * every side.
 */
private class AboveAnchorPosition(
    private val gap: Int,
    private val shadowRoom: Int,
    private val margin: Int,
) : PopupPositionProvider {
    override fun calculatePosition(
        anchorBounds: IntRect,
        windowSize: IntSize,
        layoutDirection: LayoutDirection,
        popupContentSize: IntSize,
    ): IntOffset {
        val leading =
            if (layoutDirection == LayoutDirection.Ltr) {
                anchorBounds.left - shadowRoom
            } else {
                anchorBounds.right - popupContentSize.width + shadowRoom
            }
        val x = leading.coerceAtMost(windowSize.width - popupContentSize.width + shadowRoom - margin).coerceAtLeast(margin - shadowRoom)
        val above = anchorBounds.top - gap - popupContentSize.height + shadowRoom
        val y = if (above + shadowRoom >= margin) above else anchorBounds.bottom + gap - shadowRoom
        return IntOffset(x, y)
    }
}
