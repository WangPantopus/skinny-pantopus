@file:Suppress("PackageNaming", "MatchingDeclarationName")

package app.pantopus.android.ui.screens.shared.form

/**
 * Single validation rule applied to a string field. `validate` returns
 * an error string when invalid, or null when acceptable. Mirrors the
 * iOS `FormValidator` API.
 */
fun interface FormValidator {
    fun validate(value: String): String?

    companion object
}

/** Trims whitespace; returns an error when the result is empty. */
fun FormValidator.Companion.required(label: String): FormValidator =
    FormValidator { value ->
        if (value.trim().isEmpty()) "$label is required." else null
    }

/** Ensures length does not exceed [max] characters. */
fun FormValidator.Companion.maxLength(max: Int): FormValidator =
    FormValidator { value ->
        if (value.length > max) "Must be $max characters or fewer." else null
    }

/**
 * E.164 phone-number format (`^\+[1-9]\d{1,14}$`). Empty is allowed.
 * Mirrors the iOS validator.
 */
fun FormValidator.Companion.e164Phone(): FormValidator =
    FormValidator { value ->
        val trimmed = value.trim()
        if (trimmed.isEmpty()) {
            null
        } else if (E164_PATTERN.matches(trimmed)) {
            null
        } else {
            "Phone must be in E.164 format, e.g. +15555550123."
        }
    }

/**
 * RFC-5322-ish email check. Mirrors `Joi.string().email()` server-side
 * (`backend/routes/homeOwnership.js:67`).
 */
fun FormValidator.Companion.email(): FormValidator =
    FormValidator { value ->
        val trimmed = value.trim()
        when {
            trimmed.isEmpty() -> "Email is required."
            !EMAIL_PATTERN.matches(trimmed) -> "Enter a valid email address."
            else -> null
        }
    }

/** Reject the supplied email (case-insensitive). */
fun FormValidator.Companion.emailNotMatching(otherEmail: String): FormValidator {
    val normalised = otherEmail.lowercase()
    return FormValidator { value ->
        val trimmed = value.trim().lowercase()
        if (trimmed.isNotEmpty() && trimmed == normalised) {
            "You can't invite yourself."
        } else {
            null
        }
    }
}

/**
 * 24-hour clock time in `HH:mm` or empty. Used by the Edit Signup
 * form to bound the drop-off picker. Mirrors the iOS `timeHHmm`
 * validator.
 */
fun FormValidator.Companion.timeHHmm(): FormValidator =
    FormValidator { value ->
        val trimmed = value.trim()
        if (trimmed.isEmpty()) {
            null
        } else if (TIME_HHMM_PATTERN.matches(trimmed)) {
            null
        } else {
            "Use the format HH:mm (24-hour)."
        }
    }

/** Applies each rule in order; stops at the first failure. */
fun FormValidator.Companion.all(rules: List<FormValidator>): FormValidator =
    FormValidator { value ->
        rules.firstNotNullOfOrNull { it.validate(value) }
    }

/**
 * Min/max length, but only when the value is non-empty. Mirrors the
 * optional address-component fields in `updateProfileSchema`
 * (`backend/routes/users.js:332-335`) where empty means "leave alone".
 */
fun FormValidator.Companion.optionalLength(
    label: String,
    min: Int,
    max: Int,
): FormValidator =
    FormValidator { value ->
        val trimmed = value.trim()
        when {
            trimmed.isEmpty() -> null
            trimmed.length < min -> "$label must be at least $min characters."
            trimmed.length > max -> "$label must be $max characters or fewer."
            else -> null
        }
    }

/**
 * `http(s)` URL or empty. Mirrors `urlOrEmpty` at
 * `backend/routes/users.js:320-322`.
 */
fun FormValidator.Companion.urlOrEmpty(): FormValidator =
    FormValidator { value ->
        val trimmed = value.trim()
        if (trimmed.isEmpty()) {
            null
        } else if (URL_PATTERN.matches(trimmed)) {
            null
        } else {
            "Enter a valid URL (https://example.com)."
        }
    }

/**
 * ISO-8601 date (`yyyy-MM-dd`) or empty. Mirrors
 * `updateProfileSchema.dateOfBirth` at `backend/routes/users.js:340`.
 */
fun FormValidator.Companion.isoDateOrEmpty(): FormValidator =
    FormValidator { value ->
        val trimmed = value.trim()
        if (trimmed.isEmpty()) {
            null
        } else if (ISO_DATE_PATTERN.matches(trimmed) && isCalendarDate(trimmed)) {
            null
        } else {
            "Use the format YYYY-MM-DD."
        }
    }

private val E164_PATTERN = Regex("""^\+[1-9]\d{1,14}$""")
private val TIME_HHMM_PATTERN = Regex("""^([01]\d|2[0-3]):[0-5]\d$""")
private val EMAIL_PATTERN = Regex("""^[A-Z0-9a-z._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$""")
private val URL_PATTERN = Regex("""^https?://[A-Za-z0-9.\-]+(?::\d+)?(?:/[^\s]*)?$""")
private val ISO_DATE_PATTERN = Regex("""^\d{4}-\d{2}-\d{2}$""")
private val LONG_MONTHS = setOf(1, 3, 5, 7, 8, 10, 12)
private val SHORT_MONTHS = setOf(4, 6, 9, 11)

private const val ISO_DATE_PART_COUNT = 3
private const val YEAR_PART_INDEX = 0
private const val MONTH_PART_INDEX = 1
private const val DAY_PART_INDEX = 2
private const val FEBRUARY = 2
private const val FIRST_DAY_OF_MONTH = 1
private const val NO_DAYS_IN_MONTH = 0
private const val DAYS_IN_LONG_MONTH = 31
private const val DAYS_IN_SHORT_MONTH = 30
private const val DAYS_IN_LEAP_FEBRUARY = 29
private const val DAYS_IN_COMMON_FEBRUARY = 28
private const val LEAP_YEAR_FOUR = 4
private const val LEAP_YEAR_HUNDRED = 100
private const val LEAP_YEAR_FOUR_HUNDRED = 400

/**
 * Confirm `value` is a real calendar date — the regex only checks
 * the shape. Mirrors `DateFormatter` round-trip on iOS.
 */
private fun isCalendarDate(value: String): Boolean {
    val parts = value.split('-')
    val year = parts.getOrNull(YEAR_PART_INDEX)?.toIntOrNull()
    val month = parts.getOrNull(MONTH_PART_INDEX)?.toIntOrNull()
    val day = parts.getOrNull(DAY_PART_INDEX)?.toIntOrNull()

    return parts.size == ISO_DATE_PART_COUNT &&
        year != null &&
        month != null &&
        day != null &&
        day in FIRST_DAY_OF_MONTH..daysInMonth(year, month)
}

private fun daysInMonth(
    year: Int,
    month: Int,
): Int =
    when {
        month in LONG_MONTHS -> DAYS_IN_LONG_MONTH
        month in SHORT_MONTHS -> DAYS_IN_SHORT_MONTH
        month == FEBRUARY -> if (isLeapYear(year)) DAYS_IN_LEAP_FEBRUARY else DAYS_IN_COMMON_FEBRUARY
        else -> NO_DAYS_IN_MONTH
    }

private fun isLeapYear(year: Int): Boolean =
    (year % LEAP_YEAR_FOUR == 0 && year % LEAP_YEAR_HUNDRED != 0) || year % LEAP_YEAR_FOUR_HUNDRED == 0
