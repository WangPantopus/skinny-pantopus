package app.pantopus.android.ui.screens.homes.postal

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.testTagsAsResourceId
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Spacing

@OptIn(ExperimentalComposeUiApi::class)
@Composable
fun HomePostalScreen(
    onBack: () -> Unit,
    onNavigate: (String, HomePostalNavigation) -> Unit,
    viewModel: HomePostalViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    HomePostalLifecycle(viewModel)
    Column(
        Modifier.fillMaxSize().background(PantopusColors.appBg).imePadding().testTag("homePostalVerification")
            .semantics { testTagsAsResourceId = true },
    ) {
        Row(Modifier.fillMaxWidth().padding(Spacing.s3), verticalAlignment = Alignment.CenterVertically) {
            HomePostalButton("Back", "homePostalBack", onClick = onBack)
            Text("Mail verification", style = PantopusTextStyle.h3)
        }
        Column(
            Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(Spacing.s5),
            verticalArrangement = Arrangement.spacedBy(Spacing.s4),
        ) {
            Text("Verify your address by mail", style = PantopusTextStyle.h2)
            Text("A saved mailing request or code result is separate from your current household access.", style = PantopusTextStyle.body)
            state.error?.let { Text(it, style = PantopusTextStyle.body, modifier = Modifier.testTag("homePostalError")) }
            when {
                state.pending != null -> HomePostalRecovery(state, viewModel)
                state.working -> {
                    CircularProgressIndicator(modifier = Modifier.testTag("homePostalLoading"))
                    Text("Checking mail verification…", style = PantopusTextStyle.body)
                }
                state.status != null -> HomePostalCurrentStatus(state, viewModel, onNavigate)
                else -> HomePostalButton("Retry mail status", "homePostalRetry", onClick = viewModel::open)
            }
        }
    }
    HomePostalConfirmations(state, viewModel)
}

@Composable
private fun HomePostalLifecycle(viewModel: HomePostalViewModel) {
    val owner = LocalLifecycleOwner.current
    val focus = LocalFocusManager.current
    LaunchedEffect(viewModel) { viewModel.open() }
    DisposableEffect(owner, viewModel) {
        val observer =
            LifecycleEventObserver { _, event ->
                when (event) {
                    Lifecycle.Event.ON_RESUME -> viewModel.open()
                    Lifecycle.Event.ON_PAUSE, Lifecycle.Event.ON_STOP -> {
                        focus.clearFocus()
                        viewModel.suspendContent()
                    }
                    else -> Unit
                }
            }
        owner.lifecycle.addObserver(observer)
        onDispose {
            owner.lifecycle.removeObserver(observer)
            viewModel.suspendContent()
        }
    }
}

@Suppress("LongMethod") // Declarative status and its gated actions stay together.
@Composable
private fun HomePostalCurrentStatus(
    state: HomePostalUiState,
    viewModel: HomePostalViewModel,
    onNavigate: (String, HomePostalNavigation) -> Unit,
) {
    val status = state.status ?: return
    val postcard = status.postcard
    if (postcard != null) {
        Text(
            HomePostalMessages.delivery(postcard.delivery),
            style = PantopusTextStyle.h3,
            modifier = Modifier.testTag("homePostalDelivery"),
        )
        Text("Postcard status: ${postcard.status}", style = PantopusTextStyle.body)
        if (postcard.status == "pending") {
            Text(
                "${postcard.attemptsRemaining} code attempts remaining",
                style = PantopusTextStyle.caption,
                modifier = Modifier.testTag("homePostalAttemptsRemaining"),
            )
        }
    } else {
        Text("No postcard request is recorded.", style = PantopusTextStyle.body)
    }
    status.restriction?.let {
        Text(HomePostalMessages.restriction(it), style = PantopusTextStyle.body, modifier = Modifier.testTag("homePostalRestriction"))
    }
    if (status.canResume) {
        Text("Continue the original mailing request", style = PantopusTextStyle.h3)
        status.request?.address?.let {
            Text(HomePostalMessages.address(it), style = PantopusTextStyle.body, modifier = Modifier.testTag("homePostalResumeAddress"))
        }
        HomePostalButton("Continue this original request", "homePostalResume", viewModel.canResumeMail, viewModel::resumeMail)
    }
    if (status.canRequest) HomePostalMailForm(state, viewModel)
    if (status.canVerify) HomePostalCodeForm(state, viewModel)
    state.progress?.let { progress ->
        Text(progress.title, style = PantopusTextStyle.h3, modifier = Modifier.testTag("homePostalResidencyHeading"))
        Text(progress.explanation, style = PantopusTextStyle.body, color = PantopusColors.appTextSecondary)
        listOf(
            HomePostalNavigation.Home to "Open Home",
            HomePostalNavigation.Ownership to "Continue ownership verification",
            HomePostalNavigation.AddHome to "Review address in Add Home",
            HomePostalNavigation.Residency to "Check residency status",
        ).forEach { (destination, label) ->
            if (viewModel.permits(destination)) {
                HomePostalButton(label, "homePostalCurrentAction") {
                    if (viewModel.permits(destination)) onNavigate(viewModel.homeId, destination)
                }
            }
        }
    }
    HomePostalButton("Refresh mail status", "homePostalRefresh", onClick = viewModel::open)
}

@OptIn(ExperimentalComposeUiApi::class)
@Composable
private fun HomePostalConfirmations(
    state: HomePostalUiState,
    viewModel: HomePostalViewModel,
) {
    if (!state.confirmsMail && !state.confirmsCancellation) return
    val mail = state.confirmsMail
    AlertDialog(
        modifier = Modifier.semantics { testTagsAsResourceId = true },
        onDismissRequest = viewModel::dismissConfirmation,
        title = { Text(if (mail) "Request a postcard to this address?" else "Cancel the original request?") },
        text = {
            Text(
                if (mail) {
                    HomePostalMessages.address(state.address.snapshot)
                } else {
                    "We will check the original result. Cancellation cannot undo a recorded verification or an already admitted mailing."
                },
            )
        },
        confirmButton = {
            HomePostalButton(
                if (mail) "Request postcard" else "Confirm cancellation",
                if (mail) "homePostalConfirmMail" else "homePostalConfirmCancel",
            ) { if (mail) viewModel.requestMail() else viewModel.confirmCancellation() }
        },
        dismissButton = { HomePostalButton("Keep reviewing", "homePostalDismissConfirmation", onClick = viewModel::dismissConfirmation) },
    )
}

@Composable
internal fun HomePostalButton(
    title: String,
    tag: String,
    enabled: Boolean = true,
    onClick: () -> Unit,
) {
    TextButton(onClick = onClick, enabled = enabled, modifier = Modifier.heightIn(min = 48.dp).testTag(tag)) { Text(title) }
}
