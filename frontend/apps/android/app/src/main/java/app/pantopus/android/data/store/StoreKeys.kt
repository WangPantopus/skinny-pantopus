package app.pantopus.android.data.store

import app.pantopus.android.data.api.models.businesses.MyBusinessesResponse
import app.pantopus.android.data.api.models.chats.ChatMessagesResponse
import app.pantopus.android.data.api.models.chats.UnifiedConversationsResponse
import app.pantopus.android.data.api.models.connections.BlockedRelationshipsResponse
import app.pantopus.android.data.api.models.connections.SentRequestsResponse
import app.pantopus.android.data.api.models.feed.FeedPreferencesResponse
import app.pantopus.android.data.api.models.feed.FeedResponse
import app.pantopus.android.data.api.models.homedashboard.HomeDashboardResponse
import app.pantopus.android.data.api.models.homes.MyHomesResponse
import app.pantopus.android.data.api.models.hub.HubDiscoveryResponse
import app.pantopus.android.data.api.models.hub.HubResponse
import app.pantopus.android.data.api.models.hub.HubTodayResponse
import app.pantopus.android.data.api.models.hub.NotificationPreferences
import app.pantopus.android.data.api.models.location.ViewingLocationPayload
import app.pantopus.android.data.api.models.neighborhood.NeighborhoodCells
import app.pantopus.android.data.api.models.neighborhood.NeighborhoodMeter
import app.pantopus.android.data.api.models.notifications.NotificationUnreadCountResponse
import app.pantopus.android.data.api.models.notifications.NotificationsListResponse
import app.pantopus.android.data.api.models.place.PlaceIntelligence
import app.pantopus.android.data.api.models.place.PlaceSectionId
import app.pantopus.android.data.api.models.posts.MyPostsResponse
import app.pantopus.android.data.api.models.posts.PostDetailResponse
import app.pantopus.android.data.api.models.posts.SavedPostsResponse
import app.pantopus.android.data.api.models.profile.PublicProfileDto
import app.pantopus.android.data.api.models.relationships.PendingRequestsResponse
import app.pantopus.android.data.api.models.relationships.RelationshipsListResponse
import app.pantopus.android.data.api.models.saved_places.SavedPlacesListResponse
import app.pantopus.android.data.api.models.settings.PrivacySettingsResponse
import app.pantopus.android.data.api.models.support_trains.SupportTrainsListResponse
import app.pantopus.android.data.api.models.support_trains.SupportTrainsNearbyResponse
import app.pantopus.android.data.api.models.users.InviteCodeDto
import app.pantopus.android.data.api.models.users.InviteProgressDto
import app.pantopus.android.data.api.models.users.ProfileResponse
import app.pantopus.android.data.posts.FeedQuery

/** Change topics (contract §8) that more than one key or repository names. */
object StoreTopics {
    /** The viewer's notifications: one created, read or deleted. */
    const val NOTIFICATIONS = "notifications"

    /** The viewer's own profile and settings (a name, username or photo saved, here or on another device). */
    const val PROFILE_ME = "profile:me"

    /** The viewer's conversation list: a chat created or left, a message sent or read. */
    const val CHATS = "chats"

    /** Client-only: the viewer posted, edited or deleted a post, so the feeds' first pages go out of date. */
    const val POSTS = "posts"

    /** The viewer's list of homes: a home added, claimed, verified, left or deleted. */
    const val HOMES = "homes"

    /** Today: a task, pickup day, calendar or briefing change (contract §8). */
    const val TODAY = "today"
}

/** The store's keys, one per endpoint and parameters it caches, with their kind and change topics (contract §4, §8). */
@Suppress("TooManyFunctions") // Declarative endpoint keys form the single audited cache allowlist.
object StoreKeys {
    fun relationships(
        status: String?,
        limit: Int = 50,
        offset: Int = 0,
    ) = StoreKey<RelationshipsListResponse>(
        "api/relationships",
        mapOf("status" to status, "limit" to limit.toString(), "offset" to offset.toString()),
        kind = StoreKind.PEOPLE,
        topics = setOf(StoreTopics.PROFILE_ME),
    )

    val pendingConnections =
        StoreKey<PendingRequestsResponse>(
            "api/relationships/requests/pending",
            kind = StoreKind.PEOPLE,
            topics = setOf(StoreTopics.PROFILE_ME),
        )
    val sentConnections =
        StoreKey<SentRequestsResponse>(
            "api/relationships/requests/sent",
            kind = StoreKind.PEOPLE,
            topics = setOf(StoreTopics.PROFILE_ME),
        )
    val blockedConnections =
        StoreKey<BlockedRelationshipsResponse>(
            "api/relationships/blocked",
            kind = StoreKind.PEOPLE,
            topics = setOf(StoreTopics.PROFILE_ME),
        )

    /** Search privacy preferences are copied in memory and removed after a PATCH. */
    val privacySettings =
        StoreKey<PrivacySettingsResponse>(
            "api/privacy/settings",
            kind = StoreKind.YOU,
            topics = setOf(StoreTopics.PROFILE_ME),
        )

    /** Private bookmarks share one memory copy; household/Today signals include SavedPlace changes. */
    val savedPlaces =
        StoreKey<SavedPlacesListResponse>(
            "api/saved-places",
            kind = StoreKind.YOU,
            topics = setOf(StoreTopics.HOMES, StoreTopics.TODAY),
        )

    /** Public Today facts for the viewer's saved place; a deleted bookmark refuses the copy. */
    fun savedPlaceToday(id: String) =
        StoreKey<PlaceIntelligence>(
            "api/saved-places/$id/today",
            kind = StoreKind.TODAY,
            topics = setOf(StoreTopics.TODAY, "place:$id"),
            type = PlaceIntelligence::class.java,
        )

    /** My Homes: one source for every screen that lists the viewer's homes. */
    val myHomes =
        StoreKey<MyHomesResponse>(
            "api/homes/my-homes",
            kind = StoreKind.HOMES,
            topics = setOf(StoreTopics.HOMES),
            type = MyHomesResponse::class.java,
        )

    /**
     * The sections the Today tab renders (contract §8 "Today on the phones"): weather and its sky, air, alerts, the
     * sun, "Good day to…", radon, the address calendar, the home and block for the sky drawing, and the ballot card.
     */
    val TODAY_SECTIONS: List<PlaceSectionId> =
        listOf(
            PlaceSectionId.WEATHER,
            PlaceSectionId.AIR_QUALITY,
            PlaceSectionId.ALERTS,
            PlaceSectionId.SUNRISE_SUNSET,
            PlaceSectionId.GOOD_DAY_TO,
            PlaceSectionId.LEAD_RADON,
            PlaceSectionId.ADDRESS_CALENDAR,
            PlaceSectionId.YOUR_HOME,
            PlaceSectionId.BLOCK_DENSITY,
            PlaceSectionId.CIVIC_ELECTION,
        )

    /** `?sections=` as the server reads it. */
    val todaySectionsQuery: String = TODAY_SECTIONS.joinToString(",") { it.raw }

    /** The viewer's notification and briefing preferences (their own settings). */
    val notificationPreferences =
        StoreKey<NotificationPreferences>(
            "api/hub/preferences",
            kind = StoreKind.YOU,
            topics = setOf("profile:me"),
            type = NotificationPreferences::class.java,
        )

    /** Support Trains the viewer organizes or helps with (first page), for My trains and Invitations. */
    val mySupportTrains =
        StoreKey<SupportTrainsListResponse>(
            "api/activities/support-trains/me/support-trains",
            mapOf("limit" to "20", "offset" to "0"),
            kind = StoreKind.SUPPORT_TRAINS,
            topics = setOf("supporttrain:*"),
        )

    /** Support Trains near [latitude], [longitude] (rounded with [roundCoordinate] before they get here). */
    fun nearbySupportTrains(
        latitude: Double,
        longitude: Double,
    ) = StoreKey<SupportTrainsNearbyResponse>(
        "api/activities/support-trains/nearby",
        mapOf("latitude" to latitude.toString(), "longitude" to longitude.toString(), "limit" to "40"),
        kind = StoreKind.SUPPORT_TRAINS,
        topics = setOf("supporttrain:*"),
    )

    /** Three decimals (about 110 m): a key, and the request it names, for a nearby search. */
    fun roundCoordinate(value: Double): Double = kotlin.math.round(value * COORDINATE_SCALE) / COORDINATE_SCALE

    private const val COORDINATE_SCALE = 1000.0

    /** The area the viewer chose in the Nearby context bar (`GET /api/location`; kind You: fresh 10 minutes). */
    val viewingLocation = StoreKey<ViewingLocationPayload>("api/location", kind = StoreKind.YOU, topics = setOf(StoreTopics.PROFILE_ME))

    /** The first page of one feed query (contract §4 "Nearby": fresh 2 minutes); later pages are never stored. */
    fun feedFirstPage(query: FeedQuery) =
        StoreKey<FeedResponse>(
            "api/posts/feed",
            mapOf(
                "surface" to query.surface,
                "latitude" to query.latitude?.toString(),
                "longitude" to query.longitude?.toString(),
                "radiusMiles" to query.radiusMiles?.toString(),
                "postType" to query.postType,
                "topic" to query.topic,
                "sportsMode" to query.sportsMode,
                "eventKey" to query.eventKey,
                "limit" to FeedQuery.PAGE_SIZE.toString(),
            ),
            kind = StoreKind.NEARBY,
            topics = setOf(StoreTopics.POSTS, StoreTopics.PROFILE_ME),
            type = FeedResponse::class.java,
        )

    fun publicProfile(
        identifier: String,
        byUsername: Boolean = false,
    ) = StoreKey<PublicProfileDto>(
        "api/users/${if (byUsername) "username" else "id"}/$identifier",
        kind = StoreKind.PEOPLE,
        topics = setOf("profile:$identifier", StoreTopics.PROFILE_ME),
    )

    fun userPosts(
        userId: String,
        limit: Int,
        includeArchived: Boolean,
    ) = StoreKey<MyPostsResponse>(
        "api/posts/user/$userId",
        mapOf("limit" to limit.toString(), "include_archived" to includeArchived.takeIf { it }?.toString()),
        kind = StoreKind.POST,
        topics = setOf(StoreTopics.POSTS, "profile:$userId"),
    )

    fun savedPosts(limit: Int) =
        StoreKey<SavedPostsResponse>(
            "api/posts/saved",
            mapOf("limit" to limit.toString()),
            kind = StoreKind.POST,
            topics = setOf(StoreTopics.POSTS, StoreTopics.PROFILE_ME),
        )

    val feedPreferences =
        StoreKey<FeedPreferencesResponse>(
            "api/posts/feed-preferences",
            kind = StoreKind.YOU,
            topics = setOf(StoreTopics.PROFILE_ME),
            type = FeedPreferencesResponse::class.java,
        )

    /** One post and its comments (contract §4 "A post": fresh 1 minute, never saved on the phone). */
    fun post(postId: String) =
        StoreKey<PostDetailResponse>("api/posts/$postId", kind = StoreKind.POST, topics = setOf("post:$postId", StoreTopics.POSTS))

    /** Message history is memory only: no Moshi type means these keys can never be saved. */
    fun roomMessages(
        roomId: String,
        limit: Int,
    ) = StoreKey<ChatMessagesResponse>(
        "api/chat/rooms/$roomId/messages",
        mapOf("limit" to limit.toString()),
        kind = StoreKind.CONVERSATION,
        topics = setOf("chat:$roomId", StoreTopics.CHATS),
    )

    fun conversationMessages(
        otherId: String,
        topicId: String?,
        limit: Int,
    ) = StoreKey<ChatMessagesResponse>(
        "api/chat/conversations/$otherId/messages",
        mapOf("limit" to limit.toString(), "topicId" to topicId),
        kind = StoreKind.CONVERSATION,
        topics = setOf("chat:*", StoreTopics.CHATS),
    )

    /**
     * The Messages list (contract §4 "Messages list"): names, last-message previews and unread counts, fresh for 30
     * seconds, shared by the Messages tab and its badge. Only this list may be saved to disk (founder decision 7).
     */
    val conversations =
        StoreKey<UnifiedConversationsResponse>(
            "api/chat/unified-conversations",
            mapOf("limit" to "100"),
            kind = StoreKind.MESSAGES_LIST,
            topics = setOf(StoreTopics.CHATS),
            type = UnifiedConversationsResponse::class.java,
        )

    /**
     * A home's Place for the viewer's role (the Place dashboard): every section, kind Place. A claim, verification or
     * household change marks it through `homes`, `home:` and `place:`.
     */
    fun place(homeId: String) =
        StoreKey<PlaceIntelligence>(
            "api/homes/$homeId/intelligence",
            mapOf("ballot" to "1"),
            kind = StoreKind.PLACE,
            topics = setOf("place:$homeId", "home:$homeId", StoreTopics.HOMES),
            type = PlaceIntelligence::class.java,
        )

    /**
     * The Nearby tab's density meter and map cells (contract §4 "Nearby": fresh 2 minutes, saved on the phone). They
     * follow the viewer's place, so a home added, left or verified marks them through `homes`.
     */
    val neighborhoodMeter =
        StoreKey<NeighborhoodMeter>(
            "api/neighborhood/meter",
            kind = StoreKind.NEARBY,
            topics = setOf(StoreTopics.HOMES),
            type = NeighborhoodMeter::class.java,
        )
    val neighborhoodCells =
        StoreKey<NeighborhoodCells>(
            "api/neighborhood/cells",
            kind = StoreKind.NEARBY,
            topics = setOf(StoreTopics.HOMES),
            type = NeighborhoodCells::class.java,
        )

    /** The bell's unread count (kind Notifications: fresh 30 seconds, never saved on the phone). */
    val notificationsUnreadCount =
        StoreKey<NotificationUnreadCountResponse>(
            "api/notifications/unread-count",
            kind = StoreKind.NOTIFICATIONS,
            topics = setOf(StoreTopics.NOTIFICATIONS),
        )

    /**
     * The Hub (the Place tab without a home): its overview, kind Homes (fresh 2 minutes), in memory only: the reply
     * carries bill status items and recent notifications, which are never saved on the phone. A name saved, a home, a
     * notification, a chat or Today changing marks it.
     */
    val hubOverview =
        StoreKey<HubResponse>(
            "api/hub",
            kind = StoreKind.HOMES,
            topics = setOf(StoreTopics.HOMES, StoreTopics.NOTIFICATIONS, StoreTopics.CHATS, StoreTopics.TODAY, StoreTopics.PROFILE_ME),
        )

    /** The Hub's Today card (kind Today: fresh 10 minutes; a reply that says it failed keeps the last copy). */
    val hubToday = StoreKey<HubTodayResponse>("api/hub/today", kind = StoreKind.TODAY, topics = setOf(StoreTopics.TODAY))

    /** The Hub's Discover rail for one filter tab (kind Nearby: fresh 2 minutes). */
    fun hubDiscovery(filter: String) =
        StoreKey<HubDiscoveryResponse>(
            "api/hub/discovery",
            mapOf("filter" to filter, "limit" to HUB_DISCOVERY_LIMIT.toString()),
            kind = StoreKind.NEARBY,
            topics = setOf(StoreTopics.HOMES),
        )

    /** How many Discover cards the Hub asks for. */
    const val HUB_DISCOVERY_LIMIT = 10

    /** The first page of one notifications list (a zone's context, all or unread); later pages are never stored. */
    fun notificationsFirstPage(
        limit: Int,
        unreadOnly: Boolean?,
        context: String?,
    ) = StoreKey<NotificationsListResponse>(
        "api/notifications",
        mapOf("limit" to "$limit", "offset" to "0", "unread" to unreadOnly?.toString(), "context" to context),
        kind = StoreKind.NOTIFICATIONS,
        topics = setOf(StoreTopics.NOTIFICATIONS),
    )

    /** The viewer's own profile (contract §4 "You": fresh 10 minutes). */
    val ownProfile =
        StoreKey<ProfileResponse>(
            "api/users/profile",
            kind = StoreKind.YOU,
            topics = setOf(StoreTopics.PROFILE_ME),
            type = ProfileResponse::class.java,
        )

    /** The businesses the viewer belongs to (the You tab's Business card). */
    val myBusinesses =
        StoreKey<MyBusinessesResponse>(
            "api/businesses/my-businesses",
            kind = StoreKind.YOU,
            topics = setOf(StoreTopics.PROFILE_ME),
            type = MyBusinessesResponse::class.java,
        )

    /** The viewer's invite progress and invite code (the You tab's invite card). */
    val inviteProgress =
        StoreKey<InviteProgressDto>(
            "api/users/me/invite-progress",
            kind = StoreKind.YOU,
            topics = setOf(StoreTopics.PROFILE_ME),
            type = InviteProgressDto::class.java,
        )
    val inviteCode =
        StoreKey<InviteCodeDto>(
            "api/users/me/invite-code",
            kind = StoreKind.YOU,
            topics = setOf(StoreTopics.PROFILE_ME),
            type = InviteCodeDto::class.java,
        )

    /**
     * A home's dashboard (household data: counts, members, recent activity), kind Homes. Shown from a copy only to
     * owners and household roles (founder decision 3); callers check `MyHome.showsCopyBeforeRecheck` first.
     */
    fun homeDashboard(homeId: String) =
        StoreKey<HomeDashboardResponse>(
            "api/homes/$homeId/dashboard",
            kind = StoreKind.HOMES,
            topics = setOf("home:$homeId", StoreTopics.HOMES),
        )

    /** A home's Today: [TODAY_SECTIONS] of its Place intelligence. */
    fun today(homeId: String) =
        StoreKey<PlaceIntelligence>(
            "api/homes/$homeId/intelligence",
            mapOf("ballot" to "1", "sections" to todaySectionsQuery),
            kind = StoreKind.TODAY,
            topics = setOf("today", "home:$homeId", "place:$homeId"),
            type = PlaceIntelligence::class.java,
        )
}
