package app.pantopus.android.ui.screens.place.detail

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.core.security.findFragmentActivity
import app.pantopus.android.data.api.models.ai.AIPickupScheduleReadingDto
import app.pantopus.android.data.api.models.place.PickupCollection
import app.pantopus.android.data.api.models.place.PlaceAddressCalendarData
import app.pantopus.android.data.api.models.place.SetPickupDayRequest
import app.pantopus.android.ui.components.GhostButton
import app.pantopus.android.ui.theme.PantopusColors
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter

private const val WEEKLY_PICKUP_WINDOW_DAYS = 7L
private const val BIWEEKLY_PICKUP_WINDOW_DAYS = 14L
private const val WEEKDAY_LABEL_LENGTH = 3

private val WEEKDAYS =
    listOf(
        "MO" to "Monday",
        "TU" to "Tuesday",
        "WE" to "Wednesday",
        "TH" to "Thursday",
        "FR" to "Friday",
        "SA" to "Saturday",
        "SU" to "Sunday",
    )
private val FREQUENCIES = listOf("not_set" to "Not sure yet", "weekly" to "Every week", "biweekly" to "Every other week")

/** Dates come from the home's local today; the device timezone never chooses a pickup week. */
@Composable
internal fun PickupScheduleEditor(
    data: PlaceAddressCalendarData,
    actions: AddressCalendarActions,
    busy: Boolean,
) {
    var collections by remember(data.pickupSchedule, data.pickupVersion) { mutableStateOf(data.pickupSchedule?.collections.orEmpty()) }
    val openedVersion = data.pickupVersion
    var readingFlyer by remember { mutableStateOf(false) }
    val locked = busy || readingFlyer
    if (actions.readsPickupFlyers) {
        PickupFlyerControl(actions, enabled = !busy, onReadingChange = { readingFlyer = it }) { read ->
            collections = collections.filledFrom(read, data.today)
        }
    }
    Text("Choose the collections your household uses.", color = PantopusColors.appText, fontSize = 13.sp)
    listOf("garbage" to "Garbage", "recycling" to "Recycling", "yard_waste" to "Yard waste", "bulk_pickup" to "Bulk collection").forEach {
            (kind, label) ->
        val row = collections.find { it.kind == kind }
        Row {
            Checkbox(checked = row != null, enabled = !locked, onCheckedChange = { enabled ->
                collections = if (enabled) collections + PickupCollection(kind) else collections.filter { it.kind != kind }
            }, modifier = Modifier.semantics { contentDescription = label })
            Text(label, color = PantopusColors.appText, modifier = Modifier.padding(top = 12.dp))
        }
        if (row != null) {
            CollectionFields(row, label, locked) { changed -> collections = collections.map { if (it.kind == kind) changed else it } }
        }
    }
    Text(
        "Use collection dates, not the night you put bins out. Keep the original start date for an unchanged cycle. " +
            "Turn off a type to remove it. Check your provider for holiday changes.",
        fontSize = 12.sp,
        color = PantopusColors.appTextSecondary,
    )
    Button(
        enabled =
            !locked && collections.isNotEmpty() &&
                collections.all {
                    it.anchorDate.isNotEmpty() && (it.frequency != "weekly" || it.weekdays.isNotEmpty())
                },
        onClick = {
            actions.setPickupDay(
                SetPickupDayRequest(collections = collections, expectedVersion = openedVersion),
                offerPrimer = data.needsPickupDay || data.pickupSchedule == null,
            )
        },
    ) { Text(if (busy) "Saving…" else "Save schedule") }
    if (data.pickupSchedule != null) {
        TextButton(enabled = !locked, onClick = { actions.clearPickupDay(openedVersion) }) { Text("Clear household schedule") }
    }
}

@Composable
private fun CollectionFields(
    row: PickupCollection,
    label: String,
    locked: Boolean,
    onChange: (PickupCollection) -> Unit,
) {
    val pattern =
        when (row.frequency) {
            "weekly" -> "weekly-${row.interval}"
            "monthly" -> "monthly-${row.monthlyMode}"
            else -> "once"
        }
    val choices =
        (1..4).map { "weekly-$it" to if (it == 1) "Every week" else "Every $it weeks" } +
            listOf("monthly-day_of_month" to "Monthly on this date", "monthly-weekday" to "Monthly on this weekday", "once" to "One time")
    ScheduleChoice("$label repeats", pattern, choices, locked) { value ->
        onChange(
            when {
                value.startsWith("weekly-") -> row.copy(frequency = "weekly", interval = value.removePrefix("weekly-").toInt())
                value.startsWith(
                    "monthly-",
                ) ->
                    row.copy(
                        frequency = "monthly",
                        interval = if (row.frequency == "monthly") row.interval else 1,
                        monthlyMode = value.removePrefix("monthly-"),
                    )
                else -> row.copy(frequency = "once", interval = 1, untilDate = null)
            },
        )
    }
    if (row.frequency == "monthly") {
        ScheduleChoice(
            "$label month interval",
            row.interval.toString(),
            (1..12).map { it.toString() to if (it == 1) "Every month" else "Every $it months" },
            locked,
        ) {
            onChange(row.copy(interval = it.toInt()))
        }
    }
    if (row.frequency == "weekly") {
        CollectionWeekdays(row, label, locked, onChange)
    }
    OutlinedTextField(
        value = row.anchorDate,
        onValueChange = { onChange(row.copy(anchorDate = it)) },
        enabled = !locked,
        label = {
            Text("$label first collection date")
        },
        placeholder = { Text("YYYY-MM-DD") },
        singleLine = true,
        modifier = Modifier.fillMaxWidth(),
    )
    if (row.frequency != "once") {
        OutlinedTextField(
            value = row.untilDate.orEmpty(),
            onValueChange = { onChange(row.copy(untilDate = it.takeIf(String::isNotEmpty))) },
            enabled = !locked,
            label = { Text("$label end date (optional)") },
            placeholder = { Text("YYYY-MM-DD") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
    }
    if (row.frequency == "weekly" && row.interval > 1) {
        Text("The start date anchors the collection week. Weeks begin Monday.", fontSize = 12.sp, color = PantopusColors.appTextSecondary)
    }
    if (row.frequency == "monthly") {
        Text(
            "The start date sets the pattern. Dates absent from a month are skipped; a fifth weekday means the last weekday.",
            fontSize = 12.sp,
            color = PantopusColors.appTextSecondary,
        )
    }
}

@Composable
private fun CollectionWeekdays(
    row: PickupCollection,
    label: String,
    locked: Boolean,
    onChange: (PickupCollection) -> Unit,
) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(2.dp)) {
        WEEKDAYS.forEach { (code, day) ->
            TextButton(
                onClick = { onChange(row.copy(weekdays = if (code in row.weekdays) row.weekdays - code else row.weekdays + code)) },
                enabled = !locked,
                contentPadding = PaddingValues(0.dp),
                modifier =
                    Modifier.weight(1f).semantics {
                        contentDescription = "$label $day: ${if (code in row.weekdays) "Selected" else "Not selected"}"
                    },
            ) {
                Text(day.take(WEEKDAY_LABEL_LENGTH) + if (code in row.weekdays) "✓" else "", fontSize = 11.sp)
            }
        }
    }
}

private fun List<PickupCollection>.filledFrom(
    read: AIPickupScheduleReadingDto,
    today: String,
): List<PickupCollection> {
    val filled = PickupChoice("", "not_set", "").filledFrom(read, today)
    var result = this
    if (filled.weekday.isNotEmpty()) {
        val anchor =
            pickupDates(today, "weekly").firstOrNull { (date, _) ->
                WEEKDAYS[LocalDate.parse(date).dayOfWeek.value - 1].first == filled.weekday
            }?.first.orEmpty()
        result = result.filter { it.kind != "garbage" } +
            PickupCollection("garbage", weekdays = listOf(filled.weekday), anchorDate = anchor)
    }
    if (filled.frequency != "not_set" && filled.nextDate.isNotEmpty()) {
        val day = WEEKDAYS[LocalDate.parse(filled.nextDate).dayOfWeek.value - 1].first
        result = result.filter { it.kind != "recycling" } +
            PickupCollection(
                "recycling",
                interval = if (filled.frequency == "biweekly") 2 else 1,
                weekdays = listOf(day),
                anchorDate = filled.nextDate,
            )
    }
    return result
}

/** The dates the editor offers for the next recycling pickup: one cycle from the home's local today. */
private fun pickupDates(
    today: String,
    frequency: String,
): List<Pair<String, String>> {
    val start = runCatching { LocalDate.parse(today) }.getOrNull() ?: return emptyList()
    return (0L until if (frequency == "weekly") WEEKLY_PICKUP_WINDOW_DAYS else BIWEEKLY_PICKUP_WINDOW_DAYS).map { offset ->
        val date = start.plusDays(offset)
        date.toString() to date.format(DateTimeFormatter.ofPattern("EEEE, MMM d"))
    }
}

/** The editor's three fields. */
internal data class PickupChoice(
    val weekday: String,
    val frequency: String,
    val nextDate: String,
)

/** Only what the flyer shows changes; a field it doesn't show keeps the editor's value. */
internal fun PickupChoice.filledFrom(
    read: AIPickupScheduleReadingDto,
    today: String,
): PickupChoice {
    val day = read.garbageWeekday?.takeIf { code -> WEEKDAYS.any { it.first == code } } ?: weekday
    val cycle = read.recyclingFrequency?.takeIf { code -> FREQUENCIES.any { it.first == code } }
    val next =
        when (cycle) {
            null -> nextDate
            "not_set" -> ""
            else -> read.recyclingNextDate?.takeIf { date -> pickupDates(today, cycle).any { it.first == date } }.orEmpty()
        }
    return PickupChoice(day, cycle ?: frequency, next)
}

@Composable
private fun ScheduleChoice(
    label: String,
    value: String,
    choices: List<Pair<String, String>>,
    busy: Boolean,
    onSelect: (String) -> Unit,
) {
    var expanded by remember { mutableStateOf(false) }
    Column {
        Text(label, color = PantopusColors.appTextSecondary, fontSize = 13.sp)
        Box {
            val selected = choices.find { it.first == value }?.second ?: "Choose"
            OutlinedButton(
                onClick = { expanded = true },
                enabled = !busy,
                modifier = Modifier.fillMaxWidth().semantics { contentDescription = "$label: $selected" },
            ) {
                Text(selected, color = PantopusColors.appText)
            }
            DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                choices.forEach { (code, text) ->
                    DropdownMenuItem(text = { Text(text) }, enabled = !busy, onClick = {
                        expanded = false
                        onSelect(code)
                    })
                }
            }
        }
    }
}

/** The only entry is an acknowledged first pickup save; dismissal sends no request. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun PickupReminderPrimer(actions: AddressCalendarActions) {
    val homeId = actions.pickupPrimerHomeId?.collectAsStateWithLifecycle()?.value ?: return
    val context = LocalContext.current
    val prefs = remember(context) { context.applicationContext.getSharedPreferences("just_moved", Context.MODE_PRIVATE) }
    val shownKey = "pickupPrimer.shown.$homeId"
    val show = remember(homeId) { !prefs.getBoolean(shownKey, false) }
    var busy by remember(homeId) { mutableStateOf(false) }
    var errorText by remember(homeId) { mutableStateOf<String?>(null) }
    var notificationsOff by remember(homeId) { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val permission =
        rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            if (granted) actions.dismissPickupPrimer() else notificationsOff = true
        }
    LaunchedEffect(homeId, actions.calendarHomeId) {
        if (!show || actions.calendarHomeId != homeId) {
            actions.dismissPickupPrimer()
        } else {
            prefs.edit().putBoolean(shownKey, true).apply()
        }
    }
    if (!show || actions.calendarHomeId != homeId) return
    val onRemind: () -> Unit = {
        busy = true
        scope.launch {
            val timezone = ZoneId.systemDefault().id
            errorText =
                if (timezone in ZoneId.getAvailableZoneIds()) {
                    actions.enablePickupReminders(homeId, timezone)
                } else {
                    "Couldn't read your time zone. Try again."
                }
            busy = false
            if (errorText == null) {
                askPickupPermission(
                    context,
                    { permission.launch(Manifest.permission.POST_NOTIFICATIONS) },
                    { actions.dismissPickupPrimer() },
                    { notificationsOff = true },
                )
            }
        }
    }
    ModalBottomSheet(
        onDismissRequest = { if (!busy) actions.dismissPickupPrimer() },
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = PantopusColors.appSurface,
    ) {
        PickupPrimerContent(
            busy = busy,
            errorText = errorText,
            notificationsOff = notificationsOff,
            onDismiss = actions::dismissPickupPrimer,
            onRemind = onRemind,
            onSettings = {
                val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", context.packageName, null))
                runCatching { context.startActivity(intent) }
            },
        )
    }
}

@Composable
private fun PickupPrimerContent(
    busy: Boolean,
    errorText: String?,
    notificationsOff: Boolean,
    onDismiss: () -> Unit,
    onRemind: () -> Unit,
    onSettings: () -> Unit,
) {
    Column(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        TextButton(onClick = onDismiss, enabled = !busy) { Text("Close") }
        Text("Get a reminder the night before?", fontSize = 20.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
        Text(
            "One notification the evening before each pickup. Nothing on other days.",
            fontSize = 14.sp,
            color = PantopusColors.appTextSecondary,
        )
        errorText?.let { Text(it, fontSize = 13.sp, color = PantopusColors.error) }
        if (notificationsOff) {
            Text(
                "Notifications are off for Pantopus. Turn them on in Settings.",
                fontSize = 14.sp,
                color = PantopusColors.appTextSecondary,
            )
            GhostButton("Open Settings", onSettings, modifier = Modifier.fillMaxWidth())
        } else {
            GhostButton("Remind me", onRemind, modifier = Modifier.fillMaxWidth(), isLoading = busy, isEnabled = !busy)
        }
        GhostButton("Not now", onDismiss, modifier = Modifier.fillMaxWidth(), isEnabled = !busy)
    }
}

private fun askPickupPermission(
    context: Context,
    request: () -> Unit,
    enabled: () -> Unit,
    denied: () -> Unit,
) {
    if (NotificationManagerCompat.from(context).areNotificationsEnabled()) {
        enabled()
    } else if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
        denied()
    } else {
        val granted =
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) ==
                PackageManager.PERMISSION_GRANTED
        val activity = context.findFragmentActivity()
        when {
            granted -> enabled()
            activity == null || activity.shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS) -> denied()
            else -> request()
        }
    }
}
