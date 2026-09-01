@file:Suppress("PackageNaming", "LongMethod", "MagicNumber")

package app.pantopus.android.ui.screens.homes.maintenance

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.analytics.Analytics
import app.pantopus.android.data.analytics.AnalyticsEvent
import app.pantopus.android.data.api.models.homes.MaintenanceTaskDto
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.components.StatusChip
import app.pantopus.android.ui.screens.shared.content_detail.ContentDetailShell
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import java.time.Instant

/**
 * P2.9 — Detail surface for a single maintenance entry. Wraps the
 * shared [ContentDetailShell]; renders header (category icon + title +
 * status chip + cost) + detail grid + optional notes/photos/receipt
 * blocks + Edit / Delete bottom actions.
 */
@Composable
fun MaintenanceDetailScreen(
    onBack: () -> Unit,
    onEdit: () -> Unit,
    viewModel: MaintenanceDetailViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val isMutating by viewModel.isMutating.collectAsStateWithLifecycle()
    val actionError by viewModel.actionError.collectAsStateWithLifecycle()
    val event by viewModel.event.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) {
        viewModel.load()
        Analytics.track(AnalyticsEvent.ScreenMaintenanceDetailViewed)
    }

    LaunchedEffect(event) {
        if (event is MaintenanceDetailEvent.Deleted) {
            viewModel.consumeEvent()
            onBack()
        }
    }

    MaintenanceDetailContent(
        state = state,
        isMutating = isMutating,
        actionError = actionError,
        onBack = onBack,
        onEdit = onEdit,
        onRetry = viewModel::refresh,
        onDelete = viewModel::delete,
    )
}

@Composable
internal fun MaintenanceDetailContent(
    state: MaintenanceDetailUiState,
    isMutating: Boolean,
    actionError: String?,
    onBack: () -> Unit,
    onEdit: () -> Unit,
    onRetry: () -> Unit,
    onDelete: () -> Unit,
) {
    var showDeleteConfirm by remember { mutableStateOf(false) }
    Box(modifier = Modifier.testTag("maintenanceDetail")) {
        when (state) {
            MaintenanceDetailUiState.Loading -> LoadingBody(onBack = onBack)
            is MaintenanceDetailUiState.Error ->
                ErrorBody(
                    message = state.message,
                    onBack = onBack,
                    onRetry = onRetry,
                )
            is MaintenanceDetailUiState.Loaded ->
                LoadedBody(
                    task = state.task,
                    draft = state.draft,
                    isMutating = isMutating,
                    actionError = actionError,
                    onBack = onBack,
                    onEdit = onEdit,
                    onDelete = { showDeleteConfirm = true },
                )
        }
    }

    if (showDeleteConfirm) {
        AlertDialog(
            onDismissRequest = { showDeleteConfirm = false },
            title = { Text("Delete this maintenance entry?") },
            text = { Text("It won't appear in the maintenance log anymore.") },
            confirmButton = {
                TextButton(
                    onClick = {
                        showDeleteConfirm = false
                        onDelete()
                    },
                    modifier = Modifier.testTag("maintenanceDetail_deleteConfirm"),
                ) {
                    Text("Delete", color = PantopusColors.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteConfirm = false }) {
                    Text("Keep it")
                }
            },
        )
    }
}

@Composable
private fun LoadingBody(onBack: () -> Unit) {
    ContentDetailShell(
        title = "Maintenance",
        onBack = onBack,
        header = {
            Shimmer(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .padding(horizontal = Spacing.s4)
                        .height(100.dp)
                        .clip(RoundedCornerShape(Radii.lg)),
            )
        },
        body = {
            Column(
                modifier = Modifier.padding(horizontal = Spacing.s4),
                verticalArrangement = Arrangement.spacedBy(Spacing.s3),
            ) {
                Shimmer(modifier = Modifier.fillMaxWidth().height(60.dp))
                Shimmer(modifier = Modifier.fillMaxWidth().height(60.dp))
                Shimmer(modifier = Modifier.fillMaxWidth().height(120.dp))
            }
        },
    )
}

@Composable
private fun ErrorBody(
    message: String,
    onBack: () -> Unit,
    onRetry: () -> Unit,
) {
    ContentDetailShell(
        title = "Maintenance",
        onBack = onBack,
        header = {},
        body = {
            Box(modifier = Modifier.fillMaxWidth().height(400.dp)) {
                EmptyState(
                    icon = PantopusIcon.AlertCircle,
                    headline = "Couldn't load this entry",
                    subcopy = message,
                    ctaTitle = "Try again",
                    onCta = onRetry,
                )
            }
        },
    )
}

@Composable
private fun LoadedBody(
    task: MaintenanceTaskDto,
    draft: MaintenanceDraft?,
    isMutating: Boolean,
    actionError: String?,
    onBack: () -> Unit,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
) {
    val projection = remember(task) { MaintenanceListViewModel.project(task, Instant.now()) }
    ContentDetailShell(
        title = "Maintenance",
        onBack = onBack,
        header = {
            Column(modifier = Modifier.padding(horizontal = Spacing.s4)) {
                MaintenanceHeader(projection = projection)
            }
        },
        body = {
            Column(
                modifier = Modifier.padding(horizontal = Spacing.s4),
                verticalArrangement = Arrangement.spacedBy(Spacing.s4),
            ) {
                DetailGrid(task = task, draft = draft)
                if (!draft?.notes.isNullOrEmpty()) {
                    NotesBlock(notes = draft.notes)
                }
                val photos = draft?.photos.orEmpty()
                if (photos.isNotEmpty()) {
                    PhotoGrid(photos = photos)
                }
                draft?.receipt?.let { ReceiptBlock(file = it) }
                if (actionError != null) {
                    Text(
                        text = actionError,
                        style = PantopusTextStyle.small,
                        color = PantopusColors.error,
                        modifier = Modifier.testTag("maintenanceDetail_actionError"),
                    )
                }
                DetailActions(
                    isMutating = isMutating,
                    onEdit = onEdit,
                    onDelete = onDelete,
                )
            }
        },
    )
}

// MARK: - Sub-views

@Composable
private fun MaintenanceHeader(projection: MaintenanceRowProjection) {
    val category = projection.category
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(BorderStroke(1.dp, PantopusColors.appBorderSubtle), RoundedCornerShape(Radii.lg))
                .padding(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier =
                    Modifier
                        .size(48.dp)
                        .clip(RoundedCornerShape(Radii.md))
                        .background(category.background),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = category.icon,
                    contentDescription = null,
                    size = Radii.xl3,
                    tint = category.foreground,
                )
            }
            Spacer(modifier = Modifier.width(Spacing.s3))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = projection.title,
                    style = PantopusTextStyle.h3,
                    color = PantopusColors.appText,
                    modifier = Modifier.semantics { heading() },
                )
                Text(
                    text = if (category == MaintenanceCategory.Landscape) "Yard" else category.label,
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.appTextSecondary,
                )
            }
            Text(
                text = projection.amount,
                style = PantopusTextStyle.h3,
                color = PantopusColors.appText,
            )
        }
        StatusChip(
            text = projection.chipText,
            variant = projection.chipVariant,
            icon = projection.chipIcon,
        )
    }
}

@Composable
private fun DetailGrid(
    task: MaintenanceTaskDto,
    draft: MaintenanceDraft?,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(BorderStroke(1.dp, PantopusColors.appBorderSubtle), RoundedCornerShape(Radii.lg)),
    ) {
        GridRow(label = "Status", value = task.status.replaceFirstChar { it.titlecase() }.replace('_', ' '))
        Divider()
        GridRow(label = "Performed by", value = performedByValue(task, draft))
        val contact = draft?.performerContact.orEmpty()
        if (contact.isNotEmpty()) {
            Divider()
            GridRow(label = "Contact", value = contact)
        }
        val due = formatDueDateForDetail(task.dueDate)
        if (due != null) {
            Divider()
            GridRow(label = "Next due", value = due)
        }
        Divider()
        GridRow(label = "Recurrence", value = recurrenceLabel(task.recurrence))
    }
}

@Composable
private fun GridRow(
    label: String,
    value: String,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s4, vertical = Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = label,
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.weight(1f),
        )
        Text(
            text = value,
            style = PantopusTextStyle.body,
            color = PantopusColors.appText,
        )
    }
}

@Composable
private fun Divider() {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(1.dp)
                .background(PantopusColors.appBorderSubtle),
    )
}

@Composable
private fun NotesBlock(notes: String) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Text(
            text = "NOTES",
            style = PantopusTextStyle.overline,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.padding(bottom = Spacing.s2).semantics { heading() },
        )
        Text(
            text = notes,
            style = PantopusTextStyle.body,
            color = PantopusColors.appText,
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.appSurface)
                    .border(BorderStroke(1.dp, PantopusColors.appBorderSubtle), RoundedCornerShape(Radii.lg))
                    .padding(Spacing.s4)
                    .testTag("maintenanceDetail_notes"),
        )
    }
}

@Composable
private fun PhotoGrid(photos: List<MaintenanceDraftFile>) {
    Column(modifier = Modifier.fillMaxWidth().testTag("maintenanceDetail_photos")) {
        Text(
            text = "PHOTOS",
            style = PantopusTextStyle.overline,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.padding(bottom = Spacing.s2).semantics { heading() },
        )
        photos.chunked(2).forEach { pair ->
            Row(
                modifier = Modifier.fillMaxWidth().padding(bottom = Spacing.s2),
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                pair.forEach { photo ->
                    Box(
                        modifier =
                            Modifier
                                .weight(1f)
                                .height(120.dp)
                                .clip(RoundedCornerShape(Radii.md))
                                .background(PantopusColors.appSurfaceMuted)
                                .semantics { contentDescription = "Photo" }
                                .testTag("maintenanceDetail_photo_${photo.id}"),
                        contentAlignment = Alignment.Center,
                    ) {
                        PantopusIconImage(
                            icon = PantopusIcon.Image,
                            contentDescription = null,
                            size = 28.dp,
                            tint = PantopusColors.appTextSecondary,
                        )
                    }
                }
                if (pair.size == 1) Spacer(modifier = Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun ReceiptBlock(file: MaintenanceDraftFile) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Text(
            text = "RECEIPT",
            style = PantopusTextStyle.overline,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.padding(bottom = Spacing.s2).semantics { heading() },
        )
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurface)
                    .border(BorderStroke(1.dp, PantopusColors.appBorderSubtle), RoundedCornerShape(Radii.md))
                    .padding(Spacing.s3)
                    .testTag("maintenanceDetail_receipt"),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier =
                    Modifier
                        .size(40.dp)
                        .clip(RoundedCornerShape(Radii.sm))
                        .background(PantopusColors.appSurfaceMuted),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon =
                        if (file.mimeType == "application/pdf") PantopusIcon.FileText else PantopusIcon.Image,
                    contentDescription = null,
                    size = 18.dp,
                    tint = PantopusColors.appTextSecondary,
                )
            }
            Spacer(modifier = Modifier.width(Spacing.s3))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = file.filename,
                    style = PantopusTextStyle.body,
                    color = PantopusColors.appText,
                    maxLines = 1,
                )
                Text(
                    text = if (file.mimeType == "application/pdf") "PDF" else "Image",
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.appTextSecondary,
                )
            }
        }
    }
}

@Composable
private fun DetailActions(
    isMutating: Boolean,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(44.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.primary50)
                    .clickable(enabled = !isMutating, onClick = onEdit)
                    .testTag("maintenanceDetail_edit"),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Pencil,
                contentDescription = null,
                size = Radii.xl,
                tint = PantopusColors.primary600,
            )
            Spacer(modifier = Modifier.width(Spacing.s2))
            Text(
                text = "Edit",
                style = PantopusTextStyle.body,
                color = PantopusColors.primary600,
                fontWeight = FontWeight.SemiBold,
            )
        }
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(44.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.errorBg)
                    .clickable(enabled = !isMutating, onClick = onDelete)
                    .testTag("maintenanceDetail_delete"),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Trash2,
                contentDescription = null,
                size = Radii.xl,
                tint = PantopusColors.error,
            )
            Spacer(modifier = Modifier.width(Spacing.s2))
            Text(
                text = "Delete",
                style = PantopusTextStyle.body,
                color = PantopusColors.error,
                fontWeight = FontWeight.SemiBold,
            )
        }
    }
}

// MARK: - Helpers

private fun performedByValue(
    task: MaintenanceTaskDto,
    draft: MaintenanceDraft?,
): String {
    if (draft == null) {
        val vendor = task.vendor?.trim().orEmpty()
        return if (vendor.isEmpty()) "Self" else vendor
    }
    return when (draft.performedBy) {
        MaintenancePerformedBy.Self -> "Self"
        MaintenancePerformedBy.Member -> memberPerformedByValue(draft.performerName)
        MaintenancePerformedBy.Contractor -> draft.performerName.trim().ifEmpty { "Contractor" }
    }
}

private fun memberPerformedByValue(rawName: String): String {
    val name = rawName.trim()
    return if (name.isEmpty()) "Household member" else "Member · $name"
}

private fun recurrenceLabel(raw: String): String =
    when (raw) {
        "one_time" -> "One-time"
        "monthly" -> "Monthly"
        "quarterly" -> "Quarterly"
        "yearly" -> "Yearly"
        "weekly" -> "Weekly"
        else -> raw.replaceFirstChar { it.titlecase() }
    }

private fun formatDueDateForDetail(iso: String?): String? {
    if (iso.isNullOrBlank()) return null
    // `parseDate` already guards every parser failure with `runCatching`
    // and falls back to `Instant.now()`, so the chain below cannot throw.
    val instant = LogMaintenanceFormViewModel.parseDate(iso)
    // `LocalDate.ofInstant` is API 34+; using atZone + toLocalDate keeps
    // this method usable on the minSdk 26 baseline.
    val local = instant.atZone(java.time.ZoneId.of("UTC")).toLocalDate()
    val month = local.month.name.lowercase().replaceFirstChar { it.titlecase() }
    return "$month ${local.dayOfMonth}"
}
