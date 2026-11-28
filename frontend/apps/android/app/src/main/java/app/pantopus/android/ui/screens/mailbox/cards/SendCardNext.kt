@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.mailbox.cards

import android.content.Context
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.mailbox.HolidayCardArrivals
import app.pantopus.android.data.api.models.mailbox.HolidayCardArrivalsFor
import app.pantopus.android.data.api.models.mailbox.HolidayCardDesign
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Spacing

// The card improvements of November 28 (Wave 3, contract section 4), drawn only while `GET /cards` says `improved`.
// The send flow's model is at its size limit, so what this round adds to it lives here, as SendCardTown.kt does.

// ── 3.1 Pick a card first ─────────────────────────────────────

/** The five steps with Pick a card first. */
private val PICK_FIRST =
    listOf(SendCardStep.Pick, SendCardStep.To, SendCardStep.Write, SendCardStep.Seal, SendCardStep.Look)

/** The steps in the order the flow walks them: Pick a card first while [improved], else Who it's for first, as before. */
internal fun stepOrder(improved: Boolean): List<SendCardStep> = if (improved) PICK_FIRST else SendCardStep.steps

/**
 * This form at the start that suits [improved]: a new card with no picture yet opens on Pick a card (with a person
 * already chosen too: Write back, Send one back, chat, a profile); one with a picture (a card's page, Send this card
 * again) opens on Who it's for. Without the improvements, a form that never chose anyone is back on Who it's for.
 */
internal fun SendCardForm.inOrder(improved: Boolean): SendCardForm =
    when {
        improved && step == SendCardStep.To && design == null -> copy(step = SendCardStep.Pick)
        !improved && step == SendCardStep.Pick && to == null -> copy(step = SendCardStep.To)
        else -> this
    }

/** Where Pick a card goes on: to the note once someone is chosen (always, before the improvements), else Who it's for. */
internal fun SendCardForm.stepAfterPick(improved: Boolean): SendCardStep =
    if (!improved || to != null) SendCardStep.Write else SendCardStep.To

/** Where Who it's for goes on: with the improvements, to the note once a card is chosen; without, as before. */
internal fun SendCardForm.stepAfterChoosing(improved: Boolean): SendCardStep =
    when {
        !improved -> stepAfterTo
        design != null -> SendCardStep.Write
        else -> SendCardStep.Pick
    }

/** Pick a card's button: "Choose who it’s for" while no one is chosen yet (improvements on), else "Write on this card". */
internal fun pickNextLabel(
    improved: Boolean,
    form: SendCardForm,
): String = if (improved && form.to == null) CHOOSE_WHO else WRITE_ON_THIS_CARD

internal const val WRITE_ON_THIS_CARD = "Write on this card"

/** Who it's for, above the email and link choices, with the card improvements (Wave 1: no account needed to open it). */
internal const val NO_ACCOUNT_NEEDED = "They don’t need Pantopus. They can open and read it right away."
private const val CHOOSE_WHO = "Choose who it’s for"

/** Over Who it's for: the card chosen, small, with its caption and "Change" (back to Pick a card). */
@Composable
internal fun PickedCardLine(
    design: HolidayCardDesign,
    onChange: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(start = Spacing.s4, end = Spacing.s2, top = Spacing.s2).testTag("sendCardPickedLine"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(modifier = Modifier.padding(Spacing.s1).clearAndSetSemantics {}) {
            TiltedThumb(design.id, width = 28.dp, tilt = -2f, pictureHeight = design.height, paper = design.paper)
        }
        Text(
            design.caption,
            fontSize = 14.sp,
            lineHeight = 19.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.cardTextStrong,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f),
        )
        CardButton(
            "Change",
            onClick = onChange,
            kind = CardButtonKind.Words,
            fill = false,
            modifier = Modifier.testTag("sendCardChangeCard"),
        )
    }
}

// ── 3.2 A name on a link's envelope ───────────────────────────

/** The most letters a name on a link's envelope can have. */
internal const val LINK_NAME_LIMIT = 40

/** The name as it goes on the envelope: trimmed, runs of spaces folded, at most 40 letters; null when there's none. */
internal fun envelopeName(raw: String): String? =
    raw.trim().replace(Regex("\\s+"), " ").takeLetters(LINK_NAME_LIMIT).trim().takeIf { it.isNotEmpty() }

/** "Send it by link" with the improvements: the name on the envelope (optional), then Continue. */
@Composable
internal fun LinkNameForm(
    form: SendCardForm,
    viewModel: SendCardViewModel,
) {
    Column(modifier = Modifier.padding(start = Spacing.s4, end = Spacing.s4, top = Spacing.s4)) {
        Text(
            "Name on the envelope (optional)",
            fontSize = 14.sp,
            lineHeight = 20.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.cardTextStrong,
        )
        DeskField(
            value = form.linkName,
            onValueChange = viewModel::onLinkNameChange,
            placeholder = "e.g. Mom, Aunt Lin, The Patel family",
            label = "Name on the envelope",
            imeAction = ImeAction.Done,
            onDone = viewModel::chooseLink,
            tag = "sendCardLinkName",
            modifier = Modifier.padding(top = Spacing.s2),
        )
        Text(
            "Written in ink on the front of the envelope. Leave blank if you’d rather keep it unnamed.",
            fontSize = 14.sp,
            lineHeight = 20.sp,
            color = PantopusColors.cardTextQuiet,
            modifier = Modifier.padding(top = Spacing.s2),
        )
        Text(
            "Anyone with the link can open and read your card right away — no account needed. The first person to save it " +
                "to a mailbox keeps it.",
            fontSize = 14.sp,
            lineHeight = 20.sp,
            color = PantopusColors.cardTextQuiet,
            modifier = Modifier.padding(top = Spacing.s3),
        )
        CardButton(
            "Continue",
            onClick = viewModel::chooseLink,
            modifier = Modifier.padding(top = Spacing.s5).testTag("sendCardLinkContinue"),
        )
        CardButton(
            "Search Pantopus instead",
            onClick = { viewModel.showLink(false) },
            kind = CardButtonKind.Paper,
            modifier = Modifier.padding(top = 10.dp).testTag("sendCardLinkSearchInstead"),
        )
    }
}

// ── 3.3 Right away, for someone on Pantopus ───────────────────

/**
 * The arrivals open for one person: by their clock once read ([theirs]), else by the sender's. With the improvements,
 * the ones that include "Right away" where the server sends them.
 */
internal fun personArrivals(
    arrivals: HolidayCardArrivals,
    theirs: HolidayCardArrivalsFor?,
    improved: Boolean,
): List<String> =
    if (improved) {
        theirs?.let { it.arrivalsAll ?: it.arrivals } ?: arrivals.personAll ?: arrivals.person
    } else {
        theirs?.arrivals ?: arrivals.person
    }

/** "Right away" to a person (only offered while the improvements are on): its title and its line. */
internal val RIGHT_AWAY_TO_PERSON = "Right away" to "Drops into their mailbox now, with a gentle notice."

/** Under the choices, and on Look it over, while "Right away" to a person is chosen. */
internal const val RIGHT_AWAY_NO_TAKE_BACK = "This card delivers right away, so it can’t be taken back after you seal it."

/** A card to a person chosen to come right away. */
internal fun comesRightAway(
    to: CardRecipient?,
    arrival: String?,
): Boolean = to is CardRecipient.Person && arrival == "now"

// ── 3.4 Let it travel, off to begin with ──────────────────────

/** The travel switch's title and line with the improvements; without them, "Let it travel" as before. */
internal const val TRAVEL_TITLE = "Let this card travel"
internal const val TRAVEL_LINE =
    "Let them pass this card on free to two people. Only your city appears on the postmark — never your note, photo, or " +
        "street address."

// ── 3.5 Quick seal ────────────────────────────────────────────

/**
 * Whether this device has sealed a card by hand all the way through once: after that, the sealing table offers "Quick
 * seal" (with the improvements on). A device flag, not the account's: the first card on each phone keeps its ritual.
 */
internal object CardSealedOnce {
    private const val PREFS = "pantopus_card_seal"
    private const val KEY = "sealedOnce"

    fun read(context: Context): Boolean = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean(KEY, false)

    fun mark(context: Context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean(KEY, true).apply()
    }
}
