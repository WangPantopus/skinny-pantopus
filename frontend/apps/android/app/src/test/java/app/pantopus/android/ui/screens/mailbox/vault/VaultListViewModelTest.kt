@file:Suppress("PackageNaming", "MagicNumber", "LongMethod")

package app.pantopus.android.ui.screens.mailbox.vault

import app.pantopus.android.data.api.models.mailbox.vault.VaultFolderDto
import app.pantopus.android.data.api.models.mailbox.vault.VaultFolderItemsResponse
import app.pantopus.android.data.api.models.mailbox.vault.VaultFoldersResponse
import app.pantopus.android.data.api.models.mailbox.vault.VaultMailItemDto
import app.pantopus.android.data.api.models.mailbox.vault.VaultSearchResponse
import app.pantopus.android.data.api.models.mailbox.vault.VaultSearchResultDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.mailbox.MailboxVaultRepository
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsUiState
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * T6.5e (P19.5) — Tests for the Mailbox Vault list VM. Mirrors iOS
 * `VaultListViewModelTests`. Covers the four-state lifecycle, cross-folder
 * flattening + sort, and client-side query filtering.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class VaultListViewModelTest {
    private val repo: MailboxVaultRepository = mockk()

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun makeVm(): VaultListViewModel = VaultListViewModel(repo = repo)

    private fun folder(
        id: String,
        label: String,
        icon: String? = null,
    ): VaultFolderDto =
        VaultFolderDto(
            id = id,
            userId = "u1",
            drawer = "personal",
            label = label,
            icon = icon,
            color = null,
            system = true,
            itemCount = null,
            sortOrder = 0,
            createdAt = null,
        )

    private fun item(
        id: String,
        folderId: String,
        mailType: String? = "notice",
        subject: String? = null,
        sender: String? = "Sender",
        createdAt: String? = "2026-05-15T12:00:00Z",
    ): VaultMailItemDto =
        VaultMailItemDto(
            id = id,
            mailType = mailType,
            type = null,
            subject = subject,
            displayTitle = null,
            previewText = null,
            senderAddress = null,
            senderBusinessName = sender,
            createdAt = createdAt,
            lifecycle = "filed",
            viewedAt = null,
            attachments = null,
            vaultFolderId = folderId,
        )

    // ─── Four states ───────────────────────────────────────

    @Test
    fun `load empty folders renders empty state`() =
        runTest {
            coEvery { repo.folders(any()) } returns NetworkResult.Success(VaultFoldersResponse(folders = emptyList()))
            val vm = makeVm()
            vm.load()
            val state = vm.state.value
            assertTrue("expected empty, was $state", state is ListOfRowsUiState.Empty)
            assertEquals("Your vault is empty", (state as ListOfRowsUiState.Empty).headline)
        }

    @Test
    fun `load folders error renders error state`() =
        runTest {
            coEvery { repo.folders(any()) } returns
                NetworkResult.Failure(NetworkError.Server(500, "boom"))
            val vm = makeVm()
            vm.load()
            val state = vm.state.value
            assertTrue("expected error, was $state", state is ListOfRowsUiState.Error)
        }

    @Test
    fun `loaded state contains rows across folders sorted by createdAt desc`() =
        runTest {
            val f1 = folder("f1", "Civic", "📋")
            val f2 = folder("f2", "Receipts", "🧾")
            coEvery { repo.folders(any()) } returns
                NetworkResult.Success(VaultFoldersResponse(folders = listOf(f1, f2)))
            coEvery { repo.folderItems("f1", any(), any()) } returns
                NetworkResult.Success(
                    VaultFolderItemsResponse(
                        items =
                            listOf(
                                item("m1", "f1", createdAt = "2026-05-14T12:00:00Z"),
                                item("m2", "f1", createdAt = "2026-05-13T12:00:00Z"),
                            ),
                        total = 2,
                    ),
                )
            coEvery { repo.folderItems("f2", any(), any()) } returns
                NetworkResult.Success(
                    VaultFolderItemsResponse(
                        items =
                            listOf(
                                item("m3", "f2", mailType = "receipt", createdAt = "2026-05-15T12:00:00Z"),
                            ),
                        total = 1,
                    ),
                )
            val vm = makeVm()
            vm.load()
            val state = vm.state.value
            assertTrue("expected loaded, was $state", state is ListOfRowsUiState.Loaded)
            val rows = (state as ListOfRowsUiState.Loaded).sections.first().rows
            assertEquals(listOf("m3", "m1", "m2"), rows.map { it.id })
        }

    // ─── Projection helpers ────────────────────────────────

    @Test
    fun `flatten sorts by createdAt desc`() {
        val f1 = folder("f1", "Civic")
        val older = item("m1", "f1", createdAt = "2026-05-13T00:00:00Z")
        val newer = item("m2", "f1", createdAt = "2026-05-14T00:00:00Z")
        val rows = VaultListViewModel.flatten(folders = listOf(f1), itemsByFolder = mapOf("f1" to listOf(older, newer)))
        assertEquals(listOf("m2", "m1"), rows.map { it.id })
    }

    @Test
    fun `filter matches title subtitle or folder label`() {
        val civic = folder("f1", "Civic")
        val receipts = folder("f2", "Receipts")
        val rows =
            listOf(
                VaultListRow(
                    id = "m1",
                    item = item(id = "m1", folderId = "f1", subject = "Block-party permit approved", sender = "PBOT"),
                    folder = civic,
                ),
                VaultListRow(
                    id = "m2",
                    item = item(id = "m2", folderId = "f2", subject = "Costco statement", sender = "Costco"),
                    folder = receipts,
                ),
            )
        assertEquals(listOf("m1"), VaultListViewModel.filter(rows, "permit").map { it.id })
        assertEquals(listOf("m2"), VaultListViewModel.filter(rows, "costco").map { it.id })
        assertEquals(listOf("m1"), VaultListViewModel.filter(rows, "Civic").map { it.id })
        assertEquals(listOf("m2"), VaultListViewModel.filter(rows, "Receipts").map { it.id })
        assertEquals(2, VaultListViewModel.filter(rows, "").size)
    }

    @Test
    fun `mailType mapping picks accent for known types`() {
        assertEquals(MailboxVaultMailType.Notice, MailboxVaultMailType.fromRaw("notice"))
        assertEquals(MailboxVaultMailType.Permit, MailboxVaultMailType.fromRaw("permit"))
        assertEquals(MailboxVaultMailType.Receipt, MailboxVaultMailType.fromRaw("receipt"))
        assertEquals(MailboxVaultMailType.Scan, MailboxVaultMailType.fromRaw("scan"))
        assertEquals(MailboxVaultMailType.Parcel, MailboxVaultMailType.fromRaw("package"))
        assertEquals(MailboxVaultMailType.Letter, MailboxVaultMailType.fromRaw(null))
        assertEquals(MailboxVaultMailType.Letter, MailboxVaultMailType.fromRaw("unknown"))
    }

    @Test
    fun `query change filters loaded rows`() =
        runTest {
            val f1 = folder("f1", "Receipts", "🧾")
            coEvery { repo.folders(any()) } returns
                NetworkResult.Success(VaultFoldersResponse(folders = listOf(f1)))
            coEvery { repo.folderItems("f1", any(), any()) } returns
                NetworkResult.Success(
                    VaultFolderItemsResponse(
                        items =
                            listOf(
                                item("m1", "f1", mailType = "receipt", subject = "Costco statement", sender = "Costco"),
                                item(
                                    "m2",
                                    "f1",
                                    mailType = "receipt",
                                    subject = "TJ statement",
                                    sender = "TJ",
                                    createdAt = "2026-05-14T12:00:00Z",
                                ),
                            ),
                        total = 2,
                    ),
                )
            // The debounced server search fires once virtual time advances past
            // the 300 ms debounce; stub it so the trailing call is answered.
            coEvery { repo.search(any(), any(), any(), any()) } returns
                NetworkResult.Success(VaultSearchResponse(results = emptyList(), total = 0, query = "Costco"))
            val vm = makeVm()
            vm.load()
            assertTrue(vm.state.value is ListOfRowsUiState.Loaded)
            vm.onQueryChange("Costco")
            val state = vm.state.value
            assertTrue("expected loaded after filter, was $state", state is ListOfRowsUiState.Loaded)
            val rows = (state as ListOfRowsUiState.Loaded).sections.first().rows
            assertEquals(listOf("m1"), rows.map { it.id })
        }

    // ─── Server-side search (RN `vault.tsx:65` performSearch) ──

    @Test
    fun `query past the threshold searches every drawer server-side`() =
        runTest {
            coEvery { repo.folders(any()) } returns
                NetworkResult.Success(VaultFoldersResponse(folders = emptyList()))
            coEvery { repo.search("Costco", null, any(), any()) } returns
                NetworkResult.Success(
                    VaultSearchResponse(
                        results =
                            listOf(
                                VaultSearchResultDto(
                                    id = "s1",
                                    drawer = "business",
                                    mailType = "receipt",
                                    type = null,
                                    subject = "Costco statement",
                                    previewText = "Your July statement",
                                    senderDisplay = "Costco Wholesale",
                                    senderBusinessName = null,
                                    createdAt = "2026-05-15T12:00:00Z",
                                    vaultFolderId = null,
                                    matchField = "sender",
                                    matchExcerpt = "Costco Wholesale",
                                ),
                            ),
                        total = 1,
                        query = "Costco",
                    ),
                )
            val vm = makeVm()
            vm.load()
            vm.onQueryChange("Costco")
            advanceUntilIdle()
            val state = vm.state.value
            assertTrue("expected loaded search results, was $state", state is ListOfRowsUiState.Loaded)
            val section = (state as ListOfRowsUiState.Loaded).sections.first()
            assertEquals("1 result · All drawers", section.header)
            assertEquals(listOf("s1"), section.rows.map { it.id })
            coVerify { repo.search("Costco", null, any(), any()) }
        }

    @Test
    fun `empty server search renders the no-matches empty state`() =
        runTest {
            coEvery { repo.folders(any()) } returns
                NetworkResult.Success(VaultFoldersResponse(folders = emptyList()))
            coEvery { repo.search(any(), any(), any(), any()) } returns
                NetworkResult.Success(VaultSearchResponse(results = emptyList(), total = 0, query = "zzz"))
            val vm = makeVm()
            vm.load()
            vm.onQueryChange("zzz")
            advanceUntilIdle()
            val state = vm.state.value
            assertTrue("expected empty, was $state", state is ListOfRowsUiState.Empty)
            assertEquals("No matches found", (state as ListOfRowsUiState.Empty).headline)
        }

    @Test
    fun `search failure renders the error state`() =
        runTest {
            coEvery { repo.folders(any()) } returns
                NetworkResult.Success(VaultFoldersResponse(folders = emptyList()))
            coEvery { repo.search(any(), any(), any(), any()) } returns
                NetworkResult.Failure(NetworkError.Server(500, "boom"))
            val vm = makeVm()
            vm.load()
            vm.onQueryChange("Costco")
            advanceUntilIdle()
            assertTrue(vm.state.value is ListOfRowsUiState.Error)
        }

    // ─── Drawer tabs ───────────────────────────────────────

    @Test
    fun `selecting a drawer tab refetches that drawer`() =
        runTest {
            coEvery { repo.folders(any()) } returns
                NetworkResult.Success(VaultFoldersResponse(folders = emptyList()))
            val vm = makeVm()
            vm.load()
            assertEquals("personal", vm.selectedDrawer.value)
            vm.onSelectDrawer("business")
            advanceUntilIdle()
            assertEquals("business", vm.selectedDrawer.value)
            coVerify { repo.folders("business") }
        }
}
