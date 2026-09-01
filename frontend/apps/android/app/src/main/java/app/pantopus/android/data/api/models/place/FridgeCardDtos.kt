package app.pantopus.android.data.api.models.place

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * The Fridge Card (Wave 1, #2): the 911-ready household card — the
 * server-derived verified address as the headline plus the facts only
 * the household knows. Content is frozen at issue; revocation pulls it
 * entirely. Section keys are plain strings on the wire so a key this
 * build has never heard of still decodes and still carries its items —
 * household safety data never hides. Parity: iOS `FridgeCardDTOs.swift`.
 */
enum class FridgeCardStatus {
    @Json(name = "active")
    ACTIVE,

    @Json(name = "revoked")
    REVOKED,
}

@JsonClass(generateAdapter = true)
data class FridgeCardItem(
    val label: String = "",
    val note: String = "",
)

@JsonClass(generateAdapter = true)
data class FridgeCardSection(
    /** household | medical | pets | utilities | contacts | notes | future keys. */
    val key: String,
    val items: List<FridgeCardItem> = emptyList(),
)

@JsonClass(generateAdapter = true)
data class FridgeCardAddress(
    val line1: String,
    @Json(name = "city_state_zip") val cityStateZip: String,
)

@JsonClass(generateAdapter = true)
data class FridgeCardContent(
    /** Server-derived from the verified home — never client input. */
    val address: FridgeCardAddress,
    val sections: List<FridgeCardSection> = emptyList(),
)

@JsonClass(generateAdapter = true)
data class FridgeCard(
    val id: String,
    @Json(name = "home_id") val homeId: String,
    val label: String? = null,
    val status: FridgeCardStatus = FridgeCardStatus.REVOKED,
    @Json(name = "card_code") val cardCode: String,
    @Json(name = "card_url") val cardUrl: String,
    val content: FridgeCardContent,
    @Json(name = "issued_at") val issuedAt: String,
    @Json(name = "revoked_at") val revokedAt: String? = null,
    @Json(name = "view_count") val viewCount: Int = 0,
    @Json(name = "last_viewed_at") val lastViewedAt: String? = null,
)

@JsonClass(generateAdapter = true)
data class IssueFridgeCardSection(
    val key: String,
    val items: List<FridgeCardItem>,
)

@JsonClass(generateAdapter = true)
data class IssueFridgeCardRequest(
    val label: String? = null,
    val sections: List<IssueFridgeCardSection>,
)

@JsonClass(generateAdapter = true)
data class FridgeCardResponse(
    val card: FridgeCard,
)

@JsonClass(generateAdapter = true)
data class FridgeCardsResponse(
    val cards: List<FridgeCard> = emptyList(),
)
