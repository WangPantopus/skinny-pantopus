@file:Suppress(
    "PackageNaming",
    "LongMethod",
    "LongParameterList",
    "TooManyFunctions",
    "CyclomaticComplexMethod",
    "LargeClass",
    "MatchingDeclarationName",
)
@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package app.pantopus.android.ui.screens.scheduling.bookings_extra

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingLoadingSkeleton
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingTopBar
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingTopBarLeading
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.Spacing

const val WAITLIST_TAG = "scheduling.waitlist"

@Composable
fun WaitlistScreen(
    onBack: () -> Unit = {},
    onNavigate: (String) -> Unit = {},
    viewModel: WaitlistViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val toast by viewModel.toast.collectAsStateWithLifecycle()
    val snackbar = remember { SnackbarHostState() }

    LaunchedEffect(Unit) { viewModel.start() }
    LaunchedEffect(toast) {
        toast?.let {
            snackbar.showSnackbar(it)
            viewModel.toastConsumed()
        }
    }

    Scaffold(
        modifier = Modifier.testTag(WAITLIST_TAG),
        containerColor = PantopusColors.appBg,
        snackbarHost = { SnackbarHost(snackbar) },
        topBar = {
            SchedulingTopBar(
                title = "Waitlist",
                leading = SchedulingTopBarLeading.Back,
                onLeading = onBack,
                applyStatusBarInset = true,
            )
        },
    ) { padding ->
        Box(modifier = Modifier.fillMaxSize().padding(padding)) {
            when (val s = state) {
                is WaitlistUiState.Loading -> SchedulingLoadingSkeleton(rows = 4)
                is WaitlistUiState.Error -> SchedulingExtrasError(headline = "Couldn't load the waitlist", onRetry = viewModel::load)
                is WaitlistUiState.Empty ->
                    EmptyState(
                        icon = PantopusIcon.Clock,
                        headline = "No waitlists yet",
                        subcopy = "Create a bookable event type to start collecting a waitlist.",
                    )
                is WaitlistUiState.Loaded ->
                    WaitlistContent(data = s.data, onSelect = viewModel::select, onPromote = viewModel::promote)
            }
        }
    }
}

@Composable
internal fun WaitlistContent(
    data: WaitlistData,
    onSelect: (String) -> Unit,
    onPromote: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        if (data.options.size > 1) {
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                ExtrasOverline("Event type")
                ExtrasChipFlow {
                    data.options.forEach { option ->
                        ExtrasPillChip(
                            label = option.name,
                            selected = option.id == data.selectedId,
                            onClick = { onSelect(option.id) },
                            accent = data.pillar.accent,
                        )
                    }
                }
            }
        }

        // Design capacity strip — the identity-tinted fill bar over
        // "filled of total seats filled · K waiting" (stat strip hidden for the
        // single-slot view). The host waitlist endpoint returns only the waiting
        // queue, not the seated count, so `filled`/`isFull` are VM-derived when
        // available (full ⇒ grayscale bar + disabled promote per frame 5).
        CapacityHeaderCard(
            filled = data.filled,
            total = data.seatTotal,
            waiting = data.entries.size,
            accent = data.pillar.accent,
            showStats = false,
        )

        if (data.entries.isEmpty()) {
            EmptyState(
                icon = PantopusIcon.Clock,
                headline = "No one's waiting",
                subcopy = "When this event fills up, people can join the waitlist and you'll promote them here.",
                tint = data.pillar.accent.copy(alpha = WAITLIST_DISC_ALPHA),
                accent = data.pillar.accent,
            )
        } else {
            val sectionLabel =
                if (data.isFull) {
                    "All seats filled"
                } else {
                    "${data.seatsOpen} seat${if (data.seatsOpen == 1) "" else "s"} open · promote available"
                }
            ExtrasOverline(sectionLabel)
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2 + 1.dp)) {
                data.entries.forEach { person ->
                    WaitlistRosterRow(
                        person = person,
                        promoteEnabled = !data.isFull,
                        accent = data.pillar.accent,
                        onPromote = { onPromote(person.id) },
                    )
                }
            }
        }
    }
}

private const val WAITLIST_DISC_ALPHA = 0.12f
