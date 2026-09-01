@file:Suppress("MagicNumber", "LongMethod", "PackageNaming", "TooManyFunctions")
@file:OptIn(ExperimentalLayoutApi::class)

package app.pantopus.android.ui.screens.identity_center.view_as

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.LiveBadge
import app.pantopus.android.ui.components.RedactionLevel
import app.pantopus.android.ui.components.RedactionScrim
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.components.ViewerAudience
import app.pantopus.android.ui.components.ViewerPicker
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * B5.2 (A18.5) — "View as" identity preview. Mirrors iOS `ViewAsView.swift`.
 * A [ViewerPicker] at the top drives a live render of YOUR profile as that
 * audience sees it; fields the audience can't see render behind a
 * [RedactionScrim] (heavy lock chip). Switching the chip re-resolves the
 * whole card. There's no primary action — the rendered card IS the output;
 * the only nav affordances are the top-bar Edit pill and the inline
 * "Manage privacy" link (→ A14.7 Privacy).
 */
@Composable
fun ViewAsScreen(
    onBack: () -> Unit = {},
    onManagePrivacy: () -> Unit = {},
    onEdit: () -> Unit = {},
    viewModel: ViewAsViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val selected by viewModel.selected.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { viewModel.load() }
    ViewAsScreenContent(
        state = state,
        selected = selected,
        onSelect = viewModel::select,
        onBack = onBack,
        onManagePrivacy = onManagePrivacy,
        onEdit = onEdit,
    )
}

@Composable
fun ViewAsScreenContent(
    state: ViewAsUiState,
    selected: ViewerAudience,
    onSelect: (ViewerAudience) -> Unit,
    onBack: () -> Unit,
    onManagePrivacy: () -> Unit,
    onEdit: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .testTag("viewAs"),
    ) {
        ViewAsTopBar(onBack = onBack, onEdit = onEdit)
        ViewerPicker(
            selection = selected,
            onSelect = onSelect,
            title = "Preview your profile as",
        )
        when (state) {
            is ViewAsUiState.Loading -> ViewAsLoadingFrame()
            is ViewAsUiState.Loaded ->
                Column(modifier = Modifier.weight(1f).fillMaxWidth()) {
                    Column(
                        modifier =
                            Modifier
                                .weight(1f)
                                .fillMaxWidth()
                                .verticalScroll(rememberScrollState())
                                .testTag("viewAsContent"),
                    ) {
                        ViewAsPreviewCard(
                            render = state.render,
                            modifier = Modifier.padding(Spacing.s4),
                        )
                    }
                    ViewAsPrivacyFooter(
                        text = state.render.footerText,
                        onManagePrivacy = onManagePrivacy,
                    )
                }
        }
    }
}

// MARK: - Top bar

@Composable
private fun ViewAsTopBar(
    onBack: () -> Unit,
    onEdit: () -> Unit,
) {
    Column {
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(52.dp)
                    .background(PantopusColors.appSurface)
                    .padding(horizontal = Spacing.s2),
        ) {
            Box(
                modifier =
                    Modifier
                        .align(Alignment.CenterStart)
                        .size(36.dp)
                        .clickable(onClick = onBack)
                        .semantics {
                            contentDescription = "Back"
                            role = Role.Button
                        }
                        .testTag("viewAsBackButton"),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.ChevronLeft,
                    contentDescription = null,
                    size = 20.dp,
                    strokeWidth = 2.2f,
                    tint = PantopusColors.appText,
                )
            }

            Text(
                text = "View as",
                modifier = Modifier.align(Alignment.Center).semantics { heading() },
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
            )

            Row(
                modifier =
                    Modifier
                        .align(Alignment.CenterEnd)
                        .height(30.dp)
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(PantopusColors.appSurfaceSunken)
                        .clickable(onClick = onEdit)
                        .padding(horizontal = Spacing.s3)
                        .semantics {
                            contentDescription = "Edit profile"
                            role = Role.Button
                        }
                        .testTag("viewAsEditButton"),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.SlidersHorizontal,
                    contentDescription = null,
                    size = 13.dp,
                    strokeWidth = 2.2f,
                    tint = PantopusColors.appTextSecondary,
                )
                Text(
                    text = "Edit",
                    fontSize = 12.5.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appTextSecondary,
                )
            }
        }
        HairLine(PantopusColors.appBorderSubtle)
    }
}

// MARK: - Loading

@Composable
private fun ViewAsLoadingFrame() {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(Spacing.s4)
                .testTag("viewAsLoading"),
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.xl))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                    .padding(Spacing.s5),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            Shimmer(width = 288.dp, height = 44.dp, cornerRadius = Radii.lg)
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
            ) {
                Shimmer(width = 60.dp, height = 60.dp, cornerRadius = 30.dp)
                Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    Shimmer(width = 150.dp, height = 18.dp, cornerRadius = Radii.sm)
                    Shimmer(width = 110.dp, height = 12.dp, cornerRadius = Radii.sm)
                }
            }
            Shimmer(width = 288.dp, height = 26.dp, cornerRadius = Radii.pill)
            repeat(5) {
                Shimmer(width = 288.dp, height = 46.dp, cornerRadius = Radii.md)
            }
        }
    }
}

// MARK: - Preview render card

@Composable
private fun ViewAsPreviewCard(
    render: ViewAsRender,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .shadow(6.dp, RoundedCornerShape(Radii.xl))
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.5.dp, render.banner.tone.cardBorder(), RoundedCornerShape(Radii.xl))
                .testTag("viewAsPreviewCard"),
    ) {
        ViewAsBannerStrip(render.banner)
        ViewAsProfileHead(render.head)
        ViewAsBadgeRow(render.badges)
        Column(modifier = Modifier.padding(horizontal = Spacing.s4)) {
            render.fields.forEach { ViewAsFieldRow(it) }
        }
        ViewAsContextStrip(render.note)
    }
}

// MARK: - Banner strip

@Composable
private fun ViewAsBannerStrip(banner: ViewAsBanner) {
    Column(modifier = Modifier.testTag("viewAsBanner")) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .background(banner.tone.bannerBg())
                    .padding(horizontal = Spacing.s3, vertical = 9.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            Box(
                modifier =
                    Modifier
                        .size(26.dp)
                        .clip(CircleShape)
                        .background(PantopusColors.appSurface)
                        .border(1.dp, banner.tone.bannerBorder(), CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = banner.icon,
                    contentDescription = null,
                    size = 14.dp,
                    strokeWidth = 2.2f,
                    tint = banner.tone.accent(),
                )
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "Viewing as ${banner.viewerLabel}",
                    fontSize = 12.5.sp,
                    fontWeight = FontWeight.Bold,
                    color = banner.tone.foreground(),
                )
                Text(
                    text = banner.subtitle,
                    fontSize = 10.5.sp,
                    fontWeight = FontWeight.Medium,
                    color = banner.tone.foreground().copy(alpha = 0.85f),
                )
            }
            LiveBadge(toneColor = banner.tone.accent())
        }
        HairLine(banner.tone.bannerBorder())
    }
}

// MARK: - Profile head

@Composable
private fun ViewAsProfileHead(head: ViewAsHead) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(start = Spacing.s4, end = Spacing.s4, top = Spacing.s4, bottom = Spacing.s1),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(modifier = Modifier.size(60.dp)) {
            Box(
                modifier =
                    Modifier
                        .size(60.dp)
                        .clip(CircleShape)
                        .background(Brush.linearGradient(head.avatarTone.gradient)),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = head.initials,
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appTextInverse,
                )
            }
            if (head.verified) {
                Box(
                    modifier =
                        Modifier
                            .align(Alignment.BottomEnd)
                            .offset(x = 2.dp, y = 2.dp)
                            .size(22.dp)
                            .clip(CircleShape)
                            .background(PantopusColors.primary600)
                            .border(2.5.dp, PantopusColors.appSurface, CircleShape),
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.Check,
                        contentDescription = null,
                        size = 11.dp,
                        strokeWidth = 3.4f,
                        tint = PantopusColors.appTextInverse,
                    )
                }
            }
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = head.name,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            head.handle?.let {
                Text(
                    text = it,
                    fontSize = 12.5.sp,
                    fontWeight = FontWeight.Medium,
                    color = PantopusColors.appTextSecondary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            ViewAsIdentityChip(head.identity)
        }
    }
}

@Composable
private fun ViewAsIdentityChip(identity: ViewAsIdentityPill) {
    Row(
        modifier =
            Modifier
                .padding(top = Spacing.s1)
                .height(21.dp)
                .clip(RoundedCornerShape(Radii.pill))
                .background(identity.background)
                .padding(horizontal = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.User,
            contentDescription = null,
            size = 11.dp,
            strokeWidth = 2.4f,
            tint = identity.foreground,
        )
        Text(
            text = identity.label,
            fontSize = 10.5.sp,
            fontWeight = FontWeight.Bold,
            color = identity.foreground,
        )
    }
}

// MARK: - Verification badges

@Composable
private fun ViewAsBadgeRow(badges: List<ViewAsBadge>) {
    FlowRow(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(start = Spacing.s4, end = Spacing.s4, top = Spacing.s2, bottom = 14.dp)
                .testTag("viewAsBadges"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        verticalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        badges.forEach { ViewAsBadgePill(it) }
    }
}

@Composable
private fun ViewAsBadgePill(badge: ViewAsBadge) {
    val fg = if (badge.isOn) PantopusColors.success else PantopusColors.appTextMuted
    val bg = if (badge.isOn) PantopusColors.successBg else PantopusColors.appSurfaceSunken
    val border = if (badge.isOn) PantopusColors.successLight else PantopusColors.appBorder
    Row(
        modifier =
            Modifier
                .height(26.dp)
                .clip(RoundedCornerShape(Radii.pill))
                .background(bg)
                .border(1.dp, border, RoundedCornerShape(Radii.pill))
                .padding(horizontal = Spacing.s2)
                .testTag("viewAsBadge_${badge.id}"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(5.dp),
    ) {
        PantopusIconImage(
            icon = if (badge.isOn) badge.icon else PantopusIcon.Lock,
            contentDescription = null,
            size = 12.dp,
            strokeWidth = 2.3f,
            tint = fg,
        )
        Text(
            text = badge.label,
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            color = fg,
        )
    }
}

// MARK: - Field row

@Composable
private fun ViewAsFieldRow(field: ViewAsField) {
    val hidden = field.disclosure.isHidden
    Column {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(vertical = 11.dp)
                    .testTag("viewAsField_${field.id}"),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(11.dp),
        ) {
            Box(
                modifier =
                    Modifier
                        .size(30.dp)
                        .clip(RoundedCornerShape(Radii.md))
                        .background(if (hidden) PantopusColors.appSurfaceSunken else PantopusColors.primary50),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = if (hidden) PantopusIcon.Lock else field.icon,
                    contentDescription = null,
                    size = 14.dp,
                    strokeWidth = 2.2f,
                    tint = if (hidden) PantopusColors.appTextMuted else PantopusColors.primary600,
                )
            }
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(2.dp),
            ) {
                Text(
                    text = field.label.uppercase(),
                    fontSize = 10.5.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 0.4.sp,
                    color = PantopusColors.appTextMuted,
                )
                ViewAsFieldValue(field.disclosure)
            }
            if (!hidden) {
                PantopusIconImage(
                    icon = PantopusIcon.Eye,
                    contentDescription = null,
                    size = 14.dp,
                    strokeWidth = 2f,
                    tint = PantopusColors.primary400,
                )
            }
        }
        HairLine(PantopusColors.appBorderSubtle)
    }
}

@Composable
private fun ViewAsFieldValue(disclosure: ViewAsFieldDisclosure) {
    val shown = disclosure.shownValue
    if (shown != null) {
        Text(
            text = shown,
            fontSize = 13.5.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    } else {
        // Withheld — wrap a privacy-safe placeholder bar in the
        // RedactionScrim primitive so the heavy lock chip floats over a
        // blurred field shape (the real value is never rendered).
        RedactionScrim(
            level = RedactionLevel.Hidden,
            label = "Hidden",
            modifier = Modifier.fillMaxWidth(),
        ) {
            Box(
                modifier = Modifier.fillMaxWidth().height(22.dp),
                contentAlignment = Alignment.CenterStart,
            ) {
                Box(
                    modifier =
                        Modifier
                            .width(104.dp)
                            .height(10.dp)
                            .clip(RoundedCornerShape(Radii.xs))
                            .background(PantopusColors.appBorderStrong),
                )
            }
        }
    }
}

// MARK: - Context strip

@Composable
private fun ViewAsContextStrip(note: ViewAsContextNote) {
    Row(
        modifier =
            Modifier
                .padding(horizontal = Spacing.s4)
                .padding(top = Spacing.s1, bottom = Spacing.s4)
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(note.tone.bannerBg())
                .border(1.dp, note.tone.bannerBorder(), RoundedCornerShape(Radii.lg))
                .padding(horizontal = Spacing.s3, vertical = 11.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(9.dp),
    ) {
        PantopusIconImage(
            icon = note.icon,
            contentDescription = null,
            size = 16.dp,
            strokeWidth = 2f,
            tint = note.tone.accent(),
        )
        Text(
            modifier = Modifier.weight(1f),
            text = note.text,
            fontSize = 11.5.sp,
            fontWeight = FontWeight.SemiBold,
            lineHeight = 15.sp,
            color = note.tone.foreground(),
        )
    }
}

// MARK: - Privacy footer

@Composable
private fun ViewAsPrivacyFooter(
    text: String,
    onManagePrivacy: () -> Unit,
) {
    Column {
        HairLine(PantopusColors.appBorder)
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .background(PantopusColors.appSurface)
                    .clickable(onClick = onManagePrivacy)
                    .padding(horizontal = Spacing.s4)
                    .padding(top = Spacing.s3, bottom = Spacing.s5)
                    .semantics {
                        contentDescription = "$text Manage privacy"
                        role = Role.Button
                    }
                    .testTag("viewAsManagePrivacy"),
            verticalAlignment = Alignment.Top,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.ShieldCheck,
                contentDescription = null,
                size = 16.dp,
                strokeWidth = 2f,
                tint = PantopusColors.primary600,
                modifier = Modifier.padding(top = 1.dp),
            )
            Text(
                modifier = Modifier.weight(1f),
                text =
                    buildAnnotatedString {
                        append("$text ")
                        withStyle(
                            SpanStyle(
                                color = PantopusColors.primary600,
                                fontWeight = FontWeight.Bold,
                            ),
                        ) {
                            append("Manage privacy")
                        }
                    },
                fontSize = 11.5.sp,
                lineHeight = 16.sp,
                color = PantopusColors.appTextSecondary,
            )
        }
    }
}

// MARK: - Shared bits

@Composable
private fun HairLine(color: Color) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(1.dp)
                .background(color),
    )
}

// MARK: - Tone palette

private fun ViewAsTone.accent(): Color = if (this == ViewAsTone.Info) PantopusColors.primary600 else PantopusColors.warning

private fun ViewAsTone.foreground(): Color = if (this == ViewAsTone.Info) PantopusColors.primary700 else PantopusColors.warning

private fun ViewAsTone.bannerBg(): Color = if (this == ViewAsTone.Info) PantopusColors.primary50 else PantopusColors.warningBg

private fun ViewAsTone.bannerBorder(): Color = if (this == ViewAsTone.Info) PantopusColors.primary100 else PantopusColors.warningLight

private fun ViewAsTone.cardBorder(): Color = if (this == ViewAsTone.Info) PantopusColors.primary200 else PantopusColors.warningLight
