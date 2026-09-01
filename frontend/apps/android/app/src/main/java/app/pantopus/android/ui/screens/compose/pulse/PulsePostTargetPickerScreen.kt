@file:Suppress("LongMethod", "LongParameterList", "MagicNumber")

package app.pantopus.android.ui.screens.compose.pulse

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.shared.form.FormShell
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.launch

@Composable
fun PulsePostTargetPickerScreen(
    onSelect: (PulsePostingTarget) -> Unit,
    onCancel: () -> Unit,
    viewModel: PulsePostTargetPickerViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val homes by viewModel.homes.collectAsStateWithLifecycle()
    val businesses by viewModel.businesses.collectAsStateWithLifecycle()
    val isLocating by viewModel.isLocating.collectAsStateWithLifecycle()
    var expandedHomes by remember { mutableStateOf(false) }
    var expandedBusinesses by remember { mutableStateOf(false) }
    var locationError by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(Unit) { viewModel.load() }

    FormShell(
        title = "New post",
        rightActionLabel = null,
        isValid = false,
        isDirty = false,
        isSaving = false,
        onClose = onCancel,
        onCommit = {},
    ) {
        when (val pickerState = state) {
            PulsePostTargetPickerState.Loading -> TargetPickerSkeleton()
            is PulsePostTargetPickerState.Error ->
                EmptyState(
                    icon = PantopusIcon.AlertCircle,
                    headline = "Couldn't load posting options",
                    subcopy = pickerState.message,
                    ctaTitle = "Try again",
                    onCta = { viewModel.load() },
                )
            PulsePostTargetPickerState.Ready ->
                Column(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .padding(horizontal = Spacing.s4)
                            .testTag("pulsePostTargetPicker"),
                    verticalArrangement = Arrangement.spacedBy(Spacing.s4),
                ) {
                    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                        Text(
                            text = "Where do you want to post?",
                            style = PantopusTextStyle.h3.copy(fontWeight = FontWeight.Bold),
                            color = PantopusColors.appText,
                        )
                        Text(
                            text = "Pick the place or audience your post should reach.",
                            style = PantopusTextStyle.small.copy(fontSize = 13.sp, lineHeight = 18.sp),
                            color = PantopusColors.appTextSecondary,
                        )
                    }

                    TargetSectionLabel("Your places")

                    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                        TargetCard(
                            icon = PantopusIcon.Compass,
                            iconBackground = PantopusColors.primary50,
                            iconColor = PantopusColors.primary600,
                            title = "Current Location",
                            subtitle = "Post to the area where you are right now",
                            isLoading = isLocating,
                            tag = "pulseTarget_currentLocation",
                        ) {
                            scope.launch {
                                locationError = null
                                val target = viewModel.selectCurrentLocation()
                                if (target != null) {
                                    onSelect(target)
                                } else {
                                    locationError = "Could not get your location. Check permissions and try again."
                                }
                            }
                        }
                        locationError?.let { msg ->
                            Text(
                                text = msg,
                                style = PantopusTextStyle.caption,
                                color = PantopusColors.error,
                                modifier = Modifier.fillMaxWidth(),
                            )
                        }
                        HomeSection(homes, expandedHomes, { expandedHomes = !expandedHomes }, onSelect)
                        BusinessSection(businesses, expandedBusinesses, { expandedBusinesses = !expandedBusinesses }, onSelect)
                    }

                    TargetSectionLabel("Your network", modifier = Modifier.padding(top = Spacing.s1))

                    TargetCard(
                        icon = PantopusIcon.Link,
                        iconBackground = PantopusColors.warmAmberBg,
                        iconColor = PantopusColors.warmAmber,
                        title = "Connections",
                        subtitle = "Share with people you trust, wherever they are",
                        tag = "pulseTarget_connections",
                    ) { onSelect(PulsePostingTarget.Connections) }
                }
        }
    }
}

@Composable
private fun TargetSectionLabel(
    text: String,
    modifier: Modifier = Modifier,
) {
    Text(
        text = text.uppercase(),
        style = PantopusTextStyle.overline,
        color = PantopusColors.appTextMuted,
        modifier = modifier,
    )
}

@Composable
private fun HomeSection(
    homes: List<PulseHomeTargetOption>,
    expanded: Boolean,
    onToggle: () -> Unit,
    onSelect: (PulsePostingTarget) -> Unit,
) {
    when {
        homes.isEmpty() ->
            TargetCard(
                icon = PantopusIcon.Home,
                iconBackground = PantopusColors.homeBg,
                iconColor = PantopusColors.home,
                title = "Home Area",
                subtitle = "Add a home to post here",
                muted = true,
                tag = "pulseTarget_homeEmpty",
            ) {}
        homes.size == 1 -> {
            val home = homes.first()
            TargetCard(
                icon = PantopusIcon.Home,
                iconBackground = PantopusColors.homeBg,
                iconColor = PantopusColors.home,
                title = "Home Area",
                subtitle = home.label,
                tag = "pulseTarget_home",
            ) {
                onSelect(PulsePostingTarget.Home(home.id, home.latitude, home.longitude, home.label))
            }
        }
        else ->
            ExpandableTargetCard(
                icon = PantopusIcon.Home,
                iconBackground = PantopusColors.homeBg,
                iconColor = PantopusColors.home,
                title = "Home Area",
                subtitle = "${homes.size} homes",
                isExpanded = expanded,
                tag = "pulseTarget_homeGroup",
                onToggle = onToggle,
            ) {
                homes.forEach { home ->
                    TargetSubRow(title = home.label, tag = "pulseTargetHome_${home.id}") {
                        onSelect(PulsePostingTarget.Home(home.id, home.latitude, home.longitude, home.label))
                    }
                }
            }
    }
}

@Composable
private fun BusinessSection(
    businesses: List<PulseBusinessTargetOption>,
    expanded: Boolean,
    onToggle: () -> Unit,
    onSelect: (PulsePostingTarget) -> Unit,
) {
    if (businesses.isEmpty()) return
    if (businesses.size == 1) {
        val biz = businesses.first()
        TargetCard(
            icon = PantopusIcon.Building2,
            iconBackground = PantopusColors.businessBg,
            iconColor = PantopusColors.business,
            title = "Business Area",
            subtitle = biz.name,
            tag = "pulseTarget_business",
        ) {
            onSelect(PulsePostingTarget.Business(biz.id, biz.latitude, biz.longitude, biz.label))
        }
    } else {
        ExpandableTargetCard(
            icon = PantopusIcon.Building2,
            iconBackground = PantopusColors.businessBg,
            iconColor = PantopusColors.business,
            title = "Business Area",
            subtitle = "${businesses.size} businesses",
            isExpanded = expanded,
            tag = "pulseTarget_businessGroup",
            onToggle = onToggle,
        ) {
            businesses.forEach { biz ->
                TargetSubRow(title = biz.name, hint = biz.label, tag = "pulseTargetBusiness_${biz.id}") {
                    onSelect(PulsePostingTarget.Business(biz.id, biz.latitude, biz.longitude, biz.label))
                }
            }
        }
    }
}

/** 44dp rounded icon tile — mirrors the iOS `iconTile` builder. */
@Composable
private fun TargetIconTile(
    icon: PantopusIcon,
    background: Color,
    color: Color,
    muted: Boolean = false,
) {
    Box(
        modifier =
            Modifier
                .size(44.dp)
                .clip(RoundedCornerShape(Radii.md))
                .background(background.copy(alpha = if (muted) 0.5f else 1f)),
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(
            icon = icon,
            contentDescription = null,
            size = 22.dp,
            strokeWidth = 2f,
            tint = color.copy(alpha = if (muted) 0.5f else 1f),
        )
    }
}

@Composable
private fun TargetCardLabel(
    title: String,
    subtitle: String,
    muted: Boolean,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(
            text = title,
            style = PantopusTextStyle.small.copy(fontSize = 15.sp, fontWeight = FontWeight.SemiBold),
            color = if (muted) PantopusColors.appTextMuted else PantopusColors.appText,
        )
        Text(
            text = subtitle,
            style = PantopusTextStyle.small.copy(fontSize = 13.sp, lineHeight = 18.sp),
            color = PantopusColors.appTextSecondary,
            maxLines = 2,
        )
    }
}

/** Solid (or dashed when [muted]) appBorder stroke on a Radii.lg surface. */
private fun Modifier.targetCardBorder(muted: Boolean): Modifier =
    if (muted) {
        drawBehind {
            val inset = 0.5.dp.toPx()
            drawRoundRect(
                color = PantopusColors.appBorder,
                topLeft = androidx.compose.ui.geometry.Offset(inset, inset),
                size =
                    androidx.compose.ui.geometry.Size(
                        size.width - inset * 2,
                        size.height - inset * 2,
                    ),
                cornerRadius = CornerRadius(Radii.lg.toPx()),
                style =
                    Stroke(
                        width = 1.dp.toPx(),
                        pathEffect = PathEffect.dashPathEffect(floatArrayOf(4.dp.toPx(), 3.dp.toPx()), 0f),
                    ),
            )
        }
    } else {
        border(width = 1.dp, color = PantopusColors.appBorder, shape = RoundedCornerShape(Radii.lg))
    }

@Composable
private fun TargetCard(
    icon: PantopusIcon,
    iconBackground: Color,
    iconColor: Color,
    title: String,
    subtitle: String,
    tag: String,
    muted: Boolean = false,
    isLoading: Boolean = false,
    onClick: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .targetCardBorder(muted)
                .clickable(enabled = !muted && !isLoading, onClick = onClick)
                .padding(Spacing.s3)
                .testTag(tag),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        TargetIconTile(icon, iconBackground, iconColor, muted)
        TargetCardLabel(title = title, subtitle = subtitle, muted = muted, modifier = Modifier.weight(1f))
        if (isLoading) {
            CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
        } else if (!muted) {
            PantopusIconImage(
                icon = PantopusIcon.ChevronRight,
                contentDescription = null,
                size = 18.dp,
                tint = PantopusColors.appTextMuted,
            )
        }
    }
}

/** Card that expands in place to reveal one row per home/business. */
@Composable
private fun ExpandableTargetCard(
    icon: PantopusIcon,
    iconBackground: Color,
    iconColor: Color,
    title: String,
    subtitle: String,
    isExpanded: Boolean,
    tag: String,
    onToggle: () -> Unit,
    rows: @Composable ColumnScope.() -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .targetCardBorder(muted = false),
    ) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clickable(onClick = onToggle)
                    .padding(Spacing.s3)
                    .testTag(tag),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            TargetIconTile(icon, iconBackground, iconColor)
            TargetCardLabel(title = title, subtitle = subtitle, muted = false, modifier = Modifier.weight(1f))
            PantopusIconImage(
                icon = if (isExpanded) PantopusIcon.ChevronUp else PantopusIcon.ChevronDown,
                contentDescription = null,
                size = 18.dp,
                tint = PantopusColors.appTextMuted,
            )
        }
        if (isExpanded) {
            HorizontalDivider(modifier = Modifier.padding(horizontal = Spacing.s3))
            rows()
        }
    }
}

@Composable
private fun TargetSubRow(
    title: String,
    tag: String,
    hint: String? = null,
    onClick: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable(onClick = onClick)
                .padding(start = Spacing.s3 + 44.dp, end = Spacing.s3, top = Spacing.s3, bottom = Spacing.s3)
                .testTag(tag),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.MapPin,
            contentDescription = null,
            size = 16.dp,
            tint = PantopusColors.appTextSecondary,
        )
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                style = PantopusTextStyle.small.copy(fontWeight = FontWeight.Medium),
                color = PantopusColors.appText,
            )
            hint?.let { Text(text = it, style = PantopusTextStyle.caption, color = PantopusColors.appTextMuted) }
        }
        PantopusIconImage(
            icon = PantopusIcon.ChevronRight,
            contentDescription = null,
            size = 16.dp,
            tint = PantopusColors.appTextMuted,
        )
    }
}

@Composable
private fun TargetPickerSkeleton() {
    Column(
        modifier = Modifier.padding(horizontal = Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Shimmer(width = 230.dp, height = 22.dp, cornerRadius = Radii.sm)
        Shimmer(
            width = 180.dp,
            height = 13.dp,
            cornerRadius = Radii.sm,
            modifier = Modifier.padding(bottom = Spacing.s2),
        )
        repeat(3) {
            Shimmer(width = 340.dp, height = 72.dp, cornerRadius = Radii.lg)
        }
        Shimmer(
            width = 110.dp,
            height = 11.dp,
            cornerRadius = Radii.sm,
            modifier = Modifier.padding(top = Spacing.s2),
        )
        Shimmer(width = 340.dp, height = 72.dp, cornerRadius = Radii.lg)
    }
}
