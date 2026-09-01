@file:Suppress(
    "PackageNaming",
    "LongMethod",
    "LongParameterList",
    "TooManyFunctions",
    "CyclomaticComplexMethod",
    "LargeClass",
    "MatchingDeclarationName",
)
@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package app.pantopus.android.ui.screens.scheduling.bookings_extra

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.SheetState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

const val NUDGE_TAG = "scheduling.sendNudge"

enum class NudgeAudience(val label: String) {
    All("All attendees"),
    Confirmed("Confirmed only"),
    NoShows("No-shows"),
}

data class NudgeAudienceCounts(
    val all: Int = 0,
    val confirmed: Int = 0,
    val noShows: Int = 0,
) {
    fun count(audience: NudgeAudience): Int =
        when (audience) {
            NudgeAudience.All -> all
            NudgeAudience.Confirmed -> confirmed
            NudgeAudience.NoShows -> noShows
        }
}

data class NudgeTemplate(
    val id: String,
    val title: String,
    val body: String,
)

data class NudgeSheetState(
    val subtitle: String,
    val message: String = "",
    val audience: NudgeAudience = NudgeAudience.All,
    val counts: NudgeAudienceCounts = NudgeAudienceCounts(),
    val pushOn: Boolean = true,
    val emailOn: Boolean = false,
    val sending: Boolean = false,
    val error: String? = null,
    val templates: List<NudgeTemplate> = emptyList(),
    val templatePickerOpen: Boolean = false,
    val didSend: Boolean = false,
    val sentCount: Int = 0,
) {
    val over: Boolean get() = message.length > MESSAGE_LIMIT
    val recipientCount: Int get() = counts.count(audience)
    val canSend: Boolean get() = message.isNotBlank() && !over && recipientCount > 0 && !sending

    companion object {
        const val MESSAGE_LIMIT = 280
    }
}

/**
 * E11 Send a Nudge / Manual Follow-up — the ManageTrain SendUpdateForm pointed
 * at a booking/group. A composer with a live counter, a single-select audience
 * (All / Confirmed / No-shows, each with its recipient count), Push/Email
 * channel toggles, and a count-echoing CTA ("Send to 12"). Audience + channel
 * are presentation-only; the backend nudge carries the message and fans out to
 * each selected booking's invitee.
 */
@Composable
internal fun NudgeSheet(
    state: NudgeSheetState,
    sheetState: SheetState,
    accent: Color,
    onMessageChange: (String) -> Unit,
    onAudience: (NudgeAudience) -> Unit,
    onPushChange: (Boolean) -> Unit,
    onEmailChange: (Boolean) -> Unit,
    onUseTemplate: () -> Unit,
    onTemplatePicked: (NudgeTemplate) -> Unit,
    onTemplateDismiss: () -> Unit,
    onSend: () -> Unit,
    onDismiss: () -> Unit,
) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = PantopusColors.appSurface,
        modifier = Modifier.testTag(NUDGE_TAG),
    ) {
        if (state.didSend) {
            NudgeSuccess(sentCount = state.sentCount)
            return@ModalBottomSheet
        }
        Column(
            modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4, vertical = Spacing.s2),
            verticalArrangement = Arrangement.spacedBy(Spacing.s4),
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                Text(text = "Message attendees", style = ExtrasType.header, color = PantopusColors.appText)
                Text(text = state.subtitle, style = ExtrasType.body125, color = PantopusColors.appTextSecondary)
            }

            Box {
                ExtrasChipButton(label = "Use a template", icon = PantopusIcon.FileText, onClick = onUseTemplate, accent = accent)
                DropdownMenu(expanded = state.templatePickerOpen, onDismissRequest = onTemplateDismiss) {
                    if (state.templates.isEmpty()) {
                        DropdownMenuItem(text = { Text("No templates yet") }, onClick = onTemplateDismiss)
                    } else {
                        state.templates.forEach { template ->
                            DropdownMenuItem(text = { Text(template.title) }, onClick = { onTemplatePicked(template) })
                        }
                    }
                }
            }

            ExtrasMessageBox(
                value = state.message,
                onValueChange = onMessageChange,
                placeholder = "Write a quick update for your attendees…",
                accent = accent,
                limit = NudgeSheetState.MESSAGE_LIMIT,
            )
            if (state.over) {
                ExtrasInlineError(message = "Shorten your message")
            }

            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                ExtrasOverline("Audience")
                ExtrasChipFlow {
                    NudgeAudience.entries.forEach { option ->
                        ExtrasPillChip(
                            label = "${option.label} · ${state.counts.count(option)}",
                            selected = state.audience == option,
                            onClick = { onAudience(option) },
                            accent = accent,
                        )
                    }
                }
                if (state.recipientCount == 0) {
                    Row(
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(Radii.lg))
                                .background(PantopusColors.appSurfaceSunken)
                                .border(BorderStroke(1.dp, PantopusColors.appBorder), RoundedCornerShape(Radii.lg))
                                .padding(horizontal = Spacing.s3, vertical = Spacing.s3),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                    ) {
                        PantopusIconImage(
                            icon = PantopusIcon.UsersRound,
                            contentDescription = null,
                            size = 15.dp,
                            tint = PantopusColors.appTextMuted,
                        )
                        Text(
                            text = "No one to message in this group",
                            style = ExtrasType.detail11,
                            fontWeight = FontWeight.SemiBold,
                            color = PantopusColors.appTextSecondary,
                        )
                    }
                }
            }

            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                ExtrasChannelRow(
                    icon = PantopusIcon.Bell,
                    label = "Push",
                    checked = state.pushOn,
                    onCheckedChange = onPushChange,
                    accent = accent,
                )
                ExtrasChannelRow(
                    icon = PantopusIcon.Mail,
                    label = "Email",
                    checked = state.emailOn,
                    onCheckedChange = onEmailChange,
                    accent = accent,
                )
            }

            state.error?.let { ExtrasInlineError(message = it) }
        }

        // Sticky CTA footer: top hairline over the surface, a leading send glyph,
        // and the count-echoing label (JSX `<send/> Send to 12`).
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .background(PantopusColors.appSurface),
        ) {
            HorizontalDivider(color = PantopusColors.appBorder)
            ExtrasIconLabelButton(
                icon = PantopusIcon.Send,
                label = if (state.recipientCount > 0) "Send to ${state.recipientCount}" else "Send",
                onClick = onSend,
                modifier = Modifier.fillMaxWidth().padding(start = Spacing.s4, end = Spacing.s4, top = Spacing.s2, bottom = Spacing.s4),
                accent = accent,
                enabled = state.canSend,
                loading = state.sending,
            )
        }
    }
}

/**
 * JSX frame 3 (Sent): a centered 72dp success disc with a heavy check, an
 * "Update sent" title, and a dark pinned bottom count toast. Mirrors iOS
 * `SendNudgeSheet.successOverlay`.
 */
@Composable
private fun NudgeSuccess(sentCount: Int) {
    Box(modifier = Modifier.fillMaxWidth().height(NUDGE_SUCCESS_HEIGHT)) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s6),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(Spacing.s4, Alignment.CenterVertically),
        ) {
            Box(
                modifier =
                    Modifier
                        .size(72.dp)
                        .clip(CircleShape)
                        .background(PantopusColors.successBg)
                        .border(1.dp, PantopusColors.successLight, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(icon = PantopusIcon.Check, contentDescription = null, size = 34.dp, tint = PantopusColors.success)
            }
            Text(text = "Update sent", style = ExtrasType.header, color = PantopusColors.appText)
        }
        Row(
            modifier =
                Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .padding(horizontal = Spacing.s4, vertical = Spacing.s5)
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.appText)
                    .padding(horizontal = Spacing.s3 + 2.dp, vertical = Spacing.s3),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2 + 2.dp),
        ) {
            PantopusIconImage(icon = PantopusIcon.CheckCircle, contentDescription = null, size = 18.dp, tint = PantopusColors.successLight)
            Text(
                text = "Update sent to $sentCount ${if (sentCount == 1) "attendee" else "attendees"}",
                style = ExtrasType.body125,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appTextInverse,
            )
        }
    }
}

private val NUDGE_SUCCESS_HEIGHT = 360.dp
