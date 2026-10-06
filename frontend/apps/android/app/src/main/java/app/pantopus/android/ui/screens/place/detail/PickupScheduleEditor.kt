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
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
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
    var weekday by rememberSaveable(data.pickupSchedule) { mutableStateOf(data.pickupSchedule?.weekday.orEmpty()) }
    var frequency by rememberSaveable(data.pickupSchedule) { mutableStateOf(data.pickupSchedule?.recyclingFrequency ?: "not_set") }
    var nextDate by rememberSaveable(data.pickupSchedule) { mutableStateOf(data.pickupSchedule?.recyclingNextDate.orEmpty()) }
    // The schedule this editor started from; a save sends it back so a change made meanwhile isn't undone.
    // Keyed on the version too: a save with identical content still writes new rules (a new version), and the
    // editor must then send that version, or every retry would be refused while the fields stay the same.
    val openedVersion by rememberSaveable(data.pickupSchedule, data.pickupVersion) { mutableStateOf(data.pickupVersion) }
    val dates =
        remember(data.today, frequency) {
            val today = runCatching { LocalDate.parse(data.today) }.getOrNull()
            if (today == null) {
                emptyList()
            } else {
                (0L until if (frequency == "weekly") WEEKLY_PICKUP_WINDOW_DAYS else BIWEEKLY_PICKUP_WINDOW_DAYS).map { offset ->
                    val date = today.plusDays(offset)
                    date.toString() to date.format(DateTimeFormatter.ofPattern("EEEE, MMM d"))
                }
            }
        }
    Text("Which day is garbage collected each week?", color = PantopusColors.appText, fontSize = 13.sp)
    ScheduleChoice("Garbage collection", weekday, WEEKDAYS, busy) { weekday = it }
    ScheduleChoice("Recycling", frequency, FREQUENCIES, busy) {
        frequency = it
        nextDate = ""
    }
    if (frequency != "not_set") {
        ScheduleChoice("Next recycling pickup", nextDate, dates, busy) { nextDate = it }
    }
    Text(
        "Use your collection day, not the night you put bins out. Dates follow your home’s calendar. " +
            "If recycling is unknown, only garbage is saved. Check your provider for holiday changes.",
        fontSize = 12.sp,
        color = PantopusColors.appTextSecondary,
    )
    Button(
        enabled = !busy && weekday.isNotEmpty() && (frequency == "not_set" || dates.any { it.first == nextDate }),
        onClick = {
            actions.setPickupDay(
                SetPickupDayRequest(weekday, frequency, nextDate.takeIf { frequency != "not_set" }, expectedVersion = openedVersion),
                offerPrimer = data.needsPickupDay || data.pickupSchedule == null,
            )
        },
    ) { Text(if (busy) "Saving…" else "Save schedule") }
    if (data.pickupSchedule != null) {
        TextButton(enabled = !busy, onClick = { actions.clearPickupDay(openedVersion) }) { Text("Clear household schedule") }
    }
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
