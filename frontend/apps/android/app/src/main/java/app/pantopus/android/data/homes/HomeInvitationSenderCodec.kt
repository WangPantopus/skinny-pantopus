package app.pantopus.android.data.homes

import com.squareup.moshi.Moshi
import com.squareup.moshi.Types

class HomeInvitationSenderCodec(moshi: Moshi) {
    private val objects =
        moshi.adapter<Map<String, Any?>>(
            Types.newParameterizedType(Map::class.java, String::class.java, Any::class.java),
        ).serializeNulls()

    fun objectFrom(json: String): Map<String, Any?> = checkNotNull(objects.fromJson(json))

    fun intent(intent: HomeInvitationSenderIntent): String = objects.toJson(intentFields(intent))

    fun encode(request: HomeInvitationSenderRequest): String =
        objects.toJson(
            linkedMapOf<String, Any?>("request_id" to request.requestId, "token" to request.token).apply {
                putAll(intentFields(request.intent))
                put("decision_token", request.decisionToken)
            },
        )

    fun cancel(draft: PendingHomeInvitationSender): String = objects.toJson(objectFrom(draft.requestJson).filterKeys { it != "request_id" })

    fun valid(
        draft: PendingHomeInvitationSender,
        scope: HomeCreationScope,
    ): Boolean =
        runCatching {
            draft.scope == scope && scope.isValid() && draft.summary.length <= MAX_SUMMARY && draft.request.isValid() &&
                encode(draft.request) == draft.requestJson &&
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
        intent: HomeInvitationSenderIntent,
    ): HomeInvitationSenderContext {
        val row = objectFrom(json)
        check(session(row["session"], scope) == expectedSession)
        check(
            row["home_id"] == intent.homeId && row["action"] == intent.action && HomeResidencyReviewCodec.reviewHash(row["decision_token"]),
        )
        val summary =
            if (intent.action == "create") {
                check(row.containsKey("invitation") && row["invitation"] == null)
                val payload = checkNotNull(intent.payload)
                listOfNotNull(
                    payload["email"] ?: payload["username"] ?: payload["user_id"],
                    payload["relationship"],
                    payload["message"],
                ).joinToString("\n")
            } else {
                senderInvitationSummary(nested(row["invitation"]), intent)
            }
        check(summary.length <= MAX_SUMMARY)
        return HomeInvitationSenderContext(
            intent,
            row["decision_token"] as String,
            summary,
            if (intent.action == "create") null else nested(row["invitation"])["expires_at"] as? String,
        )
    }

    /** Persist only allowlisted historical proof; never session identifiers, recipient data or server capability fields. */
    fun outcome(
        json: String,
        draft: PendingHomeInvitationSender,
    ): HomeInvitationSenderOutcome {
        val row = objectFrom(json)
        val request = draft.request
        val state = row["state"] as? String
        check(state in setOf("pending", "completed", "rejected", "cancelled"))
        check(
            row["home_id"] == request.intent.homeId && row["action"] == request.intent.action &&
                row["decision_token"] == request.decisionToken,
        )
        val invitationId = receiptInvitation(row, request, state)
        val command = receiptCommand(row["command"], draft)
        val delivery = receiptDelivery(row["delivery"], request, state)
        val code = row["code"] as? String
        if (state == "rejected") check(code?.matches(Regex("^[A-Z][A-Z0-9_]{1,79}$")) == true) else check(!row.containsKey("code"))
        val projected = row.filterKeys { it in RESULT_FIELDS }.toMutableMap()
        projected["command"] = command.filterKeys { it in setOf("actor_id", "request_id", "created_at", "updated_at") }
        projected["delivery"] = delivery.filterKeys { it in setOf("email", "in_app") }
        return HomeInvitationSenderOutcome(
            checkNotNull(state),
            code,
            invitationId,
            delivery["email"] as String,
            delivery["in_app"] as String,
            objects.toJson(projected),
        )
    }

    private fun receiptInvitation(
        row: Map<String, Any?>,
        request: HomeInvitationSenderRequest,
        state: String?,
    ): String? {
        val invitationId = row["invitation_id"] as? String
        check(row.containsKey("invitation_id") && (row["invitation_id"] == null || homeTaskUUID(invitationId)))
        if (request.intent.action != "create") check(invitationId == request.intent.invitationId)
        if (state == "completed") check(homeTaskUUID(invitationId))
        return invitationId
    }

    private fun receiptCommand(
        value: Any?,
        draft: PendingHomeInvitationSender,
    ): Map<String, Any?> {
        val command = nested(value)
        check(command["actor_id"] == draft.scope.actorId && command["request_id"] == draft.request.requestId)
        check(listOf("created_at", "updated_at").all { postalDate(command[it] as? String) })
        return command
    }

    private fun receiptDelivery(
        value: Any?,
        request: HomeInvitationSenderRequest,
        state: String?,
    ): Map<String, Any?> {
        val delivery = nested(value)
        check(delivery["email"] in setOf("not_requested", "unconfirmed", "provider_accepted"))
        check(delivery["in_app"] in setOf("not_requested", "unconfirmed", "saved"))
        if (state != "completed" || request.intent.action == "withdraw") {
            check(delivery["email"] == "not_requested" && delivery["in_app"] == "not_requested")
        }
        return delivery
    }

    private fun intentFields(intent: HomeInvitationSenderIntent): Map<String, Any?> =
        linkedMapOf<String, Any?>("home_id" to intent.homeId, "action" to intent.action).apply {
            if (intent.action == "create") put("payload", intent.payload) else put("invitation_id", intent.invitationId)
        }

    private fun nested(value: Any?): Map<String, Any?> {
        val row = value as? Map<*, *> ?: error("Expected an invitation object")
        check(row.keys.all { it is String })
        return row.entries.associate { (key, value) -> key as String to value }
    }

    private companion object {
        const val MAX_SUMMARY = 12000
        val RESULT_FIELDS = setOf("state", "home_id", "invitation_id", "action", "decision_token", "code")
    }
}
