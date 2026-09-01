@file:Suppress("PackageNaming", "LongMethod", "MagicNumber", "TooManyFunctions", "FunctionNaming", "LongParameterList")

package app.pantopus.android.ui.screens.mailbox.earn

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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.BalanceHero
import app.pantopus.android.ui.components.BalanceHeroSplitCell
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.screens.mailbox.earn.components.EarnEarningsList
import app.pantopus.android.ui.screens.mailbox.earn.components.EarnLockedRow
import app.pantopus.android.ui.screens.mailbox.earn.components.EarnPayoutNudge
import app.pantopus.android.ui.screens.mailbox.earn.components.EarnPayoutSettingsCard
import app.pantopus.android.ui.screens.mailbox.earn.components.EarnTaxDocsRow
import app.pantopus.android.ui.screens.mailbox.earn.components.EarnWaysToEarnCard
import app.pantopus.android.ui.screens.mailbox.earn.components.WeeklyGoalCard
import app.pantopus.android.ui.screens.mailbox.earn.offers.EarnOffersTab
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusElevations
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import app.pantopus.android.ui.theme.pantopusShadow

/**
 * A10.11 — Earn dashboard. The earnings-IN sibling of the A10.10 Wallet:
 * it reframes the same dark [BalanceHero] vocabulary around MAKING money
 * — "Available to cash out" + this-week / pending split, a weekly-goal
 * momentum ring, a `Ways to earn` launcher, the recent-earnings list,
 * payout settings, and the tax-docs row, with a sticky Cash out CTA.
 *
 * Reached from the Mailbox Earn-drawer entry and the
 * `pantopus://mailbox/earn` deep link. Two designed frames: populated
 * (active earner) and empty (new earner — no hero, gated rows, add-payout
 * nudge). Real payout wiring is out of scope; Cash out / Manage / Add bank
 * deep-link to the existing Payments surface.
 */
@Composable
fun EarnScreen(
    onBack: () -> Unit,
    onHelp: () -> Unit = {},
    onCashOut: () -> Unit = {},
    onBrowseTasks: () -> Unit = {},
    onReferNeighbor: () -> Unit = {},
    onOfferService: () -> Unit = {},
    onManagePayout: () -> Unit = {},
    onAddBank: () -> Unit = {},
    onSeeAllEarnings: () -> Unit = {},
    onOpenTaxDocs: () -> Unit = {},
    viewModel: EarnViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    var selectedTab by rememberSaveable { mutableStateOf(EarnTab.Offers) }
    // The earnings dashboard only pays for its fetch once the user asks
    // for it — the Offers wall is what opens by default.
    LaunchedEffect(selectedTab) {
        if (selectedTab == EarnTab.Earnings && viewModel.state.value is EarnUiState.Loading) {
            viewModel.load()
        }
    }

    EarnScreenContent(
        state = state,
        selectedTab = selectedTab,
        onSelectTab = { selectedTab = it },
        offersContent = { EarnOffersTab() },
        onBack = onBack,
        onHelp = onHelp,
        onCashOut = onCashOut,
        onBrowseTasks = onBrowseTasks,
        onReferNeighbor = onReferNeighbor,
        onOfferService = onOfferService,
        onManagePayout = onManagePayout,
        onAddBank = onAddBank,
        onSeeAllEarnings = onSeeAllEarnings,
        onOpenTaxDocs = onOpenTaxDocs,
        onRetry = { viewModel.refresh() },
    )
}

@Composable
internal fun EarnScreenContent(
    state: EarnUiState,
    /**
     * Non-null renders the Offers / Earnings strip under the top bar and
     * routes the body. Left null by the Paparazzi baselines, which lock
     * the earnings dashboard frames on their own.
     */
    selectedTab: EarnTab? = null,
    onSelectTab: (EarnTab) -> Unit = {},
    offersContent: @Composable () -> Unit = {},
    onBack: () -> Unit = {},
    onHelp: () -> Unit = {},
    onCashOut: () -> Unit = {},
    onBrowseTasks: () -> Unit = {},
    onReferNeighbor: () -> Unit = {},
    onOfferService: () -> Unit = {},
    onManagePayout: () -> Unit = {},
    onAddBank: () -> Unit = {},
    onSeeAllEarnings: () -> Unit = {},
    onOpenTaxDocs: () -> Unit = {},
    onRetry: () -> Unit = {},
) {
    val onSelectWay: (EarnWayKind) -> Unit = { kind ->
        when (kind) {
            EarnWayKind.Browse -> onBrowseTasks()
            EarnWayKind.Refer -> onReferNeighbor()
            EarnWayKind.Offer -> onOfferService()
        }
    }

    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .testTag("earn"),
    ) {
        EarnTopBar(onBack = onBack, onHelp = onHelp)
        if (selectedTab != null) {
            EarnTabStrip(selected = selectedTab, onSelect = onSelectTab)
        }
        if (selectedTab == EarnTab.Offers) {
            offersContent()
        } else {
            when (val current = state) {
                EarnUiState.Loading -> LoadingBody()
                is EarnUiState.Populated ->
                    PopulatedBody(
                        content = current.content,
                        onSelectWay = onSelectWay,
                        onCashOut = onCashOut,
                        onBrowseTasks = onBrowseTasks,
                        onSeeAllEarnings = onSeeAllEarnings,
                        onManagePayout = onManagePayout,
                        onOpenTaxDocs = onOpenTaxDocs,
                    )
                is EarnUiState.Empty ->
                    EmptyBody(
                        waysToEarn = current.waysToEarn,
                        onSelectWay = onSelectWay,
                        onBrowseTasks = onBrowseTasks,
                        onAddBank = onAddBank,
                    )
                is EarnUiState.Error ->
                    ErrorState(
                        headline = "Couldn't load Earn",
                        message = current.message,
                        modifier = Modifier.testTag("earnError"),
                        onRetry = onRetry,
                    )
            }
        }
    }
}

// MARK: - Top bar

@Composable
private fun EarnTopBar(
    onBack: () -> Unit,
    onHelp: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth().background(PantopusColors.appSurface)) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(48.dp)
                    .padding(horizontal = Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(
                icon = PantopusIcon.ChevronLeft,
                contentDescription = "Back",
                tag = "earnBackButton",
                onClick = onBack,
            )
            Spacer(Modifier.weight(1f))
            Text(
                text = "Earn",
                color = PantopusColors.appText,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = (-0.15).sp,
                modifier = Modifier.semantics { heading() },
            )
            Spacer(Modifier.weight(1f))
            IconButton(
                icon = PantopusIcon.HelpCircle,
                contentDescription = "Earn help",
                tag = "earnHelpButton",
                onClick = onHelp,
            )
        }
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(1.dp)
                    .background(PantopusColors.appBorder),
        )
    }
}

@Composable
private fun IconButton(
    icon: PantopusIcon,
    contentDescription: String,
    tag: String,
    onClick: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .size(44.dp)
                .clip(RoundedCornerShape(Radii.md))
                .clickable(onClick = onClick)
                .testTag(tag),
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(
            icon = icon,
            contentDescription = contentDescription,
            size = 22.dp,
            tint = PantopusColors.appText,
        )
    }
}

// MARK: - Populated body

@Composable
private fun PopulatedBody(
    content: EarnContent,
    onSelectWay: (EarnWayKind) -> Unit,
    onCashOut: () -> Unit,
    onBrowseTasks: () -> Unit,
    onSeeAllEarnings: () -> Unit,
    onManagePayout: () -> Unit,
    onOpenTaxDocs: () -> Unit,
) {
    Box(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier =
                Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = Spacing.s4)
                    .padding(top = Spacing.s3, bottom = 116.dp),
        ) {
            Hero(content)
            // Weekly-goal target, payout method, auto-cash-out, and 1099 tax
            // docs have no `/earnings/*` source (the last three are Stripe
            // Connect — Phase 3), so they render only when the projection
            // carries them (sample/preview) — never faked.
            content.weeklyGoal?.let { goal ->
                Spacer(Modifier.height(Spacing.s3))
                WeeklyGoalCard(goal = goal)
            }
            SectionOverline(
                title = "Ways to earn",
                actionLabel = "Find work",
                onAction = onBrowseTasks,
            )
            EarnWaysToEarnCard(items = content.waysToEarn, onSelect = onSelectWay)
            SectionOverline(
                title = "Recent earnings",
                actionLabel = "See all",
                onAction = onSeeAllEarnings,
            )
            EarnEarningsList(items = content.earnings)
            val payoutMethod = content.payoutMethod
            val autoCashOut = content.autoCashOut
            if (payoutMethod != null && autoCashOut != null) {
                SectionOverline(title = "Payout settings")
                EarnPayoutSettingsCard(
                    method = payoutMethod,
                    autoCashOut = autoCashOut,
                    onManage = onManagePayout,
                )
            }
            content.taxDocs?.let { docs ->
                SectionOverline(title = "Taxes")
                EarnTaxDocsRow(docs = docs, onClick = onOpenTaxDocs)
            }
        }
        EarnBottomBar(modifier = Modifier.align(Alignment.BottomCenter)) {
            CashOutCta(amount = content.available, onClick = onCashOut)
        }
    }
}

@Composable
private fun Hero(content: EarnContent) {
    BalanceHero(
        overline = "Available to cash out",
        amount = content.available,
        currencyCode = "USD",
        split =
            listOf(
                BalanceHeroSplitCell(
                    icon = PantopusIcon.Calendar,
                    overline = "This week",
                    value = content.thisWeek,
                    note = content.thisWeekMeta,
                ),
                BalanceHeroSplitCell(
                    icon = PantopusIcon.Clock,
                    overline = "Pending",
                    value = content.pending,
                    note = content.pendingMeta,
                ),
            ),
    )
}

// MARK: - Empty body (new earner)

@Composable
private fun EmptyBody(
    waysToEarn: List<EarnWayToEarn>,
    onSelectWay: (EarnWayKind) -> Unit,
    onBrowseTasks: () -> Unit,
    onAddBank: () -> Unit,
) {
    Box(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier =
                Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = Spacing.s4)
                    .padding(top = Spacing.s3, bottom = 132.dp),
        ) {
            SectionOverline(
                title = "Ways to earn",
                actionLabel = "Find work",
                onAction = onBrowseTasks,
            )
            EarnWaysToEarnCard(items = waysToEarn, onSelect = onSelectWay)
            SectionOverline(title = "Recent earnings")
            EarnLockedRow(
                title = "No earnings yet",
                subcopy = "Your paid tasks land here — your first one unlocks cash out.",
                tag = "earnEarningsLockedRow",
            )
            SectionOverline(title = "Payout settings")
            EarnPayoutNudge(onAddBank = onAddBank)
            SectionOverline(title = "Taxes")
            EarnLockedRow(
                title = "Tax documents",
                subcopy = "Your 1099 and YTD totals appear after your first paid task.",
                tag = "earnTaxDocsLockedRow",
            )
        }
        EarnBottomBar(modifier = Modifier.align(Alignment.BottomCenter)) {
            BrowseCta(onClick = onBrowseTasks)
        }
    }
}

// MARK: - Section header

@Composable
private fun SectionOverline(
    title: String,
    actionLabel: String? = null,
    onAction: () -> Unit = {},
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(top = Spacing.s4, bottom = Spacing.s1),
        verticalAlignment = Alignment.Bottom,
    ) {
        Text(
            text = title.uppercase(),
            color = PantopusColors.appTextSecondary,
            fontSize = 10.5.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.8.sp,
        )
        Spacer(Modifier.weight(1f))
        if (actionLabel != null) {
            Text(
                text = actionLabel,
                color = PantopusColors.primary600,
                fontSize = 11.5.sp,
                fontWeight = FontWeight.SemiBold,
                modifier =
                    Modifier
                        .clickable(onClick = onAction)
                        .testTag("earnSectionAction-$title"),
            )
        }
    }
}

// MARK: - Sticky bottom bar

@Composable
private fun EarnBottomBar(
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .background(
                    Brush.verticalGradient(
                        colorStops =
                            arrayOf(
                                0f to PantopusColors.appBg.copy(alpha = 0f),
                                0.3f to PantopusColors.appBg.copy(alpha = 0.92f),
                                0.6f to PantopusColors.appBg,
                                1f to PantopusColors.appBg,
                            ),
                    ),
                )
                .padding(horizontal = Spacing.s4)
                .padding(top = 28.dp, bottom = Spacing.s5),
        verticalArrangement = Arrangement.spacedBy(7.dp),
    ) {
        content()
    }
}

@Composable
private fun CashOutCta(
    amount: String,
    onClick: () -> Unit,
) {
    val shape = RoundedCornerShape(14.dp)
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(52.dp)
                .pantopusShadow(PantopusElevations.primary, shape)
                .clip(shape)
                .background(PantopusColors.primary600)
                .clickable(onClick = onClick)
                .padding(horizontal = 18.dp)
                .semantics { contentDescription = "Cash out $$amount" }
                .testTag("earnCashOutButton"),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.ArrowDownToLine,
                contentDescription = null,
                size = 17.dp,
                strokeWidth = 2.2f,
                tint = Color.White,
            )
            Text(
                text = "Cash out",
                color = Color.White,
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = (-0.15).sp,
            )
        }
        Spacer(Modifier.weight(1f))
        Text(
            text = "\$$amount",
            color = Color.White,
            fontSize = 15.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = (-0.15).sp,
        )
    }
}

@Composable
private fun BrowseCta(onClick: () -> Unit) {
    val shape = RoundedCornerShape(14.dp)
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(52.dp)
                .pantopusShadow(PantopusElevations.primary, shape)
                .clip(shape)
                .background(PantopusColors.primary600)
                .clickable(onClick = onClick)
                .testTag("earnBrowseTasksButton"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2, Alignment.CenterHorizontally),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Search,
            contentDescription = null,
            size = 17.dp,
            strokeWidth = 2.2f,
            tint = Color.White,
        )
        Text(
            text = "Browse open tasks",
            color = Color.White,
            fontSize = 15.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = (-0.15).sp,
        )
    }
    Text(
        text = "Cash out unlocks after your first paid task.",
        color = PantopusColors.appTextSecondary,
        fontSize = 10.5.sp,
        textAlign = TextAlign.Center,
        modifier =
            Modifier
                .fillMaxWidth()
                .testTag("earnCashOutGateNote"),
    )
}

// MARK: - Loading

@Composable
private fun LoadingBody() {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .padding(horizontal = Spacing.s4, vertical = Spacing.s3)
                .testTag("earnLoading"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        SkeletonBlock(height = 188.dp)
        SkeletonBlock(height = 92.dp)
        SkeletonBlock(height = 150.dp)
        SkeletonBlock(height = 180.dp)
    }
}

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
