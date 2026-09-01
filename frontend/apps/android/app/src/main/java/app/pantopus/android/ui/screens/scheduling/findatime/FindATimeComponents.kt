@file:Suppress("PackageNaming", "TooManyFunctions", "LongParameterList", "MagicNumber")

package app.pantopus.android.ui.screens.scheduling.findatime

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * Stream A11 shared chrome. Home-green throughout (the find-a-time / who's-free
 * surfaces are home-only), built on design-system tokens — owned by this stream
 * so it never couples to another stream's kit.
 */

/** The Home pillar accent (green) all A11 surfaces tint with. */
internal val HomeAccent: Color get() = PantopusColors.home

internal val HomeAccentBg: Color get() = PantopusColors.homeBg

internal val HomeAccentDark: Color get() = PantopusColors.homeDark

private val TOP_BAR_HEIGHT = 52.dp
private val ICON_BUTTON = 36.dp

/** Chevron back · centered title · optional trailing text action. */
@Composable
fun FtTopBar(
    title: String,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
    trailingText: String? = null,
    trailingEnabled: Boolean = true,
    onTrailing: () -> Unit = {},
    backIcon: PantopusIcon = PantopusIcon.ChevronLeft,
) {
    Column(modifier = modifier.fillMaxWidth().background(PantopusColors.appSurface)) {
        Box(modifier = Modifier.fillMaxWidth().height(TOP_BAR_HEIGHT).padding(horizontal = Spacing.s2)) {
            Box(
                modifier =
                    Modifier
                        .align(Alignment.CenterStart)
                        .size(ICON_BUTTON)
                        .clip(RoundedCornerShape(Radii.md))
                        .clickable(onClickLabel = "Back", onClick = onBack),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(icon = backIcon, contentDescription = "Back", size = 22.dp, tint = PantopusColors.appText)
            }
            Text(
                text = title,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                modifier = Modifier.align(Alignment.Center),
            )
            if (trailingText != null) {
                Text(
                    text = trailingText,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = if (trailingEnabled) HomeAccent else PantopusColors.appTextMuted,
                    modifier =
                        Modifier
                            .align(Alignment.CenterEnd)
                            .clip(RoundedCornerShape(Radii.md))
                            .clickable(enabled = trailingEnabled, onClickLabel = trailingText, onClick = onTrailing)
                            .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                            .testTag("ftTopBarAction"),
                )
            }
        }
        HorizontalDivider(thickness = 1.dp, color = PantopusColors.appBorder)
    }
}

/** Banner tones reused across the stream's first-class states. */
enum class FtBannerTone { Info, Warning, Home, Error }

@Composable
fun FtBanner(
    tone: FtBannerTone,
    icon: PantopusIcon,
    body: String,
    modifier: Modifier = Modifier,
    title: String? = null,
) {
    val bg =
        when (tone) {
            FtBannerTone.Info -> PantopusColors.infoBg
            FtBannerTone.Warning -> PantopusColors.warningBg
            FtBannerTone.Home -> HomeAccentBg
            FtBannerTone.Error -> PantopusColors.errorBg
        }
    val borderC =
        when (tone) {
            FtBannerTone.Info -> PantopusColors.infoLight
            FtBannerTone.Warning -> PantopusColors.warningLight
            FtBannerTone.Home -> HomeAccent
            FtBannerTone.Error -> PantopusColors.errorLight
        }
    val accent =
        when (tone) {
            FtBannerTone.Info -> PantopusColors.info
            FtBannerTone.Warning -> PantopusColors.warning
            FtBannerTone.Home -> HomeAccentDark
            FtBannerTone.Error -> PantopusColors.error
        }
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(bg)
                .border(1.dp, borderC, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s3),
    ) {
        PantopusIconImage(
            icon = icon,
            contentDescription = null,
            size = 16.dp,
            tint = accent,
            modifier = Modifier.padding(end = Spacing.s2, top = 1.dp),
        )
        Column(modifier = Modifier.weight(1f)) {
            if (title != null) {
                Text(text = title, style = PantopusTextStyle.small, fontWeight = FontWeight.Bold, color = PantopusColors.appText)
            }
            Text(
                text = body,
                style = PantopusTextStyle.caption,
                color = if (title != null) PantopusColors.appTextSecondary else accent,
                modifier = Modifier.padding(top = if (title != null) 2.dp else 0.dp),
            )
        }
    }
}

/** White card surface — the section container used throughout the stream. */
@Composable
fun FtCard(
    modifier: Modifier = Modifier,
    selected: Boolean = false,
    content: @Composable () -> Unit,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(
                    if (selected) 1.5.dp else 1.dp,
                    if (selected) HomeAccent else PantopusColors.appBorder,
                    RoundedCornerShape(Radii.xl),
                )
                .padding(Spacing.s4),
    ) {
        content()
    }
}

/** Green section overline ("WHO'S NEEDED"). */
@Composable
fun FtOverline(
    text: String,
    modifier: Modifier = Modifier,
    color: Color = HomeAccentDark,
) {
    Text(
        text = text.uppercase(),
        style = PantopusTextStyle.overline,
        color = color,
        fontWeight = FontWeight.Bold,
        modifier = modifier,
    )
}

private val AVATAR_PALETTE: List<Color> =
    listOf(
        PantopusColors.home,
        PantopusColors.personal,
        PantopusColors.business,
        PantopusColors.warning,
        PantopusColors.error,
        PantopusColors.info,
    )

/** Deterministic initials disc; [checked] overlays a green required badge. */
@Composable
fun FtAvatar(
    member: FindMember,
    size: androidx.compose.ui.unit.Dp,
    modifier: Modifier = Modifier,
    checked: Boolean = false,
    dim: Boolean = false,
) {
    val idx = member.userId.hashCode().mod(AVATAR_PALETTE.size)
    val bg = AVATAR_PALETTE[idx]
    val fg = PantopusColors.appTextInverse
    Box(modifier = modifier.size(size), contentAlignment = Alignment.Center) {
        Box(
            modifier =
                Modifier
                    .size(size)
                    .clip(CircleShape)
                    .background(if (dim) PantopusColors.appSurfaceSunken else bg),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = member.initials,
                color = if (dim) PantopusColors.appTextMuted else fg,
                fontSize = (size.value * 0.36f).sp,
                fontWeight = FontWeight.Bold,
            )
        }
        if (checked) {
            Box(
                modifier =
                    Modifier
                        .align(Alignment.BottomEnd)
                        .offset(x = 2.dp, y = 2.dp)
                        .size(size.value.times(0.46f).dp)
                        .clip(CircleShape)
                        .background(HomeAccent)
                        .border(2.dp, PantopusColors.appSurface, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Check,
                    contentDescription = null,
                    size = size.value.times(0.24f).dp,
                    tint = PantopusColors.appTextInverse,
                )
            }
        }
    }
}

/** Equal-width segmented control. [accentSelected] tints the chosen segment green. */
@Composable
fun FtSegmented(
    options: List<String>,
    selectedIndex: Int,
    onSelect: (Int) -> Unit,
    modifier: Modifier = Modifier,
    accentSelected: Boolean = false,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurfaceSunken)
                .padding(3.dp),
        horizontalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        options.forEachIndexed { i, label ->
            val on = i == selectedIndex
            val bg = if (on) (if (accentSelected) HomeAccent else PantopusColors.appSurface) else Color.Transparent
            val fg =
                when {
                    on && accentSelected -> PantopusColors.appTextInverse
                    on -> PantopusColors.appText
                    else -> PantopusColors.appTextSecondary
                }
            Box(
                modifier =
                    Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(Radii.sm))
                        .background(bg)
                        .clickable(onClickLabel = label) { onSelect(i) }
                        .padding(vertical = Spacing.s2),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = label,
                    style = PantopusTextStyle.small,
                    fontWeight = if (on) FontWeight.Bold else FontWeight.SemiBold,
                    color = fg,
                    textAlign = TextAlign.Center,
                )
            }
        }
    }
}

private val BUTTON_HEIGHT = 48.dp

/** Full-width home-green primary CTA. */
@Composable
fun FtPrimaryButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icon: PantopusIcon? = null,
    enabled: Boolean = true,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .height(BUTTON_HEIGHT)
                .clip(RoundedCornerShape(Radii.lg))
                .background(if (enabled) HomeAccent else PantopusColors.appSurfaceSunken)
                .clickable(enabled = enabled, onClickLabel = label, onClick = onClick),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (icon != null) {
            PantopusIconImage(
                icon = icon,
                contentDescription = null,
                size = 17.dp,
                tint = if (enabled) PantopusColors.appTextInverse else PantopusColors.appTextMuted,
                modifier = Modifier.padding(end = Spacing.s2),
            )
        }
        Text(
            text = label,
            style = PantopusTextStyle.body,
            fontWeight = FontWeight.Bold,
            color = if (enabled) PantopusColors.appTextInverse else PantopusColors.appTextMuted,
        )
    }
}

/** Full-width outlined secondary CTA. */
@Composable
fun FtSecondaryButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icon: PantopusIcon? = null,
    tint: Color = PantopusColors.appTextStrong,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .height(BUTTON_HEIGHT)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .clickable(onClickLabel = label, onClick = onClick),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (icon != null) {
            PantopusIconImage(
                icon = icon,
                contentDescription = null,
                size = 17.dp,
                tint = tint,
                modifier = Modifier.padding(end = Spacing.s2),
            )
        }
        Text(text = label, style = PantopusTextStyle.body, fontWeight = FontWeight.Bold, color = tint)
    }
}

/** Overlapping member-avatar stack with per-member free dots (F5). */
@Composable
fun FtMemberStack(
    members: List<Pair<FindMember, Boolean>>,
    modifier: Modifier = Modifier,
    avatarSize: androidx.compose.ui.unit.Dp = 22.dp,
) {
    Row(modifier = modifier) {
        members.forEachIndexed { i, (m, free) ->
            Box(modifier = Modifier.offset(x = if (i == 0) 0.dp else (-6).dp * i)) {
                FtAvatar(member = m, size = avatarSize, dim = !free)
                Box(
                    modifier =
                        Modifier
                            .align(Alignment.BottomEnd)
                            .size(8.dp)
                            .clip(CircleShape)
                            .background(if (free) HomeAccent else PantopusColors.appBorderStrong)
                            .border(1.5.dp, PantopusColors.appSurface, CircleShape),
                )
            }
        }
    }
}

/** A bordered single-line text field with a placeholder, home-green caret. */
@Composable
fun FtInputField(
    value: String,
    placeholder: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    keyboardType: androidx.compose.ui.text.input.KeyboardType = androidx.compose.ui.text.input.KeyboardType.Text,
) {
    Box(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                .padding(horizontal = Spacing.s3, vertical = Spacing.s3),
    ) {
        if (value.isEmpty()) {
            Text(text = placeholder, style = PantopusTextStyle.body, color = PantopusColors.appTextMuted)
        }
        androidx.compose.foundation.text.BasicTextField(
            value = value,
            onValueChange = onValueChange,
            singleLine = true,
            textStyle = PantopusTextStyle.body.copy(color = PantopusColors.appText),
            cursorBrush = androidx.compose.ui.graphics.SolidColor(HomeAccent),
            keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = keyboardType),
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

/** Soft home-green pill chip (e.g. "BEST", "POLL", "Family"). */
@Composable
fun FtChip(
    label: String,
    modifier: Modifier = Modifier,
    icon: PantopusIcon? = null,
    bg: Color = HomeAccentBg,
    fg: Color = HomeAccentDark,
    leadingDot: Color? = null,
) {
    Row(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(bg)
                .padding(horizontal = Spacing.s2, vertical = 3.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (leadingDot != null) {
            Box(modifier = Modifier.size(8.dp).clip(CircleShape).background(leadingDot).padding(end = Spacing.s1))
        }
        if (icon != null) {
            PantopusIconImage(
                icon = icon,
                contentDescription = null,
                size = 10.dp,
                tint = fg,
                modifier = Modifier.padding(end = Spacing.s1),
            )
        }
        Text(
            text = label,
            style = PantopusTextStyle.overline,
            color = fg,
            fontWeight = FontWeight.Bold,
            modifier = if (leadingDot != null) Modifier.padding(start = Spacing.s1) else Modifier,
        )
    }
}
