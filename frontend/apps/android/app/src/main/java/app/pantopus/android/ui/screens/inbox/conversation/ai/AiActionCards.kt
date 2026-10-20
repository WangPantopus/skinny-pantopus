@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.inbox.conversation.ai

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.components.PantopusButton
import app.pantopus.android.ui.components.PantopusButtonKind
import app.pantopus.android.ui.screens.inbox.conversation.ChatAIActionCard
import app.pantopus.android.ui.screens.inbox.conversation.ChatAICardAction
import app.pantopus.android.ui.screens.inbox.conversation.ChatAICardItem
import app.pantopus.android.ui.screens.inbox.conversation.ChatAICardLine
import app.pantopus.android.ui.screens.inbox.conversation.ChatAICardRun
import app.pantopus.android.ui.screens.inbox.conversation.ChatAILink
import app.pantopus.android.ui.screens.inbox.conversation.ChatPromptChip
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * An action card in an assistant reply (AI assistant phase 1 contract, section 4.3): the title, the
 * label/value lines, warnings in the caution style, one row per person with its own buttons, then the
 * card's buttons and "Not now". A button that ran shows its done label (with Open when it has a screen to
 * open) or the server's message; every button waits while a request runs.
 *
 * @param canOpen whether the app can open a done link; links it can't open show no Open button.
 */
@Composable
internal fun AiActionCard(
    card: ChatAIActionCard,
    onAction: (scope: String, action: ChatAICardAction) -> Unit,
    onDismiss: () -> Unit,
    onOpenLink: (String) -> Unit,
    canOpen: (String) -> Boolean,
) {
    // "Not now" puts the card away on this phone, after a relaunch too.
    if (card.dismissed) return
    val expired = card.isExpired()
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.magic.copy(alpha = 0.22f), RoundedCornerShape(Radii.lg))
                .padding(Spacing.s3)
                .testTag("chatAIAction_${card.card}"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        AiActionCardHeader(card = card, expired = expired)
        Text(text = card.title, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appText)
        card.lines.forEach { AiCardLineRow(it) }
        card.warnings.forEach { AiCardWarning(it) }
        card.items.forEach { item ->
            AiActionCardItem(item = item) {
                AiCardButtons(card, item.id, item.actions, expired, onAction, onOpenLink, canOpen)
            }
        }
        AiCardButtons(card, ChatAIActionCard.CARD_SCOPE, card.actions, expired, onAction, onOpenLink, canOpen)
        AiActionCardFooter(card = card, expired = expired, onDismiss = onDismiss, modifier = Modifier.align(Alignment.CenterHorizontally))
    }
}

/** The card's kind, with "Done" or "Expired" at the end. */
@Composable
private fun AiActionCardHeader(
    card: ChatAIActionCard,
    expired: Boolean,
) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        PantopusIconImage(
            icon = actionCardIcon(card.card),
            contentDescription = null,
            size = 14.dp,
            tint = PantopusColors.magic,
            modifier =
                Modifier
                    .size(26.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.magicBg)
                    .padding(6.dp),
        )
        Text(
            text = actionCardLabel(card.card).uppercase(),
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.magic,
        )
        Spacer(modifier = Modifier.weight(1f))
        when {
            card.isFinished -> AiCardStatus("Done", PantopusColors.success)
            expired -> AiCardStatus("Expired", PantopusColors.appTextMuted)
        }
    }
}

@Composable
private fun AiCardStatus(
    text: String,
    color: Color,
) {
    Text(text = text, fontSize = 10.sp, fontWeight = FontWeight.SemiBold, color = color)
}

/** One person asking to join, with their own buttons. */
@Composable
private fun AiActionCardItem(
    item: ChatAICardItem,
    buttons: @Composable () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurfaceSunken)
                .padding(Spacing.s2)
                .testTag("chatAIActionItem_${item.id}"),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        if (item.title.isNotEmpty()) {
            Text(text = item.title, fontSize = 12.5.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
        }
        item.lines.forEach { AiCardLineRow(it) }
        buttons()
    }
}

/** "This card has expired." or "Not now", which stays until something on the card went through. */
@Composable
private fun AiActionCardFooter(
    card: ChatAIActionCard,
    expired: Boolean,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
) {
    if (card.isFinished) return
    if (expired) {
        Text(
            text = "This card has expired. Ask again.",
            fontSize = 11.5.sp,
            color = PantopusColors.appTextMuted,
            modifier = Modifier.testTag("chatAIActionExpired"),
        )
        return
    }
    if (card.runs.values.any { it is ChatAICardRun.Done }) return
    Text(
        text = "Not now",
        fontSize = 12.sp,
        fontWeight = FontWeight.SemiBold,
        color = PantopusColors.appTextSecondary,
        modifier =
            modifier
                .heightIn(min = 32.dp)
                .clickable(enabled = !card.isRunning, onClick = onDismiss)
                .padding(horizontal = Spacing.s3, vertical = 6.dp)
                .semantics { role = Role.Button }
                .testTag("chatAIActionNotNow"),
    )
}

/** One set of buttons (the card's, or a row's): the buttons, or how the one that ran went. */
@Composable
private fun AiCardButtons(
    card: ChatAIActionCard,
    scope: String,
    actions: List<ChatAICardAction>,
    expired: Boolean,
    onAction: (scope: String, action: ChatAICardAction) -> Unit,
    onOpenLink: (String) -> Unit,
    canOpen: (String) -> Boolean,
) {
    if (actions.isEmpty()) return
    when (val run = card.runs[scope]) {
        is ChatAICardRun.Done -> {
            val action = actions.firstOrNull { it.id == run.actionId }
            Row(
                modifier = Modifier.fillMaxWidth().testTag("chatAIActionDone"),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                PantopusIconImage(icon = PantopusIcon.CheckCircle, contentDescription = null, size = 14.dp, tint = PantopusColors.success)
                Text(
                    text = action?.doneLabel ?: "Done",
                    fontSize = 12.5.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.success,
                    modifier = Modifier.weight(1f),
                )
                val link = run.link?.takeIf(canOpen)
                if (link != null) {
                    Row(
                        modifier =
                            Modifier
                                .heightIn(min = 34.dp)
                                .clickable { onOpenLink(link) }
                                .padding(horizontal = Spacing.s1)
                                .semantics(mergeDescendants = true) {
                                    role = Role.Button
                                    contentDescription = "Open"
                                }.testTag("chatAIActionOpen"),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
                    ) {
                        Text(text = "Open", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = PantopusColors.primary600)
                        PantopusIconImage(
                            icon = PantopusIcon.ArrowRight,
                            contentDescription = null,
                            size = 11.dp,
                            tint = PantopusColors.primary600,
                        )
                    }
                }
            }
            run.note?.let { Text(text = it, fontSize = 11.5.sp, color = PantopusColors.appTextSecondary) }
        }
        else -> {
            if (expired) return
            (run as? ChatAICardRun.Failed)?.let {
                Text(
                    text = it.message,
                    fontSize = 11.5.sp,
                    color = PantopusColors.error,
                    modifier = Modifier.testTag("chatAIActionError"),
                )
            }
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                actions.forEach { action ->
                    PantopusButton(
                        title = action.label,
                        kind =
                            when (action.style) {
                                "secondary" -> PantopusButtonKind.Ghost
                                "destructive" -> PantopusButtonKind.Destructive
                                else -> PantopusButtonKind.Primary
                            },
                        onClick = { onAction(scope, action) },
                        modifier = Modifier.weight(1f).testTag("chatAIActionButton_${action.id}"),
                        isLoading = (run as? ChatAICardRun.Running)?.actionId == action.id,
                        isEnabled = !card.isRunning,
                    )
                }
            }
        }
    }
}

@Composable
private fun AiCardLineRow(line: ChatAICardLine) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        if (line.label.isNotEmpty()) {
            Text(
                text = line.label,
                fontSize = 11.5.sp,
                lineHeight = 15.sp,
                color = PantopusColors.appTextSecondary,
                modifier = Modifier.widthIn(max = 96.dp),
            )
        }
        Text(text = line.value, fontSize = 11.5.sp, lineHeight = 15.sp, color = PantopusColors.appText, modifier = Modifier.weight(1f))
    }
}

/** A warning in the caution style ("Moving the time more than 30 minutes asks everyone who's in…"). */
@Composable
private fun AiCardWarning(text: String) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.warningBg)
                .padding(horizontal = Spacing.s2, vertical = 6.dp)
                .testTag("chatAIActionWarning"),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        PantopusIconImage(icon = PantopusIcon.AlertTriangle, contentDescription = null, size = 13.dp, tint = PantopusColors.warning)
        Text(text = text, fontSize = 11.5.sp, lineHeight = 15.sp, color = PantopusColors.appText, modifier = Modifier.weight(1f))
    }
}

private fun actionCardIcon(card: String): PantopusIcon =
    when {
        card == "plan_message" || card == "post_reply" -> PantopusIcon.MessageSquare
        card == "plan_requests" -> PantopusIcon.Users
        card.startsWith("plan_") -> PantopusIcon.CalendarCheck
        card == "post_solve" -> PantopusIcon.CheckCircle
        card == "home_task" -> PantopusIcon.ListChecks
        card == "home_task_update" -> PantopusIcon.CheckCheck
        card == "home_system" -> PantopusIcon.Wrench
        card.startsWith("home_") -> PantopusIcon.Home
        card == "notification_settings" -> PantopusIcon.Bell
        else -> PantopusIcon.Sparkles
    }

private fun actionCardLabel(card: String): String =
    when (card) {
        "plan_create" -> "New plan"
        "plan_edit" -> "Plan change"
        "plan_cancel" -> "Cancel plan"
        "plan_requests" -> "Requests"
        "plan_ask" -> "Ask to join"
        "plan_message" -> "Message"
        "post_reply" -> "Reply"
        "post_solve" -> "Mark solved"
        "home_task" -> "Reminder"
        "home_task_update" -> "Task update"
        "home_system" -> "Home system"
        "notification_settings" -> "Notifications"
        else -> if (card.startsWith("home_")) "Home" else "Pantopus"
    }

/** Buttons to screens of the app under an assistant reply (contract section 5). */
@Composable
internal fun AiLinkButtons(
    links: List<ChatAILink>,
    onOpen: (String) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        links.forEach { link ->
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .heightIn(min = 40.dp)
                        .clip(RoundedCornerShape(Radii.md))
                        .background(PantopusColors.primary50)
                        .clickable { onOpen(link.url) }
                        .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                        .semantics(mergeDescendants = true) { role = Role.Button }
                        .testTag("chatAILink"),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                Text(
                    text = link.label,
                    fontSize = 12.5.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.primary600,
                    modifier = Modifier.weight(1f),
                )
                PantopusIconImage(icon = PantopusIcon.ArrowRight, contentDescription = null, size = 12.dp, tint = PantopusColors.primary600)
            }
        }
    }
}

/** "About: Pickup game" under the assistant thread's header, when it was opened from a screen. */
@Composable
internal fun AiContextStrip(label: String) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .background(PantopusColors.magicBgSoft)
                    .padding(horizontal = Spacing.s4, vertical = Spacing.s2)
                    .semantics(mergeDescendants = true) {}
                    .testTag("chatAIAbout"),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            PantopusIconImage(icon = PantopusIcon.Sparkles, contentDescription = null, size = 13.dp, tint = PantopusColors.magic)
            Text(
                text =
                    buildAnnotatedString {
                        withStyle(SpanStyle(color = PantopusColors.appTextSecondary)) { append("About: ") }
                        append(label)
                    },
                fontSize = 12.5.sp,
                fontWeight = FontWeight.Medium,
                color = PantopusColors.appText,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        Spacer(modifier = Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorder))
    }
}

/** The screen's starter prompts above the composer, until the person sends something. */
@Composable
internal fun AiStarterRow(
    starters: List<String>,
    onTap: (String) -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState())
                .padding(horizontal = Spacing.s3, vertical = Spacing.s1)
                .testTag("chatAIStarters"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        starterChips(starters).forEach { chip ->
            AiCapabilityChip(chip = chip, onTap = { onTap(it.label) }, testTag = "chatAIStarter_${chip.id}")
        }
    }
}

/** Starter prompts as the welcome card's capability chips (`chatAIWelcomeCapability_starter_0`, …). */
internal fun starterChips(starters: List<String>): List<ChatPromptChip> =
    starters.mapIndexed { index, starter -> ChatPromptChip(id = "starter_$index", label = starter, icon = PantopusIcon.Sparkles) }
