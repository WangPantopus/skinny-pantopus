package app.pantopus.android.data.homes

import com.squareup.moshi.Moshi
import com.squareup.moshi.Types

class HomeInvitationDecisionCodec(moshi: Moshi) {
    private val objects =
        moshi.adapter<Map<String, Any?>>(Types.newParameterizedType(Map::class.java, String::class.java, Any::class.java))
            .serializeNulls()
    private val requests = moshi.adapter(HomeInvitationDecisionRequest::class.java).failOnUnknown()

    fun objectFrom(json: String): Map<String, Any?> = checkNotNull(objects.fromJson(json))

    fun encode(request: HomeInvitationDecisionRequest): String = requests.toJson(request)

    fun cancel(request: HomeInvitationDecisionRequest): String =
        objects.toJson(
            objectFrom(encode(request)).filterKeys { it != "request_id" },
        )

    fun valid(
        draft: PendingHomeInvitationDecision,
        scope: HomeCreationScope,
    ): Boolean =
        runCatching {
            draft.scope == scope && scope.isValid() && draft.homeLabel.length <= 1000 && draft.request.isValid() &&
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
    ): HomeInvitationDecisionContext {
        val fields = objectFrom(json)
        check(session(fields["session"], scope) == expectedSession)
        val homeId = fields["home_id"] as? String
        val invitationId = fields["invitation_id"] as? String
        check(homeTaskUUID(homeId) && homeTaskUUID(invitationId) && HomeResidencyReviewCodec.reviewHash(fields["decision_token"]))
        val preview = nested(fields["preview"])
        check(validPreview(preview))
        val home = nested(preview["home"])
        val invite = nested(preview["invitation"])
        val inviter = nested(preview["inviter"])
        check(home["id"] == homeId && invite["id"] == invitationId && invite["status"] == "pending")
        return HomeInvitationDecisionContext(
            checkNotNull(homeId), checkNotNull(invitationId), fields["decision_token"] as String,
            home["name"] as String, home["city"] as String, inviter["name"] as String, invite["proposed_role"] as String,
            invite["access_start_at"] as? String, invite["access_end_at"] as? String, invite["expires_at"] as? String,
        ).also { check(it.isFresh()) }
    }

    fun validPreview(row: Map<String, Any?>): Boolean =
        runCatching {
            val invite = nested(row["invitation"])
            val status = invite["status"] as? String
            if (!homeTaskUUID(invite["id"] as? String) || status !in setOf("pending", "accepted", "expired", "revoked")) return false
            if (!listOf("expired", "alreadyUsed").all { !row.containsKey(it) || row[it] is Boolean }) return false
            if (status != "pending") {
                return !row.containsKey("home") && !row.containsKey("inviter") &&
                    row["expired"] == (status == "expired") && row["alreadyUsed"] == (status == "accepted")
            }
            validPendingPreview(row, invite)
        }.getOrDefault(false)

    private fun validPendingPreview(
        row: Map<String, Any?>,
        invite: Map<String, Any?>,
    ): Boolean {
        val home = nested(row["home"])
        val inviter = nested(row["inviter"])
        return row["expired"] != true && row["alreadyUsed"] != true && homeTaskUUID(home["id"] as? String) &&
            home["name"] is String && home["city"] is String && nullableText(home, "home_type") &&
            (invite["proposed_role"] as? String)?.isNotBlank() == true && postalDate(invite["created_at"] as? String) &&
            nullableDate(invite, "expires_at") &&
            listOf("access_start_at", "access_end_at").all { !invite.containsKey(it) || nullableDate(invite, it) } &&
            inviter["name"] is String && listOf("username", "profilePicture").all { nullableText(inviter, it) }
    }

    /** Parse a matching result and discard session identifiers and unrecognized fields before persistence. */
    fun outcome(
        json: String,
        draft: PendingHomeInvitationDecision,
    ): HomeInvitationDecisionOutcome {
        val row = objectFrom(json)
        val state = row["state"] as? String
        val request = draft.request
        check(state in setOf("pending", "completed", "rejected", "cancelled"))
        check(row["home_id"] == request.homeId && row["invitation_id"] == request.invitationId && row["action"] == request.action)
        check(row["decision_token"] == request.decisionToken && row["current_access"] == "not_checked")
        val command = nested(row["command"])
        check(command["actor_id"] == draft.scope.actorId && command["request_id"] == request.requestId)
        check(listOf("created_at", "updated_at").all { postalDate(command[it] as? String) })
        check(row.containsKey("occupancy_id"))
        if (state == "completed" && request.action == "accept") {
            check(homeTaskUUID(row["occupancy_id"] as? String))
        } else {
            check(row["occupancy_id"] == null)
        }
        val code = row["code"] as? String
        if (state == "rejected") {
            check(code?.matches(Regex("^[A-Z][A-Z0-9_]{1,79}$")) == true)
        } else {
            check(!row.containsKey("code"))
        }
        val projected = row.filterKeys { it in RESULT_FIELDS }.toMutableMap()
        projected["command"] = command.filterKeys { it in setOf("actor_id", "request_id", "created_at", "updated_at") }
        return HomeInvitationDecisionOutcome(checkNotNull(state), code, objects.toJson(projected))
    }

    private fun nested(value: Any?): Map<String, Any?> {
        val row = value as? Map<*, *> ?: error("Expected an invitation object")
        check(row.keys.all { it is String })
        return row.entries.associate { (key, value) -> key as String to value }
    }

    private fun nullableText(
        row: Map<String, Any?>,
        key: String,
    ): Boolean = row.containsKey(key) && (row[key] == null || row[key] is String)

    private fun nullableDate(
        row: Map<String, Any?>,
        key: String,
    ): Boolean = row.containsKey(key) && (row[key] == null || postalDate(row[key] as? String))

    private companion object {
        val RESULT_FIELDS = setOf("state", "home_id", "invitation_id", "action", "decision_token", "occupancy_id", "current_access", "code")
    }
}
