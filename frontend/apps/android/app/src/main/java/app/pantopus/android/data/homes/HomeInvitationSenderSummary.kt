package app.pantopus.android.data.homes

/** Show the prepared recipient and access terms, rejecting malformed identity or dates. */
internal fun senderInvitationSummary(
    invite: Map<String, Any?>,
    intent: HomeInvitationSenderIntent,
): String {
    check(invite["id"] == intent.invitationId && invite["home_id"] == intent.homeId && invite["status"] == "pending")
    check(listOf("proposed_role", "proposed_role_base", "proposed_preset_key").all { invite[it] == null || invite[it] is String })
    val role = invite["proposed_role_base"] as? String ?: invite["proposed_role"] as? String
    check(!role.isNullOrBlank())
    val recipient = senderRecipientSummary(invite)
    val dates =
        listOf("access_start_at", "access_end_at", "expires_at").associateWith { key ->
            check(invite.containsKey(key) && (invite[key] == null || postalDate(invite[key] as? String)))
            invite[key] as? String
        }
    return listOfNotNull(
        recipient,
        "Role: $role",
        (invite["proposed_preset_key"] as? String)?.let {
            if (it.startsWith("access_request:")) "Household approval" else "Permission preset: $it"
        },
        dates["access_start_at"]?.let { "Access begins: $it" },
        dates["access_end_at"]?.let { "Access ends: $it" },
        dates["expires_at"]?.let { "Invitation expires: $it" },
    ).joinToString("\n")
}

private fun senderRecipientSummary(invite: Map<String, Any?>): String {
    val email = invite["invitee_email"] as? String
    val userId = invite["invitee_user_id"] as? String
    val profile = invite["invitee"] as? Map<*, *>
    if (invite["invitee"] != null) {
        check(profile != null && homeTaskUUID(userId) && profile["id"] == userId)
        check(listOf("username", "name").all { profile[it] == null || profile[it] is String })
    }
    val username = (profile?.get("username") as? String)?.takeIf(String::isNotBlank)?.let { "@$it" }
    val name = (profile?.get("name") as? String)?.takeIf(String::isNotBlank)
    val label = listOfNotNull(name, username).joinToString(" ").takeIf(String::isNotBlank)
    val recipient = listOfNotNull(label, email).joinToString("\n").takeIf(String::isNotBlank)
    if (recipient != null) return recipient
    check(invite["is_open_invite"] == true || homeTaskUUID(userId))
    return if (invite["is_open_invite"] == true) "Open household invitation" else "Account: $userId"
}
