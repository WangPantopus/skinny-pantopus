package app.pantopus.android.data.homes

import com.squareup.moshi.Moshi
import com.squareup.moshi.Types

/** Strict wire proof and encrypted-original validation for member removal only. */
class HomeMemberRemovalCodec(moshi: Moshi) {
    private val objects =
        moshi.adapter<Map<String, Any?>>(
            Types.newParameterizedType(Map::class.java, String::class.java, Any::class.java),
        ).serializeNulls()

    fun objectFrom(json: String): Map<String, Any?> = checkNotNull(objects.fromJson(json))

    fun intent(intent: HomeMemberRemovalIntent): String =
        objects.toJson(linkedMapOf("home_id" to intent.homeId, "target_user_id" to intent.targetUserId))

    fun encode(request: HomeMemberRemovalRequest): String =
        objects.toJson(
            linkedMapOf(
                "request_id" to request.requestId,
                "home_id" to request.intent.homeId,
                "target_user_id" to request.intent.targetUserId,
                "occupancy_id" to request.occupancyId,
                "action" to "remove",
                "decision_token" to request.decisionToken,
            ),
        )

    fun cancel(draft: PendingHomeMemberRemoval): String = objects.toJson(objectFrom(draft.requestJson).filterKeys { it != "request_id" })

    fun valid(
        draft: PendingHomeMemberRemoval,
        scope: HomeCreationScope,
    ): Boolean =
        runCatching {
            draft.scope == scope && scope.isValid() && draft.summary.isNotBlank() && draft.summary.length <= MAX_SUMMARY &&
                draft.request.isValid() && encode(draft.request) == draft.requestJson &&
                (draft.receiptJson == null || outcome(draft.receiptJson, draft).receiptJson == draft.receiptJson)
        }.getOrDefault(false)

    fun session(
        value: Any?,
        scope: HomeCreationScope,
    ): String {
        val row = nested(value)
        check(row["actor_id"] == scope.actorId && HomeResidencyReviewCodec.reviewHash(row["session_scope"]))
        return row["session_scope"] as String
    }

    fun context(
        json: String,
        scope: HomeCreationScope,
        expectedSession: String,
        intent: HomeMemberRemovalIntent,
    ): HomeMemberRemovalContext {
        val row = objectFrom(json)
        check(session(row["session"], scope) == expectedSession)
        check(row["home_id"] == intent.homeId && row["target_user_id"] == intent.targetUserId && row["action"] == "remove")
        check(homeTaskUUID(row["occupancy_id"] as? String) && HomeResidencyReviewCodec.reviewHash(row["decision_token"]))
        val home = nested(row["home"])
        val target = nested(row["target"])
        check(home["id"] == intent.homeId && target["id"] == intent.targetUserId)
        val summary = reviewSummary(home, target, intent, scope)
        check(summary.length <= MAX_SUMMARY)
        return HomeMemberRemovalContext(intent, row["occupancy_id"] as String, row["decision_token"] as String, summary)
    }

    private fun reviewSummary(
        home: Map<String, Any?>,
        target: Map<String, Any?>,
        intent: HomeMemberRemovalIntent,
        scope: HomeCreationScope,
    ): String {
        val homeName = nullableText(home, "name")?.takeIf(String::isNotBlank) ?: "Household ${intent.homeId}"
        check(target.containsKey("name") && target["name"] == null)
        val username = nullableText(target, "username")?.takeIf(String::isNotBlank)?.let { "@$it" }
        check(target["is_self"] is Boolean && target["is_active"] is Boolean)
        check(target["is_self"] == (intent.targetUserId == scope.actorId))
        val role = nullableText(target, "role_base")
        check(role in ROLES || (role == null && target["is_self"] == true))
        val status = nullableText(target, "verification_status", MAX_STATUS)
        val dates = DATES.associateWith { nullableDate(target, it) }
        return listOfNotNull(
            homeName,
            username ?: "Account: ${intent.targetUserId}",
            if (target["is_self"] == true) "Your household membership" else null,
            "Role: ${role ?: "Unconfirmed historical role"}",
            "Membership active: ${if (target["is_active"] == true) "Yes" else "No"}",
            status?.let { "Membership status: $it" },
            dates["start_at"]?.let { "Membership begins: $it" },
            dates["end_at"]?.let { "Membership ends: $it" },
            dates["access_start_at"]?.let { "Access begins: $it" },
            dates["access_end_at"]?.let { "Access ends: $it" },
        ).joinToString("\n")
    }

    /** A receipt describes this original transaction; it never establishes current membership. */
    fun outcome(
        json: String,
        draft: PendingHomeMemberRemoval,
    ): HomeMemberRemovalOutcome {
        val row = objectFrom(json)
        check(row.keys.containsAll(RECEIPT_FIELDS) && row.keys.all { it in RECEIPT_FIELDS || it in TRANSPORT_FIELDS })
        val request = draft.request
        check(row["home_id"] == request.intent.homeId && row["target_user_id"] == request.intent.targetUserId)
        check(row["occupancy_id"] == request.occupancyId && row["decision_token"] == request.decisionToken && row["action"] == "remove")
        val state = row["state"] as? String
        check(state in setOf("completed", "cancelled", "rejected", "pending"))
        val completedAt = nullableDate(row, "completed_at")
        val code = nullableText(row, "code", MAX_STATUS)
        val status = row["status"]
        val expectedStatus = if (state == "rejected") REJECTIONS[code] else null
        if (state == "rejected") {
            check(expectedStatus != null && status is Number && status.toDouble() == expectedStatus.toDouble() && completedAt == null)
        } else {
            check(code == null && status == null)
            check(if (state == "completed") completedAt != null else completedAt == null)
        }
        if (row.containsKey("replayed")) check(row["replayed"] is Boolean)
        val command = nested(row["command"])
        check(command.keys == COMMAND_FIELDS)
        check(command["actor_id"] == draft.scope.actorId && command["request_id"] == request.requestId)
        check(postalDate(command["created_at"] as? String) && postalDate(command["updated_at"] as? String))
        val projected = row.filterKeys { it in RECEIPT_FIELDS }
        return HomeMemberRemovalOutcome(checkNotNull(state), code, expectedStatus, completedAt, objects.toJson(projected))
    }

    /** Reports only the current authorized roster snapshot, without inferring independent residency or other grants. */
    fun currentRoster(
        json: String,
        intent: HomeMemberRemovalIntent,
    ): HomeMemberRemovalCurrent {
        val values = objectFrom(json)["occupants"] as? List<*> ?: error("Expected current household roster")
        val rows = values.map(::nested)
        check(rows.all { homeTaskUUID(it["id"] as? String) && homeTaskUUID(it["user_id"] as? String) && it["is_active"] == true })
        check(rows.all { it["home_id"] == intent.homeId })
        check(rows.map { it["user_id"] }.distinct().size == rows.size)
        return if (rows.any { it["user_id"] == intent.targetUserId }) {
            HomeMemberRemovalCurrent.Listed
        } else {
            HomeMemberRemovalCurrent.NotListed
        }
    }

    private fun nullableText(
        row: Map<String, Any?>,
        key: String,
        limit: Int = MAX_LABEL,
    ): String? {
        check(row.containsKey(key))
        val value = row[key]
        check(value == null || (value is String && value.length <= limit))
        return value as? String
    }

    private fun nullableDate(
        row: Map<String, Any?>,
        key: String,
    ): String? {
        check(row.containsKey(key) && (row[key] == null || postalDate(row[key] as? String)))
        return row[key] as? String
    }

    private fun nested(value: Any?): Map<String, Any?> {
        val row = value as? Map<*, *> ?: error("Expected a member removal object")
        check(row.keys.all { it is String })
        return row.entries.associate { (key, value) -> key as String to value }
    }

    private companion object {
        const val MAX_SUMMARY = 12000
        const val MAX_LABEL = 1000
        const val MAX_STATUS = 80
        val ROLES = setOf("owner", "admin", "manager", "member", "restricted_member", "guest", "lease_resident", "service_provider")
        val DATES = setOf("start_at", "end_at", "access_start_at", "access_end_at")
        val RECEIPT_FIELDS =
            setOf(
                "state", "home_id", "target_user_id", "occupancy_id", "action", "decision_token",
                "completed_at", "code", "status", "command",
            )
        val COMMAND_FIELDS = setOf("actor_id", "request_id", "created_at", "updated_at")
        val TRANSPORT_FIELDS = setOf("session", "replayed")
        val REJECTIONS =
            mapOf(
                "MEMBER_REMOVAL_CHANGED" to 409, "MEMBER_ALREADY_REMOVED" to 409,
                "MEMBERS_MANAGE_REQUIRED" to 403, "TARGET_RANK_FORBIDDEN" to 403,
                "OWNERSHIP_FLOW_REQUIRED" to 409, "TRANSFER_REQUIRED" to 409, "MEMBER_ROLE_UNKNOWN" to 409,
                "MEMBER_NOT_FOUND" to 404, "HOME_NOT_FOUND" to 404,
            )
    }
}
