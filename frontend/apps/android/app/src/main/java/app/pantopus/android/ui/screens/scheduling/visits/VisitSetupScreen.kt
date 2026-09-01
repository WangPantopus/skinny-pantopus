@file:Suppress(
    "PackageNaming",
    "LongMethod",
    "CyclomaticComplexMethod",
    "MagicNumber",
    "LongParameterList",
)
@file:OptIn(
    androidx.compose.material3.ExperimentalMaterial3Api::class,
    androidx.compose.foundation.layout.ExperimentalLayoutApi::class,
)

package app.pantopus.android.ui.screens.scheduling.visits

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.components.PantopusTextField
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingLoadingSkeleton
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingTopBar
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingTopBarLeading
import app.pantopus.android.ui.screens.scheduling.resources.CounterRow
import app.pantopus.android.ui.screens.scheduling.resources.HomeMember
import app.pantopus.android.ui.screens.scheduling.resources.HomeMemberAvatar
import app.pantopus.android.ui.screens.scheduling.resources.PickerValueRow
import app.pantopus.android.ui.screens.scheduling.resources.ResourceDatePickerDialog
import app.pantopus.android.ui.screens.scheduling.resources.ResourceTimePickerDialog
import app.pantopus.android.ui.screens.scheduling.resources.SectionCard
import app.pantopus.android.ui.screens.scheduling.resources.SelectChipIcon
import app.pantopus.android.ui.screens.scheduling.resources.SelectionCheck
import app.pantopus.android.ui.screens.scheduling.resources.VisitKind
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.launch
import java.time.format.DateTimeFormatter
import java.util.Locale

const val VISIT_SETUP_TAG = "scheduling.scheduleVisit"
const val VISIT_SETUP_TITLE_TAG = "scheduling.scheduleVisit.titleField"
const val VISIT_SETUP_NOTE_TAG = "scheduling.scheduleVisit.entryNoteField"

private val DATE_FORMAT = DateTimeFormatter.ofPattern("EEE, MMM d", Locale.US)
private val TIME_FORMAT = DateTimeFormatter.ofPattern("h:mm a", Locale.US)

/** F13 Schedule a Visit — Setup. */
@Composable
fun VisitSetupScreen(
    onBack: () -> Unit = {},
    onNavigate: (String) -> Unit = {},
    viewModel: VisitSetupViewModel = hiltViewModel(),
) {
    val loadState by viewModel.loadState.collectAsStateWithLifecycle()
    val form by viewModel.form.collectAsStateWithLifecycle()
    val members by viewModel.memberRoster.collectAsStateWithLifecycle()
    val isSaving by viewModel.isSaving.collectAsStateWithLifecycle()
    val saveError by viewModel.saveError.collectAsStateWithLifecycle()
    viewModel.didAttemptSave.collectAsStateWithLifecycle()
    val scope = rememberCoroutineScope()

    LaunchedEffect(Unit) { viewModel.start() }

    val canSave = loadState is VisitSetupLoadState.Ready && viewModel.isValid

    Scaffold(
        modifier = Modifier.fillMaxSize().testTag(VISIT_SETUP_TAG),
        containerColor = PantopusColors.appBg,
        topBar = {
            SchedulingTopBar(
                title = "Schedule a visit",
                leading = SchedulingTopBarLeading.Close,
                onLeading = onBack,
                applyStatusBarInset = true,
                trailing = {
                    if (isSaving) {
                        CircularProgressIndicator(
                            color = PantopusColors.home,
                            strokeWidth = 2.dp,
                            modifier = Modifier.padding(end = Spacing.s4).size(20.dp),
                        )
                    } else {
                        TextButton(
                            onClick = {
                                scope.launch {
                                    viewModel.save()?.let { id ->
                                        onNavigate(viewModel.detailRoute(id))
                                    }
                                }
                            },
                            enabled = canSave,
                        ) {
                            Text(
                                "Next",
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold,
                                color = if (canSave) PantopusColors.home else PantopusColors.appTextMuted,
                            )
                        }
                    }
                },
            )
        },
    ) { padding ->
        Box(modifier = Modifier.padding(padding).fillMaxSize()) {
            when (val state = loadState) {
                VisitSetupLoadState.Loading -> SchedulingLoadingSkeleton(rows = 4)
                is VisitSetupLoadState.Error ->
                    ErrorState(
                        message = state.message,
                        onRetry = viewModel::load,
                    )
                VisitSetupLoadState.Ready -> VisitSetupBody(form, members, viewModel)
            }
        }
    }

    saveError?.let { message ->
        AlertDialog(
            onDismissRequest = viewModel::clearSaveError,
            confirmButton = { TextButton(onClick = viewModel::clearSaveError) { Text("OK") } },
            title = { Text("Couldn't schedule") },
            text = { Text(message) },
        )
    }
}

@Composable
private fun VisitSetupBody(
    form: VisitSetupForm,
    members: List<HomeMember>,
    viewModel: VisitSetupViewModel,
) {
    var showDatePicker by remember { mutableStateOf(false) }
    var showTimePicker by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Explainer()

        SectionCard {
            PantopusTextField(
                label = "Title",
                value = form.title,
                onValueChange = viewModel::setTitle,
                placeholder = "e.g. Plumber visit",
                fieldTestTag = VISIT_SETUP_TITLE_TAG,
            )
            viewModel.titleError?.let { FieldError(it) }
            Text(
                "Visit type",
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                verticalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                VisitKind.entries.forEach { kind ->
                    SelectChipIcon(label = kind.label, icon = kind.icon, isOn = kind == form.kind, onClick = {
                        viewModel.setKind(kind)
                    })
                }
            }
        }

        SectionCard(overline = "Who must be home") {
            if (members.isEmpty()) {
                Text(
                    "No household members found.",
                    fontSize = 13.sp,
                    color = PantopusColors.appTextSecondary,
                )
            } else {
                members.forEachIndexed { index, member ->
                    Row(
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .clickable {
                                    viewModel.toggleHost(member.id)
                                }.padding(vertical = Spacing.s1),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                    ) {
                        HomeMemberAvatar(member = member, size = 32.dp)
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                member.name,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = PantopusColors.appText,
                            )
                            Text(
                                "Required at home",
                                fontSize = 11.sp,
                                color = PantopusColors.appTextSecondary,
                            )
                        }
                        SelectionCheck(isOn = form.whoIsHome.contains(member.id))
                    }
                    if (index <
                        members.size - 1
                    ) {
                        HorizontalDivider(color = PantopusColors.appBorderSubtle)
                    }
                }
            }
            viewModel.hostError?.let { FieldError(it) }
        }

        SectionCard(overline = "When") {
            PickerValueRow(label = "Date", value = form.date.format(DATE_FORMAT), onClick = {
                showDatePicker =
                    true
            })
            HorizontalDivider(color = PantopusColors.appBorderSubtle)
            PickerValueRow(
                label = "Start time",
                value =
                    form.startTime.format(
                        TIME_FORMAT,
                    ),
                onClick = {
                    showTimePicker =
                        true
                },
            )
            HorizontalDivider(color = PantopusColors.appBorderSubtle)
            CounterRow(
                label = "Visit length",
                value = form.durationHours,
                onValueChange = viewModel::setDurationHours,
                unit = "hr",
                range =
                    1..12,
            )
        }

        SectionCard(overline = "Access") {
            PantopusTextField(
                label = "Entry note",
                value = form.entryNote,
                onValueChange = viewModel::setEntryNote,
                placeholder = "Entry note for the visitor",
                fieldTestTag = VISIT_SETUP_NOTE_TAG,
            )
            Text(
                "Optional — e.g. “Front door code 4827”.",
                fontSize = 11.sp,
                color = PantopusColors.appTextSecondary,
            )
            LinkAccessCodeRow()
        }
    }

    if (showDatePicker) {
        ResourceDatePickerDialog(
            initial = form.date,
            onSelect = {
                viewModel.setDate(it)
                showDatePicker = false
            },
            onDismiss = { showDatePicker = false },
        )
    }
    if (showTimePicker) {
        ResourceTimePickerDialog(
            initial = form.startTime,
            onSelect = {
                viewModel.setStartTime(it)
                showTimePicker = false
            },
            onDismiss = { showTimePicker = false },
        )
    }
}

@Composable
private fun Explainer() {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.infoBg)
                .border(1.dp, PantopusColors.infoLight, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s3),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        verticalAlignment = Alignment.Top,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Info,
            contentDescription = null,
            size = 15.dp,
            tint = PantopusColors.info,
        )
        Text(
            "Slots come from when your chosen hosts are personally free.",
            fontSize = 11.5.sp,
            lineHeight = 16.sp,
            color = PantopusColors.primary800,
        )
    }
}

/**
 * "Link an access code" affordance (F13 AccessNote). View-only — the access-code
 * directory has no v1 backend, so this renders the designed structure.
 */
@Composable
private fun LinkAccessCodeRow() {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                .clickable(onClickLabel = "Link an access code") {}
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Box(
            modifier =
                Modifier
                    .size(30.dp)
                    .clip(RoundedCornerShape(Radii.sm))
                    .background(PantopusColors.appSurfaceSunken),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.KeyRound,
                contentDescription = null,
                size = 15.dp,
                tint = PantopusColors.appText,
            )
        }
        Text(
            "Link an access code",
            fontSize = 12.5.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
            modifier = Modifier.weight(1f),
        )
        PantopusIconImage(
            icon = PantopusIcon.ChevronRight,
            contentDescription = null,
            size = 16.dp,
            tint = PantopusColors.appTextMuted,
        )
    }
}

@Composable
private fun FieldError(message: String) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.AlertCircle,
            contentDescription = null,
            size = 11.dp,
            tint = PantopusColors.error,
        )
        Text(message, fontSize = 11.sp, color = PantopusColors.error)
    }
}
