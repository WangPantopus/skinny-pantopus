package app.pantopus.android.data.api.models.place

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * The Mailbox Reality Check (Wave 1, #3): "can USPS, lenders, and
 * delivery apps actually find your address?" — the claim-time postal
 * validation surfaced as a diagnostic, plus the caller's postcard as
 * the physical leg. Vocabulary enums are registered with the
 * unknown-fallback factory so a server-side addition cannot break an
 * older build. Parity: iOS `MailboxCheckDTOs.swift`.
 */
enum class MailboxCheckVerdict {
    @Json(name = "looks_good")
    LOOKS_GOOD,

    @Json(name = "needs_attention")
    NEEDS_ATTENTION,

    @Json(name = "problem")
    PROBLEM,

    UNKNOWN,
}

enum class MailboxFindingSeverity {
    @Json(name = "ok")
    OK,

    @Json(name = "info")
    INFO,

    @Json(name = "attention")
    ATTENTION,

    @Json(name = "problem")
    PROBLEM,
}

enum class MailboxPhysicalStatus {
    @Json(name = "proven")
    PROVEN,

    @Json(name = "in_progress")
    IN_PROGRESS,

    @Json(name = "not_run")
    NOT_RUN,
}

@JsonClass(generateAdapter = true)
data class MailboxFinding(
    val severity: MailboxFindingSeverity = MailboxFindingSeverity.INFO,
    val title: String,
    val detail: String,
)

@JsonClass(generateAdapter = true)
data class MailboxPhysicalLeg(
    val status: MailboxPhysicalStatus = MailboxPhysicalStatus.NOT_RUN,
    val title: String,
    val detail: String,
)

@JsonClass(generateAdapter = true)
data class MailboxCheck(
    val verdict: MailboxCheckVerdict = MailboxCheckVerdict.UNKNOWN,
    val findings: List<MailboxFinding> = emptyList(),
    val physical: MailboxPhysicalLeg,
    @Json(name = "checked_at") val checkedAt: String? = null,
)

@JsonClass(generateAdapter = true)
data class MailboxCheckResponse(
    val check: MailboxCheck,
)
