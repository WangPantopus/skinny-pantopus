@file:Suppress("PackageNaming", "LongMethod", "MagicNumber", "LongParameterList", "TooManyFunctions")

package app.pantopus.android.ui.screens.support_trains.manage.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.support_trains.SupportTrainFundDto
import app.pantopus.android.ui.screens.support_trains.detail.SupportTrainViewerRole
import app.pantopus.android.ui.screens.support_trains.manage.ManageHelperRow
import app.pantopus.android.ui.screens.support_trains.manage.ManageOrganizerRow
import app.pantopus.android.ui.screens.support_trains.manage.ManageSlotRow
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * S1 — the Manage-train control stacks: dates, helper roster,
 * co-organizers, the open-slots nudge, the gift fund and the lifecycle
 * rows. All stateless: the screen passes rows + lambdas so previews and
 * Paparazzi snapshots render without a view-model. Mirrors the iOS
 * `OrganizerControlsSections.swift`.
 */

@Composable
fun ManageSectionHeader(
    title: String,
    actionLabel: String? = null,
    actionTag: String? = null,
    onAction: (() -> Unit)? = null,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = title.uppercase(),
            color = PantopusColors.appTextSecondary,
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            letterSpacing = 0.66.sp,
            modifier = Modifier.semantics { heading() },
        )
        Spacer(modifier = Modifier.weight(1f))
        if (actionLabel != null && onAction != null) {
            Text(
                text = actionLabel,
                color = PantopusColors.primary600,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                modifier =
                    Modifier
                        .clickable(onClick = onAction)
                        .padding(Spacing.s1)
                        .testTag(actionTag ?: "manageTrainSectionAction"),
            )
        }
    }
}

@Composable
fun ManageCard(content: @Composable () -> Unit) {
    val shape = RoundedCornerShape(Radii.lg)
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(shape)
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, shape)
                .padding(Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        content()
    }
}

@Composable
fun ManagePillButton(
    label: String,
    icon: PantopusIcon,
    tag: String,
    onClick: () -> Unit,
    destructive: Boolean = false,
    isEnabled: Boolean = true,
) {
    val shape = RoundedCornerShape(Radii.md)
    val tint = if (destructive) PantopusColors.error else PantopusColors.appText
    Row(
        modifier =
            Modifier
                .height(34.dp)
                .clip(shape)
                .background(if (destructive) PantopusColors.errorBg else PantopusColors.appSurface)
                .border(1.dp, if (destructive) PantopusColors.errorLight else PantopusColors.appBorder, shape)
                .clickable(enabled = isEnabled, onClick = onClick)
                .alpha(if (isEnabled) 1f else 0.5f)
                .padding(horizontal = Spacing.s3)
                .testTag(tag)
                .semantics {
                    role = Role.Button
                    contentDescription = label
                },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 13.dp, tint = tint)
        Text(text = label, color = tint, fontSize = 12.5.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
fun ManageDatesSection(
    rows: List<ManageSlotRow>,
    isBusy: Boolean,
    onAdd: () -> Unit,
    onEdit: (ManageSlotRow) -> Unit,
    onRemove: (ManageSlotRow) -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth().testTag("manageTrainDatesSection"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        ManageSectionHeader(
            title = "Dates (${rows.size})",
            actionLabel = "Add date",
            actionTag = "manageTrainAddDateButton",
            onAction = onAdd,
        )
        Text(
            text =
                "Add a new date, move an open one, or remove one you no longer need. " +
                    "If someone already signed up, remove the helper first.",
            color = PantopusColors.appTextSecondary,
            fontSize = 12.5.sp,
        )
        if (rows.isEmpty()) {
            ManageCard {
                Text(text = "No dates added yet", color = PantopusColors.appTextMuted, fontSize = 13.sp)
            }
        }
        rows.forEach { row ->
            ManageCard {
                Row(verticalAlignment = Alignment.Top, modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = row.dateLabel,
                            color = PantopusColors.appText,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.SemiBold,
                        )
                        Text(text = row.metaLabel, color = PantopusColors.appTextSecondary, fontSize = 12.sp)
                    }
                    Text(
                        text = row.badge,
                        color = PantopusColors.appTextSecondary,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
                if (row.isEditable) {
                    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                        ManagePillButton(
                            label = "Edit",
                            icon = PantopusIcon.Pencil,
                            tag = "manageTrainEditDate-${row.id}",
                            isEnabled = !isBusy,
                            onClick = { onEdit(row) },
                        )
                        ManagePillButton(
                            label = "Remove",
                            icon = PantopusIcon.Trash2,
                            tag = "manageTrainRemoveDate-${row.id}",
                            destructive = true,
                            isEnabled = !isBusy,
                            onClick = { onRemove(row) },
                        )
                    }
                } else {
                    Text(
                        text = "A helper already has this date. Remove their signup before changing it.",
                        color = PantopusColors.appTextMuted,
                        fontSize = 12.sp,
                    )
                }
            }
        }
    }
}

@Composable
fun ManageHelpersSection(
    rows: List<ManageHelperRow>,
    isBusy: Boolean,
    onShareAddress: (ManageHelperRow) -> Unit,
    onConfirm: (ManageHelperRow) -> Unit,
    onRemove: (ManageHelperRow) -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth().testTag("manageTrainHelpersSection"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        ManageSectionHeader(title = "Helpers (${rows.size})")
        if (rows.isEmpty()) {
            ManageCard {
                Text(text = "No signups yet", color = PantopusColors.appTextMuted, fontSize = 13.sp)
            }
        }
        rows.forEach { row ->
            ManageCard {
                Row(verticalAlignment = Alignment.Top, modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = row.name,
                            color = PantopusColors.appText,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.SemiBold,
                        )
                        if (row.slotLabel.isNotBlank()) {
                            Text(
                                text = row.slotLabel,
                                color = PantopusColors.appTextSecondary,
                                fontSize = 12.sp,
                            )
                        }
                        if (row.contribution.isNotBlank()) {
                            Text(
                                text = row.contribution,
                                color = PantopusColors.appTextMuted,
                                fontSize = 12.sp,
                            )
                        }
                    }
                    Text(
                        text = row.status.replaceFirstChar { it.uppercase() },
                        color = PantopusColors.appTextSecondary,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
                Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    if (row.canShareAddress) {
                        ManagePillButton(
                            label = if (row.isGuest) "Email address" else "Share address",
                            icon = PantopusIcon.MapPin,
                            tag = "manageTrainShareAddress-${row.id}",
                            isEnabled = !isBusy,
                            onClick = { onShareAddress(row) },
                        )
                    } else if (row.status != "canceled") {
                        Text(
                            text = if (row.isGuest) "Exact location sent" else "Exact location shared",
                            color = PantopusColors.success,
                            fontSize = 11.5.sp,
                        )
                    }
                    if (row.canConfirm) {
                        ManagePillButton(
                            label = "Confirm delivery",
                            icon = PantopusIcon.CheckCircle,
                            tag = "manageTrainConfirmDelivery-${row.id}",
                            isEnabled = !isBusy,
                            onClick = { onConfirm(row) },
                        )
                    }
                    if (row.canRemove) {
                        ManagePillButton(
                            label = "Remove",
                            icon = PantopusIcon.UserMinus,
                            tag = "manageTrainRemoveHelper-${row.id}",
                            destructive = true,
                            isEnabled = !isBusy,
                            onClick = { onRemove(row) },
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun ManageOrganizersSection(
    rows: List<ManageOrganizerRow>,
    /** Only the primary organizer may edit the roster (`supportTrains.js:1055`). */
    canEdit: Boolean,
    isBusy: Boolean,
    newOrganizerUserId: String,
    onUserIdChange: (String) -> Unit,
    onAdd: () -> Unit,
    onRemove: (ManageOrganizerRow) -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth().testTag("manageTrainOrganizersSection"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        ManageSectionHeader(title = "Co-organizers")
        rows.forEach { row ->
            ManageCard {
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = row.name,
                            color = PantopusColors.appText,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.SemiBold,
                        )
                        Text(
                            text = row.role.replace("_", " ").replaceFirstChar { it.uppercase() },
                            color = PantopusColors.appTextSecondary,
                            fontSize = 12.sp,
                        )
                    }
                    if (canEdit && !row.isPrimary) {
                        ManagePillButton(
                            label = "Remove",
                            icon = PantopusIcon.UserMinus,
                            tag = "manageTrainRemoveOrganizer-${row.id}",
                            destructive = true,
                            isEnabled = !isBusy,
                            onClick = { onRemove(row) },
                        )
                    }
                }
            }
        }
        if (canEdit) {
            ManageCard {
                Text(
                    text = "Add a co-organizer by user id",
                    color = PantopusColors.appTextSecondary,
                    fontSize = 12.5.sp,
                    fontWeight = FontWeight.SemiBold,
                )
                ManageTextField(
                    value = newOrganizerUserId,
                    placeholder = "User id",
                    tag = "manageTrainOrganizerIdField",
                    onValueChange = onUserIdChange,
                )
                ManagePillButton(
                    label = "Add co-organizer",
                    icon = PantopusIcon.UserPlus,
                    tag = "manageTrainAddOrganizerButton",
                    isEnabled = !isBusy && newOrganizerUserId.isNotBlank(),
                    onClick = onAdd,
                )
            }
        }
    }
}

@Composable
fun ManageNudgeSection(
    openSlotCount: Int,
    draft: String?,
    isBusy: Boolean,
    onDraft: () -> Unit,
    onEditDraft: (String) -> Unit,
    onSend: () -> Unit,
    onDiscard: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth().testTag("manageTrainNudgeSection"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        ManageSectionHeader(title = "Remind helpers")
        if (openSlotCount == 0) {
            ManageCard {
                Text(text = "All slots are filled!", color = PantopusColors.appTextMuted, fontSize = 13.sp)
            }
        } else {
            ManageCard {
                Text(
                    text = "$openSlotCount open ${if (openSlotCount == 1) "date" else "dates"}. Draft a reminder for the campaign chat.",
                    color = PantopusColors.appTextSecondary,
                    fontSize = 12.5.sp,
                )
                if (draft == null) {
                    ManagePillButton(
                        label = "Draft a reminder",
                        icon = PantopusIcon.Megaphone,
                        tag = "manageTrainDraftNudgeButton",
                        isEnabled = !isBusy,
                        onClick = onDraft,
                    )
                } else {
                    ManageTextField(
                        value = draft,
                        placeholder = "Reminder message",
                        tag = "manageTrainNudgeDraftField",
                        minHeight = 90.dp,
                        onValueChange = onEditDraft,
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                        ManagePillButton(
                            label = "Send to chat",
                            icon = PantopusIcon.Send,
                            tag = "manageTrainSendNudgeButton",
                            isEnabled = !isBusy && draft.isNotBlank(),
                            onClick = onSend,
                        )
                        ManagePillButton(
                            label = "Discard",
                            icon = PantopusIcon.X,
                            tag = "manageTrainDiscardNudgeButton",
                            isEnabled = !isBusy,
                            onClick = onDiscard,
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun ManageFundSection(
    fund: SupportTrainFundDto?,
    /** Enabling is primary + co-organizer; disabling is primary-only. */
    canDisable: Boolean,
    isBusy: Boolean,
    goalDollars: String,
    onGoalChange: (String) -> Unit,
    onEnable: () -> Unit,
    onDisable: () -> Unit,
) {
    val isEnabled = fund?.enabled == true
    Column(
        modifier = Modifier.fillMaxWidth().testTag("manageTrainFundSection"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        ManageSectionHeader(title = "Gift fund")
        ManageCard {
            if (isEnabled) {
                Text(
                    text = fundTotalLabel(fund),
                    color = PantopusColors.appText,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(
                    text = "Neighbors can chip in from the train's page.",
                    color = PantopusColors.appTextSecondary,
                    fontSize = 12.5.sp,
                )
            } else {
                Text(
                    text = "Let neighbors chip in money as well as meals.",
                    color = PantopusColors.appTextSecondary,
                    fontSize = 12.5.sp,
                )
            }
            ManageTextField(
                value = goalDollars,
                placeholder = "Goal in dollars (optional)",
                tag = "manageTrainFundGoalField",
                onValueChange = onGoalChange,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                ManagePillButton(
                    label = if (isEnabled) "Update goal" else "Enable fund",
                    icon = PantopusIcon.Gift,
                    tag = "manageTrainEnableFundButton",
                    isEnabled = !isBusy,
                    onClick = onEnable,
                )
                if (isEnabled && canDisable) {
                    ManagePillButton(
                        label = "Disable fund",
                        icon = PantopusIcon.X,
                        tag = "manageTrainDisableFundButton",
                        destructive = true,
                        isEnabled = !isBusy,
                        onClick = onDisable,
                    )
                }
            }
        }
    }
}

private fun fundTotalLabel(fund: SupportTrainFundDto?): String {
    val total = (fund?.totalAmount ?: 0) / 100
    val goal = fund?.goalAmount
    return if (goal != null && goal > 0) "$$total of $${goal / 100} goal" else "$$total raised"
}

@Composable
fun ManageLifecycleSection(
    status: String,
    viewerRole: SupportTrainViewerRole,
    isBusy: Boolean,
    onPause: () -> Unit,
    onResume: () -> Unit,
    onUnpublish: () -> Unit,
    onArchive: () -> Unit,
    onDelete: () -> Unit,
) {
    val isLive = status == "published" || status == "active"
    val isPrimary = viewerRole == SupportTrainViewerRole.PRIMARY_ORGANIZER
    Column(
        modifier = Modifier.fillMaxWidth().testTag("manageTrainLifecycleSection"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        ManageSectionHeader(title = "Train status · ${status.replaceFirstChar { it.uppercase() }}")
        ManageCard {
            if (isLive) {
                ManagePillButton(
                    label = "Pause train",
                    icon = PantopusIcon.Pause,
                    tag = "manageTrainPauseButton",
                    isEnabled = !isBusy,
                    onClick = onPause,
                )
            }
            if (status == "paused") {
                ManagePillButton(
                    label = "Resume train",
                    icon = PantopusIcon.Play,
                    tag = "manageTrainResumeButton",
                    isEnabled = !isBusy,
                    onClick = onResume,
                )
            }
            if (isLive && isPrimary) {
                ManagePillButton(
                    label = "Unpublish (back to draft)",
                    icon = PantopusIcon.EyeOff,
                    tag = "manageTrainUnpublishButton",
                    destructive = true,
                    isEnabled = !isBusy,
                    onClick = onUnpublish,
                )
            }
            if (status == "completed" && isPrimary) {
                ManagePillButton(
                    label = "Archive train",
                    icon = PantopusIcon.Archive,
                    tag = "manageTrainArchiveButton",
                    destructive = true,
                    isEnabled = !isBusy,
                    onClick = onArchive,
                )
            }
            if (isPrimary) {
                ManagePillButton(
                    label = "Delete train",
                    icon = PantopusIcon.Trash2,
                    tag = "manageTrainDeleteButton",
                    destructive = true,
                    isEnabled = !isBusy,
                    onClick = onDelete,
                )
                Text(
                    text =
                        "Permanent. Only possible while no helper has committed and no " +
                            "gift-fund money has come in.",
                    color = PantopusColors.appTextMuted,
                    fontSize = 11.5.sp,
                )
            }
        }
    }
}

@Composable
private fun ManageTextField(
    value: String,
    placeholder: String,
    tag: String,
    onValueChange: (String) -> Unit,
    minHeight: androidx.compose.ui.unit.Dp = 56.dp,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        modifier = Modifier.fillMaxWidth().heightIn(min = minHeight).testTag(tag),
        colors =
            OutlinedTextFieldDefaults.colors(
                focusedContainerColor = PantopusColors.appSurface,
                unfocusedContainerColor = PantopusColors.appSurface,
                focusedBorderColor = PantopusColors.primary600,
                unfocusedBorderColor = PantopusColors.appBorder,
            ),
        placeholder = {
            Text(text = placeholder, color = PantopusColors.appTextMuted, fontSize = 14.sp)
        },
    )
}
