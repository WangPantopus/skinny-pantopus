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
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.components.GhostButton
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

const val WAITLIST_JOIN_TAG = "scheduling.waitlistJoin"

/**
 * E13 (invitee) Waitlist Join sheet — a host-branded bottom sheet shown when an
 * event/slot is full. Collects a name + email (+ optional preferred time) and
 * joins the public waitlist; on success it swaps to an A18-style "you're on the
 * waitlist" confirmation. Stateless: the public flow drives it via
 * [WaitlistJoinViewModel].
 */
@Composable
internal fun WaitlistJoinSheet(
    state: WaitlistJoinUiState,
    sheetState: SheetState,
    accent: Color,
    onName: (String) -> Unit,
    onEmail: (String) -> Unit,
    onPreferredTime: (String) -> Unit,
    onJoin: () -> Unit,
    onDismiss: () -> Unit,
) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = PantopusColors.appSurface,
        modifier = Modifier.testTag(WAITLIST_JOIN_TAG),
    ) {
        if (state.alreadyJoined) {
            AlreadyJoinedState(accent = accent, onDone = onDismiss)
        } else if (state.didJoin) {
            JoinedConfirmation(accent = accent, onDone = onDismiss)
        } else {
            Column(
                modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4, vertical = Spacing.s2),
                verticalArrangement = Arrangement.spacedBy(Spacing.s4),
            ) {
                FullyBookedPill()
                Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                    Text(
                        text =
                            state.windowLabel.ifBlank {
                                "This time is full"
                            },
                        style = ExtrasType.header,
                        color = PantopusColors.appText,
                    )
                    Text(
                        text = "Join the waitlist and we'll text you the moment a spot opens.",
                        style = ExtrasType.body125,
                        color = PantopusColors.appTextSecondary,
                    )
                }
                if (state.timezoneLabel.isNotBlank()) {
                    TimezoneChip(label = state.timezoneLabel)
                }

                LabeledField("Your name") {
                    ExtrasInputField(
                        value = state.name,
                        onValueChange = onName,
                        placeholder = "Full name",
                        leadingIcon = PantopusIcon.User,
                        accent = accent,
                    )
                }
                LabeledField("Mobile") {
                    ExtrasInputField(
                        value = state.email,
                        onValueChange = onEmail,
                        placeholder = "For a text when a spot opens",
                        leadingIcon = PantopusIcon.Phone,
                        accent = accent,
                        keyboardType = KeyboardType.Phone,
                    )
                }
                LabeledField("Preferred time") {
                    ExtrasInputField(
                        value = state.preferredTime,
                        onValueChange = onPreferredTime,
                        placeholder = "Any morning works (optional)",
                        leadingIcon = PantopusIcon.Clock,
                        accent = accent,
                    )
                }

                state.error?.let { ExtrasInlineError(message = it) }

                PrimaryButton(
                    title = "Join waitlist",
                    onClick = onJoin,
                    modifier = Modifier.fillMaxWidth().padding(bottom = Spacing.s4),
                    isLoading = state.joining,
                    isEnabled = state.canJoin,
                )
            }
        }
    }
}

@Composable
private fun LabeledField(
    label: String,
    content: @Composable () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        ExtrasOverline(label)
        content()
    }
}

@Composable
private fun FullyBookedPill() {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.warningBg)
                .border(1.dp, PantopusColors.warningLight, RoundedCornerShape(Radii.pill))
                .padding(horizontal = Spacing.s3, vertical = Spacing.s1),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(icon = PantopusIcon.UsersRound, contentDescription = null, size = 13.dp, tint = PantopusColors.warning)
        Text(text = "Fully booked", style = PantopusTextStyle.caption, fontWeight = FontWeight.SemiBold, color = PantopusColors.warning)
    }
}

@Composable
private fun TimezoneChip(label: String) {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.appSurfaceSunken)
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(icon = PantopusIcon.Globe, contentDescription = null, size = 13.dp, tint = PantopusColors.appTextSecondary)
        Text(text = label, style = PantopusTextStyle.caption, fontWeight = FontWeight.Medium, color = PantopusColors.appTextStrong)
    }
}

/**
 * E13 Frame 3 — FrameAlready. Shown when the invitee's contact is already on the
 * waitlist (409 from the join API). Design: clock icon on accentBg disc,
 * 'You're already waiting' title, 'Leave waitlist' ghost CTA.
 * Join date is omitted: the 409 response carries no waitlist entry data.
 */
@Composable
private fun AlreadyJoinedState(
    accent: Color,
    onDone: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4, vertical = Spacing.s6),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(74.dp)
                    .clip(CircleShape)
                    .background(accent.copy(alpha = ACCENT_DISC_ALPHA))
                    .border(1.dp, accent.copy(alpha = ACCENT_RING_ALPHA), CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon = PantopusIcon.Clock, contentDescription = null, size = 34.dp, tint = accent)
        }
        Text(
            text = "You're already waiting",
            style = ExtrasType.header.copy(fontSize = 17.5.sp),
            color = PantopusColors.appText,
            textAlign = TextAlign.Center,
        )
        Text(
            text = "We'll text you the moment a spot opens.",
            style = ExtrasType.body13,
            color = PantopusColors.appTextSecondary,
            textAlign = TextAlign.Center,
        )
        GhostButton(
            title = "Leave waitlist",
            onClick = onDone,
            modifier = Modifier.fillMaxWidth().padding(top = Spacing.s2, bottom = Spacing.s4),
        )
    }
}

private const val ACCENT_DISC_ALPHA = 0.12f
private const val ACCENT_RING_ALPHA = 0.25f

@Composable
private fun JoinedConfirmation(
    accent: Color,
    onDone: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4, vertical = Spacing.s6),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(74.dp)
                    .clip(CircleShape)
                    .background(PantopusColors.successBg)
                    .border(1.dp, PantopusColors.successLight, CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon = PantopusIcon.Check, contentDescription = null, size = 34.dp, tint = PantopusColors.success)
        }
        Text(
            text = "You're on the waitlist",
            style = ExtrasType.header.copy(fontSize = 17.5.sp),
            color = PantopusColors.appText,
            textAlign = TextAlign.Center,
        )
        Text(
            text = "We'll text you the moment a spot frees up.",
            style = ExtrasType.body13,
            color = PantopusColors.appTextSecondary,
            textAlign = TextAlign.Center,
        )
        // Design (waitlist-frames.jsx:154) specifies 'Leave waitlist' ghost CTA.
        // No backend leave-waitlist endpoint exists yet; the button dismisses the
        // sheet. When the leave endpoint ships, wire onDone to a dedicated onLeave
        // callback that calls DELETE /waitlist/:id.
        GhostButton(
            title = "Leave waitlist",
            onClick = onDone,
            modifier = Modifier.fillMaxWidth().padding(top = Spacing.s2, bottom = Spacing.s4),
        )
    }
}
