package app.pantopus.android.data.homes

import com.squareup.moshi.Moshi
import com.squareup.moshi.Types
import java.nio.ByteBuffer
import java.nio.charset.CodingErrorAction
import java.time.LocalDate
import java.util.Base64

/** Strict fresh history data, separate from the protected-original decision codec. */
class HomeResidencyReviewHistoryCodec(moshi: Moshi) {
    private val objects = moshi.adapter<Map<String, Any?>>(Types.newParameterizedType(Map::class.java, String::class.java, Any::class.java))

    fun objectFrom(json: String): Map<String, Any?> = checkNotNull(objects.fromJson(json))

    fun session(value: Any?, actorId: String): HomeResidencyHistorySession {
        val row = objectValue(value)
        check(uuid(actorId) && row["actor_id"] == actorId)
        val session = row["session_scope"] as? String
        check(session?.matches(SESSION) == true)
        return HomeResidencyHistorySession(actorId, checkNotNull(session))
    }

    fun page(
        json: String,
        homeId: String,
        session: HomeResidencyHistorySession,
        after: HomeResidencyHistoryCursor?,
    ): HomeResidencyHistoryPage {
        val row = envelope(json, homeId, session)
        val values = row["items"] as? List<*> ?: error("History items must be an array")
        check(values.size <= PAGE_SIZE)
        val items = values.map { item(it, homeId, session.actorId) }
        check(items.map { it.id }.toSet().size == items.size)
        val anchor = after?.let { cursor(it.encoded, homeId, session.actorId).also { verified -> check(verified == it) } }
        items.forEachIndexed { index, value ->
            val previousTime = if (index == 0) anchor?.createdAt else items[index - 1].createdAt
            val previousId = if (index == 0) anchor?.id else items[index - 1].id
            if (previousTime != null && previousId != null) check(earlier(value.createdAt, value.id, previousTime, previousId))
        }
        check(row.containsKey("next_cursor"))
        val next = row["next_cursor"]?.let {
            check(it is String)
            cursor(it, homeId, session.actorId).also { next ->
                check(items.size == PAGE_SIZE && items.last().id == next.id && items.last().createdAt == next.createdAt)
            }
        }
        return HomeResidencyHistoryPage(items, next)
    }

    fun detail(json: String, reference: HomeResidencyHistoryReference, session: HomeResidencyHistorySession): HomeResidencyHistoryItem {
        check(uuid(reference.receiptId) && reference.actorId == session.actorId)
        return item(envelope(json, reference.homeId, session)["item"], reference.homeId, session.actorId).also {
            check(it.id == reference.receiptId)
        }
    }

    fun cursor(encoded: String, homeId: String, actorId: String): HomeResidencyHistoryCursor {
        check(uuid(homeId) && uuid(actorId) && encoded.length in 1..MAX_CURSOR && encoded.matches(BASE64))
        val bytes = Base64.getUrlDecoder().decode(encoded)
        val text = Charsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT)
            .decode(ByteBuffer.wrap(bytes)).toString()
        val row = objectFrom(text)
        check(row.keys == setOf("version", "actor_id", "home_id", "created_at", "id"))
        check(row["version"] == 1.0 && row["actor_id"] == actorId && row["home_id"] == homeId)
        val created = row["created_at"] as? String
        val id = row["id"] as? String
        check(timestamp(created, canonical = true) && uuid(id))
        val canonical = "{\"version\":1,\"actor_id\":\"$actorId\",\"home_id\":\"$homeId\",\"created_at\":\"$created\",\"id\":\"$id\"}"
        check(text == canonical && Base64.getUrlEncoder().withoutPadding().encodeToString(bytes) == encoded)
        return HomeResidencyHistoryCursor(encoded, checkNotNull(created), checkNotNull(id))
    }

    private fun envelope(json: String, homeId: String, expected: HomeResidencyHistorySession): Map<String, Any?> {
        val row = objectFrom(json)
        check(uuid(homeId) && row["home_id"] == homeId && row["actor_id"] == expected.actorId)
        check(session(row["session"], expected.actorId) == expected)
        return row
    }

    private fun item(value: Any?, homeId: String, actorId: String): HomeResidencyHistoryItem {
        val row = objectValue(value)
        val decision = objectValue(row["decision"])
        val result = objectValue(decision["result"])
        val current = objectValue(row["current"])
        val id = decision["id"] as? String
        val claim = decision["claim_id"] as? String
        val action = decision["action"] as? String
        val created = decision["created_at"] as? String
        check(uuid(id) && uuid(claim) && decision["home_id"] == homeId && decision["actor_id"] == actorId)
        check(action in setOf("approve", "reject") && timestamp(created, canonical = true) && decision["legacy_request"] is Boolean)
        val status = result["status"] as? String
        val reviewed = result["reviewed_at"] as? String
        check(status == if (action == "approve") "verified" else "rejected")
        check(timestamp(reviewed) && nullable(result, "occupancy_id") { uuid(it as? String) })
        check(nullable(result, "role_base") { it is String && it in ROLES })
        val occupancy = result["occupancy_id"] as? String
        val role = result["role_base"] as? String
        check(if (action == "approve") uuid(occupancy) else occupancy == null && role == null)
        val claimStatus = current["claim_status"] as? String
        check(claimStatus in setOf("pending", "verified", "rejected"))
        check(current["applicant_lookup"] == "current_claim_reference" && current["household_access"] == "not_checked")
        check(current.containsKey("applicant"))
        val applicant = current["applicant"]?.let {
            val profile = objectValue(it)
            val profileId = profile["id"] as? String
            check(uuid(profileId) && profile.containsKey("name") && profile["name"] == null)
            check(nullable(profile, "username") { name -> name is String && name.length <= MAX_USERNAME })
            HomeResidencyHistoryApplicant(checkNotNull(profileId), profile["username"] as? String)
        }
        return HomeResidencyHistoryItem(
            checkNotNull(id), homeId, checkNotNull(claim), actorId, checkNotNull(action), checkNotNull(created),
            decision["legacy_request"] as Boolean, checkNotNull(status), checkNotNull(reviewed), occupancy, role,
            checkNotNull(claimStatus), applicant,
        )
    }

    private fun objectValue(value: Any?): Map<*, *> = (value as? Map<*, *>)?.also { check(it.keys.all { key -> key is String }) }
        ?: error("History must contain objects")

    private fun nullable(row: Map<*, *>, key: String, valid: (Any) -> Boolean): Boolean =
        row.containsKey(key) && (row[key] == null || valid(checkNotNull(row[key])))

    companion object {
        const val PAGE_SIZE = 20
        private const val MAX_CURSOR = 600
        private const val MAX_USERNAME = 100
        private val UUID = Regex("^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$")
        private val SESSION = Regex("^[a-f0-9]{64}$")
        private val BASE64 = Regex("^[A-Za-z0-9_-]+$")
        private val DATE = Regex("^(\\d{4})-(\\d{2})-(\\d{2})T(\\d{2}):(\\d{2}):(\\d{2})(?:\\.(\\d{1,6}))?(Z|[+-]\\d{2}:\\d{2})$")
        private val CANONICAL_DATE = Regex("^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{6}Z$")
        val ROLES = setOf("owner", "admin", "manager", "member", "restricted_member", "guest", "lease_resident", "service_provider")

        fun uuid(value: String?): Boolean = value?.matches(UUID) == true

        fun earlier(time: String, id: String, previousTime: String, previousId: String): Boolean =
            time < previousTime || (time == previousTime && id < previousId)

        fun timestamp(value: String?, canonical: Boolean = false): Boolean = runCatching {
            val match = DATE.matchEntire(value ?: return false) ?: return false
            if (canonical && !CANONICAL_DATE.matches(value)) return false
            val parts = match.groupValues.drop(1).take(6).map(String::toInt)
            check(parts[0] > 0 && parts[3] < 24 && parts[4] < 60 && parts[5] < 60)
            LocalDate.of(parts[0], parts[1], parts[2])
            val offset = match.groupValues[8]
            if (offset != "Z") check(offset.substring(1, 3).toInt() < 24 && offset.substring(4, 6).toInt() < 60)
            true
        }.getOrDefault(false)
    }
}
