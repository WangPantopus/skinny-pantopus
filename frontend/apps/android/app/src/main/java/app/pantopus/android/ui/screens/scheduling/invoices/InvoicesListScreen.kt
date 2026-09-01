@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "LongParameterList")

package app.pantopus.android.ui.screens.scheduling.invoices

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.api.models.scheduling.InvoiceDto
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingStatusPill
import app.pantopus.android.ui.screens.scheduling.packages.PkgCard
import app.pantopus.android.ui.screens.scheduling.packages.PkgComingSoon
import app.pantopus.android.ui.screens.scheduling.packages.PkgRowCard
import app.pantopus.android.ui.screens.scheduling.packages.PkgStripeGate
import app.pantopus.android.ui.screens.scheduling.packages.PkgTopBar
import app.pantopus.android.ui.screens.scheduling.packages.PkgTopBarIconButton
import app.pantopus.android.ui.screens.scheduling.packages.pillarGradient
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

@Composable
fun InvoicesListScreen(
    onBack: () -> Unit = {},
    onNavigate: (String) -> Unit = {},
    viewModel: InvoicesListViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val filter by viewModel.filter.collectAsStateWithLifecycle()
    val lifecycleOwner = LocalLifecycleOwner.current

    DisposableEffect(lifecycleOwner) {
        val observer =
            LifecycleEventObserver { _, event -> if (event == Lifecycle.Event.ON_RESUME) viewModel.start() }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    Column(
        modifier =
            Modifier.fillMaxSize().background(
                PantopusColors.appBg,
            ).testTag("scheduling.invoices.list"),
    ) {
        PkgTopBar(title = "Invoices", onBack = onBack) {
            if (state !is InvoicesListUiState.ComingSoon) {
                PkgTopBarIconButton(
                    icon = PantopusIcon.Search,
                    contentDescription = "Search",
                    onClick = {},
                    tint = PantopusColors.appText,
                )
            }
        }
        InvoicesListContent(
            state = state,
            filter = filter,
            onSelectFilter = viewModel::selectFilter,
            onOpen = { onNavigate(viewModel.invoiceRoute(it)) },
            onConnect = { onNavigate(viewModel.connectRoute()) },
            onRetry = viewModel::load,
            reference = viewModel::reference,
            service = viewModel::service,
            amount = viewModel::amount,
            initials = viewModel::payerInitials,
        )
    }
}

@Composable
internal fun InvoicesListContent(
    state: InvoicesListUiState,
    filter: InvoiceFilter,
    onSelectFilter: (InvoiceFilter) -> Unit,
    onOpen: (String) -> Unit,
    onConnect: () -> Unit,
    onRetry: () -> Unit,
    reference: (InvoiceDto) -> String,
    service: (InvoiceDto) -> String,
    amount: (InvoiceDto) -> String,
    initials: (InvoiceDto) -> String,
) {
    when (state) {
        is InvoicesListUiState.Loading -> InvoicesLoading()
        is InvoicesListUiState.ComingSoon -> PkgComingSoon(title = "Invoices")
        is InvoicesListUiState.Gate ->
            PkgStripeGate(
                icon = PantopusIcon.Receipt,
                title = "Connect payments to invoice for services",
                message = "Pantopus uses Stripe to send and collect invoices.",
                onConnect = onConnect,
            )
        is InvoicesListUiState.Empty ->
            EmptyState(
                icon = PantopusIcon.Receipt,
                headline = "No invoices yet",
                subcopy = "Invoices appear here once you take a booking or sell a package.",
                tint = PantopusColors.businessBg,
                accent = PantopusColors.business,
                modifier = Modifier.fillMaxSize().padding(top = Spacing.s10),
            )
        is InvoicesListUiState.Error -> ErrorState(message = state.message, onRetry = onRetry)
        is InvoicesListUiState.Loaded ->
            InvoicesLoadedBody(
                state = state,
                filter = filter,
                onSelectFilter = onSelectFilter,
                onOpen = onOpen,
                reference = reference,
                service = service,
                amount = amount,
                initials = initials,
            )
    }
}

@Composable
private fun InvoicesLoadedBody(
    state: InvoicesListUiState.Loaded,
    filter: InvoiceFilter,
    onSelectFilter: (InvoiceFilter) -> Unit,
    onOpen: (String) -> Unit,
    reference: (InvoiceDto) -> String,
    service: (InvoiceDto) -> String,
    amount: (InvoiceDto) -> String,
    initials: (InvoiceDto) -> String,
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = Spacing.s4)
                .padding(top = Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        SummaryCard(
            outstanding = state.outstandingLabel,
            collectedMonth = state.collectedMonthLabel,
            hasOverdue = state.hasOverdue,
        )
        FilterChips(selected = filter, accent = state.pillar.accent, onSelect = onSelectFilter)
        if (state.sections.isEmpty()) {
            // The active status chip matched nothing — keep the summary + chips
            // and show a quiet inline notice instead of an empty row card.
            Text(
                text = "No ${filter.label.lowercase()} invoices.",
                color = PantopusColors.appTextSecondary,
                fontSize = 12.sp,
                modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.s4),
            )
        } else {
            PkgRowCard {
                val lastSection = state.sections.lastIndex
                state.sections.forEachIndexed { sectionIndex, section ->
                    if (sectionIndex > 0) {
                        HorizontalDivider(color = PantopusColors.appBorder)
                    }
                    Text(
                        text = section.day.uppercase(),
                        color = PantopusColors.appTextMuted,
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 0.8.sp,
                        modifier = Modifier.padding(top = Spacing.s2, bottom = Spacing.s1),
                    )
                    section.invoices.forEachIndexed { index, invoice ->
                        InvoiceRow(
                            initials = initials(invoice),
                            reference = reference(invoice),
                            service = service(invoice),
                            amount = amount(invoice),
                            pillar = state.pillar,
                            onClick = { onOpen(invoice.id) },
                            invoiceStatus = invoice.status,
                        )
                        val lastRowOverall =
                            sectionIndex == lastSection && index == section.invoices.lastIndex
                        if (!lastRowOverall && index < section.invoices.lastIndex) {
                            HorizontalDivider(color = PantopusColors.appBorder)
                        }
                    }
                }
            }
        }
        Box(modifier = Modifier.height(Spacing.s8))
    }
}

@Composable
private fun SummaryCard(
    outstanding: String,
    collectedMonth: String,
    hasOverdue: Boolean,
) {
    PkgCard {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Stat(
                label = "Outstanding",
                value = outstanding,
                overdue = hasOverdue,
                modifier = Modifier.weight(1f),
            )
            Box(modifier = Modifier.width(1.dp).height(40.dp).background(PantopusColors.appBorder))
            Stat(
                label = "Collected · month",
                value = collectedMonth,
                modifier = Modifier.weight(1f),
            )
        }
    }
}

@Composable
private fun Stat(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
    /** When true, paints both label and value in warning-amber (overdue treatment). */
    overdue: Boolean = false,
) {
    val labelColor = if (overdue) PantopusColors.warning else PantopusColors.appTextSecondary
    val valueColor = if (overdue) PantopusColors.warning else PantopusColors.appText
    Column(
        modifier = modifier.padding(horizontal = Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        Text(
            text = label.uppercase(),
            color = labelColor,
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.6.sp,
        )
        Text(
            text = value,
            color = valueColor,
            fontSize = 21.sp,
            fontWeight = FontWeight.Black,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

@Composable
private fun FilterChips(
    selected: InvoiceFilter,
    accent: Color,
    onSelect: (InvoiceFilter) -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(7.dp),
    ) {
        InvoiceFilter.entries.forEach { f ->
            val on = f == selected
            Box(
                modifier =
                    Modifier
                        .height(30.dp)
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(if (on) accent else PantopusColors.appSurface)
                        .then(
                            if (on) {
                                Modifier
                            } else {
                                Modifier.border(
                                    1.dp,
                                    PantopusColors.appBorder,
                                    RoundedCornerShape(Radii.pill),
                                )
                            },
                        )
                        .clickable { onSelect(f) }
                        .padding(horizontal = Spacing.s3),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = f.label,
                    color = if (on) PantopusColors.appTextInverse else PantopusColors.appTextStrong,
                    fontSize = 11.5.sp,
                    fontWeight = FontWeight.Bold,
                )
            }
        }
    }
}

@Composable
private fun InvoiceRow(
    initials: String,
    reference: String,
    service: String,
    amount: String,
    pillar: SchedulingPillar,
    onClick: () -> Unit,
    /**
     * Invoice lifecycle status for the trailing pill (draft/sent/viewed/paid/
     * void/overdue). Renders nothing when null (legacy rows without a status).
     */
    invoiceStatus: String? = null,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable(onClick = onClick)
                .padding(horizontal = 2.dp, vertical = 11.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(11.dp),
    ) {
        Box(
            modifier =
                Modifier.size(
                    34.dp,
                ).clip(RoundedCornerShape(Radii.pill)).background(pillarGradient(pillar)),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = initials,
                color = PantopusColors.appTextInverse,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
            )
        }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
            Text(
                text = reference,
                color = PantopusColors.appText,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                fontFamily = FontFamily.Monospace,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = service,
                color = PantopusColors.appTextSecondary,
                fontSize = 10.5.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        // Trailing: amount + optional status pill (design: amount above, pill below).
        Column(
            horizontalAlignment = Alignment.End,
            verticalArrangement = Arrangement.spacedBy(3.dp),
        ) {
            Text(
                text = amount,
                color = PantopusColors.appText,
                fontSize = 13.5.sp,
                fontWeight = FontWeight.Bold,
            )
            if (invoiceStatus != null) {
                SchedulingStatusPill(
                    status = invoiceStatus,
                    showIcon = false,
                )
            }
        }
    }
}

@Composable
private fun InvoicesLoading() {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = Spacing.s4)
                .padding(top = Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        PkgCard {
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s3)) {
                Column(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    Shimmer(width = 60.dp, height = 9.dp)
                    Shimmer(width = 50.dp, height = 18.dp)
                }
                Column(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    Shimmer(width = 60.dp, height = 9.dp)
                    Shimmer(width = 50.dp, height = 18.dp)
                }
            }
        }
        PkgRowCard {
            repeat(4) { i ->
                Row(
                    modifier = Modifier.fillMaxWidth().padding(vertical = 13.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(11.dp),
                ) {
                    Shimmer(width = 34.dp, height = 34.dp, cornerRadius = Radii.pill)
                    Column(
                        modifier = Modifier.weight(1f),
                        verticalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        Shimmer(width = 120.dp, height = 11.dp)
                        Shimmer(width = 80.dp, height = 8.dp)
                    }
                    Shimmer(width = 50.dp, height = 24.dp, cornerRadius = Radii.pill)
                }
                if (i < 3) HorizontalDivider(color = PantopusColors.appBorder)
            }
        }
    }
}
