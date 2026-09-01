@file:Suppress("PackageNaming", "TooManyFunctions", "MagicNumber")

package app.pantopus.android.ui.screens.scheduling.invitee.confirm

import app.pantopus.android.data.api.models.scheduling.PublicCreateBookingRequest
import java.time.Instant
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.Locale

/**
 * Pure helpers behind A6 — D1 intake validation, D2 price/checkout math, and
 * the shared summary-card formatting. Ported 1:1 from the web W6 `confirmUtils`
 * so the two platforms stay in lockstep; kept free of Compose / network so it
 * is exercised on the plain JVM (see `ConfirmUtilsTest`).
 *
 * NOTE ON QUESTIONS: the live public read (`GET /public/book/:slug` + `…/slots`)
 * does NOT expose an event type's intake questions today — [PublicEventTypeView]
 * has no `questions` field (only the host-authed `GET /event-types/:id` returns
 * them). D1 therefore renders questions DEFENSIVELY: if a future public payload
 * adds them they render dynamically; until then the form is the base
 * name / email / phone (+ optional guests). The `answers` object is still sent
 * on create — the backend accepts arbitrary keys.
 */
object ConfirmUtils {
    private val EMAIL_RE = Regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")

    fun isValidEmail(value: String): Boolean = EMAIL_RE.matches(value.trim())

    private fun answerIsEmpty(value: AnswerValue?): Boolean =
        when (value) {
            null -> true
            is AnswerValue.Text -> value.value.isBlank()
            is AnswerValue.Choices -> value.value.isEmpty()
            is AnswerValue.Flag -> !value.value // an unchecked required checkbox counts as empty
        }

    /** Stable key for a question's answer + error map. */
    fun questionKey(
        question: IntakeQuestion,
        index: Int,
    ): String = question.id?.takeIf { it.isNotBlank() } ?: "q$index"

    /**
     * Validate the intake form. Returns a `{ field -> message }` map; empty = valid.
     * Field keys: `firstName` · `lastName` · `email` · `<questionKey>` · `guest<i>`.
     */
    fun validateIntake(
        values: IntakeValues,
        questions: List<IntakeQuestion> = emptyList(),
    ): Map<String, String> {
        val errors = linkedMapOf<String, String>()

        if (values.firstName.isBlank()) errors["firstName"] = "Enter your first name"
        if (values.lastName.isBlank()) errors["lastName"] = "Enter your last name"

        val email = values.email.trim()
        when {
            email.isEmpty() -> errors["email"] = "Enter your email address"
            !isValidEmail(email) -> errors["email"] = "Enter a valid email address"
        }

        questions.forEachIndexed { index, question ->
            val key = questionKey(question, index)
            val answer = values.answers[key]
            if (question.required && answerIsEmpty(answer)) {
                errors[key] = "This question is required"
            }
            if (question.fieldType == IntakeFieldType.Phone && !answerIsEmpty(answer)) {
                val digits = (answer as? AnswerValue.Text)?.value?.filter { it.isDigit() }.orEmpty()
                if (digits.length < MIN_PHONE_DIGITS) errors[key] = "Enter a valid phone number"
            }
        }

        values.guests.forEachIndexed { index, guest ->
            val trimmed = guest.trim()
            if (trimmed.isNotEmpty() && !isValidEmail(trimmed)) {
                errors["guest$index"] = "Enter a valid email address"
            }
        }

        return errors
    }

    fun isIntakeValid(
        values: IntakeValues,
        questions: List<IntakeQuestion> = emptyList(),
    ): Boolean = validateIntake(values, questions).isEmpty()

    /** Build the POST body for `publicCreateBooking` from the intake form. */
    fun buildBookingRequest(
        values: IntakeValues,
        startAtUtc: String,
        durationMin: Int? = null,
        timezone: String? = null,
        questions: List<IntakeQuestion> = emptyList(),
    ): PublicCreateBookingRequest {
        val name = "${values.firstName.trim()} ${values.lastName.trim()}".trim()
        val answers = linkedMapOf<String, Any?>()

        questions.forEachIndexed { index, question ->
            val answer = values.answers[questionKey(question, index)]
            if (!answerIsEmpty(answer)) {
                val label = question.label.takeIf { it.isNotBlank() } ?: questionKey(question, index)
                answers[label] =
                    when (answer) {
                        is AnswerValue.Text -> answer.value
                        is AnswerValue.Choices -> answer.value
                        is AnswerValue.Flag -> answer.value
                        null -> null
                    }
            }
        }

        val guests = values.guests.map { it.trim() }.filter { it.isNotEmpty() }
        if (guests.isNotEmpty()) answers["guest_emails"] = guests

        val phone = values.phone.trim()
        return PublicCreateBookingRequest(
            startAt = startAtUtc,
            name = name,
            email = values.email.trim(),
            durationMin = durationMin,
            phone = phone.ifEmpty { null },
            timezone = timezone?.ifBlank { null },
            answers = answers.ifEmpty { null },
        )
    }

    // ─── Money / pricing (D2) ───────────────────────────────────────────────

    fun priceMode(
        priceCents: Int?,
        depositCents: Int?,
    ): PriceMode {
        val price = priceCents ?: 0
        if (price <= 0) return PriceMode.Free
        val deposit = depositCents ?: 0
        return if (deposit in 1 until price) PriceMode.Deposit else PriceMode.Full
    }

    /** What the invitee pays now — full price, or the deposit when deposit < price. */
    fun dueNowCents(
        priceCents: Int?,
        depositCents: Int?,
    ): Int = if (priceMode(priceCents, depositCents) == PriceMode.Deposit) depositCents ?: 0 else priceCents ?: 0

    fun balanceCents(
        priceCents: Int?,
        depositCents: Int?,
    ): Int =
        if (priceMode(priceCents, depositCents) == PriceMode.Deposit) {
            (priceCents ?: 0) - (depositCents ?: 0)
        } else {
            0
        }

    /** Primary CTA label for the review step. */
    fun reviewCtaLabel(
        priceCents: Int?,
        depositCents: Int?,
        currency: String?,
        paidEnabled: Boolean,
    ): String {
        if (!paidEnabled || priceMode(priceCents, depositCents) == PriceMode.Free) return "Confirm booking"
        val due = formatCents(dueNowCents(priceCents, depositCents), currency)
        return "Pay $due & book"
    }

    /**
     * Exact currency string for a line item / total ("$40.00", "$0.00").
     * Unlike `MoneyAndFlag.formatPrice` (which collapses 0 to "Free"), this
     * always renders the amount — the review breakdown needs the literal value.
     */
    fun formatCents(
        cents: Int,
        currency: String? = DEFAULT_CURRENCY,
    ): String {
        val code = currency?.takeIf { it.isNotBlank() }?.uppercase() ?: DEFAULT_CURRENCY
        val amount = cents / CENTS_PER_UNIT
        return runCatching {
            java.text.NumberFormat.getCurrencyInstance(Locale.US).apply {
                this.currency = java.util.Currency.getInstance(code)
            }.format(amount)
        }.getOrElse { "%.2f %s".format(amount, code) }
    }

    // ─── Time + timezone formatting ──────────────────────────────────────────

    private fun safeInstant(iso: String?): Instant? {
        if (iso.isNullOrBlank()) return null
        return runCatching { Instant.parse(iso) }
            .recoverCatching { OffsetDateTime.parse(iso).toInstant() }
            .getOrNull()
    }

    private fun zone(tz: String?): ZoneId = runCatching { ZoneId.of(tz ?: "UTC") }.getOrDefault(ZoneId.of("UTC"))

    /** "Wed, Jun 17 · 9:30–10:00 AM" rendered in [tz]; collapses a shared meridiem. */
    fun formatSlotRange(
        startUtc: String,
        endUtc: String?,
        tz: String,
    ): String {
        val start = safeInstant(startUtc) ?: return startUtc
        val z = zone(tz)
        val startZ = start.atZone(z)
        val datePart = startZ.format(DATE_FMT)
        val startTime = startZ.format(TIME_NO_MERIDIEM)
        val startMeridiem = startZ.format(MERIDIEM_ONLY)
        val end = safeInstant(endUtc) ?: return "$datePart · $startTime $startMeridiem".trim()
        val endZ = end.atZone(z)
        val endTime = endZ.format(TIME_NO_MERIDIEM)
        val endMeridiem = endZ.format(MERIDIEM_ONLY)
        val startLabel = if (startMeridiem == endMeridiem) startTime else "$startTime $startMeridiem"
        return "$datePart · $startLabel–$endTime $endMeridiem".trim()
    }

    /** Human timezone label for the chip, e.g. "Pacific Time (PDT)". */
    fun tzChipLabel(
        tz: String,
        atUtc: String? = null,
    ): String {
        val z = zone(tz)
        val instant = safeInstant(atUtc) ?: Instant.now()
        val zdt = instant.atZone(z)
        val long =
            runCatching { z.getDisplayName(TextStyle.FULL, Locale.US) }
                .getOrNull()
                ?.takeIf { it.isNotBlank() && it != tz }
                ?: tz.substringAfterLast('/').replace('_', ' ')
        val abbr = runCatching { zdt.format(ABBR_ONLY) }.getOrNull()?.takeIf { it.length <= ABBR_MAX && it.none { c -> c.isDigit() } }
        return if (abbr.isNullOrBlank()) long else "$long ($abbr)"
    }

    /** Plain-language location summary ("Video call", "In person", …). */
    fun locationLabel(
        mode: String?,
        detail: String?,
    ): LocationLabel =
        when (mode) {
            "video" -> LocationLabel("Pantopus video", "Join link is sent after you book.")
            "phone" -> LocationLabel("Phone call", detail?.trim()?.ifEmpty { null } ?: "We'll call the number you provide.")
            "in_person" ->
                LocationLabel(
                    detail?.trim()?.ifEmpty { null } ?: "In person",
                    if (detail?.isNotBlank() == true) null else "Address is sent after you book.",
                )
            "ask" -> LocationLabel("They'll ask you", "Location is arranged after booking.")
            "custom" -> LocationLabel(detail?.trim()?.ifEmpty { null } ?: "Details to follow", null)
            else -> LocationLabel("Details to follow", null)
        }

    /** "30 min" · "1 hr" · "1 hr 30 min". */
    fun durationLabel(min: Int?): String {
        if (min == null || min <= 0) return ""
        if (min < MINUTES_PER_HOUR) return "$min min"
        val hrs = min / MINUTES_PER_HOUR
        val rem = min % MINUTES_PER_HOUR
        return if (rem == 0) "$hrs hr" else "$hrs hr $rem min"
    }

    fun initials(value: String?): String {
        val parts = value.orEmpty().trim().split(Regex("\\s+")).filter { it.isNotBlank() }
        if (parts.isEmpty()) return "?"
        return parts.take(2).joinToString("") { it.first().uppercase() }
    }

    /** First word of a name ("Maria Kessler" → "Maria"); blank-safe. */
    fun firstName(value: String?): String =
        value.orEmpty().trim().split(Regex("\\s+")).firstOrNull()?.takeIf { it.isNotBlank() } ?: value.orEmpty().trim()

    /** True for booking statuses that have already concluded (read-only manage). */
    fun isPastBooking(
        status: String?,
        endUtc: String?,
    ): Boolean {
        if (status == "completed" || status == "no_show") return true
        if (status != "confirmed" && status != "rescheduled") return false
        val end = safeInstant(endUtc) ?: return false
        return end.isBefore(Instant.now())
    }

    /** Resolve the device IANA zone, falling back to UTC. */
    fun deviceTimezone(): String = runCatching { ZonedDateTime.now().zone.id }.getOrDefault("UTC")

    /**
     * The receipt's monospace transaction line ("TXN_4F9C20A1 · Jun 13, 2026 ·
     * 9:41 AM"). The booking id is the real transaction reference; [paidAtUtc]
     * (or now, for the represented checkout) supplies the timestamp.
     */
    fun receiptTxnLine(
        bookingId: String,
        paidAtUtc: String? = null,
        tz: String = deviceTimezone(),
    ): String {
        val ref =
            bookingId.filter { it.isLetterOrDigit() }.takeLast(TXN_REF_LEN).uppercase().ifBlank { "RECEIPT" }
        val at = (safeInstant(paidAtUtc) ?: Instant.now()).atZone(zone(tz))
        val date = at.format(TXN_DATE_FMT)
        val time = at.format(TXN_TIME_FMT)
        return "TXN_$ref · $date · $time"
    }

    private const val MIN_PHONE_DIGITS = 7
    private const val MINUTES_PER_HOUR = 60
    private const val ABBR_MAX = 5
    private const val TXN_REF_LEN = 8
    private const val DEFAULT_CURRENCY = "USD"
    private const val CENTS_PER_UNIT = 100.0
    private val DATE_FMT: DateTimeFormatter = DateTimeFormatter.ofPattern("EEE, MMM d", Locale.US)
    private val TIME_NO_MERIDIEM: DateTimeFormatter = DateTimeFormatter.ofPattern("h:mm", Locale.US)
    private val MERIDIEM_ONLY: DateTimeFormatter = DateTimeFormatter.ofPattern("a", Locale.US)
    private val ABBR_ONLY: DateTimeFormatter = DateTimeFormatter.ofPattern("zzz", Locale.US)
    private val TXN_DATE_FMT: DateTimeFormatter = DateTimeFormatter.ofPattern("MMM d, yyyy", Locale.US)
    private val TXN_TIME_FMT: DateTimeFormatter = DateTimeFormatter.ofPattern("h:mm a", Locale.US)
}

enum class PriceMode { Free, Full, Deposit }

/** Plain-language location summary for the booking. */
data class LocationLabel(
    val label: String,
    val sub: String?,
)
