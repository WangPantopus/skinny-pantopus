@file:Suppress("LongMethod")

package app.pantopus.android.ui.screens.notifications

import app.pantopus.android.data.api.models.notifications.NotificationActionEcho
import app.pantopus.android.data.api.models.notifications.NotificationDto
import app.pantopus.android.data.api.models.notifications.NotificationsListResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.notifications.NotificationsRepository
import app.pantopus.android.ui.components.StatusChipVariant
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsUiState
import app.pantopus.android.ui.screens.shared.list_of_rows.RowChip
import app.pantopus.android.ui.screens.shared.list_of_rows.RowHighlight
import app.pantopus.android.ui.screens.shared.list_of_rows.RowLeading
import app.pantopus.android.ui.theme.PantopusIcon
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.time.Instant
import java.time.ZoneId

@OptIn(ExperimentalCoroutinesApi::class)
class NotificationsViewModelTest {
    private val repo: NotificationsRepository = mockk()

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun dto(
        id: String,
        type: String? = "reply",
        isRead: Boolean = false,
        link: String? = "/post/$id",
        createdAt: String = "2026-05-15T10:00:00Z",
    ) = NotificationDto(
        id = id,
        userId = "u_me",
        type = type,
        title = "Title $id",
        body = "Body $id",
        icon = null,
        link = link,
        isRead = isRead,
        createdAt = createdAt,
        context = null,
    )

    private val twoUnread =
        NotificationsListResponse(
            notifications = listOf(dto("n1"), dto("n2", type = "gig")),
            unreadCount = 2,
            hasMore = false,
        )

    private val emptyResponse =
        NotificationsListResponse(notifications = emptyList(), unreadCount = 0, hasMore = false)

    // 2026-05-15 12:00:00 UTC — Friday.
    private val fixedNow: Instant = Instant.parse("2026-05-15T12:00:00Z")
    private val utc: ZoneId = ZoneId.of("UTC")

    // MARK: - Lifecycle

    @Test
    fun load_empty_transitions_to_all_tab_empty_with_disabled_top_bar_action() =
        runTest {
            coEvery { repo.list(any(), any(), any()) } returns NetworkResult.Success(emptyResponse)
            val vm = NotificationsViewModel(repo)
            vm.load()
            val state = vm.state.value
            assertTrue(state is ListOfRowsUiState.Empty)
            val empty = state as ListOfRowsUiState.Empty
            assertEquals("All caught up", empty.headline)
            assertEquals(0, vm.unreadCount.value)
            assertNotNull(vm.topBarAction.value)
            assertEquals(false, vm.topBarAction.value?.isEnabled)
        }

    @Test
    fun load_populated_transitions_to_loaded() =
        runTest {
            coEvery { repo.list(any(), any(), any()) } returns NetworkResult.Success(twoUnread)
            val vm = NotificationsViewModel(repo)
            vm.load()
            val state = vm.state.value
            assertTrue(state is ListOfRowsUiState.Loaded)
            val loaded = state as ListOfRowsUiState.Loaded
            // All rows land in "Today" since fixedNow lives on 2026-05-15
            assertEquals(2, loaded.sections.first().rows.size)
            assertEquals(2, vm.unreadCount.value)
            assertEquals(true, vm.topBarAction.value?.isEnabled)
        }

    @Test
    fun load_failure_transitions_error() =
        runTest {
            coEvery { repo.list(any(), any(), any()) } returns
                NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = NotificationsViewModel(repo)
            vm.load()
            assertTrue(vm.state.value is ListOfRowsUiState.Error)
        }

    // MARK: - Tabs

    @Test
    fun tabs_expose_all_and_unread_with_counts() =
        runTest {
            coEvery { repo.list(any(), any(), any()) } returns NetworkResult.Success(twoUnread)
            val vm = NotificationsViewModel(repo)
            vm.load()
            val tabs = vm.tabs.value
            assertEquals(3, tabs.size)
            assertEquals(NotificationsTab.ALL, tabs[0].id)
            assertEquals("All", tabs[0].label)
            assertEquals(2, tabs[0].count)
            assertEquals(NotificationsTab.UNREAD, tabs[1].id)
            assertEquals("Unread", tabs[1].label)
            assertEquals(2, tabs[1].count)
            // S5 — the "Read" filter RN has and native was missing.
            assertEquals(NotificationsTab.READ, tabs[2].id)
            assertEquals("Read", tabs[2].label)
            assertEquals(0, tabs[2].count)
            assertEquals(NotificationsTab.ALL, vm.selectedTab.value)
        }

    @Test
    fun selecting_unread_tab_refetches_with_unread_filter() =
        runTest {
            val unreadOnly =
                NotificationsListResponse(
                    notifications = listOf(dto("n1")),
                    unreadCount = 1,
                    hasMore = false,
                )
            coEvery { repo.list(any(), any(), unreadOnly = false) } returns
                NetworkResult.Success(twoUnread)
            coEvery { repo.list(any(), any(), unreadOnly = true) } returns
                NetworkResult.Success(unreadOnly)
            val vm = NotificationsViewModel(repo)
            vm.load()
            vm.selectTab(NotificationsTab.UNREAD)
            assertEquals(NotificationsTab.UNREAD, vm.selectedTab.value)
            val state = vm.state.value
            assertTrue(state is ListOfRowsUiState.Loaded)
            val loaded = state as ListOfRowsUiState.Loaded
            assertEquals(1, loaded.sections.flatMap { it.rows }.size)
            coVerify { repo.list(limit = any(), offset = 0, unreadOnly = true) }
        }

    @Test
    fun empty_unread_cta_switches_back_to_all_tab() =
        runTest {
            coEvery { repo.list(any(), any(), unreadOnly = false) } returns
                NetworkResult.Success(twoUnread)
            coEvery { repo.list(any(), any(), unreadOnly = true) } returns
                NetworkResult.Success(emptyResponse)
            val vm = NotificationsViewModel(repo)
            vm.load()
            vm.selectTab(NotificationsTab.UNREAD)
            val state = vm.state.value
            assertTrue(state is ListOfRowsUiState.Empty)
            val empty = state as ListOfRowsUiState.Empty
            assertEquals("View all notifications", empty.ctaTitle)
            empty.onCta?.invoke()
            assertEquals(NotificationsTab.ALL, vm.selectedTab.value)
        }

    // MARK: - Mark read

    @Test
    fun mark_read_flips_row_and_persists_on_success() =
        runTest {
            coEvery { repo.list(any(), any(), any()) } returns NetworkResult.Success(twoUnread)
            coEvery { repo.markRead("n1") } returns NetworkResult.Success(NotificationActionEcho(ok = true))
            val vm = NotificationsViewModel(repo)
            vm.load()
            vm.markRead("n1")
            assertEquals(1, vm.unreadCount.value)
            coVerify { repo.markRead("n1") }
        }

    @Test
    fun mark_read_rolls_back_on_failure() =
        runTest {
            coEvery { repo.list(any(), any(), any()) } returns NetworkResult.Success(twoUnread)
            coEvery { repo.markRead("n1") } returns NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = NotificationsViewModel(repo)
            vm.load()
            vm.markRead("n1")
            assertEquals(2, vm.unreadCount.value)
        }

    @Test
    fun mark_all_read_clears_unread_count_and_disables_action() =
        runTest {
            coEvery { repo.list(any(), any(), any()) } returns NetworkResult.Success(twoUnread)
            coEvery { repo.markAllRead() } returns NetworkResult.Success(NotificationActionEcho(count = 0))
            val vm = NotificationsViewModel(repo)
            vm.load()
            vm.markAllRead()
            assertEquals(0, vm.unreadCount.value)
            assertEquals(false, vm.topBarAction.value?.isEnabled)
        }

    @Test
    fun mark_all_read_rolls_back_on_failure() =
        runTest {
            coEvery { repo.list(any(), any(), any()) } returns NetworkResult.Success(twoUnread)
            coEvery { repo.markAllRead() } returns NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = NotificationsViewModel(repo)
            vm.load()
            vm.markAllRead()
            assertEquals(2, vm.unreadCount.value)
            assertEquals(true, vm.topBarAction.value?.isEnabled)
        }

    // MARK: - Row projection per type

    @Test
    fun row_mapping_for_reply_uses_personal_chip_and_message_circle() {
        val row = NotificationsViewModel.row(dto("n", type = "reply"), now = fixedNow, zone = utc) {}
        val leading = row.leading
        assertTrue(leading is RowLeading.TypeIcon)
        assertEquals(PantopusIcon.MessageCircle, (leading as RowLeading.TypeIcon).icon)
        val chip = row.chips?.firstOrNull()
        assertNotNull(chip)
        assertEquals("Reply", chip!!.text)
        assertEquals(PantopusIcon.MessageCircle, chip.icon)
        val tint = chip.tint
        assertTrue(tint is RowChip.Tint.Status)
        assertEquals(StatusChipVariant.Personal, (tint as RowChip.Tint.Status).variant)
    }

    @Test
    fun row_mapping_for_mention_uses_business_chip_and_at_sign() {
        val row = NotificationsViewModel.row(dto("n", type = "mention"), now = fixedNow, zone = utc) {}
        assertEquals(PantopusIcon.AtSign, (row.leading as RowLeading.TypeIcon).icon)
        val tint = row.chips?.first()?.tint as RowChip.Tint.Status
        assertEquals(StatusChipVariant.Business, tint.variant)
    }

    @Test
    fun row_mapping_for_claim_uses_success_chip_and_badge_check() {
        val row = NotificationsViewModel.row(dto("n", type = "claim"), now = fixedNow, zone = utc) {}
        assertEquals(PantopusIcon.BadgeCheck, (row.leading as RowLeading.TypeIcon).icon)
        val tint = row.chips?.first()?.tint as RowChip.Tint.Status
        assertEquals(StatusChipVariant.Success, tint.variant)
    }

    @Test
    fun row_mapping_for_gig_uses_warning_chip_and_briefcase() {
        val row = NotificationsViewModel.row(dto("n", type = "gig"), now = fixedNow, zone = utc) {}
        assertEquals(PantopusIcon.Briefcase, (row.leading as RowLeading.TypeIcon).icon)
        val tint = row.chips?.first()?.tint as RowChip.Tint.Status
        assertEquals(StatusChipVariant.Warning, tint.variant)
    }

    @Test
    fun row_mapping_for_listing_uses_home_chip_and_tag() {
        val row = NotificationsViewModel.row(dto("n", type = "listing"), now = fixedNow, zone = utc) {}
        assertEquals(PantopusIcon.Tag, (row.leading as RowLeading.TypeIcon).icon)
        val tint = row.chips?.first()?.tint as RowChip.Tint.Status
        assertEquals(StatusChipVariant.Home, tint.variant)
    }

    @Test
    fun row_mapping_for_safety_uses_error_chip_and_shield_alert() {
        val row = NotificationsViewModel.row(dto("n", type = "safety"), now = fixedNow, zone = utc) {}
        assertEquals(PantopusIcon.ShieldAlert, (row.leading as RowLeading.TypeIcon).icon)
        val tint = row.chips?.first()?.tint as RowChip.Tint.Status
        assertEquals(StatusChipVariant.ErrorVariant, tint.variant)
    }

    @Test
    fun row_mapping_for_system_uses_neutral_chip_and_info() {
        val row = NotificationsViewModel.row(dto("n", type = "system"), now = fixedNow, zone = utc) {}
        assertEquals(PantopusIcon.Info, (row.leading as RowLeading.TypeIcon).icon)
        val tint = row.chips?.first()?.tint as RowChip.Tint.Status
        assertEquals(StatusChipVariant.Neutral, tint.variant)
    }

    @Test
    fun unknown_type_falls_back_to_system() {
        val row = NotificationsViewModel.row(dto("n", type = "definitely_not_a_known_type"), now = fixedNow, zone = utc) {}
        assertEquals(PantopusIcon.Info, (row.leading as RowLeading.TypeIcon).icon)
    }

    @Test
    fun unread_row_gets_unread_highlight() {
        val row = NotificationsViewModel.row(dto("n", isRead = false), now = fixedNow, zone = utc) {}
        assertEquals(RowHighlight.Unread, row.highlight)
    }

    @Test
    fun read_row_has_no_highlight() {
        val row = NotificationsViewModel.row(dto("n", isRead = true), now = fixedNow, zone = utc) {}
        assertNull(row.highlight)
    }

    // MARK: - Date bucketing

    @Test
    fun make_sections_buckets_today_and_earlier() {
        val dtos =
            listOf(
                dto("today", createdAt = "2026-05-15T08:00:00Z"),
                dto("yesterday", createdAt = "2026-05-14T20:00:00Z"),
                dto("tuesday", createdAt = "2026-05-12T20:00:00Z"),
            )
        val sections = NotificationsViewModel.makeSections(dtos, now = fixedNow, zone = utc) {}
        assertEquals(2, sections.size)
        assertEquals("Today", sections[0].header)
        assertEquals(listOf("today"), sections[0].rows.map { it.id })
        assertEquals("Earlier", sections[1].header)
        assertEquals(listOf("yesterday", "tuesday"), sections[1].rows.map { it.id })
    }

    @Test
    fun make_sections_omits_today_when_no_today_items() {
        val dtos =
            listOf(
                dto("y", createdAt = "2026-05-14T08:00:00Z"),
                dto("w", createdAt = "2026-05-10T08:00:00Z"),
            )
        val sections = NotificationsViewModel.makeSections(dtos, now = fixedNow, zone = utc) {}
        assertEquals(1, sections.size)
        assertEquals("Earlier", sections[0].header)
    }

    @Test
    fun make_sections_crosses_midnight_by_calendar_not_by_elapsed_time() {
        // 25h before fixedNow is 2026-05-14T11:00Z — still "Earlier" because
        // it's a different calendar day.
        val sections =
            NotificationsViewModel.makeSections(
                listOf(dto("n", createdAt = "2026-05-14T11:00:00Z")),
                now = fixedNow,
                zone = utc,
            ) {}
        assertEquals("Earlier", sections.first().header)
    }

    @Test
    fun make_sections_respects_local_timezone() {
        // 2026-05-15T01:00:00Z is 17:00 May 14 in PST, but 01:00 May 15 in UTC.
        val one = dto("n", createdAt = "2026-05-15T01:00:00Z")
        val pst = ZoneId.of("America/Los_Angeles")
        val pstSections = NotificationsViewModel.makeSections(listOf(one), now = fixedNow, zone = pst) {}
        assertEquals("Earlier", pstSections.first().header)
        val utcSections = NotificationsViewModel.makeSections(listOf(one), now = fixedNow, zone = utc) {}
        assertEquals("Today", utcSections.first().header)
    }

    // MARK: - Relative time

    @Test
    fun relative_time_formatting() {
        assertEquals(
            "5m",
            NotificationsViewModel.formatRelativeTime(
                "2026-05-15T11:55:00Z",
                now = fixedNow,
                zone = utc,
            ),
        )
        assertEquals(
            "3h",
            NotificationsViewModel.formatRelativeTime(
                "2026-05-15T09:00:00Z",
                now = fixedNow,
                zone = utc,
            ),
        )
        assertEquals(
            "Yesterday",
            NotificationsViewModel.formatRelativeTime(
                "2026-05-14T08:00:00Z",
                now = fixedNow,
                zone = utc,
            ),
        )
        assertEquals(
            "Tue",
            NotificationsViewModel.formatRelativeTime(
                "2026-05-12T08:00:00Z",
                now = fixedNow,
                zone = utc,
            ),
        )
        assertEquals(
            "Apr 20",
            NotificationsViewModel.formatRelativeTime(
                "2026-04-20T08:00:00Z",
                now = fixedNow,
                zone = utc,
            ),
        )
    }

    // MARK: - Refresh

    @Test
    fun refresh_hits_list_again() =
        runTest {
            coEvery { repo.list(any(), any(), any()) } returnsMany
                listOf(
                    NetworkResult.Success(twoUnread),
                    NetworkResult.Success(emptyResponse),
                )
            val vm = NotificationsViewModel(repo)
            vm.load()
            vm.refresh()
            assertTrue(vm.state.value is ListOfRowsUiState.Empty)
        }
}
