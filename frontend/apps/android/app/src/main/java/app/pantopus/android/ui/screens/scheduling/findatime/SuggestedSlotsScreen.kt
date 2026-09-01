@file:Suppress("PackageNaming", "TooManyFunctions", "LongMethod", "MagicNumber", "LongParameterList")

package app.pantopus.android.ui.screens.scheduling.findatime

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
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
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingRoutes
import app.pantopus.android.ui.screens.scheduling._shared.TimezoneOption
import app.pantopus.android.ui.screens.scheduling._shared.TimezonePickerSheet
import app.pantopus.android.ui.screens.scheduling._shared.defaultTimezoneOptions
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

const val SUGGESTED_SLOTS_TAG = "suggestedSlotsScreen"

/**
 * F5 Find a Time — Suggested Slots. Renders common free times from
 * `POST /find-a-time`, lets a slot be booked as one new family event, or turns
 * the candidates into a member poll. Reads F4 criteria via [FindATimeSession].
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SuggestedSlotsScreen(
    onBack: () -> Unit = {},
    onNavigate: (String) -> Unit = {},
    viewModel: SuggestedSlotsViewModel = hiltViewModel(),
) {
    LaunchedEffect(Unit) { viewModel.start() }
    val state by viewModel.state.collectAsStateWithLifecycle()
    var showTz by remember { mutableStateOf(false) }
    // F5 major fix: Edit button opens the setup criteria editor in a sheet,
    // rather than navigating back entirely (mirrors iOS FindATimeSetupView sheet).
    var showEdit by remember { mutableStateOf(false) }
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val editSheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var tzQuery by remember { mutableStateOf("") }

    SuggestedSlotsContent(
        state = state,
        onBack = onBack,
        onRetry = viewModel::load,
        onToggleExpand = viewModel::toggleExpand,
        onBook = viewModel::bookSlot,
        onSendProposal = viewModel::sendProposal,
        onTimezoneClick = { showTz = true },
        onViewResponses = { pollId -> onNavigate(SchedulingRoutes.memberPollResponse(pollId)) },
        onOpenEdit = { showEdit = true },
    )

    if (showTz) {
        val tzId =
            (state as? SuggestedSlotsUiState.Loaded)?.header?.tzId
                ?: (state as? SuggestedSlotsUiState.Empty)?.header?.tzId
        TimezonePickerSheet(
            options = defaultTimezoneOptions(),
            selectedId = tzId,
            query = tzQuery,
            onQueryChange = { tzQuery = it },
            onSelect = { option: TimezoneOption ->
                viewModel.selectTimezone(option.id)
                showTz = false
            },
            onDismiss = { showTz = false },
            sheetState = sheetState,
            accent = HomeAccent,
        )
    }

    // F5 major fix: Edit sheet — reopens the F4 setup criteria editor inline.
    // On "Next" it triggers a reload of the slots (re-run find-a-time with updated criteria).
    if (showEdit) {
        ModalBottomSheet(
            onDismissRequest = { showEdit = false },
            sheetState = editSheetState,
            modifier = Modifier.fillMaxHeight(),
        ) {
            FindATimeSetupScreen(
                onBack = { showEdit = false },
                onNavigate = {
                    // "Next" submits criteria back to the session; reload slots and close sheet.
                    showEdit = false
                    viewModel.load()
                },
            )
        }
    }
}

@Composable
fun SuggestedSlotsContent(
    state: SuggestedSlotsUiState,
    onBack: () -> Unit,
    onRetry: () -> Unit,
    onToggleExpand: (String) -> Unit,
    onBook: (String) -> Unit,
    onSendProposal: () -> Unit,
    onTimezoneClick: () -> Unit,
    onViewResponses: (String) -> Unit,
    modifier: Modifier = Modifier,
    // F5 major fix: Edit button now opens the setup editor sheet, not back.
    onOpenEdit: () -> Unit = {},
) {
    Column(modifier = modifier.fillMaxSize().background(PantopusColors.appBg).testTag(SUGGESTED_SLOTS_TAG)) {
        val showEdit = state is SuggestedSlotsUiState.Loaded || state is SuggestedSlotsUiState.Empty
        FtTopBar(
            title = "Suggested times",
            onBack = onBack,
            trailingText = if (showEdit) "Edit" else null,
            // F5 major fix: trailing Edit opens the setup editor sheet, not back.
            onTrailing = onOpenEdit,
        )
        when (state) {
            is SuggestedSlotsUiState.Loading -> {
                SubHeadPlaceholder()
                ComposingBody(composingSubtitle = state.composingSubtitle)
            }
            is SuggestedSlotsUiState.Error -> ErrorState(message = state.message, onRetry = onRetry)
            is SuggestedSlotsUiState.Empty -> {
                SubHead(header = state.header, onTimezoneClick = onTimezoneClick)
                NoOverlapBody(
                    memberCount =
                        state.header.peopleLabel.firstOrNull { it.isDigit() }
                            ?.digitToInt() ?: 0,
                    onMakeOptional = onOpenEdit,
                    onWiden = onOpenEdit,
                )
            }
            is SuggestedSlotsUiState.Loaded -> {
                SubHead(header = state.header, onTimezoneClick = onTimezoneClick)
                LoadedBody(state = state, onToggleExpand = onToggleExpand, onBook = onBook, onSendProposal = onSendProposal)
            }
            is SuggestedSlotsUiState.Sent ->
                SuccessBody(
                    title = "Proposal sent to ${FindATimeFormat.peopleLabel(state.peopleCount)}",
                    body = "We'll notify you as they respond. The most-picked time gets booked.",
                    primaryLabel = "Back to calendar",
                    primaryIcon = PantopusIcon.Home,
                    onPrimary = onBack,
                    secondaryLabel = "View responses",
                    secondaryIcon = PantopusIcon.BarChart3,
                    onSecondary = { onViewResponses(state.pollId) },
                )
            is SuggestedSlotsUiState.Booked ->
                SuccessBody(
                    title = "Added to the family calendar",
                    body = "${state.label} is set. Everyone you picked can see it.",
                    primaryLabel = "Done",
                    primaryIcon = PantopusIcon.Check,
                    onPrimary = onBack,
                )
        }
    }
}

// ─── Sub-head ─────────────────────────────────────────────────────────────────

@Composable
private fun SubHead(
    header: SlotsHeader,
    onTimezoneClick: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth().background(PantopusColors.appSurface).padding(horizontal = Spacing.s4, vertical = Spacing.s3),
    ) {
        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = "${header.peopleLabel} · ${header.durationLabel} · ${header.windowLabel}",
                style = PantopusTextStyle.small,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                modifier = Modifier.weight(1f),
            )
            Row(
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(PantopusColors.appSurfaceSunken)
                        .clickable(onClickLabel = "Change timezone", onClick = onTimezoneClick)
                        .padding(horizontal = Spacing.s2, vertical = Spacing.s1)
                        .testTag("suggestedSlotsTzPill"),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Clock,
                    contentDescription = null,
                    size = 12.dp,
                    tint = PantopusColors.appTextSecondary,
                )
                Text(
                    text = header.tzLabel,
                    style = PantopusTextStyle.caption,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appTextStrong,
                    modifier = Modifier.padding(horizontal = Spacing.s1),
                )
                PantopusIconImage(
                    icon = PantopusIcon.ChevronDown,
                    contentDescription = null,
                    size = 11.dp,
                    tint = PantopusColors.appTextSecondary,
                )
            }
        }
        Row(modifier = Modifier.padding(top = Spacing.s1), verticalAlignment = Alignment.CenterVertically) {
            PantopusIconImage(icon = PantopusIcon.Users, contentDescription = null, size = 11.dp, tint = HomeAccent)
            Text(
                text = "From everyone's personal availability.",
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
                modifier = Modifier.padding(start = Spacing.s1),
            )
        }
    }
    HorizontalDivider(thickness = 1.dp, color = PantopusColors.appBorder)
}

@Composable
private fun SubHeadPlaceholder() {
    Column(
        modifier = Modifier.fillMaxWidth().background(PantopusColors.appSurface).padding(horizontal = Spacing.s4, vertical = Spacing.s3),
    ) {
        Shimmer(width = 180.dp, height = 12.dp, cornerRadius = Radii.xs)
    }
}

// ─── Loaded ───────────────────────────────────────────────────────────────────

@Composable
private fun LoadedBody(
    state: SuggestedSlotsUiState.Loaded,
    onToggleExpand: (String) -> Unit,
    onBook: (String) -> Unit,
    onSendProposal: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(Spacing.s4),
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            if (state.isSingle) {
                Text(
                    text = "One time works for everyone",
                    style = PantopusTextStyle.caption,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appTextSecondary,
                    modifier = Modifier.padding(bottom = Spacing.s1),
                )
                SingleBestCard(slot = state.slots.first(), durationLabel = state.header.durationLabel, busy = state.busy, onBook = {
                    onBook(state.slots.first().start)
                })
            } else {
                state.slots.forEach { slot ->
                    SlotCard(
                        slot = slot,
                        durationLabel = state.header.durationLabel,
                        expanded = state.expandedStart == slot.start,
                        busy = state.busy,
                        onToggle = { onToggleExpand(slot.start) },
                        onBook = { onBook(slot.start) },
                    )
                }
            }
        }
        Box(
            modifier = Modifier.fillMaxWidth().background(PantopusColors.appSurface).padding(Spacing.s4),
        ) {
            FtSecondaryButton(
                label = "Send proposal to members",
                icon = PantopusIcon.Send,
                tint = HomeAccentDark,
                onClick = onSendProposal,
                modifier = Modifier.testTag("sendProposalButton"),
            )
        }
    }
}

@Composable
private fun SlotCard(
    slot: SlotRowUi,
    durationLabel: String,
    expanded: Boolean,
    busy: Boolean,
    onToggle: () -> Unit,
    onBook: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(
                    if (slot.isBest || expanded) 1.5.dp else 1.dp,
                    if (slot.isBest || expanded) HomeAccent else PantopusColors.appBorder,
                    RoundedCornerShape(Radii.xl),
                ),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().clickable(onClickLabel = "Expand", onClick = onToggle).padding(Spacing.s3),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = "${slot.dayLabel} · ${slot.timeLabel}",
                        style = PantopusTextStyle.small,
                        fontWeight = FontWeight.Bold,
                        color = PantopusColors.appText,
                    )
                    if (slot.isBest) {
                        FtChip(label = "BEST", icon = PantopusIcon.Star, modifier = Modifier.padding(start = Spacing.s2))
                    }
                }
                Row(modifier = Modifier.padding(top = Spacing.s2), verticalAlignment = Alignment.CenterVertically) {
                    FtMemberStack(members = slot.members)
                    Text(
                        text = slot.freeLabel,
                        style = PantopusTextStyle.caption,
                        fontWeight = FontWeight.SemiBold,
                        color = if (slot.freeLabel.startsWith("All")) HomeAccentDark else PantopusColors.appTextSecondary,
                        modifier = Modifier.padding(start = Spacing.s2),
                    )
                    if (slot.assigneeName != null) {
                        FtChip(
                            label = "${slot.assigneeName} covers",
                            icon = PantopusIcon.UserCheck,
                            bg = PantopusColors.businessBg,
                            fg = PantopusColors.businessDark,
                            modifier = Modifier.padding(start = Spacing.s2),
                        )
                    }
                }
            }
            PantopusIconImage(
                icon = if (expanded) PantopusIcon.ChevronUp else PantopusIcon.ChevronDown,
                contentDescription = null,
                size = 17.dp,
                tint = PantopusColors.appTextMuted,
            )
        }
        if (expanded) {
            HorizontalDivider(thickness = 1.dp, color = PantopusColors.appBorder)
            Column(modifier = Modifier.fillMaxWidth().background(HomeAccentBg).padding(Spacing.s3)) {
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(bottom = Spacing.s2)) {
                    PantopusIconImage(icon = PantopusIcon.CalendarCheck, contentDescription = null, size = 14.dp, tint = HomeAccent)
                    Text(
                        text = "Book ${slot.dayLabel} · ${slot.timeLabel} · $durationLabel",
                        style = PantopusTextStyle.caption,
                        color = PantopusColors.appTextStrong,
                        modifier = Modifier.padding(start = Spacing.s1),
                    )
                }
                FtPrimaryButton(
                    label = "Book it",
                    icon = PantopusIcon.Check,
                    enabled = !busy,
                    onClick = onBook,
                    modifier = Modifier.testTag("bookSlotButton"),
                )
            }
        }
    }
}

@Composable
private fun SingleBestCard(
    slot: SlotRowUi,
    durationLabel: String,
    busy: Boolean,
    onBook: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.5.dp, HomeAccent, RoundedCornerShape(Radii.xl))
                .padding(Spacing.s4),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        FtChip(label = "BEST MATCH", icon = PantopusIcon.Star)
        Text(
            text = slot.dayLabel,
            style = PantopusTextStyle.h3,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
            modifier = Modifier.padding(top = Spacing.s3),
        )
        Text(
            text = "${slot.timeLabel} · $durationLabel",
            style = PantopusTextStyle.body,
            fontWeight = FontWeight.SemiBold,
            color = HomeAccentDark,
            modifier = Modifier.padding(top = Spacing.s1),
        )
        Row(modifier = Modifier.padding(top = Spacing.s3), verticalAlignment = Alignment.CenterVertically) {
            FtMemberStack(members = slot.members)
            Text(
                text = slot.freeLabel,
                style = PantopusTextStyle.caption,
                fontWeight = FontWeight.SemiBold,
                color = HomeAccentDark,
                modifier = Modifier.padding(start = Spacing.s2),
            )
        }
        Box(modifier = Modifier.padding(top = Spacing.s4)) {
            FtPrimaryButton(
                label = "Book it",
                icon = PantopusIcon.Check,
                enabled = !busy,
                onClick = onBook,
                modifier = Modifier.testTag("bookSlotButton"),
            )
        }
    }
}

// ─── Composing / no-overlap / success ─────────────────────────────────────────

@Composable
private fun ComposingBody(
    // F5 nit fix: dynamic subtitle from member names per design frame 1.
    composingSubtitle: String? = null,
) {
    Column(modifier = Modifier.fillMaxSize().padding(Spacing.s4), verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
        Column(modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.s3), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = "Finding times that work for everyone",
                style = PantopusTextStyle.small,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
            )
            Text(
                text = composingSubtitle ?: "Overlaying everyone's availability",
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
                modifier = Modifier.padding(top = Spacing.s1),
            )
        }
        repeat(4) {
            Column(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(Radii.xl))
                        .background(PantopusColors.appSurface)
                        .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                        .padding(Spacing.s3),
                verticalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                Shimmer(width = 160.dp, height = 12.dp, cornerRadius = Radii.xs)
                Shimmer(width = 90.dp, height = 10.dp, cornerRadius = Radii.xs)
            }
        }
    }
}

@Composable
private fun NoOverlapBody(
    onMakeOptional: () -> Unit,
    onWiden: () -> Unit,
    memberCount: Int = 0,
) {
    Column(
        modifier = Modifier.fillMaxSize().padding(horizontal = Spacing.s6),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            modifier = Modifier.size(64.dp).clip(CircleShape).background(PantopusColors.warningBg),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon = PantopusIcon.CalendarX, contentDescription = null, size = 28.dp, tint = PantopusColors.warning)
        }
        Text(
            // F5 nit fix: dynamic count — "No time works for all 3" per design frame 3.
            text = if (memberCount > 0) "No time works for all $memberCount" else "No time works for everyone",
            style = PantopusTextStyle.h3,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = Spacing.s3),
        )
        Text(
            text = "Their free hours don't overlap this window. Loosen a constraint to see options.",
            style = PantopusTextStyle.small,
            color = PantopusColors.appTextSecondary,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = Spacing.s2),
        )
        Box(modifier = Modifier.padding(top = Spacing.s4).fillMaxWidth()) {
            FtPrimaryButton(label = "Make someone optional", icon = PantopusIcon.UserMinus, onClick = onMakeOptional)
        }
        Box(modifier = Modifier.padding(top = Spacing.s2).fillMaxWidth()) {
            FtSecondaryButton(label = "Widen the window", icon = PantopusIcon.CalendarPlus, onClick = onWiden)
        }
    }
}

@Composable
private fun SuccessBody(
    title: String,
    body: String,
    primaryLabel: String,
    primaryIcon: PantopusIcon,
    onPrimary: () -> Unit,
    modifier: Modifier = Modifier,
    secondaryLabel: String? = null,
    secondaryIcon: PantopusIcon? = null,
    onSecondary: () -> Unit = {},
) {
    Column(
        modifier = modifier.fillMaxSize().padding(horizontal = Spacing.s6).testTag("suggestedSlotsSuccess"),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            modifier = Modifier.size(84.dp).clip(CircleShape).background(HomeAccentBg),
            contentAlignment = Alignment.Center,
        ) {
            Box(modifier = Modifier.size(52.dp).clip(CircleShape).background(HomeAccent), contentAlignment = Alignment.Center) {
                PantopusIconImage(icon = PantopusIcon.Check, contentDescription = null, size = 26.dp, tint = PantopusColors.appTextInverse)
            }
        }
        Text(
            text = title,
            style = PantopusTextStyle.h3,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = Spacing.s4),
        )
        Text(
            text = body,
            style = PantopusTextStyle.small,
            color = PantopusColors.appTextSecondary,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = Spacing.s2),
        )
        Box(modifier = Modifier.padding(top = Spacing.s4).fillMaxWidth()) {
            FtPrimaryButton(label = primaryLabel, icon = primaryIcon, onClick = onPrimary)
        }
        if (secondaryLabel != null) {
            Box(modifier = Modifier.padding(top = Spacing.s2).fillMaxWidth()) {
                FtSecondaryButton(label = secondaryLabel, icon = secondaryIcon, onClick = onSecondary)
            }
        }
    }
}
