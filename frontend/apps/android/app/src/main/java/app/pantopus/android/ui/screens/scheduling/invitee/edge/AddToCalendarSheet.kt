@file:Suppress("PackageNaming", "MagicNumber", "LongParameterList", "LongMethod")
@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package app.pantopus.android.ui.screens.scheduling.invitee.edge

import android.content.Intent
import android.net.Uri
import android.provider.CalendarContract
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.SheetState
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.FileProvider
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import java.io.File
import java.time.ZoneId
import java.time.format.DateTimeFormatter

const val ADD_TO_CALENDAR_TAG = "schedulingAddToCalendar"

/** A single on-device calendar the user can pick from (Frame 5 multi-calendar). */
data class OnDeviceCalendar(
    val id: Long,
    val name: String,
    val accountEmail: String?,
    /** Dot-swatch color for the calendar row. */
    val dotColor: Color,
)

/** The booking an [AddToCalendarSheet] writes to the calendar. */
data class AddToCalendarEvent(
    val title: String,
    val startUtc: String?,
    val endUtc: String?,
    val location: String? = null,
    val description: String? = null,
    val manageToken: String? = null,
    val timezone: String? = null,
)

/**
 * D8 — Add to calendar. A local action sheet surfaced from booking-confirmed /
 * manage. The native "Add to calendar" path opens the device calendar's event
 * editor (CalendarContract `ACTION_INSERT`) with the join link + a reminder;
 * Google / Outlook open the provider's web template; "Download .ics" pulls the
 * RFC-5545 invite and shares it through the FileProvider. Per the design this
 * sheet is context-neutral: the recap chip and the primary CTA are fixed sky
 * (blue50/blue700, blue600), never tinted by the opening surface's pillar.
 */
@Composable
fun AddToCalendarSheet(
    event: AddToCalendarEvent,
    onDismiss: () -> Unit,
    sheetState: SheetState,
    modifier: Modifier = Modifier,
    @Suppress("UNUSED_PARAMETER") pillar: SchedulingPillar = SchedulingPillar.Personal,
    /** On-device calendars discovered by the host; empty = fire INSERT directly. */
    deviceCalendars: List<OnDeviceCalendar> = emptyList(),
    viewModel: AddToCalendarViewModel = hiltViewModel(),
) {
    val context = LocalContext.current
    val icsState by viewModel.ics.collectAsStateWithLifecycle()
    var added by remember { mutableStateOf(false) }
    // Frame 5: show picker only when device has 2+ calendars.
    var showCalendarPicker by remember { mutableStateOf(false) }

    // When the .ics text arrives, write it to cache and open via FileProvider.
    LaunchedEffect(icsState) {
        val ready = icsState as? AddToCalendarViewModel.IcsState.Ready ?: return@LaunchedEffect
        runCatching {
            val file = File(context.cacheDir, "invite.ics").apply { writeText(ready.content) }
            val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
            val view =
                Intent(Intent.ACTION_VIEW).apply {
                    setDataAndType(uri, "text/calendar")
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
                }
            context.startActivity(Intent.createChooser(view, "Add to calendar"))
        }
        viewModel.consume()
    }

    // Frame 5: multi-calendar picker level (second-level sheet).
    if (showCalendarPicker) {
        CalendarPickerLevel(
            calendars = deviceCalendars,
            sheetState = sheetState,
            onDismiss = { showCalendarPicker = false },
            onPick = { cal ->
                showCalendarPicker = false
                added =
                    runCatching {
                        context.startActivity(buildInsertIntent(event, calendarId = cal.id))
                    }.isSuccess
            },
        )
        return
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = PantopusColors.appSurface,
        modifier = modifier.testTag(ADD_TO_CALENDAR_TAG),
    ) {
        Column(modifier = Modifier.fillMaxWidth().padding(bottom = Spacing.s6)) {
            Text(
                text = "Add to your calendar",
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
                modifier = Modifier.padding(horizontal = Spacing.s4),
            )
            RecapChip(event = event)

            Box(modifier = Modifier.padding(horizontal = Spacing.s4, vertical = Spacing.s3)) {
                NativeAddButton(
                    added = added,
                    onClick = {
                        if (deviceCalendars.size > 1) {
                            // Multiple calendars — show the picker level (Frame 5).
                            showCalendarPicker = true
                        } else {
                            added = runCatching { context.startActivity(buildInsertIntent(event)) }.isSuccess
                        }
                    },
                )
            }

            Text(
                text = "MORE OPTIONS",
                style = PantopusTextStyle.overline,
                color = PantopusColors.appTextSecondary,
                modifier = Modifier.padding(horizontal = Spacing.s4, vertical = Spacing.s1),
            )
            Column(
                modifier =
                    Modifier
                        .padding(horizontal = Spacing.s4)
                        .clip(RoundedCornerShape(CARD_RADIUS))
                        .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(CARD_RADIUS)),
            ) {
                ProviderRow(
                    icon = PantopusIcon.CalendarPlus,
                    label = "Google Calendar",
                    sub = "Opens in your browser",
                    onClick = { runCatching { context.startActivity(webIntent(googleUrl(event))) } },
                )
                RowDivider()
                ProviderRow(
                    icon = PantopusIcon.CalendarPlus,
                    label = "Outlook",
                    sub = "Opens in your browser",
                    onClick = { runCatching { context.startActivity(webIntent(outlookUrl(event))) } },
                )
                RowDivider()
                ProviderRow(
                    icon = PantopusIcon.Download,
                    label = "Download .ics file",
                    sub = "Works with any calendar app",
                    loading = icsState is AddToCalendarViewModel.IcsState.Loading,
                    enabled = event.manageToken != null,
                    onClick = { event.manageToken?.let(viewModel::downloadIcs) },
                )
            }

            Row(
                modifier = Modifier.padding(horizontal = Spacing.s4, vertical = Spacing.s3),
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Bell,
                    contentDescription = null,
                    size = 13.dp,
                    tint = PantopusColors.appTextMuted,
                    modifier = Modifier.padding(top = 2.dp),
                )
                Text(
                    text = "We'll add the event with the join link and a reminder.",
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.appTextSecondary,
                )
            }
            (icsState as? AddToCalendarViewModel.IcsState.Error)?.let {
                Text(
                    text = it.message,
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.error,
                    modifier = Modifier.padding(horizontal = Spacing.s4),
                )
            }

            // FrameAdded: a centered success status line that auto-dismisses the sheet.
            if (added) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4, vertical = Spacing.s3),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.CheckCircle,
                        contentDescription = null,
                        size = 13.dp,
                        tint = PantopusColors.success,
                        modifier = Modifier.padding(end = Spacing.s1),
                    )
                    Text(
                        text = "Added — closing in a moment",
                        style = PantopusTextStyle.caption,
                        fontWeight = FontWeight.SemiBold,
                        color = PantopusColors.appTextSecondary,
                    )
                }
            }

            // Spec DoneBar: a top-bordered, full-width bordered ghost "Done" button.
            DoneBar(onClick = onDismiss)
        }
    }

    // Auto-dismiss shortly after a successful native write (FrameAdded morph).
    LaunchedEffect(added) {
        if (added) {
            kotlinx.coroutines.delay(ADDED_DISMISS_MS)
            onDismiss()
        }
    }
}

private const val ADDED_DISMISS_MS = 1400L
private val CARD_RADIUS = 14.dp
private val DISC_RADIUS = 10.dp
private val DOT_SIZE = 10.dp

/**
 * Frame 5 — Multi-calendar picker level (second-level sheet).
 * Shown when [deviceCalendars] has 2+ entries. Design: "Choose a calendar"
 * header (back chevron), subtitle, RowCard of on-device calendar rows with
 * colored dot swatches, and a filled "Add to Personal" (first-selected) CTA.
 */
@Composable
private fun CalendarPickerLevel(
    calendars: List<OnDeviceCalendar>,
    sheetState: SheetState,
    onDismiss: () -> Unit,
    onPick: (OnDeviceCalendar) -> Unit,
) {
    var selected by remember { mutableStateOf(calendars.firstOrNull()) }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = PantopusColors.appSurface,
    ) {
        Column(modifier = Modifier.fillMaxWidth().padding(bottom = Spacing.s6)) {
            // Header row: back chevron + centered title.
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s2, vertical = Spacing.s3),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(
                    modifier =
                        Modifier
                            .size(34.dp)
                            .clip(RoundedCornerShape(Radii.md))
                            .clickable(onClickLabel = "Back", onClick = onDismiss),
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.ChevronLeft,
                        contentDescription = "Back",
                        size = 20.dp,
                        tint = PantopusColors.appText,
                    )
                }
                Text(
                    text = "Choose a calendar",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appText,
                    modifier = Modifier.weight(1f),
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                )
                Box(modifier = Modifier.size(34.dp))
            }
            Text(
                text = "Where should we add it?",
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
                modifier = Modifier.padding(horizontal = Spacing.s4, vertical = Spacing.s1),
            )
            Column(
                modifier =
                    Modifier
                        .padding(horizontal = Spacing.s4, vertical = Spacing.s2)
                        .clip(RoundedCornerShape(CARD_RADIUS))
                        .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(CARD_RADIUS)),
            ) {
                calendars.forEachIndexed { index, cal ->
                    if (index > 0) {
                        Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorder))
                    }
                    CalendarPickerRow(
                        calendar = cal,
                        selected = cal == selected,
                        onClick = { selected = cal },
                    )
                }
            }
            Box(modifier = Modifier.padding(horizontal = Spacing.s4, vertical = Spacing.s3)) {
                Row(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .height(46.dp)
                            .clip(RoundedCornerShape(Radii.lg))
                            .background(PantopusColors.primary600)
                            .clickable(enabled = selected != null, onClick = { selected?.let(onPick) }),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.CalendarPlus,
                        contentDescription = null,
                        size = 16.dp,
                        tint = PantopusColors.appTextInverse,
                        modifier = Modifier.padding(end = Spacing.s2),
                    )
                    Text(
                        text = "Add to ${selected?.name ?: "calendar"}",
                        style = PantopusTextStyle.small,
                        fontWeight = FontWeight.Bold,
                        color = PantopusColors.appTextInverse,
                    )
                }
            }
        }
    }
}

@Composable
private fun CalendarPickerRow(
    calendar: OnDeviceCalendar,
    selected: Boolean,
    onClick: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(56.dp)
                .background(PantopusColors.appSurface)
                .clickable(onClick = onClick)
                .padding(horizontal = Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(DOT_SIZE)
                    .clip(CircleShape)
                    .background(calendar.dotColor),
        )
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = calendar.name,
                style = PantopusTextStyle.small,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
            calendar.accountEmail?.let {
                Text(text = it, style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
            }
        }
        if (selected) {
            PantopusIconImage(
                icon = PantopusIcon.CheckCircle,
                contentDescription = null,
                size = 16.dp,
                tint = PantopusColors.primary600,
            )
        }
    }
}

@Composable
private fun DoneBar(onClick: () -> Unit) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(top = Spacing.s2),
    ) {
        Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorder))
        Box(modifier = Modifier.padding(horizontal = Spacing.s4, vertical = Spacing.s3)) {
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .height(44.dp)
                        .clip(RoundedCornerShape(Radii.lg))
                        .background(PantopusColors.appSurface)
                        .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                        .clickable(onClick = onClick),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(text = "Done", style = PantopusTextStyle.small, fontWeight = FontWeight.Bold, color = PantopusColors.appText)
            }
        }
    }
}

@Composable
private fun RecapChip(event: AddToCalendarEvent) {
    val zone = zoneOf(event.timezone)
    // Spec recap is fixed sky (blue700-on-blue50 / blue100 border), context-neutral.
    Row(
        modifier =
            Modifier
                .padding(horizontal = Spacing.s4, vertical = Spacing.s2)
                .fillMaxWidth()
                .clip(RoundedCornerShape(DISC_RADIUS))
                .background(PantopusColors.primary50)
                .border(1.dp, PantopusColors.primary100, RoundedCornerShape(DISC_RADIUS))
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(icon = PantopusIcon.Calendar, contentDescription = null, size = 14.dp, tint = PantopusColors.primary700)
        Text(
            text = "${event.title} · ${formatWhenRange(event.startUtc, event.endUtc, zone)}",
            style = PantopusTextStyle.caption,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.primary700,
        )
    }
}

@Composable
private fun NativeAddButton(
    added: Boolean,
    onClick: () -> Unit,
) {
    // Spec primary CTA is the fixed sky ACCENT (blue600), context-neutral.
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(48.dp)
                .clip(RoundedCornerShape(Radii.lg))
                .background(if (added) PantopusColors.successBg else PantopusColors.primary600)
                .clickable(onClick = onClick),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PantopusIconImage(
            icon = if (added) PantopusIcon.CheckCircle else PantopusIcon.CalendarPlus,
            contentDescription = null,
            size = 17.dp,
            tint = if (added) PantopusColors.success else PantopusColors.appTextInverse,
            modifier = Modifier.padding(end = Spacing.s2),
        )
        Text(
            text = if (added) "Added to calendar" else "Add to calendar",
            style = PantopusTextStyle.body,
            color = if (added) PantopusColors.success else PantopusColors.appTextInverse,
        )
    }
}

@Composable
private fun ProviderRow(
    icon: PantopusIcon,
    label: String,
    sub: String,
    onClick: () -> Unit,
    loading: Boolean = false,
    enabled: Boolean = true,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(56.dp)
                .background(PantopusColors.appSurface)
                .clickable(enabled = enabled && !loading, onClick = onClick)
                .padding(horizontal = Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier = Modifier.size(36.dp).clip(RoundedCornerShape(DISC_RADIUS)).background(PantopusColors.appSurfaceSunken),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon = icon, contentDescription = null, size = 18.dp, tint = PantopusColors.appTextSecondary)
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = label,
                style = PantopusTextStyle.small,
                fontWeight = FontWeight.SemiBold,
                color = if (enabled) PantopusColors.appText else PantopusColors.appTextMuted,
            )
            if (loading) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    Shimmer(width = 80.dp, height = 8.dp, cornerRadius = Radii.xs)
                    Text(text = "Preparing your file", style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
                }
            } else {
                Text(text = sub, style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
            }
        }
        if (!loading) {
            PantopusIconImage(icon = PantopusIcon.ChevronRight, contentDescription = null, size = 16.dp, tint = PantopusColors.appTextMuted)
        }
    }
}

@Composable
private fun RowDivider() {
    Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorder))
}

// ─── Intent builders ────────────────────────────────────────────────────────

private fun buildInsertIntent(
    event: AddToCalendarEvent,
    calendarId: Long? = null,
): Intent {
    val start = parseInstant(event.startUtc)?.toEpochMilli()
    val end = parseInstant(event.endUtc)?.toEpochMilli()
    return Intent(Intent.ACTION_INSERT).apply {
        data = CalendarContract.Events.CONTENT_URI
        putExtra(CalendarContract.Events.TITLE, event.title)
        event.location?.let { putExtra(CalendarContract.Events.EVENT_LOCATION, it) }
        event.description?.let { putExtra(CalendarContract.Events.DESCRIPTION, it) }
        start?.let { putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, it) }
        end?.let { putExtra(CalendarContract.EXTRA_EVENT_END_TIME, it) }
        calendarId?.let { putExtra(CalendarContract.Events.CALENDAR_ID, it) }
    }
}

private fun webIntent(url: String): Intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))

private val ICS_UTC: DateTimeFormatter = DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'").withZone(ZoneId.of("UTC"))

private fun icsStamp(utc: String?): String? = parseInstant(utc)?.let { ICS_UTC.format(it) }

private fun googleUrl(event: AddToCalendarEvent): String {
    val dates = "${icsStamp(event.startUtc).orEmpty()}/${icsStamp(event.endUtc).orEmpty()}"
    return Uri.parse("https://calendar.google.com/calendar/render").buildUpon()
        .appendQueryParameter("action", "TEMPLATE")
        .appendQueryParameter("text", event.title)
        .appendQueryParameter("dates", dates)
        .apply {
            event.description?.let { appendQueryParameter("details", it) }
            event.location?.let { appendQueryParameter("location", it) }
        }
        .build()
        .toString()
}

private fun outlookUrl(event: AddToCalendarEvent): String =
    Uri.parse("https://outlook.live.com/calendar/0/deeplink/compose").buildUpon()
        .appendQueryParameter("path", "/calendar/action/compose")
        .appendQueryParameter("rru", "addevent")
        .appendQueryParameter("subject", event.title)
        .apply {
            parseInstant(event.startUtc)?.let { appendQueryParameter("startdt", it.toString()) }
            parseInstant(event.endUtc)?.let { appendQueryParameter("enddt", it.toString()) }
            event.description?.let { appendQueryParameter("body", it) }
            event.location?.let { appendQueryParameter("location", it) }
        }
        .build()
        .toString()
