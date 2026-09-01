@file:Suppress("PackageNaming", "MagicNumber", "LongMethod")

package app.pantopus.android.ui.screens.homes.packages

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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.analytics.Analytics
import app.pantopus.android.data.analytics.AnalyticsEvent
import app.pantopus.android.data.api.models.homes.PackageDto
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.GhostButton
import app.pantopus.android.ui.components.PrimaryButton
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
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * Read-mostly Package detail screen — built on the shared
 * `ContentDetailShell`. Provides "Mark picked up" + "Mark missing" +
 * "Remove package" actions, all via
 * `PUT /api/homes/:id/packages/:packageId`.
 */
@Composable
fun PackageDetailScreen(
    onBack: () -> Unit,
    onChanged: () -> Unit = {},
    viewModel: PackageDetailViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) {
        viewModel.configureNavigation(onChanged = onChanged, onClose = onBack)
        viewModel.load()
        Analytics.track(AnalyticsEvent.ScreenPackageDetailViewed)
    }
    Box(Modifier.fillMaxSize().testTag("packageDetail")) {
        when (val current = state) {
            PackageDetailUiState.Loading -> LoadingShell(onBack)
            is PackageDetailUiState.Error -> ErrorShell(current.message, onBack) { viewModel.load() }
            is PackageDetailUiState.Loaded ->
                LoadedShell(
                    pkg = current.pkg,
                    saving = current.saving,
                    saveError = current.saveError,
                    onBack = onBack,
                    onMarkPickedUp = viewModel::markPickedUp,
                    onMarkMissing = viewModel::markMissing,
                    onRemove = viewModel::remove,
                )
        }
    }
}

@Composable
private fun LoadingShell(onBack: () -> Unit) {
    ContentDetailShell(
        title = "Package",
        onBack = onBack,
        header = {
            Column(
                modifier = Modifier.padding(horizontal = Spacing.s4),
                verticalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                Shimmer(width = 200.dp, height = 18.dp, cornerRadius = Radii.sm)
                Shimmer(width = 120.dp, height = 14.dp, cornerRadius = Radii.sm)
            }
        },
        body = {
            Column(
                modifier = Modifier.padding(horizontal = Spacing.s4),
                verticalArrangement = Arrangement.spacedBy(Spacing.s3),
            ) {
                Shimmer(width = 320.dp, height = 60.dp, cornerRadius = Radii.md)
                Shimmer(width = 320.dp, height = 60.dp, cornerRadius = Radii.md)
            }
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
        title = "Package",
        onBack = onBack,
        header = {},
        body = {
            EmptyState(
                icon = PantopusIcon.AlertCircle,
                headline = "Couldn't load this package",
                subcopy = message,
                ctaTitle = "Try again",
                onCta = onRetry,
            )
        },
    )
}

@Composable
private fun LoadedShell(
    pkg: PackageDto,
    saving: Boolean,
    saveError: String?,
    onBack: () -> Unit,
    onMarkPickedUp: () -> Unit,
    onMarkMissing: () -> Unit,
    onRemove: () -> Unit,
) {
    val projection = PackagesListViewModel.project(pkg, currentUserId = null, memberLookup = { null })
    val status = projection.status
    ContentDetailShell(
        title = "Package",
        onBack = onBack,
        header = {
            PackageHeader(
                projection = projection,
                modifier = Modifier.padding(horizontal = Spacing.s4),
            )
        },
        body = {
            Column(
                modifier = Modifier.padding(horizontal = Spacing.s4),
                verticalArrangement = Arrangement.spacedBy(Spacing.s4),
            ) {
                DetailGrid(pkg = pkg, statusLabel = projection.chipText)
                if (saveError != null) {
                    Text(
                        text = saveError,
                        style = PantopusTextStyle.small,
                        color = PantopusColors.error,
                    )
                }
                if (status != PackageChipStatus.Returned) {
                    Row(
                        modifier =
                            Modifier
                                .clickable(enabled = !saving, onClick = onRemove)
                                .testTag("packageDetail_remove"),
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
                            text = "Remove package",
                            style = PantopusTextStyle.small,
                            fontWeight = FontWeight.SemiBold,
                            color = PantopusColors.error,
                        )
                    }
                }
            }
        },
        cta = {
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                PrimaryButton(
                    title = primaryCtaLabel(status),
                    isLoading = saving,
                    isEnabled = !status.isTerminal && !saving,
                    onClick = onMarkPickedUp,
                    modifier = Modifier.testTag("packageDetail_markPickedUp"),
                )
                if (!status.isTerminal) {
                    GhostButton(
                        title = "Mark missing",
                        isEnabled = !saving,
                        onClick = onMarkMissing,
                        modifier = Modifier.testTag("packageDetail_markMissing"),
                    )
                }
            }
        },
    )
}

private fun primaryCtaLabel(status: PackageChipStatus): String =
    when (status) {
        PackageChipStatus.PickedUp -> "Picked up"
        PackageChipStatus.Returned -> "Returned"
        PackageChipStatus.Lost -> "Marked missing"
        PackageChipStatus.Delivered,
        PackageChipStatus.Expected,
        PackageChipStatus.OutForDelivery,
        -> "Mark picked up"
    }

@Composable
private fun PackageHeader(
    projection: PackageRowProjection,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorderSubtle, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            Box(
                modifier =
                    Modifier
                        .size(48.dp)
                        .clip(RoundedCornerShape(Radii.sm))
                        .background(projection.courier.background),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = projection.courier.icon,
                    contentDescription = null,
                    size = 22.dp,
                    tint = projection.courier.foreground,
                )
            }
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                Text(
                    text = projection.title,
                    style = PantopusTextStyle.h3,
                    color = PantopusColors.appText,
                )
                projection.subtitle?.let {
                    Text(
                        text = it,
                        style = PantopusTextStyle.small,
                        color = PantopusColors.appTextSecondary,
                    )
                }
            }
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
    pkg: PackageDto,
    statusLabel: String,
) {
    val courier = CourierKind.from(pkg.carrier)
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorderSubtle, RoundedCornerShape(Radii.lg)),
    ) {
        DetailRow("Courier", courier.label)
        pkg.trackingNumber?.takeIf { it.isNotBlank() }?.let {
            HorizontalDivider(color = PantopusColors.appBorderSubtle, thickness = 1.dp)
            DetailRow("Tracking", it)
        }
        pkg.vendorName?.takeIf { it.isNotBlank() }?.let {
            HorizontalDivider(color = PantopusColors.appBorderSubtle, thickness = 1.dp)
            DetailRow("Vendor", it)
        }
        pkg.deliveryInstructions?.takeIf { it.isNotBlank() }?.let {
            HorizontalDivider(color = PantopusColors.appBorderSubtle, thickness = 1.dp)
            DetailRow("Drop instructions", it)
        }
        formatDay(pkg.expectedAt)?.let {
            HorizontalDivider(color = PantopusColors.appBorderSubtle, thickness = 1.dp)
            DetailRow("Expected", it)
        }
        formatDay(pkg.deliveredAt)?.let {
            HorizontalDivider(color = PantopusColors.appBorderSubtle, thickness = 1.dp)
            DetailRow("Delivered", it)
        }
        HorizontalDivider(color = PantopusColors.appBorderSubtle, thickness = 1.dp)
        DetailRow("Status", statusLabel)
    }
}

@Composable
private fun DetailRow(
    label: String,
    value: String,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s4, vertical = Spacing.s3),
        verticalAlignment = Alignment.Top,
    ) {
        Text(label, style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
        androidx.compose.foundation.layout.Spacer(Modifier.weight(1f))
        Text(
            text = value,
            style = PantopusTextStyle.body,
            color = PantopusColors.appText,
        )
    }
}

private fun formatDay(iso: String?): String? {
    if (iso.isNullOrBlank()) return null
    val instant = runCatching { Instant.parse(iso) }.getOrNull() ?: return null
    val zoned = instant.atZone(ZoneId.of("UTC"))
    return DateTimeFormatter.ofPattern("MMM d, yyyy", Locale.US).format(zoned)
}
