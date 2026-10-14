package app.pantopus.android.ui.screens.compose.pulse

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.screens.feed.pulse.PulseIntent
import app.pantopus.android.ui.screens.shared.form.FormShell

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
    viewModel: PulseComposeViewModel = hiltViewModel(),
) {
    val draftLoad by viewModel.draftLoad.collectAsStateWithLifecycle()
    LaunchedEffect(viewModel) { viewModel.openDraft() }
    if (editingPostId == null && draftLoad != PulseDraftLoadState.Ready) {
        FormShell(title = "New post", isValid = false, isDirty = false, onClose = onBack, onCommit = {}) {
            when (val loading = draftLoad) {
                PulseDraftLoadState.Loading -> PulseComposePrefillSkeleton()
                is PulseDraftLoadState.Error -> PulseComposePrefillErrorView(loading.message, viewModel::openDraft)
                PulseDraftLoadState.Ready -> Unit
            }
        }
        return
    }
    var step by remember {
        mutableStateOf<PulseComposeFlowStep>(
            if (editingPostId != null) {
                PulseComposeFlowStep.Draft(PulsePostingTarget.Connections, null)
            } else if (viewModel.restoredDraftTarget != null) {
                PulseComposeFlowStep.Draft(checkNotNull(viewModel.restoredDraftTarget), viewModel.flowPurpose)
            } else {
                PulseComposeFlowStep.TargetPicker
            },
        )
    }

    Box(modifier = Modifier.fillMaxSize().testTag("pulseComposeFlow")) {
        when (val current = step) {
            PulseComposeFlowStep.TargetPicker ->
                PulsePostTargetPickerScreen(
                    onSelect = { target -> handleTargetSelected(target, prefillFeedIntent) { step = it } },
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
                    current.purpose ?: prefillPurpose(current.target, prefillFeedIntent)
                PulseComposeScreen(
                    onBack = onBack,
                    onPosted = onPosted,
                    flowTarget = current.target,
                    flowPurpose = resolvedPurpose,
                    viewModel = viewModel,
                )
            }
        }
    }
}

private fun handleTargetSelected(
    target: PulsePostingTarget,
    prefillFeedIntent: PulseIntent?,
    setStep: (PulseComposeFlowStep) -> Unit,
) {
    if (target.isNetworkTarget) {
        setStep(PulseComposeFlowStep.Draft(target, null))
        return
    }
    prefillPurpose(target, prefillFeedIntent)?.let { prefill ->
        setStep(PulseComposeFlowStep.Draft(target, prefill))
        return
    }
    setStep(PulseComposeFlowStep.PurposePicker(target))
}

private fun prefillPurpose(
    target: PulsePostingTarget,
    feedIntent: PulseIntent?,
): PulseComposePurpose? {
    if (feedIntent == null || feedIntent == PulseIntent.All) return null
    val composeIntent = PulseComposeIntent.fromFeedIntent(feedIntent)
    val candidate = PulseComposePurpose.entries.firstOrNull { it.legacyIntent == composeIntent } ?: return null
    return if (PulseComposePurpose.allowedFor(target).contains(candidate)) candidate else null
}
