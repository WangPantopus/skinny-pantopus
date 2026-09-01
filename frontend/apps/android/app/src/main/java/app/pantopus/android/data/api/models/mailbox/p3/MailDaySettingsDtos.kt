@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.mailbox.p3

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * DTOs for `GET|PATCH api/mailbox/v2/p3/mailday/settings`
 * (`backend/routes/mailboxV2Phase3.js:1121` / `:1160`). Distinct from
 * `MailDayTriageDtos.kt`, which carries the triage-day frame from
 * `backend/routes/mailDay.js`.
 *
 * Mirrors `Core/Networking/Models/Mailbox/P3/MailDaySettingsDTOs.swift`.
 */

/**
 * The caller's Mail Day preference row. Every field is defaulted so the
 * server's "no row yet" defaults object and a real row decode alike.
 */
@JsonClass(generateAdapter = true)
data class MailDaySettingsDto(
    @Json(name = "delivery_time") val deliveryTime: String? = null,
    val timezone: String? = null,
    val enabled: Boolean = true,
    @Json(name = "sound_enabled") val soundEnabled: Boolean = true,
    /** `off` / `soft` / `classic`. */
    @Json(name = "sound_type") val soundType: String? = null,
    @Json(name = "haptics_enabled") val hapticsEnabled: Boolean = true,
    @Json(name = "include_personal") val includePersonal: Boolean = true,
    @Json(name = "include_home") val includeHome: Boolean = true,
    @Json(name = "include_business") val includeBusiness: Boolean = true,
    @Json(name = "include_earn_count") val includeEarnCount: Boolean = true,
    @Json(name = "include_community") val includeCommunity: Boolean = true,
    @Json(name = "interrupt_time_sensitive") val interruptTimeSensitive: Boolean = true,
    @Json(name = "interrupt_packages_otd") val interruptPackagesOtd: Boolean = true,
    @Json(name = "interrupt_certified") val interruptCertified: Boolean = true,
    @Json(name = "current_theme") val currentTheme: String? = null,
)

/** Envelope for `PATCH api/mailbox/v2/p3/mailday/settings` — `{ settings }`. */
@JsonClass(generateAdapter = true)
data class MailDaySettingsPatchResponse(
    val settings: MailDaySettingsDto,
)

/**
 * Partial `PATCH` body. Only the toggled key is populated; Moshi omits
 * null fields by default, so the Joi validator
 * (`backend/routes/mailboxV2Phase3.js:88`) sees exactly one key.
 */
@JsonClass(generateAdapter = true)
data class MailDaySettingsPatch(
    @Json(name = "delivery_time") val deliveryTime: String? = null,
    val enabled: Boolean? = null,
    @Json(name = "sound_enabled") val soundEnabled: Boolean? = null,
    @Json(name = "sound_type") val soundType: String? = null,
    @Json(name = "haptics_enabled") val hapticsEnabled: Boolean? = null,
    @Json(name = "include_personal") val includePersonal: Boolean? = null,
    @Json(name = "include_home") val includeHome: Boolean? = null,
    @Json(name = "include_business") val includeBusiness: Boolean? = null,
    @Json(name = "include_earn_count") val includeEarnCount: Boolean? = null,
    @Json(name = "include_community") val includeCommunity: Boolean? = null,
    @Json(name = "interrupt_time_sensitive") val interruptTimeSensitive: Boolean? = null,
    @Json(name = "interrupt_packages_otd") val interruptPackagesOtd: Boolean? = null,
    @Json(name = "interrupt_certified") val interruptCertified: Boolean? = null,
)
