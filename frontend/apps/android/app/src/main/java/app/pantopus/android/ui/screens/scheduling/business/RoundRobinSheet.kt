@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "TooManyFunctions", "LongParameterList")
@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package app.pantopus.android.ui.screens.scheduling.business

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

private val RULE_ICON_BOX = 32.dp
private val RADIO = 20.dp

/**
 * G1 Round-Robin Assignment sheet. Local `ModalBottomSheet` configuring which
 * members rotate for a service and the fairness rule. Saves via the repository
 * (`PUT /event-types/:id/assignees`). [onSaved] fires after a successful save.
 */
@Composable
fun RoundRobinSheet(
    eventTypeId: String,
    onDismiss: () -> Unit,
    onSaved: () -> Unit,
    viewModel: RoundRobinAssignmentViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var toast by remember { mutableStateOf<String?>(null) }

    androidx.compose.runtime.LaunchedEffect(eventTypeId) { viewModel.start(eventTypeId) }
    androidx.compose.runtime.LaunchedEffect(Unit) {
        viewModel.events.collect { event ->
            when (event) {
                RoundRobinAssignmentViewModel.Event.Saved -> onSaved()
                is RoundRobinAssignmentViewModel.Event.Toast -> toast = event.message
            }
        }
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = PantopusColors.appSurface,
        modifier = Modifier.testTag("roundRobinSheet"),
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4)) {
                Text(text = "Assign bookings", style = PantopusTextStyle.h3, color = PantopusColors.appText)
                Text(
                    text = "New bookings rotate across the members you pick.",
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.appTextSecondary,
                    modifier = Modifier.padding(top = Spacing.s1, bottom = Spacing.s3),
                )
            }
            when (val s = state) {
                RoundRobinAssignmentViewModel.UiState.Loading ->
                    Column(modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4)) { RoundRobinLoading() }
                is RoundRobinAssignmentViewModel.UiState.Error ->
                    Column(modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4)) {
                        BizNote(text = s.message, tone = BizNoteTone.Error, icon = PantopusIcon.AlertCircle)
                    }
                is RoundRobinAssignmentViewModel.UiState.Content ->
                    RoundRobinBody(content = s, viewModel = viewModel, toast = toast, onDone = viewModel::save)
            }
        }
    }
}

@Composable
private fun RoundRobinBody(
    content: RoundRobinAssignmentViewModel.UiState.Content,
    viewModel: RoundRobinAssignmentViewModel,
    toast: String?,
    onDone: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier =
                Modifier
                    .weight(1f, fill = false)
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = Spacing.s4, vertical = Spacing.s1),
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            RuleCard(
                name = "Balanced",
                desc = "Spread bookings by weight",
                icon = PantopusIcon.Scale,
                selected = content.rule == RoundRobinAssignmentViewModel.Rule.Balanced,
                onClick = { viewModel.selectRule(RoundRobinAssignmentViewModel.Rule.Balanced) },
            )
            RuleCard(
                name = "Priority order",
                desc = "Fill the top of the list first",
                icon = PantopusIcon.ListOrdered,
                selected = content.rule == RoundRobinAssignmentViewModel.Rule.Priority,
                onClick = { viewModel.selectRule(RoundRobinAssignmentViewModel.Rule.Priority) },
            )
            RuleCard(
                name = "Strict round-robin",
                desc = "One each, strictly in turn",
                icon = PantopusIcon.ArrowsRepeat,
                selected = content.rule == RoundRobinAssignmentViewModel.Rule.Strict,
                onClick = { viewModel.selectRule(RoundRobinAssignmentViewModel.Rule.Strict) },
            )
            // Design roundrobin-frames.jsx:66 sets this sheet's Overline in the neutral
            // fg3 grey, not the business violet the shared BizOverline defaults to.
            BizOverline(
                "Bookable members",
                modifier = Modifier.padding(top = Spacing.s2),
                color = PantopusColors.appTextSecondary,
            )
            if (content.checkedCount == 0) {
                BizNote(
                    text = "Pick at least one member to take bookings.",
                    tone = BizNoteTone.Warning,
                    icon = PantopusIcon.AlertTriangle,
                )
            }
            BizCard {
                content.picks.forEachIndexed { index, pick ->
                    RoundRobinMemberRow(
                        pick = pick,
                        rule = content.rule,
                        showDivider = index != content.picks.lastIndex,
                        onToggle = { viewModel.toggle(pick.id) },
                        onWeightMinus = { viewModel.decrementWeight(pick.id) },
                        onWeightPlus = { viewModel.incrementWeight(pick.id) },
                    )
                }
            }
            if (content.isSingleMember) {
                BizNote(
                    text = "Rotation needs two or more members. Bookings go to ${content.firstCheckedName ?: "this member"} for now.",
                    tone = BizNoteTone.Info,
                    icon = PantopusIcon.Info,
                )
            } else if (content.checkedCount >= 2) {
                // Design roundrobin-frames.jsx:157 closes the sheet with a Blurb confirming
                // how the rotation will behave; only the single-member caveat was built.
                BizNote(
                    text = "New bookings rotate across ${content.checkedCount} members, weighted by your settings.",
                    tone = BizNoteTone.Info,
                    icon = PantopusIcon.ArrowsRepeat,
                )
            }
            toast?.let { BizNote(text = it, tone = BizNoteTone.Error, icon = PantopusIcon.AlertCircle) }
        }
        // Pinned footer: hairline top divider + surface background, mirroring CollectiveBody/MemberHoursBody.
        BizRowDivider()
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .background(PantopusColors.appSurface)
                    .padding(start = Spacing.s4, end = Spacing.s4, top = Spacing.s2, bottom = Spacing.s5),
        ) {
            BizPrimaryButton(
                text = "Done",
                onClick = onDone,
                enabled = !content.doneDisabled,
                saving = content.saving,
            )
        }
    }
}

@Composable
private fun RuleCard(
    name: String,
    desc: String,
    icon: PantopusIcon,
    selected: Boolean,
    onClick: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(if (selected) bizAccentBg else PantopusColors.appSurface)
                .border(
                    width = if (selected) 1.5.dp else 1.dp,
                    color = if (selected) bizAccent else PantopusColors.appBorder,
                    shape = RoundedCornerShape(Radii.lg),
                )
                .clickable(onClick = onClick)
                .padding(horizontal = Spacing.s3, vertical = Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(RULE_ICON_BOX)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(if (selected) PantopusColors.appSurface else PantopusColors.appSurfaceSunken),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = icon,
                contentDescription = null,
                size = 16.dp,
                tint = if (selected) bizAccent else PantopusColors.appTextSecondary,
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(text = name, style = PantopusTextStyle.small, fontWeight = FontWeight.Bold, color = PantopusColors.appText)
            Text(text = desc, style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
        }
        Box(
            modifier =
                Modifier
                    .size(RADIO)
                    .clip(CircleShape)
                    .background(if (selected) bizAccent else Color.Transparent)
                    .then(if (selected) Modifier else Modifier.border(1.5.dp, PantopusColors.appBorderStrong, CircleShape)),
            contentAlignment = Alignment.Center,
        ) {
            if (selected) {
                PantopusIconImage(
                    icon = PantopusIcon.Check,
                    contentDescription = "Selected",
                    size = 12.dp,
                    tint = PantopusColors.appTextInverse,
                    strokeWidth = 3.2f,
                )
            }
        }
    }
}

@Composable
private fun RoundRobinMemberRow(
    pick: RoundRobinAssignmentViewModel.PickUi,
    rule: RoundRobinAssignmentViewModel.Rule,
    showDivider: Boolean,
    onToggle: () -> Unit,
    onWeightMinus: () -> Unit,
    onWeightPlus: () -> Unit,
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
            if (pick.checked) {
                when (rule) {
                    RoundRobinAssignmentViewModel.Rule.Balanced ->
                        WeightStepper(weight = pick.weight, onMinus = onWeightMinus, onPlus = onWeightPlus)
                    RoundRobinAssignmentViewModel.Rule.Priority ->
                        PantopusIconImage(
                            icon = PantopusIcon.GripVertical,
                            contentDescription = "Reorder",
                            size = 20.dp,
                            tint = PantopusColors.appTextMuted,
                        )
                    RoundRobinAssignmentViewModel.Rule.Strict -> Unit
                }
            }
        }
        if (showDivider) BizRowDivider()
    }
}

/**
 * Round-robin weight stepper (`WeightStepper` in `roundrobin-frames.jsx`): a
 * circular − / + flanking an `×N` value rendered as a violet-tinted pill.
 */
@Composable
private fun WeightStepper(
    weight: Int,
    onMinus: () -> Unit,
    onPlus: () -> Unit,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        StepperButton(icon = PantopusIcon.Minus, tint = PantopusColors.appTextSecondary, onClick = onMinus)
        Text(
            text = "×$weight",
            style = PantopusTextStyle.caption,
            fontWeight = FontWeight.Bold,
            color = bizAccent,
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(bizAccentBg)
                    .padding(horizontal = Spacing.s2, vertical = 3.dp),
        )
        StepperButton(icon = PantopusIcon.Plus, tint = bizAccent, onClick = onPlus)
    }
}

@Composable
private fun StepperButton(
    icon: PantopusIcon,
    tint: Color,
    onClick: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .size(22.dp)
                .clip(CircleShape)
                .border(1.dp, PantopusColors.appBorder, CircleShape)
                .background(PantopusColors.appSurface)
                .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 11.dp, tint = tint)
    }
}

/**
 * Design `roundrobin-frames.jsx` FrameLoading: the rule tiles and the seat rows
 * are shimmer skeletons mirroring the loaded geometry (checkbox · avatar · two
 * text lines · trailing weight pill), never flat grey blocks.
 */
@Composable
private fun RoundRobinLoading() {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        repeat(3) {
            Shimmer(modifier = Modifier.fillMaxWidth(), height = 56.dp, cornerRadius = Radii.lg)
        }
        BizOverline(
            "Bookable members",
            modifier = Modifier.padding(top = Spacing.s2),
            color = PantopusColors.appTextSecondary,
        )
        BizCard {
            repeat(4) { i ->
                Row(
                    modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.s3),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
                ) {
                    Shimmer(width = 22.dp, height = 22.dp, cornerRadius = Radii.sm)
                    Shimmer(width = 34.dp, height = 34.dp, cornerRadius = Radii.pill)
                    Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Shimmer(width = 110.dp, height = 11.dp, cornerRadius = Radii.sm)
                        Shimmer(width = 150.dp, height = 8.dp, cornerRadius = Radii.xs)
                    }
                    Shimmer(width = 54.dp, height = 24.dp, cornerRadius = Radii.pill)
                }
                if (i != 3) BizRowDivider()
            }
        }
    }
}
