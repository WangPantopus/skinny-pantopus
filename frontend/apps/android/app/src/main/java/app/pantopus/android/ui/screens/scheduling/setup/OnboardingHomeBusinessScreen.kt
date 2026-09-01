@file:Suppress(
    "PackageNaming",
    "MagicNumber",
    "LongMethod",
    "CyclomaticComplexMethod",
    "UnusedParameter",
    "LongParameterList",
    "ktlint:standard:max-line-length",
)

package app.pantopus.android.ui.screens.scheduling.setup

import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.screens.shared.wizard.WizardShell
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Spacing

@Composable
fun OnboardingHomeBusinessScreen(
    onBack: () -> Unit = {},
    onNavigate: (String) -> Unit = {},
    viewModel: OnboardingHomeBusinessViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val pendingShareUrl by viewModel.pendingShareUrl.collectAsStateWithLifecycle()
    val finished by viewModel.finished.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val pillar = state.pillar

    LaunchedEffect(finished) { if (finished) onBack() }
    LaunchedEffect(pendingShareUrl) {
        pendingShareUrl?.let { url ->
            val send =
                Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"
                    putExtra(Intent.EXTRA_TEXT, url)
                }
            runCatching { context.startActivity(Intent.createChooser(send, null)) }
            viewModel.shareConsumed()
        }
    }

    WizardShell(model = viewModel, identity = pillar.wizardIdentity) {
        val steps =
            if (state.flow == OnboardingFlow.Home) {
                listOf("Members", "Combine", "Share")
            } else {
                listOf("Link", "Service", "Team", "Confirm")
            }
        if (state.isSuccess) {
            // The design keeps the rail above the success hero with every step marked done
            // (onboarding-home-frames.jsx HomeSuccess: StepRail current={3} done={[1,2,3]};
            // business done={[1,2,3,4]}), so the final disc renders a check, not a numeral.
            WizardStepRail(
                steps = steps,
                current = state.displayStep,
                pillar = pillar,
                done = (1..steps.size).toSet(),
            )
            OnboardingSuccess(state)
            return@WizardShell
        }
        if (state.stepIndex == 1) {
            SetupPillarChip(pillar = pillar, label = if (state.flow == OnboardingFlow.Home) "Home" else "Business")
        }
        WizardStepRail(steps = steps, current = state.displayStep, pillar = pillar)
        if (state.flow == OnboardingFlow.Home) HomeStep(state, viewModel, pillar) else BusinessStep(state, viewModel, pillar)
    }
}

@Composable
private fun HomeStep(
    state: OnboardingUiState,
    vm: OnboardingHomeBusinessViewModel,
    pillar: app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar,
) {
    when (state.stepIndex) {
        1 -> {
            OnboardingHeadline(
                title = "Choose who's scheduled",
                sub = "Pick the household members people can book. Family scheduling uses everyone's own hours — no one sets times twice.",
            )
            OnboardingMemberList(selected = state.selectedMembers, pillar = pillar, onToggle = vm::toggleMember)
        }
        2 -> {
            val memberCount = state.selectedMembers.size
            val memberWord = if (memberCount == 1) "member is" else "$memberCount members are"
            OnboardingHeadline(
                title = "How should times combine?",
                sub =
                    if (state.combineMode == "round_robin") {
                        "Whoever's free gets the booking. Pick a rule for who hosts when more than one person is open."
                    } else {
                        "${memberWord.replaceFirstChar { it.uppercaseChar() }} scheduled. Choose how their availability turns into one set of bookable times."
                    },
            )
            OnboardingModePicker(mode = state.combineMode, pillar = pillar, onSelect = vm::setCombineMode)
            if (state.combineMode == "round_robin") {
                OnboardingRoundRobinRule(rule = state.roundRobinRule, pillar = pillar, onSelect = vm::setRoundRobinRule)
            }
            ComposedAvailabilityCard(message = composedMessage(state.flow), timezoneId = state.timezoneId, pillar = pillar)
        }
    }
}

@Composable
private fun BusinessStep(
    state: OnboardingUiState,
    vm: OnboardingHomeBusinessViewModel,
    pillar: app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar,
) {
    when (state.stepIndex) {
        1 -> {
            OnboardingHeadline(
                title = "Claim your business link",
                sub = "This is where clients book you. Pick something short — your business name usually works best.",
            )
            SlugClaimField(
                overline = "Your business link",
                slug = state.slug,
                state = state.slugState,
                availableHint = "Clients will book your business here.",
                onSlugChange = vm::onSlugChange,
                onPickSuggestion = vm::onPickSuggestion,
                pillar = pillar,
            )
        }
        2 -> {
            OnboardingHeadline(
                title = "Add your first service",
                sub = "Clients pick a service when they book. Start with one — you can add more from settings.",
            )
            OnboardingServicePicker(
                serviceType = state.serviceType,
                duration = state.duration,
                priceText = state.priceText,
                paidEnabled = state.paidEnabled,
                pillar = pillar,
                onSelect = vm::setServiceType,
                onDuration = vm::setDuration,
                onPrice = vm::setPriceText,
            )
        }
        3 -> {
            OnboardingHeadline(
                title = "Seat your team",
                sub = "Seated teammates can take bookings. Front-desk roles manage the calendar without being booked.",
            )
            OnboardingTeamList(seated = state.seatedTeam, pillar = pillar, onToggle = vm::toggleSeat)
            ComposedAvailabilityCard(message = composedMessage(state.flow), timezoneId = state.timezoneId, pillar = pillar)
        }
        4 -> {
            OnboardingHeadline(
                title = "Auto-confirm or approve?",
                sub = "Decide what happens when a client picks a time. You can change this any time.",
            )
            OnboardingConfirmMode(mode = state.confirmMode, pillar = pillar, onSelect = vm::setConfirmMode)
            if (state.confirmMode == "approve") OnboardingApproveExplainer(pillar = pillar)
        }
    }
}

@Composable
private fun OnboardingSuccess(state: OnboardingUiState) {
    val isHome = state.flow == OnboardingFlow.Home
    OnboardingSuccessHero(
        pillar = state.pillar,
        headline = if (isHome) "Your family link is live" else "Your business is taking bookings",
        subcopy =
            if (isHome) {
                "Share it and people can book any free member during their own hours. Bookings show up on the family schedule."
            } else {
                val confirm =
                    if (state.confirmMode == "approve") {
                        "You approve each booking before it's confirmed."
                    } else {
                        "Bookings confirm automatically."
                    }
                "Your link is live with your first service and seated team. $confirm"
            },
    )
    // Copy puts the live link on the clipboard (the hub's clipboard pattern).
    val clipboard = LocalClipboardManager.current
    WizardSuccessLinkCard(
        link = state.shareLink,
        pillar = state.pillar,
        onCopy = { clipboard.setText(AnnotatedString("https://${state.shareLink}")) },
    )
}

/**
 * Step headline + supporting sub, matching the design's `Headline` block
 * (`onboarding-shell.jsx`): 22sp/700/-0.3 title with a tight 6dp gap above a
 * 13.5sp/19sp secondary sub. The shared `HeadlineBlock`/`SubcopyBlock` drift
 * (24sp h2 + 16sp body with a 20dp shell gap), so onboarding renders locally.
 */
@Composable
private fun OnboardingHeadline(
    title: String,
    sub: String,
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Text(
            text = title,
            color = PantopusColors.appText,
            fontWeight = FontWeight.Bold,
            fontSize = 22.sp,
            lineHeight = 28.sp,
            letterSpacing = (-0.3).sp,
            modifier = Modifier.semantics { heading() },
        )
        Text(
            text = sub,
            color = PantopusColors.appTextSecondary,
            fontSize = 13.5.sp,
            lineHeight = 19.sp,
        )
    }
}

/**
 * A18 success hero, pillar-tinted, matching `SuccessHero` in
 * `onboarding-shell.jsx`: a 96dp halo in the pillar's soft tint with an inner
 * pillar-accent disc + white check, a 22sp/700 title, and a 13.5sp/19sp sub.
 * The shared `SuccessHeroBlock` always paints a neutral green success circle,
 * so onboarding renders the pillar-correct hero locally.
 */
@Composable
private fun OnboardingSuccessHero(
    pillar: SchedulingPillar,
    headline: String,
    subcopy: String,
) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(top = Spacing.s5),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s5),
    ) {
        Box(
            modifier = Modifier.size(96.dp).clip(CircleShape).background(pillar.accentBg),
            contentAlignment = Alignment.Center,
        ) {
            Box(
                modifier = Modifier.size(60.dp).clip(CircleShape).background(pillar.accent),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Check,
                    contentDescription = null,
                    size = 32.dp,
                    strokeWidth = 3f,
                    tint = PantopusColors.appTextInverse,
                )
            }
        }
        Column(
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            Text(
                text = headline,
                color = PantopusColors.appText,
                fontWeight = FontWeight.Bold,
                fontSize = 22.sp,
                lineHeight = 28.sp,
                letterSpacing = (-0.3).sp,
                textAlign = TextAlign.Center,
                modifier = Modifier.semantics { heading() },
            )
            Text(
                text = subcopy,
                color = PantopusColors.appTextSecondary,
                fontSize = 13.5.sp,
                lineHeight = 19.sp,
                textAlign = TextAlign.Center,
            )
        }
    }
}
