//
//  DeepLinkRouter.swift
//  Pantopus
//
//  Tiny deep-link router. Receives a URL and publishes the resolved
//  destination so SwiftUI views (or coordinators) can react.
//

// The routing table is one flat switch on purpose — it has to stay
// diff-able against the Android `when` in `core/routing/DeepLinkRouter.kt`,
// which carries the same `@Suppress("CyclomaticComplexMethod", "LongMethod")`
// for the same reason. Most of the length here is the per-destination docs.
// swiftlint:disable cyclomatic_complexity type_body_length
// swiftlint:disable file_length function_body_length

import Foundation
import Logging

@Observable
@MainActor
final class DeepLinkRouter {
    /// Full routing table from `docs/07-frontend-mobile-app.md §9`.
    /// `home` (singular) keeps the legacy "go to Hub" semantics;
    /// `homeDetail` / `homeDashboard` / `homeMemberRequests` are
    /// the typed variants for `/homes/:id/*`.
    enum Destination: Equatable {
        case feed
        case home
        case notifications
        case supportTrain(id: String)
        /// `pantopus://support-trains/:id/manage` — A13.13 organizer
        /// surface. Reached from the A10.9 detail dock overflow when
        /// the viewer is the organizer, and from back-of-house
        /// shortcut links. Distinct from `supportTrain(id:)`, which
        /// lands on the participant detail (A10.9).
        case supportTrainManage(id: String)
        case post(id: String)
        case gig(id: String)
        case listing(id: String)
        case homeDetail(id: String)
        case homeDashboard(id: String)
        case homeMemberRequests(id: String)
        /// `pantopus://homes/:id/owners/transfer` — A13.4 Transfer Ownership
        /// form. Lands on the populated state; the form owns the Face ID
        /// bottom sheet.
        case homeOwnersTransfer(id: String)
        /// `pantopus://homes/:id/verify-landlord` — opens A12.5 / A12.6.
        case verifyLandlord(id: String)
        /// `pantopus://homes/:id/verify-postcard` — opens the A12.7
        /// sibling status screen directly.
        case postcardVerification(id: String)
        case conversation(id: String)
        case user(id: String)
        /// `pantopus://persona/:handle` or `/@handle` — public Beacon profile.
        case beaconProfile(handle: String)
        /// `pantopus://join/:code` — signup invite code (RN `/join/[code]` alias).
        case joinInvite(code: String)
        case connections
        /// `pantopus://beacons` — A03.2 Beacon Updates feed (`surface=personas`).
        case beacons
        case discoverHub
        /// `pantopus://businesses/new` — open the A12.10 Create Business
        /// wizard inside the active tab's nav stack.
        case createBusiness
        case invite(token: String)
        /// P4.2 — A13.10 Edit Business Page (owner-only).
        /// `pantopus://businesses/:id/page-editor`.
        case editBusinessPage(businessId: String)
        /// Public business profile reached from a share / push.
        /// `pantopus://businesses/:id`.
        case businessProfile(businessId: String)
        /// C4 — `pantopus://b/:username/:slug` (and
        /// `pantopus://business/:username?pageSlug=…`): the public profile
        /// with one named custom page opened. RN redirects the short link to
        /// `/business/:username?pageSlug=slug`; dropping the slug here would
        /// silently land the user on the plain profile.
        case businessPage(businessId: String, pageSlug: String)
        /// `pantopus://auth/reset-password?token=…` — surfaces the hashed
        /// recovery token from the password-reset email. Carries the raw
        /// token; the caller invokes `AuthManager.resetPassword` on submit.
        case resetPassword(token: String)
        /// `pantopus://auth/verify-email?token=…` — surfaces the hashed
        /// Supabase OTP from the verification email. `email` is optional
        /// (the link from the resend / signup flow carries `&email=` so
        /// the screen can render the recipient).
        case verifyEmail(token: String, email: String?)
        /// A14.8 — `pantopus://mailbox/vacation` opens the Vacation
        /// hold screen (scheduling or active variant depending on
        /// server state once the persistence layer lands; today the
        /// view-model seeds the scheduling form).
        case vacationHold
        /// `pantopus://mailbox/mailday` — the A13.16 My Mail Day editor.
        /// Routed via the mailbox stack so Back returns to the mailbox
        /// root.
        case mailDay
        /// `pantopus://wallet` — A10.10 earnings wallet (distinct from
        /// Settings → Payments; this is the earnings-side surface).
        case wallet
        /// `pantopus://settings/payments` — A14.6 Settings → Payments.
        /// Distinct from `pantopus://wallet` (earnings-in surface).
        /// Consumed by the active tab's deep-link router which pushes
        /// `.menu` then forwards into the Payments stack route.
        case paymentsSettings

        // MARK: - B1.6 batch-2 routing seam

        /// `pantopus://mailbox/stamps` — A17.11 Stamps / postage wallet.
        case stamps
        /// `pantopus://mailbox/tasks/:id` — A17.12 mail-derived task detail.
        case mailTask(taskId: String)
        /// `pantopus://mailbox/translation?id=` — A17.13 auto-translated mail.
        case mailTranslation(mailId: String)
        /// `pantopus://mailbox/unboxing` — A17.14 scan-first capture flow. The
        /// optional `?id=` seeds the originating mail item when present.
        case unboxing(mailId: String?)
        /// `pantopus://mailbox/gig?id=&mode=pre|post` — A17.8 → "Ask a
        /// Neighbor" package-help gig. `id` is the source mail item; `mode`
        /// defaults to post-delivery, matching RN's `gig.tsx` param default.
        case packageGig(mailId: String, isPreDelivery: Bool)
        /// `pantopus://mailbox/earn` — A10.11 Earn dashboard (Wallet sibling).
        case earn
        /// `pantopus://businesses/:id` — A10.7 Business owner view. The public
        /// profile (A10.6) lives at the singular `pantopus://business/:username`.
        case businessOwner(businessId: String)
        /// `pantopus://identity/preview` — A18.5 "View as" identity preview.
        case viewAs
        /// `pantopus://homes/:id/waiting-room` — A18.4 persistent waiting room.
        case waitingRoom(id: String)
        /// `pantopus://hub-today?deliveryId=&kind=morning|evening` — the Hub
        /// "Today" briefing opened from a Morning/Evening Briefing push. The
        /// notification's metadata carries `briefing_delivery_id` +
        /// `briefing_kind`; with an id the screen resolves that stored
        /// delivery rather than only the live `/api/hub/today` snapshot.
        /// Mirrors RN `resolveNotificationRoute`'s `/hub-today?…` target
        /// (`pantopus/frontend/apps/mobile/src/utils/notificationRouting.ts:18`).
        case hubToday(briefingDeliveryId: String?, kind: String?)
        /// `pantopus://profile?tab=receipt` — the profile tab with the Monthly
        /// Receipt card auto-expanded, the target RN resolves for a
        /// `monthly_receipt` notification
        /// (`pantopus/frontend/apps/mobile/src/utils/notificationRouting.ts:29`).
        case monthlyReceipt
        case unknown(URL)
    }

    /// How a resolved destination should be handled relative to auth.
    private enum RoutingKind {
        /// OAuth callback / `.unknown` — never stash, never park as content.
        case discard
        /// `reset-password` / `verify-email` / `join/:code` — the auth stack
        /// owns these; never persist.
        case authOwned
        /// Content destinations. When signed out, persist for post-login replay.
        case content
    }

    static let shared = DeepLinkRouter()

    /// The most recent pending destination. Consumers read this and then call `consume()`.
    private(set) var pending: Destination?

    /// Set when a signed-out deep link should auto-present Sign-in
    /// (auth-owned or deferred content). `PlaceLaunchHost` observes this
    /// and opens the existing Login cover without disrupting the Place funnel.
    private(set) var prefersLoginPresentation = false

    private let logger = Logger(label: "app.pantopus.ios.DeepLinkRouter")

    private init() {}

    func handle(url: URL) {
        // Browser OAuth callbacks are owned by ASWebAuthenticationSession /
        // AuthManager — never park them as content destinations.
        if AuthManager.isOAuthCallback(url) { return }

        let destination = resolve(url: url)
        logger.info("deeplink", metadata: [
            "url": .string(url.absoluteString),
            "destination": .string("\(destination)")
        ])
        Observability.shared.track("deeplink.received", properties: [
            "url": url.absoluteString
        ])
        apply(destination: destination, persistencePath: Self.normalizedPath(for: url))
    }

    /// Receive a raw path-style link from a notification payload (e.g.
    /// `link` on `NotificationDTO`). Routed through the same
    /// resolver as full URL deep links.
    func handle(path: String) {
        let normalized = Self.normalizeIncoming(path)
        guard let url = URL(string: normalized) else { return }
        handle(url: url)
    }

    func consume() -> Destination? {
        defer { pending = nil }
        return pending
    }

    /// Drop in-memory pending + login prompt (sign-out / invalid).
    func clearPending() {
        pending = nil
        prefersLoginPresentation = false
    }

    func acknowledgeLoginPresentation() {
        prefersLoginPresentation = false
    }

    /// Ask the signed-out front door to open the Sign-in cover on its next
    /// appearance — used by the persistent-login card ("Use a different
    /// account", "Not you? Remove", a refused resume) so the user lands on
    /// the login form with the remembered account / security banner rather
    /// than on the Place funnel. Same flag the deep-link path sets.
    func requestLoginPresentation() {
        prefersLoginPresentation = true
    }

    // MARK: - Classification + persistence (Workstream 1.4)

    private func apply(destination: Destination, persistencePath: String) {
        switch Self.routingKind(of: destination) {
        case .discard:
            // Never stash / never treat `.unknown` (or OAuth, already filtered)
            // as a content destination.
            return
        case .authOwned:
            // Auth stack (`LoginView`) owns reset / verify — park in-memory
            // only so the cover can consume; do NOT persist across process death.
            pending = destination
            if !Self.isSignedIn {
                prefersLoginPresentation = true
            }
        case .content:
            // Product choice (documented): RN allows gig/post/listing/invite/
            // business/user public routes signed-out. Native today only shows
            // PlaceLaunchHost while signed out — there is no signed-out content
            // browser — so we still persist these for post-login replay rather
            // than dropping them. Do NOT treat them as "browse now without login".
            if Self.isSignedIn {
                prefersLoginPresentation = false
                pending = destination
            } else {
                PendingDeepLinkStore.stash(persistencePath)
                pending = nil
                prefersLoginPresentation = true
            }
        }
    }

    /// Production reading of the session state. Kept separate from
    /// `signedInProvider` so `bindSignedInProvider(nil)` can restore it.
    private static let defaultSignedInProvider: @MainActor () -> Bool = {
        if case .signedIn = AuthManager.shared.state { return true }
        return false
    }

    /// Seam for the signed-in check. Mirrors Android
    /// `DeepLinkRouter.bindSignedInProvider` so both platforms' routing can be
    /// exercised without standing up a real session.
    private static var signedInProvider: @MainActor () -> Bool = defaultSignedInProvider

    /// Override the session check. Pass `nil` to restore the `AuthManager` read.
    static func bindSignedInProvider(_ provider: (@MainActor () -> Bool)?) {
        signedInProvider = provider ?? defaultSignedInProvider
    }

    private static var isSignedIn: Bool {
        signedInProvider()
    }

    private static func routingKind(of destination: Destination) -> RoutingKind {
        switch destination {
        case .unknown:
            .discard
        case .resetPassword, .verifyEmail:
            .authOwned
        case .joinInvite:
            // RN sends a signed-out `/join/:code` straight to the register
            // form with the code pre-filled — it never parks the link for
            // post-login replay, because the code is only meaningful while
            // the account is still being created
            // (`pantopus/frontend/apps/mobile/src/app/_layout.tsx:76`,
            // `src/app/join/[code].tsx:20`). Classifying it auth-owned keeps
            // it in memory so `LoginView` can push Sign-up with the code,
            // while a signed-in viewer still gets the token-accept sheet.
            .authOwned
        default:
            .content
        }
    }

    /// Morning/Evening Briefing and Monthly Receipt pushes ship no `link` —
    /// the briefing carries `{ type, route: "/hub/today", briefingKind,
    /// briefingDeliveryId }` (`backend/routes/internalBriefing.js:239`), and
    /// the receipt push is typed only. Compose the same paths RN's
    /// `resolveNotificationRoute` produces
    /// (`pantopus/frontend/apps/mobile/src/utils/notificationRouting.ts:18`)
    /// so the tap resolves the specific stored briefing / expands the card.
    ///
    /// `nonisolated` + `[AnyHashable: Any]` in, `String?` out — the caller
    /// (`AppDelegate`) never smuggles the non-Sendable payload across actors.
    nonisolated static func pushFallbackPath(userInfo: [AnyHashable: Any]) -> String? {
        let type = (userInfo["type"] as? String ?? "").lowercased()
        if type == "monthly_receipt" { return "/profile?tab=receipt" }
        let briefingTypes: Set<String> = ["daily_briefing", "morning_briefing", "evening_briefing"]
        guard briefingTypes.contains(type) else { return nil }
        let rawKind = type == "evening_briefing"
            ? "evening"
            : ((userInfo["briefingKind"] as? String)
                ?? (userInfo["briefing_kind"] as? String)
                ?? "").lowercased()
        let kind = rawKind == "evening" ? "evening" : "morning"
        let deliveryId = (userInfo["briefingDeliveryId"] as? String)
            ?? (userInfo["briefing_delivery_id"] as? String)
        guard let deliveryId, !deliveryId.isEmpty else { return "/hub-today?kind=\(kind)" }
        let encoded = deliveryId.addingPercentEncoding(
            withAllowedCharacters: .urlQueryAllowed
        ) ?? deliveryId
        return "/hub-today?kind=\(kind)&deliveryId=\(encoded)"
    }

    static func normalizeIncoming(_ path: String) -> String {
        if path.hasPrefix("pantopus://") || path.hasPrefix("http") {
            return path
        }
        if path.hasPrefix("/") {
            return "pantopus://" + String(path.dropFirst())
        }
        return "pantopus://" + path
    }

    private static func normalizedPath(for url: URL) -> String {
        // Prefer a stable pantopus:// form for custom-scheme and https links
        // so replay goes through the same resolver. Mirrors Android
        // `DeepLinkRouter.Paths.normalized`: pure string surgery on the raw
        // URL. Rebuilding the path from `url.pathComponents` would
        // percent-DECODE every segment, so an encoded `%2F` inside an
        // identifier would come back as a real separator and an encoded space
        // would make the replayed string unparseable.
        let raw = url.absoluteString
        guard let schemeRange = raw.range(of: "://") else { return normalizeIncoming(raw) }
        let scheme = raw[raw.startIndex..<schemeRange.lowerBound].lowercased()
        guard scheme == "http" || scheme == "https" else { return raw }
        let rest = raw[schemeRange.upperBound...]
        guard let slash = rest.firstIndex(of: "/") else { return "pantopus://" }
        return "pantopus://" + String(rest[rest.index(after: slash)...])
    }

    // MARK: - URL parsing

    /// Accepts `pantopus://…`, `https://pantopus.com/…` and
    /// `https://pantopus.app/…`. Resolution is host-agnostic — only the path
    /// segments matter — so this needed no change when `pantopus.com` became
    /// the claimed associated domain; the entitlement and the AASA carry that.
    func resolve(url: URL) -> Destination {
        let segments = routeSegments(for: url)
        let firstSegment = segments.first ?? ""
        if firstSegment.hasPrefix("@"), firstSegment.count > 1 {
            return .beaconProfile(handle: String(firstSegment.dropFirst()))
        }
        let comps = URLComponents(url: url, resolvingAgainstBaseURL: false)
        let tabQuery = queryValue("tab", in: comps)
        // B1.6 — `?id=` seeds the translation / unboxing mailbox sub-screens.
        let idQuery = queryValue("id", in: comps)
        let tokenQuery = queryValue("token", in: comps)
            ?? queryValue("token_hash", in: comps)
            ?? fragmentParam(url.fragment, name: "token")
            ?? fragmentParam(url.fragment, name: "token_hash")
        let emailQuery = queryValue("email", in: comps)
            ?? fragmentParam(url.fragment, name: "email")

        switch firstSegment {
        case "feed":
            return .feed
        case "home":
            return .home
        case "notifications":
            return .notifications
        case "support-trains", "support_train":
            guard let id = segments.dropFirst().first else { return .unknown(url) }
            // `/support-trains/:id/manage` → A13.13 organizer surface.
            if segments.dropFirst(2).first == "manage" {
                return .supportTrainManage(id: id)
            }
            return .supportTrain(id: id)
        case "post", "posts", "broadcast", "broadcasts":
            // `/broadcast/:id` aliases Pulse/persona post detail (RN parity).
            if let id = segments.dropFirst().first { return .post(id: id) }
            return .unknown(url)
        case "gig", "gigs":
            if let id = segments.dropFirst().first { return .gig(id: id) }
            return .unknown(url)
        case "listing", "listings":
            if let id = segments.dropFirst().first { return .listing(id: id) }
            return .unknown(url)
        case "homes":
            return homeDestination(url: url, segments: segments, tabQuery: tabQuery)
        case "businesses":
            return businessesDestination(url: url, segments: segments)
        case "business":
            // Singular `business/:username` is the A10.6 public profile.
            // `?pageSlug=` is RN's redirect target for `/b/:username/:slug`.
            guard let id = segments.dropFirst().first else { return .unknown(url) }
            if let slug = queryValue("pageSlug", in: comps), !slug.isEmpty {
                return .businessPage(businessId: id, pageSlug: slug)
            }
            return .businessProfile(businessId: id)
        case "identity":
            // `pantopus://identity/preview` — A18.5 "View as" preview.
            if segments.dropFirst().first == "preview" { return .viewAs }
            return .unknown(url)
        case "chat", "message", "messages", "conversation":
            if let id = segments.dropFirst().first { return .conversation(id: id) }
            return .unknown(url)
        case "user", "users", "u":
            // Short profile URL `pantopus://u/:username` shares the user surface.
            if let id = segments.dropFirst().first { return .user(id: id) }
            return .unknown(url)
        case "b":
            // Public business short link `pantopus://b/:username` and its
            // named-page variant `pantopus://b/:username/:slug`. RN redirects
            // the latter to `/business/:username?pageSlug=slug`, so the slug
            // has to survive the parse (C4).
            let businessSegments = Array(segments.dropFirst())
            guard let id = businessSegments.first else { return .unknown(url) }
            if let slug = businessSegments.dropFirst().first, !slug.isEmpty {
                return .businessPage(businessId: id, pageSlug: slug)
            }
            return .businessProfile(businessId: id)
        case "persona":
            // `pantopus://persona/:handle` is the public Beacon profile — the
            // same destination Android resolves and the `/@handle` alias above.
            if let handle = segments.dropFirst().first { return .beaconProfile(handle: handle) }
            return .unknown(url)
        case "join":
            // RN `/join/:code` → register-with-invite. Root presents the same
            // token-accept surface it uses for `.invite`.
            if let code = segments.dropFirst().first, !code.isEmpty { return .joinInvite(code: code) }
            return .unknown(url)
        case "hub-today", "hub_today", "today":
            // `?deliveryId=` + `?kind=` ride the Morning/Evening Briefing push.
            return .hubToday(
                briefingDeliveryId: queryValue("deliveryId", in: comps)
                    ?? queryValue("briefing_delivery_id", in: comps),
                kind: queryValue("kind", in: comps)
                    ?? queryValue("briefing_kind", in: comps)
            )
        case "profile":
            // Only `?tab=receipt` is deep-linkable today (the monthly-receipt
            // push). A bare `pantopus://profile` falls through to `.unknown`.
            if tabQuery?.lowercased() == "receipt" { return .monthlyReceipt }
            return .unknown(url)
        case "connections":
            return .connections
        case "beacons", "beacon-updates", "beacon_updates":
            return .beacons
        case "discover-hub", "discover_hub", "discoverhub":
            return .discoverHub
        case "mailbox":
            return mailboxDestination(url: url, segments: segments, idQuery: idQuery)
        case "wallet":
            return .wallet
        case "invite":
            if let token = segments.dropFirst().first, !token.isEmpty {
                return .invite(token: token)
            }
            return .unknown(url)
        case "auth":
            return authDestination(url: url, segments: segments, token: tokenQuery, email: emailQuery)
        case "reset-password", "reset_password":
            // Tolerate the bare `/reset-password?token=…` shape that the
            // backend's older recovery template emits (no `/auth/` prefix).
            return resetPasswordDestination(url: url, token: tokenQuery)
        case "verify-email", "verify_email":
            return verifyEmailDestination(url: url, token: tokenQuery, email: emailQuery)
        case "settings":
            // `pantopus://settings/payments` — A14.6. Other settings
            // sub-routes aren't deep-linkable yet; the bare host
            // `pantopus://settings` falls through to `.unknown`.
            if segments.dropFirst().first == "payments" {
                return .paymentsSettings
            }
            return .unknown(url)
        default:
            return .unknown(url)
        }
    }

    private func routeSegments(for url: URL) -> [String] {
        var segments = url.pathComponents.filter { $0 != "/" }
        if url.scheme != "http", url.scheme != "https",
           let host = Self.customSchemeAuthority(for: url), !host.isEmpty {
            segments.insert(host, at: 0)
        }
        return segments
    }

    /// The authority of a custom-scheme link, read off the raw string.
    /// `URL(string: "pantopus://@mariak")` treats `@` as the userinfo
    /// delimiter and reports `host == "mariak"`, which silently drops the
    /// marker the `/@handle` Beacon alias depends on. Android parses the raw
    /// string, so mirror that here and keep both platforms on one answer.
    private static func customSchemeAuthority(for url: URL) -> String? {
        let raw = url.absoluteString
        guard let schemeRange = raw.range(of: "://") else { return url.host }
        let authority = raw[schemeRange.upperBound...].prefix {
            $0 != "/" && $0 != "?" && $0 != "#"
        }
        return authority.isEmpty ? url.host : String(authority)
    }

    private func queryValue(_ name: String, in components: URLComponents?) -> String? {
        components?.queryItems?.first { $0.name == name }?.value
    }

    private func homeDestination(url: URL, segments: [String], tabQuery: String?) -> Destination {
        guard let id = segments.dropFirst().first else { return .unknown(url) }
        let trailing = Array(segments.dropFirst(2))
        if trailing.first == "dashboard" {
            return .homeDashboard(id: id)
        }
        if trailing.first == "members" && tabQuery == "requests" {
            return .homeMemberRequests(id: id)
        }
        if trailing.first == "owners" && trailing.dropFirst().first == "transfer" {
            return .homeOwnersTransfer(id: id)
        }
        if trailing.first == "verify-landlord" || trailing.first == "verify_landlord" {
            return .verifyLandlord(id: id)
        }
        if trailing.first == "verify-postcard" || trailing.first == "verify_postcard" {
            return .postcardVerification(id: id)
        }
        // B1.6 — `pantopus://homes/:id/waiting-room` opens the A18.4 room.
        if trailing.first == "waiting-room" || trailing.first == "waiting_room" {
            return .waitingRoom(id: id)
        }
        return .homeDetail(id: id)
    }

    /// Plural `businesses/*` is the owner-side surface family.
    /// `…/new` opens the Create Business wizard, `…/:id/page-editor` opens
    /// A13.10 (owner-only), and `…/:id` opens the A10.7 Business owner view.
    /// The singular `business/:username` (A10.6 public profile) is handled
    /// separately in `resolve`.
    private func businessesDestination(url: URL, segments: [String]) -> Destination {
        guard let id = segments.dropFirst().first else { return .unknown(url) }
        if id == "new" {
            return .createBusiness
        }
        let trailing = Array(segments.dropFirst(2))
        if trailing.first == "page-editor" || trailing.first == "page_editor" {
            return .editBusinessPage(businessId: id)
        }
        return .businessOwner(businessId: id)
    }

    private func mailboxDestination(url: URL, segments: [String], idQuery: String?) -> Destination {
        // `pantopus://mailbox/vacation` opens A14.8; `pantopus://mailbox/mailday`
        // opens the A13.16 My Mail Day editor. B1.6 adds the batch-2 mailbox
        // sub-screens (stamps / tasks / translation / unboxing / earn). Other
        // mailbox paths fall through to `.unknown` until they have routes.
        switch segments.dropFirst().first {
        case "vacation": .vacationHold
        case "mailday": .mailDay
        case "stamps": .stamps
        case "earn": .earn
        case "unboxing": .unboxing(mailId: idQuery)
        case "gig": packageGigDestination(url: url, idQuery: idQuery)
        case "translation": .mailTranslation(mailId: idQuery ?? "")
        case "tasks": mailTaskDestination(url: url, segments: segments)
        default: .unknown(url)
        }
    }

    /// `pantopus://mailbox/gig?id=&mode=pre|post` — A17.8 "Ask a Neighbor".
    /// Without a source mail id the package-gig form has nothing to pre-fill,
    /// so the link falls through to `.unknown`.
    private func packageGigDestination(url: URL, idQuery: String?) -> Destination {
        guard let mailId = idQuery, !mailId.isEmpty else { return .unknown(url) }
        let comps = URLComponents(url: url, resolvingAgainstBaseURL: false)
        let mode = queryValue("mode", in: comps)?.lowercased()
        return .packageGig(mailId: mailId, isPreDelivery: mode == "pre")
    }

    /// `pantopus://mailbox/tasks/:id` — A17.12 mail-derived task detail. The
    /// task id rides as the third path segment.
    private func mailTaskDestination(url: URL, segments: [String]) -> Destination {
        guard let taskId = segments.dropFirst(2).first, !taskId.isEmpty else { return .unknown(url) }
        return .mailTask(taskId: taskId)
    }

    private func authDestination(
        url: URL,
        segments: [String],
        token: String?,
        email: String?
    ) -> Destination {
        switch segments.dropFirst().first ?? "" {
        case "callback":
            // OAuth return — swallowed by `handle(url:)` / PantopusApp.
            .unknown(url)
        case "reset-password", "reset_password":
            resetPasswordDestination(url: url, token: token)
        case "verify-email", "verify_email":
            verifyEmailDestination(url: url, token: token, email: email)
        default:
            .unknown(url)
        }
    }

    private func resetPasswordDestination(url: URL, token: String?) -> Destination {
        guard let token, !token.isEmpty else { return .unknown(url) }
        return .resetPassword(token: token)
    }

    private func verifyEmailDestination(url: URL, token: String?, email: String?) -> Destination {
        guard let token, !token.isEmpty else { return .unknown(url) }
        return .verifyEmail(token: token, email: email)
    }

    /// Pulls a single key out of a `#` fragment of the form `key=v&k2=v2`.
    /// Supabase auth-callback links sometimes ship the access_token /
    /// token_hash / email in the fragment instead of the query string.
    private func fragmentParam(_ fragment: String?, name: String) -> String? {
        guard let fragment, !fragment.isEmpty else { return nil }
        for pair in fragment.split(separator: "&") {
            let parts = pair.split(separator: "=", maxSplits: 1)
            if parts.count == 2, parts[0] == Substring(name) {
                return String(parts[1])
            }
        }
        return nil
    }
}
