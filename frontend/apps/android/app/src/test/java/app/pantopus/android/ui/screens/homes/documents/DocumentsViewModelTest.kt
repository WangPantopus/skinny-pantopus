@file:Suppress("MagicNumber", "PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.homes.documents

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.homes.GetHomeDocumentsResponse
import app.pantopus.android.data.api.models.homes.HomeDocumentDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsUiState
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
import java.time.Instant

/**
 * Covers the Documents VM (T6.4b / P17):
 *  - four-state transitions
 *  - category bucket mapping from `HomeDocument.doc_type`
 *  - file-type inference from mime_type / filename
 *  - chip filter narrows visible rows (recent / expiring / shared)
 *  - banner summary projection (count + storage + expiring)
 */
@OptIn(ExperimentalCoroutinesApi::class)
class DocumentsViewModelTest {
    private val repo: HomesRepository = mockk()

    /** Fixed clock so expiring / recent filtering stays deterministic. */
    private val fixedNow: Instant = Instant.parse("2026-05-15T12:00:00Z")

    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun makeVm(): DocumentsViewModel =
        DocumentsViewModel(
            repo = repo,
            savedStateHandle = SavedStateHandle(mapOf(DOCUMENTS_HOME_ID_KEY to "home-1")),
            clock = { fixedNow },
        )

    @Suppress("LongParameterList")
    private fun dto(
        id: String = "d1",
        docType: String = "lease",
        title: String = "Lease.pdf",
        mimeType: String? = "application/pdf",
        sizeBytes: Long? = 2_400_000,
        visibility: String = "members",
        details: Map<String, String>? = null,
        createdAt: String? = "2026-05-10T00:00:00Z",
    ): HomeDocumentDto =
        HomeDocumentDto(
            id = id,
            homeId = "home-1",
            fileId = null,
            docType = docType,
            title = title,
            storageBucket = null,
            storagePath = null,
            mimeType = mimeType,
            sizeBytes = sizeBytes,
            visibility = visibility,
            details = details,
            createdBy = null,
            createdAt = createdAt,
            updatedAt = null,
        )

    // ─── Four states ───────────────────────────────────────────

    @Test fun empty_response_renders_empty_state() =
        runTest {
            coEvery { repo.getHomeDocuments(any()) } returns
                NetworkResult.Success(GetHomeDocumentsResponse(documents = emptyList()))
            val vm = makeVm()
            vm.load()
            val state = vm.state.value
            assertTrue(state is ListOfRowsUiState.Empty)
            assertEquals("No documents yet", (state as ListOfRowsUiState.Empty).headline)
            assertEquals("Upload document", state.ctaTitle)
        }

    @Test fun failure_renders_error_state() =
        runTest {
            coEvery { repo.getHomeDocuments(any()) } returns
                NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = makeVm()
            vm.load()
            assertTrue(vm.state.value is ListOfRowsUiState.Error)
        }

    @Test fun loaded_response_buckets_by_category_in_order() =
        runTest {
            coEvery { repo.getHomeDocuments(any()) } returns
                NetworkResult.Success(
                    GetHomeDocumentsResponse(
                        listOf(
                            dto("d1", "insurance", "State Farm.pdf"),
                            dto("d2", "lease", "Lease.pdf"),
                            dto("d3", "manual", "LG fridge.pdf"),
                        ),
                    ),
                )
            val vm = makeVm()
            vm.load()
            val state = vm.state.value
            assertTrue(state is ListOfRowsUiState.Loaded)
            val sections = (state as ListOfRowsUiState.Loaded).sections
            assertEquals(3, sections.size)
            // Order is lease → insurance → warranty (manual maps onto warranty).
            assertEquals(
                listOf("Lease & ownership", "Insurance", "Warranties & manuals"),
                sections.map { it.header },
            )
        }

    // ─── Category mapping ─────────────────────────────────────

    @Test fun category_mapping() {
        assertEquals(DocumentCategory.Lease, DocumentCategory.fromDocType("lease"))
        assertEquals(DocumentCategory.Insurance, DocumentCategory.fromDocType("insurance"))
        assertEquals(DocumentCategory.Warranty, DocumentCategory.fromDocType("warranty"))
        assertEquals(DocumentCategory.Warranty, DocumentCategory.fromDocType("manual"))
        assertEquals(DocumentCategory.Permit, DocumentCategory.fromDocType("permit"))
        assertEquals(DocumentCategory.Permit, DocumentCategory.fromDocType("floor_plan"))
        assertEquals(DocumentCategory.Tax, DocumentCategory.fromDocType("receipt"))
        assertEquals(DocumentCategory.Other, DocumentCategory.fromDocType("photo"))
        assertEquals(DocumentCategory.Other, DocumentCategory.fromDocType("paint_color"))
        assertEquals(DocumentCategory.Other, DocumentCategory.fromDocType("other"))
    }

    // ─── File-type inference ───────────────────────────────

    @Test fun file_type_inference_from_mime() {
        assertEquals(DocumentFileType.Pdf, DocumentFileType.fromMime("application/pdf"))
        assertEquals(DocumentFileType.Image, DocumentFileType.fromMime("image/jpeg"))
        assertEquals(DocumentFileType.Image, DocumentFileType.fromMime("image/png"))
        assertEquals(DocumentFileType.Doc, DocumentFileType.fromMime("application/msword"))
        assertEquals(
            DocumentFileType.Doc,
            DocumentFileType.fromMime(
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ),
        )
        assertEquals(
            DocumentFileType.Sheet,
            DocumentFileType.fromMime(
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ),
        )
        assertEquals(DocumentFileType.Archive, DocumentFileType.fromMime("application/zip"))
    }

    @Test fun file_type_inference_from_filename_fallback() {
        assertEquals(DocumentFileType.Pdf, DocumentFileType.fromMime(null, "policy.pdf"))
        assertEquals(
            DocumentFileType.Image,
            DocumentFileType.fromMime("application/octet-stream", "photo.HEIC"),
        )
        assertEquals(DocumentFileType.Sheet, DocumentFileType.fromMime(null, "taxes.xlsx"))
        assertEquals(DocumentFileType.Archive, DocumentFileType.fromMime(null, "evidence.zip"))
        // Unknown extension → Pdf (the "safe default" tile colour).
        assertEquals(DocumentFileType.Pdf, DocumentFileType.fromMime(null, "blob.xyz"))
    }

    // ─── Filtering ─────────────────────────────────────────

    @Test fun expiring_chip_filters_to_next_90_days() =
        runTest {
            coEvery { repo.getHomeDocuments(any()) } returns
                NetworkResult.Success(
                    GetHomeDocumentsResponse(
                        listOf(
                            dto(
                                "a",
                                "insurance",
                                "A.pdf",
                                details = mapOf("expires_at" to "2026-06-15T00:00:00Z"),
                            ),
                            dto(
                                "b",
                                "insurance",
                                "B.pdf",
                                details = mapOf("expires_at" to "2027-01-15T00:00:00Z"),
                            ),
                        ),
                    ),
                )
            val vm = makeVm()
            vm.load()
            vm.selectFilter(DocumentsFilter.Expiring.id)
            val state = vm.state.value
            assertTrue(state is ListOfRowsUiState.Loaded)
            val ids =
                (state as ListOfRowsUiState.Loaded).sections.flatMap { section ->
                    section.rows.map { it.id }
                }
            assertEquals(listOf("a"), ids)
        }

    @Test fun recent_chip_filters_to_last_30_days() =
        runTest {
            coEvery { repo.getHomeDocuments(any()) } returns
                NetworkResult.Success(
                    GetHomeDocumentsResponse(
                        listOf(
                            dto("a", "insurance", "A.pdf", createdAt = "2026-05-10T00:00:00Z"),
                            dto("b", "insurance", "B.pdf", createdAt = "2025-09-01T00:00:00Z"),
                        ),
                    ),
                )
            val vm = makeVm()
            vm.load()
            vm.selectFilter(DocumentsFilter.Recent.id)
            val state = vm.state.value as ListOfRowsUiState.Loaded
            val ids = state.sections.flatMap { section -> section.rows.map { it.id } }
            assertEquals(listOf("a"), ids)
        }

    // ─── Banner summary ─────────────────────────────────────

    @Test fun banner_summary_sums_bytes_and_expiring_count() {
        val docs =
            listOf(
                dto("a", sizeBytes = 1_000_000, details = mapOf("expires_at" to "2026-06-15T00:00:00Z")),
                dto("b", sizeBytes = 500_000),
                dto("c", sizeBytes = 2_000_000, details = mapOf("expires_at" to "2027-06-15T00:00:00Z")),
            )
        val summary = DocumentsViewModel.summarize(docs, fixedNow)
        assertEquals(3, summary.totalCount)
        assertEquals(1, summary.expiringCount)
        assertNotNull(summary.storageUsedLabel)
        assertTrue(summary.hasContent)
    }

    @Test fun row_projection_fills_filename_and_chips() {
        val doc =
            dto(
                docType = "lease",
                title = "Lease — 412 Birch Ln (2024-2026).pdf",
                mimeType = "application/pdf",
                sizeBytes = 2_400_000,
                details =
                    mapOf(
                        "uploaded_by" to "John",
                        "version" to "v3 signed",
                        "expires_at" to "2026-06-15T00:00:00Z",
                    ),
            )
        val projection = DocumentsViewModel.project(doc, fixedNow)
        assertEquals("Lease — 412 Birch Ln (2024-2026).pdf", projection.filename)
        assertEquals(DocumentCategory.Lease, projection.category)
        assertEquals(DocumentFileType.Pdf, projection.fileType)
        assertEquals("v3 signed", projection.version)
        assertNotNull(projection.uploadedLabel)
        assertNotNull(projection.expiresLabel)
        // Within 60 days → urgent (orange).
        assertTrue(projection.expiresUrgent)
    }
}
