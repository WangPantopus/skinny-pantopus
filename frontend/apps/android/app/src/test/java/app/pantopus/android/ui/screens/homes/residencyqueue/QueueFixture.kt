package app.pantopus.android.ui.screens.homes.residencyqueue

import app.pantopus.android.data.homes.HomeResidencyQueueCodec
import app.pantopus.android.data.homes.HomeResidencyQueueSession
import com.squareup.moshi.Moshi

internal class QueueFixture {
    val home = "00000000-0000-4000-8000-000000000001"
    val actor = "00000000-0000-4000-8000-000000000002"
    val user = "00000000-0000-4000-8000-000000000003"
    val id = "00000000-0000-4000-8000-000000000004"
    val scope = HomeResidencyQueueSession(actor, "a".repeat(64))
    private val moshi = Moshi.Builder().build()
    val codec = HomeResidencyQueueCodec(moshi)

    fun item(): Map<String, Any?> =
        mapOf(
            "id" to id,
            "home_id" to home,
            "user_id" to user,
            "status" to "pending",
            "created_at" to "2026-09-13T01:02:03.123456Z",
            "claimed_role" to "renter",
            "claimant" to mapOf("id" to user, "username" to "public_handle", "name" to null),
        )

    fun envelope(claims: List<Map<String, Any?>> = listOf(item())): Map<String, Any?> =
        mapOf(
            "home_id" to home,
            "actor_id" to actor,
            "claims" to claims,
            "residency_session" to mapOf("home_id" to home, "actor_id" to actor, "session_scope" to scope.sessionScope),
        )

    fun json(value: Any): String = moshi.adapter(Any::class.java).serializeNulls().toJson(value)

    fun page(): String = json(envelope())

    fun decoded() = codec.page(page(), home, scope)
}
