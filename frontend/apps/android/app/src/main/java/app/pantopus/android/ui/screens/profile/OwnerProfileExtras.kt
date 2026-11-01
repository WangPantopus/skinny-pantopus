@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.profile

import app.pantopus.android.data.api.models.feed.FeedPost
import app.pantopus.android.data.api.models.profile.PublicProfileDto
import app.pantopus.android.data.api.models.users.InviteProgressDto
import app.pantopus.android.data.api.models.users.MonthlyReceiptDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.identity.LocalProfileRepository
import app.pantopus.android.data.posts.PostsRepository
import app.pantopus.android.data.profile.ProfileInsightsRepository
import app.pantopus.android.data.profile.ProfileRepository
import app.pantopus.android.data.profile.ProfileTipsStore
import app.pantopus.android.data.relationships.RelationshipsRepository
import app.pantopus.android.ui.screens.feed.pulse.PulsePostCardContent
import app.pantopus.android.ui.screens.you.me.MonthlyReceiptFormat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.Month
import java.time.format.TextStyle
import java.util.Locale

/** What only your own profile shows (PRF step 2, `Own.dc.html`), read once the page is known to be yours. */
data class OwnerExtras(
    /** The name and photo neighbors see (your Local Profile); null until read. The header shows these, not the account's. */
    val neighborName: String? = null,
    val neighborPhoto: String? = null,
    /** True once `GET /api/local-profiles/me` answered, so [neighborPhoto] null means "no photo", not "unknown". */
    val localProfileRead: Boolean = false,
    /** Your account's name: only in the gray "stays private" line, when it differs from [neighborName]. */
    val accountName: String? = null,
    /** Last month's receipt; the "Your <month>" line shows only when it isn't all zero. */
    val receipt: MonthlyReceiptDto? = null,
    val invite: InviteProgressDto? = null,
    val inviteCode: String? = null,
    /** Accepted connections on the read's first page (at most [CONNECTIONS_PAGE]); null hides the count. */
    val connections: Int? = null,
    val dismissedTips: Set<String> = emptySet(),
) {
    /** "Your account name, Rowan Park-Lee, stays private." when the two names differ. */
    val accountNameLine: String?
        get() {
            val account = accountName?.trim().orEmpty()
            val neighbor = neighborName?.trim().orEmpty()
            if (account.isEmpty() || neighbor.isEmpty() || account == neighbor) return null
            return "Your account name, $account, stays private."
        }

    val connectionsLabel: String?
        get() = connections?.let { if (it >= CONNECTIONS_PAGE) "$it+" else "$it" }
}

/** The relationships read's page size, so a full page reads "50+". */
internal const val CONNECTIONS_PAGE = 50

/** The tips your profile can show only you, in the order they're offered (at most 2 at a time). */
enum class OwnerTip(val key: String) {
    Photo("photo"),
    Tagline("tagline"),
    Skills("skills"),
    Prompt("prompt"),
    Pin("pin"),
}

/**
 * Reads what your own page adds: your Local Profile (the name and photo neighbors see, and your account name for the
 * "stays private" line), last month's receipt, invite progress and code, and your connections count. Each part that
 * fails simply stays hidden. Tips you close are remembered on this phone ([ProfileTipsStore]).
 */
class OwnerProfileExtras(
    private val scope: CoroutineScope,
    private val localProfiles: LocalProfileRepository,
    private val insights: ProfileInsightsRepository,
    private val relationships: RelationshipsRepository,
    private val tips: ProfileTipsStore,
    private val today: () -> LocalDate = { LocalDate.now() },
) {
    private val _extras = MutableStateFlow<OwnerExtras?>(null)
    val extras: StateFlow<OwnerExtras?> = _extras.asStateFlow()

    private var ownerId: String? = null
    private var job: Job? = null

    fun load(
        userId: String,
        force: Boolean,
    ) {
        if (ownerId != userId) {
            ownerId = userId
            job?.cancel()
            _extras.value = OwnerExtras(dismissedTips = tips.dismissed(userId))
        }
        if (job?.isActive == true) return
        job =
            scope.launch {
                val me = async { localProfiles.me() }
                val period = receiptPeriod(today())
                val receipt = async { insights.monthlyReceipt(period.first, period.second) }
                val invite = async { insights.inviteProgressStored(force) }
                val code = async { insights.inviteCodeStored(force) }
                val connections = async { relationships.list(status = "accepted", limit = CONNECTIONS_PAGE, force = force) }
                val profile = (me.await() as? NetworkResult.Success)?.data
                val current = _extras.value ?: OwnerExtras()
                _extras.value =
                    current.copy(
                        neighborName = profile?.profile?.displayName ?: current.neighborName,
                        neighborPhoto = if (profile != null) profile.profile.avatarUrl else current.neighborPhoto,
                        localProfileRead = current.localProfileRead || profile != null,
                        accountName = profile?.account?.displayName ?: current.accountName,
                        receipt = (receipt.await() as? NetworkResult.Success)?.data ?: current.receipt,
                        invite = invite.await().data ?: current.invite,
                        inviteCode = code.await().data?.inviteCode ?: current.inviteCode,
                        connections =
                            (connections.await() as? NetworkResult.Success)?.data?.relationships?.size ?: current.connections,
                    )
            }
    }

    fun dismissTip(tip: OwnerTip) {
        val id = ownerId ?: return
        tips.dismiss(id, tip.key)
        _extras.value = _extras.value?.let { it.copy(dismissedTips = it.dismissedTips + tip.key) }
    }

    fun receiptShareMessage(): String? = _extras.value?.receipt?.let(MonthlyReceiptFormat::shareMessage)

    /** Share text for the invite (RN `handleShareInvite`); null until a real code loaded, so no dead link is shared. */
    fun inviteShareMessage(): String? {
        val code = _extras.value?.inviteCode?.takeIf { it.isNotEmpty() } ?: return null
        return "Join me on Pantopus! Use my invite code to get started: " +
            "https://pantopus.com/join/$code"
    }

    companion object {
        /** The receipt covers the previous calendar month, 1-based (as the Me screen read it). */
        fun receiptPeriod(today: LocalDate): Pair<Int, Int> {
            val previous = today.minusMonths(1)
            return previous.year to previous.monthValue
        }
    }
}

/** "Your October" and "2 neighbors helped · 3 posts", or null when last month was all zero. */
internal fun ownerMonthLine(receipt: MonthlyReceiptDto): Pair<String, String>? {
    val c = receipt.community
    val parts =
        listOfNotNull(
            c.neighborsHelped.takeIf { it > 0 }?.let { "$it ${if (it == 1) "neighbor" else "neighbors"} helped" },
            c.postsCreated.takeIf { it > 0 }?.let { "$it ${if (it == 1) "post" else "posts"}" },
            c.connectionsMade.takeIf { it > 0 }?.let { "$it new ${if (it == 1) "connection" else "connections"}" },
        )
    if (parts.isEmpty()) return null
    val month =
        runCatching { Month.of(receipt.period.month).getDisplayName(TextStyle.FULL, Locale.US) }.getOrNull()
            ?: return null
    return "Your $month" to parts.joinToString(" · ")
}

/** Who a preview shows the page as (`?as=`, CONTRACT SRV-1). */
enum class PreviewAudience(
    val apiValue: String,
    val label: String,
    val detail: String,
    val banner: String,
    val bannerDetail: String,
) {
    Anyone(
        "anyone",
        "Anyone with the link",
        "People who aren't signed in, like someone you text your link to.",
        "Previewing as anyone with the link",
        "What people who aren't signed in see.",
    ),
    Neighbors(
        "neighbors",
        "Neighbors",
        "People on Pantopus you aren't connected to.",
        "Previewing as neighbors",
        "What neighbors you aren't connected to see.",
    ),
    Connections(
        "connections",
        "Your connections",
        "They also see posts you shared only with connections.",
        "Previewing as your connections",
        "What your connections see.",
    ),
}

/** The page as one audience sees it, built from the server's `?as=` answers. */
sealed interface ProfilePreviewState {
    val audience: PreviewAudience

    data class Loading(override val audience: PreviewAudience) : ProfilePreviewState

    data class Loaded(
        override val audience: PreviewAudience,
        val content: PublicProfileContent,
        val cards: List<PulsePostCardContent>,
        /** `as=anyone`: signed-out visitors can't read posts, so the page says "Posts are for neighbors". */
        val signInRequired: Boolean,
        /** The pinned posts that audience sees (none for `anyone`). */
        val pinned: List<FeedPost> = emptyList(),
    ) : ProfilePreviewState

    /** That audience can't open your profile at all (private, or "Who can find you" narrower than them). */
    data class Closed(override val audience: PreviewAudience) : ProfilePreviewState

    data class Failed(override val audience: PreviewAudience) : ProfilePreviewState
}

/**
 * Preview as (owner only): reads your profile and posts exactly as one audience gets them (`?as=`, CONTRACT SRV-1) and
 * builds the page from them with [content]. A 403 means that audience can't open your profile at all. Never stored.
 */
class ProfilePreviewLoader(
    private val scope: CoroutineScope,
    private val profiles: ProfileRepository,
    private val posts: PostsRepository,
    private val content: (PublicProfileDto, List<FeedPost>) -> PublicProfileContent,
) {
    private val _state = MutableStateFlow<ProfilePreviewState?>(null)
    val state: StateFlow<ProfilePreviewState?> = _state.asStateFlow()

    fun start(
        userId: String,
        audience: PreviewAudience,
    ) {
        _state.value = ProfilePreviewState.Loading(audience)
        scope.launch {
            val next =
                when (val profile = profiles.previewProfile(userId, audience.apiValue)) {
                    is NetworkResult.Failure ->
                        if (profile.error == NetworkError.Forbidden) {
                            ProfilePreviewState.Closed(audience)
                        } else {
                            ProfilePreviewState.Failed(audience)
                        }
                    is NetworkResult.Success -> {
                        val rows = (posts.previewProfilePosts(userId, audience.apiValue) as? NetworkResult.Success)?.data
                        val shown = rows?.posts.orEmpty()
                        val pinned = (posts.previewPinnedPosts(userId, audience.apiValue) as? NetworkResult.Success)?.data?.posts
                        ProfilePreviewState.Loaded(
                            pinned = pinned.orEmpty(),
                            audience = audience,
                            content = content(profile.data, shown),
                            cards = shown.map(::profilePreviewCard),
                            signInRequired = rows?.signInRequired == true || audience == PreviewAudience.Anyone,
                        )
                    }
                }
            // Done (or another audience) since: drop this answer.
            if (_state.value?.audience == audience && _state.value !is ProfilePreviewState.Loaded) _state.value = next
        }
    }

    fun end() {
        _state.value = null
    }
}

/** Where the owner page's rows and buttons go; each app destination passes its navigation. */
data class OwnerNavigation(
    val onSeeAllPosts: () -> Unit = {},
    val onOpenConnections: () -> Unit = {},
    val onOpenSupportTrains: () -> Unit = {},
    val onOpenSavedPlaces: () -> Unit = {},
    val onOpenSettings: () -> Unit = {},
    val onOpenHelp: () -> Unit = {},
    /** Signs out; the page asks first. */
    val onLogOut: () -> Unit = {},
    /** Debug builds only: the developer rows the Me screen had (route key → label). */
    val debugRows: List<Pair<String, String>> = emptyList(),
    val onDebugRow: (String) -> Unit = {},
)
