@file:Suppress("PackageNaming", "TooManyFunctions", "LongMethod", "MagicNumber", "LongParameterList")

package app.pantopus.android.ui.screens.scheduling.findatime

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingRoutes
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

const val FIND_A_TIME_SETUP_TAG = "findATimeSetupScreen"

/**
 * F4 Find a Time — Setup. The household composes a coordination request from
 * everyone's *personal* availability; "Next" hands the criteria to F5 (the
 * arg-less route pair shares state via [FindATimeSession]).
 */
@Composable
fun FindATimeSetupScreen(
    onBack: () -> Unit = {},
    onNavigate: (String) -> Unit = {},
    viewModel: FindATimeSetupViewModel = hiltViewModel(),
) {
    LaunchedEffect(Unit) { viewModel.start() }
    val state by viewModel.state.collectAsStateWithLifecycle()

    FindATimeSetupContent(
        state = state,
        onBack = onBack,
        onNext = { if (viewModel.submit()) onNavigate(SchedulingRoutes.FIND_A_TIME_SLOTS) },
        onRetry = viewModel::load,
        onTitle = viewModel::setTitle,
        onToggleRequired = viewModel::toggleRequired,
        onMode = viewModel::setMode,
        onDuration = viewModel::setDuration,
        onAdjustCustom = viewModel::adjustCustomDuration,
        onWindow = viewModel::setWindow,
        onToggleExplainer = viewModel::toggleExplainer,
        onMakeOptional = viewModel::makeSomeoneOptional,
        onWidenWindow = viewModel::widenWindow,
    )
}

@Composable
fun FindATimeSetupContent(
    state: FindATimeSetupUiState,
    onBack: () -> Unit,
    onNext: () -> Unit,
    onRetry: () -> Unit,
    onTitle: (String) -> Unit,
    onToggleRequired: (String, Boolean) -> Unit,
    onMode: (FindMode) -> Unit,
    onDuration: (DurationChoice) -> Unit,
    onAdjustCustom: (Int) -> Unit,
    onWindow: (WindowPreset) -> Unit,
    onToggleExplainer: () -> Unit,
    onMakeOptional: () -> Unit = {},
    onWidenWindow: () -> Unit = {},
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.fillMaxSize().background(PantopusColors.appBg).testTag(FIND_A_TIME_SETUP_TAG)) {
        val canNext = (state as? FindATimeSetupUiState.Loaded)?.form?.canNext == true
        FtTopBar(
            title = "Find a time",
            onBack = onBack,
            trailingText = "Next",
            trailingEnabled = canNext,
            onTrailing = onNext,
        )
        when (state) {
            is FindATimeSetupUiState.Loading -> SetupSkeleton()
            is FindATimeSetupUiState.Error -> ErrorState(message = state.message, onRetry = onRetry)
            is FindATimeSetupUiState.Loaded ->
                SetupFormBody(
                    form = state.form,
                    onTitle = onTitle,
                    onToggleRequired = onToggleRequired,
                    onMode = onMode,
                    onDuration = onDuration,
                    onAdjustCustom = onAdjustCustom,
                    onWindow = onWindow,
                    onToggleExplainer = onToggleExplainer,
                    onMakeOptional = onMakeOptional,
                    onWidenWindow = onWidenWindow,
                )
        }
    }
}

@Composable
private fun SetupFormBody(
    form: SetupForm,
    onTitle: (String) -> Unit,
    onToggleRequired: (String, Boolean) -> Unit,
    onMode: (FindMode) -> Unit,
    onDuration: (DurationChoice) -> Unit,
    onAdjustCustom: (Int) -> Unit,
    onWindow: (WindowPreset) -> Unit,
    onToggleExplainer: () -> Unit,
    onMakeOptional: () -> Unit = {},
    onWidenWindow: () -> Unit = {},
) {
    // Round-robin rule is a display-only choice (mirrors iOS — not sent to the
    // backend), so it lives as screen-local UI state rather than on the VM form.
    var roundRobinRule by remember { mutableStateOf(0) }
    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        // F4 FrameNoOverlap: amber warning banner when F5 found no overlapping time.
        if (form.noOverlapMessage != null) {
            FtBanner(
                tone = FtBannerTone.Warning,
                icon = PantopusIcon.AlertTriangle,
                title = "No time works for all ${form.members.count { it.required }}",
                body = form.noOverlapMessage,
            )
        }

        Explainer(expanded = form.explainerExpanded, onToggle = onToggleExplainer)

        FtCard {
            FieldLabel("Title")
            FtTextField(value = form.title, placeholder = form.titlePlaceholder, onValueChange = onTitle)
            FieldLabel("Category", top = Spacing.s3)
            FtChip(label = "Family", leadingDot = PantopusColors.business, bg = HomeAccentBg, fg = HomeAccentDark)
        }

        FtCard {
            FtOverline("Who's needed")
            Column(modifier = Modifier.padding(top = Spacing.s2)) {
                form.members.forEachIndexed { i, m ->
                    WhoRow(
                        member = m,
                        invalid = !form.hasRequired,
                        last = i == form.members.lastIndex,
                        onToggle = { req -> onToggleRequired(m.userId, req) },
                    )
                }
            }
            if (!form.hasRequired) {
                ValidationLine("Mark at least one member as required")
            }
            // No-overlap quick fix: "Make … optional" inline button (FrameNoOverlap).
            if (form.noOverlapMessage != null) {
                Box(modifier = Modifier.padding(top = Spacing.s2)) {
                    FtSecondaryButton(
                        label = "Make someone optional",
                        icon = PantopusIcon.UserMinus,
                        tint = HomeAccentDark,
                        onClick = onMakeOptional,
                    )
                }
            }
        }

        FtCard {
            FtOverline("How it works")
            Box(modifier = Modifier.padding(top = Spacing.s2)) {
                ModeTiles(mode = form.mode, onMode = onMode)
            }
            Text(
                text =
                    if (form.mode == FindMode.Collective) {
                        "Finds times when everyone required is free at once."
                    } else {
                        "Whoever's free gets it. Pick a rule for who covers."
                    },
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
                modifier = Modifier.padding(top = Spacing.s2),
            )
        }

        if (form.mode == FindMode.RoundRobin) {
            FtCard {
                FtOverline("Round-robin rule")
                Box(modifier = Modifier.padding(top = Spacing.s2)) {
                    FtSegmented(
                        options = listOf("Fair rotation", "By role"),
                        selectedIndex = roundRobinRule,
                        onSelect = { roundRobinRule = it },
                    )
                }
            }
        }

        FtCard {
            FtOverline("Duration")
            Box(modifier = Modifier.padding(top = Spacing.s2)) {
                FtSegmented(
                    options = listOf("30 min", "1 hr", "Custom"),
                    selectedIndex = form.durationChoice.ordinal,
                    onSelect = { onDuration(DurationChoice.entries[it]) },
                )
            }
            if (form.durationChoice == DurationChoice.Custom) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(top = Spacing.s3),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = "Length",
                        style = PantopusTextStyle.caption,
                        fontWeight = FontWeight.SemiBold,
                        color = PantopusColors.appTextStrong,
                        modifier = Modifier.weight(1f),
                    )
                    Stepper(
                        valueLabel = FindATimeFormat.durationLabel(form.customDurationMin),
                        onMinus = { onAdjustCustom(-15) },
                        onPlus = { onAdjustCustom(15) },
                    )
                }
            }
        }

        FtCard {
            FtOverline("Date window")
            Box(modifier = Modifier.padding(top = Spacing.s2)) {
                DateWindow(form = form, onWindow = onWindow)
            }
            if (!form.rangeValid) {
                ValidationLine("End date is before the start date")
            }
            // No-overlap quick fix: "Widen to two weeks" inline button (FrameNoOverlap).
            if (form.noOverlapMessage != null) {
                Box(modifier = Modifier.padding(top = Spacing.s2)) {
                    FtSecondaryButton(
                        label = "Widen to two weeks",
                        icon = PantopusIcon.CalendarPlus,
                        tint = HomeAccentDark,
                        onClick = onWidenWindow,
                    )
                }
            }
        }
    }
}

// ─── Explainer ──────────────────────────────────────────────────────────────

@Composable
private fun Explainer(
    expanded: Boolean,
    onToggle: () -> Unit,
) {
    val bullets =
        listOf(
            // Spec/iOS use a 'layers' glyph for the overlay step; the Android icon set has no
            // dedicated layers mark, so the overlapping-grid glyph carries the same "compose
            // everyone's grids" intent.
            PantopusIcon.UserCheck to "Each member sets their own free/busy hours in Personal.",
            PantopusIcon.Grid3x3 to "Pantopus overlays everyone you pick and keeps only the shared free time.",
            PantopusIcon.Lock to "No one's calendar is edited. Booking a slot adds one new event.",
        )
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.infoBg)
                .border(1.dp, PantopusColors.infoLight, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s3),
    ) {
        Row {
            PantopusIconImage(
                icon = PantopusIcon.Info,
                contentDescription = null,
                size = 15.dp,
                tint = PantopusColors.info,
                modifier = Modifier.padding(end = Spacing.s2, top = 1.dp),
            )
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text =
                        "Times come from each member's personal availability. " +
                            "Pantopus finds the overlap — it never changes anyone's calendar.",
                    style = PantopusTextStyle.caption,
                    // Spec colours the primary explainer line primary-800 at weight 500.
                    color = PantopusColors.primary800,
                    fontWeight = FontWeight.Medium,
                )
                if (expanded) {
                    Column(modifier = Modifier.padding(top = Spacing.s2), verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                        bullets.forEach { (ic, tx) ->
                            Row {
                                PantopusIconImage(
                                    icon = ic,
                                    contentDescription = null,
                                    size = 13.dp,
                                    tint = PantopusColors.info,
                                    modifier = Modifier.padding(end = Spacing.s2, top = 1.dp),
                                )
                                Text(text = tx, style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
                            }
                        }
                    }
                }
                Row(
                    modifier = Modifier.padding(top = Spacing.s2).clickable(onClickLabel = "How this works", onClick = onToggle),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = if (expanded) "Hide" else "How this works",
                        style = PantopusTextStyle.caption,
                        fontWeight = FontWeight.Bold,
                        color = PantopusColors.info,
                    )
                    PantopusIconImage(
                        icon = if (expanded) PantopusIcon.ChevronUp else PantopusIcon.ChevronDown,
                        contentDescription = null,
                        size = 12.dp,
                        tint = PantopusColors.info,
                        modifier = Modifier.padding(start = Spacing.s1),
                    )
                }
            }
        }
    }
}

// ─── Who's needed ─────────────────────────────────────────────────────────────

@Composable
private fun WhoRow(
    member: FindMember,
    invalid: Boolean,
    last: Boolean,
    onToggle: (Boolean) -> Unit,
) {
    Column {
        Row(
            modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            FtAvatar(member = member, size = 32.dp, checked = member.required)
            Text(
                text = member.name,
                style = PantopusTextStyle.small,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                modifier = Modifier.weight(1f).padding(start = Spacing.s3),
            )
            ReqOptToggle(required = member.required, invalid = invalid, onToggle = onToggle)
        }
        if (!last) {
            HorizontalDivider(thickness = 1.dp, color = PantopusColors.appBorderSubtle)
        }
    }
}

@Composable
private fun ReqOptToggle(
    required: Boolean,
    invalid: Boolean,
    onToggle: (Boolean) -> Unit,
) {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.md))
                .background(if (invalid) PantopusColors.errorBg else PantopusColors.appSurfaceSunken)
                .padding(3.dp),
        horizontalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        listOf(true to "Required", false to "Optional").forEach { (isReq, label) ->
            val on = isReq == required
            val bg =
                when {
                    on && isReq -> HomeAccent
                    on -> PantopusColors.appSurface
                    else -> Color.Transparent
                }
            val fg =
                when {
                    on && isReq -> PantopusColors.appTextInverse
                    on -> PantopusColors.appTextStrong
                    else -> PantopusColors.appTextMuted
                }
            Box(
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.sm))
                        .background(bg)
                        .clickable(onClickLabel = label) { onToggle(isReq) }
                        .padding(horizontal = Spacing.s2, vertical = Spacing.s1),
            ) {
                Text(
                    text = label,
                    style = PantopusTextStyle.caption,
                    fontWeight = if (on) FontWeight.Bold else FontWeight.SemiBold,
                    color = fg,
                )
            }
        }
    }
}

// ─── Mode tiles ───────────────────────────────────────────────────────────────

@Composable
private fun ModeTiles(
    mode: FindMode,
    onMode: (FindMode) -> Unit,
) {
    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        ModeTile(
            modifier = Modifier.weight(1f),
            icon = PantopusIcon.Users,
            title = "Collective",
            line = "Everyone free",
            selected = mode == FindMode.Collective,
            onClick = { onMode(FindMode.Collective) },
        )
        ModeTile(
            modifier = Modifier.weight(1f),
            icon = PantopusIcon.ArrowsRepeat,
            title = "Round-robin",
            line = "One covers",
            selected = mode == FindMode.RoundRobin,
            onClick = { onMode(FindMode.RoundRobin) },
        )
    }
}

@Composable
private fun ModeTile(
    icon: PantopusIcon,
    title: String,
    line: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.lg))
                .background(if (selected) HomeAccentBg else PantopusColors.appSurface)
                .border(
                    if (selected) 1.5.dp else 1.dp,
                    if (selected) HomeAccent else PantopusColors.appBorder,
                    RoundedCornerShape(Radii.lg),
                )
                .clickable(onClickLabel = title, onClick = onClick)
                .padding(Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            PantopusIconImage(
                icon = icon,
                contentDescription = null,
                size = 18.dp,
                tint = if (selected) HomeAccent else PantopusColors.appTextSecondary,
            )
            if (selected) {
                PantopusIconImage(icon = PantopusIcon.CheckCircle, contentDescription = null, size = 16.dp, tint = HomeAccent)
            }
        }
        Column {
            Text(
                text = title,
                style = PantopusTextStyle.small,
                fontWeight = FontWeight.Bold,
                color = if (selected) HomeAccentDark else PantopusColors.appText,
            )
            Text(text = line, style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
        }
    }
}

// ─── Date window ──────────────────────────────────────────────────────────────

@Composable
private fun DateWindow(
    form: SetupForm,
    onWindow: (WindowPreset) -> Unit,
) {
    var expanded by remember { mutableStateOf(false) }
    val (from, to) = form.range
    Box {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurface)
                    .border(1.5.dp, if (form.rangeValid) PantopusColors.appBorder else PantopusColors.error, RoundedCornerShape(Radii.md))
                    .clickable(onClickLabel = "Change date window") { expanded = true }
                    .padding(Spacing.s3),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Calendar,
                contentDescription = null,
                size = 16.dp,
                tint = if (form.rangeValid) HomeAccent else PantopusColors.error,
            )
            Text(
                text = FindATimeFormat.rangeLabel(from, to),
                style = PantopusTextStyle.small,
                fontWeight = FontWeight.SemiBold,
                color = if (form.rangeValid) PantopusColors.appText else PantopusColors.error,
                modifier = Modifier.weight(1f).padding(start = Spacing.s2),
            )
            PantopusIconImage(icon = PantopusIcon.ChevronRight, contentDescription = null, size = 15.dp, tint = PantopusColors.appTextMuted)
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            listOf(
                WindowPreset.ThisWeek to "This week",
                WindowPreset.TwoWeeks to "Next 2 weeks",
                WindowPreset.ThisMonth to "This month",
            ).forEach { (preset, label) ->
                DropdownMenuItem(text = { Text(label) }, onClick = {
                    onWindow(preset)
                    expanded = false
                })
            }
        }
    }
}

// ─── Small primitives ─────────────────────────────────────────────────────────

@Composable
private fun FieldLabel(
    text: String,
    top: Dp = 0.dp,
) {
    Text(
        text = text,
        style = PantopusTextStyle.caption,
        fontWeight = FontWeight.SemiBold,
        color = PantopusColors.appTextStrong,
        modifier = Modifier.padding(top = top, bottom = Spacing.s1),
    )
}

@Composable
private fun FtTextField(
    value: String,
    placeholder: String,
    onValueChange: (String) -> Unit,
) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                .padding(horizontal = Spacing.s3, vertical = Spacing.s3),
    ) {
        if (value.isEmpty()) {
            Text(text = placeholder, style = PantopusTextStyle.body, color = PantopusColors.appTextMuted)
        }
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            singleLine = true,
            textStyle = PantopusTextStyle.body.copy(color = PantopusColors.appText),
            cursorBrush = SolidColor(HomeAccent),
            modifier = Modifier.fillMaxWidth().testTag("findATimeTitleField"),
        )
    }
}

@Composable
private fun ValidationLine(text: String) {
    Row(modifier = Modifier.padding(top = Spacing.s2), verticalAlignment = Alignment.CenterVertically) {
        PantopusIconImage(icon = PantopusIcon.AlertCircle, contentDescription = null, size = 12.dp, tint = PantopusColors.error)
        Text(text = text, style = PantopusTextStyle.caption, color = PantopusColors.error, modifier = Modifier.padding(start = Spacing.s1))
    }
}

/**
 * Compact inline `−  value  +` control bordered as a single unit (spec/iOS
 * geometry). Minus tints neutral, plus tints home-green; the value sits between.
 */
@Composable
private fun Stepper(
    valueLabel: String,
    onMinus: () -> Unit,
    onPlus: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.md))
                .border(1.5.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md)),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        StepperButton(icon = PantopusIcon.Minus, label = "Decrease", tint = PantopusColors.appTextStrong, onClick = onMinus)
        Text(
            text = valueLabel,
            style = PantopusTextStyle.small,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
            textAlign = TextAlign.Center,
            modifier = Modifier.widthIn(min = 56.dp),
        )
        StepperButton(icon = PantopusIcon.Plus, label = "Increase", tint = HomeAccent, onClick = onPlus)
    }
}

@Composable
private fun StepperButton(
    icon: PantopusIcon,
    label: String,
    tint: Color,
    onClick: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .size(width = 30.dp, height = 32.dp)
                .clickable(onClickLabel = label, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(icon = icon, contentDescription = label, size = 14.dp, tint = tint)
    }
}

@Composable
private fun SetupSkeleton() {
    Column(
        modifier = Modifier.fillMaxSize().padding(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        repeat(4) {
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(Radii.xl))
                        .background(PantopusColors.appSurface)
                        .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                        .padding(Spacing.s4),
            ) {
                Shimmer(width = 180.dp, height = 14.dp, cornerRadius = Radii.xs)
            }
        }
    }
}
