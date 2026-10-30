package app.pantopus.android.ui.screens.compose.pulse

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.Saver
import androidx.compose.runtime.saveable.listSaver
import androidx.compose.runtime.saveable.rememberSaveable
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
    /** "Before you ask": opens an earlier post over the composer. */
    onOpenPost: (String) -> Unit = {},
) {
    // Saved, so the draft step is still there when an opened post comes back to it.
    var step by rememberSaveable(stateSaver = FlowStepSaver) {
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
                    onOpenPost = onOpenPost,
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
    // A filtered feed opens its own type's form too (Deals opens Deal); All and Generic have no type.
    val postType = feedIntent?.postType ?: return null
    val candidate = PulseComposePurpose.entries.firstOrNull { it.postType == postType } ?: return null
    return if (PulseComposePurpose.allowedFor(target).contains(candidate)) candidate else null
}

/** The flow's step as saveable parts: its kind, the purpose's name, then the target. */
private val FlowStepSaver: Saver<PulseComposeFlowStep, Any> =
    listSaver(
        save = { step ->
            when (step) {
                PulseComposeFlowStep.TargetPicker -> listOf("picker")
                is PulseComposeFlowStep.PurposePicker -> listOf("purpose", "") + targetParts(step.target)
                is PulseComposeFlowStep.Draft -> listOf("draft", step.purpose?.name.orEmpty()) + targetParts(step.target)
            }
        },
        restore = { parts ->
            val target = targetFrom(parts.drop(2))
            when {
                parts.firstOrNull() == "purpose" && target != null -> PulseComposeFlowStep.PurposePicker(target)
                parts.firstOrNull() == "draft" && target != null ->
                    PulseComposeFlowStep.Draft(target, PulseComposePurpose.entries.firstOrNull { it.name == parts.getOrNull(1) })
                else -> PulseComposeFlowStep.TargetPicker
            }
        },
    )

private fun targetParts(target: PulsePostingTarget): List<Any> =
    when (target) {
        is PulsePostingTarget.CurrentLocation -> listOf("current", target.lat, target.lng, target.displayLabel, "")
        is PulsePostingTarget.Home -> listOf("home", target.lat, target.lng, target.displayLabel, target.homeId)
        PulsePostingTarget.Connections -> listOf("connections", 0.0, 0.0, "", "")
    }

// Where [targetParts] puts each part.
private const val PART_KIND = 0
private const val PART_LAT = 1
private const val PART_LNG = 2
private const val PART_LABEL = 3
private const val PART_HOME_ID = 4

private fun targetFrom(parts: List<Any?>): PulsePostingTarget? {
    val kind = parts.getOrNull(PART_KIND)
    if (kind == "connections") return PulsePostingTarget.Connections
    val lat = parts.getOrNull(PART_LAT) as? Double
    val lng = parts.getOrNull(PART_LNG) as? Double
    val label = parts.getOrNull(PART_LABEL) as? String
    if (lat == null || lng == null || label == null) return null
    return when (kind) {
        "current" -> PulsePostingTarget.CurrentLocation(lat, lng, label)
        "home" -> (parts.getOrNull(PART_HOME_ID) as? String)?.let { PulsePostingTarget.Home(it, lat, lng, label) }
        else -> null
    }
}
