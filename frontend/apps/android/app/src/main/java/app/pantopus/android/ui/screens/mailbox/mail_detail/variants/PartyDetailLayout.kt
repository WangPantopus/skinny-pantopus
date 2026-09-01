@file:Suppress(
    "PackageNaming",
    "MagicNumber",
    "LongMethod",
    "LongParameterList",
    "TooManyFunctions",
    "ComplexMethod",
)

package app.pantopus.android.ui.screens.mailbox.mail_detail.variants

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.mailbox.v2.PartyDetailDto
import app.pantopus.android.data.api.models.mailbox.v2.PartyElfBullet
import app.pantopus.android.data.api.models.mailbox.v2.PartyRsvpStatus
import app.pantopus.android.ui.screens.mailbox.item_detail.bodies.PartyBody
import app.pantopus.android.ui.screens.mailbox.item_detail.bodies.components.PartyHero
import app.pantopus.android.ui.screens.mailbox.item_detail.bodies.components.RsvpCluster
import app.pantopus.android.ui.screens.mailbox.mail_detail.MailDetailContent
import app.pantopus.android.ui.screens.shared.mail_item_detail.AIElfBullet
import app.pantopus.android.ui.screens.shared.mail_item_detail.AIElfStripContent
import app.pantopus.android.ui.screens.shared.mail_item_detail.MailDetailTrust
import app.pantopus.android.ui.screens.shared.mail_item_detail.MailItemDetailShell
import app.pantopus.android.ui.screens.shared.mail_item_detail.MailOverflowItem
import app.pantopus.android.ui.screens.shared.mail_item_detail.MailTopBarConfig
import app.pantopus.android.ui.screens.shared.mail_item_detail.MailTopBarTrailingAction
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * A17.9 — Party ceremonial variant of the mail item detail. Mirrors iOS
 * `PartyDetailLayout`. Composes the shared [MailItemDetailShell] with
 * the bespoke Party slots (hero with ConfettiSpray overlay, party elf,
 * host card, event details + DateTile + vibe rows, going strip,
 * handwritten note, potluck list, RSVP cluster).
 */
@Composable
fun PartyDetailLayout(
    content: MailDetailContent,
    party: PartyDetailDto,
    rsvpInFlight: Boolean,
    onBack: () -> Unit,
    onSetRsvp: (PartyRsvpStatus) -> Unit,
    onAdjustPlusOne: (Int) -> Unit,
    onClaimBring: (Int) -> Unit,
    onReleaseBring: (Int) -> Unit,
    onOpenSenderProfile: (String) -> Unit = {},
    onSaveToVault: () -> Unit = {},
) {
    Box(modifier = Modifier.testTag("mailDetail_party")) {
        MailItemDetailShell(
            topBar = makeTopBar(onBack = onBack, onSaveToVault = onSaveToVault),
            aiElf = makeAIElf(party = party),
            hero = { PartyHero(party = party) },
            keyFacts = { EventDetailsCard(party = party) },
            body = {
                PartyBody(
                    party = party,
                    onClaimBring = onClaimBring,
                    onReleaseBring = onReleaseBring,
                )
            },
            sender = { HostCard(party = party, onOpenProfile = onOpenSenderProfile) },
            actions = {
                RsvpCluster(
                    party = party,
                    inFlight = rsvpInFlight,
                    onSetRsvp = onSetRsvp,
                    onAdjustPlusOne = onAdjustPlusOne,
                    onAddToCalendar = { /* stub — calendar wiring out of scope */ },
                    onGetDirections = { /* stub — map deep-link out of scope */ },
                    onMessageHost = { onOpenSenderProfile(content.senderUserId ?: "host") },
                    onShareInvite = { onSaveToVault() },
                    onMute = { /* stub */ },
                )
            },
        )
    }
}

private fun makeTopBar(
    onBack: () -> Unit,
    onSaveToVault: () -> Unit,
): MailTopBarConfig =
    MailTopBarConfig(
        eyebrow = "Party invite",
        trust = MailDetailTrust.Celebration,
        onBack = onBack,
        trailingAction =
            MailTopBarTrailingAction(
                icon = PantopusIcon.Bookmark,
                contentDescription = "Save invite",
                onClick = onSaveToVault,
            ),
        overflowItems =
            listOf(
                MailOverflowItem("share", PantopusIcon.Share, "Share invite") {},
                MailOverflowItem("addToCalendar", PantopusIcon.CalendarPlus, "Add to calendar") {},
                MailOverflowItem("mute", PantopusIcon.BellOff, "Mute invite") {},
                MailOverflowItem("report", PantopusIcon.AlertTriangle, "Report") {},
            ),
    )

private fun makeAIElf(party: PartyDetailDto): AIElfStripContent {
    val elf = if (party.rsvp == PartyRsvpStatus.Going) party.elfGoing else party.elfOpen
    val bullets =
        elf.bullets.mapIndexed { index, bullet ->
            AIElfBullet(
                id = "party-elf-$index",
                icon = glyph(bullet.glyph),
                label = bullet.label,
                text = bullet.text,
            )
        }
    return AIElfStripContent(headline = elf.headline, summary = elf.summary, bullets = bullets)
}

private fun glyph(glyph: PartyElfBullet.Glyph): PantopusIcon =
    when (glyph) {
        PartyElfBullet.Glyph.Users -> PantopusIcon.Users
        PartyElfBullet.Glyph.CloudSun -> PantopusIcon.CloudSun
        PartyElfBullet.Glyph.Calendar -> PantopusIcon.Calendar
        PartyElfBullet.Glyph.CalendarCheck -> PantopusIcon.CalendarCheck
        PartyElfBullet.Glyph.UserPlus -> PantopusIcon.UserPlus
        PartyElfBullet.Glyph.Gift -> PantopusIcon.Gift
    }

@Composable
private fun HostCard(
    party: PartyDetailDto,
    onOpenProfile: (String) -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s3)
                .testTag("partyHostCard"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Text(
            text = "HOST",
            fontSize = 11.sp,
            fontWeight = FontWeight.Black,
            letterSpacing = 0.6.sp,
            color = PantopusColors.appTextSecondary,
        )
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            HostAvatar(party = party)
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(
                        text = party.host.name,
                        fontSize = 14.5.sp,
                        fontWeight = FontWeight.Bold,
                        color = PantopusColors.appText,
                    )
                    Text(
                        text = party.host.relationLabel,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Black,
                        color = PantopusColors.personal,
                        modifier =
                            Modifier
                                .clip(RoundedCornerShape(Radii.pill))
                                .background(PantopusColors.personalBg)
                                .padding(horizontal = Spacing.s2, vertical = 2.dp),
                    )
                }
                Text(
                    text = party.host.blurb,
                    fontSize = 12.sp,
                    color = PantopusColors.appTextSecondary,
                )
            }
            Box(
                modifier =
                    Modifier
                        .size(32.dp)
                        .clip(CircleShape)
                        .background(PantopusColors.appSurfaceSunken)
                        .clickable { onOpenProfile("host") }
                        .testTag("partyHostCard_message"),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.MessageSquare,
                    contentDescription = "Message host",
                    size = 14.dp,
                    tint = PantopusColors.appTextStrong,
                )
            }
        }
    }
}

@Composable
private fun HostAvatar(party: PartyDetailDto) {
    Box(modifier = Modifier.size(44.dp)) {
        Box(
            modifier =
                Modifier
                    .size(44.dp)
                    .clip(CircleShape)
                    .background(
                        Brush.linearGradient(
                            listOf(PantopusColors.categoryParty, PantopusColors.error),
                        ),
                    )
                    .border(2.dp, PantopusColors.categoryParty.copy(alpha = 0.55f), CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = party.host.initials,
                fontSize = 14.sp,
                fontWeight = FontWeight.Black,
                letterSpacing = 0.2.sp,
                color = PantopusColors.appTextInverse,
            )
        }
        if (party.host.isVerified) {
            Box(
                modifier =
                    Modifier
                        .align(Alignment.BottomEnd)
                        .size(16.dp)
                        .clip(CircleShape)
                        .background(PantopusColors.success)
                        .border(2.dp, PantopusColors.appSurface, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Check,
                    contentDescription = null,
                    size = 9.dp,
                    tint = PantopusColors.appTextInverse,
                )
            }
        }
    }
}

@Composable
private fun EventDetailsCard(party: PartyDetailDto) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .testTag("partyEventDetails"),
    ) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                modifier = Modifier.weight(1f).semantics { heading() },
                text = "THE DETAILS",
                fontSize = 11.sp,
                fontWeight = FontWeight.Black,
                letterSpacing = 0.5.sp,
                color = PantopusColors.appTextSecondary,
            )
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                PantopusIconImage(
                    icon = PantopusIcon.Navigation,
                    contentDescription = null,
                    size = 11.dp,
                    tint = PantopusColors.primary600,
                )
                Text(
                    text = party.event.walkLabel,
                    fontSize = 10.5.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.primary600,
                )
            }
        }
        HorizontalDivider(color = PantopusColors.appBorderSubtle)
        Column(
            modifier = Modifier.padding(Spacing.s3),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
            ) {
                PartyMap()
                Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    Text(
                        text = party.event.location,
                        fontSize = 13.5.sp,
                        fontWeight = FontWeight.Bold,
                        color = PantopusColors.appText,
                    )
                    Text(
                        text = party.event.locationNote,
                        fontSize = 11.5.sp,
                        color = PantopusColors.appTextSecondary,
                        maxLines = 2,
                    )
                }
            }
            VibeRows(party = party)
        }
    }
}

// Abstract mini-map preview (party.jsx PartyMap): four street-grid
// blocks (one park-green) split by white roads, tiny house dots, and
// a drop pin near the venue corner. Purely decorative — geometry
// mirrors the design's 64×64 SVG.
@Composable
private fun PartyMap() {
    Box(
        modifier =
            Modifier
                .size(64.dp)
                .clip(RoundedCornerShape(10.dp))
                .background(PantopusColors.appSurfaceSunken)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(10.dp))
                .testTag("partyEventDetails_miniMap"),
    ) {
        Box(Modifier.size(28.dp).background(PantopusColors.appBorderSubtle))
        Box(
            Modifier
                .offset(x = 34.dp)
                .size(width = 30.dp, height = 28.dp)
                .background(PantopusColors.appBorderSubtle),
        )
        Box(
            Modifier
                .offset(y = 36.dp)
                .size(28.dp)
                .background(PantopusColors.appBorderSubtle),
        )
        Box(
            Modifier
                .offset(x = 34.dp, y = 36.dp)
                .size(width = 30.dp, height = 28.dp)
                .background(PantopusColors.successBg),
        )
        Box(
            Modifier
                .offset(x = 28.dp)
                .size(width = 6.dp, height = 64.dp)
                .background(PantopusColors.appSurface),
        )
        Box(
            Modifier
                .offset(y = 28.dp)
                .size(width = 64.dp, height = 8.dp)
                .background(PantopusColors.appSurface),
        )
        Box(
            Modifier
                .offset(x = 31.dp)
                .size(width = 1.dp, height = 64.dp)
                .background(PantopusColors.appBorder),
        )
        Box(
            Modifier
                .offset(y = 32.dp)
                .size(width = 64.dp, height = 1.dp)
                .background(PantopusColors.appBorder),
        )
        Box(Modifier.offset(x = 6.dp, y = 6.dp).size(6.dp).background(PantopusColors.appBorderStrong))
        Box(Modifier.offset(x = 18.dp, y = 14.dp).size(6.dp).background(PantopusColors.appBorderStrong))
        Box(Modifier.offset(x = 44.dp, y = 6.dp).size(6.dp).background(PantopusColors.appBorderStrong))
        Box(Modifier.offset(x = 6.dp, y = 44.dp).size(6.dp).background(PantopusColors.appBorderStrong))
        PartyMapPinDrop(modifier = Modifier.offset(x = 37.dp, y = 30.dp))
    }
}

// Teardrop map pin — rounded square with one sharp corner, rotated so
// the point faces down (JSX `borderRadius: '50% 50% 50% 0'` trick).
@Composable
private fun PartyMapPinDrop(modifier: Modifier = Modifier) {
    val teardrop =
        RoundedCornerShape(
            topStart = 10.dp,
            topEnd = 10.dp,
            bottomEnd = 10.dp,
            bottomStart = 0.dp,
        )
    Box(
        modifier =
            modifier
                .size(20.dp)
                .rotate(-45f)
                .clip(teardrop)
                .background(PantopusColors.categoryParty)
                .border(2.dp, PantopusColors.appSurface, teardrop),
    )
}

@Composable
private fun VibeRows(party: PartyDetailDto) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(10.dp))
                .background(PantopusColors.appSurfaceSunken)
                .border(1.dp, PantopusColors.appBorderSubtle, RoundedCornerShape(10.dp)),
    ) {
        VibeRow(icon = PantopusIcon.Shirt, label = "DRESS CODE", value = party.event.dressCode)
        HorizontalDivider(color = PantopusColors.appBorderSubtle)
        VibeRow(icon = PantopusIcon.Baby, label = "KIDS", value = party.event.kids)
        HorizontalDivider(color = PantopusColors.appBorderSubtle)
        VibeRow(
            icon = PantopusIcon.CloudSun,
            label = "FORECAST",
            value = "${party.event.weatherTemperatureF}° · ${party.event.weatherSummary}",
        )
    }
}

@Composable
private fun VibeRow(
    icon: PantopusIcon,
    label: String,
    value: String,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s3, vertical = 9.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Box(
            modifier =
                Modifier
                    .size(24.dp)
                    .clip(RoundedCornerShape(7.dp))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(7.dp)),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = icon,
                contentDescription = null,
                size = 12.dp,
                tint = PantopusColors.categoryParty,
            )
        }
        Text(
            text = label,
            fontSize = 10.5.sp,
            fontWeight = FontWeight.Black,
            letterSpacing = 0.5.sp,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.widthIn(min = 76.dp),
        )
        Text(
            modifier = Modifier.weight(1f),
            text = value,
            fontSize = 12.5.sp,
            color = PantopusColors.appTextStrong,
            textAlign = androidx.compose.ui.text.style.TextAlign.End,
        )
    }
}
