package app.pantopus.android.ui.screens.homes.residencyhistory

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.compose.ui.window.SecureFlagPolicy
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.core.security.SecureScreenEffect
import app.pantopus.android.data.homes.HomeResidencyHistoryFailure
import app.pantopus.android.data.homes.HomeResidencyHistoryItem
import app.pantopus.android.ui.screens.homes.tasks.HomeTaskResumeEffect
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Spacing
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

@Composable
fun HomeResidencyHistoryDialog(
    target: HomeResidencyHistoryTarget,
    onClosed: () -> Unit,
    viewModel: HomeResidencyHistoryViewModel = hiltViewModel(),
) {
    SecureScreenEffect()
    var location by remember(target) { mutableStateOf(target) }
    val state by viewModel.state.collectAsStateWithLifecycle()
    HomeTaskResumeEffect({ viewModel.resume(location) }, viewModel::pause)
    DisposableEffect(viewModel) { onDispose { viewModel.pause() } }
    Dialog(
        onDismissRequest = onClosed,
        properties = DialogProperties(usePlatformDefaultWidth = false, securePolicy = SecureFlagPolicy.SecureOn),
    ) {
        Surface(
            modifier = Modifier.fillMaxWidth().fillMaxHeight(HISTORY_HEIGHT).testTag("homeResidencyHistory"),
            color = PantopusColors.appSurface,
        ) {
            Column(Modifier.padding(Spacing.s4), verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    TextButton(onClick = onClosed, modifier = Modifier.testTag("homeResidencyHistory.close")) { Text("Close") }
                    TextButton(
                        onClick = { viewModel.resume(location) },
                        modifier = Modifier.testTag("homeResidencyHistory.reload"),
                    ) { Text("Reload") }
                }
                Text("Your saved residency decisions", style = MaterialTheme.typography.titleLarge)
                Text("Only your decisions for this Home are shown. Current household review permission is required.")
                if (location.reference != null) {
                    TextButton(onClick = {
                        location = HomeResidencyHistoryTarget(location.homeId)
                        viewModel.resume(location)
                    }, modifier = Modifier.testTag("homeResidencyHistory.recent")) { Text("Recent decisions") }
                }
                Column(
                    Modifier.weight(1f).verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(Spacing.s3),
                ) {
                    when {
                        state.working -> CircularProgressIndicator(Modifier.testTag("homeResidencyHistory.loading"))
                        state.failure != null -> {
                            Text(
                                HomeResidencyHistoryFailure(checkNotNull(state.failure)).message.orEmpty(),
                                Modifier.testTag("homeResidencyHistory.error"),
                                color = PantopusColors.error,
                            )
                            TextButton(
                                onClick = { viewModel.resume(location) },
                                modifier = Modifier.testTag("homeResidencyHistory.retry"),
                            ) {
                                Text(if (location.reference == null) "Reload recent decisions" else "Retry saved decision")
                            }
                        }
                        state.detail != null -> HistoryDetail(checkNotNull(state.detail))
                        state.confirmed && state.items.isEmpty() ->
                            Text(
                                "You have no saved residency decisions for this Home.",
                                Modifier.testTag("homeResidencyHistory.empty"),
                            )
                        state.confirmed -> {
                            HistoryRows(state.items) { item ->
                                location = HomeResidencyHistoryTarget(item.homeId, item.reference)
                                viewModel.resume(location)
                            }
                            if (state.nextCursor != null) {
                                TextButton(onClick = viewModel::nextPage, modifier = Modifier.testTag("homeResidencyHistory.more")) {
                                    Text("Load older decisions")
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun HistoryRows(
    items: List<HomeResidencyHistoryItem>,
    onOpen: (HomeResidencyHistoryItem) -> Unit,
) {
    items.forEach { item ->
        TextButton(
            onClick = { onOpen(item) },
            modifier = Modifier.fillMaxWidth().testTag("homeResidencyHistory.receipt.${item.id}"),
        ) {
            Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                Text(if (item.action == "approve") "Approved residency" else "Rejected residency")
                Text("Recorded ${historyDate(item.createdAt)}")
                Text(currentApplicant(item))
            }
        }
        HorizontalDivider()
    }
}

@Composable
private fun HistoryDetail(item: HomeResidencyHistoryItem) {
    Column(Modifier.testTag("homeResidencyHistory.detail"), verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
        Text("Saved result", style = MaterialTheme.typography.titleMedium)
        Text(if (item.action == "approve") "You approved this residency claim." else "You rejected this residency claim.")
        Text("Recorded ${historyDate(item.createdAt)}")
        Text("Reviewed at ${item.reviewedAt}")
        if (item.action == "approve") Text("Recorded household role: ${historyRole(item.roleBase)}")
        if (item.legacyRequest) Text("This decision was saved by an older client.")
        Text("The original reason, requested role and historical applicant name were not recorded in this saved decision.")
        HorizontalDivider()
        Text("Current claim reference", style = MaterialTheme.typography.titleMedium)
        Text(currentApplicant(item))
        Text("Current claim status: ${item.currentClaimStatus}")
        Text("This is today's referenced claim and public username, not a saved identity snapshot.")
        Text("Current household access has not been checked. This saved result does not restore access or decide a later request.")
    }
}

private fun currentApplicant(item: HomeResidencyHistoryItem): String =
    item.currentApplicant?.username?.takeIf(String::isNotBlank)?.let { "Current public username: @$it" }
        ?: "Current public username unavailable"

private fun historyDate(value: String): String =
    DateTimeFormatter.ofPattern("MMM d, uuuu HH:mm:ss").withZone(ZoneId.systemDefault()).format(Instant.parse(value))

internal fun historyRole(role: String?): String =
    when (role) {
        "owner" -> "Owner"
        "admin" -> "Admin"
        "manager" -> "Manager"
        "member" -> "Member"
        "restricted_member" -> "Restricted member"
        "guest" -> "Guest"
        "lease_resident" -> "Lease resident"
        "service_provider" -> "Service provider"
        else -> "Not recorded"
    }

private const val HISTORY_HEIGHT = 0.94f
