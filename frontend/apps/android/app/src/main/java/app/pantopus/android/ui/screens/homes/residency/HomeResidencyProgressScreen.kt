package app.pantopus.android.ui.screens.homes.residency

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.ui.draw.clip
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
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

@OptIn(ExperimentalComposeUiApi::class)
@Suppress("LongMethod") // Declarative screen layout keeps state and actions together.
@Composable
fun HomeResidencyProgressScreen(
    onBack: () -> Unit,
    onNavigate: (String, HomeResidencyNavigation) -> Unit,
    viewModel: HomeResidencyProgressViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val owner = LocalLifecycleOwner.current
    LaunchedEffect(viewModel) { viewModel.refresh() }
    DisposableEffect(owner, viewModel) {
        val observer =
            LifecycleEventObserver { _, event ->
                when (event) {
                    Lifecycle.Event.ON_RESUME -> viewModel.refresh()
                    Lifecycle.Event.ON_PAUSE, Lifecycle.Event.ON_STOP -> viewModel.suspendContent()
                    else -> Unit
                }
            }
        owner.lifecycle.addObserver(observer)
        onDispose {
            owner.lifecycle.removeObserver(observer)
            viewModel.suspendContent()
        }
    }
    Column(
        Modifier.fillMaxSize().background(PantopusColors.appBg).testTag("homeResidencyStatus")
            .semantics { testTagsAsResourceId = true },
    ) {
        Row(Modifier.fillMaxWidth().padding(Spacing.s3), verticalAlignment = Alignment.CenterVertically) {
            TextButton(onClick = onBack, modifier = Modifier.heightIn(min = 48.dp).testTag("homeResidencyBack")) { Text("Back") }
            Text("Residency status", style = PantopusTextStyle.h3)
        }
        Column(
            Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(Spacing.s5),
            verticalArrangement = Arrangement.spacedBy(Spacing.s4),
        ) {
            when {
                state.loading -> {
                    CircularProgressIndicator(modifier = Modifier.testTag("homeResidencyLoading"))
                    Text("Checking your current status…", style = PantopusTextStyle.body)
                }
                state.error != null -> {
                    Text(checkNotNull(state.error), style = PantopusTextStyle.body, modifier = Modifier.testTag("homeResidencyError"))
                    TextButton(
                        onClick = viewModel::refresh,
                        modifier = Modifier.heightIn(min = 48.dp).testTag("homeResidencyRetry"),
                    ) { Text("Retry") }
                }
                else ->
                    state.progress?.let { progress ->
                        progress.request?.let { request ->
                            Column(
                                Modifier.fillMaxWidth().clip(
                                    RoundedCornerShape(Radii.lg),
                                ).background(PantopusColors.appSurface).padding(Spacing.s4),
                                verticalArrangement = Arrangement.spacedBy(Spacing.s2),
                            ) {
                                Text("Your submitted residency address", style = PantopusTextStyle.caption)
                                Text(request.label, style = PantopusTextStyle.body, modifier = Modifier.testTag("homeResidencyAddress"))
                                Text(request.reviewLabel, style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
                            }
                        }
                        Text(progress.title, style = PantopusTextStyle.h3, modifier = Modifier.testTag("homeResidencyHeading"))
                        Text(progress.explanation, style = PantopusTextStyle.body, color = PantopusColors.appTextSecondary)
                        listOf(
                            HomeResidencyNavigation.Home to "Open Home",
                            HomeResidencyNavigation.Mail to "Review mail verification",
                            HomeResidencyNavigation.Ownership to "Continue ownership verification",
                            HomeResidencyNavigation.AddHome to
                                if (progress.needsResidencyRequest) "Check address and request residency" else "Check address and resubmit",
                        ).forEach { (destination, label) ->
                            if (viewModel.permits(destination)) {
                                TextButton(onClick = {
                                    if (viewModel.permits(destination)) onNavigate(viewModel.homeId, destination)
                                }, modifier = Modifier.heightIn(min = 48.dp).testTag("homeResidencyAction")) { Text(label) }
                            }
                        }
                        TextButton(
                            onClick = viewModel::refresh,
                            modifier = Modifier.heightIn(min = 48.dp).testTag("homeResidencyRefresh"),
                        ) {
                            Text("Refresh status")
                        }
                    }
            }
        }
    }
}
