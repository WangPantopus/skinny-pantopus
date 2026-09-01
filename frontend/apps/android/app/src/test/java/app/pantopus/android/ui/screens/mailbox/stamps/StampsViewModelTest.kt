@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.mailbox.stamps

import app.pantopus.android.data.api.models.mailbox.p3.ApplyMailboxThemeResponse
import app.pantopus.android.data.api.models.mailbox.p3.EarnedStampDto
import app.pantopus.android.data.api.models.mailbox.p3.LockedStampDto
import app.pantopus.android.data.api.models.mailbox.p3.MailboxStampsResponse
import app.pantopus.android.data.api.models.mailbox.p3.SeasonalThemeDto
import app.pantopus.android.data.api.models.mailbox.p3.SeasonalThemesResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.mailbox.MailboxKeepsakeRepository
import app.pantopus.android.ui.screens.shared.mail_item_detail.MailDetailTrust
import io.mockk.coEvery
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
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * A17.11 — state-projection coverage for the Stamps view-model. Mirrors
 * `StampsViewModelTests` (iOS): asserts the populated + empty wallet
 * frames project off the sample fixtures, the book balance maths line up,
 * the buy-CTA stubs mutate local state, and the two live surfaces (stamp
 * collection + seasonal themes) project their backend payloads and apply
 * an unlocked theme.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class StampsViewModelTest {
    private val repository: MailboxKeepsakeRepository = mockk()

    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        coEvery { repository.stamps() } returns
            NetworkResult.Failure(NetworkError.Server(500, "stub"))
        coEvery { repository.themes() } returns
            NetworkResult.Failure(NetworkError.Server(500, "stub"))
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun makeVm(seed: StampsSeed = StampsSeed.Populated) = StampsViewModel(repository, seed)

    @Test
    fun initialStateIsLoading() {
        val vm = makeVm()
        assertTrue("Expected Loading before load()", vm.state.value is StampsUiState.Loading)
    }

    @Test
    fun loadProjectsPopulatedFrame() =
        runTest {
            val vm = makeVm()
            vm.load()
            val state = vm.state.value
            assertTrue("Expected Loaded, got $state", state is StampsUiState.Loaded)
            val content = (state as StampsUiState.Loaded).content
            assertEquals(12, content.book.total)
            assertEquals(4, content.book.used)
            assertEquals(8, content.book.remaining)
            assertEquals(4, content.wallet.size)
            assertEquals(4, content.usage.size)
            assertEquals(3, content.insights.size)
            assertEquals(MailDetailTrust.Verified, content.trust)
            assertEquals("Stamps", content.categoryLabel)
        }

    @Test
    fun bookRemainingFraction() {
        val book = StampsSampleData.populated.book
        assertEquals(8f / 12f, book.remainingFraction, 0.0001f)
    }

    @Test
    fun loadProjectsEmptyFrame() =
        runTest {
            val vm = makeVm(StampsSeed.Empty)
            vm.load()
            val state = vm.state.value
            assertTrue("Expected Empty, got $state", state is StampsUiState.Empty)
            val content = (state as StampsUiState.Empty).content
            assertEquals("No stamps yet", content.headline)
            assertEquals("$4.80", content.starterBook.priceLabel)
        }

    @Test
    fun buyMoreRefillsTheBook() =
        runTest {
            val vm = makeVm()
            vm.load()
            vm.buyMore()
            val content = (vm.state.value as StampsUiState.Loaded).content
            assertEquals("Buying more refills the featured book", 0, content.book.used)
            assertEquals(content.book.total, content.book.remaining)
        }

    @Test
    fun buyMoreNoOpWhenEmpty() =
        runTest {
            val vm = makeVm(StampsSeed.Empty)
            vm.load()
            vm.buyMore() // should not crash or change the empty frame
            assertTrue(vm.state.value is StampsUiState.Empty)
        }

    @Test
    fun purchaseStarterBookFlipsEmptyToPopulated() =
        runTest {
            val vm = makeVm(StampsSeed.Empty)
            vm.load()
            assertTrue(vm.state.value is StampsUiState.Empty)
            vm.purchaseStarterBook()
            val state = vm.state.value
            assertTrue("Expected Loaded after acquiring the starter book", state is StampsUiState.Loaded)
            assertEquals(12, (state as StampsUiState.Loaded).content.book.total)
        }

    @Test
    fun tapBackInvokesCallback() {
        var backs = 0
        val vm = makeVm()
        vm.configureNavigation(onBack = { backs++ })
        vm.tapBack()
        assertEquals(1, backs)
    }

    @Test
    fun toggleModeFlipsBetweenStampsAndThemes() {
        val vm = makeVm()
        assertEquals(StampsViewMode.Stamps, vm.mode.value)
        vm.toggleMode()
        assertEquals(StampsViewMode.Themes, vm.mode.value)
        vm.toggleMode()
        assertEquals(StampsViewMode.Stamps, vm.mode.value)
    }

    // ─── Collection (GET /p3/stamps) ───────────────────────────────

    @Test
    fun loadProjectsStampCollection() =
        runTest {
            coEvery { repository.stamps() } returns
                NetworkResult.Success(
                    MailboxStampsResponse(
                        earned =
                            listOf(
                                EarnedStampDto(
                                    id = "s1",
                                    stampType = "first_mail",
                                    name = "First Mail",
                                    description = "Received your first mail item",
                                    rarity = "common",
                                    earnedAt = "2026-05-04T12:00:00Z",
                                ),
                            ),
                        locked =
                            listOf(
                                LockedStampDto(
                                    stampType = "collector",
                                    name = "Collector",
                                    description = "Earned 10 stamps",
                                    rarity = "legendary",
                                ),
                            ),
                        totalEarned = 1,
                        totalAvailable = 13,
                    ),
                )
            val vm = makeVm()
            vm.load()

            val state = vm.collection.value
            assertTrue("Expected Loaded collection, got $state", state is StampCollectionUiState.Loaded)
            val content = (state as StampCollectionUiState.Loaded).content
            assertEquals(1, content.totalEarned)
            assertEquals(13, content.totalAvailable)
            assertEquals("1 of 13 collected", content.progressLabel)
            assertEquals("First Mail", content.earned.first().name)
            assertEquals(StampRarity.Common, content.earned.first().rarity)
            assertEquals("collector", content.locked.first().id)
            assertEquals(StampRarity.Legendary, content.locked.first().rarity)
            assertTrue(content.locked.first().isLocked)
        }

    @Test
    fun loadEmptyCollectionProjectsEmptyState() =
        runTest {
            coEvery { repository.stamps() } returns NetworkResult.Success(MailboxStampsResponse())
            val vm = makeVm()
            vm.load()
            assertTrue(vm.collection.value is StampCollectionUiState.Empty)
        }

    @Test
    fun loadCollectionFailureProjectsError() =
        runTest {
            val vm = makeVm()
            vm.load()
            assertTrue(vm.collection.value is StampCollectionUiState.Error)
        }

    // ─── Themes (GET /p3/themes · POST /p3/themes/apply) ───────────

    @Test
    fun loadProjectsThemes() =
        runTest {
            coEvery { repository.themes() } returns NetworkResult.Success(themesResponse())
            val vm = makeVm()
            vm.load()

            val state = vm.themes.value
            assertTrue("Expected Loaded themes, got $state", state is StampThemesUiState.Loaded)
            val content = (state as StampThemesUiState.Loaded).content
            assertEquals(3, content.themes.size)
            assertEquals("t1", content.activeThemeId)
            assertEquals("First Frost", content.activeTheme?.name)
            assertEquals(MailboxThemeSeason.Winter, content.themes.first().season)
            assertTrue(content.themes.first().autoApplies)
            assertTrue(!content.themes[1].isUnlocked)
        }

    @Test
    fun applyThemeSwapsActiveTheme() =
        runTest {
            coEvery { repository.themes() } returns NetworkResult.Success(themesResponse())
            coEvery { repository.applyTheme("t3") } returns
                NetworkResult.Success(ApplyMailboxThemeResponse(message = "Theme applied"))
            val vm = makeVm()
            vm.load()
            vm.applyTheme("t3")

            val content = (vm.themes.value as StampThemesUiState.Loaded).content
            assertEquals("t3", content.activeThemeId)
            assertEquals("Harvest applied", vm.toast.value)
        }

    @Test
    fun applyThemeIgnoresLockedTheme() =
        runTest {
            coEvery { repository.themes() } returns NetworkResult.Success(themesResponse())
            val vm = makeVm()
            vm.load()
            vm.applyTheme("t2")

            val content = (vm.themes.value as StampThemesUiState.Loaded).content
            assertEquals("A locked theme must not be applied", "t1", content.activeThemeId)
        }

    @Test
    fun applyThemeFailureRollsBack() =
        runTest {
            coEvery { repository.themes() } returns NetworkResult.Success(themesResponse())
            coEvery { repository.applyTheme("t3") } returns
                NetworkResult.Failure(NetworkError.Server(500, "Failed to apply theme"))
            val vm = makeVm()
            vm.load()
            vm.applyTheme("t3")

            val content = (vm.themes.value as StampThemesUiState.Loaded).content
            assertEquals("A failed apply rolls the active theme back", "t1", content.activeThemeId)
            assertNotNull(vm.toast.value)
        }

    private fun themesResponse() =
        SeasonalThemesResponse(
            themes =
                listOf(
                    SeasonalThemeDto(
                        id = "t1",
                        name = "First Frost",
                        season = "winter",
                        accentColor = "#60A5FA",
                        autoApply = true,
                        activeFrom = "2026-12-01T00:00:00Z",
                        activeUntil = "2027-02-28T00:00:00Z",
                        unlockCondition = "seasonal_auto",
                        unlocked = true,
                    ),
                    SeasonalThemeDto(
                        id = "t2",
                        name = "Gold Leaf",
                        season = "custom",
                        accentColor = "#9CA3AF",
                        autoApply = false,
                        unlockCondition = "premium",
                        unlocked = false,
                    ),
                    SeasonalThemeDto(
                        id = "t3",
                        name = "Harvest",
                        season = "autumn",
                        accentColor = "#EA580C",
                        autoApply = false,
                        unlockCondition = "default",
                        unlocked = true,
                    ),
                ),
            active = "t1",
        )
}
