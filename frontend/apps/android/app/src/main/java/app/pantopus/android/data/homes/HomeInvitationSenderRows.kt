package app.pantopus.android.data.homes

import app.pantopus.android.data.api.models.homes.PendingInviteDto

fun homeInvitationSenderRows(
    value: Any?,
    homeId: String,
): List<PendingInviteDto> {
    check(homeTaskUUID(homeId))
    val rows = value as? List<*> ?: error("Expected the current invitation list")
    val result =
        rows.map { item ->
            val row = item as? Map<*, *> ?: error("Expected an invitation")
            val id = row["id"] as? String
            check(homeTaskUUID(id) && row["home_id"] == homeId && row["status"] == "pending")
            check(postalDate(row["created_at"] as? String))
            check(row["expires_at"] == null || postalDate(row["expires_at"] as? String))
            val user = row["invitee"] as? Map<*, *>
            val userId = row["invitee_user_id"] as? String
            check(row["invitee_user_id"] == null || homeTaskUUID(userId))
            if (row["invitee"] != null) check(user != null && user["id"] == userId)
            val email = row["invitee_email"] as? String
            check(row["invitee_email"] == null || email != null)
            val username = (user?.get("username") as? String)?.takeIf(String::isNotBlank)?.let { "@$it" }
            val name = (user?.get("name") as? String)?.takeIf(String::isNotBlank)
            val label = email ?: listOfNotNull(name, username).joinToString(" ").takeIf(String::isNotBlank)
            PendingInviteDto(
                id = checkNotNull(id),
                userId = userId,
                email = email,
                name = label ?: if (row["is_open_invite"] == true) "Open household invitation" else "Invited account",
                role = senderRowRole(row),
                invitedBy = row["invited_by"] as? String,
                createdAt = row["created_at"] as? String,
                expiresAt = row["expires_at"] as? String,
            )
        }
    check(result.map { it.id }.toSet().size == result.size)
    return result
}

private fun senderRowRole(row: Map<*, *>): String {
    check(listOf("proposed_role", "proposed_role_base", "proposed_preset_key").all { row[it] == null || row[it] is String })
    val role = row["proposed_role_base"] as? String ?: row["proposed_role"] as? String
    check(!role.isNullOrBlank())
    val profile = row["invitee"] as? Map<*, *>
    if (profile != null) check(listOf("name", "username").all { profile[it] == null || profile[it] is String })
    return role
}
