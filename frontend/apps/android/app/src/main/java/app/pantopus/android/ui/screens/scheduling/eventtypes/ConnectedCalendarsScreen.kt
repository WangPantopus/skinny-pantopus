@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "UnusedParameter", "TooManyFunctions")

package app.pantopus.android.ui.screens.scheduling.eventtypes

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.api.models.scheduling.ConnectedCalendarDto
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.SchedulingPalette
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.delay

// Provider glyphs. Lucide spec wants calendar-sync (hero) + calendar-range
// (Outlook); neither exists in PantopusIcon, so the closest calendar glyphs
// stand in (recorded as deferred).
private val PROVIDER_ICONS =
    mapOf(
        "google" to PantopusIcon.CalendarDays,
        "apple" to PantopusIcon.Calendar,
        "outlook" to PantopusIcon.CalendarDays,
    )

// Friendly provider names per design `connected-calendars-frames.jsx` PROVIDERS.
private val PROVIDER_NAMES =
    mapOf(
        "google" to "Google Calendar",
        "apple" to "Apple Calendar",
        "outlook" to "Outlook",
    )

// Per-brand tile colors (design PROVIDERS.color), sourced from the theme-layer
// SchedulingPalette so no brand hex literal lives in feature code.
private val PROVIDER_BRAND_COLORS =
    mapOf(
        "google" to SchedulingPalette.calendarGoogle,
        "apple" to SchedulingPalette.calendarApple,
        "outlook" to SchedulingPalette.calendarOutlook,
    )

private fun brandColor(provider: String): Color = PROVIDER_BRAND_COLORS[provider] ?: PantopusColors.primary600

private fun providerName(provider: String): String = PROVIDER_NAMES[provider] ?: provider.replaceFirstChar { it.uppercase() }

/** Calendar-connection state derived from the DTO `status` wire value. */
private enum class CalendarRowKind { CONNECTED, REAUTH, DENIED, CONNECTING, CONNECT }

private fun rowKindOf(status: String?): CalendarRowKind =
    when (status?.lowercase()) {
        "synced", "connected", "active", "ok" -> CalendarRowKind.CONNECTED
        "reauth", "needs_reauth", "reauth_required", "error", "sync_error", "expired" -> CalendarRowKind.REAUTH
        "denied", "permission_denied", "forbidden" -> CalendarRowKind.DENIED
        "connecting", "pending" -> CalendarRowKind.CONNECTING
        else -> CalendarRowKind.CONNECT
    }

@Composable
fun ConnectedCalendarsScreen(
    onBack: () -> Unit = {},
    onNavigate: (String) -> Unit = {},
    viewModel: ConnectedCalendarsViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val toast by viewModel.toast.collectAsStateWithLifecycle()
    var toastText by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) { viewModel.start() }
    LaunchedEffect(toast) {
        toast?.let {
            toastText = it
            viewModel.toastConsumed()
        }
    }
    LaunchedEffect(toastText) {
        if (toastText != null) {
            delay(2200)
            toastText = null
        }
    }

    Box(modifier = Modifier.fillMaxSize().background(PantopusColors.appBg)) {
        Column(modifier = Modifier.fillMaxSize()) {
            EtTopBar(title = "Connected calendars", onBack = onBack)
            Box(modifier = Modifier.weight(1f).fillMaxWidth()) {
                when (val s = state) {
                    ConnectedCalendarsUiState.Loading -> LoadingSkeleton()
                    is ConnectedCalendarsUiState.Error -> ErrorState(message = s.message, onRetry = viewModel::load)
                    is ConnectedCalendarsUiState.Loaded ->
                        if (s.calendars.isEmpty()) {
                            ComingSoonState()
                        } else {
                            ConnectedList(calendars = s.calendars, onConnect = viewModel::connect)
                        }
                }
            }
        }
        toastText?.let { msg ->
            Row(
                modifier =
                    Modifier
                        .align(Alignment.TopCenter)
                        .padding(top = Spacing.s12)
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(PantopusColors.appText)
                        .padding(horizontal = Spacing.s4, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.CalendarSync,
                    contentDescription = null,
                    size = 15.dp,
                    tint = PantopusColors.primary300,
                )
                Text(text = msg, color = PantopusColors.appTextInverse, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
            }
        }
    }
}

// ─── Pillar overline (Personal sky) — design Sheet header ────────────────────

@Composable
private fun PillarOverline() {
    Text(
        text = "PERSONAL · SCHEDULING",
        fontSize = 9.5.sp,
        fontWeight = FontWeight.Bold,
        letterSpacing = 0.08.em,
        color = SchedulingPillar.Personal.accent,
        modifier = Modifier.padding(start = Spacing.s1, bottom = Spacing.s1),
    )
}

@Composable
private fun Helper(text: String) {
    Text(
        text = text,
        fontSize = 11.5.sp,
        color = PantopusColors.appTextSecondary,
        modifier = Modifier.padding(horizontal = 2.dp, vertical = 2.dp),
    )
}

// ─── Empty (no calendars) — the calm coming-soon placeholder ─────────────────

/**
 * Design `connected-calendars-frames.jsx` FramePlaceholder: when sync isn't
 * available yet the sheet carries the calm coming-soon card **alone**. The
 * helper line and the per-provider connect rows belong to FrameNone (rendered
 * by [ConnectedList] once the backend returns unconnected providers) — the two
 * are distinct states and must not be stacked.
 */
@Composable
private fun ComingSoonState() {
    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        PillarOverline()
        ComingSoon()
    }
}

@Composable
internal fun ComingSoon() {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .padding(vertical = Spacing.s6, horizontal = Spacing.s5),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            modifier = Modifier.size(54.dp).clip(RoundedCornerShape(Radii.xl)).background(PantopusColors.primary50),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.CalendarSync,
                contentDescription = null,
                size = 26.dp,
                tint = PantopusColors.primary600,
            )
        }
        Spacer(Modifier.height(Spacing.s3))
        Text(
            "Calendar sync is coming soon",
            fontSize = 15.5.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(Spacing.s2))
        Text(
            "We'll let you know when you can connect Google, Apple, and Outlook to check for conflicts.",
            fontSize = 12.5.sp,
            color = PantopusColors.appTextSecondary,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(horizontal = Spacing.s2),
        )
        Spacer(Modifier.height(Spacing.s5))
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s4)) {
            listOf("google", "apple", "outlook").forEach { provider ->
                ProviderTile(provider = provider, muted = true)
            }
        }
    }
}

// ─── Loaded list — one row per calendar, variant keyed off `status` ──────────

@Composable
private fun ConnectedList(
    calendars: List<ConnectedCalendarDto>,
    onConnect: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        PillarOverline()
        Helper("Connect a calendar to check for conflicts and add bookings automatically.")
        calendars.forEach { calendar ->
            val provider = calendar.provider ?: "google"
            when (rowKindOf(calendar.status)) {
                CalendarRowKind.CONNECTED -> ConnectedRow(calendar = calendar, provider = provider, onDisconnect = onConnect)
                CalendarRowKind.REAUTH -> ReAuthRow(calendar = calendar, provider = provider, onReconnect = onConnect)
                CalendarRowKind.DENIED -> DeniedRow(provider = provider, onOpenSettings = onConnect)
                CalendarRowKind.CONNECTING -> ConnectingRow(provider = provider)
                CalendarRowKind.CONNECT -> ConnectRow(provider = provider, onConnect = onConnect)
            }
        }
    }
}

// ─── Row card frame ──────────────────────────────────────────────────────────

@Composable
private fun RowCard(content: @Composable () -> Unit) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .padding(horizontal = 13.dp, vertical = Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(10.dp),
        content = { content() },
    )
}

// ─── Connect row (not connected) ─────────────────────────────────────────────

@Composable
private fun ConnectRow(
    provider: String,
    onConnect: () -> Unit,
) {
    RowCard {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(11.dp)) {
            ProviderTile(provider = provider, muted = false)
            Column(modifier = Modifier.weight(1f)) {
                ProviderName(provider)
                Text("Not connected", fontSize = 11.sp, color = PantopusColors.appTextSecondary, modifier = Modifier.padding(top = 1.dp))
            }
            ConnectButton(onClick = onConnect)
        }
    }
}

@Composable
private fun ConnectButton(onClick: () -> Unit) {
    Box(
        modifier =
            Modifier
                .height(32.dp)
                .clip(RoundedCornerShape(9.dp))
                .background(PantopusColors.primary600)
                .clickable(onClick = onClick)
                .padding(horizontal = 13.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text("Connect", fontSize = 12.5.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appTextInverse)
    }
}

// ─── Connecting row (OAuth in flight) ────────────────────────────────────────

@Composable
private fun ConnectingRow(provider: String) {
    RowCard {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(11.dp)) {
            ProviderTile(provider = provider, muted = false)
            Column(modifier = Modifier.weight(1f)) {
                ProviderName(provider)
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    modifier = Modifier.padding(top = 4.dp),
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.ExternalLink,
                        contentDescription = null,
                        size = 11.dp,
                        tint = PantopusColors.appTextSecondary,
                    )
                    Text("Opening ${providerName(provider)}…", fontSize = 11.sp, color = PantopusColors.appTextSecondary)
                }
            }
            Shimmer(width = 76.dp, height = 12.dp, cornerRadius = 6.dp)
        }
    }
}

// ─── Connected / synced row ──────────────────────────────────────────────────

@Composable
private fun ConnectedRow(
    calendar: ConnectedCalendarDto,
    provider: String,
    onDisconnect: () -> Unit,
) {
    RowCard {
        AccountHeader(provider = provider, account = calendar.externalAccount, kind = CalendarPillKind.SYNCED)
        HorizontalDivider(thickness = 1.dp, color = PantopusColors.appBorder)
        // v1 contract is read-only — render these as display-only (mirrors iOS
        // `.disabled(true)`) so they don't read as live, no-op switches.
        EtToggleRow(
            icon = PantopusIcon.Search,
            label = "Check for conflicts",
            sub = "Block times when you're busy elsewhere",
            checked = calendar.checkConflicts != false,
            onToggle = {},
            enabled = false,
        )
        EtToggleRow(
            icon = PantopusIcon.CalendarPlus,
            label = "Add bookings to this calendar",
            sub = "New bookings show up here",
            checked = calendar.writeTarget != false,
            onToggle = {},
            enabled = false,
            last = true,
        )
        Row(
            modifier = Modifier.fillMaxWidth().padding(top = 2.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                PantopusIconImage(
                    icon = PantopusIcon.RefreshCw,
                    contentDescription = null,
                    size = 11.dp,
                    tint = PantopusColors.appTextSecondary,
                )
                Text(syncedAgo(calendar.lastSyncedAt), fontSize = 10.5.sp, color = PantopusColors.appTextSecondary)
            }
            Box(modifier = Modifier.clip(RoundedCornerShape(Radii.sm)).clickable(onClick = onDisconnect).padding(horizontal = 2.dp)) {
                Text("Disconnect", fontSize = 11.5.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appTextSecondary)
            }
        }
    }
}

/**
 * Relative sync label from the row's real `last_synced_at` — "Synced just now",
 * "Synced 12 min ago", "Synced 3 hr ago", or "Synced Jun 4" once it's a day+
 * old. Unparseable/absent timestamps render a bare "Synced".
 */
private fun syncedAgo(iso: String?): String {
    val instant =
        iso?.let {
            runCatching { java.time.Instant.parse(it) }.getOrNull()
                ?: runCatching { java.time.OffsetDateTime.parse(it).toInstant() }.getOrNull()
        } ?: return "Synced"
    val minutes = java.time.Duration.between(instant, java.time.Instant.now()).toMinutes()
    return when {
        minutes < 1 -> "Synced just now"
        minutes < 60 -> "Synced $minutes min ago"
        minutes < 24 * 60 -> "Synced ${minutes / 60} hr ago"
        else ->
            "Synced " +
                java.time.format.DateTimeFormatter.ofPattern("MMM d", java.util.Locale.US)
                    .withZone(java.time.ZoneId.systemDefault())
                    .format(instant)
    }
}

// ─── Re-auth needed row (warning banner) ─────────────────────────────────────

@Composable
private fun ReAuthRow(
    calendar: ConnectedCalendarDto,
    provider: String,
    onReconnect: () -> Unit,
) {
    RowCard {
        AccountHeader(provider = provider, account = calendar.externalAccount, kind = CalendarPillKind.ATTENTION)
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.warningBg)
                    .border(1.dp, PantopusColors.warningLight, RoundedCornerShape(Radii.lg))
                    .padding(horizontal = Spacing.s3, vertical = 11.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Row(verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                PantopusIconImage(
                    icon = PantopusIcon.TriangleAlert,
                    contentDescription = null,
                    size = ICON_16,
                    tint = PantopusColors.warning,
                )
                Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(
                        "Reconnect ${providerName(provider)} to keep checking for conflicts",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = PantopusColors.warning,
                    )
                    Text(
                        "Until you reconnect, we can't see new events and might double-book you.",
                        fontSize = 11.sp,
                        color = PantopusColors.warning,
                    )
                }
            }
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .height(38.dp)
                        .clip(RoundedCornerShape(9.dp))
                        .background(PantopusColors.primary600)
                        .clickable(onClick = onReconnect),
                contentAlignment = Alignment.Center,
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    PantopusIconImage(
                        icon = PantopusIcon.RefreshCw,
                        contentDescription = null,
                        size = 14.dp,
                        tint = PantopusColors.appTextInverse,
                    )
                    Text("Reconnect", fontSize = 12.5.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appTextInverse)
                }
            }
        }
    }
}

// ─── Permission-denied row (lock banner) ─────────────────────────────────────

@Composable
private fun DeniedRow(
    provider: String,
    onOpenSettings: () -> Unit,
) {
    RowCard {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(11.dp)) {
            ProviderTile(provider = provider, muted = false)
            Column(modifier = Modifier.weight(1f)) {
                ProviderName(provider)
                Text("Not connected", fontSize = 11.sp, color = PantopusColors.appTextSecondary, modifier = Modifier.padding(top = 1.dp))
            }
        }
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.appSurfaceRaised)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                    .padding(horizontal = 11.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            verticalAlignment = Alignment.Top,
        ) {
            PantopusIconImage(icon = PantopusIcon.Lock, contentDescription = null, size = 14.dp, tint = PantopusColors.appTextMuted)
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(
                    "Calendar access was declined. Allow it in Settings to connect.",
                    fontSize = 11.5.sp,
                    color = PantopusColors.appTextStrong,
                )
                Row(
                    modifier = Modifier.clip(RoundedCornerShape(Radii.sm)).clickable(onClick = onOpenSettings),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(5.dp),
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.Settings,
                        contentDescription = null,
                        size = 13.dp,
                        tint = PantopusColors.primary600,
                    )
                    Text("Open Settings", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = PantopusColors.primary600)
                }
            }
        }
    }
}

// ─── Account header (tile · name/account · status pill) ──────────────────────

private enum class CalendarPillKind { SYNCED, ATTENTION }

@Composable
private fun AccountHeader(
    provider: String,
    account: String?,
    kind: CalendarPillKind,
) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(11.dp)) {
        ProviderTile(provider = provider, muted = false)
        Column(modifier = Modifier.weight(1f)) {
            ProviderName(provider)
            Text(
                text = account ?: "Connected",
                fontSize = 11.sp,
                color = PantopusColors.appTextSecondary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(top = 1.dp),
            )
        }
        CalendarStatusPill(kind)
    }
}

@Composable
private fun ProviderName(provider: String) {
    Text(
        text = providerName(provider),
        fontSize = 13.sp,
        fontWeight = FontWeight.SemiBold,
        color = PantopusColors.appText,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
    )
}

// Calendar-sync semantic chip (Synced / Action needed). The shared
// SchedulingStatusPill grammar covers booking/page/link statuses only, so the
// calendar-sync chip is local but follows the same tinted-fill + icon idiom.
@Composable
private fun CalendarStatusPill(kind: CalendarPillKind) {
    val bg = if (kind == CalendarPillKind.SYNCED) PantopusColors.successLight else PantopusColors.warningBg
    val fg = if (kind == CalendarPillKind.SYNCED) PantopusColors.success else PantopusColors.warning
    val icon = if (kind == CalendarPillKind.SYNCED) PantopusIcon.Check else PantopusIcon.TriangleAlert
    val label = if (kind == CalendarPillKind.SYNCED) "Synced" else "Action needed"
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(bg)
                .padding(horizontal = Spacing.s2, vertical = 3.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 10.dp, tint = fg)
        Text(text = label, fontSize = 9.5.sp, fontWeight = FontWeight.Bold, color = fg, maxLines = 1)
    }
}

// ─── Provider tile (per-brand glyph color) ───────────────────────────────────

@Composable
private fun ProviderTile(
    provider: String,
    muted: Boolean,
) {
    Box(
        modifier =
            Modifier
                .size(38.dp)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg)),
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(
            icon = PROVIDER_ICONS[provider] ?: PantopusIcon.Calendar,
            contentDescription = provider,
            size = 19.dp,
            tint = if (muted) PantopusColors.appTextMuted else brandColor(provider),
        )
    }
}

// ─── Loading skeleton — three row-shaped placeholders ────────────────────────

@Composable
private fun LoadingSkeleton() {
    Column(
        modifier = Modifier.fillMaxSize().padding(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Shimmer(width = 130.dp, height = 10.dp, cornerRadius = 5.dp)
        repeat(3) {
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(Radii.xl))
                        .background(PantopusColors.appSurface)
                        .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                        .padding(horizontal = 13.dp, vertical = Spacing.s3),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(11.dp),
            ) {
                Shimmer(width = 38.dp, height = 38.dp, cornerRadius = Radii.lg)
                Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                    Shimmer(width = 120.dp, height = 12.dp, cornerRadius = 6.dp)
                    Shimmer(width = 80.dp, height = 10.dp, cornerRadius = 5.dp)
                }
                Shimmer(width = 70.dp, height = 30.dp, cornerRadius = 9.dp)
            }
        }
    }
}
