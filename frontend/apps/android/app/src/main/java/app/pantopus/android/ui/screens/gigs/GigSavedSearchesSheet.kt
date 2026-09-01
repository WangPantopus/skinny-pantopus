@file:Suppress("MagicNumber", "PackageNaming", "LongMethod")
@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package app.pantopus.android.ui.screens.gigs

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * P6a — "Saved searches" manage sheet, reached from the Gig filter
 * sheet's footer link. Rows show the stored/derived name, criteria
 * summary, and relative save date with a notify [Switch] (optimistic
 * PATCH) and a trash delete (optimistic DELETE). Four render states.
 * Mirrors iOS `GigSavedSearchesSheet`.
 */
@Composable
fun GigSavedSearchesSheet(
    state: GigSavedSearchesUiState,
    onToggleNotify: (String, Boolean) -> Unit,
    onDelete: (String) -> Unit,
    onRetry: () -> Unit,
    onDismiss: () -> Unit,
) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = PantopusColors.appSurface,
        modifier = Modifier.testTag("savedSearchesSheet"),
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            SavedSearchesHeader(onClose = onDismiss)
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .heightIn(min = 220.dp, max = 480.dp),
            ) {
                when (state) {
                    is GigSavedSearchesUiState.Loading -> SavedSearchesLoadingFrame()
                    is GigSavedSearchesUiState.Empty -> SavedSearchesEmptyFrame()
                    is GigSavedSearchesUiState.Loaded ->
                        SavedSearchesList(
                            rows = state.rows,
                            onToggleNotify = onToggleNotify,
                            onDelete = onDelete,
                        )
                    is GigSavedSearchesUiState.Error ->
                        SavedSearchesErrorFrame(message = state.message, onRetry = onRetry)
                }
            }
        }
    }
}

@Composable
private fun SavedSearchesHeader(onClose: () -> Unit) {
    Column {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(56.dp)
                    .padding(start = Spacing.s4, end = Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = "Saved searches",
                fontSize = 18.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                modifier = Modifier.weight(1f).semantics { heading() },
            )
            Box(
                modifier =
                    Modifier
                        .size(44.dp)
                        .clickable(onClick = onClose)
                        .semantics {
                            contentDescription = "Close"
                            role = Role.Button
                        },
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.X,
                    contentDescription = null,
                    size = 20.dp,
                    tint = PantopusColors.appTextSecondary,
                )
            }
        }
        HorizontalDivider(color = PantopusColors.appBorderSubtle, thickness = 1.dp)
    }
}

/** Loading — shimmer rows mirroring the loaded row geometry. */
@Composable
private fun SavedSearchesLoadingFrame() {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(Spacing.s4)
                .testTag("savedSearchesLoading"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        repeat(3) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2), modifier = Modifier.weight(1f)) {
                    Shimmer(width = 200.dp, height = 16.dp)
                    Shimmer(width = 140.dp, height = 12.dp)
                }
                Shimmer(width = 44.dp, height = 24.dp, cornerRadius = 12.dp)
            }
        }
    }
}

/** Empty — bell hero + "No saved searches yet". */
@Composable
private fun SavedSearchesEmptyFrame() {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s6, vertical = Spacing.s8)
                .testTag("savedSearches.empty"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Box(
            modifier =
                Modifier
                    .size(64.dp)
                    .clip(CircleShape)
                    .background(PantopusColors.primary50),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Bell,
                contentDescription = null,
                size = 28.dp,
                strokeWidth = 1.8f,
                tint = PantopusColors.primary600,
            )
        }
        Spacer(modifier = Modifier.size(Spacing.s3))
        Text(
            text = "No saved searches yet",
            fontSize = 16.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
        )
        Spacer(modifier = Modifier.size(Spacing.s1))
        Text(
            text = "Save a filter set and we'll alert you when a new task matches.",
            fontSize = 13.sp,
            color = PantopusColors.appTextSecondary,
        )
    }
}

@Composable
private fun SavedSearchesList(
    rows: List<GigSavedSearchRowContent>,
    onToggleNotify: (String, Boolean) -> Unit,
    onDelete: (String) -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = Spacing.s4, vertical = Spacing.s2)
                .testTag("savedSearches.list"),
    ) {
        rows.forEachIndexed { index, row ->
            SavedSearchRow(row = row, onToggleNotify = onToggleNotify, onDelete = onDelete)
            if (index < rows.lastIndex) {
                HorizontalDivider(color = PantopusColors.appBorderSubtle, thickness = 1.dp)
            }
        }
    }
}

@Composable
private fun SavedSearchRow(
    row: GigSavedSearchRowContent,
    onToggleNotify: (String, Boolean) -> Unit,
    onDelete: (String) -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 64.dp)
                .padding(vertical = Spacing.s3)
                .testTag("savedSearches.row_${row.id}"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            Text(
                text = row.title,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            row.summary?.let { summary ->
                Text(
                    text = summary,
                    fontSize = 12.sp,
                    color = PantopusColors.appTextStrong,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            row.savedAgo?.let { savedAgo ->
                Text(
                    text = savedAgo,
                    fontSize = 11.sp,
                    color = PantopusColors.appTextSecondary,
                    maxLines = 1,
                )
            }
        }
        Switch(
            checked = row.notify,
            onCheckedChange = { onToggleNotify(row.id, it) },
            colors =
                SwitchDefaults.colors(
                    checkedTrackColor = PantopusColors.primary600,
                    checkedThumbColor = Color.White,
                ),
            modifier =
                Modifier
                    .testTag("savedSearches.row_${row.id}.notify")
                    .semantics { contentDescription = "Alerts for ${row.title}" },
        )
        Box(
            modifier =
                Modifier
                    .size(44.dp)
                    .clip(CircleShape)
                    .clickable { onDelete(row.id) }
                    .testTag("savedSearches.row_${row.id}.delete")
                    .semantics {
                        contentDescription = "Delete ${row.title}"
                        role = Role.Button
                    },
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Trash2,
                contentDescription = null,
                size = 17.dp,
                tint = PantopusColors.error,
            )
        }
    }
}

@Composable
private fun SavedSearchesErrorFrame(
    message: String,
    onRetry: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s6, vertical = Spacing.s8)
                .testTag("savedSearchesError"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.AlertCircle,
            contentDescription = null,
            size = 32.dp,
            tint = PantopusColors.error,
        )
        Spacer(modifier = Modifier.size(Spacing.s2))
        Text(
            text = "Couldn't load saved searches",
            fontSize = 15.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
        )
        Spacer(modifier = Modifier.size(Spacing.s1))
        Text(
            text = message,
            fontSize = 12.5.sp,
            color = PantopusColors.appTextSecondary,
        )
        Spacer(modifier = Modifier.size(Spacing.s3))
        Box(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.primary600)
                    .clickable(onClick = onRetry)
                    .padding(horizontal = Spacing.s5)
                    .heightIn(min = 40.dp)
                    .testTag("savedSearchesRetry"),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = "Try again",
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appTextInverse,
            )
        }
    }
}
