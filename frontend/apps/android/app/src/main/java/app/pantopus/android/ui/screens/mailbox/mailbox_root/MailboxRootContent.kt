@file:Suppress("PackageNaming", "MagicNumber", "LongParameterList")

package app.pantopus.android.ui.screens.mailbox.mailbox_root

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.sizeIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * B.1 — chrome rendered in the List-of-Rows `customHeader` slot for the
 * Mailbox root: the 4-drawer chip row (Me / Home / Biz / Earn) and the
 * 3-tab segmented underline bar (Incoming / Counter / Vault). Mirrors the
 * JSX `DrawerRow` + `TabRow`.
 *
 * Above the drawer row sits the A13.16 "My mail day" call-to-action —
 * the host-supplied entry point into today's triage editor.
 */
@Composable
fun MailboxRootHeader(
    drawers: List<MailboxDrawer>,
    selectedDrawer: MailboxDrawer,
    tabs: List<MailboxTab>,
    selectedTab: MailboxTab,
    drawerBadge: (MailboxDrawer) -> Int,
    tabBadge: (MailboxTab) -> Int?,
    onSelectDrawer: (MailboxDrawer) -> Unit,
    onSelectTab: (MailboxTab) -> Unit,
    onOpenMailDay: () -> Unit = {},
    pendingRoutingCount: Int = 0,
    onOpenRoutingQueue: () -> Unit = {},
) {
    Column(modifier = Modifier.background(PantopusColors.appSurface)) {
        MailDayCTA(onClick = onOpenMailDay)
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .background(PantopusColors.appSurface)
                    .horizontalScroll(rememberScrollState())
                    .padding(horizontal = Spacing.s4, vertical = Spacing.s3)
                    .testTag("mailboxRootDrawerRow"),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            drawers.forEach { drawer ->
                DrawerChip(
                    label = drawer.label,
                    drawer = drawer,
                    isActive = drawer == selectedDrawer,
                    unread = drawerBadge(drawer),
                    onClick = { onSelectDrawer(drawer) },
                )
            }
        }
        HorizontalDivider(color = PantopusColors.appBorderSubtle)
        if (pendingRoutingCount > 0) {
            PendingRoutingBanner(
                count = pendingRoutingCount,
                onClick = onOpenRoutingQueue,
            )
        }
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .background(PantopusColors.appSurface)
                    .testTag("mailboxRootTabBar"),
        ) {
            tabs.forEach { tab ->
                TabSegment(
                    modifier = Modifier.weight(1f),
                    id = tab.id,
                    label = tab.label,
                    count = tabBadge(tab),
                    isActive = tab == selectedTab,
                    onClick = { onSelectTab(tab) },
                )
            }
        }
        HorizontalDivider(color = PantopusColors.appBorder)
    }
}

/**
 * "N items need routing" — opens the disambiguation queue. Rendered only
 * when `GET /api/mailbox/v2/pending` returned rows. Mirrors RN
 * (`src/app/mailbox/index.tsx:176-188`) and iOS `pendingRoutingBanner`.
 */
@Composable
private fun PendingRoutingBanner(
    count: Int,
    onClick: () -> Unit,
) {
    val label = "$count item${if (count == 1) "" else "s"} need routing"
    Column {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            modifier =
                Modifier
                    .fillMaxWidth()
                    .background(PantopusColors.warningBg)
                    .clickable(onClick = onClick)
                    .padding(horizontal = Spacing.s4, vertical = 10.dp)
                    .heightIn(min = 44.dp)
                    .testTag("mailboxRootPendingBanner")
                    .semantics { contentDescription = "$label. Opens the routing queue." },
        ) {
            PantopusIconImage(
                icon = PantopusIcon.HelpCircle,
                contentDescription = null,
                size = Radii.xl,
                strokeWidth = 2.2f,
                tint = PantopusColors.warning,
            )
            Text(
                text = label,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.warning,
                modifier = Modifier.weight(1f),
            )
            PantopusIconImage(
                icon = PantopusIcon.ChevronRight,
                contentDescription = null,
                size = 14.dp,
                strokeWidth = 2.2f,
                tint = PantopusColors.warning,
            )
        }
        HorizontalDivider(color = PantopusColors.warningLight)
    }
}

@Composable
private fun MailDayCTA(onClick: () -> Unit) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurface)
                .clickable(onClick = onClick)
                .padding(horizontal = Spacing.s4, vertical = 10.dp)
                .heightIn(min = 44.dp)
                .testTag("mailboxRootMailDayCTA")
                .semantics { contentDescription = "My mail day — triage today's stack" },
    ) {
        Box(
            modifier =
                Modifier
                    .height(32.dp)
                    .sizeIn(minWidth = 32.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.primary50),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Mailbox,
                contentDescription = null,
                size = Radii.xl,
                strokeWidth = 2.2f,
                tint = PantopusColors.primary700,
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = "My mail day",
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
            )
            Text(
                text = "Triage today's stack",
                fontSize = 11.sp,
                color = PantopusColors.appTextSecondary,
            )
        }
        PantopusIconImage(
            icon = PantopusIcon.ChevronRight,
            contentDescription = null,
            size = 15.dp,
            strokeWidth = 2.2f,
            tint = PantopusColors.appTextMuted,
        )
    }
}

@Composable
private fun DrawerChip(
    label: String,
    drawer: MailboxDrawer,
    isActive: Boolean,
    unread: Int,
    onClick: () -> Unit,
) {
    val foreground = if (isActive) PantopusColors.appTextInverse else PantopusColors.appTextSecondary
    val background = if (isActive) drawer.accent else PantopusColors.appSurface
    Box(
        modifier =
            Modifier
                .heightIn(min = 44.dp)
                .clickable(onClick = onClick)
                .testTag("mailboxRootDrawer.${drawer.id}")
                .semantics {
                    contentDescription = if (unread > 0) "$label, $unread unread" else label
                },
        contentAlignment = Alignment.Center,
    ) {
        Row(
            modifier =
                Modifier
                    .height(40.dp)
                    .clip(CircleShape)
                    .background(background)
                    .then(
                        if (isActive) {
                            Modifier
                        } else {
                            Modifier.border(1.dp, PantopusColors.appBorder, CircleShape)
                        },
                    )
                    .padding(start = Spacing.s3, end = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            PantopusIconImage(
                icon = drawer.icon,
                contentDescription = null,
                size = Radii.xl,
                tint = foreground,
            )
            Text(
                text = label,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                color = foreground,
            )
        }
        if (unread > 0) {
            ChipBadge(
                count = unread,
                onAccent = isActive,
                modifier = Modifier.align(Alignment.TopEnd).offset(x = (-2).dp, y = 2.dp),
            )
        }
    }
}

@Composable
private fun ChipBadge(
    count: Int,
    onAccent: Boolean,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier =
            modifier
                .sizeIn(minWidth = 18.dp, minHeight = 18.dp)
                .clip(CircleShape)
                .background(if (onAccent) PantopusColors.appTextInverse else PantopusColors.primary600)
                .border(2.dp, PantopusColors.appSurface, CircleShape)
                .padding(horizontal = 5.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = "$count",
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            color = if (onAccent) PantopusColors.primary700 else PantopusColors.appTextInverse,
        )
    }
}

@Composable
private fun TabSegment(
    modifier: Modifier,
    id: String,
    label: String,
    count: Int?,
    isActive: Boolean,
    onClick: () -> Unit,
) {
    Column(
        modifier =
            modifier
                .clickable(onClick = onClick)
                .heightIn(min = 44.dp)
                .padding(top = Spacing.s3)
                .testTag("mailboxRootTab.$id")
                .semantics {
                    contentDescription = if (count != null) "$label, $count unread" else label
                },
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            Text(
                text = label,
                fontSize = 13.sp,
                fontWeight = if (isActive) FontWeight.Bold else FontWeight.Medium,
                color = if (isActive) PantopusColors.primary600 else PantopusColors.appTextMuted,
            )
            if (count != null) {
                TabCount(count = count, isActive = isActive)
            }
        }
        Spacer(Modifier.height(Spacing.s2))
        Box(
            modifier =
                Modifier
                    .padding(horizontal = Spacing.s5)
                    .fillMaxWidth()
                    .height(2.5.dp)
                    .clip(CircleShape)
                    .background(if (isActive) PantopusColors.primary600 else Color.Transparent),
        )
    }
}

@Composable
private fun TabCount(
    count: Int,
    isActive: Boolean,
) {
    Box(
        modifier =
            Modifier
                .sizeIn(minWidth = 18.dp, minHeight = 16.dp)
                .clip(CircleShape)
                .background(if (isActive) PantopusColors.primary600 else PantopusColors.appSurfaceSunken)
                .padding(horizontal = 5.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = "$count",
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            color = if (isActive) PantopusColors.appTextInverse else PantopusColors.appTextSecondary,
        )
    }
}
