@file:Suppress("PackageNaming", "MagicNumber", "LongMethod")

package app.pantopus.android.ui.screens.homes.bills

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
import app.pantopus.android.data.api.models.homes.BillDto
import app.pantopus.android.data.api.models.homes.BillSplitDto
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.components.StatusChip
import app.pantopus.android.ui.components.StatusChipVariant
import app.pantopus.android.ui.screens.shared.content_detail.ContentDetailShell
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import java.time.Instant

/**
 * Bill detail screen — read-mostly summary built on the shared
 * `ContentDetailShell`. Provides "Edit", "Mark paid", and "Remove bill"
 * actions.
 *
 * @param onBack Pops back to the Bills list.
 * @param onEdit Navigates to the Add Bill wizard in edit mode with the
 *     current `billId` as a nav arg.
 * @param onChanged Fired after a successful PUT so the list can refresh.
 */
@Composable
fun BillDetailScreen(
    onBack: () -> Unit,
    onEdit: () -> Unit = {},
    onChanged: () -> Unit = {},
    viewModel: BillDetailViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) {
        viewModel.configureNavigation(onChanged = onChanged, onClose = onBack)
        viewModel.load()
        Analytics.track(AnalyticsEvent.ScreenBillDetailViewed)
    }
    Box(Modifier.fillMaxSize().testTag("billDetail")) {
        when (val current = state) {
            BillDetailUiState.Loading -> LoadingShell(onBack)
            is BillDetailUiState.Error -> ErrorShell(current.message, onBack) { viewModel.load() }
            is BillDetailUiState.Loaded ->
                LoadedShell(
                    bill = current.bill,
                    splits = current.splits,
                    saving = current.saving,
                    saveError = current.saveError,
                    actions =
                        BillDetailActions(
                            onBack = onBack,
                            onEdit = onEdit,
                            onMarkPaid = viewModel::markPaid,
                            onRemove = viewModel::remove,
                        ),
                )
        }
    }
}

// MARK: - Shells

@Composable
private fun LoadingShell(onBack: () -> Unit) {
    ContentDetailShell(
        title = "Bill",
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
        title = "Bill",
        onBack = onBack,
        header = {},
        body = {
            EmptyState(
                icon = PantopusIcon.AlertCircle,
                headline = "Couldn't load this bill",
                subcopy = message,
                ctaTitle = "Try again",
                onCta = onRetry,
            )
        },
    )
}

@Composable
private fun LoadedShell(
    bill: BillDto,
    splits: List<BillSplitDto>,
    saving: Boolean,
    saveError: String?,
    actions: BillDetailActions,
) {
    val projection = BillsListViewModel.project(bill, Instant.now())
    val isPaid = bill.status == "paid"
    val autoPay = projection.status == BillChipStatus.Scheduled
    ContentDetailShell(
        title = "Bill",
        onBack = actions.onBack,
        header = {
            BillHeader(
                model =
                    BillHeaderModel(
                        payee = projection.payee,
                        amount = projection.amount,
                        chipText = projection.chipText,
                        chipVariant = projection.chipVariant,
                        chipIcon = projection.chipIcon,
                        category = projection.category,
                        autoPay = autoPay,
                    ),
                modifier = Modifier.padding(horizontal = Spacing.s4),
            )
        },
        body = {
            Column(
                modifier = Modifier.padding(horizontal = Spacing.s4),
                verticalArrangement = Arrangement.spacedBy(Spacing.s4),
            ) {
                DetailGrid(bill = bill)
                if (splits.isNotEmpty()) {
                    SplitsSection(splits = splits)
                }
                if (saveError != null) {
                    Text(
                        text = saveError,
                        style = PantopusTextStyle.small,
                        color = PantopusColors.error,
                    )
                }
                Row(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(Radii.md))
                            .background(PantopusColors.primary50)
                            .clickable(enabled = !saving, onClick = actions.onEdit)
                            .padding(Spacing.s3)
                            .testTag("billDetail_edit"),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.Pencil,
                        contentDescription = null,
                        size = Radii.xl,
                        tint = PantopusColors.primary600,
                    )
                    Text(
                        text = "Edit bill",
                        style = PantopusTextStyle.small,
                        fontWeight = FontWeight.SemiBold,
                        color = PantopusColors.primary600,
                    )
                }
                Row(
                    modifier =
                        Modifier
                            .clickable(enabled = !saving, onClick = actions.onRemove)
                            .testTag("billDetail_remove"),
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
                        text = "Remove bill",
                        style = PantopusTextStyle.small,
                        fontWeight = FontWeight.SemiBold,
                        color = PantopusColors.error,
                    )
                }
            }
        },
        cta = {
            PrimaryButton(
                title = if (isPaid) "Already paid" else "Mark paid",
                isLoading = saving,
                isEnabled = !isPaid && !saving,
                onClick = actions.onMarkPaid,
                modifier = Modifier.testTag("billDetail_markPaid"),
            )
        },
    )
}

private data class BillDetailActions(
    val onBack: () -> Unit,
    val onEdit: () -> Unit,
    val onMarkPaid: () -> Unit,
    val onRemove: () -> Unit,
)

private data class BillHeaderModel(
    val payee: String,
    val amount: String,
    val chipText: String,
    val chipVariant: StatusChipVariant,
    val chipIcon: PantopusIcon?,
    val category: UtilityCategory,
    val autoPay: Boolean,
)

@Composable
private fun BillHeader(
    model: BillHeaderModel,
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
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s3)) {
            Box(
                modifier =
                    Modifier
                        .size(48.dp)
                        .clip(RoundedCornerShape(Radii.sm))
                        .background(model.category.background),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = model.category.icon,
                    contentDescription = null,
                    size = Radii.xl3,
                    tint = model.category.foreground,
                )
            }
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                ) {
                    Text(model.payee, style = PantopusTextStyle.h3, color = PantopusColors.appText)
                    if (model.autoPay) {
                        AutoPayPill()
                    }
                }
                Text(
                    text = model.amount,
                    style = PantopusTextStyle.body,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appText,
                )
            }
        }
        StatusChip(text = model.chipText, variant = model.chipVariant, icon = model.chipIcon)
    }
}

@Composable
private fun AutoPayPill() {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.infoBg)
                .padding(horizontal = Spacing.s2, vertical = 3.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.ArrowsRepeat,
            contentDescription = null,
            size = 11.dp,
            tint = PantopusColors.info,
        )
        Text(
            text = "Auto-pay",
            style = PantopusTextStyle.caption,
            color = PantopusColors.info,
        )
    }
}

@Composable
private fun DetailGrid(bill: BillDto) {
    val category = UtilityCategory.from(bill.providerName)
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorderSubtle, RoundedCornerShape(Radii.lg)),
    ) {
        DetailRow("Category", category.label)
        HorizontalDivider(color = PantopusColors.appBorderSubtle, thickness = 1.dp)
        DetailRow("Status", bill.status.replaceFirstChar(Char::uppercase))
        if (bill.status == "scheduled") {
            HorizontalDivider(color = PantopusColors.appBorderSubtle, thickness = 1.dp)
            DetailRow("Auto-pay", "Scheduled")
        }
        BillsListViewModel.formatDateShort(bill.dueDate)?.let {
            HorizontalDivider(color = PantopusColors.appBorderSubtle, thickness = 1.dp)
            DetailRow("Due", it)
        }
        BillsListViewModel.formatDateShort(bill.paidAt)?.let {
            HorizontalDivider(color = PantopusColors.appBorderSubtle, thickness = 1.dp)
            DetailRow("Paid on", it)
        }
        bill.currency?.takeIf { it != "USD" }?.let {
            HorizontalDivider(color = PantopusColors.appBorderSubtle, thickness = 1.dp)
            DetailRow("Currency", it)
        }
    }
}

@Composable
private fun DetailRow(
    label: String,
    value: String,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4, vertical = Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label, style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
        androidx.compose.foundation.layout.Spacer(Modifier.weight(1f))
        Text(value, style = PantopusTextStyle.body, color = PantopusColors.appText)
    }
}

@Composable
private fun SplitsSection(splits: List<BillSplitDto>) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            PantopusIconImage(
                icon = PantopusIcon.Users,
                contentDescription = null,
                size = Radii.xl,
                tint = PantopusColors.primary600,
            )
            Text(
                text = "Split between",
                style = PantopusTextStyle.small,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
        }
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorderSubtle, RoundedCornerShape(Radii.lg)),
        ) {
            splits.forEachIndexed { index, split ->
                Row(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .padding(horizontal = Spacing.s4, vertical = Spacing.s3),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = split.user?.name ?: split.user?.username ?: "Member",
                        style = PantopusTextStyle.body,
                        color = PantopusColors.appText,
                    )
                    androidx.compose.foundation.layout.Spacer(Modifier.weight(1f))
                    Text(
                        text = BillsListViewModel.formatCurrency(split.amount),
                        style = PantopusTextStyle.body,
                        fontWeight = FontWeight.SemiBold,
                        color = PantopusColors.appText,
                    )
                }
                if (index < splits.size - 1) {
                    HorizontalDivider(color = PantopusColors.appBorderSubtle, thickness = 1.dp)
                }
            }
        }
    }
}
