@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.mailbox.mail_party

import app.pantopus.android.data.api.models.homes.OccupantDto
import app.pantopus.android.data.api.models.homes.OccupantsResponse
import app.pantopus.android.data.api.models.mailbox.v2.DrawerItemsResponse
import app.pantopus.android.data.api.models.mailbox.v2.DrawerMail
import app.pantopus.android.data.api.models.mailbox.v2.MailPartyActiveResponse
import app.pantopus.android.data.api.models.mailbox.v2.MailPartyAssignResponse
import app.pantopus.android.data.api.models.mailbox.v2.MailPartyCreateResponse
import app.pantopus.android.data.api.models.mailbox.v2.MailPartyDeclineResponse
import app.pantopus.android.data.api.models.mailbox.v2.MailPartyJoinResponse
import app.pantopus.android.data.api.models.mailbox.v2.MailPartyMailDto
import app.pantopus.android.data.api.models.mailbox.v2.MailPartyReactionResponse
import app.pantopus.android.data.api.models.mailbox.v2.MailPartySessionDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomeMembersRepository
import app.pantopus.android.data.mailbox.MailboxPartyRepository
import app.pantopus.android.data.mailbox.MailboxRepository
import app.pantopus.android.data.network.NetworkMonitor
import io.mockk.coEvery
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * Coverage for the Family Mail Party surface
 * (`backend/routes/mailboxV2Phase2.js`, mounted at `api/mailbox/v2/p2`):
 *   GET  /party/active (:926),  POST /party/create   (:741),
 *   POST /party/join   (:816),  POST /party/decline  (:866),
 *   POST /party/reaction (:875), POST /party/assign  (:887)
 * plus the two supporting reads — the Home drawer (`mailboxV2.js:280`) for
 * startable items and the occupants roster (`home.js:3705`) for the
 * hand-off list.
 *
 * Mirrors iOS `MailPartyViewModelTests`.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class MailPartyViewModelTest {
    private val partyRepo: MailboxPartyRepository = mockk()
    private val mailboxRepo: MailboxRepository = mockk()
    private val membersRepo: HomeMembersRepository = mockk()

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun makeVm(): MailPartyViewModel {
        val networkMonitor =
            mockk<NetworkMonitor>(relaxed = true)
                .also { every { it.isOnline } returns MutableStateFlow(true) }
        return MailPartyViewModel(partyRepo, mailboxRepo, membersRepo, networkMonitor)
    }

    // ── Fixtures ──────────────────────────────────────────────────

    private fun twoSessions() =
        MailPartyActiveResponse(
            listOf(
                MailPartySessionDto(
                    id = "s-1",
                    mailId = "m-1",
                    homeId = "h-1",
                    status = "pending",
                    mail =
                        MailPartyMailDto(
                            id = "m-1",
                            subject = "Property tax notice",
                            senderDisplay = "Elm Park Assessor",
                        ),
                ),
                MailPartySessionDto(
                    id = "s-2",
                    mailId = "m-2",
                    homeId = "h-1",
                    status = "active",
                    mail = MailPartyMailDto(id = "m-2", senderDisplay = "EBMUD"),
                ),
            ),
        )

    private fun oneDrawerItem() =
        DrawerItemsResponse(
            mail =
                listOf(
                    DrawerMail(
                        id = "m-9",
                        type = "physical",
                        mailType = null,
                        subject = null,
                        createdAt = "2026-08-17T10:00:00Z",
                        displayTitle = "Water bill",
                        previewText = null,
                        ackRequired = null,
                        ackStatus = null,
                        sender = null,
                        senderBusinessName = null,
                        senderAddress = null,
                        senderDisplay = "EBMUD",
                        senderTrust = "verified_utility",
                        `package` = null,
                    ),
                ),
            total = 1,
            drawer = "home",
        )

    private fun emptyDrawer() = DrawerItemsResponse(mail = emptyList(), total = 0, drawer = "home")

    private fun twoOccupants() =
        OccupantsResponse(
            occupants =
                listOf(
                    OccupantDto(id = "o-1", userId = "u-1", role = "owner", displayName = "Marcus Kovacs"),
                    OccupantDto(id = "o-2", userId = "u-2", role = "restricted_member", username = "tess"),
                ),
        )

    private fun noOccupants() = OccupantsResponse(occupants = emptyList())

    private fun createdSession() =
        MailPartyCreateResponse(
            session = MailPartySessionDto(id = "s-9", mailId = "m-9", homeId = "h-1", status = "pending"),
            expiresIn = 90,
        )

    private fun stubDiscover(
        active: NetworkResult<MailPartyActiveResponse>,
        drawer: NetworkResult<DrawerItemsResponse>,
    ) {
        coEvery { partyRepo.activeSessions() } returns active
        coEvery { mailboxRepo.drawer(any(), any(), any(), any()) } returns drawer
    }

    // ── Discover ──────────────────────────────────────────────────

    @Test
    fun noSessionsAndNoHomeMailRendersEmpty() =
        runTest {
            stubDiscover(
                NetworkResult.Success(MailPartyActiveResponse(emptyList())),
                NetworkResult.Success(emptyDrawer()),
            )
            val vm = makeVm()
            vm.load()

            assertTrue(vm.discover.value is MailPartyDiscoverUiState.Empty)
            assertEquals("Open household mail together", vm.discoverSubtitle)
        }

    @Test
    fun loadProjectsSessionsAndStartableItems() =
        runTest {
            stubDiscover(NetworkResult.Success(twoSessions()), NetworkResult.Success(oneDrawerItem()))
            val vm = makeVm()
            vm.load()

            val loaded = vm.discover.value as MailPartyDiscoverUiState.Loaded
            assertEquals(2, loaded.sessions.size)
            assertEquals("s-1", loaded.sessions[0].sessionId)
            assertEquals("Property tax notice", loaded.sessions[0].title)
            assertEquals("Elm Park Assessor", loaded.sessions[0].senderDisplay)
            assertEquals(MailPartyStatus.Pending, loaded.sessions[0].status)
            assertEquals("Waiting to start", loaded.sessions[0].status.label)
            // No subject on the joined Mail row — falls back to the shared copy.
            assertEquals("Household mail", loaded.sessions[1].title)
            assertEquals(MailPartyStatus.Active, loaded.sessions[1].status)
            assertEquals(1, loaded.startable.size)
            assertEquals("m-9", loaded.startable[0].mailId)
            assertEquals("Water bill", loaded.startable[0].title)
            assertEquals("2 happening now", vm.discoverSubtitle)
            assertNull(vm.live.value)
        }

    @Test
    fun startListIsScopedToTheHomeDrawerIncomingWindow() =
        runTest {
            stubDiscover(
                NetworkResult.Success(MailPartyActiveResponse(emptyList())),
                NetworkResult.Success(oneDrawerItem()),
            )
            val drawer = slot<String>()
            val tab = slot<String>()
            coEvery {
                mailboxRepo.drawer(capture(drawer), capture(tab), any(), any())
            } returns NetworkResult.Success(oneDrawerItem())

            makeVm().load()

            // `/party/create` 400s on anything outside the Home drawer.
            assertEquals("home", drawer.captured)
            assertEquals("incoming", tab.captured)
        }

    @Test
    fun activeFetchFailureSurfacesError() =
        runTest {
            stubDiscover(
                NetworkResult.Failure(NetworkError.Server(500, "boom")),
                NetworkResult.Success(emptyDrawer()),
            )
            val vm = makeVm()
            vm.load()

            assertTrue(vm.discover.value is MailPartyDiscoverUiState.Error)
        }

    // ── Start / join ──────────────────────────────────────────────

    @Test
    fun startPartyEntersLiveSessionWithRoster() =
        runTest {
            stubDiscover(
                NetworkResult.Success(MailPartyActiveResponse(emptyList())),
                NetworkResult.Success(oneDrawerItem()),
            )
            val mailId = slot<String>()
            coEvery { partyRepo.createSession(capture(mailId)) } returns NetworkResult.Success(createdSession())
            coEvery { membersRepo.listOccupants("h-1") } returns NetworkResult.Success(twoOccupants())

            val vm = makeVm()
            vm.load()
            val loaded = vm.discover.value as MailPartyDiscoverUiState.Loaded
            vm.startParty(loaded.startable[0])

            assertEquals("m-9", mailId.captured)
            val session = (vm.live.value as MailPartyLiveUiState.Loaded).session
            assertEquals("s-9", session.sessionId)
            assertEquals("m-9", session.mailId)
            // `/party/create` returns the bare session with no joined Mail
            // row, so the frame keeps the label the user just tapped.
            assertEquals("Water bill", session.title)
            assertEquals("EBMUD", session.senderDisplay)
            assertEquals(listOf("u-1", "u-2"), session.members.map { it.userId })
            assertEquals("Marcus Kovacs", session.members[0].name)
            assertEquals("Owner", session.members[0].roleLabel)
            // Username fallback + underscore-free role label.
            assertEquals("tess", session.members[1].name)
            assertEquals("Restricted member", session.members[1].roleLabel)
            assertFalse(vm.isStarting.value)
        }

    @Test
    fun joinEntersLiveSessionAsActive() =
        runTest {
            stubDiscover(NetworkResult.Success(twoSessions()), NetworkResult.Success(emptyDrawer()))
            coEvery { partyRepo.joinSession("s-1") } returns
                NetworkResult.Success(
                    MailPartyJoinResponse(
                        MailPartySessionDto(id = "s-1", mailId = "m-1", homeId = "h-1", status = "active"),
                    ),
                )
            coEvery { membersRepo.listOccupants("h-1") } returns NetworkResult.Success(twoOccupants())

            val vm = makeVm()
            vm.load()
            val loaded = vm.discover.value as MailPartyDiscoverUiState.Loaded
            vm.join(loaded.sessions[0])

            val session = (vm.live.value as MailPartyLiveUiState.Loaded).session
            assertEquals("s-1", session.sessionId)
            assertEquals(MailPartyStatus.Active, session.status)
            // `/party/join` also omits the joined Mail row — the card's own
            // label carries over rather than falling back to the unknown copy.
            assertEquals("Property tax notice", session.title)
            assertEquals("Elm Park Assessor", session.senderDisplay)
        }

    @Test
    fun expiredJoinDropsTheRowAndToasts() =
        runTest {
            stubDiscover(NetworkResult.Success(twoSessions()), NetworkResult.Success(emptyDrawer()))
            coEvery { partyRepo.joinSession("s-1") } returns
                NetworkResult.Failure(NetworkError.Server(400, "Session expired"))

            val vm = makeVm()
            vm.load()
            val loaded = vm.discover.value as MailPartyDiscoverUiState.Loaded
            vm.join(loaded.sessions[0])

            assertNull(vm.live.value)
            assertNotNull(vm.toast.value)
            val remaining = vm.discover.value as MailPartyDiscoverUiState.Loaded
            assertEquals(listOf("s-2"), remaining.sessions.map { it.sessionId })
        }

    @Test
    fun liveSessionWithNoRosterRendersEmpty() =
        runTest {
            stubDiscover(
                NetworkResult.Success(MailPartyActiveResponse(emptyList())),
                NetworkResult.Success(oneDrawerItem()),
            )
            coEvery { partyRepo.createSession(any()) } returns NetworkResult.Success(createdSession())
            coEvery { membersRepo.listOccupants("h-1") } returns NetworkResult.Success(noOccupants())

            val vm = makeVm()
            vm.load()
            val loaded = vm.discover.value as MailPartyDiscoverUiState.Loaded
            vm.startParty(loaded.startable[0])

            val empty = vm.live.value as MailPartyLiveUiState.Empty
            assertTrue(empty.session.members.isEmpty())
            assertEquals("s-9", empty.session.sessionId)
        }

    @Test
    fun rosterFailureSurfacesSessionError() =
        runTest {
            stubDiscover(
                NetworkResult.Success(MailPartyActiveResponse(emptyList())),
                NetworkResult.Success(oneDrawerItem()),
            )
            coEvery { partyRepo.createSession(any()) } returns NetworkResult.Success(createdSession())
            coEvery { membersRepo.listOccupants("h-1") } returns
                NetworkResult.Failure(NetworkError.Server(500, "boom"))

            val vm = makeVm()
            vm.load()
            val loaded = vm.discover.value as MailPartyDiscoverUiState.Loaded
            vm.startParty(loaded.startable[0])

            assertTrue(vm.live.value is MailPartyLiveUiState.Error)
            assertNull(vm.liveSession)
        }

    // ── Decline ───────────────────────────────────────────────────

    @Test
    fun declineDropsTheRowAndOpensSolo() =
        runTest {
            stubDiscover(NetworkResult.Success(twoSessions()), NetworkResult.Success(emptyDrawer()))
            coEvery { partyRepo.declineSession("s-1") } returns
                NetworkResult.Success(
                    MailPartyDeclineResponse("Declined. You can still open the item solo."),
                )

            val opened = mutableListOf<String>()
            val vm = makeVm()
            vm.load()
            val loaded = vm.discover.value as MailPartyDiscoverUiState.Loaded
            vm.decline(loaded.sessions[0]) { opened += it }

            assertEquals(listOf("m-1"), opened)
            assertEquals("Declined. You can still open the item solo.", vm.toast.value?.text)
            val remaining = vm.discover.value as MailPartyDiscoverUiState.Loaded
            assertEquals(listOf("s-2"), remaining.sessions.map { it.sessionId })
        }

    // ── Reactions ─────────────────────────────────────────────────

    @Test
    fun reactionEchoCarriesTheServerTtl() =
        runTest {
            stubDiscover(
                NetworkResult.Success(MailPartyActiveResponse(emptyList())),
                NetworkResult.Success(oneDrawerItem()),
            )
            coEvery { partyRepo.createSession(any()) } returns NetworkResult.Success(createdSession())
            coEvery { membersRepo.listOccupants("h-1") } returns NetworkResult.Success(twoOccupants())
            val glyph = slot<String>()
            coEvery { partyRepo.sendReaction("s-9", capture(glyph)) } returns
                NetworkResult.Success(MailPartyReactionResponse(reaction = "🎉", ttl = 5))

            val vm = makeVm()
            vm.load()
            val loaded = vm.discover.value as MailPartyDiscoverUiState.Loaded
            vm.startParty(loaded.startable[0])
            vm.send(MailPartyReaction.Celebrate)

            assertEquals("🎉", glyph.captured)
            assertEquals("🎉", vm.reactionEcho.value?.glyph)
            assertEquals(5, vm.reactionEcho.value?.ttlSeconds)
            assertNull(vm.sendingReaction.value)
            vm.clearReactionEcho()
            assertNull(vm.reactionEcho.value)
        }

    @Test
    fun reactionIsIgnoredOutsideALiveSession() =
        runTest {
            stubDiscover(
                NetworkResult.Success(MailPartyActiveResponse(emptyList())),
                NetworkResult.Success(oneDrawerItem()),
            )
            val vm = makeVm()
            vm.load()
            vm.send(MailPartyReaction.Love)

            assertNull(vm.reactionEcho.value)
            assertNull(vm.toast.value)
        }

    // ── Assign ────────────────────────────────────────────────────

    @Test
    fun assignCompletesTheSessionAndReturnsToDiscover() =
        runTest {
            stubDiscover(
                NetworkResult.Success(MailPartyActiveResponse(emptyList())),
                NetworkResult.Success(oneDrawerItem()),
            )
            coEvery { partyRepo.createSession(any()) } returns NetworkResult.Success(createdSession())
            coEvery { membersRepo.listOccupants("h-1") } returns NetworkResult.Success(twoOccupants())
            coEvery { partyRepo.assignItem("s-9", "m-9", "u-2") } returns
                NetworkResult.Success(MailPartyAssignResponse(message = "Item assigned", assignedTo = "u-2"))

            val vm = makeVm()
            vm.load()
            val loaded = vm.discover.value as MailPartyDiscoverUiState.Loaded
            vm.startParty(loaded.startable[0])
            val session = vm.liveSession!!
            // The refetch after a completed session sees an emptied household.
            coEvery { mailboxRepo.drawer(any(), any(), any(), any()) } returns
                NetworkResult.Success(emptyDrawer())
            vm.assign(session.members[1])

            assertNull(vm.live.value)
            assertEquals("Item assigned", vm.toast.value?.text)
            assertNull(vm.assigningMemberId.value)
            assertTrue(vm.discover.value is MailPartyDiscoverUiState.Empty)
        }

    @Test
    fun assignFailureKeepsTheSessionOpen() =
        runTest {
            stubDiscover(
                NetworkResult.Success(MailPartyActiveResponse(emptyList())),
                NetworkResult.Success(oneDrawerItem()),
            )
            coEvery { partyRepo.createSession(any()) } returns NetworkResult.Success(createdSession())
            coEvery { membersRepo.listOccupants("h-1") } returns NetworkResult.Success(twoOccupants())
            coEvery { partyRepo.assignItem(any(), any(), any()) } returns
                NetworkResult.Failure(NetworkError.Server(500, "boom"))

            val vm = makeVm()
            vm.load()
            val loaded = vm.discover.value as MailPartyDiscoverUiState.Loaded
            vm.startParty(loaded.startable[0])
            vm.assign(vm.liveSession!!.members[0])

            assertTrue(vm.live.value is MailPartyLiveUiState.Loaded)
            assertNotNull(vm.toast.value)
            assertNull(vm.assigningMemberId.value)
        }
}
