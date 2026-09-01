@file:Suppress("PackageNaming", "LongMethod", "TooManyFunctions", "MagicNumber", "LongParameterList")

package app.pantopus.android.ui.screens.scheduling.home

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.OfflineBannerHost
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.scheduling._shared.OwnerPillarHeader
import app.pantopus.android.ui.screens.scheduling._shared.PantopusMiniToggle
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingRoutes
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * F8 — My Household Availability Settings. An exposure-only boundary screen
 * for the Home pillar: it reads whether Personal availability is set up,
 * deep-links to Personal to edit, and toggles three device-local
 * household-exposure prefs. Mirrors iOS `HouseholdAvailabilityScreen`.
 */
@Composable
fun HouseholdAvailabilityScreen(
    onBack: () -> Unit = {},
    onNavigate: (String) -> Unit = {},
) {
    val viewModel: HouseholdAvailabilityViewModel = hiltViewModel()
    val state by viewModel.state.collectAsStateWithLifecycle()
    val online by viewModel.isOnline.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { viewModel.load() }

    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appBg)
                .testTag("householdAvailability"),
    ) {
        OwnerPillarHeader(
            title = "My availability",
            pillar = SchedulingPillar.Home,
            onBack = onBack,
        )
        // Offline strip in the chrome stack — mirrors iOS
        // `.offlineBanner(isOffline:)` on MyHouseholdAvailabilityView.
        OfflineBannerHost(isOffline = !online) {
            when (val current = state) {
                is HouseholdAvailabilityUiState.Loading -> LoadingBody()
                is HouseholdAvailabilityUiState.Error ->
                    EmptyState(
                        icon = PantopusIcon.AlertCircle,
                        headline = "Couldn't load settings",
                        subcopy = current.message,
                        ctaTitle = "Try again",
                        onCta = { viewModel.load() },
                    )
                is HouseholdAvailabilityUiState.Ready ->
                    ReadyBody(
                        data = current.data,
                        onNavigate = onNavigate,
                        onSetExposure = viewModel::setExposure,
                    )
            }
        }
    }
}

@Composable
private fun LoadingBody() {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Shimmer(width = 320.dp, height = 64.dp, cornerRadius = Radii.xl)
        Shimmer(width = 80.dp, height = 12.dp, cornerRadius = Radii.xs)
        Shimmer(width = 320.dp, height = 56.dp, cornerRadius = Radii.xl)
        Shimmer(width = 160.dp, height = 12.dp, cornerRadius = Radii.xs)
        Shimmer(width = 320.dp, height = 180.dp, cornerRadius = Radii.xl)
    }
}

@Composable
private fun ReadyBody(
    data: ReadyData,
    onNavigate: (String) -> Unit,
    onSetExposure: (Exposure, Boolean) -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        ContextHeaderCard(homeName = data.homeName)

        if (!data.personalIsSetUp) {
            NotSetUpBlock(onNavigate = onNavigate)
        } else {
            SourceSection(onNavigate = onNavigate)
        }

        ExposureSection(
            data = data,
            onSetExposure = onSetExposure,
        )

        if (data.personalIsSetUp) {
            Text(
                text =
                    "This only controls what this household sees. " +
                        "It doesn't change your personal calendar.",
                fontSize = 11.sp,
                color = PantopusColors.appTextSecondary,
                modifier = Modifier.padding(start = Spacing.s1),
            )
        }
    }
}

@Composable
private fun ContextHeaderCard(homeName: String) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .padding(Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(40.dp)
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.homeBg),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Home,
                contentDescription = null,
                size = 20.dp,
                tint = PantopusColors.home,
            )
        }
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                text = homeName,
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
                maxLines = 1,
            )
            Text(
                text = "How you appear here",
                fontSize = 11.5.sp,
                color = PantopusColors.appTextSecondary,
            )
        }
    }
}

@Composable
private fun SectionOverline(text: String) {
    Text(
        text = text.uppercase(),
        fontSize = 9.5.sp,
        fontWeight = FontWeight.Bold,
        letterSpacing = 0.8.sp,
        color = PantopusColors.appTextSecondary,
        modifier = Modifier.padding(start = Spacing.s1),
    )
}

@Composable
private fun CardContainer(content: @Composable () -> Unit) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl)),
    ) {
        content()
    }
}

@Composable
private fun SourceSection(onNavigate: (String) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        SectionOverline("Source")
        CardContainer {
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clickable { onNavigate(SchedulingRoutes.AVAILABILITY_LIST) }
                        .padding(horizontal = Spacing.s3, vertical = Spacing.s3)
                        .testTag("householdAvailability_editSource"),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
            ) {
                Box(
                    modifier =
                        Modifier
                            .size(32.dp)
                            .clip(RoundedCornerShape(Radii.md))
                            .background(PantopusColors.primary50)
                            .border(1.dp, PantopusColors.infoLight, RoundedCornerShape(Radii.md)),
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.Calendar,
                        contentDescription = null,
                        size = 16.dp,
                        tint = PantopusColors.personal,
                    )
                }
                Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(
                        text = "Edit my full availability in Personal",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = PantopusColors.appText,
                    )
                    Text(
                        text = "Your source of truth — changes apply everywhere",
                        fontSize = 10.5.sp,
                        color = PantopusColors.appTextSecondary,
                    )
                }
                PantopusIconImage(
                    icon = PantopusIcon.ChevronRight,
                    contentDescription = null,
                    size = 16.dp,
                    tint = PantopusColors.appTextMuted,
                )
            }
        }
    }
}

@Composable
private fun NotSetUpBlock(onNavigate: (String) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.infoBg)
                    .border(1.dp, PantopusColors.infoLight, RoundedCornerShape(Radii.lg))
                    .padding(Spacing.s3),
            verticalAlignment = Alignment.Top,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Info,
                contentDescription = null,
                size = 16.dp,
                tint = PantopusColors.info,
            )
            Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(
                    text = "Set up your availability in Personal first",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.info,
                )
                Text(
                    text =
                        "Until you set your free/busy hours, this household " +
                            "can't see when you're free.",
                    fontSize = 11.5.sp,
                    color = PantopusColors.appTextStrong,
                )
            }
        }
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 46.dp)
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.home)
                    .clickable { onNavigate(SchedulingRoutes.AVAILABILITY_LIST) }
                    .padding(horizontal = Spacing.s3)
                    .testTag("householdAvailability_setUpCTA"),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2, Alignment.CenterHorizontally),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.ExternalLink,
                contentDescription = null,
                size = 16.dp,
                tint = PantopusColors.appTextInverse,
            )
            Text(
                text = "Set it up in Personal",
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appTextInverse,
            )
        }
    }
}

@Composable
private fun ExposureSection(
    data: ReadyData,
    onSetExposure: (Exposure, Boolean) -> Unit,
) {
    var confirmHideShare by remember { mutableStateOf(false) }
    val disabled = !data.personalIsSetUp

    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        SectionOverline("What this household sees")
        CardContainer {
            ToggleRow(
                icon = PantopusIcon.Eye,
                title = "Share my free/busy with this household",
                subtitle = "Members see when you're free, never event details",
                on = data.shareFreeBusy,
                disabled = disabled,
                saving = data.savingExposure == Exposure.ShareFreeBusy,
                showDivider = false,
                onToggle = { next ->
                    if (next) {
                        onSetExposure(Exposure.ShareFreeBusy, true)
                    } else {
                        confirmHideShare = true
                    }
                },
            )
            ToggleRow(
                icon = PantopusIcon.ArrowsRepeat,
                title = "Include me in round-robin rotation",
                subtitle = "You can be auto-assigned when more than one is free",
                on = data.roundRobin,
                disabled = disabled,
                saving = data.savingExposure == Exposure.RoundRobin,
                showDivider = true,
                onToggle = { next -> onSetExposure(Exposure.RoundRobin, next) },
            )
            if (data.personalIsSetUp) {
                DisclosureRow(
                    icon = PantopusIcon.Moon,
                    title = "Household quiet hours",
                    value = data.quietHoursLabel,
                    // Deliberate no-op (mirrors iOS `openQuietHours()`): the F8b
                    // quiet-hours editor route does not exist yet, and navigating
                    // to an unregistered route crashes with IllegalArgumentException.
                    // Wire a real "scheduling/home/quiet-hours" destination first.
                    onClick = {},
                )
            }
            ToggleRow(
                icon = PantopusIcon.CalendarX,
                title = "Auto-decline conflicting invites",
                subtitle = null,
                on = data.autoDecline,
                disabled = disabled,
                saving = data.savingExposure == Exposure.AutoDecline,
                showDivider = true,
                onToggle = { next -> onSetExposure(Exposure.AutoDecline, next) },
            )
        }
    }

    if (confirmHideShare) {
        AlertDialog(
            onDismissRequest = { confirmHideShare = false },
            title = { Text("Hide your free/busy from ${data.homeName}?") },
            text = { Text("They won't be able to include you in Find a time.") },
            confirmButton = {
                TextButton(onClick = {
                    confirmHideShare = false
                    onSetExposure(Exposure.ShareFreeBusy, false)
                }) {
                    Text("Hide", color = PantopusColors.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { confirmHideShare = false }) {
                    Text("Keep sharing")
                }
            },
        )
    }
}

@Composable
private fun ToggleRow(
    icon: PantopusIcon,
    title: String,
    subtitle: String?,
    on: Boolean,
    disabled: Boolean,
    saving: Boolean,
    showDivider: Boolean,
    onToggle: (Boolean) -> Unit,
) {
    val active = on && !disabled
    Column {
        if (showDivider) {
            HorizontalDivider(color = PantopusColors.appBorder)
        }
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .alpha(if (disabled) 0.5f else 1f)
                    .padding(horizontal = Spacing.s3, vertical = 11.dp)
                    .testTag("householdToggle_$title"),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            RowIconTile(icon = icon, active = active)
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(
                    text = title,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appText,
                )
                if (subtitle != null) {
                    Text(
                        text = subtitle,
                        fontSize = 11.sp,
                        color = PantopusColors.appTextSecondary,
                    )
                }
            }
            if (saving) {
                CircularProgressIndicator(
                    color = PantopusColors.home,
                    strokeWidth = 2.dp,
                    modifier = Modifier.size(20.dp),
                )
            } else {
                // Design availability-settings-frames.jsx ToggleGreen: a 36×20 pill with
                // a 16dp thumb in the home accent — not the 52×32 Material 3 Switch.
                PantopusMiniToggle(
                    checked = on,
                    onCheckedChange = if (disabled) null else onToggle,
                    accent = PantopusColors.home,
                    trackWidth = 36.dp,
                    trackHeight = 20.dp,
                    thumbSize = 16.dp,
                )
            }
        }
    }
}

@Composable
private fun DisclosureRow(
    icon: PantopusIcon,
    title: String,
    value: String,
    onClick: () -> Unit,
) {
    Column {
        HorizontalDivider(color = PantopusColors.appBorder)
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clickable(onClick = onClick)
                    .padding(horizontal = Spacing.s3, vertical = 11.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            RowIconTile(icon = icon, active = false)
            Text(
                text = title,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                modifier = Modifier.weight(1f),
            )
            Text(
                text = value,
                fontSize = 12.sp,
                color = PantopusColors.appTextSecondary,
            )
            Spacer(Modifier.width(Spacing.s1))
            PantopusIconImage(
                icon = PantopusIcon.ChevronRight,
                contentDescription = null,
                size = 16.dp,
                tint = PantopusColors.appTextMuted,
            )
        }
    }
}

@Composable
private fun RowIconTile(
    icon: PantopusIcon,
    active: Boolean,
) {
    Box(
        modifier =
            Modifier
                .size(32.dp)
                .clip(RoundedCornerShape(Radii.md))
                .background(if (active) PantopusColors.homeBg else PantopusColors.appSurfaceSunken),
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(
            icon = icon,
            contentDescription = null,
            size = 16.dp,
            tint = if (active) PantopusColors.home else PantopusColors.appTextSecondary,
        )
    }
}
