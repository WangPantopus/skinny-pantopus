@file:Suppress(
    "PackageNaming",
    "MagicNumber",
    "LongMethod",
    "LongParameterList",
    "UNUSED_PARAMETER",
    "CyclomaticComplexMethod",
)

package app.pantopus.android.ui.screens.scheduling.packages

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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.BuildConfig
import app.pantopus.android.data.api.models.scheduling.PackageCreditDto
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.screens.settings.payments.StripePaymentSheets
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import com.stripe.android.paymentsheet.rememberPaymentSheet

@Composable
fun BuyPackageScreen(
    packageId: String,
    onBack: () -> Unit = {},
    onNavigate: (String) -> Unit = {},
    viewModel: BuyPackageViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val presentSecret by viewModel.presentSecret.collectAsStateWithLifecycle()
    val context = LocalContext.current

    LaunchedEffect(Unit) { viewModel.start() }

    val paymentSheet =
        rememberPaymentSheet { result ->
            viewModel.onPaymentResult(StripePaymentSheets.checkoutOutcome(result))
        }

    LaunchedEffect(presentSecret) {
        presentSecret?.let { secret ->
            paymentSheet.presentWithPaymentIntent(
                paymentIntentClientSecret = secret,
                configuration =
                    StripePaymentSheets.paymentConfiguration(
                        context = context,
                        customerId = null,
                        ephemeralKey = null,
                        publishableKey = BuildConfig.STRIPE_PUBLISHABLE_KEY,
                    ),
            )
            viewModel.secretConsumed()
        }
    }

    Column(
        modifier =
            Modifier.fillMaxSize().background(
                PantopusColors.appBg,
            ).testTag("scheduling.buyPackage"),
    ) {
        PkgTopBar(title = "Buy package", onBack = onBack)
        BuyPackageContent(
            state = state,
            onPay = viewModel::pay,
            onUseCredit = { onNavigate(viewModel.myPackagesRoute()) },
            onDone = onBack,
            onRetry = viewModel::load,
        )
    }
}

@Composable
internal fun BuyPackageContent(
    state: BuyPackageUiState,
    onPay: () -> Unit,
    onUseCredit: () -> Unit,
    onDone: () -> Unit,
    onRetry: () -> Unit,
) {
    when (state) {
        is BuyPackageUiState.Loading -> BuyLoading()
        is BuyPackageUiState.ComingSoon -> PkgComingSoon(title = "Packages")
        is BuyPackageUiState.Error -> ErrorState(message = state.message, onRetry = onRetry)
        is BuyPackageUiState.Ready ->
            if (state.payState is PayState.Paid) {
                PaidBody(onUseCredit = onUseCredit, onDone = onDone)
            } else {
                Checkout(state = state, onPay = onPay, onUseCredit = onUseCredit)
            }
    }
}

@Composable
private fun Checkout(
    state: BuyPackageUiState.Ready,
    onPay: () -> Unit,
    onUseCredit: () -> Unit,
) {
    val declined = state.payState as? PayState.Declined
    val hasUpsell = state.existingCredit != null
    Column(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier =
                Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = Spacing.s4)
                    .padding(top = Spacing.s3),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            if (declined == null && !hasUpsell && !state.isGuest) {
                Text(
                    text = "Save by buying sessions up front.",
                    color = PantopusColors.appTextSecondary,
                    fontSize = 11.5.sp,
                )
            }
            declined?.let {
                PkgNote(tone = PkgNoteTone.Error, icon = PantopusIcon.CreditCard, text = it.message)
            }
            OwnerCard(name = state.pkg?.name ?: "Package", pillar = state.pillar)
            state.existingCredit?.let { UpsellBanner(credit = it, onUseCredit = onUseCredit) }
            SummaryCard(state)
            if (declined == null && !hasUpsell) EligibleRow(state)
            if (state.isGuest) GuestEmailCard()
            PayMethodRow()
            Footnote()
            Spacer(modifier = Modifier.height(Spacing.s4))
        }
        PkgDock {
            PkgPrimaryButton(
                label = state.payButtonLabel,
                icon = PantopusIcon.Lock,
                loading = state.payState is PayState.Paying,
                onClick = onPay,
            )
        }
    }
}

@Composable
private fun OwnerCard(
    name: String,
    pillar: SchedulingPillar,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .padding(horizontal = 13.dp, vertical = 11.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(11.dp),
    ) {
        Box(
            modifier =
                Modifier.size(
                    38.dp,
                ).clip(RoundedCornerShape(Radii.lg)).background(pillarGradient(pillar)),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = name.firstOrNull()?.uppercase() ?: "P",
                color = PantopusColors.appTextInverse,
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(5.dp),
            ) {
                Text(
                    text = name,
                    color = PantopusColors.appText,
                    fontSize = 13.5.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                )
                PantopusIconImage(
                    icon = PantopusIcon.BadgeCheck,
                    contentDescription = null,
                    size = 14.dp,
                    tint = pillar.accent,
                )
            }
            Text(
                text = "${pillar.providerLabel()} provider",
                color = PantopusColors.appTextSecondary,
                fontSize = 11.sp,
            )
        }
    }
}

@Composable
private fun SummaryCard(state: BuyPackageUiState.Ready) {
    val sessions = state.pkg?.sessionsCount ?: 0
    PkgCard {
        Text(
            text = state.pkg?.name ?: "Package",
            color = PantopusColors.appText,
            fontSize = 14.sp,
            fontWeight = FontWeight.Bold,
        )
        SummaryLine(
            label = "$sessions session${if (sessions == 1) "" else "s"} × ${state.perSessionLabel}",
            value = state.totalLabel,
        )
        SummaryLine(label = "Per session", value = state.perSessionLabel)
        HorizontalDivider(
            color = PantopusColors.appBorder,
            modifier = Modifier.padding(vertical = 3.dp),
        )
        SummaryLine(label = "Total", value = state.totalLabel, strong = true)
    }
}

@Composable
private fun SummaryLine(
    label: String,
    value: String,
    strong: Boolean = false,
) {
    Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(
            text = label,
            color = if (strong) PantopusColors.appText else PantopusColors.appTextStrong,
            fontSize = if (strong) 13.5.sp else 12.5.sp,
            fontWeight = if (strong) FontWeight.Bold else FontWeight.Medium,
            modifier = Modifier.weight(1f),
        )
        Text(
            text = value,
            color = PantopusColors.appText,
            fontSize = if (strong) 16.sp else 13.sp,
            fontWeight = FontWeight.Bold,
        )
    }
}

@Composable
private fun EligibleRow(state: BuyPackageUiState.Ready) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(state.pillar.accentBg)
                .padding(horizontal = 13.dp, vertical = 11.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.TicketCheck,
            contentDescription = null,
            size = 16.dp,
            tint = state.pillar.accent,
        )
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                text = "Use credits on",
                color = PantopusColors.appText,
                fontSize = 11.5.sp,
                fontWeight = FontWeight.Bold,
            )
            Text(
                text = if (state.pkg?.eventTypeId == null) "All of this provider's services" else "The selected service",
                color = PantopusColors.appTextStrong,
                fontSize = 11.sp,
            )
            Text(
                text = "Credits expire 1 year after purchase",
                color = PantopusColors.appTextSecondary,
                fontSize = 10.5.sp,
            )
        }
    }
}

@Composable
private fun PayMethodRow() {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .padding(horizontal = 13.dp, vertical = 11.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(11.dp),
    ) {
        Box(
            modifier =
                Modifier.size(
                    width = 34.dp,
                    height = 24.dp,
                ).clip(RoundedCornerShape(Radii.sm)).background(PantopusColors.appSurfaceSunken),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.CreditCard,
                contentDescription = null,
                size = 16.dp,
                tint = PantopusColors.info,
            )
        }
        Text(
            text = "Add a payment method",
            color = PantopusColors.appText,
            fontSize = 12.5.sp,
            fontWeight = FontWeight.SemiBold,
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
private fun GuestEmailCard() {
    PkgCard {
        Text(
            text = "Email",
            color = PantopusColors.appTextStrong,
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
        )
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.md))
                    .border(1.5.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                    .padding(horizontal = 11.dp, vertical = 10.dp),
        ) {
            Text(text = "you@email.com", color = PantopusColors.appTextMuted, fontSize = 12.5.sp)
        }
        Text(
            text =
                buildAnnotatedString {
                    append("We'll send your receipt and credits here. ")
                    withStyle(
                        SpanStyle(
                            color = PantopusColors.primary600,
                            fontWeight = FontWeight.Bold,
                        ),
                    ) {
                        append("Sign in")
                    }
                },
            color = PantopusColors.appTextSecondary,
            fontSize = 10.5.sp,
        )
    }
}

@Composable
private fun Footnote() {
    Text(
        text = "Free cancellation up to 24 hours before. After that, no refund. Use your credits any time before they expire.",
        color = PantopusColors.appTextSecondary,
        fontSize = 10.5.sp,
        lineHeight = 15.sp,
    )
}

@Composable
private fun UpsellBanner(
    credit: PackageCreditDto,
    onUseCredit: () -> Unit,
) {
    val remaining = credit.remaining ?: 0
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.infoBg)
                .border(1.dp, PantopusColors.infoLight, RoundedCornerShape(Radii.xl))
                .padding(horizontal = 13.dp, vertical = Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(9.dp)) {
            PantopusIconImage(
                icon = PantopusIcon.Ticket,
                contentDescription = null,
                size = 16.dp,
                tint = PantopusColors.info,
            )
            Text(
                text = "You already have $remaining credit${if (remaining == 1) "" else "s"} left on this package.",
                color = PantopusColors.appTextStrong,
                fontSize = 11.5.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.weight(1f),
            )
        }
        PkgGhostButton(label = "Use a credit instead", onClick = onUseCredit)
    }
}

@Composable
private fun PaidBody(
    onUseCredit: () -> Unit,
    onDone: () -> Unit,
) {
    Column(
        modifier =
            Modifier.fillMaxSize().background(
                PantopusColors.appBg,
            ).padding(horizontal = Spacing.s4),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Box(
            modifier =
                Modifier.size(
                    72.dp,
                ).clip(RoundedCornerShape(Radii.pill)).background(PantopusColors.successBg),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.CheckCircle,
                contentDescription = null,
                size = 34.dp,
                tint = PantopusColors.success,
            )
        }
        Spacer(modifier = Modifier.height(Spacing.s4))
        Text(
            text = "Credits added",
            color = PantopusColors.appText,
            fontSize = 20.sp,
            fontWeight = FontWeight.SemiBold,
        )
        Spacer(modifier = Modifier.height(Spacing.s2))
        Text(
            text = "Your package credits are ready. Book a session any time before they expire.",
            color = PantopusColors.appTextSecondary,
            fontSize = 13.5.sp,
            lineHeight = 19.sp,
            modifier = Modifier.padding(horizontal = Spacing.s4),
        )
        Spacer(modifier = Modifier.height(Spacing.s6))
        PkgPrimaryButton(label = "View my packages", icon = PantopusIcon.Tag, onClick = onUseCredit)
        Spacer(modifier = Modifier.height(Spacing.s2))
        PkgGhostButton(label = "Done", onClick = onDone)
    }
}

@Composable
private fun BuyLoading() {
    Column(
        modifier =
            Modifier.fillMaxSize().padding(
                horizontal = Spacing.s4,
            ).padding(top = Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        repeat(
            3,
        ) { Shimmer(modifier = Modifier.fillMaxWidth(), height = 72.dp, cornerRadius = Radii.xl) }
    }
}

private fun SchedulingPillar.providerLabel(): String =
    when (this) {
        SchedulingPillar.Business -> "Business"
        SchedulingPillar.Home -> "Home"
        SchedulingPillar.Personal -> "Personal"
    }
