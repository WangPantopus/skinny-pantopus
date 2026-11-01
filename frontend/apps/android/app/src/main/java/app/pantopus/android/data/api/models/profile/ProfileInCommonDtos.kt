package app.pantopus.android.data.api.models.profile

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * `GET /api/users/:id/in-common` (PRF SRV-1, `backend/routes/users.js:3846`): what the signed-in viewer and the person
 * share, limited to what the viewer may already see. Every part may be missing or empty; the app then hides it.
 */
@JsonClass(generateAdapter = true)
data class ProfileInCommonResponse(
    val connections: ProfileInCommonConnections? = null,
    val plans: List<ProfileInCommonPlan> = emptyList(),
    @Json(name = "support_trains") val supportTrains: List<ProfileInCommonTrain> = emptyList(),
    val skills: List<String> = emptyList(),
)

/** People connected to both of you: [count] of them, [people] at most two by name. */
@JsonClass(generateAdapter = true)
data class ProfileInCommonConnections(
    val count: Int = 0,
    val people: List<ProfileInCommonPerson> = emptyList(),
)

/** A shared connection by the name neighbors see; [username] is null for a made-up one. */
@JsonClass(generateAdapter = true)
data class ProfileInCommonPerson(
    val id: String,
    val name: String? = null,
    val username: String? = null,
    @Json(name = "avatar_url") val avatarUrl: String? = null,
)

/** An upcoming plan you're both in; [id] opens the plan. */
@JsonClass(generateAdapter = true)
data class ProfileInCommonPlan(
    val id: String,
    val title: String? = null,
    val kind: String? = null,
    @Json(name = "starts_at") val startsAt: String? = null,
    @Json(name = "ends_at") val endsAt: String? = null,
    @Json(name = "host_id") val hostId: String? = null,
)

/** A Support Train you both signed up to help; [id] opens the train. */
@JsonClass(generateAdapter = true)
data class ProfileInCommonTrain(
    val id: String,
    val title: String? = null,
)

/** The profile read's `contributions` (PRF SRV-1): the same counts for every viewer; null when they couldn't be read. */
@JsonClass(generateAdapter = true)
data class ProfileContributions(
    @Json(name = "support_trains_helped") val supportTrainsHelped: Int? = null,
    @Json(name = "plans_hosted") val plansHosted: Int? = null,
    @Json(name = "helpful_marks") val helpfulMarks: Int? = null,
)
