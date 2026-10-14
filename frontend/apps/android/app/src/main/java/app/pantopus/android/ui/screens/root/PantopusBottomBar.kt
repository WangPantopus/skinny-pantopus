@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.root

import android.os.Build
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.sizeIn
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Spacing

/**
 * Custom bottom bar matching the Pantopus design spec: 78dp tall, semi-
 * transparent white surface with a 12dp backdrop blur on API 31+, a 1dp
 * top border, four or five evenly-spaced tabs (Plans comes and goes with its switch, so the caller passes
 * [tabs]), active tint `primary600`, inactive tint `appTextSecondary`. A tab with a count in [badges] (Messages:
 * unread messages) draws a badge. Tab labels stop growing at 1.3x text size so five of them share the width; the
 * full name still reads in TalkBack.
 * The app draws edge to edge, so the surface extends under the system
 * navigation bar and the tabs sit above it.
 *
 * @param selected Currently selected route.
 * @param onSelect Called when the user taps a different tab.
 * @param badges Map of route → badge count. Missing entries render no badge.
 * @param tabs The tabs to draw, in order ([PantopusRoute.barTabs]).
 */
@Composable
fun PantopusBottomBar(
    selected: PantopusRoute,
    onSelect: (PantopusRoute) -> Unit,
    badges: Map<PantopusRoute, Int> = emptyMap(),
    tabs: List<PantopusRoute> = PantopusRoute.entries,
    modifier: Modifier = Modifier,
) {
    val background = PantopusColors.appSurface.copy(alpha = 0.96f)
    val blurModifier =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            Modifier.blur(12.dp)
        } else {
            Modifier
        }

    Box(
        modifier = modifier.fillMaxWidth(),
    ) {
        // Blurred tint layer — behind the content. On pre-S devices `blur`
        // is a no-op so we fall back to the solid translucent fill.
        Box(
            modifier =
                Modifier
                    .matchParentSize()
                    .background(background)
                    .then(blurModifier),
        )
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .border(1.dp, PantopusColors.appBorder)
                    .navigationBarsPadding()
                    .height(78.dp)
                    .selectableGroup(),
            horizontalArrangement = Arrangement.SpaceAround,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            tabs.forEach { route ->
                TabItem(
                    route = route,
                    isSelected = route == selected,
                    badge = badges[route] ?: 0,
                    onClick = { onSelect(route) },
                )
            }
        }
    }
}

/** Tab labels stop growing here, so "Messages" and four other labels fit one bar at the largest text size. */
private const val TAB_LABEL_MAX_FONT_SCALE = 1.3f

@Composable
private fun RowScope.TabItem(
    route: PantopusRoute,
    isSelected: Boolean,
    badge: Int,
    onClick: () -> Unit,
) {
    val tint = if (isSelected) PantopusColors.primary600 else PantopusColors.appTextSecondary
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
        modifier =
            Modifier
                .weight(1f)
                .sizeIn(minWidth = 48.dp, minHeight = 48.dp)
                // One node for TalkBack and the UI tests: the tag, the tab role with its selected state, and one name
                // for the tab (the label and badge inside are replaced by it, so nothing is read twice). It sits inside
                // `selectable` so the role, the selected state and the click stay.
                .testTag("tab.${route.path.substringAfterLast('/')}")
                .selectable(selected = isSelected, role = Role.Tab, onClick = onClick)
                .clearAndSetSemantics {
                    contentDescription = if (badge > 0) "${route.label}, $badge unread" else route.label
                }
                .padding(horizontal = 2.dp),
    ) {
        Box {
            PantopusIconImage(
                icon = route.icon,
                contentDescription = null,
                size = 22.dp,
                tint = tint,
            )
            if (badge > 0) {
                // Over the icon's top-right corner; the offset keeps the icon and label centered.
                InboxBadge(count = badge, modifier = Modifier.align(Alignment.TopEnd).offset(x = 8.dp, y = (-4).dp))
            }
        }
        Spacer(Modifier.size(Spacing.s1))
        val density = LocalDensity.current
        CompositionLocalProvider(LocalDensity provides Density(density.density, minOf(density.fontScale, TAB_LABEL_MAX_FONT_SCALE))) {
            Text(
                text = route.label,
                style = PantopusTextStyle.caption.copy(fontSize = 10.sp),
                color = tint,
                textAlign = TextAlign.Center,
                maxLines = 1,
                softWrap = false,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

@Composable
private fun InboxBadge(
    count: Int,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier =
            modifier
                .defaultMinSize(minWidth = 14.dp, minHeight = 14.dp)
                .clip(CircleShape)
                .background(PantopusColors.error)
                .border(1.5.dp, Color.White, CircleShape)
                .padding(horizontal = 3.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = if (count > 99) "99+" else count.toString(),
            style = PantopusTextStyle.caption.copy(fontSize = 9.sp),
            color = Color.White,
        )
    }
}
