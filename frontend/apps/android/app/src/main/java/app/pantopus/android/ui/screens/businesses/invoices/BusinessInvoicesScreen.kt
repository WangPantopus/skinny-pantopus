@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "TooManyFunctions", "LongParameterList")

package app.pantopus.android.ui.screens.businesses.invoices

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.OfflineBannerHost
import app.pantopus.android.ui.components.PantopusTextField
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.businesses.payments.ActionToast
import app.pantopus.android.ui.screens.shared.content_detail.ContentDetailTopBar
import app.pantopus.android.ui.screens.shared.content_detail.ContentDetailTopBarAction
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/** Test tag on the Business Invoices root container. */
const val BUSINESS_INVOICES_TAG = "businessInvoices.screen"

/**
 * A10.7 owner surface — "Invoices". Status-filter chips over a paged list
 * of invoice cards (recipient · dates · total · status pill · line items ·
 * platform fee), a "New invoice" sheet, and a destructive Void behind a
 * confirm. Mirrors RN `InvoicesTab.tsx` and iOS `BusinessInvoicesView`.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BusinessInvoicesScreen(
    onBack: () -> Unit,
    viewModel: BusinessInvoicesViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val action by viewModel.action.collectAsStateWithLifecycle()
    val filter by viewModel.filter.collectAsStateWithLifecycle()
    val online by viewModel.isOnline.collectAsStateWithLifecycle()

    var showCreateSheet by remember { mutableStateOf(false) }
    var voidTarget by remember { mutableStateOf<BusinessInvoiceRow?>(null) }
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    LaunchedEffect(Unit) { viewModel.load() }

    Box(modifier = Modifier.fillMaxSize().background(PantopusColors.appBg).testTag(BUSINESS_INVOICES_TAG)) {
        Column(Modifier.fillMaxSize()) {
            ContentDetailTopBar(
                title = "Invoices",
                onBack = onBack,
                action =
                    ContentDetailTopBarAction(
                        icon = PantopusIcon.Plus,
                        contentDescription = "New invoice",
                        onClick = { showCreateSheet = true },
                    ),
            )
            OfflineBannerHost(isOffline = !online) {
                Column(Modifier.fillMaxSize()) {
                    FilterRail(selected = filter, onSelect = viewModel::setFilter)
                    when (val current = state) {
                        BusinessInvoicesUiState.Loading -> InvoicesLoading()
                        is BusinessInvoicesUiState.Loaded ->
                            InvoicesList(
                                rows = current.rows,
                                onEndReached = viewModel::loadMoreIfNeeded,
                                onVoid = { voidTarget = it },
                            )
                        BusinessInvoicesUiState.Empty ->
                            EmptyState(
                                icon = PantopusIcon.ReceiptText,
                                headline =
                                    if (filter == BusinessInvoiceFilter.All) {
                                        "No invoices yet"
                                    } else {
                                        "No ${filter.label.lowercase()} invoices"
                                    },
                                subcopy = "Create an invoice to bill a customer after service delivery.",
                                ctaTitle = "New invoice",
                                onCta = { showCreateSheet = true },
                                tint = PantopusColors.businessBg,
                                accent = PantopusColors.business,
                                modifier = Modifier.testTag("businessInvoices.empty"),
                            )
                        is BusinessInvoicesUiState.Error ->
                            EmptyState(
                                icon = PantopusIcon.AlertCircle,
                                headline = "Couldn't load invoices",
                                subcopy = current.message,
                                ctaTitle = "Try again",
                                onCta = viewModel::refresh,
                                tint = PantopusColors.businessBg,
                                accent = PantopusColors.business,
                                modifier = Modifier.testTag("businessInvoices.error"),
                            )
                    }
                }
            }
        }

        when (val current = action) {
            is BusinessInvoicesAction.Succeeded ->
                ActionToast(
                    message = current.message,
                    background = PantopusColors.success,
                    onDismiss = viewModel::clearAction,
                    modifier = Modifier.align(Alignment.BottomCenter),
                )
            is BusinessInvoicesAction.Failed ->
                ActionToast(
                    message = current.message,
                    background = PantopusColors.error,
                    onDismiss = viewModel::clearAction,
                    modifier = Modifier.align(Alignment.BottomCenter),
                )
            else -> Unit
        }
    }

    voidTarget?.let { target ->
        AlertDialog(
            onDismissRequest = { voidTarget = null },
            title = { Text("Void invoice?") },
            text = {
                Text(
                    "The ${target.totalLabel} invoice to ${target.recipientName} can't be collected " +
                        "once voided. This cannot be undone.",
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        viewModel.voidInvoice(target.id)
                        voidTarget = null
                    },
                    modifier = Modifier.testTag("businessInvoices_voidConfirm"),
                ) {
                    Text("Void ${target.totalLabel} invoice", color = PantopusColors.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { voidTarget = null }) { Text("Keep invoice") }
            },
        )
    }

    if (showCreateSheet) {
        ModalBottomSheet(
            onDismissRequest = { showCreateSheet = false },
            sheetState = sheetState,
            containerColor = PantopusColors.appBg,
        ) {
            CreateInvoiceSheet(viewModel = viewModel, onDismiss = { showCreateSheet = false })
        }
    }
}

// ─── Filter chips ─────────────────────────────────────────────────────

@Composable
private fun FilterRail(
    selected: BusinessInvoiceFilter,
    onSelect: (BusinessInvoiceFilter) -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState())
                .padding(horizontal = Spacing.s4, vertical = Spacing.s3),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        BusinessInvoiceFilter.entries.forEach { option ->
            val active = option == selected
            Text(
                text = option.label,
                color = if (active) PantopusColors.appTextInverse else PantopusColors.appTextSecondary,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(if (active) PantopusColors.business else PantopusColors.appSurface)
                        .border(
                            1.dp,
                            if (active) Color.Transparent else PantopusColors.appBorder,
                            RoundedCornerShape(Radii.pill),
                        ).clickable { onSelect(option) }
                        .padding(horizontal = Spacing.s3, vertical = 6.dp)
                        .testTag("businessInvoices.filter.${option.name.lowercase()}"),
            )
        }
    }
}

// ─── Loading ──────────────────────────────────────────────────────────

@Composable
private fun InvoicesLoading() {
    Column(
        modifier = Modifier.fillMaxSize().padding(horizontal = Spacing.s4).testTag("businessInvoices.loading"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        repeat(4) {
            Shimmer(width = 320.dp, height = 132.dp, cornerRadius = Radii.lg, modifier = Modifier.fillMaxWidth())
        }
    }
}

// ─── List ─────────────────────────────────────────────────────────────

@Composable
private fun InvoicesList(
    rows: List<BusinessInvoiceRow>,
    onEndReached: () -> Unit,
    onVoid: (BusinessInvoiceRow) -> Unit,
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize().testTag("businessInvoices.list"),
        contentPadding = PaddingValues(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        items(rows, key = { it.id }) { row ->
            InvoiceCard(row = row, onVoid = { onVoid(row) })
            if (row.id == rows.lastOrNull()?.id) {
                LaunchedEffect(row.id) { onEndReached() }
            }
        }
    }
}

@Composable
private fun InvoiceCard(
    row: BusinessInvoiceRow,
    onVoid: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .padding(14.dp)
                .testTag("businessInvoices.row.${row.id}"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(Spacing.s3)) {
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(
                    text = row.recipientName,
                    color = PantopusColors.appText,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(
                    text = listOfNotNull(row.createdLabel, row.dueLabel).joinToString(" · "),
                    color = PantopusColors.appTextSecondary,
                    fontSize = 13.sp,
                )
            }
            Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                Text(
                    text = row.totalLabel,
                    color = PantopusColors.appText,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                )
                StatusPill(status = row.status, label = row.statusLabel)
            }
        }

        row.memo?.let { memo ->
            Text(
                text = memo,
                color = PantopusColors.appTextSecondary,
                fontSize = 13.sp,
                fontStyle = FontStyle.Italic,
            )
        }

        HorizontalDivider(thickness = 1.dp, color = PantopusColors.appBorderSubtle)

        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            row.lineItems.forEach { item ->
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(text = item.title, color = PantopusColors.appTextSecondary, fontSize = 13.sp)
                    Text(text = item.amountLabel, color = PantopusColors.appTextSecondary, fontSize = 13.sp)
                }
            }
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(text = "Platform fee", color = PantopusColors.appTextMuted, fontSize = 12.sp)
                Text(text = row.feeLabel, color = PantopusColors.appTextMuted, fontSize = 12.sp)
            }
        }

        if (row.canVoid) {
            Text(
                text = "Void invoice",
                color = PantopusColors.error,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                modifier =
                    Modifier
                        .clickable(onClick = onVoid)
                        .testTag("businessInvoices.void.${row.id}"),
            )
        }
    }
}

@Composable
private fun StatusPill(
    status: String,
    label: String,
) {
    Text(
        text = label,
        color = statusForeground(status),
        fontSize = 11.sp,
        fontWeight = FontWeight.SemiBold,
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(statusBackground(status))
                .padding(horizontal = Spacing.s2, vertical = 2.dp),
    )
}

private fun statusForeground(status: String): Color =
    when (status) {
        "paid" -> PantopusColors.success
        "void" -> PantopusColors.error
        "overdue" -> PantopusColors.warning
        "sent", "viewed" -> PantopusColors.info
        else -> PantopusColors.appTextSecondary
    }

private fun statusBackground(status: String): Color =
    when (status) {
        "paid" -> PantopusColors.successBg
        "void" -> PantopusColors.errorBg
        "overdue" -> PantopusColors.warningBg
        "sent", "viewed" -> PantopusColors.infoBg
        else -> PantopusColors.appBorderSubtle
    }

// ─── Create sheet ─────────────────────────────────────────────────────

/**
 * "New invoice" — recipient + 1..50 line items (description / unit amount /
 * quantity) + optional due date and memo. The client never computes a
 * total; the server derives subtotal / fee / total from the line items
 * (`backend/routes/businesses.js:4789`).
 */
@Composable
private fun CreateInvoiceSheet(
    viewModel: BusinessInvoicesViewModel,
    onDismiss: () -> Unit,
) {
    val recipient by viewModel.recipientUserId.collectAsStateWithLifecycle()
    val dueDate by viewModel.dueDate.collectAsStateWithLifecycle()
    val memo by viewModel.memo.collectAsStateWithLifecycle()
    val lineItems by viewModel.lineItems.collectAsStateWithLifecycle()
    val isCreating by viewModel.isCreating.collectAsStateWithLifecycle()
    val createError by viewModel.createError.collectAsStateWithLifecycle()

    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .imePadding()
                .navigationBarsPadding()
                .padding(Spacing.s4)
                .testTag("createInvoice.sheet"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        Text(
            text = "New invoice",
            color = PantopusColors.appText,
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
        )

        PantopusTextField(
            label = "Recipient user ID",
            value = recipient,
            onValueChange = viewModel::setRecipientUserId,
            placeholder = "Paste user ID",
            isRequired = true,
            fieldTestTag = "createInvoice.recipient",
        )

        Text(
            text = "LINE ITEMS",
            color = PantopusColors.appTextSecondary,
            fontSize = 10.5.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.8.sp,
        )

        lineItems.forEach { item ->
            Column(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(Radii.md))
                        .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                        .background(PantopusColors.appSurface)
                        .padding(Spacing.s3),
                verticalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    PantopusTextField(
                        label = "Description",
                        value = item.description,
                        onValueChange = { viewModel.updateLineItem(item.key, description = it) },
                        placeholder = "What are you billing for?",
                        modifier = Modifier.weight(1f),
                    )
                    if (lineItems.size > 1) {
                        Box(
                            modifier =
                                Modifier
                                    .padding(top = 18.dp)
                                    .clickable { viewModel.removeLineItem(item.key) }
                                    .testTag("createInvoice.removeLineItem"),
                        ) {
                            PantopusIconImage(
                                icon = PantopusIcon.Trash2,
                                contentDescription = "Remove line item",
                                size = 18.dp,
                                tint = PantopusColors.error,
                            )
                        }
                    }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    PantopusTextField(
                        label = "Amount",
                        value = item.amount,
                        onValueChange = { viewModel.updateLineItem(item.key, amount = it) },
                        placeholder = "0.00",
                        keyboardType = KeyboardType.Decimal,
                        modifier = Modifier.weight(1f),
                    )
                    PantopusTextField(
                        label = "Qty",
                        value = item.quantity,
                        onValueChange = { viewModel.updateLineItem(item.key, quantity = it) },
                        placeholder = "1",
                        keyboardType = KeyboardType.Number,
                        modifier = Modifier.width(84.dp),
                    )
                }
            }
        }

        Row(
            modifier =
                Modifier
                    .clickable { viewModel.addLineItem() }
                    .testTag("createInvoice.addLineItem"),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.PlusCircle,
                contentDescription = null,
                size = 18.dp,
                tint = PantopusColors.business,
            )
            Text(
                text = "Add line item",
                color = PantopusColors.business,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
            )
        }

        PantopusTextField(
            label = "Due date (optional)",
            value = dueDate,
            onValueChange = viewModel::setDueDate,
            placeholder = "YYYY-MM-DD",
            fieldTestTag = "createInvoice.dueDate",
        )

        PantopusTextField(
            label = "Memo (optional)",
            value = memo,
            onValueChange = viewModel::setMemo,
            placeholder = "Note to recipient…",
            fieldTestTag = "createInvoice.memo",
        )

        createError?.let { error ->
            Text(
                text = error,
                color = PantopusColors.error,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.testTag("createInvoice.error"),
            )
        }

        PrimaryButton(
            title = "Send invoice",
            onClick = { viewModel.createInvoice(onSent = onDismiss) },
            isLoading = isCreating,
            modifier = Modifier.fillMaxWidth().testTag("createInvoice.submit"),
        )

        Spacer(Modifier.height(Spacing.s10))
    }
}
