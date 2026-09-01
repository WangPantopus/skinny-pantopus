@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "TooManyFunctions")

package app.pantopus.android.ui.screens.homes.emergency

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
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
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.shared.content_detail.ContentDetailShell
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * P2.8 — Read-only Emergency Info detail. Built on
 * [ContentDetailShell].
 *
 * @param onBack Pops the detail.
 * @param onEdit Navigates to the edit form (routes through the same
 *     `AddEmergencyInfoFormScreen` with an `emergencyId` nav arg so
 *     the form VM seeds itself).
 * @param onChanged Fired after a local edit / delete so the parent
 *     list refreshes.
 */
@Composable
fun EmergencyInfoDetailScreen(
    onBack: () -> Unit,
    onEdit: () -> Unit = {},
    onChanged: () -> Unit = {},
    viewModel: EmergencyInfoDetailViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val isDeleted by viewModel.isDeleted.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) {
        viewModel.configure(onChanged = onChanged)
        viewModel.load()
    }

    LaunchedEffect(isDeleted) {
        if (isDeleted) onBack()
    }

    Box(modifier = Modifier.fillMaxSize().testTag("emergencyInfoDetail")) {
        when (val current = state) {
            EmergencyInfoDetailUiState.Loading -> LoadingShell(onBack)
            EmergencyInfoDetailUiState.Missing -> MissingShell(onBack)
            is EmergencyInfoDetailUiState.Error -> ErrorShell(current.message, onBack) { viewModel.load() }
            is EmergencyInfoDetailUiState.Loaded ->
                LoadedShell(
                    state = current,
                    onBack = onBack,
                    onEdit = onEdit,
                    onAskDelete = viewModel::showDeleteConfirm,
                )
        }

        val current = state
        if (current is EmergencyInfoDetailUiState.Loaded && current.showsDeleteConfirm) {
            DeleteConfirmDialog(
                onCancel = viewModel::hideDeleteConfirm,
                onConfirm = viewModel::confirmDelete,
            )
        }
    }
}

// MARK: - Shells

@Composable
private fun LoadingShell(onBack: () -> Unit) {
    ContentDetailShell(
        title = "Emergency item",
        onBack = onBack,
        header = {
            Column(
                modifier = Modifier.padding(horizontal = Spacing.s4),
                verticalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                Shimmer(width = 220.dp, height = 24.dp, cornerRadius = Radii.sm)
                Shimmer(width = 140.dp, height = 14.dp, cornerRadius = Radii.sm)
            }
        },
        body = {
            Column(
                modifier = Modifier.padding(horizontal = Spacing.s4),
                verticalArrangement = Arrangement.spacedBy(Spacing.s3),
            ) {
                Shimmer(width = 320.dp, height = 96.dp, cornerRadius = Radii.md)
                Shimmer(width = 320.dp, height = 48.dp, cornerRadius = Radii.md)
            }
        },
    )
}

@Composable
private fun MissingShell(onBack: () -> Unit) {
    ContentDetailShell(
        title = "Emergency item",
        onBack = onBack,
        header = {},
        body = {
            EmptyState(
                icon = PantopusIcon.AlertCircle,
                headline = "Item no longer available",
                subcopy = "This emergency entry may have been removed by another household member.",
                ctaTitle = "Back",
                onCta = onBack,
            )
        },
    )
}

@Composable
private fun ErrorShell(
    message: String,
    onBack: () -> Unit,
    onRetry: () -> Unit,
) {
    ContentDetailShell(
        title = "Emergency item",
        onBack = onBack,
        header = {},
        body = {
            EmptyState(
                icon = PantopusIcon.AlertCircle,
                headline = "Couldn't load this item",
                subcopy = message,
                ctaTitle = "Try again",
                onCta = onRetry,
            )
        },
    )
}

@Composable
private fun LoadedShell(
    state: EmergencyInfoDetailUiState.Loaded,
    onBack: () -> Unit,
    onEdit: () -> Unit,
    onAskDelete: () -> Unit,
) {
    val draft = state.draft
    ContentDetailShell(
        title = "Emergency item",
        onBack = onBack,
        header = {
            DetailHeader(draft = draft, modifier = Modifier.padding(horizontal = Spacing.s4))
        },
        body = {
            Column(
                modifier = Modifier.padding(horizontal = Spacing.s4),
                verticalArrangement = Arrangement.spacedBy(Spacing.s4),
            ) {
                if (draft.details.isNotEmpty()) {
                    DetailsCard(text = draft.details)
                }
                MetaCard(draft = draft)
                ActionsRow(
                    isDeleting = state.isDeleting,
                    onEdit = onEdit,
                    onDelete = onAskDelete,
                )
            }
        },
    )
}

@Composable
private fun DetailHeader(
    draft: EmergencyFormDraft,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorderSubtle, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
            verticalAlignment = Alignment.Top,
        ) {
            Box(
                modifier =
                    Modifier
                        .size(48.dp)
                        .clip(RoundedCornerShape(Radii.sm))
                        .background(draft.category.palette.background),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = draft.category.icon,
                    contentDescription = null,
                    size = Radii.xl3,
                    tint = draft.category.palette.foreground,
                )
            }
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                Text(
                    text = draft.title,
                    style = PantopusTextStyle.h3,
                    color = PantopusColors.appText,
                    modifier = Modifier.semantics { heading() },
                )
                Text(
                    text = draft.category.label,
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.appTextSecondary,
                )
            }
        }
        draft.severity?.let { SeverityChip(severity = it) }
    }
}

/** Severity chip — fill + foreground from semantic tokens; critical
 *  pairs with the alert-triangle glyph per the acceptance check.
 */
@Composable
fun SeverityChip(severity: EmergencySeverity) {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(severity.background)
                .padding(horizontal = Spacing.s2, vertical = Spacing.s1)
                .testTag("severityChip_${severity.id}")
                .semantics { contentDescription = "Severity ${severity.label}" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(
            icon = severity.icon,
            contentDescription = null,
            size = Radii.lg,
            tint = severity.foreground,
        )
        Text(
            text = severity.label,
            style = PantopusTextStyle.caption,
            fontWeight = FontWeight.SemiBold,
            color = severity.foreground,
        )
    }
}

@Composable
private fun DetailsCard(text: String) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorderSubtle, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Text(
            text = "DETAILS",
            style = PantopusTextStyle.overline,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.semantics { heading() },
        )
        Text(
            text = text,
            style = PantopusTextStyle.body,
            color = PantopusColors.appText,
            modifier = Modifier.testTag("emergencyDetail_body"),
        )
    }
}

@Composable
private fun MetaCard(draft: EmergencyFormDraft) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorderSubtle, RoundedCornerShape(Radii.lg)),
    ) {
        draft.verifiedByUserId?.takeIf { it.isNotEmpty() }?.let { uid ->
            MetaRow(label = "Verified by", value = uid, icon = PantopusIcon.UserRound)
            HorizontalDivider(color = PantopusColors.appBorderSubtle, thickness = 1.dp)
        }
        MetaRow(
            label = "Last updated",
            value = formatInstant(draft.lastUpdated),
            icon = PantopusIcon.Clock,
        )
    }
}

@Composable
private fun MetaRow(
    label: String,
    value: String,
    icon: PantopusIcon,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s4, vertical = Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = icon,
            contentDescription = null,
            size = 14.dp,
            tint = PantopusColors.appTextSecondary,
        )
        Text(label, style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
        Spacer(Modifier.weight(1f))
        Text(value, style = PantopusTextStyle.body, color = PantopusColors.appText)
    }
}

@Composable
private fun ActionsRow(
    isDeleting: Boolean,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 48.dp)
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.primary600)
                    .clickable(onClick = onEdit)
                    .padding(horizontal = Spacing.s4, vertical = Spacing.s3)
                    .testTag("emergencyDetail_edit"),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Pencil,
                contentDescription = null,
                size = Radii.xl,
                tint = PantopusColors.appTextInverse,
            )
            Text(
                text = "Edit",
                style = PantopusTextStyle.body,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appTextInverse,
                modifier = Modifier.weight(1f),
            )
        }
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 48.dp)
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.errorBg)
                    .clickable(enabled = !isDeleting, onClick = onDelete)
                    .padding(horizontal = Spacing.s4, vertical = Spacing.s3)
                    .testTag("emergencyDetail_delete"),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Trash2,
                contentDescription = null,
                size = Radii.xl,
                tint = PantopusColors.error,
            )
            Text(
                text = "Delete",
                style = PantopusTextStyle.body,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.error,
                modifier = Modifier.weight(1f),
            )
        }
    }
}

@Composable
private fun DeleteConfirmDialog(
    onCancel: () -> Unit,
    onConfirm: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onCancel,
        title = { Text("Delete this emergency item?") },
        text = {
            Text(
                "This removes it from the household emergency plan. " +
                    "Anyone with access will no longer see it.",
            )
        },
        confirmButton = {
            TextButton(
                onClick = onConfirm,
                modifier = Modifier.testTag("emergencyDetail_deleteConfirm"),
            ) {
                Text("Delete", color = PantopusColors.error)
            }
        },
        dismissButton = {
            TextButton(onClick = onCancel) { Text("Keep") }
        },
    )
}

private fun formatInstant(instant: java.time.Instant): String {
    val formatter =
        DateTimeFormatter
            .ofPattern("MMM d, yyyy 'at' h:mm a", Locale.US)
            .withZone(ZoneId.systemDefault())
    return formatter.format(instant)
}
