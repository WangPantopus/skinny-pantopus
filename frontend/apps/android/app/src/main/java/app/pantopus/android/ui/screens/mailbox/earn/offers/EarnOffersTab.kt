@file:Suppress("PackageNaming", "MagicNumber", "FunctionNaming", "LongMethod", "LongParameterList")

package app.pantopus.android.ui.screens.mailbox.earn.offers

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.BalanceHero
import app.pantopus.android.ui.components.BalanceHeroSplitCell
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.components.Toast
import app.pantopus.android.ui.screens.mailbox.earn.offers.components.EarnOfferCard
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.delay

/**
 * The `Offers` tab of A10.11 Earn — the paid-offer wall RN ships at
 * `src/app/mailbox/earn.tsx`. Balance hero (server numbers only), the
 * daily-cap banner, then the envelope list. The sibling `Earnings` tab
 * keeps the existing earnings summary + history dashboard.
 *
 * Mirrors iOS `EarnOffersTab`.
 */
@Composable
fun EarnOffersTab(
    modifier: Modifier = Modifier,
    viewModel: EarnOffersViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val capNotice by viewModel.capNotice.collectAsStateWithLifecycle()
    val revealedCode by viewModel.revealedCode.collectAsStateWithLifecycle()
    val toast by viewModel.toast.collectAsStateWithLifecycle()
    val busyOfferIds by viewModel.busyOfferIds.collectAsStateWithLifecycle()
    val context = LocalContext.current

    LaunchedEffect(Unit) { viewModel.loadIfNeeded() }
    LaunchedEffect(toast?.id) {
        if (toast != null) {
            delay(TOAST_MILLIS)
            viewModel.dismissToast()
        }
    }

    Box(modifier = modifier.fillMaxSize().background(PantopusColors.appBg)) {
        when (val current = state) {
            is EarnOffersUiState.Loading -> LoadingBody()
            is EarnOffersUiState.Loaded ->
                Wall(
                    balance = current.balance,
                    offers = current.offers,
                    capNotice = capNotice,
                    busyOfferIds = busyOfferIds,
                    onDismissCap = viewModel::dismissCapNotice,
                    onOpen = viewModel::open,
                    onSave = viewModel::save,
                    onReveal = viewModel::reveal,
                )

            is EarnOffersUiState.Empty ->
                EmptyWall(
                    balance = current.balance,
                    capNotice = capNotice,
                    onDismissCap = viewModel::dismissCapNotice,
                )

            is EarnOffersUiState.Error ->
                ErrorState(
                    headline = "Couldn't load offers",
                    message = current.message,
                    modifier = Modifier.testTag("earnOffersError"),
                    onRetry = viewModel::refresh,
                )
        }

        toast?.let { message ->
            Toast(
                message = message,
                modifier =
                    Modifier
                        .align(Alignment.BottomCenter)
                        .padding(bottom = Spacing.s10)
                        .testTag("earnOffersToast"),
            )
        }
    }

    revealedCode?.let { revealed ->
        AlertDialog(
            onDismissRequest = viewModel::dismissRevealedCode,
            title = { Text("Offer code") },
            text = {
                Text(
                    text =
                        revealed.code?.let { "${revealed.businessName}: $it" }
                            ?: "${revealed.businessName} hasn't attached a code to this offer.",
                    color = PantopusColors.appText,
                )
            },
            confirmButton = {
                revealed.code?.let { code ->
                    TextButton(
                        onClick = {
                            copyToClipboard(context, code)
                            viewModel.dismissRevealedCode()
                        },
                        modifier = Modifier.testTag("earnOfferCodeCopy"),
                    ) {
                        Text("Copy code")
                    }
                }
            },
            dismissButton = {
                TextButton(onClick = viewModel::dismissRevealedCode) { Text("Done") }
            },
            modifier = Modifier.testTag("earnOfferCodeDialog"),
        )
    }
}

// MARK: - Loaded

@Composable
private fun Wall(
    balance: EarnOffersBalance,
    offers: List<EarnOfferItem>,
    capNotice: EarnCapNotice?,
    busyOfferIds: Set<String>,
    onDismissCap: () -> Unit,
    onOpen: (String) -> Unit,
    onSave: (String) -> Unit,
    onReveal: (String) -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = Spacing.s4)
                .padding(top = Spacing.s3, bottom = Spacing.s10)
                .testTag("earnOffersWall"),
    ) {
        Hero(balance)
        CapBanner(notice = capNotice, onDismiss = onDismissCap)
        SectionOverline("Offers for you")
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
            offers.forEach { offer ->
                EarnOfferCard(
                    offer = offer,
                    isBusy = offer.id in busyOfferIds,
                    onOpen = { onOpen(offer.id) },
                    onSave = { onSave(offer.id) },
                    onReveal = { onReveal(offer.id) },
                )
            }
        }
        Disclaimer()
    }
}

// MARK: - Empty

@Composable
private fun EmptyWall(
    balance: EarnOffersBalance,
    capNotice: EarnCapNotice?,
    onDismissCap: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = Spacing.s4)
                .padding(top = Spacing.s3, bottom = Spacing.s10),
    ) {
        Hero(balance)
        CapBanner(notice = capNotice, onDismiss = onDismissCap)
        Spacer(Modifier.height(Spacing.s8))
        EmptyState(
            icon = PantopusIcon.MailOpen,
            headline = "No offers yet",
            subcopy = "When businesses have offers for your area, they'll appear here.",
            modifier = Modifier.testTag("earnOffersEmpty"),
            tint = PantopusColors.warmAmberBg,
            accent = PantopusColors.warmAmber,
        )
        Disclaimer()
    }
}

// MARK: - Pieces

@Composable
private fun Hero(balance: EarnOffersBalance) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        BalanceHero(
            overline = "Your earnings",
            amount = balance.total,
            currencyCode = "USD",
            modifier = Modifier.testTag("earnOffersBalanceHero"),
            split =
                listOf(
                    BalanceHeroSplitCell(
                        overline = "Available",
                        value = "$" + balance.available,
                        icon = PantopusIcon.HandCoins,
                    ),
                    BalanceHeroSplitCell(
                        overline = "Pending",
                        value = "$" + balance.pending,
                        icon = PantopusIcon.Clock,
                        note = if (balance.hasPending) "verifying" else null,
                    ),
                ),
        )
        Text(
            text = "Tap offer envelopes to earn · up to 10 a day",
            color = PantopusColors.appTextSecondary,
            fontSize = 11.sp,
        )
    }
}

@Composable
private fun CapBanner(
    notice: EarnCapNotice?,
    onDismiss: () -> Unit,
) {
    if (notice == null) return
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(top = Spacing.s3)
                .clip(RoundedCornerShape(14.dp))
                .background(PantopusColors.warmAmberBg)
                .padding(14.dp)
                .testTag("earnDailyCapBanner"),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Hourglass,
            contentDescription = null,
            size = 18.dp,
            strokeWidth = 2.2f,
            tint = PantopusColors.warmAmber,
        )
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            Text(
                text = notice.headline,
                color = PantopusColors.appText,
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
            )
            Text(
                text = notice.body,
                color = PantopusColors.appTextSecondary,
                fontSize = 12.sp,
            )
        }
        Spacer(Modifier.width(Spacing.s2))
        Box(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.md))
                    .clickable(onClick = onDismiss)
                    .testTag("earnDailyCapDismiss"),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.X,
                contentDescription = "Dismiss daily cap notice",
                size = 17.dp,
                tint = PantopusColors.appTextMuted,
            )
        }
    }
}

@Composable
private fun SectionOverline(title: String) {
    Text(
        text = title.uppercase(),
        color = PantopusColors.appTextSecondary,
        fontSize = 10.5.sp,
        fontWeight = FontWeight.Bold,
        letterSpacing = 0.8.sp,
        modifier = Modifier.padding(top = Spacing.s4, bottom = Spacing.s2),
    )
}

@Composable
private fun Disclaimer() {
    Text(
        text =
            "Businesses pay to reach you. You get paid to engage.\n" +
                "Earnings reflect after a short verification window.",
        color = PantopusColors.appTextMuted,
        fontSize = 10.5.sp,
        textAlign = TextAlign.Center,
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(top = Spacing.s5)
                .testTag("earnOffersDisclaimer"),
    )
}

// MARK: - Loading

@Composable
private fun LoadingBody() {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = Spacing.s4)
                .padding(top = Spacing.s3, bottom = Spacing.s8)
                .testTag("earnOffersLoading"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        SkeletonBlock(height = 168.dp)
        repeat(3) { SkeletonBlock(height = 132.dp) }
    }
}

/** Mirrors the sibling `EarnScreen` skeleton geometry. */
@Composable
private fun SkeletonBlock(height: Dp) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(height)
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurfaceSunken),
    )
}

private fun copyToClipboard(
    context: Context,
    code: String,
) {
    val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
    clipboard?.setPrimaryClip(ClipData.newPlainText("Offer code", code))
}

private const val TOAST_MILLIS = 2_500L
