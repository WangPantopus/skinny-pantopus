@file:Suppress(
    "UnusedPrivateMember",
    "LongMethod",
    "PackageNaming",
    "MagicNumber",
    "LongParameterList",
    "CyclomaticComplexMethod",
)

package app.pantopus.android.ui.screens.you

import androidx.compose.material3.AlertDialog
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.pantopus.android.BuildConfig
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.scheduling.SchedulingOwner
import app.pantopus.android.ui.screens.you.me.MeView
import app.pantopus.android.ui.theme.PantopusColors
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/** Test-tag constants for the You screen. */
object YouScreenTags {
    const val SIGN_OUT_BUTTON = "youSignOutButton"
    const val CONFIRM_DIALOG = "youSignOutDialog"
    const val EMAIL_LABEL = "youEmailLabel"
}

/** Auth bridge for [YouScreen]. */
@HiltViewModel
class YouViewModel
    @Inject
    constructor(
        private val authRepository: AuthRepository,
    ) : ViewModel() {
        val authState: StateFlow<AuthRepository.State> = authRepository.state

        fun signOut() = viewModelScope.launch { authRepository.signOut() }
    }

/**
 * "You" tab — the user's identity command center. Hosts [MeView] in
 * the body and keeps the sign-out confirmation + DEBUG deep-link
 * dialogs that the legacy screen exposed.
 *
 * @param onOpenPublicProfile Debug-build hook for the "Open public
 *     profile by ID" affordance.
 * @param onOpenPulsePost Debug-build hook for the "Open Pulse post by
 *     ID" affordance.
 * @param onOpenMailbox Pushed by the Personal Mail action tile.
 * @param onOpenPlaceholder Catch-all for action / section taps whose
 *     dedicated screen doesn't exist yet.
 * @param onOpenEditProfile Pushed by the Personal "Edit profile"
 *     section row.
 */
@Composable
fun YouScreen(
    viewModel: YouViewModel = hiltViewModel(),
    /** True when opened from the `monthly_receipt` push (`?tab=receipt`) —
     *  the Monthly Receipt card renders expanded. */
    expandMonthlyReceipt: Boolean = false,
    onOpenPublicProfile: (String) -> Unit = {},
    onOpenPulsePost: (String) -> Unit = {},
    onInviteOwner: (String, String) -> Unit = { _, _ -> },
    onDisambiguateMail: (String) -> Unit = {},
    onOpenPrivacyHandshake: (String) -> Unit = {},
    onOpenInviteToken: (String) -> Unit = {},
    onOpenCeremonialMail: () -> Unit = {},
    onOpenCeremonialMailOpen: (String) -> Unit = {},
    onOpenPlaceholder: (String) -> Unit = {},
    onOpenMailbox: () -> Unit = {},
    onOpenEditProfile: () -> Unit = {},
    onOpenSettings: () -> Unit = {},
    onOpenHelp: () -> Unit = {},
    onOpenLegal: () -> Unit = {},
    onOpenPrivacySettings: () -> Unit = {},
    onOpenOffers: () -> Unit = {},
    onOpenMyBids: () -> Unit = {},
    onOpenMyTasks: () -> Unit = {},
    onOpenMyPosts: () -> Unit = {},
    onOpenConnections: () -> Unit = {},
    onOpenSupportTrains: () -> Unit = {},
    onOpenIdentityCenter: () -> Unit = {},
    onOpenAudienceProfile: () -> Unit = {},
    onOpenCreatorInbox: () -> Unit = {},
    onOpenSavedPlaces: () -> Unit = {},
    onOpenHomeBills: (String) -> Unit = {},
    onOpenHomePets: (String) -> Unit = {},
    onOpenHomeCalendar: (String) -> Unit = {},
    onOpenHomePackages: (String) -> Unit = {},
    onOpenHomePolls: (String) -> Unit = {},
    onOpenAccessCodes: (homeId: String, homeName: String?) -> Unit = { _, _ -> },
    onOpenHomeTasks: (String) -> Unit = {},
    onOpenHomeMaintenance: (String) -> Unit = {},
    onOpenHomeOwners: (String) -> Unit = {},
    onOpenHomeMembers: (String) -> Unit = {},
    onOpenHomeDocs: (String) -> Unit = {},
    onOpenHomeEmergency: (String) -> Unit = {},
    onOpenMyHomes: () -> Unit = {},
    onOpenMyListings: () -> Unit = {},
    onOpenMyBusinesses: () -> Unit = {},
    onOpenScheduling: (SchedulingOwner) -> Unit = {},
) {
    val state by viewModel.authState.collectAsStateWithLifecycle()
    val signedIn = state as? AuthRepository.State.SignedIn
    var confirmVisible by remember { mutableStateOf(false) }
    var debugProfileDialog by remember { mutableStateOf(false) }
    var debugPostDialog by remember { mutableStateOf(false) }
    var debugInviteDialog by remember { mutableStateOf(false) }
    var debugDisambiguateDialog by remember { mutableStateOf(false) }
    var debugHandshakeDialog by remember { mutableStateOf(false) }
    var debugInviteTokenDialog by remember { mutableStateOf(false) }
    var debugCeremonialMailOpenDialog by remember { mutableStateOf(false) }
    var debugCeremonialMailOpenId by remember { mutableStateOf("") }
    var debugProfileId by remember { mutableStateOf("") }
    var debugPostId by remember { mutableStateOf("") }
    var debugInviteHomeId by remember { mutableStateOf("") }
    var debugDisambiguateMailId by remember { mutableStateOf("") }
    var debugHandshakeHandle by remember { mutableStateOf("") }
    var debugInviteToken by remember { mutableStateOf("") }

    MeView(
        expandMonthlyReceipt = expandMonthlyReceipt,
        onAction = { tile ->
            when (tile.routeKey) {
                "me.mail" -> onOpenMailbox()
                "me.bids" -> onOpenMyBids()
                "me.gigs" -> onOpenMyTasks()
                "me.posts" -> onOpenMyPosts()
                "me.offers" -> onOpenOffers()
                "me.connections" -> onOpenConnections()
                "me.supportTrains" -> onOpenSupportTrains()
                "me.listings" -> onOpenMyListings()
                "me.businesses" -> onOpenMyBusinesses()
                "me.homes" -> onOpenMyHomes()
                "me.bills" -> {
                    val homeId = tile.routeArgs["homeId"].orEmpty()
                    if (homeId.isNotEmpty()) onOpenHomeBills(homeId) else onOpenMyHomes()
                }
                "me.pets" -> {
                    val homeId = tile.routeArgs["homeId"].orEmpty()
                    if (homeId.isNotEmpty()) onOpenHomePets(homeId) else onOpenMyHomes()
                }
                "me.calendar" -> {
                    val homeId = tile.routeArgs["homeId"].orEmpty()
                    if (homeId.isNotEmpty()) {
                        onOpenHomeCalendar(homeId)
                    } else {
                        onOpenMyHomes()
                    }
                }
                "me.packages" -> {
                    val homeId = tile.routeArgs["homeId"].orEmpty()
                    if (homeId.isNotEmpty()) onOpenHomePackages(homeId) else onOpenMyHomes()
                }
                "me.polls" -> {
                    val homeId = tile.routeArgs["homeId"].orEmpty()
                    if (homeId.isNotEmpty()) onOpenHomePolls(homeId) else onOpenMyHomes()
                }
                "me.tasks" -> {
                    val homeId = tile.routeArgs["homeId"].orEmpty()
                    if (homeId.isNotEmpty()) onOpenHomeTasks(homeId) else onOpenMyHomes()
                }
                "me.maintenance" -> {
                    val homeId = tile.routeArgs["homeId"].orEmpty()
                    if (homeId.isNotEmpty()) onOpenHomeMaintenance(homeId) else onOpenMyHomes()
                }
                "me.members" -> {
                    val homeId = tile.routeArgs["homeId"].orEmpty()
                    if (homeId.isNotEmpty()) onOpenHomeMembers(homeId) else onOpenMyHomes()
                }
                "me.docs" -> {
                    val homeId = tile.routeArgs["homeId"].orEmpty()
                    if (homeId.isNotEmpty()) onOpenHomeDocs(homeId) else onOpenMyHomes()
                }
                // The Business identity is always unbound here; My businesses
                // lists, creates and claims businesses.
                "me.business.orders", "me.business.products", "me.business.payouts",
                "me.business.team", "me.business.hours", "me.business.promo",
                -> onOpenMyBusinesses()
                else -> onOpenPlaceholder(tile.label)
            }
        },
        onSection = { row ->
            when (row.routeKey) {
                "me.posts" -> onOpenMyPosts()
                "me.bids" -> onOpenMyBids()
                "me.gigs" -> onOpenMyTasks()
                "me.offers" -> onOpenOffers()
                "me.connections" -> onOpenConnections()
                "me.supportTrains" -> onOpenSupportTrains()
                "me.homes" -> onOpenMyHomes()
                "me.listings" -> onOpenMyListings()
                "me.businesses" -> onOpenMyBusinesses()
                "me.identityCenter" -> onOpenIdentityCenter()
                "me.audience" -> onOpenAudienceProfile()
                "me.creatorInbox" -> onOpenCreatorInbox()
                "me.savedPlaces" -> onOpenSavedPlaces()
                "me.bills" -> {
                    val homeId = row.routeArgs["homeId"].orEmpty()
                    if (homeId.isNotEmpty()) onOpenHomeBills(homeId) else onOpenMyHomes()
                }
                "me.packages" -> {
                    val homeId = row.routeArgs["homeId"].orEmpty()
                    if (homeId.isNotEmpty()) onOpenHomePackages(homeId) else onOpenMyHomes()
                }
                "me.polls" -> {
                    val homeId = row.routeArgs["homeId"].orEmpty()
                    if (homeId.isNotEmpty()) onOpenHomePolls(homeId) else onOpenMyHomes()
                }
                "me.access" -> {
                    val homeId = row.routeArgs["homeId"].orEmpty()
                    val homeName = row.routeArgs["homeName"]
                    if (homeId.isNotEmpty()) {
                        onOpenAccessCodes(homeId, homeName)
                    } else {
                        onOpenMyHomes()
                    }
                }
                "me.tasks" -> {
                    val homeId = row.routeArgs["homeId"].orEmpty()
                    if (homeId.isNotEmpty()) onOpenHomeTasks(homeId) else onOpenMyHomes()
                }
                "me.maintenance" -> {
                    val homeId = row.routeArgs["homeId"].orEmpty()
                    if (homeId.isNotEmpty()) onOpenHomeMaintenance(homeId) else onOpenMyHomes()
                }
                "me.owners" -> {
                    val homeId = row.routeArgs["homeId"].orEmpty()
                    if (homeId.isNotEmpty()) onOpenHomeOwners(homeId) else onOpenMyHomes()
                }
                "me.members" -> {
                    val homeId = row.routeArgs["homeId"].orEmpty()
                    if (homeId.isNotEmpty()) onOpenHomeMembers(homeId) else onOpenMyHomes()
                }
                "me.emergency" -> {
                    val homeId = row.routeArgs["homeId"].orEmpty()
                    if (homeId.isNotEmpty()) onOpenHomeEmergency(homeId) else onOpenMyHomes()
                }
                "me.business.editProfile" -> onOpenMyBusinesses()
                "me.editProfile" -> onOpenEditProfile()
                "me.settings" -> onOpenSettings()
                "me.help" -> onOpenHelp()
                "me.legal" -> onOpenLegal()
                "me.privacy", "me.home.privacy" -> onOpenPrivacySettings()
                "me.scheduling.hub" -> onOpenScheduling(SchedulingOwner.Personal)
                "me.business.scheduling" -> row.routeArgs["businessId"]?.let { onOpenScheduling(SchedulingOwner.Business(it)) }
                "me.home.scheduling" -> row.routeArgs["homeId"]?.let { onOpenScheduling(SchedulingOwner.Home(it)) }
                "me.debug.openProfile" -> if (BuildConfig.DEBUG) debugProfileDialog = true
                "me.debug.openPost" -> if (BuildConfig.DEBUG) debugPostDialog = true
                "me.debug.inviteOwner" -> if (BuildConfig.DEBUG) debugInviteDialog = true
                "me.debug.disambiguate" -> if (BuildConfig.DEBUG) debugDisambiguateDialog = true
                "me.debug.openHandshake" -> if (BuildConfig.DEBUG) debugHandshakeDialog = true
                "me.debug.openInviteToken" -> if (BuildConfig.DEBUG) debugInviteTokenDialog = true
                "me.debug.openCeremonialMail" -> if (BuildConfig.DEBUG) onOpenCeremonialMail()
                "me.debug.openCeremonialMailOpen" -> if (BuildConfig.DEBUG) debugCeremonialMailOpenDialog = true
                else -> onOpenPlaceholder(row.label)
            }
        },
        onLogOut = { confirmVisible = true },
    )

    if (confirmVisible) {
        AlertDialog(
            onDismissRequest = { confirmVisible = false },
            title = { Text("Sign out of Pantopus?") },
            text = { Text("You'll need to sign in again to access your hub.") },
            modifier = Modifier.testTag(YouScreenTags.CONFIRM_DIALOG),
            confirmButton = {
                TextButton(onClick = {
                    confirmVisible = false
                    viewModel.signOut()
                }) {
                    Text("Sign out", color = PantopusColors.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { confirmVisible = false }) { Text("Cancel") }
            },
        )
    }

    if (BuildConfig.DEBUG && debugProfileDialog) {
        AlertDialog(
            onDismissRequest = { debugProfileDialog = false },
            title = { Text("Open profile") },
            text = {
                OutlinedTextField(
                    value = debugProfileId,
                    onValueChange = { debugProfileId = it },
                    label = { Text("User ID") },
                    singleLine = true,
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    val id = debugProfileId.trim()
                    debugProfileDialog = false
                    if (id.isNotEmpty()) {
                        debugProfileId = ""
                        onOpenPublicProfile(id)
                    }
                }) { Text("Open") }
            },
            dismissButton = {
                TextButton(onClick = { debugProfileDialog = false }) { Text("Cancel") }
            },
        )
    }

    if (BuildConfig.DEBUG && debugPostDialog) {
        AlertDialog(
            onDismissRequest = { debugPostDialog = false },
            title = { Text("Open post") },
            text = {
                OutlinedTextField(
                    value = debugPostId,
                    onValueChange = { debugPostId = it },
                    label = { Text("Post ID") },
                    singleLine = true,
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    val id = debugPostId.trim()
                    debugPostDialog = false
                    if (id.isNotEmpty()) {
                        debugPostId = ""
                        onOpenPulsePost(id)
                    }
                }) { Text("Open") }
            },
            dismissButton = {
                TextButton(onClick = { debugPostDialog = false }) { Text("Cancel") }
            },
        )
    }

    if (BuildConfig.DEBUG && debugInviteDialog) {
        val currentEmail = signedIn?.user?.email.orEmpty()
        AlertDialog(
            onDismissRequest = { debugInviteDialog = false },
            title = { Text("Invite owner") },
            text = {
                OutlinedTextField(
                    value = debugInviteHomeId,
                    onValueChange = { debugInviteHomeId = it },
                    label = { Text("Home ID") },
                    singleLine = true,
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    val id = debugInviteHomeId.trim()
                    debugInviteDialog = false
                    if (id.isNotEmpty()) {
                        debugInviteHomeId = ""
                        onInviteOwner(id, currentEmail)
                    }
                }) { Text("Open") }
            },
            dismissButton = {
                TextButton(onClick = { debugInviteDialog = false }) { Text("Cancel") }
            },
        )
    }

    if (BuildConfig.DEBUG && debugDisambiguateDialog) {
        AlertDialog(
            onDismissRequest = { debugDisambiguateDialog = false },
            title = { Text("Disambiguate mail") },
            text = {
                OutlinedTextField(
                    value = debugDisambiguateMailId,
                    onValueChange = { debugDisambiguateMailId = it },
                    label = { Text("Mail ID") },
                    singleLine = true,
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    val id = debugDisambiguateMailId.trim()
                    debugDisambiguateDialog = false
                    if (id.isNotEmpty()) {
                        debugDisambiguateMailId = ""
                        onDisambiguateMail(id)
                    }
                }) { Text("Open") }
            },
            dismissButton = {
                TextButton(onClick = { debugDisambiguateDialog = false }) { Text("Cancel") }
            },
        )
    }

    if (BuildConfig.DEBUG && debugHandshakeDialog) {
        AlertDialog(
            onDismissRequest = { debugHandshakeDialog = false },
            title = { Text("Open Privacy Handshake") },
            text = {
                OutlinedTextField(
                    value = debugHandshakeHandle,
                    onValueChange = { debugHandshakeHandle = it },
                    label = { Text("Persona handle") },
                    singleLine = true,
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    val handle = debugHandshakeHandle.trim()
                    debugHandshakeDialog = false
                    if (handle.isNotEmpty()) {
                        debugHandshakeHandle = ""
                        onOpenPrivacyHandshake(handle)
                    }
                }) { Text("Open") }
            },
            dismissButton = {
                TextButton(onClick = { debugHandshakeDialog = false }) { Text("Cancel") }
            },
        )
    }

    if (BuildConfig.DEBUG && debugInviteTokenDialog) {
        AlertDialog(
            onDismissRequest = { debugInviteTokenDialog = false },
            title = { Text("Open invite by token") },
            text = {
                OutlinedTextField(
                    value = debugInviteToken,
                    onValueChange = { debugInviteToken = it },
                    label = { Text("Invite token") },
                    singleLine = true,
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    val token = debugInviteToken.trim()
                    debugInviteTokenDialog = false
                    if (token.isNotEmpty()) {
                        debugInviteToken = ""
                        onOpenInviteToken(token)
                    }
                }) { Text("Open") }
            },
            dismissButton = {
                TextButton(onClick = { debugInviteTokenDialog = false }) { Text("Cancel") }
            },
        )
    }

    if (BuildConfig.DEBUG && debugCeremonialMailOpenDialog) {
        AlertDialog(
            onDismissRequest = { debugCeremonialMailOpenDialog = false },
            title = { Text("Open Ceremonial Mail") },
            text = {
                OutlinedTextField(
                    value = debugCeremonialMailOpenId,
                    onValueChange = { debugCeremonialMailOpenId = it },
                    label = { Text("Mail ID") },
                    singleLine = true,
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    val id = debugCeremonialMailOpenId.trim()
                    debugCeremonialMailOpenDialog = false
                    if (id.isNotEmpty()) {
                        debugCeremonialMailOpenId = ""
                        onOpenCeremonialMailOpen(id)
                    }
                }) { Text("Open") }
            },
            dismissButton = {
                TextButton(onClick = { debugCeremonialMailOpenDialog = false }) { Text("Cancel") }
            },
        )
    }
}
