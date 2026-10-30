@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "TooManyFunctions")

package app.pantopus.android.ui.screens.mailbox.cards

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.mailbox.HolidayCardDesign
import app.pantopus.android.data.api.models.mailbox.HolidayCardPreview
import app.pantopus.android.data.api.models.mailbox.HolidayCardPreviewEmail
import app.pantopus.android.data.api.models.mailbox.HolidayCardPreviewLinkPage
import app.pantopus.android.data.api.models.mailbox.HolidayCardPreviewPiece
import app.pantopus.android.data.api.models.mailbox.HolidayCardsResponse
import app.pantopus.android.data.api.models.mailbox.v2.DrawerMail
import app.pantopus.android.data.api.models.mailbox.v2.MailCard
import app.pantopus.android.ui.screens.mailbox.components.MailAddressBook
import app.pantopus.android.ui.screens.mailbox.components.MailPiece
import app.pantopus.android.ui.screens.mailbox.components.MailPieceMapper
import app.pantopus.android.ui.screens.mailbox.components.MailPieceModel
import app.pantopus.android.ui.screens.mailbox.mail_detail.letter.HolidayCardOutOfEnvelope
import app.pantopus.android.ui.screens.mailbox.mail_detail.letter.HolidayCardSealedNotice
import app.pantopus.android.ui.screens.mailbox.mail_detail.letter.MailLetterCard
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import app.pantopus.android.ui.theme.rememberReduceMotion
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZoneOffset

// ── Step 5: look it over ─────────────────────────────────────

/**
 * "Look it over" (drawings `L1-LookMember`, `L2-LookSealed`, `L3-LookEmail`): the card exactly as the other person will
 * see it, from what the server will really send, drawn with the parts their own Mailbox and card page use. To a person:
 * their Mailbox the morning it comes (the envelope with their name only, never an address), the sealed notice while it
 * waits for Christmas, the card coming out of its envelope ("Open it again" plays that again; with animations off it
 * doesn't move) and its back. To an email address: the email they get, the page its link opens, and the card once they
 * join with that address. "Seal and send" is the screen's footer under it.
 */
@Composable
internal fun LookStep(
    cards: HolidayCardsResponse,
    to: CardRecipient,
    design: HolidayCardDesign,
    preview: HolidayCardPreview,
) {
    val zone = HolidayCardTimes.zone(cards.timeZone)
    val from = preview.piece.senderDisplay.trim().ifEmpty { "Someone" }
    val card = lookCard(preview, design, cards.year)
    val sealed = preview.sealed
    Column(modifier = Modifier.fillMaxWidth().padding(top = Spacing.s3).testTag("sendCardLook")) {
        Column(modifier = Modifier.padding(horizontal = Spacing.s4)) {
            Text(
                if (to is CardRecipient.Person) "This is what ${to.name} will see" else "This is what they will see",
                fontFamily = FontFamily.Serif,
                fontSize = 22.sp,
                lineHeight = 28.sp,
                color = PantopusColors.cardTextStrong,
                modifier = Modifier.semantics { heading() },
            )
            Text(
                lookIntro(to, preview),
                fontSize = 14.sp,
                lineHeight = 20.sp,
                color = PantopusColors.cardTextQuiet,
                modifier = Modifier.padding(top = Spacing.s1),
            )
        }
        when (to) {
            is CardRecipient.Person -> PersonLook(to, preview, card, from, sealed)
            is CardRecipient.Email -> EmailLook(to, preview, card, from, sealed, zone)
        }
    }
}

/** What step 5 shows first: how it comes, and that Back changes anything. */
private fun lookIntro(
    to: CardRecipient,
    preview: HolidayCardPreview,
): String =
    when {
        to is CardRecipient.Email ->
            "They aren’t on Pantopus yet. The email never shows the card; they open it in Pantopus once they join with this " +
                "address."
        preview.sealed -> "It comes sealed and stays shut until Christmas morning. Use Back to change anything."
        preview.piece.card?.arrival == "christmas_morning" ->
            "It comes on Christmas morning with the 7 a.m. mail. Use Back to change anything."
        else ->
            "Open the envelope and turn the card over, the way ${(to as CardRecipient.Person).firstName} will. Use Back to " +
                "change anything."
    }

/** To a person: their Mailbox the morning it comes, the seal while it waits, the card coming out, and its back. */
@Composable
private fun PersonLook(
    to: CardRecipient.Person,
    preview: HolidayCardPreview,
    card: MailLetterCard,
    from: String,
    sealed: Boolean,
) {
    val first = to.firstName
    val envelope = lookEnvelope(preview, to.name, card)
    val day = HolidayCardTimes.longDay(preview.arrivesOn, ZoneId.systemDefault())
    LookSection(listOf("In $first’s Mailbox", day).filter { it.isNotEmpty() }.joinToString(" · "), horizontal = Spacing.s3) {
        MailboxFrame("Today") {
            Column(modifier = Modifier.fillMaxWidth().clearAndSetSemantics { contentDescription = envelope.accessibilityLabel }) {
                MailPiece(envelope)
                if (envelope.meta.isNotBlank()) {
                    Text(
                        envelope.meta,
                        fontSize = 12.sp,
                        lineHeight = 16.sp,
                        color = PantopusColors.appTextMuted,
                        modifier = Modifier.padding(top = 6.dp, start = 2.dp),
                    )
                }
            }
        }
    }
    if (sealed) {
        LookSection("If $first taps it before Christmas") {
            HolidayCardSealedNotice(
                from = from,
                opensOn = HolidayCardTimes.longDay(preview.opensOn, ZoneId.systemDefault()).ifEmpty { null },
                opensIn = preview.sealedDays?.let { HolidayCardTimes.inDays(it) },
            )
        }
    }
    LookSection(if (sealed) "On Christmas morning" else "When $first opens it") {
        Text(
            if (sealed) {
                "The seal lifts at 7 a.m. where $first lives. The card slides out of the envelope picture side up."
            } else {
                // "Ivy M." ends the sentence itself.
                "A Christmas card from ${from.removeSuffix(".")}. It slides out of the envelope picture side up."
            },
            fontSize = 15.sp,
            lineHeight = 22.sp,
            color = PantopusColors.cardTextBody,
        )
        CardComingOut(envelope, card, from)
    }
    LookSection("On the back") {
        CardBack(card, from, modifier = Modifier.padding(horizontal = Spacing.s3, vertical = Spacing.s2).rotate(1f))
    }
}

/** To an email address: the email they get now, the page its link opens, and the card once they join. */
@Composable
private fun EmailLook(
    to: CardRecipient.Email,
    preview: HolidayCardPreview,
    card: MailLetterCard,
    from: String,
    sealed: Boolean,
    zone: ZoneId,
) {
    preview.email?.let { email ->
        LookSection(if (sealed) "The email they get, now" else "The email they get, right away", horizontal = Spacing.s3) {
            EmailPicture(email, to.email, from)
        }
    }
    preview.linkPage?.let { page ->
        LookSection("The page its link opens", horizontal = Spacing.s3) { LinkPagePicture(page, zone) }
    }
    val envelope = lookEnvelope(preview, to.email, card)
    val state = if (sealed) "sealed until Christmas morning" else "in its envelope"
    val spoken = "Christmas card from $from to ${to.email}, $state."
    LookSection("After they join with that address", horizontal = Spacing.s3) {
        MailboxFrame("In their Mailbox") {
            Box(modifier = Modifier.fillMaxWidth().clearAndSetSemantics { contentDescription = spoken }) { MailPiece(envelope) }
            Row(
                modifier = Modifier.fillMaxWidth().padding(top = Spacing.s4),
                horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
                verticalAlignment = Alignment.Top,
            ) {
                CardFront(card, from, modifier = Modifier.weight(1f))
                CardBack(card, from, modifier = Modifier.weight(1f))
            }
        }
    }
}

/**
 * The card as it comes out of its envelope, picture side up, with "Turn it over"; "Open it again" plays its coming out
 * again (with animations off it doesn't move).
 */
@Composable
private fun CardComingOut(
    envelope: MailPieceModel,
    card: MailLetterCard,
    from: String,
) {
    val reduceMotion = rememberReduceMotion()
    var showBack by rememberSaveable { mutableStateOf(false) }
    // Each "Open it again" draws it coming out afresh; it doesn't play again when the screen comes back.
    var replays by remember { mutableIntStateOf(0) }
    Box(modifier = Modifier.fillMaxWidth().padding(start = Spacing.s3, end = Spacing.s3, top = Spacing.s4).rotate(-1f)) {
        key(replays) {
            HolidayCardOutOfEnvelope(
                // On the morning it opens its seal is gone, so the envelope it leaves is torn open.
                envelope = envelope.copy(card = envelope.card?.copy(sealed = false)),
                card = card,
                from = from,
                showBack = showBack,
                opening = replays > 0 && !reduceMotion,
                onOut = {},
            )
        }
    }
    Row(
        modifier = Modifier.fillMaxWidth().padding(top = Spacing.s4),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        CardButton(
            if (showBack) "Turn it back" else "Turn it over",
            onClick = { showBack = !showBack },
            kind = CardButtonKind.Paper,
            fill = false,
            state = if (showBack) "Showing the back" else "Showing the picture",
            modifier = Modifier.testTag("sendCardLookTurn"),
        )
        CardButton(
            "Open it again",
            onClick = {
                showBack = false
                replays += 1
            },
            kind = CardButtonKind.Words,
            fill = false,
            modifier = Modifier.testTag("sendCardLookOpenAgain"),
        )
    }
}

/** The picture side as the card prints it, with the day it's mailed in the postmark. */
@Composable
private fun CardFront(
    card: MailLetterCard,
    from: String,
    modifier: Modifier = Modifier,
) {
    val shape = RoundedCornerShape(3.dp)
    val caption = card.caption?.takeIf { it.isNotBlank() }?.let { if (it.last() in ".!?") it else "$it." } ?: "A Christmas picture."
    HolidayCardFront(
        design = card.design,
        caption = card.caption,
        paper = card.paper,
        year = card.year,
        mailedOn = card.mailedOn,
        modifier =
            modifier
                .shadow(6.dp, shape)
                .clip(shape)
                .clearAndSetSemantics { contentDescription = "The picture side, from $from: $caption" },
    )
}

/** The back with the note on it and who it's from, the size of the picture side. */
@Composable
private fun CardBack(
    card: MailLetterCard,
    from: String,
    modifier: Modifier = Modifier,
) {
    val shape = RoundedCornerShape(3.dp)
    val note = card.note.let { if (it.isEmpty() || it.last() in ".!?") it else "$it." }
    Box(
        modifier =
            modifier
                .fillMaxWidth()
                .aspectRatio(HolidayCardArt.cardAspect(card.design))
                .shadow(6.dp, shape)
                .clip(shape)
                .clearAndSetSemantics { contentDescription = "On the back: $note From ${from.removeSuffix(".")}." },
    ) {
        HolidayCardBack(paper = card.paper, fromName = from, year = card.year, message = card.note)
    }
}

/** A picture of their Mailbox: its grey page, the day's heading, and what's in it. */
@Composable
private fun MailboxFrame(
    label: String,
    content: @Composable ColumnScope.() -> Unit,
) {
    val shape = RoundedCornerShape(20.dp)
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(shape)
                .background(PantopusColors.appBg)
                .border(1.dp, PantopusColors.cardListEdge, shape)
                .padding(start = 14.dp, end = 14.dp, top = 14.dp, bottom = Spacing.s4),
    ) {
        Text(
            label.uppercase(),
            fontSize = 11.sp,
            lineHeight = 16.sp,
            fontWeight = FontWeight.SemiBold,
            letterSpacing = 0.06.em,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.padding(bottom = 10.dp).clearAndSetSemantics { contentDescription = label },
        )
        content()
    }
}

/** A part of the look under its small heading on the desk ("When Maya opens it"). */
@Composable
private fun LookSection(
    title: String,
    horizontal: Dp = Spacing.s4,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth().padding(start = horizontal, end = horizontal, top = 26.dp)) {
        Text(
            title.uppercase(),
            fontSize = 11.sp,
            lineHeight = 16.sp,
            fontWeight = FontWeight.SemiBold,
            letterSpacing = 0.06.em,
            color = PantopusColors.cardSectionInk,
            modifier =
                Modifier
                    // The headings line up with the desk's text, whatever the section's own inset.
                    .padding(start = (Spacing.s4 - horizontal).coerceAtLeast(0.dp), bottom = Spacing.s2)
                    .clearAndSetSemantics {
                        heading()
                        contentDescription = title.replace(" · ", ", ")
                    },
        )
        content()
    }
}

/** The email a card to an email address sends, as their inbox shows it: never the card, only who it's from. */
@Composable
private fun EmailPicture(
    email: HolidayCardPreviewEmail,
    address: String,
    from: String,
) {
    val shape = RoundedCornerShape(16.dp)
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .shadow(1.dp, shape)
                .clip(shape)
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, shape)
                .testTag("sendCardLookEmail"),
    ) {
        Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 10.dp)) {
            Text(
                buildAnnotatedString {
                    withStyle(SpanStyle(fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)) { append("Pantopus") }
                    append(" · to $address")
                },
                fontSize = 12.sp,
                lineHeight = 17.sp,
                color = PantopusColors.appTextSecondary,
            )
            Text(
                email.subject,
                fontSize = 14.sp,
                lineHeight = 19.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                modifier = Modifier.padding(top = 2.dp),
            )
        }
        HorizontalDivider(color = PantopusColors.appBorderSubtle)
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .background(PantopusColors.cardWax)
                    .padding(start = Spacing.s4, end = Spacing.s4, top = 20.dp, bottom = Spacing.s4),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            PantopusIconImage(icon = PantopusIcon.Mail, contentDescription = null, size = 30.dp, tint = PantopusColors.cardWaxText)
            Text(
                email.heading,
                fontSize = 17.sp,
                lineHeight = 22.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.cardWaxText,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = 6.dp),
            )
        }
        Column(modifier = Modifier.fillMaxWidth().padding(start = 18.dp, end = 18.dp, top = 18.dp, bottom = Spacing.s4)) {
            email.lines.forEachIndexed { index, line ->
                Text(
                    withNameInBold(line, from),
                    fontSize = 14.sp,
                    lineHeight = 21.sp,
                    color = PantopusColors.appTextStrong,
                    modifier = Modifier.padding(top = if (index > 0) 10.dp else 0.dp),
                )
            }
            if (email.button.isNotBlank()) {
                Box(modifier = Modifier.fillMaxWidth().padding(top = Spacing.s4), contentAlignment = Alignment.Center) {
                    Text(
                        email.button,
                        fontSize = 14.sp,
                        lineHeight = 20.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = PantopusColors.cardWaxText,
                        modifier =
                            Modifier
                                .clip(RoundedCornerShape(10.dp))
                                .background(PantopusColors.cardWax)
                                .padding(horizontal = Spacing.s6, vertical = 11.dp),
                    )
                }
            }
            if (email.footnote.isNotBlank()) {
                Text(
                    email.footnote,
                    fontSize = 11.sp,
                    lineHeight = 16.sp,
                    color = PantopusColors.appTextMuted,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth().padding(top = 14.dp),
                )
            }
        }
        HorizontalDivider(color = PantopusColors.appBorder)
        Text(
            email.footer.ifEmpty { EMAIL_FOOTER }.joinToString("\n"),
            fontSize = 11.sp,
            lineHeight = 16.sp,
            color = PantopusColors.appTextMuted,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth().background(PantopusColors.appSurfaceRaised).padding(horizontal = Spacing.s4, vertical = 10.dp),
        )
    }
}

/** The email's footer, as the server writes it (for a server that doesn't send it). */
private val EMAIL_FOOTER =
    listOf("Pantopus — Your household, organized.", "If you don’t know the sender, you can safely ignore this email.")

/** The email's sentence with the sender's name in bold where it starts with it, as the email prints it. */
private fun withNameInBold(
    line: String,
    from: String,
) = buildAnnotatedString {
    if (from.isNotBlank() && line.startsWith(from)) {
        withStyle(SpanStyle(fontWeight = FontWeight.SemiBold)) { append(from) }
        append(line.removePrefix(from))
    } else {
        append(line)
    }
}

/** The page the email's link opens before they join: who it's from, sealed or not, and the address to join with. */
@Composable
private fun LinkPagePicture(
    page: HolidayCardPreviewLinkPage,
    zone: ZoneId,
) {
    val shape = RoundedCornerShape(16.dp)
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(shape)
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, shape)
                .padding(horizontal = Spacing.s4, vertical = 18.dp)
                .testTag("sendCardLookLinkPage"),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            Box(
                modifier = Modifier.size(48.dp).clip(RoundedCornerShape(16.dp)).background(PantopusColors.appSurfaceSunken),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(icon = PantopusIcon.Mail, contentDescription = null, size = 24.dp, tint = PantopusColors.appTextSecondary)
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    "A Christmas card for you".uppercase(),
                    fontSize = 12.sp,
                    lineHeight = 16.sp,
                    fontWeight = FontWeight.SemiBold,
                    letterSpacing = 0.08.em,
                    color = PantopusColors.appTextMuted,
                    modifier = Modifier.clearAndSetSemantics { contentDescription = "A Christmas card for you" },
                )
                Text(
                    "From ${page.senderName}",
                    fontSize = 19.sp,
                    lineHeight = 24.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appText,
                    modifier = Modifier.padding(top = 2.dp),
                )
                if (page.senderVerified) {
                    Row(
                        modifier =
                            Modifier
                                .padding(top = Spacing.s2)
                                .clip(CircleShape)
                                .background(PantopusColors.successLight)
                                .padding(horizontal = 10.dp, vertical = Spacing.s1),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        PantopusIconImage(icon = PantopusIcon.ShieldCheck, contentDescription = null, size = 14.dp, tint = PantopusColors.success)
                        Text("Verified neighbor", fontSize = 12.sp, lineHeight = 16.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.success)
                    }
                }
            }
        }
        val inner = RoundedCornerShape(12.dp)
        Column(
            modifier =
                Modifier
                    .padding(top = Spacing.s4)
                    .fillMaxWidth()
                    .clip(inner)
                    .background(PantopusColors.appSurfaceRaised)
                    .border(1.dp, PantopusColors.appBorderSubtle, inner)
                    .padding(14.dp),
        ) {
            Text("A Christmas card", fontSize = 15.sp, lineHeight = 20.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
            Text(
                (if (page.sealed) "It’s sealed until Christmas morning. " else "") + "You’ll see the card once it’s in your mailbox.",
                fontSize = 14.sp,
                lineHeight = 21.sp,
                color = PantopusColors.appTextSecondary,
                modifier = Modifier.padding(top = Spacing.s1),
            )
            HolidayCardTimes.fullDate(page.sentOn, zone).takeIf { it.isNotEmpty() }?.let {
                Text("Sent $it", fontSize = 12.sp, lineHeight = 16.sp, color = PantopusColors.appTextMuted, modifier = Modifier.padding(top = 10.dp))
            }
        }
        Column(modifier = Modifier.padding(top = Spacing.s4), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            PageButton("Sign in to open it", primary = true)
            PageButton("Create a free account", primary = false)
            Text(
                "Use ${page.sentTo}, the address this card was sent to.",
                fontSize = 13.sp,
                lineHeight = 19.sp,
                color = PantopusColors.appTextSecondary,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth().padding(top = 2.dp),
            )
        }
    }
}

/** A button on the link page, drawn: it does nothing here. */
@Composable
private fun PageButton(
    title: String,
    primary: Boolean,
) {
    val shape = RoundedCornerShape(Radii.lg)
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 48.dp)
                .clip(shape)
                .background(if (primary) PantopusColors.primary600 else PantopusColors.appSurface)
                .then(if (primary) Modifier else Modifier.border(1.dp, PantopusColors.appBorder, shape)),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            title,
            fontSize = 15.sp,
            lineHeight = 20.sp,
            fontWeight = FontWeight.SemiBold,
            color = if (primary) PantopusColors.appTextInverse else PantopusColors.primary600,
        )
    }
}

/** The footer under step 5: until when it can be taken back, why sending failed, and "Seal and send". */
@Composable
internal fun LookFooter(
    byEmail: Boolean,
    form: SendCardForm,
    onSend: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth().background(PantopusColors.cardDesk)) {
        HorizontalDivider(color = PantopusColors.cardNoteEdge)
        Column(modifier = Modifier.padding(start = Spacing.s4, end = Spacing.s4, top = Spacing.s3, bottom = Spacing.s4)) {
            DeskNote(
                if (byEmail) {
                    "You can take it back until they open it."
                } else {
                    "You can take it back until the carrier picks it up at 7 a.m. their time."
                },
            )
            form.sendError?.let {
                Text(
                    it,
                    fontSize = 14.sp,
                    lineHeight = 20.sp,
                    fontWeight = FontWeight.Medium,
                    color = PantopusColors.cardTextProblem,
                    modifier = Modifier.padding(top = 10.dp).semantics { liveRegion = LiveRegionMode.Assertive }.testTag("sendCardError"),
                )
            }
            CardButton(
                "Seal and send",
                onClick = onSend,
                busy = form.sending,
                modifier = Modifier.padding(top = 10.dp).testTag("sendCardLookSend"),
            )
        }
    }
}

/** Sealed until Christmas morning once it's in their mailbox. */
private val HolidayCardPreview.sealed: Boolean
    get() = piece.card?.sealed == true || piece.card?.arrival == "sealed_christmas"

/** The card as the page they open it on shows it: its picture and printing, the postmark, and the note on its back. */
private fun lookCard(
    preview: HolidayCardPreview,
    design: HolidayCardDesign,
    year: Int,
): MailLetterCard {
    val card = preview.piece.card
    return MailLetterCard(
        design = card?.design ?: design.id,
        caption = card?.caption ?: design.caption,
        paper = card?.paper ?: design.paper,
        year = card?.year ?: year,
        // It comes out of its envelope on the day it opens.
        sealed = false,
        opensOn = null,
        opensIn = null,
        mailedOn = preview.piece.postmark?.date ?: preview.piece.createdAt,
        note = preview.piece.content.orEmpty().trim(),
        firstOpen = true,
    )
}

/**
 * The envelope as their Mailbox draws it the morning it comes: the Mailbox's own mapper, on their clock (7 a.m.,
 * "today"), addressed to [toName] only, never an address. Its stamp goes with the picture, as on step 4.
 */
private fun lookEnvelope(
    preview: HolidayCardPreview,
    toName: String,
    card: MailLetterCard,
): MailPieceModel {
    val row = preview.piece.asRow(card, preview.sealed)
    val morning = theirMorning(preview.piece.deliveredAt, preview.arrivesOn)
    return MailPieceMapper
        .piece(row, MailAddressBook(personName = toName), zone = morning?.first ?: ZoneId.systemDefault(), now = morning?.second ?: Instant.now())
        .copy(to = toName, toLine = null)
}

/**
 * Their clock the morning it comes, as a fixed offset (it comes at 7 a.m. on [arrivesOn] where they live; the server
 * never says where that is), and that moment. Null by email, or when either is missing.
 */
private fun theirMorning(
    deliveredAt: String?,
    arrivesOn: String?,
): Pair<ZoneId, Instant>? {
    val at = HolidayCardTimes.parse(deliveredAt) ?: return null
    val day = arrivesOn?.let { runCatching { LocalDate.parse(it) }.getOrNull() } ?: return null
    val seconds = Duration.between(at.atOffset(ZoneOffset.UTC).toLocalDateTime(), day.atTime(MAIL_HOUR, 0)).seconds
    val offset = runCatching { ZoneOffset.ofTotalSeconds(seconds.toInt()) }.getOrNull() ?: return null
    return offset to at
}

/** The morning mail comes at 7 a.m. where they live. */
private const val MAIL_HOUR = 7

/** The preview's piece as a Mailbox row, so the Mailbox's own mapper draws it; the card from [card] if it has none. */
private fun HolidayCardPreviewPiece.asRow(
    card: MailLetterCard,
    sealed: Boolean,
): DrawerMail =
    DrawerMail(
        id = id,
        type = "letter",
        mailType = null,
        subject = subject,
        createdAt = createdAt.orEmpty(),
        displayTitle = null,
        previewText = null,
        ackRequired = null,
        ackStatus = null,
        sender = null,
        senderBusinessName = senderBusinessName,
        senderAddress = null,
        senderDisplay = senderDisplay,
        senderTrust = senderTrust,
        `package` = null,
        kind = kind ?: "letter",
        deliveredAt = deliveredAt,
        postmark = postmark,
        card =
            this.card ?: MailCard(design = card.design, caption = card.caption, paper = card.paper, year = card.year, sealed = sealed),
    )
