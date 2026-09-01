@file:Suppress("PackageNaming", "UNUSED_PARAMETER", "MagicNumber", "LongMethod", "TooManyFunctions", "LongParameterList")

package app.pantopus.android.ui.screens.scheduling.business

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingLoadingSkeleton
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

private val TILE_ICON = 17.dp
private val MASTER_ICON_BOX = 34.dp

@Composable
fun CollectiveEventSetupScreen(
    eventTypeId: String,
    onBack: () -> Unit = {},
    onNavigate: (String) -> Unit = {},
    viewModel: CollectiveEventSetupViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    var toast by remember { mutableStateOf<String?>(null) }

    androidx.compose.runtime.LaunchedEffect(Unit) { viewModel.load() }
    androidx.compose.runtime.LaunchedEffect(Unit) {
        viewModel.events.collect { event ->
            when (event) {
                CollectiveEventSetupViewModel.Event.Saved -> onBack()
                is CollectiveEventSetupViewModel.Event.Toast -> toast = event.message
            }
        }
    }

    Column(modifier = Modifier.fillMaxSize().background(PantopusColors.appBg)) {
        BizTopBar(title = "Collective booking", onBack = onBack)
        // Pinned subhead — mirrors biz-kit.jsx SheetFrame flexShrink:0 header (above scroll area).
        Text(
            text = "Every required member must be free at the same time.",
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.padding(horizontal = Spacing.s4, vertical = Spacing.s2),
        )
        when (val s = state) {
            CollectiveEventSetupViewModel.UiState.Loading ->
                SchedulingLoadingSkeleton(modifier = Modifier.fillMaxWidth(), rows = 4)
            is CollectiveEventSetupViewModel.UiState.Error ->
                ErrorState(message = s.message, modifier = Modifier.fillMaxSize(), onRetry = viewModel::refresh)
            is CollectiveEventSetupViewModel.UiState.Content ->
                CollectiveBody(content = s, viewModel = viewModel, toast = toast)
        }
    }
}

@Composable
private fun CollectiveBody(
    content: CollectiveEventSetupViewModel.UiState.Content,
    viewModel: CollectiveEventSetupViewModel,
    toast: String?,
) {
    Column(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier =
                Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = Spacing.s4, vertical = Spacing.s3),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            MasterToggleCard(on = content.requireMultiple, onToggle = viewModel::setRequireMultiple)
            if (content.requireMultiple) {
                CountCard(
                    label = "Required staff",
                    sub = "How many must be free",
                    value = content.requiredStaff.toString(),
                    onMinus = viewModel::decrementRequired,
                    onPlus = viewModel::incrementRequired,
                )
                ModeTiles(selected = content.selectionMode, onSelect = viewModel::selectMode)
                // Frame 3: no-overlap warning between ModeTiles and Members (design: collective-frames.jsx:133).
                if (content.noOverlap) {
                    BizNote(
                        text = "The selected members share no free windows — no slots will be available.",
                        tone = BizNoteTone.Warning,
                        icon = PantopusIcon.AlertTriangle,
                    )
                }
                Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    BizOverline("Members")
                    BizCard {
                        content.picks.forEachIndexed { index, pick ->
                            CollectiveMemberRow(
                                pick = pick,
                                showDivider = index != content.picks.lastIndex,
                                onToggle = { viewModel.toggle(pick.id) },
                            )
                        }
                    }
                }
                CountCard(
                    label = "Seats per appointment",
                    sub = "Capacity for each slot",
                    value = content.seatsPerAppointment.toString(),
                    onMinus = viewModel::decrementSeats,
                    onPlus = viewModel::incrementSeats,
                )
                BizNote(
                    // Design collective-frames.jsx:116,170 sets this explainer's glyph
                    // to `git-merge` — the intersection metaphor, not a swap arrow.
                    text = "Times come from where every required member is free. Fewer common openings means fewer slots.",
                    tone = BizNoteTone.Info,
                    icon = PantopusIcon.GitMerge,
                )
            } else {
                BizNote(
                    text = "Turn on if a booking needs more than one person.",
                    tone = BizNoteTone.Info,
                    icon = PantopusIcon.Info,
                )
            }
            toast?.let { BizNote(text = it, tone = BizNoteTone.Error, icon = PantopusIcon.AlertCircle) }
        }
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .background(PantopusColors.appSurface)
                    .padding(horizontal = Spacing.s4, vertical = Spacing.s3),
        ) {
            BizPrimaryButton(text = "Save", onClick = viewModel::save, saving = content.saving)
        }
    }
}

@Composable
private fun MasterToggleCard(
    on: Boolean,
    onToggle: (Boolean) -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .padding(horizontal = Spacing.s3, vertical = Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(MASTER_ICON_BOX)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(if (on) bizAccentBg else PantopusColors.appSurfaceSunken),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.UsersRound,
                contentDescription = null,
                size = 17.dp,
                tint = if (on) bizAccent else PantopusColors.appTextSecondary,
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = "Require multiple staff",
                style = PantopusTextStyle.small,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
            )
            Text(text = "Several members must be free at once.", style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
        }
        BizToggle(on = on, onToggle = onToggle)
    }
}

@Composable
private fun ModeTiles(
    selected: CollectiveEventSetupViewModel.SelectionMode,
    onSelect: (CollectiveEventSetupViewModel.SelectionMode) -> Unit,
) {
    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        ModeTile(
            label = "Specific members",
            icon = PantopusIcon.UserCheck,
            active = selected == CollectiveEventSetupViewModel.SelectionMode.Specific,
            onClick = { onSelect(CollectiveEventSetupViewModel.SelectionMode.Specific) },
            modifier = Modifier.weight(1f),
        )
        ModeTile(
            label = "Any N of a group",
            icon = PantopusIcon.Users,
            active = selected == CollectiveEventSetupViewModel.SelectionMode.AnyN,
            onClick = { onSelect(CollectiveEventSetupViewModel.SelectionMode.AnyN) },
            modifier = Modifier.weight(1f),
        )
    }
}

@Composable
private fun ModeTile(
    label: String,
    icon: PantopusIcon,
    active: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.lg))
                .background(if (active) bizAccentBg else PantopusColors.appSurface)
                .border(
                    width = if (active) 1.5.dp else 1.dp,
                    color = if (active) bizAccent else PantopusColors.appBorder,
                    shape = RoundedCornerShape(Radii.lg),
                )
                .clickable(onClick = onClick)
                .padding(Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            PantopusIconImage(
                icon = icon,
                contentDescription = null,
                size = TILE_ICON,
                tint = if (active) bizAccent else PantopusColors.appTextSecondary,
            )
            if (active) {
                PantopusIconImage(icon = PantopusIcon.Check, contentDescription = null, size = 14.dp, tint = bizAccent, strokeWidth = 3f)
            }
        }
        Text(text = label, style = PantopusTextStyle.caption, fontWeight = FontWeight.Bold, color = PantopusColors.appText)
    }
}

@Composable
private fun CountCard(
    label: String,
    sub: String,
    value: String,
    onMinus: () -> Unit,
    onPlus: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .padding(horizontal = Spacing.s3, vertical = Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(text = label, style = PantopusTextStyle.small, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
            Text(text = sub, style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
        }
        BizStepper(value = value, onMinus = onMinus, onPlus = onPlus)
    }
}

@Composable
private fun CollectiveMemberRow(
    pick: CollectiveEventSetupViewModel.PickUi,
    showDivider: Boolean,
    onToggle: () -> Unit,
) {
    Column {
        Row(
            modifier = Modifier.fillMaxWidth().clickable(onClick = onToggle).padding(vertical = Spacing.s3),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            BizCheckbox(on = pick.checked)
            MemberAvatar(name = pick.name, seed = pick.id, dim = !pick.checked)
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = pick.name,
                    style = PantopusTextStyle.small,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appText,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(text = "Uses personal availability", style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
            }
        }
        if (showDivider) BizRowDivider()
    }
}
