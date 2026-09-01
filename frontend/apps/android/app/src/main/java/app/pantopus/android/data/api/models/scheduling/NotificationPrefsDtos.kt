@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.scheduling

import com.squareup.moshi.JsonClass

/**
 * `GET/PUT /notification-preferences` (personal). The `prefs` object is a
 * flexible, service-defined bag (`object.unknown(true)` server-side), so it is
 * modelled as a permissive map; feature streams (A1/A4/A18) read/write the keys
 * they care about. Moshi decodes arbitrary JSON values into the standard
 * `Map`/`List`/`Double`/`Boolean`/`String`/null tree.
 */
@JsonClass(generateAdapter = true)
data class NotificationPrefsResponse(
    val prefs: Map<String, Any?> = emptyMap(),
)

/** Body for `PUT /notification-preferences`. */
@JsonClass(generateAdapter = true)
data class UpdateNotificationPrefsRequest(
    val prefs: Map<String, Any?>,
)
