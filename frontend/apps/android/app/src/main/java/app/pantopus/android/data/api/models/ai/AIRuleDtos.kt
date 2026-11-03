@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.ai

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/** `GET /api/ai/rules` (AI assistant phase 3 contract §18.5): the person's standing rules, newest first. */
@JsonClass(generateAdapter = true)
data class AIRulesResponse(
    val rules: List<AIRuleDto> = emptyList(),
    val limit: Int? = null,
)

/**
 * One standing rule: [summary] is the sentence the card showed; [pausedReason] is why it stopped on its own
 * (`nobody_came`, `cannot_post`, `ended`, `member_left`), null while it runs or after the person switched it off.
 */
@JsonClass(generateAdapter = true)
data class AIRuleDto(
    val id: String,
    /** `plan_repeat` (a weekly plan) or `pickup_reminder`. */
    val kind: String,
    val summary: String,
    val enabled: Boolean = false,
    @Json(name = "paused_reason") val pausedReason: String? = null,
    /** A weekly plan's last day (up to 12 weeks after it was turned on or extended). */
    @Json(name = "ends_at") val endsAt: String? = null,
    @Json(name = "next_run_at") val nextRunAt: String? = null,
    /** Its last five runs, newest first. */
    val runs: List<AIRuleRunDto> = emptyList(),
)

/** One run: "Posted Sat Oct 31 · 4 going" with the plan's link, or "Reminded Sam · Wed Oct 28 pickup" with none. */
@JsonClass(generateAdapter = true)
data class AIRuleRunDto(
    val at: String? = null,
    /** `done` or `error`. */
    val status: String? = null,
    val label: String? = null,
    val link: String? = null,
)

/** `PATCH /api/ai/rules/:id`'s answer. */
@JsonClass(generateAdapter = true)
data class AIRuleResponse(
    val rule: AIRuleDto,
)

/** `PATCH /api/ai/rules/:id`: switch it off or on, or give a weekly plan 12 more weeks. */
@JsonClass(generateAdapter = true)
data class AIRuleChangeBody(
    val enabled: Boolean? = null,
    val extend: Boolean? = null,
)
