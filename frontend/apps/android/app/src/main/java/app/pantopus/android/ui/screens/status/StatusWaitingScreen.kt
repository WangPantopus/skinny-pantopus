@file:Suppress("PackageNaming", "LongMethod", "LongParameterList", "MagicNumber", "TooManyFunctions")

package app.pantopus.android.ui.screens.status

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.components.HaloCircle
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import app.pantopus.android.ui.theme.rememberReduceMotion

/**
 * A18 Status / waiting — pure presentational. Caller builds a
 * [StatusWaitingContent] and passes it in along with action handlers.
 * Canonical design frames are exposed as factories on [StatusWaitingContent].
 *
 * P8.5 swapped the ad-hoc illustration disc for the [HaloCircle] primitive
 * and added the status-pill tones, address chip, date-bearing timeline, and
 * in-body button stack the A18.1/.2/.3 frames need.
 */
@Composable
fun StatusWaitingScreen(
    content: StatusWaitingContent,
    onAction: (StatusActionCard) -> Unit = {},
    onStackAction: (StatusActionButton) -> Unit = {},
    onPrimary: (StatusCta) -> Unit = {},
    onSecondary: (StatusCta) -> Unit = {},
    modifier: Modifier = Modifier,
    primaryTestTag: String = "statusPrimaryCta",
    secondaryTestTag: String = "statusSecondaryCta",
    rootTestTag: String = "statusWaiting",
) {
    Column(
        modifier =
            modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .testTag(rootTestTag),
    ) {
        Column(
            modifier =
                Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(Spacing.s4),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(Spacing.s5),
        ) {
            StatusBody(content = content, onAction = onAction, onStackAction = onStackAction)
            Spacer(modifier = Modifier.height(Spacing.s6))
        }
        BottomChrome(
            content = content,
            onPrimary = onPrimary,
            onSecondary = onSecondary,
            primaryTestTag = primaryTestTag,
            secondaryTestTag = secondaryTestTag,
        )
    }
}

/**
 * Status / waiting body used INSIDE another scaffold (e.g. the Homes
 * wizards' success step). Renders the centred body minus the bottom
 * chrome — the wizard's own sticky CTA row replaces it.
 */
@Composable
fun StatusWaitingBody(
    content: StatusWaitingContent,
    onAction: (StatusActionCard) -> Unit = {},
    onStackAction: (StatusActionButton) -> Unit = {},
) {
    Column(
        modifier = Modifier.fillMaxWidth().testTag("statusWaitingBody"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s5),
    ) {
        StatusBody(content = content, onAction = onAction, onStackAction = onStackAction)
    }
}

@Composable
private fun StatusBody(
    content: StatusWaitingContent,
    onAction: (StatusActionCard) -> Unit,
    onStackAction: (StatusActionButton) -> Unit,
) {
    HaloCircle(tone = content.halo.tone, icon = content.halo.icon, isPulsing = content.halo.isPulsing)
    HeadlineBlock(content)
    content.addressChip?.let { AddressChip(it) }
    if (content.timeline.isNotEmpty()) {
        StatusTimeline(stages = content.timeline, currentStageId = content.currentStageId)
    }
    content.statusPill?.let { StatusPillView(it) }
    if (content.actionStack.isNotEmpty()) {
        ActionStack(buttons = content.actionStack, onStackAction = onStackAction)
    }
    if (content.actionCards.isNotEmpty()) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
            content.actionCards.forEach { card -> ActionCard(card = card, onTap = { onAction(card) }) }
        }
    }
    if (content.explainerBullets.isNotEmpty()) {
        ExplainerBlock(content.explainerBullets)
    }
}

@Composable
private fun HeadlineBlock(content: StatusWaitingContent) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Text(
            text = content.headline,
            fontSize = 24.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
            textAlign = TextAlign.Center,
            modifier = Modifier.semantics { heading() }.testTag("statusHeadline"),
        )
        Text(
            text = emphasizedBody(content.subcopy, content.bodyEmphasis),
            fontSize = 14.sp,
            color = PantopusColors.appTextSecondary,
            textAlign = TextAlign.Center,
            modifier = Modifier.widthIn(max = 300.dp).testTag("statusSubcopy"),
        )
    }
}

/** Body copy with the optional [emphasis] fragment rendered bold. */
private fun emphasizedBody(
    text: String,
    emphasis: String?,
): AnnotatedString =
    buildAnnotatedString {
        val start = emphasis?.takeIf { it.isNotEmpty() }?.let { text.indexOf(it) } ?: -1
        if (start < 0 || emphasis == null) {
            append(text)
            return@buildAnnotatedString
        }
        append(text.substring(0, start))
        withStyle(SpanStyle(fontWeight = FontWeight.Bold, color = PantopusColors.appText)) {
            append(emphasis)
        }
        append(text.substring(start + emphasis.length))
    }

@Composable
private fun AddressChip(text: String) {
    Row(
        modifier =
            Modifier
                .widthIn(max = 300.dp)
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.appSurfaceMuted)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.pill))
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                .testTag("statusAddressChip"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Home,
            contentDescription = null,
            size = 13.dp,
            strokeWidth = 2.2f,
            tint = PantopusColors.primary600,
        )
        Text(
            text = text,
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

private data class PillPalette(val bg: Color, val fg: Color, val border: Color)

@Composable
internal fun StatusPillView(pill: StatusWaitingPill) {
    val palette =
        when (pill.tone) {
            StatusPillTone.Neutral ->
                PillPalette(PantopusColors.appSurfaceMuted, PantopusColors.appTextSecondary, PantopusColors.appBorder)
            StatusPillTone.Success ->
                PillPalette(PantopusColors.successBg, PantopusColors.success, PantopusColors.success.copy(alpha = 0.25f))
            StatusPillTone.Warning ->
                PillPalette(PantopusColors.warningBg, PantopusColors.warning, PantopusColors.warning.copy(alpha = 0.2f))
            StatusPillTone.Primary ->
                PillPalette(PantopusColors.primary50, PantopusColors.primary700, PantopusColors.primary100)
        }
    val reduceMotion = rememberReduceMotion()
    val spinning = pill.isSpinning && !reduceMotion
    val rotation =
        if (spinning) {
            val transition = rememberInfiniteTransition(label = "pillSpin")
            transition.animateFloat(
                initialValue = 0f,
                targetValue = 360f,
                animationSpec =
                    infiniteRepeatable(
                        animation = tween(durationMillis = 4000, easing = LinearEasing),
                        repeatMode = RepeatMode.Restart,
                    ),
                label = "pillSpinPhase",
            ).value
        } else {
            0f
        }
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(palette.bg)
                .border(1.dp, palette.border, RoundedCornerShape(Radii.pill))
                .padding(horizontal = Spacing.s3, vertical = 6.dp)
                .testTag("statusPill"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        pill.icon?.let { icon ->
            PantopusIconImage(
                icon = icon,
                contentDescription = null,
                size = 12.dp,
                strokeWidth = 2.2f,
                tint = palette.fg,
                modifier = Modifier.rotate(rotation),
            )
        }
        Text(text = pill.text, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = palette.fg)
    }
}

@Composable
private fun ActionStack(
    buttons: List<StatusActionButton>,
    onStackAction: (StatusActionButton) -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth().testTag("statusActionStack"),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        buttons.forEach { button -> StackButton(button = button, onTap = { onStackAction(button) }) }
    }
}

@Composable
private fun StackButton(
    button: StatusActionButton,
    onTap: () -> Unit,
) {
    val tag = Modifier.testTag("statusStackButton_${button.id}")
    when (button.style) {
        StatusActionButtonStyle.Primary ->
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .height(50.dp)
                        .clip(RoundedCornerShape(Radii.lg))
                        .background(PantopusColors.primary600)
                        .clickable(enabled = !button.isDisabled, onClick = onTap)
                        .then(tag),
                contentAlignment = Alignment.Center,
            ) { ButtonContent(button, PantopusColors.appTextInverse, 14.5f) }
        StatusActionButtonStyle.Outline -> {
            val textColor = if (button.isDisabled) PantopusColors.appTextMuted else PantopusColors.appText
            val bg = if (button.isDisabled) PantopusColors.appSurfaceSunken else PantopusColors.appSurface
            val borderColor = if (button.isDisabled) PantopusColors.appBorder else PantopusColors.appBorderStrong
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .height(46.dp)
                        .clip(RoundedCornerShape(Radii.lg))
                        .background(bg)
                        .border(1.dp, borderColor, RoundedCornerShape(Radii.lg))
                        .clickable(enabled = !button.isDisabled, onClick = onTap)
                        .then(tag),
                contentAlignment = Alignment.Center,
            ) { ButtonContent(button, textColor, 14f) }
        }
        StatusActionButtonStyle.Underline ->
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .height(36.dp)
                        .clickable(enabled = !button.isDisabled, onClick = onTap)
                        .then(tag),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = button.label,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.primary600,
                    textDecoration = TextDecoration.Underline,
                )
            }
    }
}

@Composable
private fun ButtonContent(
    button: StatusActionButton,
    textColor: Color,
    fontSize: Float,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(7.dp),
    ) {
        button.icon?.let { icon ->
            PantopusIconImage(
                icon = icon,
                contentDescription = null,
                size = 14.dp,
                strokeWidth = 2.2f,
                tint = textColor,
            )
        }
        Text(text = button.label, fontSize = fontSize.sp, fontWeight = FontWeight.Bold, color = textColor)
    }
}

@Composable
private fun ActionCard(
    card: StatusActionCard,
    onTap: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .clickable(onClick = onTap)
                .padding(Spacing.s3)
                .testTag("statusActionCard_${card.id}"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier = Modifier.size(36.dp).clip(CircleShape).background(PantopusColors.primary50),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = card.icon,
                contentDescription = null,
                size = 18.dp,
                strokeWidth = 2f,
                tint = PantopusColors.primary600,
            )
        }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(text = card.title, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
            card.subtitle?.let {
                Text(text = it, fontSize = 12.sp, color = PantopusColors.appTextSecondary)
            }
        }
        PantopusIconImage(
            icon = PantopusIcon.ChevronRight,
            contentDescription = null,
            size = Radii.xl,
            strokeWidth = 2f,
            tint = PantopusColors.appTextSecondary,
        )
    }
}

@Composable
private fun ExplainerBlock(bullets: List<String>) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .padding(14.dp)
                .testTag("statusExplainer"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Text(
            text = "WHAT HAPPENS NEXT",
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appTextSecondary,
            letterSpacing = 0.6.sp,
        )
        bullets.forEach { bullet ->
            Row(
                verticalAlignment = Alignment.Top,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Check,
                    contentDescription = null,
                    size = 14.dp,
                    strokeWidth = 2.4f,
                    tint = PantopusColors.success,
                    modifier = Modifier.padding(top = 2.dp),
                )
                Text(text = bullet, fontSize = 13.sp, color = PantopusColors.appText)
            }
        }
    }
}

// ── Bottom chrome (footer OR sticky dock) ─────────────────────────────────

@Composable
private fun BottomChrome(
    content: StatusWaitingContent,
    onPrimary: (StatusCta) -> Unit,
    onSecondary: (StatusCta) -> Unit,
    primaryTestTag: String,
    secondaryTestTag: String,
) {
    when {
        content.actionStack.isNotEmpty() -> content.footnote?.let { FootnoteFooter(it) }
        content.primaryCta != null || content.secondaryCta != null ->
            StickyDock(
                primary = content.primaryCta,
                secondary = content.secondaryCta,
                onPrimary = onPrimary,
                onSecondary = onSecondary,
                primaryTestTag = primaryTestTag,
                secondaryTestTag = secondaryTestTag,
            )
    }
}

@Composable
private fun FootnoteFooter(text: String) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurface)
                .padding(horizontal = Spacing.s4)
                .padding(top = Spacing.s2, bottom = Spacing.s6)
                .testTag("statusFootnote"),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Info,
            contentDescription = null,
            size = 11.dp,
            strokeWidth = 2.2f,
            tint = PantopusColors.appTextSecondary,
            modifier = Modifier.padding(end = Spacing.s2),
        )
        Text(
            text = text,
            fontSize = 11.sp,
            fontWeight = FontWeight.Medium,
            color = PantopusColors.appTextSecondary,
            textAlign = TextAlign.Center,
        )
    }
}

@Composable
private fun StickyDock(
    primary: StatusCta?,
    secondary: StatusCta?,
    onPrimary: (StatusCta) -> Unit,
    onSecondary: (StatusCta) -> Unit,
    primaryTestTag: String,
    secondaryTestTag: String,
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorder))
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .background(PantopusColors.appSurface)
                    .padding(horizontal = Spacing.s4)
                    .padding(top = Spacing.s3, bottom = Spacing.s6),
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            primary?.let { cta -> DockPrimaryButton(cta, { onPrimary(cta) }, primaryTestTag) }
            secondary?.let { cta -> DockSecondaryButton(cta, { onSecondary(cta) }, secondaryTestTag) }
        }
    }
}

@Composable
private fun DockPrimaryButton(
    cta: StatusCta,
    onClick: () -> Unit,
    testTag: String,
) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(50.dp)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.primary600)
                .clickable(onClick = onClick)
                .testTag(testTag),
        contentAlignment = Alignment.Center,
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(7.dp),
        ) {
            cta.icon?.let { icon ->
                PantopusIconImage(
                    icon = icon,
                    contentDescription = null,
                    size = 15.dp,
                    strokeWidth = 2.4f,
                    tint = PantopusColors.appTextInverse,
                )
            }
            Text(
                text = cta.label,
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appTextInverse,
            )
        }
    }
}

@Composable
private fun DockSecondaryButton(
    cta: StatusCta,
    onClick: () -> Unit,
    testTag: String,
) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(44.dp)
                .clickable(onClick = onClick)
                .testTag(testTag),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = cta.label,
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appTextSecondary,
        )
    }
}

// ── Timeline (dots + dates + connecting line) ─────────────────────────────

/**
 * Status timeline. [paused] (A18.4) recolors the active node/segment to
 * warning and swaps the pulsing current dot for an `alert-circle` (review
 * paused / action needed). Internal so the A18.4 waiting room can reuse it.
 */
@Composable
internal fun StatusTimeline(
    stages: List<StatusTimelineStage>,
    currentStageId: String?,
    paused: Boolean = false,
    modifier: Modifier = Modifier.testTag("statusTimeline"),
) {
    val states = resolveStates(stages, currentStageId)
    val allDone = states.isNotEmpty() && states.all { it == StatusStepState.Done }
    val lastActive =
        states.indexOfLast { it == StatusStepState.Done || it == StatusStepState.Current }.coerceAtLeast(0)
    val filledSegments = if (allDone) (stages.size - 1).coerceAtLeast(0) else lastActive
    val activeColor = if (paused) PantopusColors.warning else PantopusColors.primary600
    val lineColor = if (allDone) PantopusColors.success else activeColor

    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .padding(horizontal = Spacing.s2, vertical = Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            stages.forEachIndexed { index, _ ->
                TimelineDot(state = states[index], paused = paused)
                if (index != stages.lastIndex) {
                    Box(
                        modifier =
                            Modifier
                                .weight(1f)
                                .height(2.dp)
                                .background(if (index < filledSegments) lineColor else PantopusColors.appBorder),
                    )
                }
            }
        }
        Row(modifier = Modifier.fillMaxWidth()) {
            stages.forEachIndexed { index, stage ->
                TimelineLabel(
                    stage = stage,
                    pending = states[index] == StatusStepState.Pending,
                    subWarning = paused && states[index] == StatusStepState.Current,
                    horizontalAlignment =
                        when (index) {
                            0 -> Alignment.Start
                            stages.lastIndex -> Alignment.End
                            else -> Alignment.CenterHorizontally
                        },
                    modifier = Modifier.weight(1f),
                )
            }
        }
    }
}

@Composable
private fun TimelineLabel(
    stage: StatusTimelineStage,
    pending: Boolean,
    horizontalAlignment: Alignment.Horizontal,
    modifier: Modifier = Modifier,
    subWarning: Boolean = false,
) {
    Column(
        modifier = modifier,
        horizontalAlignment = horizontalAlignment,
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        Text(
            text = stage.label,
            fontSize = 11.sp,
            fontWeight = if (pending) FontWeight.Medium else FontWeight.Bold,
            color = if (pending) PantopusColors.appTextSecondary else PantopusColors.appText,
        )
        stage.sub?.let {
            Text(
                text = it,
                fontSize = 10.sp,
                color = if (subWarning) PantopusColors.warning else PantopusColors.appTextSecondary,
            )
        }
    }
}

/** Per-stage state: explicit override, else derived from [currentStageId]. */
private fun resolveStates(
    stages: List<StatusTimelineStage>,
    currentStageId: String?,
): List<StatusStepState> {
    if (stages.any { it.state != null }) {
        return stages.map { it.state ?: StatusStepState.Pending }
    }
    val currentIndex = stages.indexOfFirst { it.id == currentStageId }.coerceAtLeast(0)
    return stages.indices.map { index ->
        when {
            index < currentIndex -> StatusStepState.Done
            index == currentIndex -> StatusStepState.Current
            else -> StatusStepState.Pending
        }
    }
}

@Composable
private fun TimelineDot(
    state: StatusStepState,
    paused: Boolean = false,
) {
    val reduceMotion = rememberReduceMotion()
    // Paused current dots no longer pulse — the alert glyph is static.
    val pulse = state == StatusStepState.Current && !paused && !reduceMotion
    val phase = rememberTimelineDotPhase(pulse)
    val palette = timelineDotPalette(state, paused)
    Box(modifier = Modifier.size(38.dp), contentAlignment = Alignment.Center) {
        if (state != StatusStepState.Pending) {
            Box(
                modifier =
                    Modifier
                        .size(38.dp)
                        .clip(CircleShape)
                        .background(palette.halo),
            )
        }
        Box(
            modifier =
                Modifier
                    .size(30.dp)
                    .clip(CircleShape)
                    .background(palette.fill)
                    .then(timelineDotBorder(state)),
            contentAlignment = Alignment.Center,
        ) {
            TimelineDotGlyph(state = state, paused = paused, phase = phase)
        }
    }
}

@Composable
private fun rememberTimelineDotPhase(pulse: Boolean): Float {
    if (!pulse) return 0f

    val transition = rememberInfiniteTransition(label = "dotPulse")
    return transition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec =
            infiniteRepeatable(
                animation = tween(durationMillis = 1600, easing = LinearEasing),
                repeatMode = RepeatMode.Reverse,
            ),
        label = "dotPulsePhase",
    ).value
}

private data class TimelineDotPalette(
    val halo: Color,
    val fill: Color,
)

private fun timelineDotPalette(
    state: StatusStepState,
    paused: Boolean,
): TimelineDotPalette =
    when (state) {
        StatusStepState.Done ->
            TimelineDotPalette(
                halo = PantopusColors.successBg,
                fill = PantopusColors.success,
            )
        StatusStepState.Current ->
            TimelineDotPalette(
                halo = if (paused) PantopusColors.warningBg else PantopusColors.primary50,
                fill = if (paused) PantopusColors.warning else PantopusColors.primary600,
            )
        StatusStepState.Pending ->
            TimelineDotPalette(
                halo = PantopusColors.appSurface,
                fill = PantopusColors.appSurface,
            )
    }

private fun timelineDotBorder(state: StatusStepState): Modifier =
    if (state == StatusStepState.Pending) {
        Modifier.border(1.5.dp, PantopusColors.appBorderStrong, CircleShape)
    } else {
        Modifier
    }

@Composable
private fun TimelineDotGlyph(
    state: StatusStepState,
    paused: Boolean,
    phase: Float,
) {
    when {
        state == StatusStepState.Done ->
            PantopusIconImage(
                icon = PantopusIcon.Check,
                contentDescription = null,
                size = 14.dp,
                strokeWidth = 3f,
                tint = PantopusColors.appTextInverse,
            )
        state == StatusStepState.Current && paused ->
            PantopusIconImage(
                icon = PantopusIcon.AlertCircle,
                contentDescription = null,
                size = 16.dp,
                strokeWidth = 2.6f,
                tint = PantopusColors.appTextInverse,
            )
        state == StatusStepState.Current ->
            Box(
                modifier =
                    Modifier
                        .size(8.dp)
                        .scale(1f - 0.3f * phase)
                        .alpha(1f - 0.5f * phase)
                        .clip(CircleShape)
                        .background(PantopusColors.appTextInverse),
            )
    }
}
