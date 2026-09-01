@file:Suppress("PackageNaming")

package app.pantopus.android.core.routing

import android.content.Context
import android.content.SharedPreferences
import io.mockk.every
import io.mockk.mockk
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * Mirrors iOS [DeepLinkRouterTests]. Uses the [DeepLinkRouter.resolveString]
 * helper so the suite stays on the pure JVM (no Robolectric — the
 * production code does `Uri.parse` then `toString()` to hand off).
 *
 * [DeepLinkRouter] and [PendingDeepLinkStore] are process-wide singletons,
 * so [setUp] / [tearDown] fully reset both around every case: the bound
 * signed-in provider, the in-memory pending destination, the login-prompt
 * flag, and the persisted stash. Without that, a signed-out case would leak
 * a stashed link (or a `true` provider) into whichever case ran next.
 */
class DeepLinkRouterTest {
    /**
     * Backs the provider bound in [setUp]. The bulk of this suite describes a
     * signed-in user's routing table, so it defaults to `true`; the
     * Workstream 1.4 cases flip it to `false` to exercise the deferred path.
     */
    private var signedIn: Boolean = true

    @Before
    fun setUp() {
        installInMemoryPendingDeepLinkStore()
        signedIn = true
        DeepLinkRouter.bindSignedInProvider { signedIn }
        DeepLinkRouter.clearPending()
        PendingDeepLinkStore.clear()
    }

    @After
    fun tearDown() {
        DeepLinkRouter.clearPending()
        PendingDeepLinkStore.clear()
        DeepLinkRouter.bindSignedInProvider(DEFAULT_SIGNED_IN_PROVIDER)
    }

    @Test
    fun feed_custom_scheme() {
        assertEquals(DeepLinkRouter.Destination.Feed, DeepLinkRouter.resolveString("pantopus://feed"))
    }

    @Test
    fun home_https_host() {
        assertEquals(DeepLinkRouter.Destination.Home, DeepLinkRouter.resolveString("https://pantopus.app/home"))
    }

    @Test
    fun post_id_extracted() {
        assertEquals(
            DeepLinkRouter.Destination.Post("abc-123"),
            DeepLinkRouter.resolveString("https://pantopus.app/posts/abc-123"),
        )
    }

    @Test
    fun conversation_id_extracted() {
        assertEquals(
            DeepLinkRouter.Destination.Conversation("conv_42"),
            DeepLinkRouter.resolveString("pantopus://messages/conv_42"),
        )
    }

    @Test
    fun unknown_path_falls_back() {
        assertTrue(DeepLinkRouter.resolveString("pantopus://wat") is DeepLinkRouter.Destination.Unknown)
    }

    @Test
    fun invite_token_custom_scheme() {
        assertEquals(
            DeepLinkRouter.Destination.Invite("abc-123"),
            DeepLinkRouter.resolveString("pantopus://invite/abc-123"),
        )
    }

    @Test
    fun invite_token_https_host() {
        assertEquals(
            DeepLinkRouter.Destination.Invite("xyz789"),
            DeepLinkRouter.resolveString("https://pantopus.app/invite/xyz789"),
        )
    }

    @Test
    fun invite_without_token_falls_back() {
        assertTrue(DeepLinkRouter.resolveString("pantopus://invite") is DeepLinkRouter.Destination.Unknown)
    }

    @Test
    fun query_and_fragment_are_ignored() {
        assertEquals(
            DeepLinkRouter.Destination.Invite("abc-123"),
            DeepLinkRouter.resolveString("https://pantopus.app/invite/abc-123?utm_source=email#anchor"),
        )
    }

    // MARK: - T4.1 routing table

    @Test
    fun notifications_routes_to_notifications() {
        assertEquals(DeepLinkRouter.Destination.Notifications, DeepLinkRouter.resolveString("pantopus://notifications"))
        assertEquals(
            DeepLinkRouter.Destination.Notifications,
            DeepLinkRouter.resolveString("https://pantopus.app/notifications"),
        )
    }

    @Test
    fun wallet_routes_to_wallet() {
        assertEquals(DeepLinkRouter.Destination.Wallet, DeepLinkRouter.resolveString("pantopus://wallet"))
        assertEquals(
            DeepLinkRouter.Destination.Wallet,
            DeepLinkRouter.resolveString("https://pantopus.app/wallet"),
        )
    }

    @Test
    fun support_train_route() {
        assertEquals(
            DeepLinkRouter.Destination.SupportTrain("st_1"),
            DeepLinkRouter.resolveString("pantopus://support-trains/st_1"),
        )
        assertEquals(
            DeepLinkRouter.Destination.SupportTrain("st_2"),
            DeepLinkRouter.resolveString("pantopus://support_train/st_2"),
        )
    }

    /**
     * P4.3 / A13.13 — Organizers reach the Manage Train surface via
     * `pantopus://support-trains/:id/manage`; the bare
     * `support-trains/:id` URL lands on the A10.9 participant detail.
     */
    @Test
    fun support_train_manage_route() {
        // P4.3 / A13.13 — `/support-trains/:id/manage` resolves to the
        // organizer-only Manage Train deep-link destination on both URL
        // shapes.
        assertEquals(
            DeepLinkRouter.Destination.SupportTrainManage("st_1"),
            DeepLinkRouter.resolveString("pantopus://support-trains/st_1/manage"),
        )
        assertEquals(
            DeepLinkRouter.Destination.SupportTrainManage("st_3"),
            DeepLinkRouter.resolveString("https://pantopus.app/support-trains/st_3/manage"),
        )
    }

    @Test
    fun gig_route() {
        assertEquals(
            DeepLinkRouter.Destination.Gig("g_1"),
            DeepLinkRouter.resolveString("pantopus://gig/g_1"),
        )
        assertEquals(
            DeepLinkRouter.Destination.Gig("g_2"),
            DeepLinkRouter.resolveString("https://pantopus.app/gigs/g_2"),
        )
        // pantopus.com is the verified App Links host and what shareUrl builds;
        // .app above stays covered because links already shared still land here.
        assertEquals(
            DeepLinkRouter.Destination.Gig("g_3"),
            DeepLinkRouter.resolveString("https://pantopus.com/gigs/g_3"),
        )
    }

    @Test
    fun listing_route() {
        assertEquals(
            DeepLinkRouter.Destination.Listing("l_1"),
            DeepLinkRouter.resolveString("pantopus://listing/l_1"),
        )
        assertEquals(
            DeepLinkRouter.Destination.Listing("l_2"),
            DeepLinkRouter.resolveString("https://pantopus.app/listings/l_2"),
        )
    }

    @Test
    fun home_detail_route() {
        assertEquals(
            DeepLinkRouter.Destination.HomeDetail("h_1"),
            DeepLinkRouter.resolveString("pantopus://homes/h_1"),
        )
    }

    @Test
    fun home_dashboard_route() {
        assertEquals(
            DeepLinkRouter.Destination.HomeDashboard("h_1"),
            DeepLinkRouter.resolveString("pantopus://homes/h_1/dashboard"),
        )
    }

    @Test
    fun home_member_requests_requires_tab_query() {
        assertEquals(
            DeepLinkRouter.Destination.HomeMemberRequests("h_1"),
            DeepLinkRouter.resolveString("pantopus://homes/h_1/members?tab=requests"),
        )
    }

    @Test
    fun home_members_without_tab_falls_back_to_detail() {
        assertEquals(
            DeepLinkRouter.Destination.HomeDetail("h_1"),
            DeepLinkRouter.resolveString("pantopus://homes/h_1/members"),
        )
    }

    @Test
    fun home_owners_transfer_custom_scheme() {
        assertEquals(
            DeepLinkRouter.Destination.HomeOwnersTransfer("h_1"),
            DeepLinkRouter.resolveString("pantopus://homes/h_1/owners/transfer"),
        )
    }

    @Test
    fun home_owners_transfer_https_host() {
        assertEquals(
            DeepLinkRouter.Destination.HomeOwnersTransfer("h_2"),
            DeepLinkRouter.resolveString("https://pantopus.app/homes/h_2/owners/transfer"),
        )
    }

    @Test
    fun chat_route_uses_conversation_case() {
        assertEquals(
            DeepLinkRouter.Destination.Conversation("c_1"),
            DeepLinkRouter.resolveString("pantopus://chat/c_1"),
        )
    }

    @Test
    fun user_route() {
        assertEquals(
            DeepLinkRouter.Destination.User("u_1"),
            DeepLinkRouter.resolveString("pantopus://user/u_1"),
        )
        assertEquals(
            DeepLinkRouter.Destination.User("u_2"),
            DeepLinkRouter.resolveString("https://pantopus.app/users/u_2"),
        )
    }

    @Test
    fun connections_route() {
        assertEquals(DeepLinkRouter.Destination.Connections, DeepLinkRouter.resolveString("pantopus://connections"))
    }

    // MARK: - Short-link aliases (mirrors iOS `DeepLinkRouterAliasTests`)

    /**
     * `/persona/:handle` is the public Beacon profile on both platforms — it
     * must not fall through to the generic user surface.
     */
    @Test
    fun persona_route_resolves_to_beacon_profile() {
        assertEquals(
            DeepLinkRouter.Destination.BeaconProfile("mariak"),
            DeepLinkRouter.resolveString("pantopus://persona/mariak"),
        )
        assertEquals(
            DeepLinkRouter.Destination.BeaconProfile("mariak"),
            DeepLinkRouter.resolveString("https://pantopus.app/persona/mariak"),
        )
    }

    @Test
    fun handle_alias_resolves_to_beacon_profile() {
        assertEquals(
            DeepLinkRouter.Destination.BeaconProfile("mariak"),
            DeepLinkRouter.resolveString("pantopus://@mariak"),
        )
        assertEquals(
            DeepLinkRouter.Destination.BeaconProfile("mariak"),
            DeepLinkRouter.resolveString("https://pantopus.app/@mariak"),
        )
    }

    @Test
    fun join_route_resolves_to_join_invite() {
        assertEquals(
            DeepLinkRouter.Destination.JoinInvite("CODE-7"),
            DeepLinkRouter.resolveString("pantopus://join/CODE-7"),
        )
        // The invite the backend hands out is an https://pantopus.com/join/<code>
        // link, so that form has to resolve — before the domain was claimed and
        // /join/* was added to assetlinks, tapping one only ever opened a browser.
        assertEquals(
            DeepLinkRouter.Destination.JoinInvite("CODE-7"),
            DeepLinkRouter.resolveString("https://pantopus.com/join/CODE-7"),
        )
    }

    @Test
    fun short_user_alias() {
        assertEquals(
            DeepLinkRouter.Destination.User("u_demo"),
            DeepLinkRouter.resolveString("pantopus://u/u_demo"),
        )
    }

    @Test
    fun short_business_alias() {
        assertEquals(
            DeepLinkRouter.Destination.BusinessProfile("biz_42"),
            DeepLinkRouter.resolveString("pantopus://b/biz_42"),
        )
    }

    @Test
    fun broadcast_alias_resolves_to_post() {
        assertEquals(
            DeepLinkRouter.Destination.Post("p_1"),
            DeepLinkRouter.resolveString("pantopus://broadcast/p_1"),
        )
        assertEquals(
            DeepLinkRouter.Destination.Post("p_1"),
            DeepLinkRouter.resolveString("pantopus://broadcasts/p_1"),
        )
    }

    /** There is no `/local/:handle` route on either platform. */
    @Test
    fun local_route_falls_back_to_unknown() {
        assertTrue(DeepLinkRouter.resolveString("pantopus://local/mariak") is DeepLinkRouter.Destination.Unknown)
    }

    @Test
    fun create_business_route_custom_scheme() {
        assertEquals(
            DeepLinkRouter.Destination.CreateBusiness,
            DeepLinkRouter.resolveString("pantopus://businesses/new"),
        )
    }

    @Test
    fun create_business_route_https_host() {
        assertEquals(
            DeepLinkRouter.Destination.CreateBusiness,
            DeepLinkRouter.resolveString("https://pantopus.app/businesses/new"),
        )
    }

    // MARK: - A14.8 Vacation hold

    @Test
    fun vacation_hold_custom_scheme() {
        assertEquals(
            DeepLinkRouter.Destination.VacationHold,
            DeepLinkRouter.resolveString("pantopus://mailbox/vacation"),
        )
    }

    @Test
    fun vacation_hold_https_host() {
        assertEquals(
            DeepLinkRouter.Destination.VacationHold,
            DeepLinkRouter.resolveString("https://pantopus.app/mailbox/vacation"),
        )
    }

    @Test
    fun mailbox_without_vacation_falls_back() {
        assertTrue(DeepLinkRouter.resolveString("pantopus://mailbox") is DeepLinkRouter.Destination.Unknown)
    }

    // MARK: - T6.1c P5 — Auth deep links

    @Test
    fun reset_password_custom_scheme() {
        assertEquals(
            DeepLinkRouter.Destination.ResetPassword("hashed-recovery"),
            DeepLinkRouter.resolveString("pantopus://auth/reset-password?token=hashed-recovery"),
        )
    }

    @Test
    fun reset_password_https_host() {
        assertEquals(
            DeepLinkRouter.Destination.ResetPassword("abc-123"),
            DeepLinkRouter.resolveString("https://pantopus.app/auth/reset-password?token=abc-123"),
        )
    }

    @Test
    fun reset_password_without_token_falls_back() {
        assertTrue(
            DeepLinkRouter.resolveString("pantopus://auth/reset-password") is DeepLinkRouter.Destination.Unknown,
        )
    }

    @Test
    fun reset_password_accepts_token_hash_param() {
        assertEquals(
            DeepLinkRouter.Destination.ResetPassword("hash-shape"),
            DeepLinkRouter.resolveString("pantopus://auth/reset-password?token_hash=hash-shape"),
        )
    }

    @Test
    fun reset_password_accepts_bare_shape_without_auth_prefix() {
        // Backend's older recovery template emits `/reset-password?token=…`.
        assertEquals(
            DeepLinkRouter.Destination.ResetPassword("bare-shape-tok"),
            DeepLinkRouter.resolveString("pantopus://reset-password?token=bare-shape-tok"),
        )
    }

    @Test
    fun verify_email_custom_scheme() {
        assertEquals(
            DeepLinkRouter.Destination.VerifyEmail(token = "hashed-otp", email = "alice@example.com"),
            DeepLinkRouter.resolveString(
                "pantopus://auth/verify-email?token=hashed-otp&email=alice@example.com",
            ),
        )
    }

    @Test
    fun verify_email_https_host_without_email() {
        assertEquals(
            DeepLinkRouter.Destination.VerifyEmail(token = "tok", email = null),
            DeepLinkRouter.resolveString("https://pantopus.app/auth/verify-email?token=tok"),
        )
    }

    @Test
    fun verify_email_without_token_falls_back() {
        assertTrue(
            DeepLinkRouter.resolveString("pantopus://auth/verify-email") is DeepLinkRouter.Destination.Unknown,
        )
    }

    // MARK: - Path-form (notification payload) entry point

    @Test
    fun handle_path_boxes_absolute_path_into_router() {
        DeepLinkRouter.handle("/post/abc-123")
        val pending = DeepLinkRouter.consume()
        assertEquals(DeepLinkRouter.Destination.Post("abc-123"), pending)
    }

    @Test
    fun handle_path_boxes_relative_into_router() {
        DeepLinkRouter.handle("homes/h_1/dashboard")
        val pending = DeepLinkRouter.consume()
        assertEquals(DeepLinkRouter.Destination.HomeDashboard("h_1"), pending)
    }

    @Test
    fun handle_path_passes_through_full_urls() {
        DeepLinkRouter.handle("pantopus://gigs/g_99")
        val pending = DeepLinkRouter.consume()
        assertEquals(DeepLinkRouter.Destination.Gig("g_99"), pending)
    }

    // ---- A13.16 My Mail Day ----

    // ── Place ─────────────────────────────────────────────────────
    // Neither client had a Place destination, so every Place-derived push
    // routed to /hub and Place was unreachable after a back-swipe.

    @Test
    fun place_bare_link_defers_home_resolution_to_the_client() {
        assertEquals(
            DeepLinkRouter.Destination.Place(homeId = null, slug = null),
            DeepLinkRouter.resolveString("pantopus://place"),
        )
    }

    @Test
    fun place_takes_home_id_from_the_path() {
        assertEquals(
            DeepLinkRouter.Destination.Place(homeId = "home-1", slug = null),
            DeepLinkRouter.resolveString("pantopus://place/home-1"),
        )
    }

    @Test
    fun place_takes_home_id_from_the_id_query() {
        assertEquals(
            DeepLinkRouter.Destination.Place(homeId = "home-1", slug = null),
            DeepLinkRouter.resolveString("pantopus://place?id=home-1"),
        )
    }

    @Test
    fun place_opens_a_group_detail_page_from_the_path() {
        assertEquals(
            DeepLinkRouter.Destination.Place(homeId = "home-1", slug = "risk"),
            DeepLinkRouter.resolveString("pantopus://place/home-1/risk"),
        )
    }

    @Test
    fun place_opens_a_group_detail_page_from_the_section_query() {
        assertEquals(
            DeepLinkRouter.Destination.Place(homeId = "home-1", slug = "today"),
            DeepLinkRouter.resolveString("pantopus://place?id=home-1&section=today"),
        )
    }

    @Test
    fun place_degrades_an_unknown_slug_to_the_dashboard() {
        // A server that learns a new section must not produce a dead link
        // on a client that predates it.
        assertEquals(
            DeepLinkRouter.Destination.Place(homeId = "home-1", slug = null),
            DeepLinkRouter.resolveString("pantopus://place/home-1/not-a-real-group"),
        )
    }

    @Test
    fun place_accepts_every_shipped_group_slug() {
        listOf("today", "your-home", "risk", "block", "money", "civic", "identity").forEach { slug ->
            assertEquals(
                DeepLinkRouter.Destination.Place(homeId = "h", slug = slug),
                DeepLinkRouter.resolveString("pantopus://place/h/$slug"),
            )
        }
    }

    @Test
    fun place_https_host() {
        assertEquals(
            DeepLinkRouter.Destination.Place(homeId = "home-1", slug = "money"),
            DeepLinkRouter.resolveString("https://pantopus.app/place/home-1/money"),
        )
    }

    @Test
    fun mail_day_custom_scheme() {
        assertEquals(DeepLinkRouter.Destination.MailDay, DeepLinkRouter.resolveString("pantopus://mailbox/mailday"))
    }

    @Test
    fun mail_day_https_host() {
        assertEquals(
            DeepLinkRouter.Destination.MailDay,
            DeepLinkRouter.resolveString("https://pantopus.app/mailbox/mailday"),
        )
    }

    @Test
    fun mailbox_without_subroute_falls_back() {
        assertTrue(DeepLinkRouter.resolveString("pantopus://mailbox") is DeepLinkRouter.Destination.Unknown)
    }

    // MARK: - Verify-landlord routes (P2.1 / A12.5–A12.7)

    @Test
    fun verify_landlord_custom_scheme() {
        assertEquals(
            DeepLinkRouter.Destination.VerifyLandlord("h_42"),
            DeepLinkRouter.resolveString("pantopus://homes/h_42/verify-landlord"),
        )
    }

    @Test
    fun verify_landlord_underscore_shape() {
        assertEquals(
            DeepLinkRouter.Destination.VerifyLandlord("h_42"),
            DeepLinkRouter.resolveString("pantopus://homes/h_42/verify_landlord"),
        )
    }

    @Test
    fun postcard_verification_deep_link() {
        assertEquals(
            DeepLinkRouter.Destination.PostcardVerification("h_42"),
            DeepLinkRouter.resolveString("pantopus://homes/h_42/verify-postcard"),
        )
    }

    @Test
    fun verify_landlord_https_host() {
        assertEquals(
            DeepLinkRouter.Destination.VerifyLandlord("h_42"),
            DeepLinkRouter.resolveString("https://pantopus.app/homes/h_42/verify-landlord"),
        )
    }

    // MARK: - P5.2 / A14.6 — Settings → Payments deep link

    @Test
    fun payments_settings_custom_scheme() {
        assertEquals(
            DeepLinkRouter.Destination.PaymentsSettings,
            DeepLinkRouter.resolveString("pantopus://settings/payments"),
        )
    }

    @Test
    fun payments_settings_https_host() {
        assertEquals(
            DeepLinkRouter.Destination.PaymentsSettings,
            DeepLinkRouter.resolveString("https://pantopus.app/settings/payments"),
        )
    }

    @Test
    fun bare_settings_falls_back() {
        assertTrue(DeepLinkRouter.resolveString("pantopus://settings") is DeepLinkRouter.Destination.Unknown)
    }

    // MARK: - B1.6 batch-2 routing seam

    @Test
    fun stamps_route() {
        assertEquals(DeepLinkRouter.Destination.Stamps, DeepLinkRouter.resolveString("pantopus://mailbox/stamps"))
        assertEquals(
            DeepLinkRouter.Destination.Stamps,
            DeepLinkRouter.resolveString("https://pantopus.app/mailbox/stamps"),
        )
    }

    @Test
    fun mail_task_route() {
        assertEquals(
            DeepLinkRouter.Destination.MailTask("t_7"),
            DeepLinkRouter.resolveString("pantopus://mailbox/tasks/t_7"),
        )
    }

    @Test
    fun mail_task_without_id_falls_back() {
        assertTrue(DeepLinkRouter.resolveString("pantopus://mailbox/tasks") is DeepLinkRouter.Destination.Unknown)
    }

    @Test
    fun mail_translation_route() {
        assertEquals(
            DeepLinkRouter.Destination.MailTranslation("m_3"),
            DeepLinkRouter.resolveString("pantopus://mailbox/translation?id=m_3"),
        )
    }

    @Test
    fun unboxing_route_without_id() {
        assertEquals(
            DeepLinkRouter.Destination.Unboxing(null),
            DeepLinkRouter.resolveString("pantopus://mailbox/unboxing"),
        )
    }

    @Test
    fun unboxing_route_with_id() {
        assertEquals(
            DeepLinkRouter.Destination.Unboxing("m_9"),
            DeepLinkRouter.resolveString("pantopus://mailbox/unboxing?id=m_9"),
        )
    }

    @Test
    fun earn_route() {
        assertEquals(DeepLinkRouter.Destination.Earn, DeepLinkRouter.resolveString("pantopus://mailbox/earn"))
        assertEquals(
            DeepLinkRouter.Destination.Earn,
            DeepLinkRouter.resolveString("https://pantopus.app/mailbox/earn"),
        )
    }

    /**
     * A10.7 — plural `businesses/:id` resolves to the owner view; `new` keeps
     * its Create Business meaning. The public profile A10.6 is the singular
     * `business/:username` (see [business_profile_route]).
     */
    @Test
    fun business_owner_route() {
        assertEquals(
            DeepLinkRouter.Destination.BusinessOwner("biz_42"),
            DeepLinkRouter.resolveString("pantopus://businesses/biz_42"),
        )
        assertEquals(
            DeepLinkRouter.Destination.BusinessOwner("biz_42"),
            DeepLinkRouter.resolveString("https://pantopus.app/businesses/biz_42"),
        )
    }

    /** A10.6 — the singular `business/:username` resolves to the public profile. */
    @Test
    fun business_profile_route() {
        assertEquals(
            DeepLinkRouter.Destination.BusinessProfile("biz_42"),
            DeepLinkRouter.resolveString("pantopus://business/biz_42"),
        )
        assertEquals(
            DeepLinkRouter.Destination.BusinessProfile("acme"),
            DeepLinkRouter.resolveString("https://pantopus.app/business/acme"),
        )
    }

    /** P4.2 — `businesses/:id/page-editor` opens the owner-only A13.10 editor. */
    @Test
    fun edit_business_page_route() {
        assertEquals(
            DeepLinkRouter.Destination.EditBusinessPage("biz_42"),
            DeepLinkRouter.resolveString("pantopus://businesses/biz_42/page-editor"),
        )
        assertEquals(
            DeepLinkRouter.Destination.EditBusinessPage("biz_42"),
            DeepLinkRouter.resolveString("https://pantopus.app/businesses/biz_42/page-editor"),
        )
    }

    @Test
    fun view_as_route() {
        assertEquals(DeepLinkRouter.Destination.ViewAs, DeepLinkRouter.resolveString("pantopus://identity/preview"))
        assertEquals(
            DeepLinkRouter.Destination.ViewAs,
            DeepLinkRouter.resolveString("https://pantopus.app/identity/preview"),
        )
    }

    @Test
    fun waiting_room_route() {
        assertEquals(
            DeepLinkRouter.Destination.WaitingRoom("h_5"),
            DeepLinkRouter.resolveString("pantopus://homes/h_5/waiting-room"),
        )
        assertEquals(
            DeepLinkRouter.Destination.WaitingRoom("h_5"),
            DeepLinkRouter.resolveString("https://pantopus.app/homes/h_5/waiting-room"),
        )
    }

    // MARK: - WS1.4 auth-aware dispatch (DeepLinkRouter.apply)

    /**
     * Signed in, a content destination goes straight to `pending` and nothing
     * is persisted — there is no login to defer past.
     */
    @Test
    fun signed_in_content_link_publishes_without_stashing() {
        DeepLinkRouter.handle("/post/abc-123")

        assertEquals(DeepLinkRouter.Destination.Post("abc-123"), DeepLinkRouter.pending.value)
        assertNull(PendingDeepLinkStore.peek())
        assertFalse(DeepLinkRouter.prefersLoginPresentation.value)
    }

    /**
     * Signed out, a content destination is parked in [PendingDeepLinkStore]
     * for post-login replay instead of being published — native has no
     * signed-out content browser, so routing it now would drop it. The
     * normalized `pantopus://…` form is what gets persisted.
     */
    @Test
    fun signed_out_content_link_is_stashed_and_not_published() {
        signedIn = false

        DeepLinkRouter.handle("/post/abc-123")

        assertNull(DeepLinkRouter.pending.value)
        assertEquals("pantopus://post/abc-123", PendingDeepLinkStore.peek())
        assertTrue(DeepLinkRouter.prefersLoginPresentation.value)
    }

    /** HTTPS content links collapse to the custom scheme before being stashed. */
    @Test
    fun signed_out_https_content_link_is_stashed_in_custom_scheme_form() {
        signedIn = false

        DeepLinkRouter.handle("https://pantopus.app/gigs/g_2")

        assertNull(DeepLinkRouter.pending.value)
        assertEquals("pantopus://gigs/g_2", PendingDeepLinkStore.peek())
    }

    /**
     * The stashed form stays percent-encoded — decoding it would turn an
     * encoded `/` inside an identifier into a real separator and replay a
     * different link. Mirrors iOS `testSignedOutHTTPSContentKeepsPercentEncoding`.
     */
    @Test
    fun signed_out_https_content_link_keeps_percent_encoding() {
        signedIn = false

        DeepLinkRouter.handle("https://pantopus.app/post/a%2Fb")

        assertEquals("pantopus://post/a%2Fb", PendingDeepLinkStore.peek())
    }

    /**
     * Reset-password is auth-owned: the auth stack can render it while signed
     * out, so it publishes immediately, asks for the login presentation, and
     * is never written to disk (the recovery token must not outlive the
     * process).
     */
    @Test
    fun signed_out_reset_password_publishes_and_is_never_persisted() {
        signedIn = false

        DeepLinkRouter.handle("pantopus://auth/reset-password?token=hashed-recovery")

        assertEquals(
            DeepLinkRouter.Destination.ResetPassword("hashed-recovery"),
            DeepLinkRouter.pending.value,
        )
        assertTrue(DeepLinkRouter.prefersLoginPresentation.value)
        assertNull(PendingDeepLinkStore.peek())
    }

    /** Same contract as reset-password for the verify-email sibling. */
    @Test
    fun signed_out_verify_email_publishes_and_is_never_persisted() {
        signedIn = false

        DeepLinkRouter.handle("https://pantopus.app/auth/verify-email?token=tok&email=alice@example.com")

        assertEquals(
            DeepLinkRouter.Destination.VerifyEmail(token = "tok", email = "alice@example.com"),
            DeepLinkRouter.pending.value,
        )
        assertTrue(DeepLinkRouter.prefersLoginPresentation.value)
        assertNull(PendingDeepLinkStore.peek())
    }

    /** Unknown is discarded outright — no stash, no pending, no login prompt. */
    @Test
    fun signed_out_unknown_link_is_discarded() {
        signedIn = false

        DeepLinkRouter.handle("pantopus://wat")

        assertNull(DeepLinkRouter.pending.value)
        assertNull(PendingDeepLinkStore.peek())
        assertFalse(DeepLinkRouter.prefersLoginPresentation.value)
    }

    /**
     * End-to-end of the deferred path, mirroring `PantopusNavHost`'s
     * `!SignedIn -> SignedIn` transition: acknowledge the login prompt, take
     * the stash, hand it back to the router. The stash is one-shot.
     */
    @Test
    fun stashed_link_replays_once_signed_in() {
        signedIn = false
        DeepLinkRouter.handle("https://pantopus.app/homes/h_1/dashboard")
        assertNull(DeepLinkRouter.pending.value)

        signedIn = true
        DeepLinkRouter.acknowledgeLoginPresentation()
        val replayed = requireNotNull(PendingDeepLinkStore.take())
        assertEquals("pantopus://homes/h_1/dashboard", replayed)
        DeepLinkRouter.handle(replayed)

        assertEquals(DeepLinkRouter.Destination.HomeDashboard("h_1"), DeepLinkRouter.consume())
        assertNull(PendingDeepLinkStore.peek())
        assertFalse(DeepLinkRouter.prefersLoginPresentation.value)
    }

    private companion object {
        /**
         * The production default of `DeepLinkRouter.signedInProvider` — it is
         * only rebound for real when `AuthRepository` is constructed, which
         * never happens on the JVM. Restored after every case so this suite
         * can't leak a signed-in router into another one.
         */
        private val DEFAULT_SIGNED_IN_PROVIDER: () -> Boolean = { false }

        private const val PROBE_PATH = "pantopus://__probe__"

        private var storeInstalled = false

        /**
         * [PendingDeepLinkStore] is SharedPreferences-backed and silently
         * no-ops until `init`, and there is no real `Context` on the JVM — so
         * install an in-memory stand-in. `init` is write-once per process,
         * hence the flag plus the round-trip check.
         */
        fun installInMemoryPendingDeepLinkStore() {
            if (storeInstalled) return
            storeInstalled = true
            PendingDeepLinkStore.init(inMemoryPrefsContext())
            PendingDeepLinkStore.stash(PROBE_PATH)
            check(PendingDeepLinkStore.take() == PROBE_PATH) {
                "PendingDeepLinkStore was already initialised elsewhere in this JVM; " +
                    "DeepLinkRouterTest needs the in-memory stand-in to observe the stash."
            }
        }

        /** A `Context` whose SharedPreferences are a plain in-memory map. */
        fun inMemoryPrefsContext(): Context {
            val values = mutableMapOf<String, Any>()
            val editor = mockk<SharedPreferences.Editor>(relaxed = true)
            every { editor.putString(any(), any()) } answers {
                val value = secondArg<String?>()
                if (value == null) values.remove(firstArg<String>()) else values[firstArg()] = value
                editor
            }
            every { editor.putLong(any(), any()) } answers {
                values[firstArg()] = secondArg<Long>()
                editor
            }
            every { editor.clear() } answers {
                values.clear()
                editor
            }
            val prefs = mockk<SharedPreferences>(relaxed = true)
            every { prefs.edit() } returns editor
            every { prefs.getString(any(), any()) } answers {
                values[firstArg<String>()] as? String ?: secondArg<String?>()
            }
            every { prefs.getLong(any(), any()) } answers {
                values[firstArg<String>()] as? Long ?: secondArg<Long>()
            }
            val context = mockk<Context>(relaxed = true)
            every { context.applicationContext } returns context
            // `getSharedPreferences` is overloaded (String and File); pin the
            // name arg so the String overload resolves.
            every { context.getSharedPreferences(any<String>(), any()) } returns prefs
            return context
        }
    }
}
