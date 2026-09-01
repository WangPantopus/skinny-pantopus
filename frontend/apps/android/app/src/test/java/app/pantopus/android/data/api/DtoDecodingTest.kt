package app.pantopus.android.data.api

import app.pantopus.android.data.api.models.auth.LoginResponse
import app.pantopus.android.data.api.models.auth.RefreshResponse
import app.pantopus.android.data.api.models.homes.CheckAddressResponse
import app.pantopus.android.data.api.models.homes.HomePublicProfileResponse
import app.pantopus.android.data.api.models.homes.MyHomesResponse
import app.pantopus.android.data.api.models.hub.HubDiscoveryResponse
import app.pantopus.android.data.api.models.hub.HubResponse
import app.pantopus.android.data.api.models.hub.HubTodayResponse
import app.pantopus.android.data.api.models.mailbox.AckResponse
import app.pantopus.android.data.api.models.mailbox.MailboxListResponse
import app.pantopus.android.data.api.models.mailbox.v2.DrawerListResponse
import app.pantopus.android.data.api.models.mailbox.v2.PackageStatusUpdateResponse
import app.pantopus.android.data.api.models.users.ProfileResponse
import com.squareup.moshi.Moshi
import com.squareup.moshi.adapters.Rfc3339DateJsonAdapter
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant

/**
 * Decode a representative JSON for each Prompt P3 endpoint and assert key
 * fields. Locks the DTO shapes in place.
 */
class DtoDecodingTest {
    private val moshi: Moshi =
        Moshi
            .Builder()
            .add(Instant::class.java, Rfc3339DateJsonAdapter().nullSafe())
            .addLast(KotlinJsonAdapterFactory())
            .build()

    private inline fun <reified T> decode(json: String): T = checkNotNull(moshi.adapter(T::class.java).fromJson(json))

    @Test fun login_response() {
        val json = """
            {"message":"ok","accessToken":"at","refreshToken":"rt","expiresIn":3600,"expiresAt":1800000000,
             "user":{"id":"u","email":"a@b","username":"a","name":"A B","firstName":"A","middleName":null,
                     "lastName":"B","phoneNumber":null,"address":null,"city":null,"state":null,"zipcode":null,
                     "accountType":"personal","role":"member","verified":true,"createdAt":"2025-01-01T00:00:00Z"}}
        """
        val response = decode<LoginResponse>(json)
        assertEquals("at", response.accessToken)
        assertEquals("A", response.user.firstName)
    }

    @Test fun refresh_response() {
        val json = """{"ok":true,"accessToken":"at2","expiresAt":1800000001}"""
        val response = decode<RefreshResponse>(json)
        assertTrue(response.ok)
        assertEquals("at2", response.accessToken)
    }

    @Test fun profile_response() {
        val json = """
            {"user":{"id":"u","email":"a@b","username":"a","firstName":"A","middleName":null,
                     "lastName":"B","name":"A B","phoneNumber":null,"dateOfBirth":null,"address":null,
                     "city":null,"state":null,"zipcode":null,"accountType":"personal","role":"member",
                     "verified":true,"residency":null,"avatar_url":null,"profile_picture_url":null,
                     "profilePicture":null,"bio":null,"tagline":null,"socialLinks":null,"skills":null,
                     "followers_count":null,"average_rating":null,"gigs_posted":null,"gigs_completed":null,
                     "profileVisibility":null,"createdAt":"2025-01-01T00:00:00Z","updatedAt":"2025-01-01T00:00:00Z"},
             "invite_progress":null}
        """
        val response = decode<ProfileResponse>(json)
        assertEquals("u", response.user.id)
    }

    @Test fun hub_response() {
        val json = """
            {"user":{"id":"u","name":"A","firstName":"A","username":"a","avatarUrl":null,"email":"a@b"},
             "context":{"activeHomeId":null,"activePersona":{"type":"personal"}},
             "availability":{"hasHome":false,"hasBusiness":false,"hasPayoutMethod":false},
             "homes":[],"businesses":[],
             "setup":{"steps":[],"allDone":true,
                      "profileCompleteness":{"score":1.0,
                        "checks":{"firstName":true,"lastName":true,"photo":true,"bio":true,"skills":true},
                        "missingFields":[]}},
             "statusItems":[],
             "cards":{"personal":{"unreadChats":0,"earnings":0,"gigsNearby":0,"rating":0,"reviewCount":0},
                      "home":null,"business":null},
             "jumpBackIn":[],"activity":[],"neighborDensity":null}
        """
        val response = decode<HubResponse>(json)
        assertEquals("personal", response.context.activePersona.type)
        assertEquals(1.0, response.setup.profileCompleteness.score, 0.0001)
    }

    @Test fun hub_today_allows_unknown_payload() {
        val json = """{"today":{"weather":{"temperatureF":72}}}"""
        val response = decode<HubTodayResponse>(json)
        assertNotNull(response.today)
    }

    @Test fun hub_discovery() {
        val json = """{"items":[{"id":"g1","type":"gig","title":"Mow","meta":"$40","category":"yard","avatarUrl":null,"route":"/g/g1"}]}"""
        val response = decode<HubDiscoveryResponse>(json)
        assertEquals("yard", response.items[0].category)
    }

    @Test fun my_homes() {
        val json = """
            {"homes":[{"id":"h1","name":"Main","address":"1 Main","city":"X","state":"CA","zipcode":"90000",
                      "home_type":"single_family","visibility":"public","description":null,
                      "created_at":"2025-01-01T00:00:00Z","updated_at":null,
                      "occupancy":null,"ownership_status":"verified","verification_tier":"attom",
                      "is_primary_owner":true,"pending_claim_id":null}]}
        """
        val response = decode<MyHomesResponse>(json)
        assertEquals(1, response.homes.size)
        assertEquals("verified", response.homes[0].ownershipStatus)
    }

    @Test fun home_public_profile() {
        val json = """
            {"home":{"id":"h1","name":null,"address":"1 Main","city":"X","state":"CA","zipcode":"90000",
                     "home_type":"single_family","visibility":"public","description":null,
                     "created_at":"2025-01-01T00:00:00Z","hasVerifiedOwner":false,"verifiedOwner":null,
                     "userMembershipStatus":"none","userResidencyClaim":null,"memberCount":0,"nearbyGigs":3}}
        """
        val response = decode<HomePublicProfileResponse>(json)
        assertEquals(3, response.home.nearbyGigs)
    }

    @Test fun check_address() {
        val json = """{"exists":true,"homeCount":2,"hasVerifiedMembers":false,"verdict_status":null}"""
        val response = decode<CheckAddressResponse>(json)
        assertTrue(response.exists)
        assertEquals(2, response.homeCount)
    }

    @Test fun mailbox_list() {
        val json = """
            {"mail":[{"id":"m1","type":"notice","viewed":false,"archived":false,"starred":false,
                     "tags":["urgent"],"priority":"normal","attachments":null,
                     "created_at":"2025-01-01T00:00:00Z"}],"count":1}
        """
        val response = decode<MailboxListResponse>(json)
        assertEquals(1, response.count)
        assertEquals(listOf("urgent"), response.mail[0].tags)
    }

    @Test fun ack_response() {
        val json = """{"message":"ok","ackStatus":"acknowledged"}"""
        assertEquals("acknowledged", decode<AckResponse>(json).ackStatus)
    }

    @Test fun drawer_list() {
        val json = """
            {"drawers":[{"drawer":"personal","display_name":"Personal","icon":"inbox",
                       "unread_count":3,"urgent_count":1,"last_item_at":"2025-02-01T00:00:00Z"}]}
        """
        val response = decode<DrawerListResponse>(json)
        assertEquals("Personal", response.drawers[0].displayName)
    }

    @Test fun package_status_update() {
        val json = """{"message":"ok","status":"delivered","previousStatus":"out_for_delivery"}"""
        val response = decode<PackageStatusUpdateResponse>(json)
        assertEquals("delivered", response.status)
    }
}
