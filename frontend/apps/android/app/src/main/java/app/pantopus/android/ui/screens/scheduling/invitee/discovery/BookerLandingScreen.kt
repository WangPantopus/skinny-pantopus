@file:Suppress("PackageNaming", "LongMethod", "LongParameterList", "MagicNumber", "UNUSED_PARAMETER", "UnusedParameter")
@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package app.pantopus.android.ui.screens.scheduling.invitee.discovery

import android.content.Context
import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.components.GhostButton
import app.pantopus.android.ui.screens.scheduling._shared.PausedExpiredUnavailableState
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingRoutes
import app.pantopus.android.ui.screens.scheduling._shared.TerminalAction
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

const val BOOKER_LANDING_TAG = "bookerLandingScreen"
const val BOOKING_HANDOFF_TAG = "bookingHandoffSheet"

/**
 * C5 Booking landing — the routed `book/:slug` (and one-off `book/o/:token`)
 * destination. Coordinates the public discovery flow locally: landing → slot
 * picker (no extra global route). This stream **stops at slot selection**; the
 * chosen slot is handed to A6 (invitee confirm/checkout) via the recap sheet.
 *
 * The composable signature (`slug`/`oneOffToken`/`onBack`/`onNavigate`) is the
 * frozen A0 contract; the args are read from `SavedStateHandle` by the VM.
 */
@Composable
fun BookerLandingScreen(
    slug: String? = null,
    oneOffToken: String? = null,
    onBack: () -> Unit = {},
    onNavigate: (String) -> Unit = {},
    viewModel: BookerLandingViewModel = hiltViewModel(),
) {
    LaunchedEffect(Unit) { viewModel.start() }
    val state by viewModel.state.collectAsStateWithLifecycle()
    val context = LocalContext.current

    // Local step state: when set, the slot picker takes over the route.
    var pickerArgs by remember { mutableStateOf<SlotPickerArgs?>(null) }
    var handoff by remember { mutableStateOf<SlotSelection?>(null) }

    val activeArgs = pickerArgs
    if (activeArgs != null) {
        SlotPickerScreen(
            args = activeArgs,
            onBack = { if (viewModel.isOneOff) onBack() else pickerArgs = null },
            onContinue = { handoff = it },
        )
    } else {
        BookerLandingBody(
            state = state,
            onShare = { url -> context.shareLink(url) },
            onOpenInApp = { onNavigate(SchedulingRoutes.OPEN_IN_APP_INTERSTITIAL) },
            onPickEventType = { row ->
                (state as? BookerLandingUiState.Landing)?.let { pickerArgs = viewModel.pickerArgsFor(row, it) }
            },
            onRetry = viewModel::refresh,
            onTerminalBack = onBack,
        )
        // One-off links skip the landing list and go straight to the picker.
        val direct = state as? BookerLandingUiState.DirectPicker
        LaunchedEffect(direct) {
            if (direct != null) pickerArgs = viewModel.oneOffPickerArgs(direct.eventType)
        }
    }

    handoff?.let { selection ->
        BookingHandoffSheet(
            selection = selection,
            // A5 → A6 seam: A6 (invitee confirm/checkout) owns the booking POST +
            // manageToken handoff. It reads slug/eventTypeSlug/start/tz from this
            // selection. Until A6's confirm step is wired, "Change time" returns
            // to the picker.
            onConfirm = { handoff = null },
            onChangeTime = { handoff = null },
        )
    }
}

@Composable
private fun BookerLandingBody(
    state: BookerLandingUiState,
    onShare: (String) -> Unit,
    onOpenInApp: () -> Unit,
    onPickEventType: (EventTypeRowUi) -> Unit,
    onRetry: () -> Unit,
    onTerminalBack: () -> Unit,
) {
    when (state) {
        is BookerLandingUiState.Loading ->
            LandingLoadingSkeleton(modifier = Modifier.fillMaxSize().testTag(BOOKER_LANDING_TAG))
        is BookerLandingUiState.Error ->
            ErrorState(message = state.message, onRetry = onRetry, modifier = Modifier.fillMaxSize())
        is BookerLandingUiState.Terminal ->
            PausedExpiredUnavailableState(
                state = state.state,
                primaryAction = TerminalAction(label = "Go back", onClick = onTerminalBack),
            )
        is BookerLandingUiState.DirectPicker -> {
            // Transition to the picker is driven by a LaunchedEffect in the caller;
            // render the skeleton in the meantime.
            LandingLoadingSkeleton(modifier = Modifier.fillMaxSize())
        }
        is BookerLandingUiState.Landing ->
            LandingLoaded(state = state, onShare = onShare, onOpenInApp = onOpenInApp, onPickEventType = onPickEventType)
    }
}

@Composable
private fun LandingLoaded(
    state: BookerLandingUiState.Landing,
    onShare: (String) -> Unit,
    onOpenInApp: () -> Unit,
    onPickEventType: (EventTypeRowUi) -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .verticalScroll(rememberScrollState())
                .testTag(BOOKER_LANDING_TAG),
    ) {
        PillarBanner(pillar = state.pillar)
        LandingHeaderCard(
            pillar = state.pillar,
            hostName = state.hostName,
            initials = state.initials,
            headline = state.headline,
            blurb = state.blurb,
            onShare = { onShare(state.shareUrl) },
        )
        Column(
            modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s3),
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            // The open-in-app nudge only belongs on the multi-type default frame —
            // never on the single / paused / empty variants (mirrors the spec).
            val isEventList = !state.isPaused && state.eventTypes.isNotEmpty()
            if (isEventList && state.eventTypes.size > 1) {
                OpenInAppBanner(onOpen = onOpenInApp)
            }
            when {
                state.isPaused -> LandingPausedCard(hostName = state.hostName)
                state.eventTypes.isEmpty() -> LandingEmptyCard(hostName = state.hostName)
                else -> {
                    // The section label sits with the list only — the paused/empty
                    // cards in the spec stand alone with no overline above them.
                    SectionOverline(text = "Book a time", modifier = Modifier.padding(top = Spacing.s2))
                    state.eventTypes.forEach { row ->
                        EventTypeRow(row = row, onClick = { onPickEventType(row) })
                    }
                    if (state.eventTypes.size == 1) {
                        SingleTypeNote()
                    }
                }
            }
        }
        LandingFooter(
            // The spec footer surfaces a "View {name}'s profile" link. A5 has no
            // host-profile route (the stream stops at slot selection), so the link
            // renders for parity but stays non-navigating until that route lands.
            profileName = state.hostName.firstName(),
            onViewProfile = null,
        )
    }
}

/** The first whitespace-delimited token of a host's display name ("Maria Kessler" → "Maria"). */
private fun String.firstName(): String = trim().substringBefore(' ').ifBlank { trim() }

/** The "going straight to pick a time" note shown for a single-type page. */
@Composable
private fun SingleTypeNote() {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(top = Spacing.s1)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.primary50)
                .padding(horizontal = Spacing.s3, vertical = Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.ArrowRight,
            contentDescription = null,
            size = 14.dp,
            tint = PantopusColors.primary600,
        )
        Text(
            text = "Going straight to pick a time.",
            style = PantopusTextStyle.caption,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.primary700,
        )
    }
}

/**
 * The A5 terminal recap — a local bottom sheet confirming the chosen slot
 * before handing off to A6 (confirm/checkout). Renders the day, time, duration,
 * and timezone the invitee picked.
 */
@Composable
private fun BookingHandoffSheet(
    selection: SlotSelection,
    onConfirm: () -> Unit,
    onChangeTime: () -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ModalBottomSheet(
        onDismissRequest = onChangeTime,
        sheetState = sheetState,
        containerColor = PantopusColors.appSurface,
        modifier = Modifier.testTag(BOOKING_HANDOFF_TAG),
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4, vertical = Spacing.s2).padding(bottom = Spacing.s6),
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            Text(text = "Ready to confirm", style = PantopusTextStyle.h3, color = PantopusColors.appText)
            Text(
                text = selection.eventTypeName,
                style = PantopusTextStyle.small,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                modifier = Modifier.padding(top = Spacing.s2),
            )
            Text(
                text = listOf(selection.dayLabel, selection.startLocalLabel).filter { it.isNotBlank() }.joinToString(" · "),
                style = PantopusTextStyle.small,
                color = PantopusColors.appTextStrong,
            )
            Text(
                text = "Times shown in ${selection.timezone}. Add your details next to lock in this time.",
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
            )
            Column(
                modifier = Modifier.fillMaxWidth().padding(top = Spacing.s3),
                verticalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                AccentFilledButton(
                    label = "Confirm your details",
                    accent = PantopusColors.primary600,
                    icon = PantopusIcon.ArrowRight,
                    onClick = onConfirm,
                )
                GhostButton(title = "Change time", onClick = onChangeTime)
            }
        }
    }
}

/** Fire the system share sheet with the public booking link. */
private fun Context.shareLink(url: String) {
    if (url.isBlank()) return
    val send =
        Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, url)
        }
    runCatching { startActivity(Intent.createChooser(send, null)) }
}
