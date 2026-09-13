package app.pantopus.android.data.homes

import com.squareup.moshi.Moshi
import com.squareup.moshi.Types

/** Explicit nullable fields must be present; missing or malformed current state fails closed. */
class HomeResidencyReviewCodec(moshi: Moshi) {
    private val objects = moshi.adapter<Map<String, Any?>>(Types.newParameterizedType(Map::class.java, String::class.java, Any::class.java))

    fun objectFrom(json: String): Map<String, Any?> = checkNotNull(objects.fromJson(json))

    fun request(
        requestId: String,
        token: String,
        action: HomeResidencyDecision,
        role: HomeResidencyReviewRole,
        reason: String,
    ): String =
        objects.toJson(
            linkedMapOf<String, Any?>("request_id" to requestId, "review_token" to token).apply {
                if (action == HomeResidencyDecision.Approve) put("proposed_role", role.wire) else put("reason", reason.trim())
            },
        )

    fun valid(
        draft: PendingHomeResidencyReview,
        scope: HomeResidencyReviewScope,
    ): Boolean =
        runCatching {
            if (draft.scope != scope || !scope.isValid()) return false
            if (!homeTaskUUID(draft.claimId) || !homeTaskUUID(draft.requestId)) return false
            val body = objectFrom(draft.requestJson)
            if (body["request_id"] != draft.requestId || !reviewHash(body["review_token"])) return false
            val fields =
                setOf("request_id", "review_token", if (draft.action == HomeResidencyDecision.Approve) "proposed_role" else "reason")
            if (body.keys != fields) return false
            val detailsMatch =
                if (draft.action == HomeResidencyDecision.Approve) {
                    HomeResidencyReviewRole.entries.any { it.wire == body["proposed_role"] }
                } else {
                    val reason = body["reason"] as? String ?: return false
                    reason == reason.trim() && reason.length <= MAX_REASON
                }
            detailsMatch && (draft.receiptJson == null || receipt(draft.receiptJson, draft) == draft.receiptJson)
        }.getOrDefault(false)

    fun current(
        json: String,
        scope: HomeResidencyReviewScope,
        claimId: String,
        session: String?,
    ): HomeResidencyCurrentReview = current(objectFrom(json), scope, claimId, session)

    fun current(
        fields: Map<String, Any?>,
        scope: HomeResidencyReviewScope,
        claimId: String,
        session: String?,
    ): HomeResidencyCurrentReview {
        check(scope.isValid() && homeTaskUUID(claimId) && fields["ok"] == true && fields["home_id"] == scope.homeId)
        val proof = nested(fields["residency_session"])
        val sessionScope = proof["session_scope"] as? String
        check(proof["actor_id"] == scope.actorId && proof["home_id"] == scope.homeId && reviewHash(sessionScope))
        check(session == null || session == sessionScope)
        val claim = nested(fields["claim"])
        check(claim["id"] == claimId && claim["home_id"] == scope.homeId && homeTaskUUID(claim["user_id"] as? String))
        check((claim["status"] as? String)?.isNotBlank() == true && reviewHash(claim["review_token"]))
        check(listOf("claimed_role", "claimed_address", "review_note", "reviewed_by").all { nullableText(claim, it) })
        check(listOf("created_at", "updated_at").all { postalDate(claim[it] as? String) } && nullableDate(claim, "reviewed_at"))
        check(fields.containsKey("occupancy"))
        val occupancy = fields["occupancy"]?.let(::nested)
        if (occupancy != null) {
            check(homeTaskUUID(occupancy["id"] as? String) && occupancy["user_id"] == claim["user_id"] && occupancy["is_active"] is Boolean)
            check(listOf("role", "role_base", "age_band", "verification_status").all { nullableText(occupancy, it) })
            check(
                listOf("start_at", "end_at", "access_start_at", "access_end_at", "verified_at", "verification_expires_at").all {
                    nullableDate(occupancy, it)
                },
            )
        }
        return HomeResidencyCurrentReview(scope.homeId, scope.actorId, checkNotNull(sessionScope), claim, occupancy)
    }

    /** Returns canonical, whitelisted proof; current rows and server diagnostics are excluded. */
    fun receipt(
        json: String,
        draft: PendingHomeResidencyReview,
    ): String = receipt(objectFrom(json), draft)

    fun receipt(
        row: Map<String, Any?>,
        draft: PendingHomeResidencyReview,
    ): String {
        val original = objectFrom(draft.requestJson)
        check(homeTaskUUID(row["id"] as? String) && row["home_id"] == draft.scope.homeId && row["claim_id"] == draft.claimId)
        check(row["actor_id"] == draft.scope.actorId && row["request_id"] == draft.requestId && row["action"] == draft.action.wire)
        check(row["review_token"] == original["review_token"] && reviewHash(row["review_token"]) && reviewHash(row["request_hash"]))
        check(row["legacy_request"] == false && postalDate(row["created_at"] as? String))
        val result = nested(row["result"])
        check(result["status"] == if (draft.action == HomeResidencyDecision.Approve) "verified" else "rejected")
        check(postalDate(result["reviewed_at"] as? String) && nullableText(result, "role_base"))
        check(result.containsKey("occupancy_id") && (result["occupancy_id"] == null || homeTaskUUID(result["occupancy_id"] as? String)))
        val projected = RECEIPT_FIELDS.associateWith { row[it] }.toMutableMap()
        projected["result"] = listOf("status", "reviewed_at", "occupancy_id", "role_base").associateWith { result[it] }
        // Null result fields are part of the validated historical contract.
        return objects.serializeNulls().toJson(projected)
    }

    fun nested(value: Any?): Map<String, Any?> {
        val row = value as? Map<*, *> ?: error("Expected a residency review object")
        check(row.keys.all { it is String })
        return row.entries.associate { (key, item) -> key as String to item }
    }

    private fun nullableText(
        row: Map<String, Any?>,
        key: String,
    ): Boolean = row.containsKey(key) && (row[key] == null || row[key] is String)

    private fun nullableDate(
        row: Map<String, Any?>,
        key: String,
    ): Boolean = row.containsKey(key) && (row[key] == null || postalDate(row[key] as? String))

    companion object {
        const val MAX_REASON = 2000
        private val RECEIPT_FIELDS =
            listOf(
                "id", "home_id", "claim_id", "actor_id", "request_id", "action",
                "review_token", "legacy_request", "request_hash", "created_at",
            )

        fun reviewHash(value: Any?): Boolean = value is String && value.matches(Regex("^[a-f0-9]{64}$"))
    }
}
