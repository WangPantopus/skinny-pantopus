package app.pantopus.android.ui.screens.plans.detail

import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.api.models.plans.PlanDto
import app.pantopus.android.data.api.models.plans.PlanInviteCandidateDto
import app.pantopus.android.data.api.models.plans.PlanInviteCountsDto
import app.pantopus.android.data.api.models.plans.PlanInviteRowDto
import app.pantopus.android.data.plans.isAtHome
import app.pantopus.android.data.plans.isPlaydate
import app.pantopus.android.ui.components.GhostButton
import app.pantopus.android.ui.components.PantopusCheckbox
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.components.ToastController
import app.pantopus.android.ui.components.ToastHost
import app.pantopus.android.ui.components.closesKeyboardOnTapOrScroll
import app.pantopus.android.ui.screens.plans.components.PlanAvatar
import app.pantopus.android.ui.screens.plans.components.PlanIconTile
import app.pantopus.android.ui.screens.plans.components.PlanOverline
import app.pantopus.android.ui.screens.plans.components.PlanTextArea
import app.pantopus.android.ui.screens.plans.components.planCard
import app.pantopus.android.ui.screens.plans.map.planH3
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * "Invite friends" for a plan's host (founder decision, October 31). One search box finds people the host knows on
 * Pantopus or takes an email address; "Text an invite" makes a one-person link for the phone's share sheet. Below, the
 * invitations already sent and where each stands. The same screen on iOS (PlanInviteSheet.swift), with the same tags.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun PlanInviteSheet(
    plan: PlanDto,
    onDismiss: () -> Unit,
    vm: PlanInviteViewModel = hiltViewModel(key = "planInvite-${plan.id}"),
) {
    val ui by vm.ui.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val toast = remember { ToastController() }
    LaunchedEffect(plan.id) { vm.start(plan.id) }
    LaunchedEffect(ui.notice) {
        ui.notice?.let {
            toast.info(it)
            vm.noticeShown()
        }
    }
    // The text invite goes out from the host's own phone: the words, then the one-person link.
    LaunchedEffect(ui.textInvite) {
        val invite = ui.textInvite ?: return@LaunchedEffect
        val send =
            Intent(Intent.ACTION_SEND)
                .setType("text/plain")
                .putExtra(Intent.EXTRA_TEXT, "${invite.message} ${invite.url}")
        runCatching { context.startActivity(Intent.createChooser(send, null).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
        vm.textInviteShared()
    }
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = PantopusColors.appSurface,
        modifier = Modifier.closesKeyboardOnTapOrScroll().testTag("planInviteSheet"),
    ) {
        Box {
            Column(modifier = Modifier.fillMaxWidth().navigationBarsPadding().imePadding()) {
                Column(
                    modifier =
                        Modifier
                            .weight(1f, fill = false)
                            .verticalScroll(rememberScrollState())
                            .padding(horizontal = Spacing.s4)
                            .padding(bottom = Spacing.s4),
                    verticalArrangement = Arrangement.spacedBy(Spacing.s4),
                ) {
                    InviteHeader(plan, onDismiss)
                    InviteBody(ui, vm)
                }
                SendBar(ui, onSend = vm::send)
            }
            ToastHost(controller = toast, modifier = Modifier.align(Alignment.TopCenter))
        }
    }
    if (ui.asksAboutAddress) ShareAddressDialog(onAgree = vm::agreeToShareAddress, onDecline = vm::declineToShareAddress)
}

/** The search box, what's chosen, the people the host knows, "Text an invite" and the invitations sent. */
@Composable
private fun ColumnScope.InviteBody(
    ui: PlanInviteUi,
    vm: PlanInviteViewModel,
) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(modifier = Modifier.weight(1f).testTag("planInviteSearch")) {
            PlanTextArea(
                value = ui.query,
                onValue = vm::editQuery,
                placeholder = "Name or email",
                label = "Name or email",
                singleLine = true,
                keyboardOptions =
                    KeyboardOptions(
                        capitalization = KeyboardCapitalization.None,
                        autoCorrectEnabled = false,
                        keyboardType = KeyboardType.Email,
                        imeAction = ImeAction.Done,
                    ),
                keyboardActions = KeyboardActions(onDone = { vm.addEmailFromQuery() }),
            )
        }
    }
    ui.emailInQuery?.let { email -> EmailRow(email, onAdd = vm::addEmailFromQuery) }
    if (ui.chosenCount > 0) Chosen(ui, vm)
    when (val load = ui.load) {
        PlanInviteLoad.Loading -> InviteLoading()
        is PlanInviteLoad.Failed -> InviteFailed(load.message, onRetry = vm::load)
        PlanInviteLoad.Loaded -> {
            People(ui, onToggle = vm::toggle)
            TextInviteCard(making = ui.makingLink, onText = vm::makeTextInvite)
            Sent(ui, onCancel = vm::cancel)
            Text(
                text = "Each invitation is for one person. Emails and texts show the plan's card and area, never your address.",
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
            )
        }
    }
}

/** At a home, the first invitation: people who say they're in see the address (as accepting the first ask asks). */
@Composable
private fun ShareAddressDialog(
    onAgree: () -> Unit,
    onDecline: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDecline,
        title = { Text("Share your address?") },
        text = { Text("This plan is at your place. People you invite see your address once they say they're in.") },
        confirmButton = { TextButton(onClick = onAgree) { Text("Invite") } },
        dismissButton = { TextButton(onClick = onDecline) { Text("Not now") } },
    )
}

@Composable
private fun InviteHeader(
    plan: PlanDto,
    onClose: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = "Invite friends",
                style = planH3,
                color = PantopusColors.appText,
                modifier = Modifier.weight(1f).semantics { heading() },
            )
            PlanRoundButton(
                icon = PantopusIcon.X,
                label = "Close",
                onClick = onClose,
                glass = false,
                modifier = Modifier.testTag("planInviteClose"),
            )
        }
        // A playdate still needs a verified address (founder decision, October 31), as on iOS.
        val who = if (plan.isPlaydate) "Families with a verified address are" else "They're"
        val start = "${plan.title}. $who in as soon as they say yes"
        Text(
            text = if (plan.isAtHome) "$start, and see your address then." else "$start.",
            style = PantopusTextStyle.small,
            color = PantopusColors.appTextSecondary,
        )
    }
}

/** "Invite alex@example.com by email". */
@Composable
private fun EmailRow(
    email: String,
    onAdd: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable(role = Role.Button, onClick = onAdd)
                .semantics(mergeDescendants = true) {}
                .testTag("planInviteAddEmail"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        PlanIconTile(PantopusIcon.Mail, PantopusColors.primary100, PantopusColors.primary700, size = 40.dp, glyph = 20.dp, corner = 12.dp)
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = "Invite $email",
                style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
                color = PantopusColors.appText,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = "By email. Pantopus sends it, with the plan's card.",
                style = PantopusTextStyle.small,
                color = PantopusColors.appTextSecondary,
            )
        }
        PantopusIconImage(icon = PantopusIcon.PlusCircle, contentDescription = null, size = 22.dp, tint = PantopusColors.primary600)
    }
}

/** The people and addresses chosen, each with an X. */
@Composable
private fun Chosen(
    ui: PlanInviteUi,
    vm: PlanInviteViewModel,
) {
    Row(
        modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).testTag("planInviteChosen"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        ui.chosenPeople.forEach { person -> Chip(person.displayName, PantopusIcon.User) { vm.removePerson(person.userId) } }
        ui.chosenEmails.forEach { email -> Chip(email, PantopusIcon.Mail) { vm.removeEmail(email) } }
    }
}

@Composable
private fun Chip(
    text: String,
    icon: PantopusIcon,
    onRemove: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .heightIn(min = 36.dp)
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.primary100)
                .padding(start = 10.dp, end = Spacing.s1),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 14.dp, tint = PantopusColors.primary700)
        Text(
            text = text,
            style = PantopusTextStyle.small.copy(fontWeight = FontWeight.SemiBold),
            color = PantopusColors.primary700,
            maxLines = 1,
        )
        Box(
            modifier = Modifier.size(32.dp).clip(RoundedCornerShape(Radii.pill)).clickable(role = Role.Button, onClick = onRemove),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon = PantopusIcon.X, contentDescription = "Remove $text", size = 12.dp, tint = PantopusColors.primary700)
        }
    }
}

private const val LOADING_ROWS = 3

@Composable
private fun InviteLoading() {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
        repeat(LOADING_ROWS) {
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .height(52.dp)
                        .clip(RoundedCornerShape(Radii.lg))
                        .background(PantopusColors.appSurfaceSunken),
            )
        }
    }
}

@Composable
private fun InviteFailed(
    message: String,
    onRetry: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        Text(
            text = "Couldn't load your people",
            style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
            color = PantopusColors.appText,
        )
        Text(text = message, style = PantopusTextStyle.small, color = PantopusColors.appTextSecondary)
        GhostButton(title = "Try again", onClick = onRetry, modifier = Modifier.testTag("planInviteRetry"))
    }
}

@Composable
private fun People(
    ui: PlanInviteUi,
    onToggle: (PlanInviteCandidateDto) -> Unit,
) {
    Column(modifier = Modifier.testTag("planInvitePeople")) {
        PlanOverline(if (ui.searchText.isEmpty()) "People you know" else "People", modifier = Modifier.padding(bottom = Spacing.s1))
        if (ui.people.isEmpty()) {
            Text(
                text =
                    if (ui.searchText.isEmpty()) {
                        "Your connections and people who came to your plans show here. Anyone else: type their email."
                    } else {
                        "No one you know by that name. Type their email to invite them."
                    },
                style = PantopusTextStyle.small,
                color = PantopusColors.appTextSecondary,
                modifier = Modifier.padding(vertical = Spacing.s2),
            )
        }
        ui.people.forEachIndexed { index, person ->
            if (index > 0) HorizontalDivider(color = PantopusColors.appBorder)
            PersonRow(person, chosen = ui.isChosen(person), onToggle = { onToggle(person) })
        }
    }
}

@Composable
private fun PersonRow(
    person: PlanInviteCandidateDto,
    chosen: Boolean,
    onToggle: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                // The whole row is the checkbox (TalkBack: "Alex M., Came to your plans, Checked").
                .toggleable(value = chosen, enabled = person.state == null, role = Role.Checkbox, onValueChange = { onToggle() })
                .padding(vertical = 10.dp)
                .testTag("planInvitePerson"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        PlanAvatar(name = person.displayName, seed = person.userId, avatarUrl = person.avatarUrl)
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = person.displayName,
                style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
                color = PantopusColors.appText,
            )
            Text(text = PlanInviteLines.reason(person.reason), style = PantopusTextStyle.small, color = PantopusColors.appTextSecondary)
        }
        val state = person.state
        if (state != null) {
            Text(
                text = PlanInviteLines.candidateState(state),
                style = PantopusTextStyle.small.copy(fontWeight = FontWeight.SemiBold),
                color = PantopusColors.appTextSecondary,
            )
        } else {
            // Drawn only: the row says the name and toggles.
            PantopusCheckbox(isChecked = chosen, onCheckedChange = { onToggle() }, modifier = Modifier.clearAndSetSemantics {})
        }
    }
}

@Composable
private fun TextInviteCard(
    making: Boolean,
    onText: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth().planCard().padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s3)) {
            TextInviteTile()
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "Text an invite",
                    style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
                    color = PantopusColors.appText,
                )
                Text(
                    text = "Send a link from your phone. It works for one person, so make one for each friend.",
                    style = PantopusTextStyle.small,
                    color = PantopusColors.appTextSecondary,
                )
            }
        }
        GhostButton(
            title = "Text an invite",
            onClick = onText,
            isEnabled = !making,
            modifier = Modifier.testTag("planInviteText"),
        )
    }
}

@Composable
private fun TextInviteTile() {
    PlanIconTile(
        PantopusIcon.MessageCircle,
        PantopusColors.primary100,
        PantopusColors.primary700,
        size = 40.dp,
        glyph = 20.dp,
        corner = 12.dp,
    )
}

@Composable
private fun Sent(
    ui: PlanInviteUi,
    onCancel: (PlanInviteRowDto) -> Unit,
) {
    val rows = ui.list?.invites.orEmpty()
    val unopened = ui.list?.unopenedLinks ?: 0
    if (rows.isEmpty() && unopened == 0) return
    Column(modifier = Modifier.testTag("planInviteSent")) {
        PlanOverline(PlanInviteLines.sentTitle(ui.list?.counts), modifier = Modifier.padding(bottom = Spacing.s1))
        rows.forEachIndexed { index, row ->
            if (index > 0) HorizontalDivider(color = PantopusColors.appBorder)
            SentRow(row, onCancel = { onCancel(row) })
        }
        if (unopened > 0) {
            if (rows.isNotEmpty()) HorizontalDivider(color = PantopusColors.appBorder)
            Row(
                modifier = Modifier.padding(vertical = 10.dp).testTag("planInviteUnopened"),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
            ) {
                TextInviteTile()
                Text(
                    text = if (unopened == 1) "1 text invite not opened yet" else "$unopened text invites not opened yet",
                    style = PantopusTextStyle.small,
                    color = PantopusColors.appTextSecondary,
                )
            }
        }
    }
}

@Composable
private fun SentRow(
    row: PlanInviteRowDto,
    onCancel: () -> Unit,
) {
    var menu by remember { mutableStateOf(false) }
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.s1).testTag("planInviteRow"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        val person = row.person
        if (person != null) {
            PlanAvatar(name = person.displayName, seed = person.userId, avatarUrl = person.avatarUrl)
        } else {
            PlanIconTile(
                if (row.channel == "email") PantopusIcon.Mail else PantopusIcon.MessageCircle,
                PantopusColors.primary100,
                PantopusColors.primary700,
                size = 40.dp,
                glyph = 20.dp,
                corner = 12.dp,
            )
        }
        Column(modifier = Modifier.weight(1f).semantics(mergeDescendants = true) {}) {
            Text(
                text = row.title,
                style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
                color = PantopusColors.appText,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = PlanInviteLines.state(row),
                style = PantopusTextStyle.small,
                color = if (row.emailFailed || row.state == "asked") PantopusColors.warning else PantopusColors.appTextSecondary,
            )
        }
        if (row.canCancel) {
            Box {
                Box(
                    modifier =
                        Modifier
                            .size(44.dp)
                            .clip(RoundedCornerShape(Radii.pill))
                            .clickable(role = Role.Button) { menu = true }
                            .testTag("planInviteRowMenu"),
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.MoreHorizontal,
                        contentDescription = "More for ${row.title}",
                        size = 18.dp,
                        tint = PantopusColors.appTextSecondary,
                    )
                }
                DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
                    DropdownMenuItem(
                        text = { Text("Take back invitation", color = PantopusColors.error) },
                        onClick = {
                            menu = false
                            onCancel()
                        },
                    )
                }
            }
        }
    }
}

@Composable
private fun SendBar(
    ui: PlanInviteUi,
    onSend: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurface)
                .padding(horizontal = Spacing.s4)
                .padding(top = Spacing.s3, bottom = Spacing.s2),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        HorizontalDivider(color = PantopusColors.appBorder)
        ui.error?.let { error ->
            Text(
                text = error,
                style = PantopusTextStyle.small,
                color = PantopusColors.error,
                modifier = Modifier.fillMaxWidth().testTag("planInviteError"),
            )
        }
        PrimaryButton(
            title =
                when (ui.chosenCount) {
                    0 -> "Choose people to invite"
                    1 -> "Send invite"
                    else -> "Send ${ui.chosenCount} invites"
                },
            onClick = onSend,
            isLoading = ui.sending,
            isEnabled = ui.chosenCount > 0 && !ui.sending,
            modifier = Modifier.height(50.dp).testTag("planInviteSend"),
        )
    }
}

/** The invitation words the host sees (the same on iOS). */
internal object PlanInviteLines {
    /** Why someone is in the people list. */
    fun reason(reason: String?): String =
        when (reason) {
            "came_before" -> "Came to your plans"
            "both" -> "Connection · came to your plans"
            else -> "Connection"
        }

    /** Someone who can't be chosen again. */
    fun candidateState(state: String): String =
        when (state) {
            "in" -> "In"
            "asked" -> "Asked"
            else -> "Invited"
        }

    /** Where one invitation stands. */
    fun state(row: PlanInviteRowDto): String {
        val how =
            when (row.channel) {
                "email" -> "By email"
                "link" -> "By text"
                else -> "On Pantopus"
            }
        return when (row.state) {
            "opened" -> "Opened your text invite · Hasn't answered yet"
            "in" -> "Said yes · In"
            "waitlisted" -> "Said yes · On the waitlist"
            "asked" -> "Opened your email invitation from another address · Waiting for your yes in Requests"
            "cant_make_it" -> "Can't make it"
            "left" -> "Said yes, then left"
            else -> if (row.emailFailed) "Couldn't email this address" else "$how · Hasn't answered yet"
        }
    }

    /** "Invited · 3 waiting · 2 in". */
    fun sentTitle(counts: PlanInviteCountsDto?): String {
        counts ?: return "Invited"
        val parts =
            listOfNotNull(
                counts.invited.takeIf { it > 0 }?.let { "$it waiting" },
                counts.isIn.takeIf { it > 0 }?.let { "$it in" },
                counts.cantMakeIt.takeIf { it > 0 }?.let { "$it can't make it" },
            )
        return if (parts.isEmpty()) "Invited" else "Invited · " + parts.joinToString(" · ")
    }
}
