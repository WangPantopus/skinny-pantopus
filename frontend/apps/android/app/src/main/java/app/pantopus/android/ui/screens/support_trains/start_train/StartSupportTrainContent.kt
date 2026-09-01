@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.support_trains.start_train

import androidx.compose.runtime.Immutable
import app.pantopus.android.ui.theme.PantopusIcon
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * P2.6 — Render-only models for the Start-a-Support-Train wizard.
 *
 *  Step 1: Who & why   — beneficiary + reason
 *  Step 2: What & when — kind + date range + slot duration
 *  Step 3: Review      — generated slot grid + launch
 *  + terminal Success step
 */

enum class StartSupportTrainStep {
    WhoAndWhy,
    WhatAndWhen,
    ReviewAndLaunch,
    Success,
    ;

    val stepNumber: Int?
        get() =
            when (this) {
                WhoAndWhy -> 1
                WhatAndWhen -> 2
                ReviewAndLaunch -> 3
                Success -> null
            }

    companion object {
        const val PROGRESS_TOTAL: Int = 5
    }
}

/**
 * Step-1 reason picker values from A12.11. Renders in declaration order as
 * a 3×2 grid — everyday-help reasons on the first row (meal train · ride ·
 * errand), life moments on the second (surgery · baby · loss).
 *
 * [wire] mirrors the iOS `StartSupportTrainReason` raw value so the
 * `startSupportTrainReason_<wire>` test tags match across platforms.
 */
enum class StartSupportTrainReason(
    val wire: String,
    val title: String,
    val icon: PantopusIcon,
) {
    MealTrain("meal_train", "Meal train", PantopusIcon.Utensils),
    Ride("ride", "Ride", PantopusIcon.Car),
    Errand("errand", "Errand", PantopusIcon.ShoppingBag),
    Surgery("surgery", "Surgery", PantopusIcon.Stethoscope),
    Baby("baby", "Baby", PantopusIcon.Baby),
    Loss("loss", "Loss", PantopusIcon.Flower),
}

/**
 * A mutual connection shared between the organizer and the recipient,
 * surfaced as a micro-avatar strip on the verified-neighbor card so the
 * organizer can confirm they picked the right person.
 */
@Immutable
data class StartSupportTrainMutual(
    val id: String,
    val name: String,
) {
    /** One- or two-letter monogram for the micro-avatar. */
    val initials: String
        get() =
            name
                .split(" ")
                .filter { it.isNotBlank() }
                .take(2)
                .mapNotNull { it.firstOrNull()?.uppercaseChar() }
                .joinToString("")
                .ifBlank { "?" }
}

/**
 * The recipient the organizer typed but who isn't a verified Pantopus
 * neighbor yet — the Frame-2 invite branch. Carries the typed name plus
 * the (stubbed) contact handles the invite can be sent to.
 */
@Immutable
data class StartSupportTrainInviteCandidate(
    val typedName: String,
    val phone: String,
    val email: String,
) {
    /** The contact handle for a given invite method. */
    fun valueFor(method: StartSupportTrainInviteMethod): String =
        when (method) {
            StartSupportTrainInviteMethod.Phone -> phone
            StartSupportTrainInviteMethod.Email -> email
        }
}

/** Invite path option when the recipient is not on Pantopus yet. */
enum class StartSupportTrainInviteMethod(
    val title: String,
    val value: String,
    val icon: PantopusIcon,
) {
    Phone("Invite by phone", "+1 (415) 555-0142", PantopusIcon.Phone),
    Email("Invite by email", "d.chen@example.com", PantopusIcon.Mail),
}

/** Six designed train kinds + a generic escape hatch. Mirrors iOS. */
enum class SupportTrainKind(
    val wire: String,
    val title: String,
    val icon: PantopusIcon,
    /** Default start-of-window hour (24h) used by the slot generator. */
    val defaultStartHour: Int,
    /** Default `slot_label` matching backend enum. */
    val defaultSlotLabel: String,
    /** Backend `support_mode` enum value. */
    val supportMode: String,
) {
    Meals("meal_support", "Meals", PantopusIcon.Utensils, 17, "Dinner", "meal"),
    Rides("ride_support", "Rides", PantopusIcon.Navigation, 9, "Custom", "meal"),
    Childcare("childcare", "Childcare", PantopusIcon.Baby, 9, "Custom", "meal"),
    Errands("errand_support", "Errands", PantopusIcon.ShoppingBag, 10, "Groceries", "groceries"),
    DogWalks("pet_care", "Dog walks", PantopusIcon.PawPrint, 8, "Custom", "meal"),
    Other("visit_support", "Other", PantopusIcon.HandCoins, 10, "Custom", "meal"),
}

/** Slot duration choices the organizer can pick from. Stored in minutes. */
enum class StartSupportTrainSlotDuration(val minutes: Int, val title: String) {
    Thirty(30, "30 min"),
    Sixty(60, "1 hr"),
    Ninety(90, "1.5 hr"),
    OneTwenty(120, "2 hr"),
}

/** Who can see this train. Maps onto backend `sharing_mode`. */
enum class StartSupportTrainVisibility(
    val sharingModeWire: String,
    val title: String,
    val subtitle: String,
    val icon: PantopusIcon,
) {
    Neighbors(
        "private_link",
        "Nearby neighbors",
        "Anyone within 25 mi can find and sign up.",
        PantopusIcon.Users,
    ),
    Connections(
        "invited_only",
        "My connections",
        "Only people you're connected to can find this.",
        PantopusIcon.UserPlus,
    ),
    LinkOnly(
        "direct_share_only",
        "Link only",
        "Hidden — share the link with people you trust.",
        PantopusIcon.Link,
    ),
}

/** One generated slot in the preview grid. */
@Immutable
data class StartSupportTrainSlot(
    val id: String,
    val dateKey: String,
    val dayLabel: String,
    val timeLabel: String,
    val startTime: String,
    val endTime: String,
)

/** Form state held by the VM and consumed by the screen. */
@Immutable
data class StartSupportTrainFormState(
    val step: StartSupportTrainStep = StartSupportTrainStep.WhoAndWhy,
    val beneficiaryQuery: String = "",
    val selectedReason: StartSupportTrainReason = StartSupportTrainReason.Surgery,
    val reason: String = "",
    val inviteOnly: Boolean = true,
    val blockVisible: Boolean = false,
    val inviteMethod: StartSupportTrainInviteMethod = StartSupportTrainInviteMethod.Phone,
    val kind: SupportTrainKind = SupportTrainKind.Meals,
    val startDateMillis: Long = defaultStartMillis(),
    val endDateMillis: Long = defaultEndMillis(),
    val slotDuration: StartSupportTrainSlotDuration = StartSupportTrainSlotDuration.Sixty,
    val allowComments: Boolean = true,
    val visibility: StartSupportTrainVisibility = StartSupportTrainVisibility.Neighbors,
) {
    companion object {
        const val REASON_CHAR_LIMIT: Int = 500

        /** Default end-of-window offset (inclusive) — a 7-day span. */
        private const val DEFAULT_RANGE_DAYS_INCLUSIVE: Int = 6

        fun defaultStartMillis(): Long = Calendar.getInstance().apply { stripTime() }.timeInMillis

        fun defaultEndMillis(): Long =
            Calendar.getInstance().apply {
                stripTime()
                add(Calendar.DAY_OF_YEAR, DEFAULT_RANGE_DAYS_INCLUSIVE)
            }.timeInMillis
    }
}

/** Event the VM raises so the screen can pop / push routes. */
sealed interface StartSupportTrainEvent {
    /** User aborted or completed before publishing. */
    data object Dismiss : StartSupportTrainEvent

    /** Train published — host should pop wizard and push the train's
     *  review-signups screen for [trainId]. */
    data class OpenTrain(val trainId: String) : StartSupportTrainEvent
}

/** Slot-grid generator. Public so the unit test can drive it directly. */
object StartSupportTrainSlotGenerator {
    private const val MAX_HOUR: Int = 23
    private const val MINUTES_PER_HOUR: Int = 60
    private const val MAX_MINUTE_OF_HOUR: Int = 59
    private const val NOON_HOUR: Int = 12

    /** Backend caps a train at 90 slots; mirror that here. */
    private const val SLOT_CAPACITY: Int = 90
    private const val MAX_MINUTES_OF_DAY: Int = MAX_HOUR * MINUTES_PER_HOUR + MAX_MINUTE_OF_HOUR

    /** Build per-day slots covering `[startMillis, endMillis]` inclusive.
     *  Returns at most [SLOT_CAPACITY] slots to match the backend cap. */
    fun generate(
        startMillis: Long,
        endMillis: Long,
        durationMinutes: Int,
        startHour: Int,
    ): List<StartSupportTrainSlot> {
        val start =
            Calendar.getInstance().apply {
                timeInMillis = startMillis
                stripTime()
            }
        val end =
            Calendar.getInstance().apply {
                timeInMillis = endMillis
                stripTime()
            }
        if (end.before(start)) return emptyList()
        val dateFmt = SimpleDateFormat("yyyy-MM-dd", Locale.US).apply { timeZone = TimeZone.getDefault() }
        val dayFmt = SimpleDateFormat("EEE MMM d", Locale.US).apply { timeZone = TimeZone.getDefault() }

        val slots = mutableListOf<StartSupportTrainSlot>()
        val cursor = start.clone() as Calendar
        var generated = 0
        while (!cursor.after(end) && generated < SLOT_CAPACITY) {
            val dateKey = dateFmt.format(cursor.time)
            val dayLabel = dayFmt.format(cursor.time)
            val (startStr, endStr, timeLabel) = timeRange(startHour, durationMinutes)
            slots.add(
                StartSupportTrainSlot(
                    id = "${dateKey}_$startStr",
                    dateKey = dateKey,
                    dayLabel = dayLabel,
                    timeLabel = timeLabel,
                    startTime = startStr,
                    endTime = endStr,
                ),
            )
            cursor.add(Calendar.DAY_OF_YEAR, 1)
            generated += 1
        }
        return slots
    }

    private fun timeRange(
        startHour: Int,
        durationMinutes: Int,
    ): Triple<String, String, String> {
        val startMinutes = (startHour.coerceIn(0, MAX_HOUR) * MINUTES_PER_HOUR).coerceAtMost(MAX_MINUTES_OF_DAY)
        val endMinutes = (startMinutes + durationMinutes.coerceAtLeast(0)).coerceAtMost(MAX_MINUTES_OF_DAY)
        val startStr = wireString(startMinutes)
        val endStr = wireString(endMinutes)
        val label = "${displayString(startMinutes)}–${displayString(endMinutes)}"
        return Triple(startStr, endStr, label)
    }

    private fun wireString(totalMinutes: Int): String {
        val h = totalMinutes / MINUTES_PER_HOUR
        val m = totalMinutes % MINUTES_PER_HOUR
        return String.format(Locale.US, "%02d:%02d", h, m)
    }

    private fun displayString(totalMinutes: Int): String {
        val h24 = totalMinutes / MINUTES_PER_HOUR
        val m = totalMinutes % MINUTES_PER_HOUR
        val suffix = if (h24 < NOON_HOUR) "am" else "pm"
        val h12 = if (h24 % NOON_HOUR == 0) NOON_HOUR else h24 % NOON_HOUR
        return if (m == 0) "$h12 $suffix" else String.format(Locale.US, "%d:%02d %s", h12, m, suffix)
    }
}

/** Strip a Calendar to start-of-day in its current timezone. */
internal fun Calendar.stripTime() {
    set(Calendar.HOUR_OF_DAY, 0)
    set(Calendar.MINUTE, 0)
    set(Calendar.SECOND, 0)
    set(Calendar.MILLISECOND, 0)
}

/** Format helper for the date-pickers' display. */
internal fun formatDay(millis: Long): String {
    val fmt = SimpleDateFormat("EEE MMM d, yyyy", Locale.US)
    fmt.timeZone = TimeZone.getDefault()
    return fmt.format(Date(millis))
}
