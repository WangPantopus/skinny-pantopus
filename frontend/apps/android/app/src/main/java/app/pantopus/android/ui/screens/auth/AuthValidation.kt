@file:Suppress("MagicNumber", "ReturnCount")

package app.pantopus.android.ui.screens.auth

import java.time.LocalDate
import java.time.Period

/**
 * Pure-function validators shared by Login / SignUp / Forgot / Reset
 * view-models. Mirrors iOS `AuthValidation`. Returns a user-facing error
 * string or `null` when the value passes.
 */
object AuthValidation {
    private val emailRegex = Regex("^[A-Z0-9a-z._%+\\-]+@[A-Za-z0-9.\\-]+\\.[A-Za-z]{2,}$")
    private val usernameRegex = Regex("^[a-z0-9_]+$")
    private val phoneRegex = Regex("^\\+[1-9]\\d{1,14}$")
    private val letterRegex = Regex("[A-Za-z]")
    private val digitRegex = Regex("[0-9]")
    private val symbolRegex = Regex("[^A-Za-z0-9]")

    fun email(value: String): String? {
        val trimmed = value.trim()
        if (trimmed.isEmpty()) return "Email is required."
        return if (emailRegex.containsMatchIn(trimmed)) null else "Enter a valid email address."
    }

    fun password(value: String): String? {
        if (value.isEmpty()) return "Password is required."
        if (value.length < 8) return "Password must be at least 8 characters."
        if (!letterRegex.containsMatchIn(value)) return "Password must include at least one letter."
        if (!digitRegex.containsMatchIn(value)) return "Password must include at least one number."
        return null
    }

    fun username(value: String): String? {
        val trimmed = value.trim()
        if (trimmed.isEmpty()) return "Username is required."
        if (trimmed.length < 3) return "Username must be at least 3 characters."
        if (trimmed.length > 20) return "Username must be 20 characters or fewer."
        return if (usernameRegex.containsMatchIn(trimmed)) {
            null
        } else {
            "Use lowercase letters, numbers, or underscores only."
        }
    }

    fun dateOfBirth(
        date: LocalDate?,
        today: LocalDate = LocalDate.now(),
    ): String? {
        if (date == null) return "Date of birth is required."
        val age = Period.between(date, today).years
        if (age < 18) return "You must be at least 18 years old."
        return null
    }

    fun phoneOptional(value: String): String? {
        val trimmed = value.trim()
        if (trimmed.isEmpty()) return null
        return if (phoneRegex.containsMatchIn(trimmed)) {
            null
        } else {
            "Phone must be in E.164 format, e.g. +15555550123."
        }
    }

    /** 0..3 bucket: 0 empty / 1 weak / 2 fair / 3 strong. */
    fun passwordStrength(value: String): Int {
        if (value.isEmpty()) return 0
        val hasLetter = letterRegex.containsMatchIn(value)
        val hasDigit = digitRegex.containsMatchIn(value)
        val hasSymbol = symbolRegex.containsMatchIn(value)
        if (value.length < 8 || !hasLetter || !hasDigit) return 1
        if (value.length >= 12 && hasSymbol) return 3
        return 2
    }
}
