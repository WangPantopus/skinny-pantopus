@file:Suppress("TooManyFunctions", "CyclomaticComplexMethod")

package app.pantopus.android.ui.screens.crewday.booking

import app.pantopus.android.data.api.models.crewday.CrewDayBookingDto
import app.pantopus.android.data.crewday.CrewDayFormat
import java.time.Instant
import java.time.temporal.ChronoUnit

/** Which state card the booking page leads with (01-spec screen 5's table). */
enum class CrewDayBookingCard {
    Booked,
    Evening,
    DayOf,
    Confirming,
    PriceOffered,
    OnTheWay,
    Done,
    Paid,
    CardFailed,
    NewDates,
    Attention,
    Resolved,
    Refunded,
    Cancelled,
    Declined,
}

/** The state card for [booking] now. */
fun CrewDayBookingDto.card(now: Instant = Instant.now()): CrewDayBookingCard {
    val problem = problem
    return when {
        problem?.status == "open" -> CrewDayBookingCard.Attention
        status == "refunded" -> CrewDayBookingCard.Refunded
        problem?.status == "resolved" && status in setOf("paid", "done", "cancelled") -> CrewDayBookingCard.Resolved
        status == "price_pending" -> CrewDayBookingCard.Confirming
        status == "price_offered" -> CrewDayBookingCard.PriceOffered
        status == "new_dates" -> CrewDayBookingCard.NewDates
        status == "on_the_way" -> CrewDayBookingCard.OnTheWay
        status == "done" -> CrewDayBookingCard.Done
        status == "paid" -> CrewDayBookingCard.Paid
        status == "payment_failed" -> CrewDayBookingCard.CardFailed
        status == "cancelled" -> CrewDayBookingCard.Cancelled
        status == "declined" -> CrewDayBookingCard.Declined
        else ->
            when (daysUntil(now)) {
                0L -> CrewDayBookingCard.DayOf
                1L -> CrewDayBookingCard.Evening
                else -> CrewDayBookingCard.Booked
            }
    }
}

/** Days from today (in the Crew Day's zone) to the booking's own date. */
fun CrewDayBookingDto.daysUntil(now: Instant = Instant.now()): Long? {
    val zone = CrewDayFormat.zone(crewDay?.timezone)
    val date = CrewDayFormat.date(serviceDate) ?: return null
    return ChronoUnit.DAYS.between(now.atZone(zone).toLocalDate(), date)
}

/** "Tuesday" for the evening-before reminder: the day before the booking's date. */
fun CrewDayBookingDto.reminderWeekday(): String? = CrewDayFormat.date(serviceDate)?.minusDays(1)?.let(CrewDayFormat::weekday)

/** The crew's name, or "The crew". */
val CrewDayBookingDto.crewName: String get() = crewDay?.crew?.name?.takeIf { it.isNotBlank() } ?: "The crew"

/** "$180" or null while the price waits on the crew. */
val CrewDayBookingDto.priceWords: String? get() = priceCents?.let(CrewDayFormat::price)

/** "Visa ending 4242". */
val CrewDayBookingDto.cardWords: String?
    get() =
        card?.let { c ->
            val brand = c.brand?.takeIf { it.isNotBlank() }?.replaceFirstChar { it.titlecase() } ?: "Card"
            if (c.last4.isNullOrBlank()) brand else "$brand ending ${c.last4}"
        }

/** "Two stories · gutter guards". */
val CrewDayBookingDto.homeDetails: String
    get() {
        if (lineItems.isEmpty()) return (listOfNotNull(option?.label) + addOns.map { it.label.lowercase() }).joinToString(" · ")
        return lineItems.joinToString(" · ") { if (it.kind == "add_on") it.label.lowercase() else it.label }
    }

/** "Tue, Nov 17 · 9 AM–1 PM". */
val CrewDayBookingDto.whenWords: String get() = CrewDayFormat.dateAndWindow(serviceDate, windowStart, windowEnd)

/** The cancellation line under "Your booking". */
fun CrewDayBookingDto.cancelWords(now: Instant = Instant.now()): String? {
    val zone = CrewDayFormat.zone(crewDay?.timezone)
    val cutoff = CrewDayFormat.instant(cancelCutoffAt) ?: return null
    if (status in setOf("cancelled", "declined", "refunded", "paid", "done", "payment_failed")) return null
    return if (now.isBefore(cutoff)) {
        "Free cancellation until ${CrewDayFormat.shortDate(cutoff, zone)}, ${CrewDayFormat.clock(cutoff, zone)}."
    } else {
        "It's less than 48 hours to go. $crewName can release your home at no charge."
    }
}

/** "Refunded $60 of $180", "Charge released: $180 paid" … : how a problem ended. */
fun CrewDayBookingDto.resolutionWords(): String {
    val total = priceWords ?: "your charge"
    val refunded = problem?.refundedCents?.takeIf { it > 0 } ?: charge?.refundedCents?.takeIf { it > 0 }
    return when (problem?.resolution) {
        "released" -> "Charge released: $total paid"
        "refunded" -> "Refunded $total${cardWords?.let { " to $it" }.orEmpty()}"
        "partial_refund" -> "Refunded ${CrewDayFormat.price(refunded)} of $total"
        else -> if (refunded != null) "Refunded ${CrewDayFormat.price(refunded)} of $total" else "Pantopus support resolved this"
    }
}

/** Who cancelled, in words (01-spec screen 5: "You cancelled. Nothing was charged." …). */
fun CrewDayBookingDto.cancelledWords(): String =
    when (cancelledBy) {
        "household" -> "You cancelled. Nothing was charged."
        "crew" ->
            if (crewDay?.status == "cancelled") {
                "$crewName cancelled this day. Nothing was charged."
            } else {
                "$crewName released your home. Nothing was charged."
            }
        "system" -> "No new date was picked, so this booking was cancelled. Nothing was charged."
        "operator" -> "Pantopus cancelled this booking. Nothing was charged."
        else -> "This booking was cancelled. Nothing was charged."
    }

/** "Wed, Nov 18" for a timestamp in the Crew Day's zone. */
fun CrewDayBookingDto.dayOf(raw: String?): String? = CrewDayFormat.shortDate(CrewDayFormat.instant(raw), zone)

/** "11:42 AM" for a timestamp in the Crew Day's zone. */
fun CrewDayBookingDto.clockOf(raw: String?): String? = CrewDayFormat.clock(CrewDayFormat.instant(raw), zone)

/** The Crew Day's own time zone. */
val CrewDayBookingDto.zone: java.time.ZoneId get() = CrewDayFormat.zone(crewDay?.timezone)

/** "tomorrow at 11:42 AM", "today at …", or "Wed, Nov 18 at …" for when the charge runs. */
fun CrewDayBookingDto.chargeWhen(now: Instant = Instant.now()): String? {
    val due = CrewDayFormat.instant(charge?.dueAt) ?: return null
    val zone = CrewDayFormat.zone(crewDay?.timezone)
    val day = due.atZone(zone).toLocalDate()
    val today = now.atZone(zone).toLocalDate()
    val dayWords =
        when (ChronoUnit.DAYS.between(today, day)) {
            0L -> "today"
            1L -> "tomorrow"
            else -> CrewDayFormat.shortDate(day)
        }
    return "$dayWords at ${CrewDayFormat.clock(due, zone)}"
}
