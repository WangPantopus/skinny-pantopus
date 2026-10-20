package app.pantopus.android.ui.screens.compose.pulse

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import app.pantopus.android.ui.screens.feed.pulse.PulseIntent

private sealed interface PulseComposeFlowStep {
    data object TargetPicker : PulseComposeFlowStep

    data class PurposePicker(val target: PulsePostingTarget) : PulseComposeFlowStep

    data class Draft(val target: PulsePostingTarget, val purpose: PulseComposePurpose?) : PulseComposeFlowStep
}

/**
 * Three-step Pulse post composer: target → purpose → draft.
 * Edit mode skips straight to the draft step.
 */
@Composable
fun PulseComposeFlowScreen(
    onBack: () -> Unit,
    onPosted: (String?) -> Unit = {},
    prefillFeedIntent: PulseIntent? = null,
    editingPostId: String? = null,
    /** A Pantopus AI post draft's exact type picks the purpose; its other fields seed the draft step. */
    prefillDraft: PulseComposeDraftFields? = null,
) {
    var step by remember {
        mutableStateOf<PulseComposeFlowStep>(
            if (editingPostId != null) {
                PulseComposeFlowStep.Draft(PulsePostingTarget.Connections, null)
            } else {
                PulseComposeFlowStep.TargetPicker
            },
        )
    }

    Box(modifier = Modifier.fillMaxSize().testTag("pulseComposeFlow")) {
        when (val current = step) {
            PulseComposeFlowStep.TargetPicker ->
                PulsePostTargetPickerScreen(
                    onSelect = { target -> handleTargetSelected(target, prefillFeedIntent, prefillDraft) { step = it } },
                    onCancel = onBack,
                )
            is PulseComposeFlowStep.PurposePicker ->
                PulsePostPurposePickerScreen(
                    target = current.target,
                    onSelect = { purpose -> step = PulseComposeFlowStep.Draft(current.target, purpose) },
                    onBack = { step = PulseComposeFlowStep.TargetPicker },
                )
            is PulseComposeFlowStep.Draft -> {
                val resolvedPurpose =
                    current.purpose ?: prefillPurpose(current.target, prefillFeedIntent, prefillDraft)
                PulseComposeScreen(
                    onBack = onBack,
                    onPosted = onPosted,
                    flowTarget = current.target,
                    flowPurpose = resolvedPurpose,
                )
            }
        }
    }
}

private fun handleTargetSelected(
    target: PulsePostingTarget,
    prefillFeedIntent: PulseIntent?,
    prefillDraft: PulseComposeDraftFields?,
    setStep: (PulseComposeFlowStep) -> Unit,
) {
    if (target.isNetworkTarget) {
        setStep(PulseComposeFlowStep.Draft(target, null))
        return
    }
    prefillPurpose(target, prefillFeedIntent, prefillDraft)?.let { prefill ->
        setStep(PulseComposeFlowStep.Draft(target, prefill))
        return
    }
    setStep(PulseComposeFlowStep.PurposePicker(target))
}

private fun prefillPurpose(
    target: PulsePostingTarget,
    feedIntent: PulseIntent?,
    draft: PulseComposeDraftFields? = null,
): PulseComposePurpose? {
    // A deal, a local update or a win is its own purpose, not the first one sharing its form.
    draft?.purposeFor(target)?.let { return it }
    if (feedIntent == null || feedIntent == PulseIntent.All || feedIntent == PulseIntent.Generic) return null
    val composeIntent = PulseComposeIntent.fromFeedIntent(feedIntent)
    val candidate = PulseComposePurpose.entries.firstOrNull { it.legacyIntent == composeIntent } ?: return null
    return if (PulseComposePurpose.allowedFor(target).contains(candidate)) candidate else null
}
