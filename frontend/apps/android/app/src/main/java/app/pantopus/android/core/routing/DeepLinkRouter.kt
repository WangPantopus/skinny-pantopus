@file:Suppress("PackageNaming")

package app.pantopus.android.core.routing

import android.net.Uri
import app.pantopus.android.data.auth.OAuthSessionStore
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Mirrors iOS `Core/Routing/DeepLinkRouter.swift`. The host activity
 * pushes Uri instances in via [handle]; observers collect [pending]
 * and call [consume] when they've routed it.
 *
 * The router accepts `pantopus://…`, `https://pantopus.com/…` and
 * `https://pantopus.app/…`. Resolution is host-agnostic — only the path
 * segments matter — so this needed no change when `pantopus.com` became the
 * verified App Links host; the manifest and assetlinks.json carry that.
 *
 * Full routing table from `docs/07-frontend-mobile-app.md §9`.
 * `Home` (singular) keeps the legacy "go to Hub" semantics; the typed
 * `HomeDetail` / `HomeDashboard` / `HomeMemberRequests` variants
 * cover `/homes/:id/[*]`.
 *
 * Workstream 1.4 — when signed out, content destinations are persisted
 * via [PendingDeepLinkStore] for one-shot post-login replay. OAuth
 * callback, auth reset/verify, and [Destination.Unknown] are never stashed.
 */
object DeepLinkRouter {
    /**
     * How a resolved destination should be handled relative to auth.
     */
    private enum class RoutingKind {
        /** OAuth callback / Unknown — never stash, never park as content. */
        Discard,

        /** Reset / verify / join-invite — auth stack owns these; never persist. */
        AuthOwned,

        /** Content. When signed out, persist for post-login replay. */
        Content,
    }

    sealed interface Destination {
        data object Feed : Destination

        data object Home : Destination

        data object Notifications : Destination

        data object Connections : Destination

        /** `pantopus://beacons` — A03.2 Beacon Updates feed (`surface=personas`). */
        data object Beacons : Destination

        data object DiscoverHub : Destination

        /** `pantopus://wallet` — A10.10 earnings wallet (distinct from
         *  Settings → Payments; this is the earnings-side surface). */
        data object Wallet : Destination

        data class SupportTrain(val id: String) : Destination

        /**
         * `pantopus://support-trains/:id/manage` — A13.13 organizer
         * surface. Reached from the A10.9 detail screen's dock
         * overflow when the viewer is the organizer, and from
         * back-of-house shortcut links. Distinct from [SupportTrain],
         * which lands on the participant detail (A10.9).
         */
        data class SupportTrainManage(val id: String) : Destination

        data class Post(val id: String) : Destination

        data class Gig(val id: String) : Destination

        data class Listing(val id: String) : Destination

        data class HomeDetail(val id: String) : Destination

        data class HomeDashboard(val id: String) : Destination

        data class HomeMemberRequests(val id: String) : Destination

        /**
         * `pantopus://homes/:id/owners/transfer` — A13.4 Transfer
         * Ownership form. Lands on the populated state; the form owns
         * its own biometric bottom sheet.
         */
        data class HomeOwnersTransfer(val id: String) : Destination

        /**
         * `pantopus://homes/:id/verify-landlord` — opens the A12.5 /
         * A12.6 wizard.
         */
        data class VerifyLandlord(val id: String) : Destination

        /**
         * `pantopus://homes/:id/verify-postcard` — opens the A12.7
         * sibling status screen directly.
         */
        data class PostcardVerification(val id: String) : Destination

        /**
         * `pantopus://chat/:roomId[?name=…]` — chat thread. `name` is an
         * optional display name for the header; chat push taps carry the
         * sender name there (appended by `NotificationDispatcher`).
         */
        data class Conversation(val id: String, val name: String? = null) : Destination

        data class User(val id: String) : Destination

        /** `pantopus://persona/:handle` or `/@handle` — public Beacon profile. */
        data class BeaconProfile(val handle: String) : Destination

        /** `pantopus://join/:code` — signup invite code (RN `/join/[code]` alias). */
        data class JoinInvite(val code: String) : Destination

        data class Invite(val token: String) : Destination

        /**
         * `pantopus://auth/reset-password?token=…` — hashed recovery
         * token from the password-reset email. The caller invokes
         * `AuthRepository.resetPassword` on submit.
         */
        data class ResetPassword(val token: String) : Destination

        /**
         * `pantopus://auth/verify-email?token=…&email=…` — hashed Supabase
         * OTP from the verification email. `email` is optional but the
         * link from the resend / signup flow carries it so the surface
         * can render the recipient.
         */
        data class VerifyEmail(val token: String, val email: String?) : Destination

        /**
         * `pantopus://mailbox/mailday` — the A13.16 My Mail Day editor.
         * Routed via the mailbox stack so Back returns to the mailbox
         * root.
         */
        data object MailDay : Destination

        /**
         * `pantopus://businesses/new` — open the A12.10 Create Business
         * wizard inside the active tab's nav stack.
         */
        data object CreateBusiness : Destination

        /**
         * `pantopus://settings/payments` — A14.6 Settings → Payments
         * (payments-out · Stripe setup · payout routing). Distinct
         * from `pantopus://wallet` (earnings-in). Consumed by the
         * active tab's deep-link router which pushes Settings then
         * forwards into the Payments route.
         */
        data object PaymentsSettings : Destination

        /**
         * A14.8 — `pantopus://mailbox/vacation` opens the Vacation hold
         * screen (scheduling or active variant depending on server state
         * once the persistence layer lands).
         */
        data object VacationHold : Destination

        // ---- B1.6 batch-2 routing seam --------------------------------------
        // Pre-registered for the batch-2 screens (B2–B5). Each resolves to the
        // NotYetAvailableView placeholder today; the screen prompts swap in
        // their real destinations without editing the route files.

        /** `pantopus://mailbox/stamps` — A17.11 Stamps / postage wallet. */
        data object Stamps : Destination

        /** `pantopus://mailbox/tasks/:id` — A17.12 mail-derived task detail. */
        data class MailTask(val taskId: String) : Destination

        /** `pantopus://mailbox/translation?id=` — A17.13 auto-translated mail. */
        data class MailTranslation(val mailId: String) : Destination

        /**
         * `pantopus://mailbox/unboxing` — A17.14 scan-first capture flow. The
         * optional `?id=` seeds the originating mail item when present.
         */
        data class Unboxing(val mailId: String?) : Destination

        /** `pantopus://mailbox/earn` — A10.11 Earn dashboard (Wallet sibling). */
        data object Earn : Destination

        /**
         * `pantopus://businesses/:id` — A10.7 Business owner view. The public
         * profile (A10.6) is the singular `pantopus://business/:username`,
         * routed to [BusinessProfile].
         */
        data class BusinessOwner(val businessId: String) : Destination

        /**
         * `pantopus://business/:username` — A10.6 public business profile
         * (singular path). Mirrors iOS `businessProfile`.
         */
        data class BusinessProfile(val businessId: String) : Destination

        /**
         * C4 — `pantopus://b/:username/:slug` (and
         * `pantopus://business/:username?pageSlug=…`): the public profile with
         * one named custom page opened. RN redirects the short link to
         * `/business/:username?pageSlug=slug`; dropping the slug here would
         * silently land the user on the plain profile. Mirrors iOS
         * `businessPage`.
         */
        data class BusinessPage(val businessId: String, val pageSlug: String) : Destination

        /**
         * `pantopus://businesses/:id/page-editor` — A13.10 Edit Business Page
         * (owner-only). Mirrors iOS `editBusinessPage`.
         */
        data class EditBusinessPage(val businessId: String) : Destination

        /** `pantopus://identity/preview` — A18.5 "View as" identity preview. */
        data object ViewAs : Destination

        /** `pantopus://homes/:id/waiting-room` — A18.4 persistent waiting room. */
        data class WaitingRoom(val homeId: String) : Destination

        /**
         * `pantopus://hub-today?deliveryId=&kind=morning|evening` — the Hub
         * "Today" briefing opened from a Morning/Evening Briefing push. The
         * notification's metadata carries `briefing_delivery_id` +
         * `briefing_kind`; with an id the screen resolves that stored delivery
         * rather than only the live `/api/hub/today` snapshot. Mirrors RN
         * `resolveNotificationRoute`'s `/hub-today?…` target
         * (`pantopus/frontend/apps/mobile/src/utils/notificationRouting.ts:18`).
         */
        data class HubToday(
            val briefingDeliveryId: String?,
            val kind: String?,
        ) : Destination

        /**
         * `pantopus://profile?tab=receipt` — the profile tab with the Monthly
         * Receipt card auto-expanded, the target RN resolves for a
         * `monthly_receipt` notification
         * (`pantopus/frontend/apps/mobile/src/utils/notificationRouting.ts:29`).
         */
        data object MonthlyReceipt : Destination

        data class Unknown(val uri: String) : Destination
    }

    private val _pending = MutableStateFlow<Destination?>(null)
    val pending: StateFlow<Destination?> = _pending.asStateFlow()

    /**
     * Set when a signed-out deep link should auto-present Sign-in
     * (auth-owned or deferred content). The signed-out Place launch host
     * observes this and opens the existing auth cover without disrupting
     * the Place funnel.
     */
    private val _prefersLoginPresentation = MutableStateFlow(false)
    val prefersLoginPresentation: StateFlow<Boolean> = _prefersLoginPresentation.asStateFlow()

    /**
     * Bound once from [app.pantopus.android.data.auth.AuthRepository] so
     * the object router can classify without Hilt.
     */
    @Volatile
    private var signedInProvider: () -> Boolean = { false }

    fun bindSignedInProvider(provider: () -> Boolean) {
        signedInProvider = provider
    }

    fun handle(uri: Uri) {
        // Browser OAuth callbacks belong to the in-flight sign-in attempt:
        // `MainActivity.forwardDeepLink` hands them to `OAuthSessionStore`
        // and never reaches here. Guarded anyway so they are never parked as
        // content destinations. Mirrors iOS `DeepLinkRouter.handle(url:)`,
        // which calls the same `AuthManager.isOAuthCallback` predicate.
        if (OAuthSessionStore.isOAuthCallback(uri)) return
        apply(
            destination = resolve(uri),
            persistencePath = Paths.normalized(uri.toString()),
        )
    }

    /**
     * Receive a raw path-style link from a notification payload (e.g.
     * `link` on `NotificationDto`). Routed through the same resolver as
     * full URL deep links.
     */
    fun handle(path: String) {
        val normalized = Paths.normalizeIncoming(path)
        if (Paths.isOAuthCallback(normalized)) return
        apply(
            destination = resolveString(normalized),
            persistencePath = Paths.normalized(normalized),
        )
    }

    fun consume(): Destination? {
        val current = _pending.value
        _pending.value = null
        return current
    }

    /** Drop in-memory pending + login prompt (sign-out / invalid). */
    fun clearPending() {
        _pending.value = null
        _prefersLoginPresentation.value = false
    }

    fun acknowledgeLoginPresentation() {
        _prefersLoginPresentation.value = false
    }

    private fun apply(
        destination: Destination,
        persistencePath: String,
    ) {
        when (routingKind(destination)) {
            RoutingKind.Discard -> {
                // Never stash / never treat Unknown (or OAuth, already filtered)
                // as a content destination.
            }
            RoutingKind.AuthOwned -> {
                // Auth stack ([AuthNavHost]) owns reset / verify — park
                // in-memory only; do NOT persist across process death.
                _pending.value = destination
                if (!signedInProvider()) {
                    _prefersLoginPresentation.value = true
                }
            }
            RoutingKind.Content -> {
                // Product choice (documented): RN allows gig/post/listing/
                // invite/business/user public routes signed-out. Native today
                // only shows PlaceLaunchHost while signed out — there is no
                // signed-out content browser — so we still persist these for
                // post-login replay rather than dropping them.
                if (signedInProvider()) {
                    _prefersLoginPresentation.value = false
                    _pending.value = destination
                } else {
                    PendingDeepLinkStore.stash(persistencePath)
                    _pending.value = null
                    _prefersLoginPresentation.value = true
                }
            }
        }
    }

    private fun routingKind(destination: Destination): RoutingKind =
        when (destination) {
            is Destination.Unknown -> RoutingKind.Discard
            is Destination.ResetPassword, is Destination.VerifyEmail -> RoutingKind.AuthOwned
            // RN sends a signed-out `/join/:code` straight to the register
            // form with the code pre-filled — it never parks the link for
            // post-login replay, because the code only matters while the
            // account is still being created
            // (`pantopus/frontend/apps/mobile/src/app/_layout.tsx:76`,
            // `src/app/join/[code].tsx:20`). Auth-owned keeps it in memory so
            // [app.pantopus.android.ui.screens.auth.AuthNavHost] can push
            // Sign-up with the code, while a signed-in viewer still gets the
            // token-accept surface from `RootTabScreen`.
            is Destination.JoinInvite -> RoutingKind.AuthOwned
            else -> RoutingKind.Content
        }

    internal fun resolve(uri: Uri): Destination = resolveString(uri.toString())

    /**
     * Pure-string resolver — works on JVM unit tests without
     * Robolectric (`android.net.Uri` is a stub there).
     */
    @Suppress("CyclomaticComplexMethod", "ReturnCount", "LongMethod")
    internal fun resolveString(raw: String): Destination {
        if (raw.isBlank()) return Destination.Unknown(raw)
        val schemeEnd = raw.indexOf("://")
        val scheme: String
        val rest: String
        if (schemeEnd >= 0) {
            scheme = raw.substring(0, schemeEnd)
            rest = raw.substring(schemeEnd + 3)
        } else {
            scheme = ""
            rest = raw
        }
        // Split off the query / fragment so the segment match below sees
        // just the path components.
        val pathPart = rest.substringBefore('?').substringBefore('#')
        val queryPart =
            rest.substringAfter('?', missingDelimiterValue = "")
                .substringBefore('#')
        val parts = pathPart.split('/').filter { it.isNotBlank() }
        val segments: List<String> =
            if (scheme == "http" || scheme == "https") {
                if (parts.size <= 1) emptyList() else parts.drop(1)
            } else {
                parts
            }
        if (segments.isEmpty()) return Destination.Unknown(raw)
        val first = segments.first()
        if (first.startsWith("@") && first.length > 1) {
            return Destination.BeaconProfile(first.drop(1))
        }
        val tabQuery = Paths.queryParam(queryPart, "tab")
        // Auth deep links carry `token` / `token_hash` (Supabase's two
        // recovery-link param names) and an optional `email`. Auth-callback
        // emails sometimes encode params in the fragment instead of the
        // query string, so parse both.
        val fragmentPart =
            rest.substringAfter('#', missingDelimiterValue = "")
        val tokenQuery =
            Paths.queryParam(queryPart, "token")
                ?: Paths.queryParam(queryPart, "token_hash")
                ?: Paths.queryParam(fragmentPart, "token")
                ?: Paths.queryParam(fragmentPart, "token_hash")
        val emailQuery =
            Paths.queryParam(queryPart, "email") ?: Paths.queryParam(fragmentPart, "email")
        // B1.6 — `?id=` seeds the translation / unboxing mailbox sub-screens.
        val idQuery = Paths.queryParam(queryPart, "id")

        return when (segments.first()) {
            "feed" -> Destination.Feed
            "home" -> Destination.Home
            "notifications" -> Destination.Notifications
            "hub-today", "hub_today", "today" ->
                // `?deliveryId=` + `?kind=` ride the Morning/Evening Briefing push.
                Destination.HubToday(
                    briefingDeliveryId =
                        Paths.queryParam(queryPart, "deliveryId")
                            ?: Paths.queryParam(queryPart, "briefing_delivery_id"),
                    kind =
                        Paths.queryParam(queryPart, "kind")
                            ?: Paths.queryParam(queryPart, "briefing_kind"),
                )
            "profile" ->
                // Only `?tab=receipt` is deep-linkable today (the monthly-receipt
                // push). A bare `pantopus://profile` falls through to Unknown.
                if (tabQuery?.lowercase() == "receipt") Destination.MonthlyReceipt else Destination.Unknown(raw)
            "connections" -> Destination.Connections
            "beacons", "beacon-updates", "beacon_updates" -> Destination.Beacons
            "discover-hub", "discover_hub", "discoverhub" -> Destination.DiscoverHub
            "wallet" -> Destination.Wallet
            "support-trains", "support_train" -> {
                val id = segments.getOrNull(1)
                when {
                    id.isNullOrBlank() -> Destination.Unknown(raw)
                    // `/support-trains/:id/manage` → A13.13 organizer surface.
                    segments.getOrNull(2) == "manage" -> Destination.SupportTrainManage(id)
                    else -> Destination.SupportTrain(id)
                }
            }
            // `/broadcast/:id` aliases Pulse/persona post detail (RN parity).
            "post", "posts", "broadcast", "broadcasts" -> {
                val id = segments.getOrNull(1)
                if (id.isNullOrBlank()) Destination.Unknown(raw) else Destination.Post(id)
            }
            "gig", "gigs" -> {
                val id = segments.getOrNull(1)
                if (id.isNullOrBlank()) Destination.Unknown(raw) else Destination.Gig(id)
            }
            "listing", "listings" -> {
                val id = segments.getOrNull(1)
                if (id.isNullOrBlank()) Destination.Unknown(raw) else Destination.Listing(id)
            }
            "homes" -> {
                val id = segments.getOrNull(1)
                if (id.isNullOrBlank()) return Destination.Unknown(raw)
                val trailing = segments.drop(2)
                when (trailing.firstOrNull()) {
                    "dashboard" -> Destination.HomeDashboard(id)
                    "members" ->
                        if (tabQuery == "requests") {
                            Destination.HomeMemberRequests(id)
                        } else {
                            Destination.HomeDetail(id)
                        }
                    "owners" ->
                        if (trailing.getOrNull(1) == "transfer") {
                            Destination.HomeOwnersTransfer(id)
                        } else {
                            Destination.HomeDetail(id)
                        }
                    "verify-landlord", "verify_landlord" -> Destination.VerifyLandlord(id)
                    "verify-postcard", "verify_postcard" -> Destination.PostcardVerification(id)
                    // B1.6 — A18.4 persistent waiting room.
                    "waiting-room", "waiting_room" -> Destination.WaitingRoom(id)
                    else -> Destination.HomeDetail(id)
                }
            }
            "businesses" -> {
                // `pantopus://businesses/new` opens the Create Business wizard.
                // `pantopus://businesses/:id/page-editor` opens the owner-only
                // A13.10 editor. `pantopus://businesses/:id` opens the A10.7
                // Business owner view. Mirrors iOS `businessesDestination`.
                val id = segments.getOrNull(1)
                val trailing = segments.getOrNull(2)
                when {
                    id == "new" -> Destination.CreateBusiness
                    id.isNullOrBlank() -> Destination.Unknown(raw)
                    trailing == "page-editor" || trailing == "page_editor" ->
                        Destination.EditBusinessPage(id)
                    else -> Destination.BusinessOwner(id)
                }
            }
            "business" -> {
                // Singular `business/:username` is the A10.6 public profile.
                // `?pageSlug=` is RN's redirect target for `/b/:username/:slug`.
                val id = segments.getOrNull(1)
                val pageSlug = Paths.queryParam(queryPart, "pageSlug")
                when {
                    id.isNullOrBlank() -> Destination.Unknown(raw)
                    !pageSlug.isNullOrBlank() -> Destination.BusinessPage(id, pageSlug)
                    else -> Destination.BusinessProfile(id)
                }
            }
            "chat", "message", "messages", "conversation" -> {
                val id = segments.getOrNull(1)
                val name =
                    Paths.queryParam(queryPart, "name")?.let { encoded ->
                        runCatching { java.net.URLDecoder.decode(encoded, "UTF-8") }.getOrNull()
                    }
                if (id.isNullOrBlank()) Destination.Unknown(raw) else Destination.Conversation(id, name)
            }
            "user", "users", "u" -> {
                val id = segments.getOrNull(1)
                if (id.isNullOrBlank()) Destination.Unknown(raw) else Destination.User(id)
            }
            "b" -> {
                // Public business short link `pantopus://b/:username` and its
                // named-page variant `pantopus://b/:username/:slug`. RN
                // redirects the latter to `/business/:username?pageSlug=slug`,
                // so the slug has to survive the parse (C4).
                val id = segments.getOrNull(1)
                val pageSlug = segments.getOrNull(2)
                when {
                    id.isNullOrBlank() -> Destination.Unknown(raw)
                    !pageSlug.isNullOrBlank() -> Destination.BusinessPage(id, pageSlug)
                    else -> Destination.BusinessProfile(id)
                }
            }
            "persona" -> {
                val handle = segments.getOrNull(1)
                if (handle.isNullOrBlank()) Destination.Unknown(raw) else Destination.BeaconProfile(handle)
            }
            "join" -> {
                val code = segments.getOrNull(1)
                if (code.isNullOrBlank()) Destination.Unknown(raw) else Destination.JoinInvite(code)
            }
            "invite" -> {
                val token = segments.getOrNull(1)
                if (token.isNullOrBlank()) Destination.Unknown(raw) else Destination.Invite(token)
            }
            "mailbox" -> {
                // `pantopus://mailbox/vacation` opens A14.8;
                // `pantopus://mailbox/mailday` opens the A13.16 My Mail Day
                // editor. B1.6 adds the batch-2 mailbox sub-screens. Other
                // mailbox paths fall through to Unknown until they have routes.
                when (segments.getOrNull(1)) {
                    "vacation" -> Destination.VacationHold
                    "mailday" -> Destination.MailDay
                    "stamps" -> Destination.Stamps
                    "earn" -> Destination.Earn
                    "unboxing" -> Destination.Unboxing(idQuery)
                    "translation" -> Destination.MailTranslation(idQuery ?: "")
                    "tasks" -> {
                        val taskId = segments.getOrNull(2)
                        if (taskId.isNullOrBlank()) Destination.Unknown(raw) else Destination.MailTask(taskId)
                    }
                    else -> Destination.Unknown(raw)
                }
            }
            "identity" ->
                // `pantopus://identity/preview` — A18.5 "View as" preview.
                if (segments.getOrNull(1) == "preview") Destination.ViewAs else Destination.Unknown(raw)
            "auth" -> {
                when (segments.getOrNull(1)) {
                    "callback" -> Destination.Unknown(raw)
                    "reset-password", "reset_password" ->
                        if (tokenQuery.isNullOrEmpty()) {
                            Destination.Unknown(raw)
                        } else {
                            Destination.ResetPassword(tokenQuery)
                        }
                    "verify-email", "verify_email" ->
                        if (tokenQuery.isNullOrEmpty()) {
                            Destination.Unknown(raw)
                        } else {
                            Destination.VerifyEmail(token = tokenQuery, email = emailQuery)
                        }
                    else -> Destination.Unknown(raw)
                }
            }
            // Tolerate the bare `/reset-password?token=…` / `/verify-email?token=…`
            // shape that the backend's older recovery template emits (no
            // `/auth/` prefix).
            "reset-password", "reset_password" ->
                if (tokenQuery.isNullOrEmpty()) {
                    Destination.Unknown(raw)
                } else {
                    Destination.ResetPassword(tokenQuery)
                }
            "verify-email", "verify_email" ->
                if (tokenQuery.isNullOrEmpty()) {
                    Destination.Unknown(raw)
                } else {
                    Destination.VerifyEmail(token = tokenQuery, email = emailQuery)
                }
            "settings" ->
                // `pantopus://settings/payments` — A14.6. Other settings
                // sub-routes aren't deep-linkable yet; the bare host
                // `pantopus://settings` falls through to `.Unknown`.
                if (segments.getOrNull(1) == "payments") {
                    Destination.PaymentsSettings
                } else {
                    Destination.Unknown(raw)
                }
            else -> Destination.Unknown(raw)
        }
    }

    /**
     * Pure string plumbing for incoming links. Nothing here touches
     * `android.net.Uri`, so notification payloads (which arrive as raw
     * paths) and the JVM unit tests share the same code without
     * Robolectric.
     */
    private object Paths {
        private const val SCHEME_SEPARATOR = "://"

        /**
         * String-shaped sibling of [OAuthSessionStore.isOAuthCallback], for the
         * path-style links that arrive from notification payloads (where there is
         * no `Uri` to parse and unit tests run without Robolectric).
         */
        fun isOAuthCallback(raw: String): Boolean {
            val pathPart =
                raw.substringAfter(SCHEME_SEPARATOR, missingDelimiterValue = raw)
                    .substringBefore('?')
                    .substringBefore('#')
            val parts = pathPart.split('/').filter { it.isNotBlank() }
            return parts.size >= 2 &&
                parts[0].equals("auth", ignoreCase = true) &&
                parts[1].equals("callback", ignoreCase = true)
        }

        fun normalizeIncoming(path: String): String =
            when {
                path.startsWith("pantopus://") || path.startsWith("http") -> path
                path.startsWith("/") -> "pantopus://" + path.drop(1)
                else -> "pantopus://$path"
            }

        /**
         * Collapse `https://pantopus.app/…` into a stable `pantopus://…` form
         * so replay goes through the same resolver.
         */
        fun normalized(raw: String): String {
            val trimmed = raw.trim()
            if (trimmed.isEmpty()) return trimmed
            val schemeEnd = trimmed.indexOf(SCHEME_SEPARATOR)
            if (schemeEnd < 0) return normalizeIncoming(trimmed)
            val scheme = trimmed.substring(0, schemeEnd)
            if (scheme != "http" && scheme != "https") return trimmed
            val rest = trimmed.substring(schemeEnd + SCHEME_SEPARATOR.length)
            val pathAndQuery = rest.substringAfter('/', missingDelimiterValue = "")
            return "pantopus://$pathAndQuery"
        }

        fun queryParam(
            query: String,
            key: String,
        ): String? {
            if (query.isBlank()) return null
            for (pair in query.split('&')) {
                val eq = pair.indexOf('=')
                if (eq < 0) continue
                val k = pair.substring(0, eq)
                if (k == key) return pair.substring(eq + 1)
            }
            return null
        }
    }
}
