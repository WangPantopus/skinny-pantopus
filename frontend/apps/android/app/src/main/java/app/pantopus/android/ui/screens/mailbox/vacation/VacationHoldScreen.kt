@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "LongParameterList", "TooManyFunctions", "UnusedPrivateMember")

package app.pantopus.android.ui.screens.mailbox.vacation

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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.analytics.Analytics
import app.pantopus.android.data.analytics.AnalyticsEvent
import app.pantopus.android.ui.components.DateSpan
import app.pantopus.android.ui.components.DateSpanTone
import app.pantopus.android.ui.screens.mailbox.vacation.components.HeldList
import app.pantopus.android.ui.screens.mailbox.vacation.components.HoldStatusHero
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

/** Toast dwell time — matches iOS `VacationHoldView`'s 1.8s banner. */
private const val TOAST_MILLIS = 1_800L

/**
 * A14.8 — Vacation Hold screen. Mirrors
 * `Features/Mailbox/Vacation/VacationHoldView.swift`. Two variants:
 *
 * - scheduling — From / To date pickers wrapped around a 13-day
 *   [DateSpan] strip, a 4-row scope-toggle card (mail · packages ·
 *   magic task · civic notices locked), an optional forwarding chevron
 *   row, and an emergency-contact chevron row. Top bar trailing slot
 *   renders `Save` in `primary600` (disabled until the draft is valid).
 *
 * - active — sky-gradient [HoldStatusHero] with pulsing pill + days-
 *   left + 3-cell stats grid, a "Currently held" ledger via [HeldList],
 *   read-only forwarding + emergency cards, a destructive "End hold
 *   early" row at the bottom, and the trailing slot in the top bar
 *   swaps `Save` for a muted `Edit` text button.
 */
@Composable
fun VacationHoldScreen(
    onBack: () -> Unit,
    viewModel: VacationHoldViewModel = hiltViewModel(),
    seed: VacationHoldSeed = VacationHoldSeed.Scheduling,
    onPickFromDate: () -> Unit = {},
    onPickToDate: () -> Unit = {},
    onEditForwarding: () -> Unit = {},
    onEditEmergency: () -> Unit = {},
) {
    val mode by viewModel.mode.collectAsStateWithLifecycle()
    val toast by viewModel.toast.collectAsStateWithLifecycle()

    /**
     * A14.8 — "End hold early" is destructive (the backend marks the hold
     * `cancelled` and clears `User.vacation_mode`), so it confirms first.
     */
    var showEndHoldConfirm by remember { mutableStateOf(false) }

    LaunchedEffect(toast) {
        if (toast != null) {
            kotlinx.coroutines.delay(TOAST_MILLIS)
            viewModel.consumeToast()
        }
    }

    LaunchedEffect(Unit) {
        viewModel.load(seed)
        viewModel.configureNavigation(
            onBack = onBack,
            onEditForwarding = onEditForwarding,
            onEditEmergency = onEditEmergency,
            onPickFromDate = onPickFromDate,
            onPickToDate = onPickToDate,
        )
        val modeTag = if (mode is VacationHoldMode.Active) "active" else "scheduling"
        Analytics.track(AnalyticsEvent.ScreenVacationHoldViewed(modeTag))
    }

    Box(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier =
                Modifier
                    .fillMaxSize()
                    .background(PantopusColors.appBg)
                    .testTag("vacationHold"),
        ) {
            TopBar(viewModel = viewModel, mode = mode)
            Column(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(bottom = Spacing.s6),
            ) {
                when (val m = mode) {
                    is VacationHoldMode.Scheduling -> SchedulingBody(viewModel = viewModel, draft = m.draft)
                    is VacationHoldMode.Active ->
                        ActiveBody(
                            viewModel = viewModel,
                            hold = m.hold,
                            onEndHold = { showEndHoldConfirm = true },
                        )
                }
            }
        }

        if (showEndHoldConfirm) {
            AlertDialog(
                onDismissRequest = { showEndHoldConfirm = false },
                title = { Text(text = "End your vacation hold?") },
                text = {
                    Text(
                        text = "Mail and packages resume delivery right away.",
                        fontSize = 13.sp,
                        color = PantopusColors.appTextSecondary,
                    )
                },
                confirmButton = {
                    TextButton(
                        onClick = {
                            showEndHoldConfirm = false
                            viewModel.endHoldEarly()
                        },
                        modifier = Modifier.testTag("vacationHoldEndConfirm"),
                    ) {
                        Text(text = "End hold", color = PantopusColors.error)
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showEndHoldConfirm = false }) {
                        Text(text = "Keep holding", color = PantopusColors.appTextSecondary)
                    }
                },
            )
        }

        if (toast != null) {
            Box(
                modifier =
                    Modifier
                        .align(Alignment.BottomCenter)
                        .padding(bottom = Spacing.s10),
            ) {
                Text(
                    text = toast.orEmpty(),
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appTextInverse,
                    modifier =
                        Modifier
                            .clip(RoundedCornerShape(Radii.pill))
                            .background(PantopusColors.appText.copy(alpha = 0.9f))
                            .padding(horizontal = Spacing.s4, vertical = Spacing.s2),
                )
            }
        }
    }
}

// MARK: - Top bar

@Composable
private fun TopBar(
    viewModel: VacationHoldViewModel,
    mode: VacationHoldMode,
) {
    val trailingLabel = if (mode is VacationHoldMode.Active) "Edit" else "Save"
    val trailingEnabled =
        when (mode) {
            is VacationHoldMode.Scheduling -> mode.draft.isValid
            is VacationHoldMode.Active -> true
        }
    val trailingColor: Color =
        when (mode) {
            is VacationHoldMode.Scheduling ->
                if (trailingEnabled) PantopusColors.primary600 else PantopusColors.appTextMuted
            is VacationHoldMode.Active -> PantopusColors.appTextSecondary
        }

    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(44.dp)
                .background(PantopusColors.appSurface),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = "Vacation hold",
            fontSize = 16.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
            modifier = Modifier.testTag("vacationHoldTitle"),
        )
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Box(
                modifier =
                    Modifier
                        .size(44.dp)
                        .clickable { viewModel.tapBack() }
                        .testTag("vacationHoldBack"),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.ChevronLeft,
                    contentDescription = "Back",
                    size = 22.dp,
                    tint = PantopusColors.appText,
                )
            }
            Box(
                modifier =
                    Modifier
                        .heightIn(min = 44.dp)
                        .padding(horizontal = 8.dp)
                        .clickable(enabled = trailingEnabled) { viewModel.tapTrailingAction() }
                        .testTag("vacationHoldTrailingAction"),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = trailingLabel,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = trailingColor,
                )
            }
        }
        Box(
            modifier =
                Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .height(1.dp)
                    .background(PantopusColors.appBorderSubtle),
        )
    }
}

// MARK: - Scheduling body

@Composable
private fun SchedulingBody(
    viewModel: VacationHoldViewModel,
    draft: VacationScheduleDraft,
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        VacationOverline("When")
        VacationCard {
            VacationDateRow(
                label = "From",
                sub = "9:00 AM pickup",
                value = formatWeekdayShort(draft.fromDate),
                onTap = { viewModel.tapFromDate() },
                tag = "vacationHoldFromDate",
            )
            VacationHairline()
            VacationDateRow(
                label = "To",
                sub = "Resume delivery",
                value = formatWeekdayShort(draft.toDate),
                onTap = { viewModel.tapToDate() },
                tag = "vacationHoldToDate",
            )
            VacationHairline()
            Box(
                modifier =
                    Modifier
                        .padding(horizontal = Spacing.s4)
                        .padding(top = Spacing.s2, bottom = 14.dp),
            ) {
                DateSpan(
                    days = draft.spanDays,
                    fromWeekday = formatWeekdayLabel(draft.fromDate),
                    toWeekday = formatWeekdayLabel(draft.toDate),
                    tone = DateSpanTone.Info,
                )
            }
        }

        VacationOverline("Hold during this period")
        VacationCard {
            draft.scopes.forEachIndexed { index, scope ->
                VacationToggleRow(
                    label = scope.label,
                    sub = scope.sub,
                    isOn = scope.isOn,
                    isLocked = scope.isLocked,
                    onChange = { newValue -> viewModel.toggleScope(scope.kind, newValue) },
                    tag = "vacationHoldScope.${scope.id}",
                )
                if (index < draft.scopes.size - 1) {
                    VacationHairline()
                }
            }
        }
        VacationCardHelper("Civic notices always get delivered — too important to hold.")

        VacationOverline("Forwarding")
        VacationCard {
            VacationToggleRow(
                label = "Forward urgent mail",
                sub = "Else held until you return",
                isOn = draft.forwardingEnabled,
                isLocked = false,
                onChange = { viewModel.toggleForwarding(it) },
                tag = "vacationHoldForwardToggle",
            )
            if (draft.forwardingEnabled && draft.forwarding != null) {
                VacationHairline()
                VacationChevronIconRow(
                    icon = PantopusIcon.MapPin,
                    tint = PantopusColors.primary600,
                    background = PantopusColors.primary50,
                    title = draft.forwarding.title,
                    sub = draft.forwarding.sub,
                    onTap = { viewModel.tapForwarding() },
                    tag = "vacationHoldForwardAddress",
                )
            }
        }
        VacationCardHelper("Urgent items (overnight, signature-required) re-route the same day.")

        VacationOverline("Emergency contact")
        VacationCard {
            if (draft.emergency != null) {
                VacationChevronAvatarRow(
                    initials = draft.emergency.initials,
                    title = "${draft.emergency.name} (${draft.emergency.relation.lowercase()})",
                    sub = draft.emergency.phone,
                    onTap = { viewModel.tapEmergency() },
                    tag = "vacationHoldEmergencyContact",
                )
            } else {
                VacationChevronIconRow(
                    icon = PantopusIcon.UserPlus,
                    tint = PantopusColors.primary600,
                    background = PantopusColors.primary50,
                    title = "Add an emergency contact",
                    sub = "Optional — for delivery-driver issues",
                    onTap = { viewModel.tapEmergency() },
                    tag = "vacationHoldEmergencyContact",
                )
            }
        }
        VacationCardHelper("We'll call them if a delivery driver flags an issue at your door.")

        VacationMonoFooter(draft.footerBlurb)
    }
}

// MARK: - Active body

@Composable
private fun ActiveBody(
    viewModel: VacationHoldViewModel,
    hold: VacationActiveHold,
    onEndHold: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Box(
            modifier =
                Modifier
                    .padding(horizontal = Spacing.s3)
                    .padding(top = 14.dp),
        ) {
            HoldStatusHero(
                daysLeft = hold.daysLeft,
                untilLabel = hold.untilLabel,
                stats = hold.stats,
            )
        }

        VacationOverline("Currently held")
        Column(modifier = Modifier.padding(horizontal = Spacing.s3)) {
            HeldList(items = hold.heldItems)
            Spacer(modifier = Modifier.height(Spacing.s2))
            Text(
                text = hold.resumeBlurb,
                fontSize = 11.5.sp,
                color = PantopusColors.appTextSecondary,
                modifier = Modifier.padding(horizontal = Spacing.s1),
            )
        }

        hold.forwarding?.let { forwarding ->
            VacationOverline("Forwarding to")
            VacationCard {
                VacationChevronIconRow(
                    icon = PantopusIcon.MapPin,
                    tint = PantopusColors.primary600,
                    background = PantopusColors.primary50,
                    title = forwarding.title,
                    sub = forwarding.sub,
                    onTap = { viewModel.tapForwarding() },
                    tag = "vacationHoldActiveForwarding",
                )
            }
        }

        hold.emergency?.let { emergency ->
            VacationOverline("Emergency contact")
            VacationCard {
                VacationChevronAvatarRow(
                    initials = emergency.initials,
                    title = "${emergency.name} (${emergency.relation.lowercase()})",
                    sub = emergency.phone,
                    onTap = { viewModel.tapEmergency() },
                    tag = "vacationHoldActiveEmergency",
                )
            }
        }

        VacationCard {
            VacationDestructiveRow(
                label = "End hold early",
                sub = "Mail resumes tomorrow morning",
                onTap = onEndHold,
                tag = "vacationHoldEndEarly",
            )
        }

        VacationMonoFooter(hold.activeSinceLabel)
    }
}

// MARK: - Layout primitives

@Composable
private fun VacationOverline(text: String) {
    Text(
        text = text.uppercase(),
        fontSize = 11.sp,
        fontWeight = FontWeight.Bold,
        letterSpacing = 0.9.sp,
        color = PantopusColors.appTextSecondary,
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s4)
                .padding(top = 18.dp, bottom = Spacing.s2),
    )
}

@Composable
private fun VacationCard(content: @Composable () -> Unit) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s3)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg)),
    ) {
        content()
    }
}

@Composable
private fun VacationCardHelper(text: String) {
    Text(
        text = text,
        fontSize = 11.5.sp,
        color = PantopusColors.appTextSecondary,
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s4)
                .padding(top = Spacing.s2),
    )
}

@Composable
private fun VacationMonoFooter(text: String) {
    Text(
        text = text,
        fontSize = 11.sp,
        fontFamily = FontFamily.Monospace,
        color = PantopusColors.appTextMuted,
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s4)
                .padding(top = Spacing.s6, bottom = Spacing.s2),
    )
}

/** A14.8 — destructive card row ("End hold early") at the bottom of the active body. */
@Composable
private fun VacationDestructiveRow(
    label: String,
    sub: String,
    onTap: () -> Unit,
    tag: String,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable { onTap() }
                .padding(horizontal = Spacing.s4, vertical = 14.dp)
                .testTag(tag),
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        Text(
            text = label,
            fontSize = 15.sp,
            fontWeight = FontWeight.Medium,
            color = PantopusColors.error,
        )
        Text(
            text = sub,
            fontSize = 11.5.sp,
            color = PantopusColors.appTextSecondary,
        )
    }
}

@Composable
private fun VacationHairline() {
    Row(modifier = Modifier.fillMaxWidth()) {
        Spacer(modifier = Modifier.width(Spacing.s4))
        Box(
            modifier =
                Modifier
                    .weight(1f)
                    .height(1.dp)
                    .background(PantopusColors.appBorder.copy(alpha = 0.6f)),
        )
    }
}

@Composable
private fun VacationDateRow(
    label: String,
    sub: String,
    value: String,
    onTap: () -> Unit,
    tag: String,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable { onTap() }
                .padding(horizontal = Spacing.s4, vertical = 14.dp)
                .testTag(tag),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            Text(
                text = label,
                fontSize = 15.sp,
                fontWeight = FontWeight.Medium,
                color = PantopusColors.appText,
            )
            Text(
                text = sub,
                fontSize = 11.5.sp,
                color = PantopusColors.appTextSecondary,
            )
        }
        Text(
            text = value,
            fontSize = 14.sp,
            fontWeight = FontWeight.Medium,
            color = PantopusColors.appText,
        )
        PantopusIconImage(
            icon = PantopusIcon.ChevronRight,
            contentDescription = null,
            size = 16.dp,
            tint = PantopusColors.appTextSecondary,
        )
    }
}

@Composable
private fun VacationToggleRow(
    label: String,
    sub: String,
    isOn: Boolean,
    isLocked: Boolean,
    onChange: (Boolean) -> Unit,
    tag: String,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s4, vertical = 14.dp)
                .testTag(tag),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            Text(
                text = label,
                fontSize = 15.sp,
                fontWeight = FontWeight.Medium,
                color = PantopusColors.appText,
            )
            Text(
                text = sub,
                fontSize = 11.5.sp,
                color = PantopusColors.appTextSecondary,
            )
        }
        if (isLocked) {
            LockedChip(modifier = Modifier.testTag("$tag.locked"))
        } else {
            Switch(
                checked = isOn,
                onCheckedChange = onChange,
                colors =
                    SwitchDefaults.colors(
                        checkedTrackColor = PantopusColors.primary600,
                        checkedThumbColor = Color.White,
                    ),
                modifier = Modifier.testTag("$tag.toggle"),
            )
        }
    }
}

@Composable
private fun LockedChip(modifier: Modifier = Modifier) {
    Row(
        modifier =
            modifier
                .clip(CircleShape)
                .background(PantopusColors.appSurfaceSunken)
                .padding(horizontal = Spacing.s2, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Lock,
            contentDescription = null,
            size = 10.dp,
            tint = PantopusColors.appTextSecondary,
        )
        Text(
            text = "ALWAYS ON",
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.6.sp,
            color = PantopusColors.appTextSecondary,
        )
    }
}

@Composable
private fun VacationChevronIconRow(
    icon: PantopusIcon,
    tint: Color,
    background: Color,
    title: String,
    sub: String,
    onTap: () -> Unit,
    tag: String,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable { onTap() }
                .padding(horizontal = Spacing.s4, vertical = 14.dp)
                .testTag(tag),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(32.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(background),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = icon,
                contentDescription = null,
                size = 16.dp,
                tint = tint,
            )
        }
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            Text(
                text = title,
                fontSize = 15.sp,
                fontWeight = FontWeight.Medium,
                color = PantopusColors.appText,
            )
            Text(
                text = sub,
                fontSize = 11.5.sp,
                color = PantopusColors.appTextSecondary,
            )
        }
        PantopusIconImage(
            icon = PantopusIcon.ChevronRight,
            contentDescription = null,
            size = 16.dp,
            tint = PantopusColors.appTextSecondary,
        )
    }
}

@Composable
private fun VacationChevronAvatarRow(
    initials: String,
    title: String,
    sub: String,
    onTap: () -> Unit,
    tag: String,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable { onTap() }
                .padding(horizontal = Spacing.s4, vertical = 14.dp)
                .testTag(tag),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(32.dp)
                    .clip(CircleShape)
                    .background(PantopusColors.appSurfaceSunken),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = initials.take(2).uppercase(),
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appTextStrong,
            )
        }
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            Text(
                text = title,
                fontSize = 15.sp,
                fontWeight = FontWeight.Medium,
                color = PantopusColors.appText,
            )
            Text(
                text = sub,
                fontSize = 11.5.sp,
                color = PantopusColors.appTextSecondary,
            )
        }
        PantopusIconImage(
            icon = PantopusIcon.ChevronRight,
            contentDescription = null,
            size = 16.dp,
            tint = PantopusColors.appTextSecondary,
        )
    }
}

// MARK: - Formatting helpers

/** "Tue, May 28" — date-row value. */
private fun formatWeekdayShort(date: LocalDate): String {
    val formatter = DateTimeFormatter.ofPattern("EEE, MMM d", Locale.US)
    return date.format(formatter)
}

/** "Tue · May 28" — DateSpan caption beneath the dashed strip. */
private fun formatWeekdayLabel(date: LocalDate): String {
    val day = DateTimeFormatter.ofPattern("EEE", Locale.US).format(date)
    val md = DateTimeFormatter.ofPattern("MMM d", Locale.US).format(date)
    return "$day · $md"
}

// MARK: - Previews

@Preview(showBackground = true, widthDp = 390, heightDp = 1200, name = "A14.8 · scheduling")
@Composable
private fun VacationHoldSchedulingPreview() {
    VacationHoldScreen(
        onBack = {},
        viewModel = VacationHoldViewModel(VacationHoldSeed.Scheduling),
        seed = VacationHoldSeed.Scheduling,
    )
}

@Preview(showBackground = true, widthDp = 390, heightDp = 1200, name = "A14.8 · active")
@Composable
private fun VacationHoldActivePreview() {
    VacationHoldScreen(
        onBack = {},
        viewModel = VacationHoldViewModel(VacationHoldSeed.Active),
        seed = VacationHoldSeed.Active,
    )
}
