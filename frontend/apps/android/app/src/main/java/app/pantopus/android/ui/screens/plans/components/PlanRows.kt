@file:Suppress("MagicNumber", "TooManyFunctions", "LongParameterList")

package app.pantopus.android.ui.screens.plans.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.plans.PlanKind
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusElevations
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import app.pantopus.android.ui.theme.pantopusShadow
import coil.compose.AsyncImage

/** The board's card: surface, 1 dp border, 20 dp corners, a soft shadow. */
fun Modifier.planCard(corner: Dp = Radii.xl2): Modifier =
    this
        .pantopusShadow(PantopusElevations.sm, RoundedCornerShape(corner))
        .clip(RoundedCornerShape(corner))
        .background(PantopusColors.appSurface)
        .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(corner))

/** What sits at the end of a plan row (board P2: one thing only). */
sealed interface PlanRowEnd {
    data class Status(
        val text: String,
        val icon: PantopusIcon? = null,
        val iconTint: Color? = null,
    ) : PlanRowEnd

    data class Note(
        val text: String,
    ) : PlanRowEnd

    data object Chevron : PlanRowEnd

    data object Check : PlanRowEnd

    data object None : PlanRowEnd
}

/**
 * The plan row (board P2): a 44 dp tile, the title (16/21 semibold) and one line of when, where and distance, and
 * one thing at the end. At large text both lines wrap instead of cutting off, and a status or note moves under them.
 * When the words don't fit on one line each, they take two, and a status moves under them (as on iOS), so a title or
 * a distance is never cut off.
 */
@Composable
fun PlanRow(
    title: String,
    subtitle: String,
    end: PlanRowEnd,
    modifier: Modifier = Modifier,
    first: Boolean = false,
    leading: @Composable () -> Unit,
    spoken: String? = null,
    onClick: (() -> Unit)? = null,
) {
    val large = LocalDensity.current.fontScale >= LARGE_TEXT_SCALE
    var crowded by remember(title, subtitle, end) { mutableStateOf(false) }
    val endBelow = (large && (end is PlanRowEnd.Status || end is PlanRowEnd.Note)) || (crowded && end is PlanRowEnd.Status)
    val onLayout: (TextLayoutResult) -> Unit = { if (!large && !crowded && it.hasVisualOverflow) crowded = true }
    Column(modifier = modifier.fillMaxWidth()) {
        if (!first) PlanDivider()
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 66.dp)
                    .then(if (onClick != null) Modifier.clickable(role = Role.Button, onClick = onClick) else Modifier)
                    .padding(vertical = 11.dp)
                    .then(
                        if (spoken != null) {
                            Modifier.clearAndSetSemantics {
                                contentDescription = spoken
                                if (onClick != null) role = Role.Button
                            }
                        } else {
                            Modifier.semantics(mergeDescendants = true) {}
                        },
                    ),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            leading()
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = title,
                    style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold, lineHeight = 21.sp),
                    color = PantopusColors.appText,
                    maxLines = if (large) 3 else if (crowded) 2 else 1,
                    overflow = TextOverflow.Ellipsis,
                    onTextLayout = onLayout,
                )
                Text(
                    text = subtitle,
                    style = PantopusTextStyle.small.copy(fontSize = 13.sp, lineHeight = 18.sp),
                    color = PantopusColors.appTextSecondary,
                    maxLines = if (large) 4 else if (crowded) 2 else 1,
                    overflow = TextOverflow.Ellipsis,
                    onTextLayout = onLayout,
                )
                // At large text, or when the words are crowded, the end goes under them so it doesn't squeeze the title.
                if (endBelow) {
                    Box(modifier = Modifier.padding(top = Spacing.s1)) { PlanRowEndSlot(end) }
                }
            }
            if (!endBelow) PlanRowEndSlot(end)
        }
    }
}

@Composable
private fun PlanRowEndSlot(end: PlanRowEnd) {
    when (end) {
        is PlanRowEnd.Status ->
            PlanStatusChip(text = end.text, icon = end.icon, iconTint = end.iconTint ?: PantopusColors.appTextStrong)
        is PlanRowEnd.Note ->
            Text(
                text = end.text,
                style = PantopusTextStyle.small.copy(fontSize = 13.sp),
                color = PantopusColors.appTextMuted,
            )
        PlanRowEnd.Chevron ->
            PantopusIconImage(
                icon = PantopusIcon.ChevronRight,
                contentDescription = null,
                size = Spacing.s4,
                tint = PantopusColors.appTextMuted,
            )
        PlanRowEnd.Check ->
            PantopusIconImage(icon = PantopusIcon.Check, contentDescription = null, size = 22.dp, tint = PantopusColors.primary600)
        PlanRowEnd.None -> Unit
    }
}

/** A plan row's tile for a plan type. */
@Composable
fun PlanKindLeading(kind: PlanKind?) {
    if (kind != null) {
        PlanTile(kind)
    } else {
        PlanIconTile(PantopusIcon.Calendar, PantopusColors.appSurfaceSunken, PantopusColors.appTextStrong)
    }
}

private val avatarTints: List<Pair<Color, Color>>
    get() =
        listOf(
            PantopusColors.personalBg to PantopusColors.personal,
            PantopusColors.roseBg to PantopusColors.rose,
            PantopusColors.homeBg to PantopusColors.home,
            PantopusColors.warmAmberBg to PantopusColors.warmAmber,
            PantopusColors.primary100 to PantopusColors.primary700,
        )

/** An initial in a soft circle, or the person's photo when there is one. Decorative: the name is read. */
@Composable
fun PlanAvatar(
    name: String?,
    modifier: Modifier = Modifier,
    seed: String? = name,
    avatarUrl: String? = null,
    size: Dp = 40.dp,
    ring: Boolean = false,
) {
    val initial = name?.trim()?.firstOrNull()?.uppercaseChar()?.toString() ?: "?"
    val (bg, fg) = avatarTints[Math.floorMod((seed ?: initial).hashCode(), avatarTints.size)]
    Box(
        modifier =
            modifier
                .size(size)
                .then(if (ring) Modifier.border(2.dp, PantopusColors.appSurface, CircleShape) else Modifier)
                .clip(CircleShape)
                .background(bg)
                .clearAndSetSemantics {},
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = initial,
            style = PantopusTextStyle.small.copy(fontWeight = FontWeight.Bold, fontSize = (size.value * 0.38f).sp),
            color = fg,
        )
        if (!avatarUrl.isNullOrBlank()) {
            AsyncImage(
                model = avatarUrl,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.size(size).clip(CircleShape),
            )
        }
    }
}

/** Overlapping small avatars (J7: "Sam (host), you + 1, Alex…"). */
@Composable
fun PlanAvatarStack(
    names: List<Pair<String?, String?>>,
    modifier: Modifier = Modifier,
    size: Dp = 30.dp,
) {
    Row(modifier = modifier.clearAndSetSemantics {}) {
        names.take(MAX_STACK).forEachIndexed { index, (name, seed) ->
            PlanAvatar(
                name = name,
                seed = seed,
                size = size,
                ring = true,
                modifier = Modifier.offset(x = (-8 * index).dp),
            )
        }
    }
}

private const val MAX_STACK = 4

/** The verified badge (board P2 "ver"): a shield and the words, in the success ink. */
@Composable
fun PlanVerifiedBadge(
    modifier: Modifier = Modifier,
    text: String = "Verified address",
) {
    Row(
        modifier = modifier,
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(icon = PantopusIcon.ShieldCheck, contentDescription = null, size = 14.dp, tint = PantopusColors.success)
        Text(
            text = text,
            style = PantopusTextStyle.small.copy(fontSize = 13.sp, lineHeight = 18.sp, fontWeight = FontWeight.SemiBold),
            color = PantopusColors.success,
        )
    }
}

/**
 * The host row (board P2): avatar, first name and last initial with the verified badge, and two counts. No
 * ratings, never an address.
 */
@Composable
fun PlanHostRow(
    name: String,
    verified: Boolean,
    caption: String,
    modifier: Modifier = Modifier,
    seed: String? = name,
    avatarUrl: String? = null,
    trailing: @Composable (() -> Unit)? = null,
) {
    Row(
        modifier = modifier.fillMaxWidth().semantics(mergeDescendants = true) {},
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        PlanAvatar(name = name, seed = seed, avatarUrl = avatarUrl)
        Column(modifier = Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                Text(
                    text = name,
                    style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
                    color = PantopusColors.appText,
                )
                if (verified) PlanVerifiedBadge()
            }
            if (caption.isNotBlank()) {
                Text(text = caption, style = PantopusTextStyle.small, color = PantopusColors.appTextSecondary)
            }
        }
        trailing?.invoke()
    }
}

/**
 * Spots (board P2 SlotMeter): one segment per spot, filled green for people going, the viewer's own party in sky
 * once they're in, open spots hollow. Over 12 spots it is a continuous bar.
 */
@Composable
fun PlanSpotsMeter(
    spots: Int,
    taken: Int,
    modifier: Modifier = Modifier,
    mine: Int = 0,
) {
    val total = spots.coerceAtLeast(1)
    val filled = taken.coerceIn(0, total)
    val own = mine.coerceIn(0, filled)
    if (total > MAX_SEGMENTS) {
        Box(
            modifier =
                modifier
                    .fillMaxWidth()
                    .height(8.dp)
                    .clip(RoundedCornerShape(3.dp))
                    .background(PantopusColors.appSurfaceSunken)
                    .border(1.dp, PantopusColors.appBorderStrong, RoundedCornerShape(3.dp))
                    .clearAndSetSemantics {},
        ) {
            Row(modifier = Modifier.fillMaxWidth()) {
                val othersFraction = (filled - own).toFloat() / total
                val ownFraction = own.toFloat() / total
                if (othersFraction > 0f) Box(Modifier.weight(othersFraction).height(8.dp).background(PantopusColors.success))
                if (ownFraction > 0f) Box(Modifier.weight(ownFraction).height(8.dp).background(PantopusColors.primary600))
                val rest = 1f - othersFraction - ownFraction
                if (rest > 0f) Box(Modifier.weight(rest).height(8.dp))
            }
        }
        return
    }
    Row(
        modifier = modifier.fillMaxWidth().clearAndSetSemantics {},
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        repeat(total) { index ->
            val color =
                when {
                    index < filled - own -> PantopusColors.success
                    index < filled -> PantopusColors.primary600
                    else -> null
                }
            Box(
                modifier =
                    Modifier
                        .weight(1f)
                        .height(8.dp)
                        .clip(RoundedCornerShape(3.dp))
                        .background(color ?: PantopusColors.appSurfaceSunken)
                        .then(
                            if (color == null) {
                                Modifier.border(
                                    1.dp,
                                    PantopusColors.appBorderStrong,
                                    RoundedCornerShape(3.dp),
                                )
                            } else {
                                Modifier
                            },
                        ),
            )
        }
    }
}

private const val MAX_SEGMENTS = 12

/** "5 going · 3 spots left" above the meter, with an optional right-hand note. */
@Composable
fun PlanSpotsCaption(
    going: String,
    left: String?,
    modifier: Modifier = Modifier,
    note: String? = null,
    noteMuted: Boolean = false,
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Text(
            text =
                buildString {
                    append(going)
                    if (!left.isNullOrBlank()) append(" · ").append(left)
                },
            style = PantopusTextStyle.small,
            color = PantopusColors.appText,
            modifier = Modifier.weight(1f),
        )
        if (!note.isNullOrBlank()) {
            Text(
                text = note,
                style = PantopusTextStyle.small,
                color = if (noteMuted) PantopusColors.appTextMuted else PantopusColors.appTextSecondary,
                textAlign = TextAlign.End,
            )
        }
    }
}

/** The tone of a [PlanBanner]. */
enum class PlanBannerTone { Ok, Neutral, Info, Warning }

/** A banner (board "banner"): an icon box, a bold line and a secondary line. */
@Composable
fun PlanBanner(
    title: String,
    subtitle: String?,
    icon: PantopusIcon,
    tone: PlanBannerTone,
    modifier: Modifier = Modifier,
) {
    val (bg, boxBg, boxFg) =
        when (tone) {
            PlanBannerTone.Ok -> Triple(PantopusColors.successBg, PantopusColors.success, PantopusColors.appTextInverse)
            PlanBannerTone.Neutral -> Triple(PantopusColors.appSurfaceSunken, PantopusColors.appSurface, PantopusColors.appTextStrong)
            PlanBannerTone.Info -> Triple(PantopusColors.infoBg, PantopusColors.primary600, PantopusColors.appTextInverse)
            PlanBannerTone.Warning -> Triple(PantopusColors.warningBg, Color.Transparent, PantopusColors.warning)
        }
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(bg)
                .padding(horizontal = 14.dp, vertical = Spacing.s3)
                .semantics(mergeDescendants = true) {},
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(34.dp)
                    .clip(RoundedCornerShape(11.dp))
                    .background(boxBg)
                    .then(
                        if (tone == PlanBannerTone.Neutral) {
                            Modifier.border(
                                1.dp,
                                PantopusColors.appBorder,
                                RoundedCornerShape(11.dp),
                            )
                        } else {
                            Modifier
                        },
                    ),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon = icon, contentDescription = null, size = 18.dp, tint = boxFg)
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(text = title, style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold), color = PantopusColors.appText)
            if (!subtitle.isNullOrBlank()) {
                Text(text = subtitle, style = PantopusTextStyle.small, color = PantopusColors.appTextSecondary)
            }
        }
    }
}

/** A sky note with a glyph (board "note"). */
@Composable
fun PlanNote(
    text: String,
    modifier: Modifier = Modifier,
    icon: PantopusIcon = PantopusIcon.ShieldCheck,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(14.dp))
                .background(PantopusColors.infoBg)
                .padding(horizontal = 14.dp, vertical = Spacing.s3)
                .semantics(mergeDescendants = true) {},
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        PantopusIconImage(
            icon = icon,
            contentDescription = null,
            size = 18.dp,
            tint = PantopusColors.primary700,
            modifier = Modifier.padding(top = 1.dp),
        )
        Text(text = text, style = PantopusTextStyle.small, color = PantopusColors.appTextStrong)
    }
}

/** A neutral well (board "well"). */
@Composable
fun PlanWell(
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    Box(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(14.dp))
                .background(PantopusColors.appSurfaceSunken)
                .padding(horizontal = 14.dp, vertical = Spacing.s3),
    ) { content() }
}

/** The tonal button (board "btn tonal"): a sunken fill. */
@Composable
fun PlanTonalButton(
    title: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icon: PantopusIcon? = null,
    height: Dp = 50.dp,
    enabled: Boolean = true,
    loading: Boolean = false,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .heightIn(min = height.coerceAtLeast(TOUCH_TARGET))
                .alpha(if (enabled) 1f else 0.5f)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurfaceSunken)
                .clickable(enabled = enabled && !loading, role = Role.Button, onClick = onClick)
                .padding(horizontal = Spacing.s3)
                .clearAndSetSemantics {
                    contentDescription = title
                    role = Role.Button
                },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2, Alignment.CenterHorizontally),
    ) {
        if (loading) {
            CircularProgressIndicator(strokeWidth = 2.dp, modifier = Modifier.size(18.dp), color = PantopusColors.appText)
        } else {
            if (icon != null) PantopusIconImage(icon = icon, contentDescription = null, size = 18.dp, tint = PantopusColors.appText)
            Text(text = title, style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold), color = PantopusColors.appText)
        }
    }
}

/** The text button (board "btn text"): no fill, link color, or the error ink for "Can't make it". */
@Composable
fun PlanTextButton(
    title: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    danger: Boolean = false,
    enabled: Boolean = true,
) {
    Box(
        modifier =
            modifier
                .fillMaxWidth()
                .heightIn(min = TOUCH_TARGET)
                .alpha(if (enabled) 1f else 0.5f)
                .clip(RoundedCornerShape(Radii.lg))
                .clickable(enabled = enabled, role = Role.Button, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = title,
            style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
            color = if (danger) PantopusColors.error else PantopusColors.primary700,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(horizontal = Spacing.s2),
        )
    }
}

/** The stacked button (board "btn stack"): glyph over a short label, 64 dp tall. */
@Composable
fun PlanStackButton(
    title: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icon: PantopusIcon? = null,
    leading: (@Composable () -> Unit)? = null,
) {
    Column(
        modifier =
            modifier
                .heightIn(min = 64.dp)
                .clip(RoundedCornerShape(14.dp))
                .background(PantopusColors.appSurfaceSunken)
                .clickable(role = Role.Button, onClick = onClick)
                .padding(horizontal = Spacing.s1, vertical = Spacing.s2)
                .clearAndSetSemantics {
                    contentDescription = title
                    role = Role.Button
                },
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s1, Alignment.CenterVertically),
    ) {
        when {
            leading != null -> leading()
            icon != null -> PantopusIconImage(icon = icon, contentDescription = null, size = 20.dp, tint = PantopusColors.appText)
        }
        Text(
            text = title,
            style = PantopusTextStyle.small.copy(fontSize = 13.sp, fontWeight = FontWeight.SemiBold),
            color = PantopusColors.appText,
            textAlign = TextAlign.Center,
        )
    }
}
