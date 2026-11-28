@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.feed.reinvented

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Checkbox
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.reinvented.ReinventedCircleChangeBody
import app.pantopus.android.data.api.models.reinvented.ReinventedCircleDto
import app.pantopus.android.ui.components.keepsKeyboard
import app.pantopus.android.ui.screens.feed.living.LivingCircleWindowChoice
import app.pantopus.android.ui.screens.moments.components.MomentFace
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Spacing

/*
 * The circles' pages inside the reach dial (CONTRACT 8d; words as the web's and iPhone's): the list with invites, a new
 * circle, and a circle's page. The magazine is in `ReinventedMagazine.kt`.
 */

/** "Your circles": invites first, then the circles the person is in, and "New circle". */
@Composable
internal fun CirclesListPage(
    ui: ReinventedCirclesUi,
    onPage: (DialPage) -> Unit,
) {
    PageTitle("Your circles", onBack = { onPage(DialPage.Main) })
    Text("Circles of 2 to 8 close people. Only its people see a circle.", fontSize = 13.5.sp, color = PantopusColors.appTextSecondary)
    if (ui.invites.isNotEmpty()) {
        SectionLabel("Invites")
        ui.invites.forEach { circle ->
            CircleRow(circle, line = "From ${circle.owner?.firstName ?: circle.owner?.name ?: "someone"}", fresh = true) {
                onPage(DialPage.Invite(circle.id))
            }
        }
    }
    if (ui.circles.isNotEmpty()) SectionLabel("Your circles")
    ui.circles.forEach { circle ->
        val inCount = circle.members.count { it.state == "in" }
        CircleRow(
            circle,
            line = "$inCount in" + if (circle.magazineReady) " · This week's magazine" else "",
            fresh = circle.magazineReady,
        ) {
            onPage(DialPage.Circle(circle.id))
        }
    }
    PrimaryButton("New circle", "reinventedPulse.circles.new") { onPage(DialPage.NewCircle) }
}

/** An invite: who asked and who's in, the Keep choice, No thanks / Join. Nobody is told who said no. */
@Composable
internal fun CircleInvitePage(
    circle: ReinventedCircleDto,
    ui: ReinventedCirclesUi,
    model: ReinventedCirclesViewModel,
    onPage: (DialPage) -> Unit,
) {
    var keep by remember(circle.id) { mutableStateOf(false) }
    PageTitle(circle.name, onBack = { onPage(DialPage.Circles) })
    Text(
        "${circle.owner?.firstName ?: circle.owner?.name ?: "Someone"} asked you to join.",
        fontSize = 14.sp,
        color = PantopusColors.appText,
    )
    Members(circle, showInvited = false)
    KeepRow(keep) { keep = it }
    ui.note?.let { Note(it) }
    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s3)) {
        TextButton(
            onClick = { model.leave(circle) { onPage(DialPage.Circles) } },
            modifier = Modifier.testTag("reinventedPulse.circle.decline"),
        ) {
            Text("No thanks")
        }
        PrimaryButton("Join", "reinventedPulse.circle.join") {
            model.join(circle, keep)
            onPage(DialPage.Circle(circle.id))
        }
    }
}

/** A new circle: its name (only its people see it) and 1 to 7 of the person's connections, who are invited. */
@Composable
internal fun NewCirclePage(
    ui: ReinventedCirclesUi,
    model: ReinventedCirclesViewModel,
    onPage: (DialPage) -> Unit,
) {
    LaunchedEffect(Unit) { model.readConnections() }
    var name by remember { mutableStateOf("") }
    var chosen by remember { mutableStateOf(emptySet<String>()) }
    PageTitle("New circle", onBack = { onPage(DialPage.Circles) })
    Field(name, "Its name (only its people see it)", "reinventedPulse.circle.name") { name = it.take(NAME_MAX) }
    Text(
        "Who's in it: up to 7 of your connections. They're invited, and in only by their own yes.",
        fontSize = 13.sp,
        color = PantopusColors.appTextSecondary,
    )
    PeoplePicker(ui, chosen, exclude = emptySet()) { id ->
        chosen =
            if (id in chosen) {
                chosen - id
            } else if (chosen.size < 7) {
                chosen + id
            } else {
                chosen
            }
    }
    ui.note?.let { Note(it) }
    PrimaryButton("Make the circle", "reinventedPulse.circle.make", enabled = name.isNotBlank() && chosen.isNotEmpty() && !ui.busy) {
        model.make(name, chosen.toList()) { made -> onPage(DialPage.Circle(made.id)) }
    }
}

/** A circle's page: its magazine, who's in, the member's own Keep choice; for its maker Rename, Invite more, Remove; Leave or End. */
@Composable
internal fun CirclePage(
    circle: ReinventedCircleDto,
    ui: ReinventedCirclesUi,
    model: ReinventedCirclesViewModel,
    onPage: (DialPage) -> Unit,
) {
    var asking by remember(circle.id) { mutableStateOf<String?>(null) }
    var inviting by remember(circle.id) { mutableStateOf(false) }
    PageTitle(circle.name, onBack = { onPage(DialPage.Circles) })
    CircleRow(
        circle,
        line = if (circle.magazineReady) "This week's magazine · new" else "This week's magazine",
        fresh = circle.magazineReady,
    ) {
        onPage(DialPage.Magazine(circle.id))
    }
    Members(
        circle,
        showInvited = true,
        onRemove =
            if (circle.mine) {
                {
                        id ->
                    model.change(circle, ReinventedCircleChangeBody(remove = listOf(id)))
                }
            } else {
                null
            },
    )
    KeepRow(circle.myKeepFaded) { model.keep(circle, it) }
    // Homes talk to homes (phase 4, `feed/living/LivingWindows.kt`): the member's own window for this circle.
    LivingCircleWindowChoice(circle.id)
    if (circle.mine) OwnerTools(circle, ui, model, inviting) { inviting = it }
    ui.note?.let { Note(it) }
    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s3)) {
        TextButton(onClick = { asking = "leave" }, modifier = Modifier.testTag("reinventedPulse.circle.leave")) { Text("Leave") }
        if (circle.mine) {
            TextButton(onClick = {
                asking = "end"
            }, modifier = Modifier.testTag("reinventedPulse.circle.end")) { Text("End the circle") }
        }
    }
    asking?.let { what ->
        val ending = what == "end"
        AlertDialog(
            onDismissRequest = { asking = null },
            title = { Text(if (ending) "End this circle?" else "Leave this circle?") },
            text = { Text(if (ending) "Everyone leaves it. Its magazine goes with it." else "You can be invited again.") },
            confirmButton = {
                TextButton(onClick = {
                    asking = null
                    if (ending) model.end(circle) { onPage(DialPage.Circles) } else model.leave(circle) { onPage(DialPage.Circles) }
                }) { Text(if (ending) "End it" else "Leave") }
            },
            dismissButton = { TextButton(onClick = { asking = null }) { Text(if (ending) "Keep it" else "Stay") } },
        )
    }
}

/** Rename, and Invite more from the person's connections. */
@Composable
private fun OwnerTools(
    circle: ReinventedCircleDto,
    ui: ReinventedCirclesUi,
    model: ReinventedCirclesViewModel,
    inviting: Boolean,
    onInviting: (Boolean) -> Unit,
) {
    var name by remember(circle.id, circle.name) { mutableStateOf(circle.name) }
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        Field(name, "Its name", "reinventedPulse.circle.rename", Modifier.weight(1f)) { name = it.take(NAME_MAX) }
        TextButton(
            onClick = { model.change(circle, ReinventedCircleChangeBody(name = name.trim())) },
            enabled = name.isNotBlank() && name.trim() != circle.name && !ui.busy,
            modifier = Modifier.keepsKeyboard(),
        ) { Text("Rename") }
    }
    if (!inviting) {
        TextButton(onClick = {
            model.readConnections()
            onInviting(true)
        }, modifier = Modifier.testTag("reinventedPulse.circle.invite")) { Text("Invite more") }
        return
    }
    var chosen by remember(circle.id) { mutableStateOf(emptySet<String>()) }
    val listed = circle.members.map { it.person.id }.toSet()
    val room = (8 - circle.members.size).coerceAtLeast(0)
    PeoplePicker(ui, chosen, exclude = listed) { id ->
        chosen =
            if (id in chosen) {
                chosen - id
            } else if (chosen.size < room) {
                chosen + id
            } else {
                chosen
            }
    }
    PrimaryButton("Invite", "reinventedPulse.circle.inviteSend", enabled = chosen.isNotEmpty() && !ui.busy) {
        model.change(circle, ReinventedCircleChangeBody(add = chosen.toList()))
        onInviting(false)
    }
}

@Composable
private fun Members(
    circle: ReinventedCircleDto,
    showInvited: Boolean,
    onRemove: ((String) -> Unit)? = null,
) {
    SectionLabel("Who's in")
    circle.members.filter { showInvited || it.state == "in" }.forEach { member ->
        val role =
            when {
                member.person.id == circle.owner?.id -> "Made it"
                member.state == "in" -> "In"
                else -> "Invited"
            }
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s3)) {
            MomentFace(member.person, 32.dp)
            Text(
                member.person.name ?: member.person.firstName ?: "Someone",
                fontSize = 15.sp,
                color = PantopusColors.appText,
                modifier = Modifier.weight(1f),
            )
            Text(role, fontSize = 13.sp, color = PantopusColors.appTextSecondary)
            if (onRemove != null && member.person.id != circle.owner?.id) {
                TextButton(onClick = { onRemove(member.person.id) }) { Text("Remove") }
            }
        }
    }
}

@Composable
private fun KeepRow(
    on: Boolean,
    onChange: (Boolean) -> Unit,
) {
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
        Text(
            "Keep my Moments for this circle after they fade: its weekly magazine and morning postcards",
            fontSize = 14.sp,
            color = PantopusColors.appText,
            modifier = Modifier.weight(1f),
        )
        Switch(checked = on, onCheckedChange = onChange, modifier = Modifier.testTag("reinventedPulse.circle.keep"))
    }
}

/** The person's connections with a box each; [exclude] are already listed. */
@Composable
private fun PeoplePicker(
    ui: ReinventedCirclesUi,
    chosen: Set<String>,
    exclude: Set<String>,
    onToggle: (String) -> Unit,
) {
    val people = ui.connections
    if (people == null) {
        Text("Loading your connections…", fontSize = 13.sp, color = PantopusColors.appTextSecondary)
        return
    }
    var query by remember { mutableStateOf("") }
    Field(query, "Search your connections", "reinventedPulse.circle.search") { query = it }
    val shown = people.filter { it.id !in exclude && (query.isBlank() || it.name.contains(query.trim(), ignoreCase = true)) }
    if (shown.isEmpty()) Text("No connections to add.", fontSize = 13.sp, color = PantopusColors.appTextSecondary)
    LazyColumn(modifier = Modifier.fillMaxWidth().heightIn(max = 260.dp)) {
        items(shown, key = { it.id }) { person ->
            Row(
                modifier =
                    Modifier.fillMaxWidth().clickable(role = Role.Checkbox) {
                        onToggle(person.id)
                    }.testTag("reinventedPulse.circle.person.${person.id}"),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
            ) {
                MomentFace(person.author, 32.dp)
                Text(person.name, fontSize = 15.sp, color = PantopusColors.appText, modifier = Modifier.weight(1f))
                Checkbox(checked = person.id in chosen, onCheckedChange = { onToggle(person.id) })
            }
        }
    }
}

@Composable
internal fun PageTitle(
    title: String,
    onBack: () -> Unit,
) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        TextButton(onClick = onBack, modifier = Modifier.testTag("reinventedPulse.dial.back")) { Text("‹ Back") }
        Text(
            title,
            fontSize = 20.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
            modifier = Modifier.semantics { heading() },
        )
    }
}

@Composable
private fun SectionLabel(title: String) {
    Text(
        title,
        fontSize = 14.sp,
        fontWeight = FontWeight.SemiBold,
        color = PantopusColors.appTextSecondary,
        modifier = Modifier.padding(top = Spacing.s2),
    )
}

@Composable
private fun Note(words: String) {
    Text(words, fontSize = 13.sp, color = PantopusColors.appTextSecondary)
}

/** One circle in a list: its name, a line, and "new". */
@Composable
internal fun CircleRow(
    circle: ReinventedCircleDto,
    line: String,
    fresh: Boolean,
    onClick: () -> Unit,
) {
    val shape = RoundedCornerShape(14.dp)
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(shape)
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, shape)
                .clickable(role = Role.Button, onClick = onClick)
                .padding(Spacing.s3)
                .testTag("reinventedPulse.circle.${circle.id}"),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(circle.name, fontSize = 16.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appText)
            Text(line, fontSize = 13.sp, color = PantopusColors.appTextSecondary)
        }
        if (fresh) Text("new", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.primary600)
    }
}

@Composable
private fun Field(
    value: String,
    hint: String,
    tag: String,
    modifier: Modifier = Modifier.fillMaxWidth(),
    onChange: (String) -> Unit,
) {
    BasicTextField(
        value = value,
        onValueChange = onChange,
        singleLine = true,
        textStyle = TextStyle(color = PantopusColors.appText, fontSize = 15.sp),
        cursorBrush = SolidColor(PantopusColors.appText),
        modifier =
            modifier
                .keepsKeyboard()
                .clip(RoundedCornerShape(12.dp))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(12.dp))
                .padding(horizontal = Spacing.s3, vertical = Spacing.s3)
                .testTag(tag),
        decorationBox = { inner ->
            if (value.isEmpty()) Text(hint, fontSize = 15.sp, color = PantopusColors.appTextSecondary)
            inner()
        },
    )
}

@Composable
internal fun PrimaryButton(
    title: String,
    tag: String,
    enabled: Boolean = true,
    onClick: () -> Unit,
) {
    Text(
        title,
        fontSize = 15.sp,
        fontWeight = FontWeight.SemiBold,
        color = if (enabled) Color.White else PantopusColors.appTextSecondary,
        modifier =
            Modifier
                .clip(RoundedCornerShape(percent = 50))
                .background(if (enabled) PantopusColors.primary600 else PantopusColors.appBorder)
                .clickable(role = Role.Button, enabled = enabled, onClick = onClick)
                .padding(horizontal = Spacing.s4, vertical = 10.dp)
                .testTag(tag),
    )
}

private const val NAME_MAX = 40
