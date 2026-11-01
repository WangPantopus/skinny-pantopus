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
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.pantopus.android.BuildConfig
import app.pantopus.android.core.LaunchFeatures
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.ui.components.closesKeyboardOnTapOrScroll
import app.pantopus.android.ui.screens.profile.OwnerNavigation
import app.pantopus.android.ui.screens.profile.PublicProfileScreen
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
 * ☰ → Your profile (PRF step 2): your own profile, the same page neighbors see, in owner mode, shown as a cover with
 * ✕ and Share. It replaces the Me dashboard; everything the dashboard opened stays reachable from "Your account", ☰
 * or the Place tab. Keeps the DEBUG deep-link dialogs (debug builds only, as rows under "Your account").
 *
 * @param expandMonthlyReceipt True when opened from the `monthly_receipt` push (`?tab=receipt`): last month opens
 *     in full.
 */
@Composable
fun YouScreen(
    viewModel: YouViewModel = hiltViewModel(),
    expandMonthlyReceipt: Boolean = false,
    onClose: () -> Unit = {},
    onOpenPublicProfile: (String) -> Unit = {},
    onOpenPulsePost: (String) -> Unit = {},
    onOpenGig: (String) -> Unit = {},
    onInviteOwner: (String, String) -> Unit = { _, _ -> },
    onDisambiguateMail: (String) -> Unit = {},
    onOpenPrivacyHandshake: (String) -> Unit = {},
    onOpenInviteToken: (String) -> Unit = {},
    onOpenCeremonialMail: () -> Unit = {},
    onOpenCeremonialMailOpen: (String) -> Unit = {},
    onOpenEditProfile: () -> Unit = {},
    onOpenSettings: () -> Unit = {},
    onOpenHelp: () -> Unit = {},
    onOpenMyPosts: () -> Unit = {},
    onOpenConnections: () -> Unit = {},
    onOpenSupportTrains: () -> Unit = {},
    onOpenSavedPlaces: () -> Unit = {},
) {
    // The debug "Invite owner" dialog fills in the signed-in email.
    val signedIn = viewModel.authState.collectAsStateWithLifecycle().value as? AuthRepository.State.SignedIn
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

    PublicProfileScreen(
        onBack = onClose,
        onOpenGig = onOpenGig,
        onOpenProfile = onOpenPublicProfile,
        onOpenPost = onOpenPulsePost,
        onEditProfile = onOpenEditProfile,
        ownerCover = true,
        expandMonthlyReceipt = expandMonthlyReceipt,
        ownerNavigation =
            OwnerNavigation(
                onSeeAllPosts = onOpenMyPosts,
                onOpenConnections = onOpenConnections,
                onOpenSupportTrains = onOpenSupportTrains,
                onOpenSavedPlaces = onOpenSavedPlaces,
                onOpenSettings = onOpenSettings,
                onOpenHelp = onOpenHelp,
                onLogOut = { viewModel.signOut() },
                debugRows = if (BuildConfig.DEBUG) debugRows() else emptyList(),
                onDebugRow = { key ->
                    when (key) {
                        "me.debug.openProfile" -> debugProfileDialog = true
                        "me.debug.openPost" -> debugPostDialog = true
                        "me.debug.inviteOwner" -> debugInviteDialog = true
                        "me.debug.disambiguate" -> debugDisambiguateDialog = true
                        "me.debug.openHandshake" -> debugHandshakeDialog = true
                        "me.debug.openInviteToken" -> debugInviteTokenDialog = true
                        "me.debug.openCeremonialMail" -> onOpenCeremonialMail()
                        "me.debug.openCeremonialMailOpen" -> debugCeremonialMailOpenDialog = true
                    }
                },
            ),
    )

    if (BuildConfig.DEBUG && debugProfileDialog) {
        AlertDialog(
            modifier = Modifier.closesKeyboardOnTapOrScroll(),
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
            modifier = Modifier.closesKeyboardOnTapOrScroll(),
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
            modifier = Modifier.closesKeyboardOnTapOrScroll(),
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
            modifier = Modifier.closesKeyboardOnTapOrScroll(),
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
            modifier = Modifier.closesKeyboardOnTapOrScroll(),
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
            modifier = Modifier.closesKeyboardOnTapOrScroll(),
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
            modifier = Modifier.closesKeyboardOnTapOrScroll(),
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

/** The developer rows the Me screen had (debug builds only), filtered by the same launch cuts. */
private fun debugRows(): List<Pair<String, String>> =
    listOfNotNull(
        "me.debug.openProfile" to "Open public profile by ID",
        "me.debug.openPost" to "Open Pulse post by ID",
        ("me.debug.openHandshake" to "Open Privacy Handshake by persona handle")
            .takeIf { LaunchFeatures.beacon && LaunchFeatures.personas },
        "me.debug.openInviteToken" to "Open invite by token",
        ("me.debug.openCeremonialMail" to "Open Ceremonial Mail Compose").takeIf { LaunchFeatures.mailExtras && LaunchFeatures.mailbox },
        ("me.debug.openCeremonialMailOpen" to "Open Ceremonial Mail by ID").takeIf { LaunchFeatures.mailExtras && LaunchFeatures.mailbox },
        "me.debug.inviteOwner" to "Invite owner to home by ID",
        ("me.debug.disambiguate" to "Disambiguate mail by ID").takeIf { LaunchFeatures.mailbox },
    )
