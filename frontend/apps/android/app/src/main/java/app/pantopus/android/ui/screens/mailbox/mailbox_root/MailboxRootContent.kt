@file:Suppress("PackageNaming", "MagicNumber", "LongParameterList", "TooManyFunctions")

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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
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
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.components.CompactButton
import app.pantopus.android.ui.components.CompactButtonSize
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.mailbox.components.MailPiece
import app.pantopus.android.ui.screens.mailbox.components.MailPieceModel
import app.pantopus.android.ui.screens.mailbox.components.MailboxDrawing
import app.pantopus.android.ui.screens.mailbox.components.MailboxHeroState
import app.pantopus.android.ui.screens.shared.list_of_rows.CompactButtonVariant
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * The Mailbox's top card (drawings `Main`, `R1-Before`, `R4-NoMail`): the person's mailbox with their house number,
 * the morning round in words, and the verified address the mail comes to. Read as one sentence.
 */
@Composable
fun MailboxHeroCard(hero: MailboxHeroState) {
    // One sentence each, with words for the "·" a screen reader would otherwise read out.
    val spoken =
        listOfNotNull(hero.title, hero.detail, hero.address)
            .joinToString(" ") { if (it.endsWith(".")) it else "$it." }
            .replace(" · ", ", ")
    Row(
        modifier =
            Modifier
                .padding(horizontal = Spacing.s4, vertical = Spacing.s1)
                .fillMaxWidth()
                .clip(RoundedCornerShape(20.dp))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(20.dp))
                .padding(horizontal = Spacing.s4, vertical = 14.dp)
                .clearAndSetSemantics { contentDescription = spoken }
                .testTag("mailboxHero"),
        horizontalArrangement = Arrangement.spacedBy(14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        MailboxDrawing(modifier = Modifier.size(72.dp), number = hero.number)
        Column(modifier = Modifier.weight(1f)) {
            Text(hero.title, fontSize = 16.sp, lineHeight = 22.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
            Text(hero.detail, fontSize = 14.sp, lineHeight = 20.sp, color = PantopusColors.appTextSecondary)
            hero.address?.let {
                Spacer(Modifier.height(Spacing.s1))
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                    PantopusIconImage(icon = PantopusIcon.ShieldCheck, contentDescription = null, size = 13.dp, tint = PantopusColors.home)
                    Text(it, fontSize = 12.sp, lineHeight = 16.sp, fontWeight = FontWeight.Medium, color = PantopusColors.home)
                }
            }
        }
    }
}

/** The top card's place while the mailbox's counts are read: the same size, so nothing jumps when it arrives. */
@Composable
fun MailboxHeroPlaceholder() {
    Box(modifier = Modifier.padding(horizontal = Spacing.s4, vertical = Spacing.s1).testTag("mailboxHeroLoading")) {
        Shimmer(width = 328.dp, height = 100.dp, cornerRadius = 20.dp, modifier = Modifier.fillMaxWidth())
    }
}

/** The drawers: Me · Home · Biz, the open one filled with its colour, each with its unopened count inside. */
@Composable
fun MailboxDrawerRow(
    drawers: List<MailboxDrawer>,
    selected: MailboxDrawer,
    unread: (MailboxDrawer) -> Int,
    onSelect: (MailboxDrawer) -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState())
                .padding(start = Spacing.s4, end = Spacing.s4, top = Spacing.s4, bottom = Spacing.s1)
                .testTag("mailboxRootDrawerRow"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        drawers.forEach { drawer ->
            val active = drawer == selected
            val count = unread(drawer)
            val foreground = if (active) PantopusColors.appTextInverse else PantopusColors.appTextStrong
            Row(
                modifier =
                    Modifier
                        .heightIn(min = 44.dp)
                        .clip(CircleShape)
                        .background(if (active) drawer.accent else PantopusColors.appSurface)
                        .then(if (active) Modifier else Modifier.border(1.dp, PantopusColors.appBorder, CircleShape))
                        .clickable { onSelect(drawer) }
                        .padding(start = Spacing.s3, end = if (count > 0) Spacing.s2 else Spacing.s4)
                        .clearAndSetSemantics {
                            contentDescription = if (count > 0) "${drawer.label}, $count unopened" else drawer.label
                            role = Role.Tab
                            this.selected = active
                        }.testTag("mailboxRootDrawer.${drawer.id}"),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                PantopusIconImage(icon = drawer.icon, contentDescription = null, size = 16.dp, tint = foreground)
                Text(drawer.label, fontSize = 14.sp, lineHeight = 20.sp, fontWeight = FontWeight.SemiBold, color = foreground)
                if (count > 0) {
                    // The drawing's 20-dp count; its own line height keeps it inside the chip at the largest text.
                    Box(
                        modifier =
                            Modifier
                                .sizeIn(minWidth = 20.dp, minHeight = 20.dp)
                                .clip(CircleShape)
                                .background(if (active) PantopusColors.appSurface else PantopusColors.primary100)
                                .padding(horizontal = 6.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            if (count > 99) "99+" else "$count",
                            fontSize = 11.sp,
                            lineHeight = 14.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (active) drawer.accent else PantopusColors.info,
                        )
                    }
                }
            }
        }
    }
}

/** Incoming · Counter · Vault, underlined. */
@Composable
fun MailboxTabRow(
    tabs: List<MailboxTab>,
    selected: MailboxTab,
    onSelect: (MailboxTab) -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth().background(PantopusColors.appBg)) {
        Row(modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s2).testTag("mailboxRootTabBar")) {
            tabs.forEach { tab ->
                val active = tab == selected
                Column(
                    modifier =
                        Modifier
                            .weight(1f)
                            .clickable { onSelect(tab) }
                            .heightIn(min = 44.dp)
                            .padding(top = Spacing.s3)
                            .semantics {
                                role = Role.Tab
                                this.selected = active
                            }.testTag("mailboxRootTab.${tab.id}"),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text(
                        tab.label,
                        fontSize = 14.sp,
                        fontWeight = if (active) FontWeight.SemiBold else FontWeight.Medium,
                        color = if (active) PantopusColors.primary600 else PantopusColors.appTextMuted,
                    )
                    Spacer(Modifier.height(Spacing.s2))
                    Box(
                        modifier =
                            Modifier
                                .padding(horizontal = Spacing.s5)
                                .fillMaxWidth()
                                .height(2.5.dp)
                                .clip(CircleShape)
                                .background(if (active) PantopusColors.primary600 else Color.Transparent),
                    )
                }
            }
        }
        HorizontalDivider(color = PantopusColors.appBorder)
    }
}

/** "N items need routing": mail waiting in the routing queue, which opens from here. */
@Composable
fun PendingRoutingBanner(
    count: Int,
    onClick: () -> Unit,
) {
    val label = "$count item${if (count == 1) "" else "s"} need routing"
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        modifier =
            Modifier
                .padding(horizontal = Spacing.s4, vertical = Spacing.s1)
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.warningBg)
                .clickable(onClick = onClick)
                .padding(horizontal = Spacing.s4, vertical = 10.dp)
                .heightIn(min = 44.dp)
                .testTag("mailboxRootPendingBanner")
                .semantics { contentDescription = "$label. Opens the routing queue." },
    ) {
        PantopusIconImage(icon = PantopusIcon.HelpCircle, contentDescription = null, size = Radii.xl, tint = PantopusColors.warning)
        Text(label, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.warning, modifier = Modifier.weight(1f))
        PantopusIconImage(icon = PantopusIcon.ChevronRight, contentDescription = null, size = 14.dp, tint = PantopusColors.warning)
    }
}

/** A day's heading: Today, Yesterday, Earlier this week, Earlier. */
@Composable
fun MailSectionHeader(title: String) {
    Text(
        title.uppercase(),
        fontSize = 11.sp,
        lineHeight = 16.sp,
        fontWeight = FontWeight.SemiBold,
        letterSpacing = 0.06.em,
        color = PantopusColors.appTextSecondary,
        modifier =
            Modifier
                .padding(start = Spacing.s4, end = Spacing.s4, top = 18.dp, bottom = Spacing.s2)
                .semantics { heading() },
    )
}

/** A piece and the line under it, opened with a tap and read as one sentence. */
@Composable
fun MailPieceRow(
    piece: MailPieceModel,
    onOpen: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .padding(horizontal = Spacing.s4, vertical = Spacing.s2)
                .fillMaxWidth()
                .clip(RoundedCornerShape(8.dp))
                .clickable(onClick = onOpen)
                .clearAndSetSemantics {
                    contentDescription = piece.accessibilityLabel
                    role = Role.Button
                }.testTag("mailPiece.${piece.id}"),
    ) {
        MailPiece(piece)
        if (piece.meta.isNotBlank()) {
            Text(
                piece.meta,
                fontSize = 12.sp,
                lineHeight = 16.sp,
                color = if (piece.special) PantopusColors.error else PantopusColors.appTextMuted,
                modifier = Modifier.padding(top = 6.dp, start = 2.dp),
            )
        }
    }
}

/** Pieces-shaped placeholders while the mail is read. */
@Composable
fun MailPieceSkeleton() {
    Column(modifier = Modifier.padding(horizontal = Spacing.s4, vertical = Spacing.s2).testTag("mailboxRootLoading")) {
        Shimmer(width = 328.dp, height = 150.dp, cornerRadius = 6.dp, modifier = Modifier.fillMaxWidth())
        Spacer(Modifier.height(6.dp))
        Shimmer(width = 120.dp, height = 12.dp, cornerRadius = 4.dp)
    }
}

/** Nothing in this drawer and tab: what comes here, in plain words. */
@Composable
fun MailboxEmptyCard(
    headline: String,
    body: String,
) {
    EmptyState(
        icon = PantopusIcon.Mailbox,
        headline = headline,
        subcopy = body,
        modifier = Modifier.padding(vertical = Spacing.s4).testTag("mailboxRootEmpty"),
    )
}

/** The mail didn't load: what happened and what to do, with Try again. Never an empty screen. */
@Composable
fun MailboxErrorCard(
    message: String,
    onRetry: () -> Unit,
) {
    ErrorState(
        headline = "Your mail didn't load",
        message = message,
        modifier = Modifier.padding(vertical = Spacing.s4).testTag("mailboxRootError"),
        onRetry = onRetry,
    )
}

/** The end of a long list: the next page loading, or why it didn't, with Try again. */
@Composable
fun MailboxListFooter(
    loadMoreError: String?,
    onRetry: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(Spacing.s4),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        if (loadMoreError != null) {
            Text(loadMoreError, fontSize = 13.sp, color = PantopusColors.appTextSecondary, textAlign = TextAlign.Center)
            Spacer(Modifier.height(Spacing.s2))
            CompactButton(
                title = "Try again",
                variant = CompactButtonVariant.Primary,
                size = CompactButtonSize.InlineAction,
                onClick = onRetry,
                modifier = Modifier.testTag("mailboxRootRetryMore"),
            )
        } else {
            Shimmer(width = 120.dp, height = 12.dp, cornerRadius = 4.dp)
        }
    }
}
