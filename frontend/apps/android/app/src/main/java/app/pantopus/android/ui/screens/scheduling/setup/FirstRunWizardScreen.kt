@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "UnusedParameter")

package app.pantopus.android.ui.screens.scheduling.setup

import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
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
import app.pantopus.android.ui.screens.shared.wizard.blocks.HeadlineBlock
import app.pantopus.android.ui.screens.shared.wizard.blocks.SubcopyBlock
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

@Composable
fun FirstRunWizardScreen(
    onBack: () -> Unit = {},
    onNavigate: (String) -> Unit = {},
    viewModel: FirstRunWizardViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val pendingShareUrl by viewModel.pendingShareUrl.collectAsStateWithLifecycle()
    val finished by viewModel.finished.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val clipboard = LocalClipboardManager.current
    val pillar = SchedulingPillar.Personal

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
        WizardStepRail(
            steps = listOf("Link", "Type", "Hours", "Share"),
            current = state.step,
            pillar = pillar,
            // Success frame marks every disc done — the last renders a check, not
            // "4" (scheduling-setup-frames.jsx FrameSuccess `done={[1,2,3,4]}`).
            done = if (state.step > 3) setOf(1, 2, 3, 4) else emptySet(),
        )
        when (state.step) {
            1 -> {
                HeadlineBlock("Claim your booking link")
                SubcopyBlock("This is the link you'll share. People book you at it — pick something short and memorable.")
                SlugClaimField(
                    overline = "Your link",
                    slug = state.slug,
                    state = state.slugState,
                    availableHint = "People will book you at this link.",
                    onSlugChange = viewModel::onSlugChange,
                    onPickSuggestion = viewModel::onPickSuggestion,
                    pillar = pillar,
                )
            }
            2 -> {
                HeadlineBlock("Pick a meeting type")
                SubcopyBlock("Start with one — how you meet and how long it runs. You can add more from settings.")
                WizardTypePicker(
                    selectedMode = state.locationMode,
                    duration = state.duration,
                    pillar = pillar,
                    onSelectMode = viewModel::onSelectLocation,
                    onSelectDuration = viewModel::onSelectDuration,
                )
            }
            3 -> {
                if (state.isResume) {
                    FirstRunResumeBanner(pillar = pillar)
                }
                HeadlineBlock("Set your weekly hours")
                // FrameResume swaps the step-3 subcopy for the "last step" line
                // (scheduling-setup-frames.jsx:557; iOS FirstRunWizardScreen parity).
                SubcopyBlock(
                    if (state.isResume) {
                        "Last step. Set your hours, then share your link."
                    } else {
                        "People can only book inside these windows. You can fine-tune any day, or just use the defaults."
                    },
                )
                WizardTimezoneChip(timezoneId = state.timezoneId)
                WizardHoursGrid(hours = state.hours, pillar = pillar, onToggleDay = viewModel::onToggleDay)
            }
            else -> {
                FirstRunSuccessHero(
                    pillar = pillar,
                    headline = "You're all set",
                    subcopy =
                        "Your booking link is live. Share it and people can book a " +
                            "${state.duration}-minute meeting during your weekly hours.",
                )
                WizardSuccessLinkCard(
                    link = state.shareLink,
                    pillar = pillar,
                    // Copy really copies (the hub's clipboard pattern) — the
                    // wizard's primary CTA separately opens the share sheet.
                    onCopy = { clipboard.setText(AnnotatedString("https://${state.shareLink}")) },
                )
            }
        }
    }
}

/**
 * Success hero for the First-run wizard, pillar-tinted. Matches design
 * scheduling-setup-frames.jsx SuccessHero: 96dp outer halo in accentBg
 * (primary50) with a 60dp inner accent disc and a white check icon.
 * The shared SuccessHeroBlock always paints a neutral green circle, so
 * the wizard renders this pillar-correct hero locally.
 */
@Composable
private fun FirstRunSuccessHero(
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

/**
 * Resume banner shown at the top of step 3 when the user re-enters with
 * steps 1–2 already complete. Matches design scheduling-setup-frames.jsx
 * ResumeBanner: RefreshCw icon + pillar-tinted card.
 */
@Composable
private fun FirstRunResumeBanner(pillar: SchedulingPillar) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(pillar.accentBg)
                .border(1.dp, pillar.accent.copy(alpha = 0.25f), RoundedCornerShape(Radii.lg))
                .padding(14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(34.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, pillar.accent.copy(alpha = 0.25f), RoundedCornerShape(Radii.md)),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.RefreshCw,
                contentDescription = null,
                size = 17.dp,
                tint = pillar.accent,
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = "Pick up where you left off",
                color = PantopusColors.appText,
                fontWeight = FontWeight.Bold,
                fontSize = 13.sp,
                letterSpacing = (-0.1).sp,
            )
            Text(
                text = "Steps 1–2 are done. Set your hours to finish.",
                color = PantopusColors.appTextSecondary,
                fontSize = 11.5.sp,
            )
        }
    }
}
