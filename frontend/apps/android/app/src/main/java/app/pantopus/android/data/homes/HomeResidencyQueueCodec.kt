package app.pantopus.android.data.homes

import com.squareup.moshi.Moshi
import com.squareup.moshi.Types
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import java.time.format.ResolverStyle

/** Only safe current references enter queue state. Invalid or missing data never means empty. */
class HomeResidencyQueueCodec(moshi: Moshi) {
    private val objects = moshi.adapter<Map<String, Any?>>(Types.newParameterizedType(Map::class.java, String::class.java, Any::class.java))

    fun objectFrom(json: String): Map<String, Any?> = checkNotNull(objects.fromJson(json))

    fun session(
        value: Any?,
        actorId: String,
    ): HomeResidencyQueueSession {
        val row = fields(value, setOf("actor_id", "session_scope"))
        check(uuid(actorId) && row["actor_id"] == actorId)
        val proof = row["session_scope"] as? String
        check(proof?.matches(SESSION) == true)
        return HomeResidencyQueueSession(actorId, checkNotNull(proof))
    }

    fun bootstrap(
        json: String,
        actorId: String,
    ): HomeResidencyQueueSession = session(fields(objectFrom(json), setOf("session"))["session"], actorId)

    fun page(
        json: String,
        homeId: String,
        expected: HomeResidencyQueueSession,
    ): HomeResidencyQueuePage {
        val row = fields(objectFrom(json), setOf("home_id", "actor_id", "claims", "residency_session"))
        check(uuid(homeId) && row["home_id"] == homeId && row["actor_id"] == expected.actorId)
        val binding = fields(row["residency_session"], setOf("home_id", "actor_id", "session_scope"))
        check(binding["home_id"] == homeId)
        check(session(binding.filterKeys { it != "home_id" }, expected.actorId) == expected)
        val claims = (row["claims"] as? List<*>)?.map { claim(it, homeId) } ?: error("Claims must be a collection")
        check(claims.map { it.id }.toSet().size == claims.size && claims.map { it.userId }.toSet().size == claims.size)
        claims.zipWithNext().forEach { (previous, current) -> check(earlier(current, previous)) }
        return HomeResidencyQueuePage(claims)
    }

    private fun claim(
        value: Any?,
        homeId: String,
    ): HomeResidencyQueueClaim {
        val row = fields(value, setOf("id", "home_id", "user_id", "status", "created_at", "claimed_role", "claimant"))
        val id = row["id"] as? String
        val userId = row["user_id"] as? String
        check(uuid(id) && uuid(userId) && row["home_id"] == homeId && row["status"] == "pending")
        val created = row["created_at"]
        check(created == null || created is String && timestamp(created))
        val role = row["claimed_role"]
        check(role == null || role in setOf("household", "renter"))
        val username =
            row["claimant"]?.let {
                val person = fields(it, setOf("id", "username", "name"))
                check(person["id"] == userId && person["name"] == null)
                val name = person["username"]
                check(name == null || name is String && name.length <= MAX_USERNAME)
                name as? String
            }
        return HomeResidencyQueueClaim(checkNotNull(id), checkNotNull(userId), username, role as? String, created as? String)
    }

    private fun fields(
        value: Any?,
        keys: Set<String>,
    ): Map<*, *> = (value as? Map<*, *>)?.also { check(it.keys == keys) } ?: error("Expected exact fields")

    companion object {
        private const val MAX_USERNAME = 100
        private val UUID = Regex("^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$")
        private val SESSION = Regex("^[a-f0-9]{64}$")
        private val DATE = Regex("^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\\.[0-9]{6}Z$")
        private val DATE_FORMAT = DateTimeFormatter.ofPattern("uuuu-MM-dd'T'HH:mm:ss.SSSSSS'Z'").withResolverStyle(ResolverStyle.STRICT)

        fun uuid(value: String?): Boolean = value?.matches(UUID) == true

        fun timestamp(value: String): Boolean =
            value.matches(DATE) &&
                runCatching {
                    LocalDateTime.parse(value, DATE_FORMAT).year > 0
                }.getOrDefault(false)

        fun earlier(
            current: HomeResidencyQueueClaim,
            previous: HomeResidencyQueueClaim,
        ): Boolean =
            when {
                current.createdAt == previous.createdAt -> current.id < previous.id
                current.createdAt == null -> true
                previous.createdAt == null -> false
                else -> current.createdAt < previous.createdAt
            }
    }
}
