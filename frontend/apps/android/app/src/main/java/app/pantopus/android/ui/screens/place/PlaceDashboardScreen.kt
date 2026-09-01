package app.pantopus.android.ui.screens.place

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.api.models.place.PlaceGroupBlock
import app.pantopus.android.data.api.models.place.PlaceIntelligence
import app.pantopus.android.data.api.models.place.PlaceTier
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.place.components.PlaceGroupLabel
import app.pantopus.android.ui.screens.place.components.PlaceHeroCard
import app.pantopus.android.ui.screens.place.components.PlaceLockedCard
import app.pantopus.android.ui.screens.place.components.PlaceVerifiedAvatar
import app.pantopus.android.ui.screens.place.messaging.PlaceMessagesActionRow
import app.pantopus.android.ui.screens.place.verify.PlaceVerifyMethod
import app.pantopus.android.ui.screens.place.verify.PlaceVerifySheet
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage

const val PLACE_DASHBOARD_HOME_ID_KEY = "homeId"

/**
 * C1 / C1a — the assembled Place dashboard. Ported from the design kit
 * `place-dashboard.jsx` + `place-dashboard-claimed.jsx`. The app keeps
 * its existing 5-tab bar, so the designed in-screen PlaceTabBar is
 * intentionally omitted; this surface is the Home-tab landing. Verified
 * (T4) shows the green avatar; claimed (T3) shows the slate "Claimed"
 * avatar + a verify-nudge banner + a "Locked until you verify" group.
 * Parity twin of iOS `PlaceDashboardView`.
 */
@Composable
@Suppress("LongParameterList")
fun PlaceDashboardScreen(
    homeId: String,
    onOpenSection: (homeId: String, slug: String) -> Unit,
    onSwitchHome: (homeId: String) -> Unit,
    onAddPlace: () -> Unit,
    onStartVerify: (method: PlaceVerifyMethod, address: String) -> Unit,
    onOpenPulse: () -> Unit,
    onComposeMessage: (address: String) -> Unit,
    onOpenInbox: () -> Unit,
    modifier: Modifier = Modifier,
    viewModel: PlaceDashboardViewModel = hiltViewModel(key = "place-$homeId"),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(homeId) { viewModel.load(homeId) }

    var showSwitcher by remember { mutableStateOf(false) }
    var showVerify by remember { mutableStateOf(false) }
    val verifyAddress = (state as? PlaceDashboardUiState.Loaded)?.intelligence?.place?.label.orEmpty()

    Box(modifier = modifier.fillMaxSize().background(PantopusColors.appBg)) {
        when (val current = state) {
            PlaceDashboardUiState.Loading -> PlaceDashboardSkeleton()
            is PlaceDashboardUiState.Error -> ErrorState(message = current.message, onRetry = viewModel::refresh)
            is PlaceDashboardUiState.Loaded ->
                PlaceDashboardContent(
                    intel = current.intelligence,
                    onOpenAvatar = { showSwitcher = true },
                    onVerify = { showVerify = true },
                    onOpenDetail = { group -> onOpenSection(homeId, group.slug) },
                    onOpenPulse = onOpenPulse,
                    onComposeMessage = onComposeMessage,
                    onOpenInbox = onOpenInbox,
                )
        }
    }

    if (showVerify) {
        PlaceVerifySheet(
            address = verifyAddress,
            onStart = { method ->
                showVerify = false
                onStartVerify(method, verifyAddress)
            },
            onDismiss = { showVerify = false },
        )
    }

    if (showSwitcher) {
        PlaceSwitcherSheet(
            activeHomeId = homeId,
            onSelect = { id ->
                showSwitcher = false
                if (id != homeId) onSwitchHome(id)
            },
            onAddPlace = {
                showSwitcher = false
                onAddPlace()
            },
            onDismiss = { showSwitcher = false },
        )
    }
}

@Composable
@Suppress("LongParameterList")
internal fun PlaceDashboardContent(
    intel: PlaceIntelligence,
    onOpenAvatar: () -> Unit,
    onVerify: () -> Unit,
    onOpenDetail: (PlaceDetailGroup) -> Unit,
    modifier: Modifier = Modifier,
    onOpenPulse: () -> Unit = {},
    onComposeMessage: (address: String) -> Unit = {},
    onOpenInbox: () -> Unit = {},
) {
    val isVerified = intel.tier == PlaceTier.T4
    val isClaimed = intel.tier == PlaceTier.T3
    val pulse = PlacePresentation.derivePulse(intel)

    LazyColumn(modifier = modifier.fillMaxSize()) {
        item {
            PlaceDashboardHeader(
                label = intel.place.label,
                isVerified = isVerified,
                onOpenAvatar = onOpenAvatar,
                modifier = Modifier.padding(horizontal = 18.dp, vertical = 8.dp),
            )
        }
        if (isClaimed) {
            item {
                PlaceVerifyBanner(
                    onTap = onVerify,
                    modifier = Modifier.padding(horizontal = 16.dp).padding(top = 8.dp),
                )
            }
        }
        item {
            PlaceHeroCard(
                variant = pulse.variant,
                chip = pulse.chip,
                heroIcon = pulse.heroIcon,
                headline = pulse.title,
                nudgeIcon = pulse.nudgeIcon,
                nudgeText = pulse.nudgeText.orEmpty(),
                onTap = onOpenPulse,
                modifier =
                    Modifier
                        .padding(horizontal = 16.dp)
                        .padding(top = if (isClaimed) 12.dp else 14.dp),
            )
        }
        item { Spacer(modifier = Modifier.height(20.dp)) }
        if (isVerified) {
            item {
                PlaceMessagesEntry(
                    address = intel.place.label,
                    onComposeMessage = onComposeMessage,
                    onOpenInbox = onOpenInbox,
                    modifier = Modifier.padding(horizontal = 16.dp).padding(bottom = 24.dp),
                )
            }
        }
        items(items = intel.groups, key = { it.group }) { group ->
            PlaceGroupBlockView(
                group = group,
                onOpenDetail = onOpenDetail,
                onVerify = onVerify,
                modifier = Modifier.padding(horizontal = 16.dp).padding(bottom = 24.dp),
            )
        }
        if (isClaimed) {
            item {
                PlaceVerifyLockedGroup(
                    onVerify = onVerify,
                    modifier = Modifier.padding(horizontal = 16.dp).padding(bottom = 24.dp),
                )
            }
        }
        item { Spacer(modifier = Modifier.height(40.dp)) }
    }
}

@Composable
private fun PlaceGroupBlockView(
    group: PlaceGroupBlock,
    onOpenDetail: (PlaceDetailGroup) -> Unit,
    onVerify: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val detail = PlaceDetailGroup.forGroup(group.groupId)
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(9.dp)) {
        PlaceGroupLabel(text = group.label)
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            group.sections.forEach { section ->
                PlaceSectionView(
                    env = section,
                    onOpen = detail?.let { d -> { onOpenDetail(d) } },
                    onVerify = onVerify,
                    onClaim = onVerify,
                )
            }
        }
    }
}

// W7 — verified-neighbor messaging entry (verified residents only).
@Composable
private fun PlaceMessagesEntry(
    address: String,
    onComposeMessage: (address: String) -> Unit,
    onOpenInbox: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(9.dp)) {
        PlaceGroupLabel(text = "Verified neighbors")
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            PlaceMessagesActionRow(
                icon = PantopusIcon.MessageSquarePlus,
                title = "Message a neighbor",
                subtitle = "Send a verified heads-up to a home on your block.",
                onTap = { onComposeMessage(address) },
            )
            PlaceMessagesActionRow(
                icon = PantopusIcon.Inbox,
                title = "Your inbox",
                subtitle = "Heads-ups from verified neighbors nearby.",
                onTap = onOpenInbox,
            )
        }
    }
}

@Composable
private fun PlaceVerifyLockedGroup(
    onVerify: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(9.dp)) {
        PlaceGroupLabel(text = "Locked until you verify")
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            PlacePresentation.verifyLockedItems.forEach { item ->
                PlaceLockedCard(
                    title = item.title,
                    reason = item.reason,
                    cta = "Verify address",
                    icon = item.icon,
                    onTap = onVerify,
                )
            }
        }
    }
}

// MARK: - Header

@Composable
private fun PlaceDashboardHeader(
    label: String,
    isVerified: Boolean,
    onOpenAvatar: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(modifier = modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(5.dp)) {
            Text(
                text = "Your Place",
                fontSize = 28.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = (-0.56).sp,
                lineHeight = 32.sp,
                color = PantopusColors.appText,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(5.dp), verticalAlignment = Alignment.CenterVertically) {
                PantopusIconImage(
                    icon = PantopusIcon.MapPin,
                    contentDescription = null,
                    size = 14.dp,
                    strokeWidth = 2f,
                    tint = PantopusColors.appTextMuted,
                )
                Text(
                    text = label,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Medium,
                    color = PantopusColors.appTextSecondary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
        Box(
            modifier = Modifier.clip(CircleShape).clickable(onClick = onOpenAvatar),
        ) {
            if (isVerified) {
                PlaceVerifiedAvatar(size = 40.dp)
            } else {
                PlaceClaimedAvatar(size = 40.dp)
            }
        }
    }
}

// MARK: - Claimed avatar

@Composable
fun PlaceClaimedAvatar(
    initials: String = "RC",
    size: Dp = 40.dp,
) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Box(modifier = Modifier.size(size)) {
            Box(
                modifier =
                    Modifier
                        .size(size)
                        .clip(CircleShape)
                        .background(Brush.linearGradient(listOf(PantopusColors.slate, PantopusColors.appTextSecondary))),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = initials,
                    fontSize = (size.value * 0.34f).sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 0.2.sp,
                    color = PantopusColors.appSurface,
                )
            }
            Box(
                modifier =
                    Modifier
                        .size(size * 0.42f)
                        .align(Alignment.BottomEnd)
                        .clip(CircleShape)
                        .background(PantopusColors.warning)
                        .border(2.dp, PantopusColors.appSurface, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Home,
                    contentDescription = null,
                    size = size * 0.22f,
                    strokeWidth = 2.75f,
                    tint = PantopusColors.appSurface,
                )
            }
        }
        Text(
            text = "CLAIMED",
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.4.sp,
            color = PantopusColors.warning,
            modifier =
                Modifier
                    .clip(RoundedCornerShape(999.dp))
                    .background(PantopusColors.warningBg)
                    .border(1.dp, PantopusColors.warningLight, RoundedCornerShape(999.dp))
                    .padding(horizontal = 7.dp, vertical = 2.dp),
        )
    }
}

// MARK: - Verify banner

@Composable
fun PlaceVerifyBanner(
    onTap: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(16.dp))
                .background(PantopusColors.infoBg)
                .border(1.dp, PantopusColors.primary200, RoundedCornerShape(16.dp))
                .clickable(onClick = onTap)
                .padding(vertical = 13.dp, horizontal = 14.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier =
                Modifier
                    .size(38.dp)
                    .clip(RoundedCornerShape(11.dp))
                    .background(PantopusColors.primary100)
                    .border(1.dp, PantopusColors.primary200, RoundedCornerShape(11.dp)),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.ShieldCheck,
                contentDescription = null,
                size = 20.dp,
                strokeWidth = 2f,
                tint = PantopusColors.primary600,
            )
        }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(
                text = "Verify your address to message neighbors and get your badge.",
                fontSize = 14.5.sp,
                fontWeight = FontWeight.SemiBold,
                lineHeight = 20.sp,
                letterSpacing = (-0.14).sp,
                color = PantopusColors.primary900,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = "Verify address",
                    fontSize = 13.5.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.primary600,
                )
                PantopusIconImage(
                    icon = PantopusIcon.ArrowRight,
                    contentDescription = null,
                    size = 14.dp,
                    strokeWidth = 2.5f,
                    tint = PantopusColors.primary600,
                )
            }
        }
        PantopusIconImage(
            icon = PantopusIcon.ChevronRight,
            contentDescription = null,
            size = 18.dp,
            strokeWidth = 2.25f,
            tint = PantopusColors.primary300,
        )
    }
}

// MARK: - Skeleton

@Composable
private fun FullWidthShimmer(
    height: Dp,
    cornerRadius: Dp = 16.dp,
) {
    BoxWithConstraints(modifier = Modifier.fillMaxWidth()) {
        Shimmer(width = maxWidth, height = height, cornerRadius = cornerRadius)
    }
}

@Composable
private fun PlaceDashboardSkeleton() {
    Column(modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp)) {
        Column(
            modifier = Modifier.padding(horizontal = 2.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Shimmer(width = 150.dp, height = 26.dp)
            Shimmer(width = 190.dp, height = 14.dp)
        }
        Spacer(modifier = Modifier.height(8.dp))
        FullWidthShimmer(height = 132.dp)
        Spacer(modifier = Modifier.height(20.dp))
        repeat(3) {
            Column(verticalArrangement = Arrangement.spacedBy(9.dp), modifier = Modifier.padding(bottom = 24.dp)) {
                Shimmer(width = 90.dp, height = 11.dp)
                FullWidthShimmer(height = 76.dp)
                FullWidthShimmer(height = 76.dp)
            }
        }
    }
}
