@file:Suppress(
    "PackageNaming",
    "MagicNumber",
    "LongMethod",
    "LongParameterList",
    "UNUSED_PARAMETER",
    "CyclomaticComplexMethod",
)

package app.pantopus.android.ui.screens.scheduling.invoices

import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingStatusPill
import app.pantopus.android.ui.screens.scheduling.packages.PkgComingSoon
import app.pantopus.android.ui.screens.scheduling.packages.PkgDock
import app.pantopus.android.ui.screens.scheduling.packages.PkgGhostButton
import app.pantopus.android.ui.screens.scheduling.packages.PkgPrimaryButton
import app.pantopus.android.ui.screens.scheduling.packages.PkgToastCapsule
import app.pantopus.android.ui.screens.scheduling.packages.PkgTopBar
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

@Composable
fun InvoiceDetailScreen(
    invoiceId: String,
    onBack: () -> Unit = {},
    onNavigate: (String) -> Unit = {},
    viewModel: InvoiceDetailViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val sending by viewModel.sending.collectAsStateWithLifecycle()
    val sentToast by viewModel.sentToast.collectAsStateWithLifecycle()
    val context = LocalContext.current

    LaunchedEffect(Unit) { viewModel.start() }

    Box(
        modifier =
            Modifier.fillMaxSize().background(
                PantopusColors.appBg,
            ).testTag("scheduling.invoiceDetail"),
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            // Trailing pill: the invoice lifecycle status (draft/sent/viewed/paid/
            // void/overdue) once loaded; hidden for legacy rows without one.
            val loadedStatus = (state as? InvoiceDetailUiState.Loaded)?.invoiceStatus
            PkgTopBar(
                title = "Invoice",
                onBack = onBack,
                trailing = {
                    if (loadedStatus != null) {
                        SchedulingStatusPill(status = loadedStatus)
                    }
                },
            )
            InvoiceDetailContent(
                state = state,
                sending = sending,
                onSend = viewModel::send,
                onShare = {
                    val send =
                        Intent(Intent.ACTION_SEND).apply {
                            type = "text/plain"
                            putExtra(Intent.EXTRA_TEXT, viewModel.shareText())
                        }
                    runCatching { context.startActivity(Intent.createChooser(send, null)) }
                },
                onRetry = viewModel::load,
            )
        }
        if (sentToast) {
            PkgToastCapsule(
                text = "Invoice sent",
                modifier = Modifier.align(Alignment.TopCenter).padding(top = Spacing.s3),
            )
        }
    }
}

@Composable
internal fun InvoiceDetailContent(
    state: InvoiceDetailUiState,
    sending: Boolean,
    onSend: () -> Unit,
    onShare: () -> Unit,
    onRetry: () -> Unit,
) {
    when (state) {
        is InvoiceDetailUiState.Loading -> InvoiceDetailLoading()
        is InvoiceDetailUiState.ComingSoon -> PkgComingSoon(title = "Invoice")
        is InvoiceDetailUiState.Error -> ErrorState(message = state.message, onRetry = onRetry)
        is InvoiceDetailUiState.Loaded -> LoadedBody(state, sending, onSend, onShare)
    }
}

@Composable
private fun LoadedBody(
    state: InvoiceDetailUiState.Loaded,
    sending: Boolean,
    onSend: () -> Unit,
    onShare: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier =
                Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = Spacing.s4)
                    .padding(top = Spacing.s2),
        ) {
            Text(
                text = "${state.reference} · issued ${state.issuedLabel}",
                color = PantopusColors.appTextSecondary,
                fontSize = 10.5.sp,
                fontFamily = FontFamily.Monospace,
                letterSpacing = 0.04.sp,
            )
            // Hero — design `HeroNum` default variant: alignItems:center, gap 8,
            // total fontSize 30 weight 800 letterSpacing -1.1, label 11.5 fg3 medium.
            Row(
                modifier = Modifier.padding(top = Spacing.s4),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = state.totalLabel,
                    color = PantopusColors.appText,
                    fontSize = 30.sp,
                    fontWeight = FontWeight.Black,
                    letterSpacing = (-1.1).sp,
                )
                Box(modifier = Modifier.size(Spacing.s2))
                Text(
                    text = "total · ${state.currencyCode}",
                    color = PantopusColors.appTextSecondary,
                    fontSize = 11.5.sp,
                    fontWeight = FontWeight.Medium,
                )
            }
            // Payer → payee
            Row(
                modifier = Modifier.padding(top = 14.dp),
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                IdentityCard(
                    label = "From",
                    name = "${state.pillar.providerLabel()} provider",
                    sub = state.pillar.providerLabel(),
                    dot = state.pillar.accent,
                    modifier = Modifier.weight(1f),
                )
                IdentityCard(
                    label = "To",
                    name = "Customer",
                    sub = state.recipientLabel,
                    dot = PantopusColors.personal,
                    modifier = Modifier.weight(1f),
                )
            }
            // Line items
            SectionHeader(
                title = "Line items",
                icon = PantopusIcon.List,
                modifier = Modifier.padding(top = Spacing.s4),
            )
            if (state.lineItems.isEmpty()) {
                Text(
                    text = "Itemized details aren't available for this invoice.",
                    color = PantopusColors.appTextSecondary,
                    fontSize = 11.5.sp,
                    modifier =
                        Modifier
                            .padding(top = Spacing.s2)
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(Radii.lg))
                            .background(PantopusColors.appSurface)
                            .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                            .padding(horizontal = Spacing.s3, vertical = 14.dp),
                )
            } else {
                ItemsTable(state, modifier = Modifier.padding(top = Spacing.s2))
            }
            // Timeline section — design invoicedetail-frames.jsx:166
            // Events derive from created_at / status / paid_at / due_date.
            SectionHeader(
                title = "Timeline",
                icon = PantopusIcon.Activity,
                modifier = Modifier.padding(top = Spacing.s4),
            )
            InvoiceTimeline(
                events = state.timelineEvents,
                modifier = Modifier.padding(top = Spacing.s2),
            )
            // Payment terms
            SectionHeader(
                title = "Payment terms",
                icon = PantopusIcon.FileText,
                modifier = Modifier.padding(top = Spacing.s4),
            )
            Text(
                text =
                    state.dueLabel?.let { "Due $it. Pantopus Pay, card, or ACH." }
                        ?: "Net 14 from issue. Pantopus Pay, card, or ACH.",
                color = PantopusColors.appTextStrong,
                fontSize = 11.5.sp,
                lineHeight = 16.sp,
                modifier = Modifier.padding(top = Spacing.s2),
            )
            Box(modifier = Modifier.height(Spacing.s2))
        }
        PkgDock {
            PkgGhostButton(
                label = "Share",
                icon = PantopusIcon.Share,
                onClick = onShare,
                modifier = Modifier.weight(1f),
            )
            PkgPrimaryButton(
                label = "Send",
                icon = PantopusIcon.Send,
                loading = sending,
                onClick = onSend,
                modifier = Modifier.weight(1f),
            )
        }
    }
}

@Composable
private fun IdentityCard(
    label: String,
    name: String,
    sub: String,
    dot: Color,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .padding(horizontal = 11.dp, vertical = 10.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Text(
            text = label.uppercase(),
            color = PantopusColors.appTextMuted,
            fontSize = 8.5.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.4.sp,
        )
        Text(
            text = name,
            color = PantopusColors.appText,
            fontSize = 12.5.sp,
            fontWeight = FontWeight.Bold,
            maxLines = 1,
        )
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Box(modifier = Modifier.size(6.dp).clip(RoundedCornerShape(Radii.pill)).background(dot))
            Text(
                text = sub,
                color = dot,
                fontSize = 9.5.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
            )
        }
    }
}

/**
 * Invoice lifecycle timeline (invoicedetail-frames.jsx lines 109–126). Each event has
 * a dot + connecting rail + label/time row. Shows at minimum the "Created" event,
 * plus Sent / Paid / Voided / Due events derived from `status`, `paid_at`, `due_date`.
 */
@Composable
private fun InvoiceTimeline(
    events: List<InvoiceTimelineEvent>,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .padding(horizontal = 13.dp, vertical = 12.dp),
    ) {
        events.forEachIndexed { index, event ->
            val isLast = index == events.lastIndex
            Row(
                modifier = Modifier.padding(bottom = if (isLast) 0.dp else 12.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                // Dot column — dot + connecting rail below (except for last event)
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Box(
                        modifier =
                            Modifier
                                .size(13.dp)
                                .clip(RoundedCornerShape(Radii.pill))
                                .background(
                                    if (event.isDone) PantopusColors.success else PantopusColors.appBorder,
                                ),
                        contentAlignment = Alignment.Center,
                    ) {
                        if (event.isDone) {
                            PantopusIconImage(
                                icon = PantopusIcon.Check,
                                contentDescription = null,
                                size = 8.dp,
                                tint = PantopusColors.appTextInverse,
                            )
                        }
                    }
                    if (!isLast) {
                        Spacer(
                            modifier =
                                Modifier
                                    .width(1.5.dp)
                                    .height(12.dp)
                                    .background(PantopusColors.appBorder),
                        )
                    }
                }
                // Label + time row
                Row(
                    modifier = Modifier.weight(1f).padding(top = 0.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text(
                        text = event.label,
                        color = PantopusColors.appText,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Text(
                        text = event.timeLabel,
                        color = PantopusColors.appTextMuted,
                        fontSize = 10.sp,
                        fontFamily = FontFamily.Monospace,
                    )
                }
            }
        }
    }
}

@Composable
private fun SectionHeader(
    title: String,
    icon: PantopusIcon,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier,
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        PantopusIconImage(
            icon = icon,
            contentDescription = null,
            size = 13.dp,
            tint = PantopusColors.appTextSecondary,
        )
        Text(
            text = title.uppercase(),
            color = PantopusColors.appTextSecondary,
            fontSize = 9.5.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.8.sp,
        )
    }
}

@Composable
private fun ItemsTable(
    state: InvoiceDetailUiState.Loaded,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg)),
    ) {
        // Header
        Row(
            modifier =
                Modifier.fillMaxWidth().background(
                    PantopusColors.appSurfaceRaised,
                ).padding(horizontal = 11.dp, vertical = 7.dp),
        ) {
            HeaderCell("ITEM", Modifier.weight(1f), TextAlign.Start)
            HeaderCell("QTY", Modifier.width(24.dp), TextAlign.Center)
            HeaderCell("UNIT", Modifier.width(52.dp), TextAlign.End)
            HeaderCell("TOTAL", Modifier.width(56.dp), TextAlign.End)
        }
        state.lineItems.forEachIndexed { index, item ->
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 11.dp, vertical = 9.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = item.label,
                    color = PantopusColors.appText,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Medium,
                    maxLines = 2,
                    modifier = Modifier.weight(1f),
                )
                BodyCell(
                    item.quantity?.toString() ?: "—",
                    Modifier.width(24.dp),
                    TextAlign.Center,
                    PantopusColors.appTextSecondary,
                )
                BodyCell(
                    state.unitLabels[index] ?: "—",
                    Modifier.width(52.dp),
                    TextAlign.End,
                    PantopusColors.appTextSecondary,
                )
                BodyCell(
                    state.lineTotalLabels[index] ?: "—",
                    Modifier.width(56.dp),
                    TextAlign.End,
                    PantopusColors.appText,
                    FontWeight.SemiBold,
                )
            }
            HorizontalDivider(color = PantopusColors.appBorderSubtle)
        }
        // Subtotal / fee breakdown + total (rows render only when the DTO
        // carries the corresponding cents fields).
        Column(
            modifier =
                Modifier.fillMaxWidth().background(
                    PantopusColors.appSurfaceRaised,
                ).padding(horizontal = 11.dp, vertical = 9.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            state.subtotalLabel?.let { BreakdownRow(label = "Subtotal", value = it) }
            state.feeLabel?.let { BreakdownRow(label = "Platform fee", value = it) }
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = "Total",
                    color = PantopusColors.appText,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    text = state.totalLabel,
                    color = PantopusColors.appText,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Black,
                )
            }
        }
    }
}

@Composable
private fun BreakdownRow(
    label: String,
    value: String,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = label,
            color = PantopusColors.appTextSecondary,
            fontSize = 11.sp,
            fontWeight = FontWeight.Medium,
            modifier = Modifier.weight(1f),
        )
        Text(
            text = value,
            color = PantopusColors.appTextSecondary,
            fontSize = 11.5.sp,
            fontWeight = FontWeight.SemiBold,
        )
    }
}

@Composable
private fun HeaderCell(
    text: String,
    modifier: Modifier,
    align: TextAlign,
) {
    Text(
        text = text,
        color = PantopusColors.appTextMuted,
        fontSize = 8.5.sp,
        fontWeight = FontWeight.Bold,
        letterSpacing = 0.6.sp,
        textAlign = align,
        modifier = modifier,
    )
}

@Composable
private fun BodyCell(
    text: String,
    modifier: Modifier,
    align: TextAlign,
    color: Color,
    weight: FontWeight = FontWeight.Normal,
) {
    Text(
        text = text,
        color = color,
        fontSize = 11.sp,
        fontWeight = weight,
        textAlign = align,
        modifier = modifier,
    )
}

@Composable
private fun InvoiceDetailLoading() {
    Column(
        modifier =
            Modifier.fillMaxSize().padding(
                horizontal = Spacing.s4,
            ).padding(top = Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Shimmer(width = 200.dp, height = 10.dp)
        Shimmer(width = 160.dp, height = 30.dp)
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            Shimmer(modifier = Modifier.weight(1f), height = 64.dp, cornerRadius = Radii.lg)
            Shimmer(modifier = Modifier.weight(1f), height = 64.dp, cornerRadius = Radii.lg)
        }
        Shimmer(modifier = Modifier.fillMaxWidth(), height = 160.dp, cornerRadius = Radii.lg)
    }
}

private fun SchedulingPillar.providerLabel(): String =
    when (this) {
        SchedulingPillar.Business -> "Business"
        SchedulingPillar.Home -> "Home"
        SchedulingPillar.Personal -> "Personal"
    }
