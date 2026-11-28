package app.pantopus.android.ui.screens.feed.reinvented.after

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.pantopus.android.core.LaunchFeatures
import app.pantopus.android.data.api.models.moments.MomentDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.pulse.TogetherRepository
import app.pantopus.android.ui.screens.moments.studio.MomentsStudioMentionsViewModel
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Spacing
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import javax.inject.Inject

/*
 * "Mail it" ("Pulse, reinvented" phase 3, PHASE-3 piece 9; board B11; CONTRACT 8j; iPhone's `MomentMailIt.swift`, the
 * web's `mailit/MailIt.tsx`): the author sends their own Moment's picture as an ordinary letter in today's Mail tab. The
 * server first keeps the picture as one of the sender's own mail enclosures; the letter then goes through today's
 * `POST /api/mailbox/send`, so every rule of today's letters applies (writing to someone else is today's `mail_extras`;
 * blocks and the recipient's own mail settings hold). It reads like the morning postcards: "A postcard from Ivy", the
 * words, "<place> · <day>". Offered in the viewer's More menu on one's own Moment with a picture; the viewer closes and
 * the form opens over Pulse. Only while the switch is on (the viewer's caller decides: `studio`) and the Mailbox is.
 */

/** What the viewer's More menu offers ([MomentMailItOffer]) and the Moment handed to Pulse's form ([MomentMailItHost]). */
internal object MomentMailItState {
    val offer = mutableStateOf<(() -> Unit)?>(null)
    val moment = mutableStateOf<MomentDto?>(null)

    /** When [moment] was handed over: Pulse shows the form only within [HAND_MS], so it never surfaces later elsewhere. */
    var handedAt = 0L

    const val HAND_MS = 3_000L
}

/** Offered on one's own photo or video Moment, under one's own name, not a live guess spot, not an unopened relic. */
internal fun MomentDto.offersMailIt(mine: Boolean): Boolean {
    if (!mine || !LaunchFeatures.mailbox) return false
    if (kind != "photo" && kind != "video") return false
    if (author.madeUpName || (guess != null && state == "live")) return false
    return seal?.open != false
}

/**
 * Under the viewer's header while the switch is on (with "Want to come?", [MomentPlanOffer]): sets "Mail it" in one's
 * own Moment's More menu ([MomentMailItMenuItem]) while it may be mailed. [onClose] closes the viewer first.
 */
@Composable
internal fun MomentMailItOffer(
    moment: MomentDto,
    mine: Boolean,
    onClose: () -> Unit,
) {
    val offers = moment.offersMailIt(mine)
    DisposableEffect(moment.id, offers) {
        MomentMailItState.offer.value =
            if (offers) {
                {
                    onClose()
                    MomentMailItState.handedAt = System.currentTimeMillis()
                    MomentMailItState.moment.value = moment
                }
            } else {
                null
            }
        onDispose { MomentMailItState.offer.value = null }
    }
}

/** "Mail it" in one's own Moment's More menu, while [MomentMailItOffer] offers it; else nothing. */
@Composable
internal fun MomentMailItMenuItem() {
    val mail = MomentMailItState.offer.value ?: return
    DropdownMenuItem(
        text = { Text("Mail it", color = Color.White) },
        leadingIcon = { PantopusIconImage(icon = PantopusIcon.Mail, contentDescription = null, size = 18.dp, tint = Color.White) },
        onClick = mail,
        modifier = Modifier.testTag("moments.menu.mailIt"),
    )
}

data class MomentMailItUi(
    val busy: Boolean = false,
    val error: String? = null,
    val sent: String? = null,
)

@HiltViewModel
class MomentMailItViewModel
    @Inject
    constructor(
        private val repository: TogetherRepository,
    ) : ViewModel() {
        private val _ui = MutableStateFlow(MomentMailItUi())
        val ui: StateFlow<MomentMailItUi> = _ui.asStateFlow()

        fun reset() {
            _ui.value = MomentMailItUi()
        }

        /** Keeps the picture as an enclosure, then sends today's letter to [to] (the sender's own id: themselves). */
        fun send(
            moment: MomentDto,
            to: String,
            toName: String?,
            words: String,
            onDone: () -> Unit,
        ) {
            if (_ui.value.busy) return
            _ui.value = MomentMailItUi(busy = true)
            viewModelScope.launch {
                val kept =
                    when (val answer = repository.mailItEnclosure(moment.id)) {
                        is NetworkResult.Success -> answer.data
                        is NetworkResult.Failure -> return@launch _ui.update { MomentMailItUi(error = answer.error.displayMessage(FAILED)) }
                    }
                // Written as the morning postcards are (CONTRACT 8j): "A postcard from <first name>", the words, "<place> · <day>".
                val first = (moment.author.firstName ?: moment.author.name).orEmpty().trim().split(" ").first().ifBlank { "me" }
                val subject = "A postcard from $first"
                val footer = listOfNotNull(kept.place?.ifBlank { null }, day(moment.createdAt)).joinToString(" · ")
                val content = listOfNotNull(words.trim().ifBlank { null }, footer.ifBlank { null }).joinToString("\n\n")
                val letter =
                    mapOf(
                        "recipient" to mapOf("mode" to "user", "userId" to to),
                        "envelope" to mapOf("type" to "letter", "subject" to subject),
                        "object" to
                            mapOf(
                                "format" to "mailjson_v1",
                                "mimeType" to "application/json",
                                "title" to subject,
                                "content" to content,
                                "attachments" to listOf(kept.enclosure.ref),
                                "payload" to mapOf("bodyFormat" to "plain_text"),
                            ),
                        "tracking" to mapOf("source" to "pulse_mail_it_android"),
                    )
                when (val sent = repository.sendLetter(letter)) {
                    is NetworkResult.Success -> {
                        val whose = toName?.let { "$it’s" } ?: "your"
                        _ui.value = MomentMailItUi(sent = "Mailed. It’s in $whose Mail.")
                        delay(SENT_MS)
                        onDone()
                    }
                    // The server's own words (today's address rule, a letter to someone else while `mail_extras` is off).
                    is NetworkResult.Failure -> _ui.value = MomentMailItUi(error = sent.error.displayMessage(FAILED))
                }
            }
        }

        private fun day(iso: String?): String? =
            iso?.let { runCatching { Instant.parse(it) }.getOrNull() }
                ?.atZone(ZoneId.systemDefault())
                ?.format(DateTimeFormatter.ofPattern("MMM d", Locale.US))

        private companion object {
            const val SENT_MS = 1_600L
            const val FAILED = "Couldn’t mail it. Try again."
        }
    }

/** The new Pulse hosts the form (`ReinventedPulseScreen`), only for a Moment handed over just now. */
@Composable
fun MomentMailItHost(account: String?) {
    val moment = MomentMailItState.moment.value ?: return
    LaunchedEffect(moment.id) {
        if (System.currentTimeMillis() - MomentMailItState.handedAt > MomentMailItState.HAND_MS) MomentMailItState.moment.value = null
    }
    if (account == null) return
    MomentMailItSheet(moment, account) { MomentMailItState.moment.value = null }
}

/** "Mail it": to whom (yourself; others while today's `mail_extras` is on), the words, and the send. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun MomentMailItSheet(
    moment: MomentDto,
    account: String,
    viewModel: MomentMailItViewModel = hiltViewModel(),
    people: MomentsStudioMentionsViewModel = hiltViewModel(),
    onDone: () -> Unit,
) {
    val ui by viewModel.ui.collectAsStateWithLifecycle()
    val connections by people.people.collectAsStateWithLifecycle()
    val others = LaunchFeatures.mailExtras
    LaunchedEffect(moment.id) {
        viewModel.reset()
        if (others) people.read()
    }
    var to by remember(moment.id) { mutableStateOf(account) }
    var words by remember(moment.id) { mutableStateOf((moment.caption ?: moment.text).orEmpty().trim()) }
    val toName = connections.orEmpty().firstOrNull { it.id == to }?.name
    ModalBottomSheet(
        onDismissRequest = { if (!ui.busy) onDone() },
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = PantopusColors.appBg,
        modifier = Modifier.testTag("together.mailIt"),
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = Spacing.s4)
                    .padding(bottom = Spacing.s5)
                    .navigationBarsPadding(),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                PantopusIconImage(icon = PantopusIcon.Mail, contentDescription = null, size = 16.dp, tint = PantopusColors.primary600)
                Text(
                    "Mail it",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appText,
                    modifier = Modifier.semantics { heading() },
                )
            }
            val sent = ui.sent
            if (sent != null) {
                Text(
                    sent,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appText,
                    modifier = Modifier.testTag("together.mailIt.sent"),
                )
                return@Column
            }
            MailItForm(
                MailItFormState(account, to, words, ui.busy, ui.error),
                names = if (others) connections.orEmpty().map { it.id to it.name } else emptyList(),
                onTo = { to = it },
                onWords = { words = it },
                onCancel = onDone,
                onSend = { viewModel.send(moment, to, toName.takeIf { to != account }, words, onDone) },
            )
        }
    }
}

/** What the form shows. */
private data class MailItFormState(
    val account: String,
    val to: String,
    val words: String,
    val busy: Boolean,
    val error: String?,
)

/** To, Words, the line about today's mail rules, the server's words if it refused, and Cancel / Mail it. */
@Composable
@Suppress("LongParameterList") // What it shows and the four things it does.
private fun MailItForm(
    form: MailItFormState,
    names: List<Pair<String, String>>,
    onTo: (String) -> Unit,
    onWords: (String) -> Unit,
    onCancel: () -> Unit,
    onSend: () -> Unit,
) {
    ToField(to = form.to, account = form.account, names = names, enabled = !form.busy, onPick = onTo)
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text("Words", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appTextSecondary)
        OutlinedTextField(
            value = form.words,
            onValueChange = { onWords(it.take(WORDS_MAX)) },
            placeholder = { Text("A few words to go with it") },
            minLines = 3,
            maxLines = 6,
            enabled = !form.busy,
            modifier = Modifier.fillMaxWidth().testTag("together.mailIt.words"),
        )
    }
    Text(
        "It goes as a letter with this photo, by today’s mail rules.",
        fontSize = 12.5.sp,
        color = PantopusColors.appTextSecondary,
    )
    form.error?.let {
        Text(it, fontSize = 13.5.sp, color = PantopusColors.error, modifier = Modifier.testTag("together.mailIt.error"))
    }
    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        FormButton("Cancel", primary = false, enabled = !form.busy, tag = "together.mailIt.cancel", onClick = onCancel)
        val send = if (form.busy) "Mailing…" else "Mail it"
        FormButton(send, primary = true, enabled = !form.busy, tag = "together.mailIt.send", onClick = onSend)
    }
}

/** "To": yourself, or (while `mail_extras` is on) one of your connections. */
@Composable
private fun ToField(
    to: String,
    account: String,
    names: List<Pair<String, String>>,
    enabled: Boolean,
    onPick: (String) -> Unit,
) {
    var open by remember { mutableStateOf(false) }
    val shown = if (to == account) YOURSELF else names.firstOrNull { it.first == to }?.second ?: YOURSELF
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text("To", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appTextSecondary)
        Box {
            Text(
                shown,
                fontSize = 15.sp,
                color = PantopusColors.appText,
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .heightIn(min = 44.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(8.dp))
                        .clickable(enabled = enabled && names.isNotEmpty(), role = Role.Button) { open = true }
                        .padding(horizontal = 12.dp, vertical = 12.dp)
                        .testTag("together.mailIt.to")
                        .semantics { contentDescription = "To: $shown" },
            )
            DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
                DropdownMenuItem(text = { Text(YOURSELF) }, onClick = {
                    onPick(account)
                    open = false
                })
                names.forEach { (id, name) ->
                    DropdownMenuItem(text = { Text(name) }, onClick = {
                        onPick(id)
                        open = false
                    })
                }
            }
        }
    }
}

@Composable
private fun FormButton(
    title: String,
    primary: Boolean,
    enabled: Boolean,
    tag: String,
    onClick: () -> Unit,
) {
    val shape = RoundedCornerShape(percent = 50)
    Box(
        modifier =
            Modifier
                .heightIn(min = 44.dp)
                .clip(shape)
                .background(if (primary) PantopusColors.primary600 else Color.Transparent)
                .border(1.dp, if (primary) PantopusColors.primary600 else PantopusColors.appBorder, shape)
                .clickable(enabled = enabled, role = Role.Button, onClick = onClick)
                .padding(horizontal = 20.dp)
                .testTag(tag),
        contentAlignment = Alignment.Center,
    ) {
        Text(title, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = if (primary) Color.White else PantopusColors.appText)
    }
}

private const val YOURSELF = "Yourself, in your Mail"
private const val WORDS_MAX = 2_000
