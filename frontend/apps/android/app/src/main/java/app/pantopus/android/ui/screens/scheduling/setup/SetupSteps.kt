@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "TooManyFunctions", "LongParameterList")

package app.pantopus.android.ui.screens.scheduling.setup

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentWidth
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import java.util.Locale

/** Live availability state of the slug-claim field. */
@Immutable
sealed interface SlugFieldUiState {
    data object Idle : SlugFieldUiState

    data object Checking : SlugFieldUiState

    data object Available : SlugFieldUiState

    data class Taken(val suggestions: List<String>) : SlugFieldUiState
}

/** Shared test tags for setup-wizard step content (mirror iOS identifiers). */
object SetupTags {
    const val HANDLE_FIELD = "wizardHandleField"
    const val SUGGESTION_PREFIX = "wizardSuggestion_"
    const val SUCCESS_COPY = "wizardSuccessCopy"
}

@Composable
fun SetupOverline(text: String) {
    Text(
        text = text.uppercase(Locale.US),
        color = PantopusColors.appTextSecondary,
        fontWeight = FontWeight.SemiBold,
        fontSize = 10.5.sp,
    )
}

/**
 * Numbered-disc progress rail with "You're on step N of M" overline.
 * Steps before [current] render a check; [current] is the active accent disc.
 *
 * [done] mirrors the design StepRail's explicit `done` list
 * (`isDone = done.includes(n) || n < current`) — success frames pass the full
 * set so every disc, including the current one, renders the check glyph.
 */
@Composable
fun WizardStepRail(
    steps: List<String>,
    current: Int,
    pillar: SchedulingPillar,
    modifier: Modifier = Modifier,
    done: Set<Int> = emptySet(),
) {
    Column(modifier = modifier.fillMaxWidth()) {
        Text(
            "You're on step $current of ${steps.size}".uppercase(Locale.US),
            color = PantopusColors.appTextSecondary,
            fontWeight = FontWeight.SemiBold,
            fontSize = 10.5.sp,
        )
        Spacer(Modifier.height(Spacing.s2))
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                    .padding(horizontal = Spacing.s3, vertical = Spacing.s2 + 2.dp),
            verticalAlignment = Alignment.Top,
        ) {
            steps.forEachIndexed { index, label ->
                val stepNumber = index + 1
                val isDone = stepNumber in done || stepNumber < current
                val active = stepNumber == current
                Column(
                    modifier = Modifier.wrapContentWidth(),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Box(
                        modifier =
                            Modifier
                                .size(22.dp)
                                .clip(CircleShape)
                                .background(if (isDone || active) pillar.accent else PantopusColors.appSurfaceSunken),
                        contentAlignment = Alignment.Center,
                    ) {
                        if (isDone) {
                            PantopusIconImage(
                                icon = PantopusIcon.Check,
                                contentDescription = null,
                                size = 11.dp,
                                tint = PantopusColors.appTextInverse,
                            )
                        } else {
                            Text(
                                stepNumber.toString(),
                                color = if (active) PantopusColors.appTextInverse else PantopusColors.appTextMuted,
                                fontWeight = FontWeight.Bold,
                                fontSize = 10.5.sp,
                            )
                        }
                    }
                    Spacer(Modifier.height(Spacing.s1))
                    Text(
                        label,
                        color =
                            when {
                                active -> pillar.accent
                                isDone -> PantopusColors.appTextStrong
                                else -> PantopusColors.appTextMuted
                            },
                        fontWeight = if (active) FontWeight.Bold else FontWeight.Medium,
                        fontSize = 9.5.sp,
                    )
                }
                if (index < steps.lastIndex) {
                    Box(
                        modifier =
                            Modifier
                                .weight(1f)
                                .padding(top = 10.dp, start = Spacing.s1, end = Spacing.s1)
                                .height(2.dp)
                                .background(if (stepNumber < current) pillar.accent else PantopusColors.appBorder),
                    )
                }
            }
        }
    }
}

/**
 * The slug-claim field shared by A2 (personal) and A6-business. Static
 * `pantopus.com/book/` prefix fused to an editable slug segment, with a live
 * availability status row below.
 */
@Composable
fun SlugClaimField(
    overline: String,
    slug: String,
    state: SlugFieldUiState,
    availableHint: String,
    onSlugChange: (String) -> Unit,
    onPickSuggestion: (String) -> Unit,
    pillar: SchedulingPillar,
    modifier: Modifier = Modifier,
) {
    val taken = state is SlugFieldUiState.Taken
    val borderColor = if (taken) PantopusColors.errorLight else PantopusColors.appBorder
    Column(modifier = modifier.fillMaxWidth()) {
        SetupOverline(overline)
        Spacer(Modifier.height(Spacing.s2))
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurface)
                    .border(1.5.dp, borderColor, RoundedCornerShape(Radii.md))
                    .padding(horizontal = 14.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            val mono = PantopusTextStyle.small.copy(fontFamily = FontFamily.Monospace)
            Text("pantopus.com/book/", style = mono, color = PantopusColors.appTextSecondary, maxLines = 1)
            BasicTextField(
                value = slug,
                onValueChange = { onSlugChange(it.lowercase(Locale.US).filter { c -> c.isLetterOrDigit() || c == '-' }) },
                singleLine = true,
                textStyle = mono.copy(color = PantopusColors.appText, fontWeight = FontWeight.SemiBold),
                keyboardOptions =
                    androidx.compose.foundation.text.KeyboardOptions(
                        capitalization = KeyboardCapitalization.None,
                        autoCorrect = false,
                        imeAction = ImeAction.Done,
                    ),
                modifier = Modifier.weight(1f).testTag(SetupTags.HANDLE_FIELD),
                decorationBox = { inner ->
                    if (slug.isEmpty()) {
                        Text("handle", style = mono, color = PantopusColors.appTextMuted)
                    }
                    inner()
                },
            )
            PantopusIconImage(
                icon = if (taken) PantopusIcon.AlertCircle else PantopusIcon.Pencil,
                contentDescription = null,
                size = 16.dp,
                tint = if (taken) PantopusColors.error else PantopusColors.appTextMuted,
            )
        }
        Spacer(Modifier.height(Spacing.s2 + 2.dp))
        when (state) {
            SlugFieldUiState.Idle -> Unit
            SlugFieldUiState.Checking ->
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    Shimmer(width = 92.dp, height = 22.dp, cornerRadius = Radii.pill)
                    Shimmer(width = 150.dp, height = 11.dp, cornerRadius = Radii.sm)
                }
            SlugFieldUiState.Available ->
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    Row(
                        modifier =
                            Modifier
                                .clip(RoundedCornerShape(Radii.pill))
                                .background(PantopusColors.successLight)
                                .padding(horizontal = 9.dp, vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
                    ) {
                        PantopusIconImage(icon = PantopusIcon.Check, contentDescription = null, size = 12.dp, tint = PantopusColors.success)
                        Text("Available", color = PantopusColors.success, fontWeight = FontWeight.Bold, fontSize = 11.5.sp)
                    }
                    Text(availableHint, color = PantopusColors.appTextSecondary, fontSize = 11.5.sp)
                }
            is SlugFieldUiState.Taken ->
                Column {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                        PantopusIconImage(
                            icon = PantopusIcon.AlertCircle,
                            contentDescription = null,
                            size = 13.dp,
                            tint = PantopusColors.error,
                        )
                        Text("That link is taken", color = PantopusColors.error, fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
                    }
                    if (state.suggestions.isNotEmpty()) {
                        Spacer(Modifier.height(Spacing.s2))
                        Text("Try one of these:", color = PantopusColors.appTextSecondary, fontSize = 11.sp)
                        Spacer(Modifier.height(Spacing.s1))
                        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                            state.suggestions.take(3).forEach { suggestion ->
                                Row(
                                    modifier =
                                        Modifier
                                            .clip(RoundedCornerShape(Radii.pill))
                                            .background(pillar.accentBg)
                                            .clickable { onPickSuggestion(suggestion) }
                                            .padding(horizontal = 11.dp, vertical = 7.dp)
                                            .testTag("${SetupTags.SUGGESTION_PREFIX}$suggestion"),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
                                ) {
                                    Text(
                                        suggestion,
                                        style = PantopusTextStyle.small.copy(fontFamily = FontFamily.Monospace),
                                        color = pillar.accent,
                                        fontWeight = FontWeight.SemiBold,
                                    )
                                    PantopusIconImage(
                                        icon = PantopusIcon.ArrowUpRight,
                                        contentDescription = null,
                                        size = 12.dp,
                                        tint = pillar.accent,
                                    )
                                }
                            }
                        }
                    }
                }
        }
    }
}

/** Pillar identity chip prepended to onboarding flows (house/briefcase + label). */
@Composable
fun SetupPillarChip(
    pillar: SchedulingPillar,
    label: String,
) {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(pillar.accentBg)
                .padding(horizontal = 10.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(
            icon = if (pillar == SchedulingPillar.Home) PantopusIcon.Home else PantopusIcon.Briefcase,
            contentDescription = null,
            size = 12.dp,
            tint = pillar.accent,
        )
        Text(label.uppercase(Locale.US), color = pillar.accent, fontWeight = FontWeight.Bold, fontSize = 10.5.sp)
    }
}

/** Live-link copy card shown on a wizard success step. */
@Composable
fun WizardSuccessLinkCard(
    link: String,
    pillar: SchedulingPillar,
    onCopy: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PantopusIconImage(icon = PantopusIcon.Link, contentDescription = null, size = 16.dp, tint = pillar.accent)
        Spacer(Modifier.width(Spacing.s2))
        Text(
            buildAnnotatedString { withStyle(SpanStyle(fontFamily = FontFamily.Monospace)) { append(link) } },
            style = PantopusTextStyle.small,
            color = PantopusColors.appText,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f),
        )
        Row(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.md))
                    .background(pillar.accentBg)
                    .clickable(onClick = onCopy)
                    .padding(horizontal = 11.dp, vertical = 7.dp)
                    .testTag(SetupTags.SUCCESS_COPY),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            PantopusIconImage(icon = PantopusIcon.Copy, contentDescription = null, size = 13.dp, tint = pillar.accent)
            Text("Copy", color = pillar.accent, fontWeight = FontWeight.Bold, fontSize = 12.sp)
        }
    }
}
