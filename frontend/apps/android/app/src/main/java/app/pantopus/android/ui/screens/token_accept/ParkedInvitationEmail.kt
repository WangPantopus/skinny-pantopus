@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.token_accept

import app.pantopus.android.core.routing.PendingDeepLinkStore
import app.pantopus.android.data.api.services.TokenAcceptApi

/**
 * An emailed household invitation only works for the address it was sent to. When someone opens one while
 * signed out, the link waits in [PendingDeepLinkStore] until they sign in, so sign-up can start with that
 * address instead of an empty field (as the web does from the invite page).
 */
internal suspend fun parkedInvitationEmail(api: TokenAcceptApi): String? {
    val token = parkedInvitationToken(PendingDeepLinkStore.peek()) ?: return null
    val preview = runCatching { api.homeInvite(token) }.getOrNull() ?: return null
    if (preview.invitation?.status != "pending" || preview.expired == true) return null
    return preview.invitation.inviteeEmail?.trim()?.takeIf { '@' in it }
}

/** The token of a parked `pantopus://invite/<token>` link (lease invitations aren't household ones). */
internal fun parkedInvitationToken(path: String?): String? {
    val prefix = "pantopus://invite/"
    if (path == null || !path.startsWith(prefix)) return null
    val token = path.removePrefix(prefix).takeWhile { it != '/' && it != '?' && it != '#' }
    return token.takeIf { TOKEN.matches(it) }
}

private val TOKEN = Regex("^[A-Za-z0-9]{16,128}$")
