@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.gigs.checkout

/** One SDK launcher per account/session/API and gig, including another screen instance. */
class GigBidCheckoutAdmission {
    private val active = mutableMapOf<Pair<GigCheckoutIdentity, String>, String>()

    @Synchronized
    fun claim(
        identity: GigCheckoutIdentity,
        gigId: String,
        token: String,
    ): Boolean {
        val key = identity to gigId
        if (active[key] != null && active[key] != token) return false
        active[key] = token
        return true
    }

    @Synchronized
    fun release(token: String) {
        active.entries.removeAll { it.value == token }
    }

    companion object {
        val shared = GigBidCheckoutAdmission()
    }
}
