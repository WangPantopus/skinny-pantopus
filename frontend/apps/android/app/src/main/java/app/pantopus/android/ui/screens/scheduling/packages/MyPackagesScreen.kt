@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "LongParameterList")

package app.pantopus.android.ui.screens.scheduling.packages

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.api.models.scheduling.PackageCreditDto
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MyPackagesScreen(
    onBack: () -> Unit = {},
    onNavigate: (String) -> Unit = {},
    viewModel: MyPackagesViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val creditForUse by viewModel.creditForUse.collectAsStateWithLifecycle()
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
            ).testTag("scheduling.myPackages"),
    ) {
        PkgTopBar(title = "My packages", onBack = onBack)
        MyPackagesContent(
            state = state,
            onUseCredit = viewModel::useCredit,
            onBuyAgain = { credit -> viewModel.buyAgainRoute(credit)?.let(onNavigate) },
            onBrowse = { onNavigate(viewModel.browseRoute()) },
            onRetry = viewModel::load,
        )
    }

    creditForUse?.let { credit ->
        ModalBottomSheet(
            onDismissRequest = viewModel::dismissUseCredit,
            sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
            containerColor = PantopusColors.appBg,
        ) {
            UseCreditSheet(
                credit = credit,
                onApplied = viewModel::creditApplied,
                onDismiss = viewModel::dismissUseCredit,
            )
        }
    }
}

@Composable
internal fun MyPackagesContent(
    state: MyPackagesUiState,
    onUseCredit: (PackageCreditDto) -> Unit,
    onBuyAgain: (PackageCreditDto) -> Unit,
    onBrowse: () -> Unit,
    onRetry: () -> Unit,
) {
    when (state) {
        is MyPackagesUiState.Loading -> MyPackagesLoading()
        is MyPackagesUiState.ComingSoon -> PkgComingSoon(title = "My packages")
        is MyPackagesUiState.Error -> ErrorState(message = state.message, onRetry = onRetry)
        is MyPackagesUiState.Empty ->
            EmptyState(
                icon = PantopusIcon.Ticket,
                headline = "No packages yet",
                subcopy = "When you buy a package, your credits show up here.",
                ctaTitle = "Browse services",
                onCta = onBrowse,
                tint = PantopusColors.personalBg,
                accent = PantopusColors.personal,
                modifier = Modifier.fillMaxSize().padding(top = Spacing.s10),
            )
        is MyPackagesUiState.Loaded ->
            Column(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(horizontal = Spacing.s4)
                        .padding(top = Spacing.s3),
                verticalArrangement = Arrangement.spacedBy(Spacing.s3),
            ) {
                Text(
                    text = "Tap a credit to book your next session.",
                    color = PantopusColors.appTextSecondary,
                    fontSize = 11.5.sp,
                    modifier = Modifier.padding(horizontal = Spacing.s1),
                )
                state.credits.forEach { credit ->
                    CreditCard(
                        credit = credit,
                        onUse = { onUseCredit(credit) },
                        onBuyAgain = { onBuyAgain(credit) },
                    )
                }
                Box(modifier = Modifier.height(Spacing.s8))
            }
    }
}

@Composable
private fun CreditCard(
    credit: PackageCreditDto,
    onUse: () -> Unit,
    onBuyAgain: () -> Unit,
) {
    val pillar = creditPillar(credit.bookingPackage?.ownerType)
    val remaining = credit.remaining ?: 0
    val total = maxOf(credit.bookingPackage?.sessionsCount ?: remaining, remaining)
    val spent = remaining == 0
    val progress = if (total > 0) remaining.toFloat() / total else 0f
    val ownerName = "${pillar.providerLabel()} provider"
    val purchased = PackagesFormat.dayString(credit.purchasedAt)

    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .alpha(if (spent) 0.7f else 1f)
                .padding(horizontal = 14.dp, vertical = 13.dp),
    ) {
        // Owner row
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(9.dp),
        ) {
            Box(
                modifier =
                    Modifier.size(
                        28.dp,
                    ).clip(RoundedCornerShape(Radii.md)).background(pillarGradient(pillar)),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = ownerName.firstOrNull()?.uppercase() ?: "P",
                    color = PantopusColors.appTextInverse,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                )
            }
            Text(
                text = ownerName,
                color = PantopusColors.appText,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
            )
            PantopusIconImage(
                icon = PantopusIcon.BadgeCheck,
                contentDescription = null,
                size = 13.dp,
                tint = pillar.accent,
            )
        }
        Text(
            text = credit.bookingPackage?.name ?: "Package",
            color = PantopusColors.appText,
            fontSize = 14.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(top = 10.dp),
        )
        Row(
            modifier = Modifier.fillMaxWidth().padding(top = Spacing.s2, bottom = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = "$remaining of $total left",
                color = if (spent) PantopusColors.appTextSecondary else PantopusColors.appText,
                fontSize = 18.sp,
                fontWeight = FontWeight.ExtraBold,
                modifier = Modifier.weight(1f),
            )
            if (spent) {
                PkgChip(text = "All used", tone = PkgChipTone.Neutral, uppercased = true)
            }
        }
        // Meter
        Box(
            modifier =
                Modifier.fillMaxWidth().height(
                    6.dp,
                ).clip(RoundedCornerShape(Radii.pill)).background(PantopusColors.appSurfaceSunken),
        ) {
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth(if (spent) 1f else progress.coerceIn(0f, 1f))
                        .height(6.dp)
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(
                            if (spent) PantopusColors.appBorderStrong else PantopusColors.personal,
                        ),
            )
        }
        if (purchased != null) {
            Text(
                text = "Purchased $purchased",
                color = PantopusColors.appTextSecondary,
                fontSize = 10.5.sp,
                modifier = Modifier.padding(top = 7.dp),
            )
        }
        if (spent) {
            Box(
                modifier =
                    Modifier
                        .padding(top = 11.dp)
                        .fillMaxWidth()
                        .height(40.dp)
                        .clip(RoundedCornerShape(Radii.lg))
                        .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                        .clickable(onClick = onBuyAgain),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = "Buy again",
                    color = PantopusColors.primary600,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                )
            }
        } else {
            Row(
                modifier =
                    Modifier
                        .padding(top = 11.dp)
                        .fillMaxWidth()
                        .height(42.dp)
                        .clip(RoundedCornerShape(Radii.lg))
                        .background(PantopusColors.personal)
                        .clickable(onClick = onUse),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.CalendarPlus,
                    contentDescription = null,
                    size = 15.dp,
                    tint = PantopusColors.appTextInverse,
                )
                Box(modifier = Modifier.size(7.dp))
                Text(
                    text = "Book with a credit",
                    color = PantopusColors.appTextInverse,
                    fontSize = 13.5.sp,
                    fontWeight = FontWeight.Bold,
                )
            }
        }
    }
}

@Composable
private fun MyPackagesLoading() {
    Column(
        modifier =
            Modifier.fillMaxSize().padding(
                horizontal = Spacing.s4,
            ).padding(top = Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        repeat(
            2,
        ) { Shimmer(modifier = Modifier.fillMaxWidth(), height = 180.dp, cornerRadius = Radii.xl) }
    }
}

private fun creditPillar(ownerType: String?): SchedulingPillar =
    when (ownerType?.lowercase()) {
        "business" -> SchedulingPillar.Business
        "home" -> SchedulingPillar.Home
        else -> SchedulingPillar.Personal
    }

private fun SchedulingPillar.providerLabel(): String =
    when (this) {
        SchedulingPillar.Business -> "Business"
        SchedulingPillar.Home -> "Home"
        SchedulingPillar.Personal -> "Personal"
    }
