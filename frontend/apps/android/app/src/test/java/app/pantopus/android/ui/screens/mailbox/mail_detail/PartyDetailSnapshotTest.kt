@file:Suppress("PackageNaming", "MagicNumber", "LongMethod")

package app.pantopus.android.ui.screens.mailbox.mail_detail

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.data.api.models.mailbox.v2.PartyDetailDto
import app.pantopus.android.data.api.models.mailbox.v2.PartyRsvpStatus
import app.pantopus.android.ui.screens.mailbox.item_detail.MailItemCategory
import app.pantopus.android.ui.screens.mailbox.item_detail.MailItemSampleData
import app.pantopus.android.ui.screens.mailbox.item_detail.MailTrust
import app.pantopus.android.ui.screens.mailbox.mail_detail.variants.PartyDetailLayout
import app.pantopus.android.ui.screens.shared.mail_item_detail.MailDetailTrust
import app.pantopus.android.ui.theme.PantopusColors
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Before
import org.junit.Rule
import org.junit.Test

/**
 * A17.9 — Paparazzi snapshots for the Party variant on Android. Mirrors
 * iOS `PartyDetailLayoutSnapshotTests` (open invite + going state +
 * fixture-shape guard). Iconography differs (Material vs SF Symbols)
 * but the layout vocabulary matches.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class PartyDetailSnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig = DeviceConfig.PIXEL_5.copy(screenHeight = 3000, softButtons = false),
        )

    @Before fun setup() = Dispatchers.setMain(UnconfinedTestDispatcher())

    @After fun tearDown() = Dispatchers.resetMain()

    @Test
    fun party_layout_open() {
        paparazzi.snapshot {
            Root {
                PartyDetailLayout(
                    content = makeContent(party = MailItemSampleData.partyInvite),
                    party = MailItemSampleData.partyInvite,
                    rsvpInFlight = false,
                    onBack = {},
                    onSetRsvp = {},
                    onAdjustPlusOne = {},
                    onClaimBring = {},
                    onReleaseBring = {},
                    onOpenSenderProfile = {},
                    onSaveToVault = {},
                )
            }
        }
    }

    @Test
    fun party_layout_going() {
        paparazzi.snapshot {
            Root {
                PartyDetailLayout(
                    content = makeContent(party = MailItemSampleData.partyInviteGoing),
                    party = MailItemSampleData.partyInviteGoing,
                    rsvpInFlight = false,
                    onBack = {},
                    onSetRsvp = {},
                    onAdjustPlusOne = {},
                    onClaimBring = {},
                    onReleaseBring = {},
                    onOpenSenderProfile = {},
                    onSaveToVault = {},
                )
            }
        }
    }

    @Test
    fun party_fixture_shapes_matchA179() {
        val invite = MailItemSampleData.partyInvite
        assertEquals("SAT", invite.event.date.dayLabel)
        assertEquals("MAY", invite.event.date.monthLabel)
        assertEquals("24", invite.event.date.dayNumber)
        assertEquals(4, invite.bringList.size)
        assertEquals(6, invite.goingAttendees.size)
        assertEquals(1, invite.maybeCount)
        assertEquals(PartyRsvpStatus.Undecided, invite.rsvp)
        assertEquals(3, invite.elfOpen.bullets.size)
        assertEquals(3, invite.elfGoing.bullets.size)
        assertEquals("Priya x", invite.note.signature)

        val going = MailItemSampleData.partyInviteGoing
        assertEquals(PartyRsvpStatus.Going, going.rsvp)
        assertEquals(1, going.plusOneCount)
        assertEquals("You", going.bringList.first().claimedBy)
        assertNotNull(going.rsvpConfirmedAtLabel)
        // Going headcount: 6 friends + 3 friend plus-ones + you + your +1 = 11
        assertEquals(11, going.headcount)
    }

    private fun makeContent(party: PartyDetailDto): MailDetailContent =
        MailDetailContent(
            mailId = "party-test",
            category = MailItemCategory.Party,
            trust = MailTrust.Verified,
            detailTrust = MailDetailTrust.Celebration,
            senderDisplayName = party.host.name,
            senderMeta = party.host.blurb,
            senderTypeLabel = "Pantopus user",
            carrierLine = "via Pantopus Mail",
            senderInitials = party.host.initials,
            senderUserId = "user-priya",
            title = party.event.what,
            excerpt = null,
            referenceLabel = "Invite EVT-0517 - 12 invited - personal",
            createdAtLabel = "Wed May 21, 2026",
            expiresAtLabel = null,
            readStatusLabel = if (party.rsvp == PartyRsvpStatus.Going) "Read" else "Unread",
            bodyParagraphs = emptyList(),
            attachments = emptyList(),
            aiSummary = null,
            ackRequired = false,
            isAcknowledged = party.rsvp == PartyRsvpStatus.Going,
            partyDetail = party,
        )

    @Composable
    private fun Root(content: @Composable () -> Unit) {
        Box(modifier = Modifier.fillMaxSize().background(PantopusColors.appBg)) { content() }
    }
}
