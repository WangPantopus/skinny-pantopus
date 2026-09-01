@file:Suppress("MagicNumber", "PackageNaming", "LongMethod", "LongParameterList")

package app.pantopus.android.ui.screens.homes.documents

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.homes.BillDto
import app.pantopus.android.data.api.models.homes.CreateDocumentRequest
import app.pantopus.android.data.api.models.homes.CreateDocumentResponse
import app.pantopus.android.data.api.models.homes.GetHomeBillsResponse
import app.pantopus.android.data.api.models.homes.GetHomeMaintenanceResponse
import app.pantopus.android.data.api.models.homes.HomeDocumentDto
import app.pantopus.android.data.api.models.homes.MaintenanceTaskDto
import app.pantopus.android.data.api.models.homes.PetDto
import app.pantopus.android.data.api.models.homes.PetsResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomePetsRepository
import app.pantopus.android.data.homes.HomesRepository
import io.mockk.coEvery
import io.mockk.mockk
import io.mockk.slot
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
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
import java.math.BigDecimal

/**
 * P2.10 — Unit tests for the Upload Document form's view-model. Covers:
 *  - Initial state (clean + invalid)
 *  - File pick seeds the title from the filename
 *  - Category mapping onto the wire-format `doc_type`
 *  - Tag dedupe / cap
 *  - Linked-to fetch joins bills + maintenance + pets
 *  - Submit posts the expected `CreateDocumentRequest`
 */
@OptIn(ExperimentalCoroutinesApi::class)
class UploadDocumentFormViewModelTest {
    private val homesRepo: HomesRepository = mockk(relaxed = true)
    private val petsRepo: HomePetsRepository = mockk(relaxed = true)

    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun makeVm(): UploadDocumentFormViewModel =
        UploadDocumentFormViewModel(
            homesRepo = homesRepo,
            petsRepo = petsRepo,
            savedStateHandle = SavedStateHandle(mapOf(UPLOAD_DOCUMENT_HOME_ID_KEY to "home-1")),
        )

    @Test fun `initial state is clean and invalid`() {
        val vm = makeVm()
        val state = vm.state.value
        assertFalse(state.isValid)
        assertFalse(state.isDirty)
        assertNull(state.pickedFile)
        assertEquals(emptyList<String>(), state.tags)
        assertEquals(UploadDocumentCategory.Other, state.category)
        assertEquals(UploadDocumentVisibility.AllMembers, state.visibility)
    }

    @Test fun `accepting a file seeds the title from the filename`() {
        val vm = makeVm()
        vm.acceptPicked(filename = "Lease-Renewal.pdf", sizeBytes = 12_345L, mimeType = "application/pdf")
        val state = vm.state.value
        assertEquals("Lease-Renewal.pdf", state.pickedFile?.filename)
        assertEquals("Lease-Renewal", state.title.value)
        assertEquals(UploadDocumentCategory.Mortgage, state.category)
    }

    @Test fun `accepting a file leaves a touched title alone`() {
        val vm = makeVm()
        vm.updateTitle("Custom title")
        vm.acceptPicked(filename = "State-Farm-Policy.pdf", sizeBytes = null, mimeType = "application/pdf")
        assertEquals("Custom title", vm.state.value.title.value)
    }

    @Test fun `category docType mapping hits canonical backend enum values`() {
        assertEquals("insurance", UploadDocumentCategory.Insurance.docType)
        assertEquals("lease", UploadDocumentCategory.Mortgage.docType)
        assertEquals("warranty", UploadDocumentCategory.Warranty.docType)
        assertEquals("receipt", UploadDocumentCategory.Receipt.docType)
        assertEquals("permit", UploadDocumentCategory.Contract.docType)
        assertEquals("other", UploadDocumentCategory.Identity.docType)
        assertEquals("manual", UploadDocumentCategory.Medical.docType)
        assertEquals("receipt", UploadDocumentCategory.Tax.docType)
        assertEquals("other", UploadDocumentCategory.Other.docType)
    }

    @Test fun `category palette mapping matches design swatches`() {
        assertEquals(DocumentCategory.Lease, UploadDocumentCategory.Mortgage.palette)
        assertEquals(DocumentCategory.Permit, UploadDocumentCategory.Contract.palette)
        assertEquals(DocumentCategory.Warranty, UploadDocumentCategory.Medical.palette)
        assertEquals(DocumentCategory.Tax, UploadDocumentCategory.Tax.palette)
        assertEquals(DocumentCategory.Identity, UploadDocumentCategory.Identity.palette)
    }

    @Test fun `commit tag dedupes case-insensitively and rejects overlong`() {
        val vm = makeVm()
        vm.updateTagDraft("renewal")
        vm.commitTagDraft()
        assertEquals(listOf("renewal"), vm.state.value.tags)

        vm.updateTagDraft("Renewal")
        vm.commitTagDraft()
        assertEquals(listOf("renewal"), vm.state.value.tags)

        vm.updateTagDraft("x".repeat(25))
        vm.commitTagDraft()
        assertEquals(listOf("renewal"), vm.state.value.tags)
    }

    @Test fun `linked entity round trips via select and clear`() {
        val vm = makeVm()
        val option =
            UploadDocumentLinkOption(
                id = "bill-1",
                kind = UploadDocumentLinkKind.Bill,
                title = "Con Edison",
                subtitle = "Due Oct 28",
            )
        vm.selectLink(option)
        assertEquals(option, vm.state.value.linkedEntity)
        vm.clearLinkedEntity()
        assertNull(vm.state.value.linkedEntity)
    }

    @Test fun `loadLinkOptionsIfNeeded joins bills maintenance and pets`() =
        runTest {
            coEvery { homesRepo.getHomeBills(any(), any()) } returns
                NetworkResult.Success(
                    GetHomeBillsResponse(
                        bills =
                            listOf(
                                BillDto(
                                    id = "bill-1",
                                    homeId = "home-1",
                                    billType = "utility",
                                    providerName = "Con Edison",
                                    dueDate = "2026-10-28",
                                    amountCents = 12_500,
                                    currency = "USD",
                                    amount = BigDecimal("125.00"),
                                ),
                            ),
                    ),
                )
            coEvery { homesRepo.getHomeMaintenance(any(), any()) } returns
                NetworkResult.Success(
                    GetHomeMaintenanceResponse(
                        tasks =
                            listOf(
                                MaintenanceTaskDto(
                                    id = "task-1",
                                    homeId = "home-1",
                                    task = "Furnace tune-up",
                                    vendor = "Riverside HVAC",
                                ),
                            ),
                    ),
                )
            coEvery { petsRepo.list("home-1") } returns
                NetworkResult.Success(
                    PetsResponse(
                        pets =
                            listOf(
                                PetDto(
                                    id = "pet-1",
                                    homeId = "home-1",
                                    name = "Mochi",
                                    species = "dog",
                                ),
                            ),
                    ),
                )

            val vm = makeVm()
            vm.loadLinkOptionsIfNeeded()

            val loaded = vm.state.value.linkOptionsState as UploadDocumentLinkOptionsState.Loaded
            assertEquals(3, loaded.options.size)
            assertTrue(loaded.options.any { it.kind == UploadDocumentLinkKind.Bill && it.title == "Con Edison" })
            assertTrue(loaded.options.any { it.kind == UploadDocumentLinkKind.Maintenance && it.title == "Furnace tune-up" })
            assertTrue(loaded.options.any { it.kind == UploadDocumentLinkKind.Pet && it.title == "Mochi" })
        }

    @Test fun `submit posts the expected request shape`() =
        runTest {
            val captured = slot<CreateDocumentRequest>()
            coEvery { homesRepo.createHomeDocument("home-1", capture(captured)) } returns
                NetworkResult.Success(
                    CreateDocumentResponse(
                        document =
                            HomeDocumentDto(
                                id = "doc-1",
                                homeId = "home-1",
                                fileId = null,
                                docType = "lease",
                                title = "Lease-2024",
                                storageBucket = null,
                                storagePath = null,
                                mimeType = "application/pdf",
                                sizeBytes = 1_024L,
                                visibility = "members",
                                details = null,
                                createdBy = null,
                                createdAt = null,
                                updatedAt = null,
                            ),
                    ),
                )

            val vm = makeVm()
            vm.acceptPicked(filename = "Lease-2024.pdf", sizeBytes = 1_024L, mimeType = "application/pdf")
            // acceptPicked auto-selected Mortgage from the filename.
            vm.updateTagDraft("signed")
            vm.commitTagDraft()
            vm.selectLink(
                UploadDocumentLinkOption(
                    id = "bill-1",
                    kind = UploadDocumentLinkKind.Bill,
                    title = "Con Edison",
                ),
            )
            vm.selectVisibility(UploadDocumentVisibility.Owners)
            vm.submit()

            assertTrue(captured.isCaptured)
            val request = captured.captured
            assertEquals("lease", request.docType)
            assertEquals("Lease-2024", request.title)
            assertEquals("managers", request.visibility)
            assertEquals("signed", request.details?.get("tags"))
            assertEquals("bill", request.details?.get("linked_entity_kind"))
            assertEquals("bill-1", request.details?.get("linked_entity_id"))
            assertEquals("Con Edison", request.details?.get("linked_entity_title"))
            assertTrue(vm.state.value.shouldDismiss)
        }

    @Test fun `submit with no file surfaces a validation toast`() {
        val vm = makeVm()
        vm.submit()
        val state = vm.state.value
        assertNotNull(state.toast)
        assertTrue(state.toast?.isError == true)
        assertFalse(state.shouldDismiss)
    }

    @Test fun `submit failure surfaces error toast`() =
        runTest {
            coEvery { homesRepo.createHomeDocument(any(), any()) } returns
                NetworkResult.Failure(NetworkError.Server(500, "Server is down"))

            val vm = makeVm()
            vm.acceptPicked(filename = "Receipt.pdf", sizeBytes = 200L, mimeType = "application/pdf")
            vm.submit()

            val state = vm.state.value
            assertNotNull(state.toast)
            assertTrue(state.toast?.isError == true)
            assertFalse(state.shouldDismiss)
        }
}
