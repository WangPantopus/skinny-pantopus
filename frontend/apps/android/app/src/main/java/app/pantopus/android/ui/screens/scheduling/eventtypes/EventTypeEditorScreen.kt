@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "LongParameterList", "CyclomaticComplexMethod", "UnusedParameter")

package app.pantopus.android.ui.screens.scheduling.eventtypes

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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.graphics.toColorInt
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingScreenState
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingStateScaffold
import app.pantopus.android.ui.screens.shared.form.FormShell
import app.pantopus.android.ui.screens.shared.form.FormShellLeading
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.SchedulingPalette
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.delay

private val LOCATION_OPTIONS = listOf("In person" to "in_person", "Phone" to "phone", "Video" to "video", "Custom" to "custom")
private val ASSIGNMENT_OPTIONS = listOf("Anyone" to "round_robin", "Specific" to "one_on_one", "Collective" to "collective")

@Composable
fun EventTypeEditorScreen(
    eventTypeId: String,
    onBack: () -> Unit = {},
    onNavigate: (String) -> Unit = {},
    viewModel: EventTypeEditorViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val saved by viewModel.saved.collectAsStateWithLifecycle()
    val toast by viewModel.toast.collectAsStateWithLifecycle()
    var toastText by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) { viewModel.start() }
    LaunchedEffect(saved) {
        if (saved) {
            viewModel.savedConsumed()
            onBack()
        }
    }
    LaunchedEffect(toast) {
        toast?.let {
            toastText = it
            viewModel.toastConsumed()
        }
    }
    LaunchedEffect(toastText) {
        if (toastText != null) {
            delay(2200)
            toastText = null
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        when (val s = state) {
            EventTypeEditorUiState.Loading ->
                SchedulingStateScaffold(state = SchedulingScreenState.Loading, onRetry = viewModel::load) {}
            is EventTypeEditorUiState.Error ->
                ErrorState(message = s.message, onRetry = viewModel::load)
            is EventTypeEditorUiState.Content ->
                EditorContent(state = s, viewModel = viewModel, onBack = onBack, onNavigate = onNavigate)
        }
        toastText?.let { msg ->
            Row(
                modifier =
                    Modifier
                        .align(Alignment.TopCenter)
                        .padding(top = Spacing.s12)
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(PantopusColors.appText)
                        .padding(horizontal = Spacing.s4, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                PantopusIconImage(icon = PantopusIcon.AlertCircle, contentDescription = null, size = 15.dp, tint = PantopusColors.warning)
                Text(text = msg, color = PantopusColors.appTextInverse, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun EditorContent(
    state: EventTypeEditorUiState.Content,
    viewModel: EventTypeEditorViewModel,
    onBack: () -> Unit,
    onNavigate: (String) -> Unit,
) {
    val form = state.form
    val accent = state.pillar.accent
    FormShell(
        // Design TopBar title stays "Event type" in all frames (create + edit).
        title = "Event type",
        isValid = form.isValid,
        isDirty = state.isCreate || state.isDirty,
        onClose = onBack,
        onCommit = viewModel::save,
        bottomActionLabel = if (state.isCreate) "Create event type" else "Save event type",
        isSaving = state.isSaving,
        leading = FormShellLeading.Back,
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s3),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            EtIdentityPill(pillar = state.pillar)

            // Basics
            EtCard(overline = "Basics", accent = accent) {
                EtTextField(
                    value = form.name,
                    onValueChange = viewModel::onName,
                    label = "Name",
                    placeholder = "e.g. Intro call",
                    isError = state.nameError != null,
                    helper = state.nameError ?: linkPreview(form.name),
                )
                EtTextField(
                    value = form.description,
                    onValueChange = viewModel::onDescription,
                    label = "Description",
                    placeholder = "What should people expect?",
                    singleLine = false,
                )
                ColorSwatches(selected = form.color, onSelect = viewModel::onColor)
            }

            // Duration
            EtCard(overline = "Duration", accent = accent) {
                EtSegmented(
                    options = listOf("Single", "Multiple"),
                    selected = if (form.multiple) "Multiple" else "Single",
                    onSelect = { viewModel.onModeChange(it == "Multiple") },
                )
                EtFieldLabel(text = if (form.multiple) "Lengths people can pick" else "Length")
                if (form.multiple) {
                    FlowRow(
                        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
                    ) {
                        DURATION_PRESETS.forEach { mins ->
                            DurationChip(
                                label = "$mins min",
                                selected = mins in form.durations,
                                onClick = { viewModel.onDurationPreset(mins) },
                            )
                        }
                    }
                } else {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                        EtStepper(
                            value = form.defaultDuration.toString(),
                            unit = "min",
                            onDecrement = { viewModel.onDurationStep(-5) },
                            onIncrement = { viewModel.onDurationStep(5) },
                            isError = state.durationError != null,
                        )
                        listOf(15, 45, 60).forEach { EtQuickChip(label = "$it", onClick = { viewModel.onDurationPreset(it) }) }
                    }
                }
                if (state.durationError != null) {
                    Row(verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                        PantopusIconImage(
                            icon = PantopusIcon.AlertCircle,
                            contentDescription = null,
                            size = 11.dp,
                            tint = PantopusColors.error,
                        )
                        Text(state.durationError, fontSize = 10.5.sp, color = PantopusColors.error)
                    }
                }
            }

            // Location
            EtCard(overline = "Location", accent = accent) {
                EtSegmented(
                    options = LOCATION_OPTIONS.map { it.first },
                    selected = LOCATION_OPTIONS.firstOrNull { it.second == form.locationMode }?.first ?: "Video",
                    onSelect = { label -> LOCATION_OPTIONS.firstOrNull { it.first == label }?.let { viewModel.onLocationMode(it.second) } },
                    small = true,
                )
                val detail = locationDetailCopy(form.locationMode)
                EtTextField(
                    value = form.locationDetail,
                    onValueChange = viewModel::onLocationDetail,
                    label = detail.first,
                    placeholder = detail.second,
                    mono = detail.third,
                )
            }

            // Advanced / Controls / Links (and Availability + business cards) are
            // hidden on create — design FrameCreate shows only Basics/Duration/Location
            // until the type is saved (mirrors iOS `isEditing` gating).
            if (!state.isCreate) {
                // Availability link-out (A3)
                EtCard(overline = "Availability", accent = accent) {
                    EtLinkRow(icon = PantopusIcon.CalendarClock, label = "Schedule", value = "Working hours", onClick = {
                        onNavigate(viewModel.availabilityRoute())
                    }, last = true)
                }

                // Business assignment + pricing
                if (state.pillar == SchedulingPillar.Business) {
                    EtCard(overline = "Assignment", accent = accent) {
                        EtSegmented(
                            options = ASSIGNMENT_OPTIONS.map { it.first },
                            selected = ASSIGNMENT_OPTIONS.firstOrNull { it.second == form.assignmentMode }?.first ?: "Anyone",
                            onSelect = {
                                    label ->
                                ASSIGNMENT_OPTIONS.firstOrNull { it.first == label }?.let { viewModel.onAssignmentMode(it.second) }
                            },
                            small = true,
                        )
                        Text(
                            text = assignmentBlurb(form.assignmentMode),
                            fontSize = 11.sp,
                            color = PantopusColors.appTextSecondary,
                        )
                        // Design FrameCollective: collective mode reveals Required-hosts stepper
                        // ("2 of 3 · must be available") + member avatar stack below it.
                        // `required_hosts` count is not yet in the DTO/VM — stepper shown as
                        // placeholder geometry (disabled, dash value) until backend adds the field.
                        if (form.assignmentMode == "collective") {
                            CollectiveModeControls()
                        }
                    }
                    if (state.paidEnabled) {
                        PricingCard(state = state, viewModel = viewModel, onNavigate = onNavigate)
                    }
                }

                // Advanced (collapsible)
                EtCard(
                    overline = "Advanced",
                    accent = accent,
                    trailing = {
                        Box(modifier = Modifier.clip(RoundedCornerShape(Radii.md)).clickable(onClick = viewModel::toggleAdvanced)) {
                            PantopusIconImage(
                                icon = if (state.advancedOpen) PantopusIcon.ChevronUp else PantopusIcon.ChevronDown,
                                contentDescription = if (state.advancedOpen) "Collapse" else "Expand",
                                size = ICON_16,
                                tint = PantopusColors.appTextMuted,
                            )
                        }
                    },
                ) {
                    if (state.advancedOpen) {
                        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                            LabeledStepper(
                                modifier =
                                    Modifier.weight(
                                        1f,
                                    ),
                                label = "Buffer before",
                                value = "${form.bufferBeforeMin}",
                                unit = "min",
                                onMinus = {
                                    viewModel.onBufferBeforeStep(-5)
                                },
                                onPlus = { viewModel.onBufferBeforeStep(5) },
                            )
                            LabeledStepper(
                                modifier =
                                    Modifier.weight(
                                        1f,
                                    ),
                                label = "Buffer after",
                                value = "${form.bufferAfterMin}",
                                unit = "min",
                                onMinus = {
                                    viewModel.onBufferAfterStep(-5)
                                },
                                onPlus = { viewModel.onBufferAfterStep(5) },
                            )
                        }
                        LabeledStepper(
                            label = "Minimum notice",
                            value = "${form.minNoticeMin / 60}",
                            unit = "hrs",
                            onMinus = { viewModel.onNoticeStep(-1) },
                            onPlus = { viewModel.onNoticeStep(1) },
                        )
                        LabeledStepper(
                            label = "Booking horizon",
                            value = "${form.maxHorizonDays}",
                            unit = "days",
                            onMinus = { viewModel.onHorizonStep(-1) },
                            onPlus = { viewModel.onHorizonStep(1) },
                        )
                        val capUnit = if (form.dailyCap != null) "/day" else null
                        LabeledStepper(
                            label = "Per-day cap",
                            value = form.dailyCap?.toString() ?: "Off",
                            unit = capUnit,
                            onMinus = { viewModel.onDailyCapStep(-1) },
                            onPlus = { viewModel.onDailyCapStep(1) },
                        )
                    }
                }

                // Controls
                EtCard(accent = accent) {
                    EtToggleRow(
                        icon = PantopusIcon.UserCheck,
                        label = "Require approval",
                        sub = "Approve each booking before it's confirmed",
                        checked = form.requiresApproval,
                        onToggle = viewModel::onRequiresApproval,
                    )
                    EtToggleRow(
                        icon = PantopusIcon.EyeOff,
                        label = "Unlisted (link only)",
                        sub = "Hidden from your public page",
                        checked = form.visibilitySecret,
                        onToggle = viewModel::onVisibilitySecret,
                    )
                    EtToggleRow(
                        icon = PantopusIcon.CheckCircle,
                        label = "Active",
                        sub = "People can book this right now",
                        checked = form.isActive,
                        onToggle = viewModel::onActive,
                        last = true,
                    )
                }

                // Links
                EtCard(accent = accent) {
                    EtLinkRow(
                        icon = PantopusIcon.ListChecks,
                        label = "Intake questions",
                        value =
                            state.questionCount?.let {
                                if (it == 1) "1 question" else "$it questions"
                            } ?: "Add questions",
                        onClick = { onNavigate(viewModel.intakeRoute()) },
                    )
                    EtLinkRow(icon = PantopusIcon.Gauge, label = "Booking limits", value = bookingLimitsSummary(form), onClick = {
                        onNavigate(viewModel.bookingLimitsRoute())
                    })
                    EtLinkRow(icon = PantopusIcon.BellRing, label = "Reminders", value = "Default", onClick = {
                        onNavigate(viewModel.remindersRoute())
                    }, last = true)
                }
            }
        }
    }
}

/**
 * Design FrameCollective: when assignment mode is "collective" the Assignment
 * card would reveal a "Required hosts" stepper + member avatar stack. The
 * `required_hosts` count and the per-event member roster are not yet in the
 * DTO/EditorForm (and the iOS `requiredHosts` field is likewise local-only with
 * no wire backing), so instead of rendering a dead disabled stepper and faked
 * avatar placeholders, we surface a clear coming-soon note until the backend
 * exposes the field.
 */
@Composable
private fun CollectiveModeControls() {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurfaceSunken)
                .padding(horizontal = 11.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Users,
            contentDescription = null,
            size = 15.dp,
            tint = PantopusColors.appTextSecondary,
        )
        Text(
            text = "Required hosts and member selection are coming soon.",
            fontSize = 11.sp,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.weight(1f),
        )
    }
}

@Composable
private fun PricingCard(
    state: EventTypeEditorUiState.Content,
    viewModel: EventTypeEditorViewModel,
    onNavigate: (String) -> Unit,
) {
    val form = state.form
    EtCard(overline = "Pricing & payment", accent = state.pillar.accent) {
        EtToggleRow(
            label = "Charge for this booking",
            sub = "Collect payment when someone books",
            checked = form.chargeEnabled,
            onToggle = viewModel::onChargeEnabled,
            last = !form.chargeEnabled,
        )
        if (form.chargeEnabled) {
            if (state.stripeConnected) {
                Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    EtTextField(
                        modifier = Modifier.weight(1.4f),
                        value = form.priceText,
                        onValueChange = viewModel::onPrice,
                        label = "Price",
                        mono = true,
                        keyboardType = KeyboardType.Decimal,
                    )
                    Column(modifier = Modifier.weight(1f)) {
                        EtFieldLabel(text = "Currency")
                        EtSegmented(
                            options = listOf("USD", "EUR"),
                            selected = form.currency,
                            onSelect = viewModel::onCurrency,
                            small = true,
                        )
                    }
                }
                // Collect = Full amount vs Deposit (design PricingCard segmented).
                Column {
                    EtFieldLabel(text = "Collect")
                    EtSegmented(
                        options = listOf("Full amount", "Deposit"),
                        selected = if (form.collectDeposit) "Deposit" else "Full amount",
                        onSelect = { viewModel.onCollectMode(it == "Deposit") },
                        small = true,
                    )
                }
            } else {
                StripeConnectCard(onConnect = { onNavigate(viewModel.paymentsRoute()) })
            }
        }
    }
}

// Design StripeCard is violet-tinted: Stripe-violet fill + border and a
// Stripe-indigo icon tile. Sourced from the theme-layer SchedulingPalette so
// no brand hex literal lives in feature code.
private val StripeCardBg = SchedulingPalette.stripeBg
private val StripeCardBorder = SchedulingPalette.stripeBorder
private val StripeCardGlyph = SchedulingPalette.stripeBrand

@Composable
private fun StripeConnectCard(onConnect: () -> Unit) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(StripeCardBg)
                .border(1.dp, StripeCardBorder, RoundedCornerShape(Radii.md))
                .padding(horizontal = Spacing.s3, vertical = 11.dp),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Row(verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            Box(
                modifier = Modifier.size(30.dp).clip(RoundedCornerShape(Radii.md)).background(StripeCardGlyph),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.CreditCard,
                    contentDescription = null,
                    size = 15.dp,
                    tint = PantopusColors.appTextInverse,
                )
            }
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(
                    "Connect payments to charge for bookings",
                    fontSize = 12.5.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appText,
                )
                Text(
                    "Pantopus uses Stripe to collect payments and deposits. It takes about a minute.",
                    fontSize = 11.sp,
                    color = PantopusColors.appTextStrong,
                )
            }
        }
        EtPrimaryButton(label = "Connect Stripe", onClick = onConnect, leadingIcon = PantopusIcon.ExternalLink)
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ColorSwatches(
    selected: String,
    onSelect: (String) -> Unit,
) {
    Column {
        EtFieldLabel(text = "Color")
        FlowRow(horizontalArrangement = Arrangement.spacedBy(Spacing.s2), verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            EVENT_TYPE_SWATCHES.forEach { hex ->
                val on = hex.equals(selected, ignoreCase = true)
                val swatch = Color(hex.toColorInt())
                // Selected ring mirrors design `0 0 0 2px #fff, 0 0 0 4px {color}`:
                // a colored outer ring with a white gap, drawn as nested boxes.
                Box(
                    modifier =
                        Modifier
                            .size(28.dp)
                            .clip(RoundedCornerShape(Radii.pill))
                            .then(if (on) Modifier.background(swatch) else Modifier)
                            .padding(if (on) 2.dp else 0.dp)
                            .clickable { onSelect(hex) },
                    contentAlignment = Alignment.Center,
                ) {
                    Box(
                        modifier =
                            Modifier
                                .size(24.dp)
                                .clip(RoundedCornerShape(Radii.pill))
                                .then(
                                    if (on) Modifier.border(2.dp, PantopusColors.appSurface, RoundedCornerShape(Radii.pill)) else Modifier,
                                )
                                .background(swatch),
                    )
                }
            }
        }
    }
}

@Composable
private fun DurationChip(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(if (selected) PantopusColors.primary50 else PantopusColors.appSurface)
                .border(1.dp, if (selected) PantopusColors.primary600 else PantopusColors.appBorder, RoundedCornerShape(Radii.pill))
                .clickable(onClick = onClick)
                .padding(horizontal = 12.dp, vertical = 7.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            label,
            fontSize = 11.5.sp,
            fontWeight = FontWeight.SemiBold,
            color = if (selected) PantopusColors.primary700 else PantopusColors.appTextStrong,
        )
    }
}

@Composable
private fun LabeledStepper(
    label: String,
    value: String,
    unit: String?,
    onMinus: () -> Unit,
    onPlus: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier) {
        EtFieldLabel(text = label)
        EtStepper(value = value, unit = unit, onDecrement = onMinus, onIncrement = onPlus)
    }
}

// Read-only preview of the public link derived from the name (the slug is not a
// separate field — it's generated from the name on create, immutable thereafter).
private fun linkPreview(name: String): String? {
    if (name.isBlank()) return null
    val slug = slugify(name)
    return if (slug.isEmpty()) null else "Link: pantopus.com/book/…/$slug"
}

private fun locationDetailCopy(mode: String): Triple<String, String, Boolean> =
    when (mode) {
        "in_person" -> Triple("Address", "123 Main St, Suite 3", false)
        "phone" -> Triple("Number", "+1 (415) 555-0142", true)
        "custom" -> Triple("Instructions", "Sent after booking", false)
        else -> Triple("Meeting link", "meet.pantopus.com/you", true)
    }

private fun assignmentBlurb(mode: String): String =
    when (mode) {
        "collective" -> "Everyone required must be free. The booking lands on every host's calendar."
        "round_robin" -> "Any seated teammate who's free can take the booking."
        else -> "You take the booking yourself."
    }

private fun bookingLimitsSummary(form: EditorForm): String {
    val parts =
        buildList {
            if (form.minNoticeMin > 0) add("${form.minNoticeMin / 60}h notice")
            if (form.dailyCap != null) add("${form.dailyCap}/day")
        }
    return if (parts.isEmpty()) "Off" else parts.joinToString(" · ")
}
