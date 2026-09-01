@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.guests

import app.pantopus.android.ui.components.InviteLinks

/**
 * A13.6 — Share payload for a freshly-issued guest pass.
 *
 * `POST /api/homes/:id/guest-passes` (route `backend/routes/homeIam.js:667`)
 * returns `{ pass, token }` — the raw share secret is handed back exactly
 * once and the response carries **no** `share_url` / `url` field. The
 * viewer link is therefore composed here from the public guest page the
 * web app serves at `/guest/:token`
 * (`pantopus/frontend/apps/web/src/app/guest/[token]/page.tsx`), which
 * resolves the token through `GET /api/homes/guest/:token`
 * (route `backend/routes/homeGuest.js:20`).
 *
 * Because the token is never returned again, sharing is only possible in
 * the moment right after creation — exactly as RN does in
 * `src/app/homes/[id]/share.tsx:60-82`. Rows in the guest-pass list carry
 * no token and therefore expose revoke only.
 *
 * Field-for-field parity with iOS `GuestPassShare.swift`.
 */
data class GuestPassShare(
    val id: String,
    val guestName: String,
    val url: String,
) {
    /** RN parity — `src/app/homes/[id]/share.tsx:76-82`. */
    val message: String
        get() {
            val opener = if (guestName.isEmpty()) "Here's" else "Hi $guestName, here's"
            return "$opener your guest access to our home: $url"
        }

    companion object {
        /**
         * Public guest-viewer link for a raw create-response token. The
         * host comes from [InviteLinks.DOWNLOAD_URL] so there is one place
         * to swap when the marketing / web origin changes.
         */
        fun urlForToken(token: String): String = "${InviteLinks.DOWNLOAD_URL}/guest/$token"
    }
}
