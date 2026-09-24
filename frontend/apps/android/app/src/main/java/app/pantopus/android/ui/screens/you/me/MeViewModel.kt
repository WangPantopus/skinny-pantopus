@file:Suppress("MagicNumber", "PackageNaming", "TooManyFunctions", "LongMethod")

package app.pantopus.android.ui.screens.you.me

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.BuildConfig
import app.pantopus.android.data.api.models.businesses.BusinessMembership
import app.pantopus.android.data.api.models.homes.MyHome
import app.pantopus.android.data.api.models.users.InviteProgressDto
import app.pantopus.android.data.api.models.users.MonthlyReceiptDto
import app.pantopus.android.data.api.models.users.UserProfile
import app.pantopus.android.data.api.models.users.UserStatsDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.businesses.BusinessesRepository
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.data.profile.ProfileInsightsRepository
import app.pantopus.android.data.profile.ProfileRepository
import app.pantopus.android.ui.theme.PantopusIcon
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.LocalDate
import javax.inject.Inject

/** Top-level render state for the Me tab. */
sealed interface MeUiState {
    data object Loading : MeUiState

    data class Loaded(
        val personal: MeIdentityContent,
        val home: MeIdentityContent,
        val business: MeIdentityContent,
        val showBusiness: Boolean = true,
    ) : MeUiState

    data class Error(val message: String) : MeUiState
}

/** Me tab view-model. */
@HiltViewModel
class MeViewModel
    @Inject
    constructor(
        private val profileRepo: ProfileRepository,
        private val homesRepo: HomesRepository,
        private val insightsRepo: ProfileInsightsRepository,
        private val businessesRepo: BusinessesRepository,
    ) : ViewModel() {
        private val _state = MutableStateFlow<MeUiState>(MeUiState.Loading)
        val state: StateFlow<MeUiState> = _state.asStateFlow()

        private val _activeIdentity = MutableStateFlow(MeIdentity.Personal)
        val activeIdentity: StateFlow<MeIdentity> = _activeIdentity.asStateFlow()

        /**
         * Monthly Receipt for the completed month
         * (`GET /api/users/me/monthly-receipt`). Null hides the card — RN does
         * the same when the fetch fails.
         */
        private val _monthlyReceipt = MutableStateFlow<MonthlyReceiptDto?>(null)
        val monthlyReceipt: StateFlow<MonthlyReceiptDto?> = _monthlyReceipt.asStateFlow()

        /** Invite / referral progress (`GET /api/users/me/invite-progress`). */
        private val _inviteProgress = MutableStateFlow<InviteProgressDto?>(null)
        val inviteProgress: StateFlow<InviteProgressDto?> = _inviteProgress.asStateFlow()

        /** Stable invite code (`GET /api/users/me/invite-code`) for the share link. */
        private val _inviteCode = MutableStateFlow<String?>(null)
        val inviteCode: StateFlow<String?> = _inviteCode.asStateFlow()

        private var clock: () -> LocalDate = { LocalDate.now() }
        private var loadJob: Job? = null
        private var businessReadFailed = false

        /** Share text for the receipt card — RN `handleShareReceipt`. */
        fun receiptShareMessage(): String? = _monthlyReceipt.value?.let(MonthlyReceiptFormat::shareMessage)

        /**
         * Share text for the invite CTA — RN `handleShareInvite`. Null until a
         * real invite code has loaded: a made-up code would share a dead link.
         */
        fun inviteShareMessage(): String? {
            val code = _inviteCode.value?.takeIf { it.isNotEmpty() } ?: return null
            return "Join me on Pantopus! Use my invite code to get started: " +
                "https://pantopus.com/join/$code"
        }

        fun load() {
            if (_state.value is MeUiState.Loaded && !businessReadFailed) return
            fetch()
        }

        fun refresh() = fetch()

        fun selectIdentity(identity: MeIdentity) {
            if (_activeIdentity.value == identity) return
            _activeIdentity.value = identity
        }

        private fun fetch() {
            if (loadJob?.isActive == true) return
            loadJob =
                viewModelScope.launch {
                    val profileDeferred = async { profileRepo.ownProfile() }
                    val homesDeferred = async { homesRepo.myHomes() }
                    val businessesDeferred = async { businessesRepo.myBusinesses() }
                    val profileResult = profileDeferred.await()
                    val homesResult = homesDeferred.await()
                    val businessesResult = businessesDeferred.await()
                    businessReadFailed = businessesResult is NetworkResult.Failure
                    val businesses = (businessesResult as? NetworkResult.Success)?.data?.businesses
                    val showBusiness = businesses == null || businesses.isNotEmpty()
                    if (!showBusiness && _activeIdentity.value == MeIdentity.Business) _activeIdentity.value = MeIdentity.Personal

                    val profile =
                        (profileResult as? NetworkResult.Success)?.data?.user
                            ?: run {
                                val message =
                                    (profileResult as? NetworkResult.Failure)
                                        ?.error?.message
                                        ?: "Couldn't load your profile."
                                _state.value = MeUiState.Error(message)
                                return@launch
                            }
                    val homes: List<MyHome> =
                        (homesResult as? NetworkResult.Success)?.data?.sharedHomes.orEmpty()
                    // A failed homes read must not read as "No shared Home".
                    val homesFailed = homesResult is NetworkResult.Failure

                    val stats =
                        (profileRepo.stats(profile.id) as? NetworkResult.Success)?.data

                    _state.value =
                        MeUiState.Loaded(
                            personal = buildPersonal(profile, stats),
                            home = buildHome(homes, profileLocality = localityOf(profile), homesFailed = homesFailed),
                            business = buildBusiness(businesses?.firstOrNull(), businesses == null),
                            showBusiness = showBusiness,
                        )
                    fetchInsights()
                }
        }

        /**
         * Monthly Receipt + invite progress + invite code. All three degrade to
         * a hidden card rather than failing the tab, matching RN's
         * `Promise.allSettled` handling in `(tabs)/profile.tsx:117`.
         */
        private suspend fun fetchInsights() {
            val (year, month) = receiptPeriod(clock())
            _monthlyReceipt.value =
                (insightsRepo.monthlyReceipt(year, month) as? NetworkResult.Success)?.data
            _inviteProgress.value =
                (insightsRepo.inviteProgress() as? NetworkResult.Success)?.data
            _inviteCode.value =
                (insightsRepo.inviteCode() as? NetworkResult.Success)?.data?.inviteCode
        }

        /** Test seam — pin the clock so the receipt period is deterministic. */
        internal fun overrideClock(provider: () -> LocalDate) {
            clock = provider
        }

        companion object {
            /**
             * The month the receipt covers: the previous calendar month,
             * 1-based — mirrors RN `fetchReceipt`
             * (`(tabs)/profile.tsx:102`).
             */
            fun receiptPeriod(today: LocalDate): Pair<Int, Int> {
                val previous = today.minusMonths(1)
                return previous.year to previous.monthValue
            }
        }

        private fun buildPersonal(
            profile: UserProfile,
            stats: UserStatsDto?,
        ): MeIdentityContent {
            val name =
                profile.name.orEmpty().ifEmpty {
                    listOfNotNull(profile.firstName, profile.lastName)
                        .filter { it.isNotEmpty() }
                        .joinToString(" ")
                }
            val displayName = name.ifEmpty { "Pantopus user" }
            val tagline = profile.tagline?.takeIf { it.isNotEmpty() } ?: profile.bio
            val activityValue = "${stats?.totalGigsCompleted ?: profile.gigsCompleted ?: 0}"
            val residencyVerified = profile.residency?.get("verified") == true
            val trustValue = if (residencyVerified) "Verified" else "Pending"
            val reputationValue = ratingString(stats?.averageRating ?: profile.averageRating ?: 0.0)
            return MeIdentityContent(
                identity = MeIdentity.Personal,
                displayName = displayName,
                initials = initials(displayName),
                handle = "@${profile.username}",
                locality = localityOf(profile),
                tagline = tagline,
                verified = residencyVerified,
                stats =
                    listOf(
                        MeStat("activity", activityValue, "Activity"),
                        MeStat("trust", trustValue, "Trust"),
                        MeStat("reputation", reputationValue, "Reputation"),
                    ),
                actionTiles =
                    listOf(
                        MeActionTile("posts", PantopusIcon.File, "My posts", routeKey = "me.posts"),
                        MeActionTile("bids", PantopusIcon.Hammer, "My bids", routeKey = "me.bids"),
                        MeActionTile("gigs", PantopusIcon.ClipboardList, "My tasks", routeKey = "me.gigs"),
                        MeActionTile("offers", PantopusIcon.HandCoins, "Offers", routeKey = "me.offers"),
                        MeActionTile("listings", PantopusIcon.ShoppingBag, "Listings", routeKey = "me.listings"),
                        MeActionTile("connections", PantopusIcon.UserPlus, "Connections", routeKey = "me.connections"),
                        MeActionTile(
                            "supportTrains",
                            PantopusIcon.HandCoins,
                            "Support trains",
                            routeKey = "me.supportTrains",
                        ),
                    ),
                sections =
                    withDebug(
                        listOf(
                            MeSection(
                                id = "profile_privacy",
                                header = "Profile & Privacy",
                                rows =
                                    listOf(
                                        MeSectionRow("edit", PantopusIcon.Edit2, "Edit profile", routeKey = "me.editProfile"),
                                        MeSectionRow(
                                            "identityCenter",
                                            PantopusIcon.Shield,
                                            "Identity Center",
                                            routeKey = "me.identityCenter",
                                        ),
                                        MeSectionRow(
                                            "audience",
                                            PantopusIcon.Megaphone,
                                            "Audience profile",
                                            routeKey = "me.audience",
                                        ),
                                        MeSectionRow(
                                            "creatorInbox",
                                            PantopusIcon.Inbox,
                                            "Creator inbox",
                                            routeKey = "me.creatorInbox",
                                        ),
                                    ),
                            ),
                            MeSection(
                                id = "activity",
                                header = "Activity",
                                rows =
                                    listOf(
                                        MeSectionRow("posts", PantopusIcon.File, "My posts", routeKey = "me.posts"),
                                        MeSectionRow("bids", PantopusIcon.Hammer, "My bids", routeKey = "me.bids"),
                                        MeSectionRow("gigs", PantopusIcon.ClipboardList, "My tasks", routeKey = "me.gigs"),
                                        MeSectionRow("offers", PantopusIcon.HandCoins, "Offers", routeKey = "me.offers"),
                                        MeSectionRow(
                                            "savedPlaces",
                                            PantopusIcon.Bookmark,
                                            "Saved places",
                                            routeKey = "me.savedPlaces",
                                            testTag = "savedPlaces.entry.profile",
                                        ),
                                        MeSectionRow("homes", PantopusIcon.Home, "My homes", routeKey = "me.homes"),
                                        MeSectionRow("businesses", PantopusIcon.ShoppingBag, "My businesses", routeKey = "me.businesses"),
                                        MeSectionRow("scheduling", PantopusIcon.Calendar, "Scheduling", routeKey = "me.scheduling.hub"),
                                    ),
                            ),
                            MeSection(
                                id = "help_legal",
                                header = "Help & Legal",
                                rows =
                                    listOf(
                                        MeSectionRow("help", PantopusIcon.HelpCircle, "Help", routeKey = "me.help"),
                                        MeSectionRow("terms", PantopusIcon.File, "Terms", routeKey = "me.legal"),
                                        MeSectionRow(
                                            "privacy",
                                            PantopusIcon.Shield,
                                            "Privacy",
                                            value = privacyValue(profile.profileVisibility),
                                            routeKey = "me.privacy",
                                        ),
                                    ),
                            ),
                        ),
                    ),
            )
        }

        private fun buildHome(
            homes: List<MyHome>,
            profileLocality: String?,
            homesFailed: Boolean = false,
        ): MeIdentityContent {
            val primary = homes.firstOrNull { it.isPrimaryOwner == true } ?: homes.firstOrNull()
            if (primary == null) {
                return MeIdentityContent(
                    identity = MeIdentity.Home,
                    displayName = "Your Homes",
                    initials = "H",
                    handle = if (homesFailed) "Couldn't load your homes" else "No shared Home",
                    locality = profileLocality,
                    tagline =
                        if (homesFailed) {
                            "Check your connection, then open My homes to try again."
                        } else {
                            "Open My homes for private tasks, invitations and verification progress."
                        },
                    verified = false,
                    stats =
                        listOf(
                            MeStat("bills", "—", "Bills due"),
                            MeStat("tasks", "—", "Open tasks"),
                            MeStat("members", "—", "Members"),
                        ),
                    actionTiles = homeActionTiles(homeId = null),
                    sections = withDebug(homeSections(homeId = null, homeName = null, privacyValue = null)),
                    isUnbound = true,
                )
            }
            val address = primary.address ?: "Your home"
            val displayName = primary.name?.takeIf { it.isNotEmpty() } ?: address
            val locality =
                listOfNotNull(primary.city, primary.state)
                    .filter { it.isNotEmpty() }
                    .joinToString(", ")
                    .takeIf { it.isNotEmpty() }
            // Only surface the address as a tagline when the display name
            // is a separate household name (e.g. "Cozy Hideout") —
            // otherwise the tagline would just repeat the title.
            val homeTagline = if (!primary.name.isNullOrEmpty()) primary.address else null
            return MeIdentityContent(
                identity = MeIdentity.Home,
                displayName = displayName,
                initials = initials(displayName),
                handle = if (primary.ownershipStatus == "verified") "Ownership verified" else "Shared Home",
                locality = locality ?: profileLocality,
                tagline = homeTagline,
                verified = false,
                stats =
                    listOf(
                        MeStat("bills", "—", "Bills due"),
                        MeStat("tasks", "—", "Open tasks"),
                        MeStat("members", "—", "Members"),
                    ),
                actionTiles = homeActionTiles(homeId = primary.id),
                sections =
                    withDebug(
                        homeSections(
                            homeId = primary.id,
                            homeName = displayName,
                            privacyValue = "Neighbors",
                        ),
                    ),
            )
        }

        private fun buildBusiness(
            membership: BusinessMembership?,
            failed: Boolean,
        ): MeIdentityContent {
            val business = membership?.business
            val name = business?.name?.takeIf { it.isNotBlank() } ?: "Your Businesses"
            val args = membership?.let { mapOf("businessId" to it.businessUserId) }.orEmpty()
            return MeIdentityContent(
                identity = MeIdentity.Business,
                displayName = name,
                initials = initials(name),
                handle = if (failed) "Couldn't load your businesses" else business?.username?.let { "@$it" } ?: "Business pages",
                locality =
                    listOfNotNull(
                        business?.city,
                        business?.state,
                    ).filter { it.isNotBlank() }.joinToString(", ").takeIf { it.isNotBlank() },
                tagline = if (failed) "Open My businesses to try again." else membership?.profile?.description,
                verified = false,
                stats = emptyList(),
                actionTiles = emptyList(),
                sections =
                    withDebug(
                        listOf(
                            MeSection(
                                "business",
                                "Business",
                                listOfNotNull(
                                    MeSectionRow("businesses", PantopusIcon.ShoppingBag, "My businesses", routeKey = "me.businesses"),
                                    MeSectionRow(
                                        "scheduling",
                                        PantopusIcon.Calendar,
                                        "Scheduling",
                                        routeKey = "me.business.scheduling",
                                        routeArgs = args,
                                    )
                                        .takeIf { membership != null },
                                    MeSectionRow("settings", PantopusIcon.Menu, "Settings", routeKey = "me.settings"),
                                ),
                            ),
                            MeSection(
                                "help_legal",
                                "Help & Legal",
                                listOf(
                                    MeSectionRow("help", PantopusIcon.HelpCircle, "Help", routeKey = "me.help"),
                                    MeSectionRow("terms", PantopusIcon.File, "Terms", routeKey = "me.legal"),
                                    MeSectionRow("privacy", PantopusIcon.Shield, "Privacy", routeKey = "me.privacy"),
                                ),
                            ),
                        ),
                    ),
                isUnbound = true,
            )
        }

        private fun homeActionTiles(homeId: String?): List<MeActionTile> {
            val args = if (homeId != null) mapOf("homeId" to homeId) else emptyMap()
            return listOf(
                MeActionTile("bills", PantopusIcon.File, "Bills", routeKey = "me.bills", routeArgs = args),
                MeActionTile(
                    "maintenance",
                    PantopusIcon.Hammer,
                    "Maintenance",
                    routeKey = "me.maintenance",
                    routeArgs = args,
                ),
                MeActionTile("pets", PantopusIcon.Heart, "Pets", routeKey = "me.pets", routeArgs = args),
                MeActionTile("members", PantopusIcon.UserPlus, "Members", routeKey = "me.members", routeArgs = args),
                MeActionTile("polls", PantopusIcon.CheckCircle, "Polls", routeKey = "me.polls", routeArgs = args),
                MeActionTile("calendar", PantopusIcon.Calendar, "Calendar", routeKey = "me.calendar", routeArgs = args),
                MeActionTile("docs", PantopusIcon.File, "Documents", routeKey = "me.docs", routeArgs = args),
            )
        }

        private fun homeSections(
            homeId: String?,
            homeName: String?,
            privacyValue: String?,
        ): List<MeSection> {
            val args = if (homeId != null) mapOf("homeId" to homeId) else emptyMap()
            // T6.4a — access codes additionally carry homeName so the
            // access screen's 2-line top bar can render the designed
            // "412 Birch Ln" subtitle without an extra fetch.
            val accessArgs =
                if (homeId != null && !homeName.isNullOrEmpty()) {
                    args + ("homeName" to homeName)
                } else {
                    args
                }
            return listOf(
                MeSection(
                    id = "household",
                    header = "Household",
                    rows =
                        listOf(
                            MeSectionRow("members", PantopusIcon.UserPlus, "Members", routeKey = "me.members", routeArgs = args),
                            MeSectionRow("owners", PantopusIcon.Shield, "Owners", routeKey = "me.owners", routeArgs = args),
                            MeSectionRow(
                                "access",
                                PantopusIcon.Lock,
                                "Access codes",
                                routeKey = "me.access",
                                routeArgs = accessArgs,
                            ),
                        ),
                ),
                MeSection(
                    id = "activity",
                    header = "Activity",
                    rows =
                        listOf(
                            MeSectionRow("bills", PantopusIcon.File, "Bills", routeKey = "me.bills", routeArgs = args),
                            MeSectionRow(
                                "maintenance",
                                PantopusIcon.Hammer,
                                "Maintenance",
                                routeKey = "me.maintenance",
                                routeArgs = args,
                            ),
                            MeSectionRow("tasks", PantopusIcon.Hammer, "Household tasks", routeKey = "me.tasks", routeArgs = args),
                            MeSectionRow("packages", PantopusIcon.Mailbox, "Packages", routeKey = "me.packages", routeArgs = args),
                            MeSectionRow(
                                "emergency",
                                PantopusIcon.Shield,
                                "Emergency info",
                                routeKey = "me.emergency",
                                routeArgs = args,
                            ),
                            MeSectionRow(
                                "scheduling",
                                PantopusIcon.Calendar,
                                "Scheduling",
                                routeKey = "me.home.scheduling",
                                routeArgs = args,
                            ),
                        ),
                ),
                MeSection(
                    id = "help_legal",
                    header = "Help & Legal",
                    rows =
                        listOf(
                            MeSectionRow("help", PantopusIcon.HelpCircle, "Help", routeKey = "me.help"),
                            MeSectionRow("terms", PantopusIcon.File, "Terms", routeKey = "me.legal"),
                            MeSectionRow(
                                "privacy",
                                PantopusIcon.Shield,
                                "Privacy",
                                value = privacyValue,
                                routeKey = "me.home.privacy",
                                routeArgs = args,
                            ),
                        ),
                ),
            )
        }

        private fun withDebug(sections: List<MeSection>): List<MeSection> {
            if (!BuildConfig.DEBUG) return sections
            return sections +
                MeSection(
                    id = "debug",
                    header = "Debug",
                    rows =
                        listOf(
                            MeSectionRow(
                                "openProfile",
                                PantopusIcon.Search,
                                "Open public profile by ID",
                                routeKey = "me.debug.openProfile",
                            ),
                            MeSectionRow(
                                "openPost",
                                PantopusIcon.Search,
                                "Open Pulse post by ID",
                                routeKey = "me.debug.openPost",
                            ),
                            MeSectionRow(
                                "openHandshake",
                                PantopusIcon.UserPlus,
                                "Open Privacy Handshake by persona handle",
                                routeKey = "me.debug.openHandshake",
                            ),
                            MeSectionRow(
                                "openInviteToken",
                                PantopusIcon.Mailbox,
                                "Open invite by token",
                                routeKey = "me.debug.openInviteToken",
                            ),
                            MeSectionRow(
                                "openCeremonialMail",
                                PantopusIcon.Send,
                                "Open Ceremonial Mail Compose",
                                routeKey = "me.debug.openCeremonialMail",
                            ),
                            MeSectionRow(
                                "openCeremonialMailOpen",
                                PantopusIcon.Mailbox,
                                "Open Ceremonial Mail by ID",
                                routeKey = "me.debug.openCeremonialMailOpen",
                            ),
                            MeSectionRow(
                                "inviteOwner",
                                PantopusIcon.UserPlus,
                                "Invite owner to home by ID",
                                routeKey = "me.debug.inviteOwner",
                            ),
                            MeSectionRow(
                                "disambiguate",
                                PantopusIcon.Mailbox,
                                "Disambiguate mail by ID",
                                routeKey = "me.debug.disambiguate",
                            ),
                        ),
                )
        }

        private fun localityOf(profile: UserProfile): String? {
            val parts = listOfNotNull(profile.city, profile.state).filter { it.isNotEmpty() }
            return parts.takeIf { it.isNotEmpty() }?.joinToString(", ")
        }

        private fun initials(name: String): String {
            val parts = name.split(" ").take(2)
            val result = parts.mapNotNull { it.firstOrNull()?.toString() }.joinToString("").uppercase()
            return result.ifEmpty { "?" }
        }

        private fun ratingString(rating: Double): String = if (rating > 0) "%.1f".format(rating) else "—"

        private fun privacyValue(visibility: String?): String? =
            when (visibility?.lowercase()) {
                "public" -> "Public"
                "registered" -> "Neighbors"
                "private" -> "Strict"
                else -> null
            }
    }
