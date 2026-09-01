@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.mailbox.v2

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Body for `POST /api/mailbox/v2/p3/translate` (A17.13). Mirrors
 * `translateSchema` (`backend/routes/mailboxV2Phase3.js:1643`). `targetLang`
 * defaults to `en`. Mirrors iOS `TranslateMailRequest`.
 */
@JsonClass(generateAdapter = true)
data class TranslateMailRequest(
    val mailId: String,
    val targetLang: String = "en",
)

/** Response for `POST /api/mailbox/v2/p3/translate` (`mailboxV2Phase3.js:1672`). */
@JsonClass(generateAdapter = true)
data class TranslationResult(
    @Json(name = "translated_text") val translatedText: String? = null,
    @Json(name = "from_language") val fromLanguage: String? = null,
    @Json(name = "to_language") val toLanguage: String? = null,
    val cached: Boolean? = null,
)
