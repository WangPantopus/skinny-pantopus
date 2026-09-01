package app.pantopus.android.data.api.models.place

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * DTOs for `/api/homes/:id/residency-letters*` and the public
 * third-party check `/api/public/residency-letters/:code`. Route:
 * `backend/routes/residencyLetters.js` (serializeLetter at :185).
 * Mirrors `frontend/packages/api/src/endpoints/residencyLetters.ts`
 * and the iOS `ResidencyLetterDTOs.swift`.
 *
 * A T4 (verified-occupancy) resident issues a letter; the backend
 * freezes the printed facts + the exact PDF, and prints an unguessable
 * verification code on the letter. Letters are PERSONAL documents —
 * the API only ever returns the caller's own letters for a home.
 */

enum class ResidencyLetterStatus {
    @Json(name = "issued")
    ISSUED,

    @Json(name = "revoked")
    REVOKED,
    UNKNOWN,
}

@JsonClass(generateAdapter = true)
data class ResidencyLetterAddress(
    val line1: String,
    val city: String? = null,
    val state: String? = null,
    val zipcode: String? = null,
)

@JsonClass(generateAdapter = true)
data class ResidencyLetter(
    val id: String,
    @Json(name = "home_id") val homeId: String,
    val status: ResidencyLetterStatus,
    val purpose: String,
    @Json(name = "resident_name") val residentName: String,
    val address: ResidencyLetterAddress,
    /** Printed on the letter; what third parties verify. */
    @Json(name = "letter_code") val letterCode: String,
    @Json(name = "verify_url") val verifyUrl: String,
    @Json(name = "issued_at") val issuedAt: String,
    @Json(name = "revoked_at") val revokedAt: String? = null,
    @Json(name = "pdf_sha256") val pdfSha256: String,
)

/** `POST /api/homes/:id/residency-letters` body. */
@JsonClass(generateAdapter = true)
data class IssueResidencyLetterRequest(
    val purpose: String? = null,
)

/** `{ letter: … }` envelope (issue / revoke responses). */
@JsonClass(generateAdapter = true)
data class ResidencyLetterResponse(
    val letter: ResidencyLetter,
)

/** `{ letters: […] }` envelope (list response). */
@JsonClass(generateAdapter = true)
data class ResidencyLettersResponse(
    val letters: List<ResidencyLetter> = emptyList(),
)

/**
 * Public third-party check result — exactly what the paper shows.
 * Unknown codes come back as a uniform `{ valid: false }`.
 */
@JsonClass(generateAdapter = true)
data class ResidencyLetterVerification(
    val valid: Boolean,
    val status: ResidencyLetterStatus? = null,
    @Json(name = "resident_name") val residentName: String? = null,
    val address: ResidencyLetterAddress? = null,
    val purpose: String? = null,
    @Json(name = "issued_at") val issuedAt: String? = null,
    @Json(name = "revoked_at") val revokedAt: String? = null,
)
