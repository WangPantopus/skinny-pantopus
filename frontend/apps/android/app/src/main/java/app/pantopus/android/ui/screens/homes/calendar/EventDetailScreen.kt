@file:Suppress(
    "PackageNaming",
    "MagicNumber",
    "LongMethod",
    "LongParameterList",
    "TooManyFunctions",
)

package app.pantopus.android.ui.screens.homes.calendar

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.api.models.homes.CalendarEventDto
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.OfflineBannerHost
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.shared.content_detail.ContentDetailShell
import app.pantopus.android.ui.screens.shared.content_detail.ContentDetailTopBarAction
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale

const val EVENT_DETAIL_SCREEN_TAG = "eventDetail"

/**
 * Home-calendar surfaces render date/times in the device's local zone on
 * both platforms (mirrors iOS `Calendar.current`); only the all-day
 * heuristic stays pinned to UTC (the wire stores all-day at 00:00Z).
 */
private val DISPLAY_ZONE: ZoneId = ZoneId.systemDefault()

private val UTC_ZONE: ZoneId = ZoneId.of("UTC")

/**
 * F2 — Event Detail + RSVP. Mirrors iOS `EventDetailView`. Renders the
 * detail grid, attendee RSVP list, the member's own RSVP control (when
 * the event requests RSVPs), notes, and Edit / Delete. Edit pushes back
 * to the form; delete fires the host's `onDeleted`.
 */
@Composable
fun EventDetailScreen(
    onBack: () -> Unit,
    onEdit: (CalendarEventDto) -> Unit,
    viewModel: EventDetailViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val online by viewModel.isOnline.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) {
        viewModel.configure(onDeleted = onBack)
        viewModel.load()
    }

    Box(modifier = Modifier.fillMaxSize().testTag(EVENT_DETAIL_SCREEN_TAG)) {
        // Offline strip in the chrome stack — mirrors iOS
        // `.offlineBanner(isOffline:)` on the F2 shell.
        OfflineBannerHost(isOffline = !online) {
            when (val current = state) {
                is EventDetailUiState.Loading -> LoadingShell(onBack = onBack)
                is EventDetailUiState.Error ->
                    ErrorShell(onBack = onBack, onRetry = { viewModel.load() })
                is EventDetailUiState.Loaded ->
                    LoadedShell(
                        snapshot = current,
                        rsvpEnabled = online,
                        onBack = onBack,
                        onEdit = { onEdit(current.event) },
                        onDelete = { viewModel.delete() },
                        onRsvp = viewModel::setRsvp,
                    )
            }
        }
    }
}

@Composable
private fun LoadingShell(onBack: () -> Unit) {
    // JSX `FrameLoading` (event-detail-frames.jsx:121-131): a title + subtitle
    // shimmer, then a detail-grid card of icon-tile rows and an attendees card
    // of avatar rows — mirrors the loaded geometry. Matches iOS LoadingShell.
    ContentDetailShell(
        title = "Event",
        onBack = onBack,
        header = {
            Column(
                verticalArrangement = Arrangement.spacedBy(Spacing.s2),
                modifier = Modifier.padding(horizontal = Spacing.s4),
            ) {
                Shimmer(width = 180.dp, height = 22.dp, cornerRadius = Radii.sm)
                Shimmer(width = 130.dp, height = 12.dp, cornerRadius = Radii.sm)
            }
        },
        body = {
            Column(
                verticalArrangement = Arrangement.spacedBy(Spacing.s3),
                modifier = Modifier.padding(horizontal = Spacing.s4),
            ) {
                SkeletonCard(rows = 4) { SkeletonIconRow() }
                SkeletonCard(rows = 3) { SkeletonAvatarRow() }
            }
        },
    )
}

@Composable
private fun SkeletonCard(
    rows: Int,
    row: @Composable () -> Unit,
) {
    Column(
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorderSubtle, RoundedCornerShape(Radii.xl))
                .padding(Spacing.s3),
    ) {
        repeat(rows) { row() }
    }
}

@Composable
private fun SkeletonIconRow() {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Shimmer(width = 30.dp, height = 30.dp, cornerRadius = Radii.md)
        Column(verticalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.weight(1f)) {
            Shimmer(width = 60.dp, height = 8.dp, cornerRadius = Radii.sm)
            Shimmer(width = 110.dp, height = 11.dp, cornerRadius = Radii.sm)
        }
    }
}

@Composable
private fun SkeletonAvatarRow() {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Shimmer(width = 30.dp, height = 30.dp, cornerRadius = Radii.pill)
        Shimmer(width = 90.dp, height = 11.dp, cornerRadius = Radii.sm)
        Box(modifier = Modifier.weight(1f))
        Shimmer(width = 54.dp, height = 18.dp, cornerRadius = Radii.lg)
    }
}

@Composable
private fun ErrorShell(
    onBack: () -> Unit,
    onRetry: () -> Unit,
) {
    ContentDetailShell(
        title = "Event",
        onBack = onBack,
        header = {},
        body = {
            // Design FrameError renders a FIXED subcopy line (never the raw
            // server message) — matches iOS ErrorShell.
            EmptyState(
                icon = PantopusIcon.CloudOff,
                headline = "Couldn't load this event",
                subcopy = "It may have been deleted, or your connection dropped.",
                ctaTitle = "Retry",
                onCta = onRetry,
                tint = PantopusColors.errorBg,
                accent = PantopusColors.error,
                modifier = Modifier.height(400.dp),
            )
        },
    )
}

@Composable
private fun LoadedShell(
    snapshot: EventDetailUiState.Loaded,
    rsvpEnabled: Boolean,
    onBack: () -> Unit,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
    onRsvp: (HomeRsvpChoice) -> Unit,
) {
    val event = snapshot.event
    val category = remember(event.eventType) { CalendarEventCategory.from(event.eventType) }
    var showsDeleteConfirm by remember { mutableStateOf(false) }

    ContentDetailShell(
        title = "Event",
        onBack = onBack,
        topBarAction =
            ContentDetailTopBarAction(
                icon = PantopusIcon.Pencil,
                contentDescription = "Edit event",
                onClick = onEdit,
            ),
        header = {
            EventHeader(event = event, category = category, modifier = Modifier.padding(horizontal = Spacing.s4))
        },
        body = {
            Column(
                verticalArrangement = Arrangement.spacedBy(Spacing.s3),
                modifier = Modifier.padding(horizontal = Spacing.s4),
            ) {
                DetailGrid(event = event, category = category)
                val assigned = event.assignedTo.orEmpty()
                if (assigned.isNotEmpty()) {
                    AttendeesSection(snapshot = snapshot, ids = assigned)
                }
                if (event.requestRsvp == true) {
                    YourRsvpCard(snapshot = snapshot, enabled = rsvpEnabled, onRsvp = onRsvp)
                }
                val description = event.description.orEmpty()
                if (description.isNotEmpty()) {
                    NotesSection(text = description)
                }
                snapshot.deleteError?.let { error ->
                    Text(text = error, style = PantopusTextStyle.small, color = PantopusColors.error)
                }
            }
        },
        cta = {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
                modifier = Modifier.fillMaxWidth(),
            ) {
                // Design shows `<SecondaryBtn icon="pencil">Edit</SecondaryBtn>` —
                // outlined button with a leading Pencil glyph.
                // (event-detail-frames.jsx:113)
                Box(
                    modifier =
                        Modifier
                            .weight(1f)
                            .heightIn(min = 44.dp)
                            .alpha(if (snapshot.isDeleting) 0.5f else 1f)
                            .clip(RoundedCornerShape(Radii.lg))
                            .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                            .clickable(enabled = !snapshot.isDeleting, onClick = onEdit)
                            .testTag("eventDetail_edit"),
                    contentAlignment = Alignment.Center,
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                    ) {
                        PantopusIconImage(
                            icon = PantopusIcon.Pencil,
                            contentDescription = null,
                            size = 16.dp,
                            tint = PantopusColors.appText,
                        )
                        Text(text = "Edit", style = PantopusTextStyle.body, color = PantopusColors.appText)
                    }
                }
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
                    modifier =
                        Modifier
                            .heightIn(min = 44.dp)
                            .clip(RoundedCornerShape(Radii.md))
                            .clickable(enabled = !snapshot.isDeleting) { showsDeleteConfirm = true }
                            .padding(horizontal = Spacing.s2)
                            .testTag("eventDetail_delete"),
                ) {
                    PantopusIconImage(icon = PantopusIcon.Trash2, contentDescription = null, size = 14.dp, tint = PantopusColors.error)
                    Text(text = "Delete", style = PantopusTextStyle.small, fontWeight = FontWeight.Bold, color = PantopusColors.error)
                }
            }
        },
    )

    if (showsDeleteConfirm) {
        AlertDialog(
            onDismissRequest = { showsDeleteConfirm = false },
            title = { Text("Delete this event?") },
            text = { Text("This can't be undone. Attendees won't see it on the calendar anymore.") },
            confirmButton = {
                TextButton(onClick = {
                    showsDeleteConfirm = false
                    onDelete()
                }) { Text("Delete", color = PantopusColors.error) }
            },
            dismissButton = {
                TextButton(onClick = { showsDeleteConfirm = false }) { Text("Keep") }
            },
        )
    }
}

@Composable
private fun EventHeader(
    event: CalendarEventDto,
    category: CalendarEventCategory,
    modifier: Modifier = Modifier,
) {
    Column(
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        modifier = modifier.fillMaxWidth().padding(top = Spacing.s2),
    ) {
        Text(
            text = event.title,
            fontSize = 21.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
            maxLines = 3,
            modifier = Modifier.semantics { heading() },
        )
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            Text(
                text = formattedTimeRange(event),
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appTextStrong,
            )
            CategoryPill(category = category)
        }
    }
}

@Composable
private fun CategoryPill(category: CalendarEventCategory) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.appSurfaceSunken)
                .padding(horizontal = Spacing.s2, vertical = 3.dp),
    ) {
        Box(modifier = Modifier.size(7.dp).clip(CircleShape).background(category.dotColor))
        Text(
            text = category.label,
            fontSize = 10.5.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appTextStrong,
        )
    }
}

@Composable
private fun DetailGrid(
    event: CalendarEventDto,
    category: CalendarEventCategory,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .shadow(1.dp, RoundedCornerShape(Radii.xl), clip = false)
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorderSubtle, RoundedCornerShape(Radii.xl)),
    ) {
        val rows =
            buildList {
                recurrenceLabel(event.recurrenceRule)?.let { add(Triple(PantopusIcon.ArrowsRepeat, "Repeats", it)) }
                add(Triple(PantopusIcon.Bell, "Reminder", reminderSummary(event)))
                event.locationNotes?.takeIf { it.isNotEmpty() }?.let { add(Triple(PantopusIcon.MapPin, "Location", it)) }
                add(Triple(PantopusIcon.Tag, "Type", category.label))
            }
        rows.forEachIndexed { index, (icon, label, value) ->
            DetailRow(icon = icon, label = label, value = value)
            if (index < rows.lastIndex) {
                HorizontalDivider(color = PantopusColors.appBorderSubtle, thickness = 1.dp)
            }
        }
    }
}

@Composable
private fun DetailRow(
    icon: PantopusIcon,
    label: String,
    value: String,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s3, vertical = Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier = Modifier.size(30.dp).clip(RoundedCornerShape(Radii.md)).background(PantopusColors.appSurfaceSunken),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon = icon, contentDescription = null, size = 15.dp, tint = PantopusColors.appTextStrong)
        }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                text = label.uppercase(Locale.ROOT),
                fontSize = 9.5.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appTextMuted,
            )
            Text(text = value, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
        }
    }
}

@Composable
private fun AttendeesSection(
    snapshot: EventDetailUiState.Loaded,
    ids: List<String>,
) {
    SectionCard(overline = "Attendees") {
        ids.forEachIndexed { index, id ->
            val name = snapshot.attendeeNames[id] ?: "Member"
            AttendeeRow(
                member = HomeMember(id = id, name = name, initials = HomeMember.initialsFor(name)),
                isYou = id == snapshot.myUserId,
                rsvp = snapshot.rsvpFor(id),
            )
            if (index < ids.lastIndex) {
                HorizontalDivider(color = PantopusColors.appBorderSubtle, thickness = 1.dp)
            }
        }
    }
}

@Composable
private fun AttendeeRow(
    member: HomeMember,
    isYou: Boolean,
    rsvp: HomeRsvpChoice,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s3, vertical = Spacing.s3),
    ) {
        HomeMemberAvatar(member = member, size = 30.dp)
        Row(modifier = Modifier.weight(1f)) {
            Text(text = member.name, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
            if (isYou) {
                Text(text = " · you", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appTextMuted)
            }
        }
        HomeRsvpPill(choice = rsvp)
    }
}

@Composable
private fun YourRsvpCard(
    snapshot: EventDetailUiState.Loaded,
    enabled: Boolean,
    onRsvp: (HomeRsvpChoice) -> Unit,
) {
    val recorded = snapshot.myRsvp
    // JSX `FramePending` (event-detail-frames.jsx:200-204): the pending card gets
    // a green border + a 4px home-bg glow ring (boxShadow 0 0 0 4px H.bg50). The
    // glow is drawn as an outer home-bg ring behind the card. The design's
    // OFFLINE frame drops the emphasis entirely — plain card, muted overline,
    // dimmed control — so the pending treatment is gated on being online.
    val pending = recorded == null && enabled
    Column(
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        modifier =
            Modifier
                .fillMaxWidth()
                .then(
                    if (pending) {
                        Modifier
                            .clip(RoundedCornerShape(Radii.xl2))
                            .background(PantopusColors.homeBg)
                            .padding(4.dp)
                    } else {
                        Modifier.shadow(1.dp, RoundedCornerShape(Radii.xl), clip = false)
                    },
                ).clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(
                    width = if (pending) 1.5.dp else 1.dp,
                    color = if (pending) PantopusColors.home else PantopusColors.appBorderSubtle,
                    shape = RoundedCornerShape(Radii.xl),
                ).padding(Spacing.s3)
                .testTag("eventDetail_yourRsvp"),
    ) {
        Text(
            text = "YOUR RSVP",
            fontSize = 9.5.sp,
            fontWeight = FontWeight.Bold,
            color = if (enabled) PantopusColors.homeDark else PantopusColors.appTextMuted,
        )
        if (recorded != null) {
            RecordedRsvp(choice = recorded, enabled = enabled, onChange = { onRsvp(HomeRsvpChoice.NoReply) })
        } else {
            RsvpSegmented(selected = null, enabled = enabled && !snapshot.rsvpSaving, onSelect = onRsvp)
            if (!enabled) {
                Text(
                    text = "RSVP buttons are disabled until you reconnect.",
                    fontSize = 10.5.sp,
                    color = PantopusColors.appTextSecondary,
                )
            } else {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                    PantopusIconImage(icon = PantopusIcon.Hand, contentDescription = null, size = 12.dp, tint = PantopusColors.homeDark)
                    Text(
                        text = "Tap to let everyone know",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = PantopusColors.homeDark,
                    )
                }
            }
        }
    }
}

@Composable
private fun RecordedRsvp(
    choice: HomeRsvpChoice,
    enabled: Boolean,
    onChange: () -> Unit,
) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s3)) {
        Box(
            modifier = Modifier.size(34.dp).clip(RoundedCornerShape(Radii.pill)).background(choice.background),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon = choice.icon, contentDescription = null, size = 18.dp, tint = choice.foreground)
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(text = recordedTitle(choice), fontSize = 13.5.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appText)
            Text(text = "Everyone can see your reply", fontSize = 11.sp, color = PantopusColors.appTextSecondary)
        }
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.md))
                    .clickable(enabled = enabled, onClick = onChange)
                    .padding(horizontal = Spacing.s2, vertical = Spacing.s1)
                    .testTag("eventDetail_rsvpChange"),
        ) {
            PantopusIconImage(icon = PantopusIcon.Pencil, contentDescription = null, size = 14.dp, tint = PantopusColors.homeDark)
            Text(text = "Change", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = PantopusColors.homeDark)
        }
    }
}

@Composable
private fun RsvpSegmented(
    selected: HomeRsvpChoice?,
    enabled: Boolean,
    onSelect: (HomeRsvpChoice) -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurfaceSunken)
                .padding(3.dp)
                // Design FrameOffline dims the disabled control to 0.5.
                .alpha(if (enabled) 1f else 0.5f),
        horizontalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        HomeRsvpChoice.selectable.forEach { choice ->
            val active = choice == selected
            Box(
                modifier =
                    Modifier
                        .weight(1f)
                        .heightIn(min = 34.dp)
                        .clip(RoundedCornerShape(Radii.sm))
                        .background(if (active) PantopusColors.home else Color.Transparent)
                        .clickable(enabled = enabled) { onSelect(choice) }
                        .testTag("eventDetail_rsvp_${choice.name.lowercase(Locale.ROOT)}"),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = choice.label,
                    fontSize = 12.sp,
                    fontWeight = if (active) FontWeight.Bold else FontWeight.SemiBold,
                    color = if (active) PantopusColors.appTextInverse else PantopusColors.appTextSecondary,
                )
            }
        }
    }
}

@Composable
private fun NotesSection(text: String) {
    SectionCard(overline = "Notes") {
        // JSX `NotesCard` (event-detail-frames.jsx:84-91): body 12.5/fg2,
        // line-height 18, directly under the overline with no extra vertical
        // padding (the card already pads ~13). Match the 18sp line height.
        Text(
            text = text,
            fontSize = 12.5.sp,
            lineHeight = 18.sp,
            color = PantopusColors.appTextStrong,
            modifier = Modifier.padding(horizontal = Spacing.s3),
        )
    }
}

@Composable
private fun SectionCard(
    overline: String,
    content: @Composable () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .shadow(1.dp, RoundedCornerShape(Radii.xl), clip = false)
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorderSubtle, RoundedCornerShape(Radii.xl))
                .padding(vertical = Spacing.s2),
    ) {
        Text(
            text = overline.uppercase(Locale.ROOT),
            fontSize = 9.5.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.padding(horizontal = Spacing.s3, vertical = Spacing.s1),
        )
        content()
    }
}

private fun recordedTitle(choice: HomeRsvpChoice): String =
    when (choice) {
        HomeRsvpChoice.Going -> "You're going"
        HomeRsvpChoice.Maybe -> "You might go"
        HomeRsvpChoice.Cant -> "You can't make it"
        HomeRsvpChoice.NoReply -> "No reply yet"
    }

private fun reminderSummary(event: CalendarEventDto): String {
    val reminders = event.reminders
    if (reminders.isNullOrEmpty()) {
        return if (event.alertsEnabled == true) "10 min before" else "Off"
    }
    return reminders.sortedDescending().joinToString(" · ") { reminderPhrase(it) }
}

private fun reminderPhrase(minutes: Int): String =
    when {
        minutes <= 0 -> "At time"
        minutes == 1440 -> "1 day before"
        minutes == 60 -> "1 hour before"
        minutes % 60 == 0 -> "${minutes / 60} hours before"
        else -> "$minutes min before"
    }

private fun formattedTimeRange(event: CalendarEventDto): String {
    val startInstant = HomeAgendaBuilder.parseInstant(event.startAt) ?: return event.startAt
    val start = startInstant.atZone(DISPLAY_ZONE)
    val endInstant = event.endAt?.let { HomeAgendaBuilder.parseInstant(it) }
    val end = endInstant?.atZone(DISPLAY_ZONE)
    if (end == null && isMidnightUtc(start)) {
        return "${longDateLabel(start)} · All day"
    }
    return "${longDateLabel(start)} · ${formattedTime(start, end)}"
}

/** All-day rows are stored at midnight UTC + nil end — check in UTC. */
private fun isMidnightUtc(date: ZonedDateTime): Boolean {
    val utc = date.withZoneSameInstant(UTC_ZONE)
    return utc.hour == 0 && utc.minute == 0 && utc.second == 0
}

private fun longDateLabel(date: ZonedDateTime): String = DateTimeFormatter.ofPattern("EEE MMM d", Locale.US).format(date)

private fun formattedTime(
    start: ZonedDateTime,
    end: ZonedDateTime?,
): String {
    val fmt = DateTimeFormatter.ofPattern("h:mm a", Locale.US)
    val startLabel = fmt.format(start)
    return if (end == null) startLabel else "$startLabel – ${fmt.format(end)}"
}

private fun recurrenceLabel(rrule: String?): String? {
    if (rrule.isNullOrEmpty()) return null
    val upper = rrule.uppercase(Locale.ROOT)
    return when {
        // JSX `DetailGrid` shows "Every Monday" — resolve BYDAY to the weekday
        // like the iOS weeklyDay mapping, falling back to "Weekly".
        "FREQ=WEEKLY" in upper -> weeklyDayLabel(upper)?.let { "Every $it" } ?: "Weekly"
        "FREQ=YEARLY" in upper -> "Yearly"
        "FREQ=MONTHLY" in upper -> "Monthly"
        "FREQ=DAILY" in upper -> "Daily"
        else -> "Yes"
    }
}

/** "FREQ=WEEKLY;BYDAY=MO" → "Monday". Mirrors iOS `weeklyDay`. */
private fun weeklyDayLabel(upper: String): String? {
    val map =
        mapOf(
            "MO" to "Monday",
            "TU" to "Tuesday",
            "WE" to "Wednesday",
            "TH" to "Thursday",
            "FR" to "Friday",
            "SA" to "Saturday",
            "SU" to "Sunday",
        )
    val marker = "BYDAY="
    val index = upper.indexOf(marker)
    if (index < 0) return null
    val code = upper.substring(index + marker.length).take(2)
    return map[code]
}
