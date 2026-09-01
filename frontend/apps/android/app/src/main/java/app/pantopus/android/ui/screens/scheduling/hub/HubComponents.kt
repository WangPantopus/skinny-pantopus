@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "TooManyFunctions", "LongParameterList")

package app.pantopus.android.ui.screens.scheduling.hub

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.scheduling._shared.PantopusMiniToggle
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingStatusPill
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import java.util.Locale

internal val CARD_RADIUS = 16.dp
internal val ROW_RADIUS = 14.dp

internal fun hubKindColors(kind: HubBookingKind): Pair<Color, Color> =
    when (kind) {
        HubBookingKind.Video -> PantopusColors.primary100 to PantopusColors.primary600
        HubBookingKind.Phone -> PantopusColors.personalBg to PantopusColors.primary700
        HubBookingKind.InPerson -> PantopusColors.homeBg to PantopusColors.homeDark
        HubBookingKind.Consult -> PantopusColors.businessBg to PantopusColors.businessDark
    }

internal fun hubToneColors(tone: HubAvatarTone): Pair<Color, Color> =
    when (tone) {
        HubAvatarTone.Blue -> PantopusColors.primary200 to PantopusColors.primary800
        HubAvatarTone.Green -> PantopusColors.homeBg to PantopusColors.homeDark
        HubAvatarTone.Amber -> PantopusColors.warmAmberBg to PantopusColors.warmAmber
        HubAvatarTone.Rose -> PantopusColors.errorLight to PantopusColors.error
        HubAvatarTone.Violet -> PantopusColors.businessBg to PantopusColors.businessDark
    }

@Composable
internal fun HubCard(
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    Box(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(CARD_RADIUS))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(CARD_RADIUS))
                .padding(14.dp),
    ) { content() }
}

@Composable
internal fun HubAvatar(
    initials: String,
    tone: HubAvatarTone,
    size: androidx.compose.ui.unit.Dp = 20.dp,
) {
    val (bg, fg) = hubToneColors(tone)
    Box(
        modifier = Modifier.size(size).clip(CircleShape).background(bg),
        contentAlignment = Alignment.Center,
    ) {
        Text(text = initials, color = fg, fontWeight = FontWeight.Bold, fontSize = 9.sp)
    }
}

@Composable
internal fun HubComposedNote(
    pillar: SchedulingPillar,
    initials: List<String>,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(10.dp))
                .background(pillar.accentBg)
                .padding(horizontal = Spacing.s3, vertical = 9.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(icon = PantopusIcon.Info, contentDescription = null, size = 15.dp, tint = pillar.accent)
        Text(
            text = "Times come from each member's personal availability.",
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextStrong,
            modifier = Modifier.weight(1f),
        )
        Row(horizontalArrangement = Arrangement.spacedBy((-6).dp)) {
            initials.forEachIndexed { i, label ->
                Box(
                    modifier =
                        Modifier
                            .size(22.dp)
                            .clip(CircleShape)
                            .background(PantopusColors.appSurface)
                            .padding(2.dp),
                ) {
                    HubAvatar(initials = label, tone = HubAvatarTone.entries[i % HubAvatarTone.entries.size], size = 18.dp)
                }
            }
        }
    }
}

@Composable
internal fun BookingLinkCard(
    pillar: SchedulingPillar,
    displayName: String,
    displayRole: String,
    handle: String,
    isPaused: Boolean,
    readOnly: Boolean,
    onCopy: () -> Unit,
    onShare: () -> Unit,
) {
    HubCard {
        Column {
            Row(verticalAlignment = Alignment.CenterVertically) {
                PantopusIconImage(icon = PantopusIcon.Link, contentDescription = null, size = 14.dp, tint = pillar.accent)
                Spacer(Modifier.width(Spacing.s1))
                Text("Your booking link", color = PantopusColors.appTextStrong, fontWeight = FontWeight.Bold, fontSize = 11.5.sp)
                Spacer(Modifier.weight(1f))
                Text(
                    "Anyone with the link can book you",
                    color = PantopusColors.appTextSecondary,
                    fontSize = 11.sp,
                )
            }
            Spacer(Modifier.height(Spacing.s3))
            LinkPreview(pillar = pillar, displayName = displayName, displayRole = displayRole, isPaused = isPaused)
            Spacer(Modifier.height(Spacing.s3))
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(10.dp))
                        .background(PantopusColors.appSurfaceSunken)
                        .padding(horizontal = Spacing.s3, vertical = 9.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = handle,
                    style = PantopusTextStyle.small.copy(fontFamily = FontFamily.Monospace),
                    color = PantopusColors.appText,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                Box(
                    modifier =
                        Modifier
                            .size(30.dp)
                            .clip(RoundedCornerShape(Radii.md))
                            .background(PantopusColors.appSurface)
                            .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                            .semantics { contentDescription = "Show QR code" },
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.QrCode,
                        contentDescription = null,
                        size = 15.dp,
                        tint = PantopusColors.appTextStrong,
                    )
                }
            }
            Spacer(Modifier.height(Spacing.s2 + 2.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                GhostLinkButton(
                    icon = PantopusIcon.Copy,
                    label = "Copy link",
                    onClick = onCopy,
                    modifier = Modifier.weight(1f).testTag(HubTags.COPY_LINK),
                )
                if (!readOnly) {
                    GhostLinkButton(
                        icon = PantopusIcon.Share,
                        label = "Share",
                        onClick = onShare,
                        modifier = Modifier.weight(1f).testTag(HubTags.SHARE),
                    )
                }
            }
        }
    }
}

@Composable
private fun GhostLinkButton(
    icon: PantopusIcon,
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .height(38.dp)
                .clip(RoundedCornerShape(10.dp))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(10.dp))
                .clickable(onClick = onClick),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1 + 2.dp, Alignment.CenterHorizontally),
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 14.dp, tint = PantopusColors.appText)
        Text(label, color = PantopusColors.appText, fontWeight = FontWeight.SemiBold, fontSize = 12.5.sp)
    }
}

/** Up-to-two leading-letter initials from a display name (matches the design's preview avatar). */
private fun previewInitials(name: String): String =
    name.split(' ')
        .filter { it.isNotBlank() }
        .map { it.first().uppercaseChar() }
        .joinToString("")
        .take(2)

@Composable
private fun LinkPreview(
    pillar: SchedulingPillar,
    displayName: String,
    displayRole: String,
    isPaused: Boolean,
) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(140.dp)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurfaceSunken),
        contentAlignment = Alignment.Center,
    ) {
        // Live-preview badge, top-start.
        Row(
            modifier =
                Modifier
                    .align(Alignment.TopStart)
                    .padding(Spacing.s2)
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.pill))
                    .padding(horizontal = 7.dp, vertical = 2.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            Box(
                modifier =
                    Modifier
                        .size(5.dp)
                        .clip(CircleShape)
                        .background(if (isPaused) PantopusColors.appTextMuted else PantopusColors.success),
            )
            Text("LIVE PREVIEW", color = PantopusColors.appTextSecondary, fontWeight = FontWeight.Bold, fontSize = 9.sp)
        }
        // Mini page card.
        Column(
            modifier =
                Modifier
                    .width(188.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(10.dp)),
        ) {
            Box(modifier = Modifier.fillMaxWidth().height(30.dp).background(pillar.accent)) {
                // 26dp avatar disc straddling the header/body seam, white-bordered.
                Box(
                    modifier =
                        Modifier
                            .align(Alignment.BottomStart)
                            .padding(start = Spacing.s3)
                            .offset(y = 12.dp)
                            .size(26.dp)
                            .clip(CircleShape)
                            .background(PantopusColors.appSurface)
                            .padding(2.dp)
                            .clip(CircleShape)
                            .background(pillar.accent),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = previewInitials(displayName),
                        color = PantopusColors.appTextInverse,
                        fontWeight = FontWeight.Bold,
                        fontSize = 9.sp,
                    )
                }
            }
            Column(modifier = Modifier.padding(horizontal = Spacing.s3, vertical = Spacing.s2)) {
                Text(displayName, color = PantopusColors.appText, fontWeight = FontWeight.Bold, fontSize = 10.sp)
                Text(displayRole, color = PantopusColors.appTextSecondary, fontSize = 8.sp)
                Spacer(Modifier.height(Spacing.s2))
                Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                    listOf("9:00", "9:30", "10:00").forEach { chip ->
                        Box(
                            modifier =
                                Modifier
                                    .weight(1f)
                                    .clip(RoundedCornerShape(Radii.sm))
                                    .background(if (isPaused) PantopusColors.appSurfaceSunken else pillar.accentBg)
                                    .padding(vertical = 4.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(
                                chip,
                                color = if (isPaused) PantopusColors.appTextMuted else pillar.accent,
                                fontWeight = FontWeight.Bold,
                                fontSize = 8.sp,
                            )
                        }
                    }
                }
            }
        }
        if (isPaused) {
            // Translucent scrim dimming the whole preview behind the centered pill.
            Box(modifier = Modifier.matchParentSize().background(PantopusColors.appBg.copy(alpha = 0.55f)))
            Row(
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(PantopusColors.appSurface)
                        // Hub frames use the deep warm-amber trio (P.warning /
                        // warningBorder), not the lighter semantic warning tokens.
                        .border(1.dp, PantopusColors.warmAmberBorder, RoundedCornerShape(Radii.pill))
                        .padding(horizontal = 11.dp, vertical = 5.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                PantopusIconImage(icon = PantopusIcon.Pause, contentDescription = null, size = 12.dp, tint = PantopusColors.warmAmber)
                Text("Paused", color = PantopusColors.warmAmber, fontWeight = FontWeight.Bold, fontSize = 11.sp)
            }
        }
    }
}

@Composable
internal fun HubPauseRow(
    pillar: SchedulingPillar,
    isAccepting: Boolean,
    onToggle: (Boolean) -> Unit,
) {
    StatusCard {
        IconTile(icon = PantopusIcon.CalendarCheck, bg = pillar.accentBg, fg = pillar.accent)
        Spacer(Modifier.width(Spacing.s3))
        Column(Modifier.weight(1f)) {
            Text("Accepting bookings", color = PantopusColors.appText, fontWeight = FontWeight.SemiBold, fontSize = 13.5.sp)
            Text("New bookings are open", color = PantopusColors.appTextSecondary, fontSize = 11.5.sp)
        }
        PantopusMiniToggle(
            checked = isAccepting,
            onCheckedChange = onToggle,
            accent = pillar.accent,
            modifier =
                Modifier
                    .testTag(HubTags.PAUSE_TOGGLE)
                    .semantics { contentDescription = "Accepting bookings" },
        )
    }
}

@Composable
internal fun HubPausedBanner(onResume: () -> Unit) {
    // Frame palette: warningSoft surface + warningBorder outline + warningBg icon tile
    // (scheduling-hub-frames.jsx:15, 332-336) — all deep warm-amber family.
    StatusCard(bg = PantopusColors.warmAmberSoft, border = PantopusColors.warmAmberBorder) {
        IconTile(icon = PantopusIcon.Pause, bg = PantopusColors.warmAmberBg, fg = PantopusColors.warmAmber)
        Spacer(Modifier.width(Spacing.s3))
        Column(Modifier.weight(1f)) {
            Text("Bookings are paused", color = PantopusColors.appText, fontWeight = FontWeight.SemiBold, fontSize = 13.5.sp)
            Text("New bookings are turned off", color = PantopusColors.appTextSecondary, fontSize = 11.5.sp)
        }
        Box(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.warmAmber)
                    .clickable(onClick = onResume)
                    .padding(horizontal = 14.dp, vertical = Spacing.s2)
                    .testTag(HubTags.RESUME),
        ) {
            Text("Resume", color = PantopusColors.appTextInverse, fontWeight = FontWeight.Bold, fontSize = 12.sp)
        }
    }
}

@Composable
internal fun HubReadOnlyStatus(pillar: SchedulingPillar) {
    StatusCard {
        IconTile(icon = PantopusIcon.CalendarCheck, bg = pillar.accentBg, fg = pillar.accent)
        Spacer(Modifier.width(Spacing.s3))
        Column(Modifier.weight(1f)) {
            Text("Accepting bookings", color = PantopusColors.appText, fontWeight = FontWeight.SemiBold, fontSize = 13.5.sp)
            Text("Managed by the home owner", color = PantopusColors.appTextSecondary, fontSize = 11.5.sp)
        }
        PantopusIconImage(icon = PantopusIcon.Lock, contentDescription = null, size = 16.dp, tint = PantopusColors.appTextMuted)
    }
}

@Composable
private fun StatusCard(
    bg: Color = PantopusColors.appSurface,
    border: Color = PantopusColors.appBorder,
    content: @Composable RowScope.() -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(ROW_RADIUS))
                .background(bg)
                .border(1.dp, border, RoundedCornerShape(ROW_RADIUS))
                .padding(horizontal = 14.dp, vertical = 13.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) { content() }
}

@Composable
private fun IconTile(
    icon: PantopusIcon,
    bg: Color,
    fg: Color,
) {
    Box(
        modifier = Modifier.size(34.dp).clip(RoundedCornerShape(9.dp)).background(bg),
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 18.dp, tint = fg)
    }
}

@Composable
internal fun HubAgendaDateHeader(
    header: String,
    sub: String,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(top = Spacing.s3, bottom = Spacing.s2),
        verticalAlignment = Alignment.Bottom,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Text(header.uppercase(Locale.US), color = PantopusColors.appText, fontWeight = FontWeight.Bold, fontSize = 12.sp)
        // Future-day sections carry the full date in the header and no sub —
        // render a single "THU AUG 7" line (iOS HubAgendaDateHeader parity).
        if (sub.isNotEmpty()) {
            Text(sub, color = PantopusColors.appTextMuted, fontWeight = FontWeight.Medium, fontSize = 11.sp)
        }
    }
}

@Composable
internal fun HubBookingRowCard(row: HubBookingRowUi) {
    val (bg, fg) = hubKindColors(row.kind)
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(ROW_RADIUS))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(ROW_RADIUS))
                .padding(Spacing.s3),
    ) {
        Row {
            Box(
                modifier = Modifier.size(40.dp).clip(RoundedCornerShape(10.dp)).background(bg),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(icon = kindIcon(row.kind), contentDescription = null, size = 20.dp, tint = fg)
            }
            Spacer(Modifier.width(Spacing.s3))
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        row.title,
                        color = PantopusColors.appText,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 13.5.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f),
                    )
                    Spacer(Modifier.width(Spacing.s2))
                    Text(row.timeLabel, color = PantopusColors.appText, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                }
                Spacer(Modifier.height(3.dp))
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                    PantopusIconImage(
                        icon = PantopusIcon.Clock,
                        contentDescription = null,
                        size = 11.dp,
                        tint = PantopusColors.appTextMuted,
                    )
                    Text(row.metaLabel, color = PantopusColors.appTextSecondary, fontSize = 11.5.sp)
                    // Cross-owner host attribution for composed hubs — inline 11dp user
                    // glyph + host first name after the duration, in fg3
                    // (scheduling-hub-frames.jsx:440-444, FrameHome :767-772).
                    row.hostName?.let { host ->
                        Row(
                            modifier = Modifier.padding(start = 2.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(3.dp),
                        ) {
                            PantopusIconImage(
                                icon = PantopusIcon.User,
                                contentDescription = null,
                                size = 11.dp,
                                tint = PantopusColors.appTextSecondary,
                            )
                            Text(host, color = PantopusColors.appTextSecondary, fontSize = 11.5.sp)
                        }
                    }
                }
                Spacer(Modifier.height(Spacing.s2))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    HubAvatar(initials = row.bookerInitials, tone = row.bookerTone, size = 20.dp)
                    Spacer(Modifier.width(Spacing.s2))
                    Text(
                        row.bookerName,
                        color = PantopusColors.appTextStrong,
                        fontWeight = FontWeight.Medium,
                        fontSize = 11.5.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f),
                    )
                    SchedulingStatusPill(status = row.status)
                }
            }
        }
    }
}

private fun kindIcon(kind: HubBookingKind): PantopusIcon =
    when (kind) {
        HubBookingKind.Video -> PantopusIcon.Video
        HubBookingKind.Phone -> PantopusIcon.Phone
        HubBookingKind.InPerson -> PantopusIcon.MapPin
        HubBookingKind.Consult -> PantopusIcon.ClipboardList
    }

@Composable
internal fun HubManageGroup(
    rows: List<HubManageItem>,
    readOnly: Boolean,
    onNavigate: (String) -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(ROW_RADIUS))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(ROW_RADIUS)),
    ) {
        rows.forEachIndexed { index, item ->
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .then(if (readOnly) Modifier else Modifier.clickable { onNavigate(item.route) })
                        .padding(horizontal = 14.dp, vertical = 13.dp)
                        .testTag("${HubTags.MANAGE_PREFIX}${item.id}"),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                PantopusIconImage(icon = item.icon, contentDescription = null, size = 18.dp, tint = PantopusColors.appTextStrong)
                Spacer(Modifier.width(Spacing.s3))
                Text(
                    item.label,
                    color = PantopusColors.appText,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 13.5.sp,
                    modifier = Modifier.weight(1f),
                )
                item.value?.let { value ->
                    Text(
                        value,
                        color = if (item.alert) PantopusColors.warmAmber else PantopusColors.appTextSecondary,
                        fontWeight = if (item.alert) FontWeight.Bold else FontWeight.Medium,
                        fontSize = 12.sp,
                    )
                }
                if (!readOnly) {
                    Spacer(Modifier.width(Spacing.s2))
                    PantopusIconImage(
                        icon = PantopusIcon.ChevronRight,
                        contentDescription = null,
                        size = 14.dp,
                        tint = PantopusColors.appTextMuted,
                    )
                }
            }
            if (index < rows.lastIndex) {
                Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorderSubtle))
            }
        }
    }
}

@Composable
internal fun HubSectionHeader(
    title: String,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(top = Spacing.s5, bottom = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            title.uppercase(Locale.US),
            color = PantopusColors.appTextSecondary,
            fontWeight = FontWeight.Bold,
            fontSize = 10.5.sp,
            modifier = Modifier.weight(1f),
        )
        if (actionLabel != null && onAction != null) {
            Row(
                modifier = Modifier.clickable(onClick = onAction),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                Text(actionLabel, color = PantopusColors.primary600, fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
                PantopusIconImage(
                    icon = PantopusIcon.ChevronRight,
                    contentDescription = null,
                    size = 13.dp,
                    tint = PantopusColors.primary600,
                )
            }
        }
    }
}

@Composable
internal fun HubFooterCta(
    pillar: SchedulingPillar,
    isPaused: Boolean,
    onClick: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                // Design FooterCTA is a translucent blurred bar (rgba(255,255,255,0.94) +
                // backdrop-filter) and iOS uses .ultraThinMaterial; Compose has no cheap
                // backdrop blur, so approximate with a translucent surface so content
                // peeks through beneath the pinned CTA.
                .background(PantopusColors.appSurface.copy(alpha = 0.94f))
                .padding(start = Spacing.s4, end = Spacing.s4, top = Spacing.s3, bottom = Spacing.s6),
    ) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(48.dp)
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(pillar.accent)
                    .clickable(onClick = onClick)
                    .testTag(HubTags.FOOTER_CTA),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2, Alignment.CenterHorizontally),
        ) {
            PantopusIconImage(
                icon = if (isPaused) PantopusIcon.Play else PantopusIcon.Share,
                contentDescription = null,
                size = 17.dp,
                tint = PantopusColors.appTextInverse,
            )
            Text(
                if (isPaused) "Resume bookings" else "Share booking link",
                color = PantopusColors.appTextInverse,
                fontWeight = FontWeight.Bold,
                fontSize = 14.5.sp,
            )
        }
    }
}

/** Stream-local test tags mirroring the iOS accessibility identifiers. */
internal object HubTags {
    const val SKELETON = "schedulingHubSkeleton"
    const val RETRY = "schedulingHubRetry"
    const val COPY_LINK = "schedulingHubCopyLink"
    const val SHARE = "schedulingHubShare"
    const val PAUSE_TOGGLE = "schedulingHubPauseToggle"
    const val RESUME = "schedulingHubResume"
    const val FOOTER_CTA = "schedulingHubFooterCTA"
    const val EMPTY_CTA = "schedulingHubSetUpCTA"
    const val MANAGE_PREFIX = "schedulingManage_"
    const val PILLAR_PREFIX = "schedulingPillar"
    const val TOP_BAR_TRAILING = "schedulingTopBarTrailing"
}
