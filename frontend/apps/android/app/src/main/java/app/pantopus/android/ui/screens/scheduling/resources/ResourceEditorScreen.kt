@file:Suppress(
    "PackageNaming",
    "UNUSED_PARAMETER",
    "LongMethod",
    "CyclomaticComplexMethod",
    "MagicNumber",
    "LongParameterList",
)
@file:OptIn(
    androidx.compose.material3.ExperimentalMaterial3Api::class,
    androidx.compose.foundation.layout.ExperimentalLayoutApi::class,
)

package app.pantopus.android.ui.screens.scheduling.resources

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.PantopusFieldState
import app.pantopus.android.ui.components.PantopusTextField
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingLoadingSkeleton
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingTopBar
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingTopBarLeading
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Spacing
import java.time.format.DateTimeFormatter
import java.util.Locale

const val RESOURCE_EDITOR_TAG = "scheduling.resourceEditor"
const val RESOURCE_EDITOR_NAME_TAG = "scheduling.resourceEditor.nameField"
const val RESOURCE_EDITOR_DELETE_TAG = "scheduling.resourceEditor.delete"

private val CLOCK_FORMAT = DateTimeFormatter.ofPattern("h:mm a", Locale.US)

/** F10 Resource Editor — create / edit / delete. */
@Composable
fun ResourceEditorScreen(
    resourceId: String,
    onBack: () -> Unit = {},
    onNavigate: (String) -> Unit = {},
    viewModel: ResourceEditorViewModel = hiltViewModel(),
) {
    val loadState by viewModel.loadState.collectAsStateWithLifecycle()
    val form by viewModel.form.collectAsStateWithLifecycle()
    val isSaving by viewModel.isSaving.collectAsStateWithLifecycle()
    val saveError by viewModel.saveError.collectAsStateWithLifecycle()
    val showDelete by viewModel.showDeleteConfirm.collectAsStateWithLifecycle()
    var nameTouched by remember { mutableStateOf(false) }

    LaunchedStart { viewModel.start() }
    // Saves/deletes run in viewModelScope; this one-shot event flow is the
    // dismiss signal once the write has actually landed.
    androidx.compose.runtime.LaunchedEffect(Unit) {
        viewModel.events.collect { onBack() }
    }

    val canSave =
        loadState is ResourceEditorLoadState.Ready && viewModel.isValid && viewModel.isDirty

    Scaffold(
        modifier = Modifier.fillMaxSize().testTag(RESOURCE_EDITOR_TAG),
        containerColor = PantopusColors.appBg,
        topBar = {
            SchedulingTopBar(
                title = viewModel.screenTitle,
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
                        TextButton(onClick = viewModel::save, enabled = canSave) {
                            Text(
                                text = "Save",
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
                ResourceEditorLoadState.Loading -> EditorSkeleton()
                is ResourceEditorLoadState.Error ->
                    EditorError(
                        state.message,
                        onRetry = viewModel::load,
                    )
                ResourceEditorLoadState.Ready ->
                    Box(modifier = Modifier.fillMaxSize()) {
                        EditorBody(
                            form = form,
                            viewModel = viewModel,
                            showNameError = nameTouched && form.name.isBlank(),
                            isDimmed = isSaving,
                            onNameChange = {
                                nameTouched = true
                                viewModel.setName(it)
                            },
                        )
                        if (isSaving) {
                            Box(
                                modifier = Modifier.fillMaxSize(),
                                contentAlignment = Alignment.Center,
                            ) {
                                SavingOverlay(label = "Saving resource")
                            }
                        }
                    }
            }
        }
    }

    if (showDelete) {
        ResourceDeleteDialog(
            resourceName = form.name.ifBlank { "resource" },
            onDelete = viewModel::confirmDelete,
            onKeep = viewModel::dismissDelete,
        )
    }

    saveError?.let { message ->
        AlertDialog(
            onDismissRequest = viewModel::clearSaveError,
            confirmButton = { TextButton(onClick = viewModel::clearSaveError) { Text("OK") } },
            title = { Text("Couldn't save") },
            text = { Text(message) },
        )
    }
}

@Composable
private fun LaunchedStart(block: () -> Unit) {
    androidx.compose.runtime.LaunchedEffect(Unit) { block() }
}

@Composable
private fun EditorBody(
    form: ResourceEditorForm,
    viewModel: ResourceEditorViewModel,
    showNameError: Boolean,
    isDimmed: Boolean,
    onNameChange: (String) -> Unit,
) {
    var showStartPicker by remember { mutableStateOf(false) }
    var showEndPicker by remember { mutableStateOf(false) }
    var rulesExpanded by remember { mutableStateOf(!viewModel.isCreate) }

    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .alpha(if (isDimmed) 0.45f else 1f)
                .verticalScroll(rememberScrollState())
                .padding(Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        // Name + type
        SectionCard {
            PantopusTextField(
                label = "Name",
                value = form.name,
                onValueChange = onNameChange,
                placeholder = "Name this resource",
                isRequired = true,
                state =
                    if (showNameError) {
                        PantopusFieldState.Error(
                            "Give this resource a name",
                        )
                    } else {
                        PantopusFieldState.Default
                    },
                fieldTestTag = RESOURCE_EDITOR_NAME_TAG,
            )
            Text(
                "Type",
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                verticalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                ResourceKind.entries.forEach { kind ->
                    SelectChip(label = kind.label, isOn = kind == form.kind, onClick = {
                        viewModel.selectKind(kind)
                    })
                }
            }
        }

        // Photo
        SectionCard(overline = "Photo") {
            PhotoAddRow()
        }

        // Who can book
        SectionCard(overline = "Who can book") {
            SegmentedControl(
                options = WhoCanBook.entries,
                selected = form.whoCanBook,
                label = { it.label },
                onSelect = viewModel::setWhoCanBook,
            )
            if (form.whoCanBook != WhoCanBook.Members) {
                Text(
                    "In this version, all active home members can book. Per-member access is coming soon.",
                    fontSize = 11.sp,
                    color = PantopusColors.appTextSecondary,
                )
            }
        }

        // Booking rules (collapsible disclosure with smart-defaults helper)
        RulesDisclosure(
            expanded = rulesExpanded,
            helper = viewModel.ruleHelper,
            onToggle = { rulesExpanded = !rulesExpanded },
        ) {
            CounterRow(
                label = "Max duration",
                value = form.maxDurationHours,
                onValueChange = viewModel::setMaxDurationHours,
                unit = "hr",
                range = 1..24,
                error = form.maxDurationHours <= 0,
            )
            HorizontalDivider(color = PantopusColors.appBorderSubtle)
            CounterRow(
                label = "Buffer between bookings",
                value = form.bufferMin,
                onValueChange = viewModel::setBufferMin,
                unit = "min",
                range = 0..120,
                step = 5,
            )
            HorizontalDivider(color = PantopusColors.appBorderSubtle)
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(
                    "Requires approval",
                    fontSize = 12.5.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appText,
                    modifier = Modifier.weight(1f),
                )
                Switch(
                    checked = form.requiresApproval,
                    onCheckedChange = viewModel::setRequiresApproval,
                    colors =
                        SwitchDefaults.colors(
                            checkedThumbColor = PantopusColors.appSurface,
                            checkedTrackColor = PantopusColors.home,
                        ),
                )
            }
        }

        // Available hours
        SectionCard(overline = "Available hours") {
            WeekdayPicker(selected = form.hoursDays, onToggle = viewModel::toggleDay)
            HorizontalDivider(color = PantopusColors.appBorderSubtle)
            HoursValueRow(
                rangeLabel = "${form.hoursStart.format(CLOCK_FORMAT)} – ${form.hoursEnd.format(CLOCK_FORMAT)}",
                onClick = { showStartPicker = true },
            )
        }

        if (!viewModel.isCreate) {
            Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                TextButton(
                    onClick = viewModel::requestDelete,
                    modifier = Modifier.testTag(RESOURCE_EDITOR_DELETE_TAG),
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.Trash2,
                        contentDescription = null,
                        size = 14.dp,
                        tint = PantopusColors.error,
                    )
                    Text(
                        "  Delete resource",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        color = PantopusColors.error,
                    )
                }
            }
        }
    }

    // The single "Available hours" row opens a combined start→end flow:
    // picking the start time chains directly into the end-time picker.
    if (showStartPicker) {
        ResourceTimePickerDialog(
            initial = form.hoursStart,
            onSelect = {
                viewModel.setHoursStart(it)
                showStartPicker = false
                showEndPicker = true
            },
            onDismiss = { showStartPicker = false },
        )
    }
    if (showEndPicker) {
        ResourceTimePickerDialog(
            initial = form.hoursEnd,
            onSelect = {
                viewModel.setHoursEnd(it)
                showEndPicker = false
            },
            onDismiss = { showEndPicker = false },
        )
    }
}

/**
 * Custom delete-confirm dialog (F10 delete frame): trash-2 error glyph + two
 * stacked full-width 44dp buttons (red Delete, bordered Keep).
 */
@Composable
private fun ResourceDeleteDialog(
    resourceName: String,
    onDelete: () -> Unit,
    onKeep: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onKeep,
        icon = {
            Box(
                modifier =
                    Modifier
                        .size(48.dp)
                        .clip(androidx.compose.foundation.shape.CircleShape)
                        .background(PantopusColors.errorBg),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Trash2,
                    contentDescription = null,
                    size = 22.dp,
                    tint = PantopusColors.error,
                )
            }
        },
        title = {
            Text(
                "Delete $resourceName?",
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
            )
        },
        text = {
            Text(
                "Existing bookings stay on the calendar. New bookings will be turned off.",
                fontSize = 13.sp,
                color = PantopusColors.appTextSecondary,
            )
        },
        confirmButton = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                HomePrimaryButtonStub(label = "Delete", onClick = onDelete)
                HomeSecondaryButton(title = "Keep", onClick = onKeep)
            }
        },
        containerColor = PantopusColors.appSurface,
    )
}

/** Full-width 44dp red destructive button used inside the delete dialog. */
@Composable
private fun HomePrimaryButtonStub(
    label: String,
    onClick: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 44.dp)
                .clip(androidx.compose.foundation.shape.RoundedCornerShape(app.pantopus.android.ui.theme.Radii.lg))
                .background(PantopusColors.error)
                .clickable(
                    onClickLabel = label,
                    role = androidx.compose.ui.semantics.Role.Button,
                    onClick = onClick,
                ),
        contentAlignment = Alignment.Center,
    ) {
        Text(label, fontSize = 13.5.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appTextInverse)
    }
}

@Composable
private fun EditorSkeleton() {
    SchedulingLoadingSkeleton(rows = 4)
}

@Composable
private fun EditorError(
    message: String,
    onRetry: () -> Unit,
) {
    app.pantopus.android.ui.components
        .ErrorState(message = message, onRetry = onRetry)
}
