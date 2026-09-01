@file:Suppress("MagicNumber", "PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.homes.documents

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.homes.GetHomeDocumentsResponse
import app.pantopus.android.data.api.models.homes.HomeDocumentDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.ui.screens.shared.list_of_rows.RowLeading
import app.pantopus.android.ui.theme.PantopusIcon
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
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.time.Instant

/**
 * P4.5 — Covers the Document Search VM:
 *  - corpus loads once; isLoading clears on settle (success + failure)
 *  - blank query → no results
 *  - matching across title / category label / tags (case-insensitive)
 *  - result rows reuse the Documents row projection + append tag chips
 */
@OptIn(ExperimentalCoroutinesApi::class)
class DocumentSearchViewModelTest {
    private val repo: HomesRepository = mockk()

    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun makeVm(): DocumentSearchViewModel =
        DocumentSearchViewModel(
            repo = repo,
            savedStateHandle = SavedStateHandle(mapOf(DOCUMENTS_HOME_ID_KEY to "home-1")),
            clock = { Instant.parse("2026-05-15T12:00:00Z") },
        )

    private fun dto(
        id: String = "d1",
        docType: String = "lease",
        title: String = "Lease.pdf",
        details: Map<String, String>? = null,
    ): HomeDocumentDto =
        HomeDocumentDto(
            id = id,
            homeId = "home-1",
            fileId = null,
            docType = docType,
            title = title,
            storageBucket = null,
            storagePath = null,
            mimeType = "application/pdf",
            sizeBytes = 2_400_000,
            visibility = "members",
            details = details,
            createdBy = null,
            createdAt = "2026-05-10T00:00:00Z",
            updatedAt = null,
        )

    // ─── Pure matching ─────────────────────────────────────────

    @Test fun matches_by_title() {
        val d = dto(title = "Renters Insurance.pdf")
        assertTrue(DocumentSearchViewModel.matches(d, "renters"))
        assertTrue(DocumentSearchViewModel.matches(d, "INSURANCE"))
        assertFalse(DocumentSearchViewModel.matches(d, "warranty"))
    }

    @Test fun matches_by_category_label() {
        // doc_type "insurance" → category label "Insurance".
        assertTrue(DocumentSearchViewModel.matches(dto(docType = "insurance", title = "Policy.pdf"), "insurance"))
    }

    @Test fun matches_by_tag() {
        val d = dto(title = "Policy.pdf", details = mapOf("tags" to "wifi, router, fiber"))
        assertTrue(DocumentSearchViewModel.matches(d, "router"))
        assertTrue(DocumentSearchViewModel.matches(d, "WIFI"))
        assertFalse(DocumentSearchViewModel.matches(d, "ethernet"))
    }

    @Test fun filter_blank_query_yields_empty() {
        val docs = listOf(dto(id = "a"), dto(id = "b"))
        assertTrue(DocumentSearchViewModel.filter(docs, "").isEmpty())
        assertTrue(DocumentSearchViewModel.filter(docs, "   ").isEmpty())
    }

    @Test fun filter_returns_only_matches() {
        val docs =
            listOf(
                dto(id = "lease", docType = "lease", title = "Lease.pdf"),
                dto(id = "ins", docType = "insurance", title = "Renters Policy.pdf"),
            )
        assertEquals(listOf("ins"), DocumentSearchViewModel.filter(docs, "renters").map { it.id })
    }

    @Test fun tag_chips_project_from_details() {
        val chips = DocumentSearchViewModel.tagChips(dto(details = mapOf("tags" to "alpha, beta")))
        assertEquals(listOf("alpha", "beta"), chips.map { it.text })
        assertEquals(PantopusIcon.Tag, chips.first().icon)
    }

    @Test fun tag_chips_empty_when_no_tags() {
        assertTrue(DocumentSearchViewModel.tagChips(dto()).isEmpty())
    }

    // ─── Load + query lifecycle ────────────────────────────────

    @Test fun initial_state_is_loading_with_no_results() {
        val vm = makeVm()
        assertTrue(vm.isLoading.value)
        assertTrue(vm.results.value.isEmpty())
    }

    @Test fun load_clears_loading_and_keeps_results_empty_for_blank_query() =
        runTest {
            coEvery { repo.getHomeDocuments(any()) } returns
                NetworkResult.Success(GetHomeDocumentsResponse(documents = listOf(dto())))
            val vm = makeVm()
            vm.load()
            assertFalse(vm.isLoading.value)
            assertTrue(vm.results.value.isEmpty())
        }

    @Test fun query_filters_loaded_corpus() =
        runTest {
            coEvery { repo.getHomeDocuments(any()) } returns
                NetworkResult.Success(
                    GetHomeDocumentsResponse(
                        documents =
                            listOf(
                                dto(id = "d1", docType = "lease", title = "Lease.pdf", details = mapOf("tags" to "signed")),
                                dto(
                                    id = "d2",
                                    docType = "insurance",
                                    title = "Renters Policy.pdf",
                                    details = mapOf("tags" to "renters,policy"),
                                ),
                            ),
                    ),
                )
            val vm = makeVm()
            vm.load()
            vm.onQueryChange("renters")
            assertEquals(listOf("d2"), vm.results.value.map { it.id })
            vm.onQueryChange("zzzzz")
            assertTrue(vm.results.value.isEmpty())
        }

    @Test fun load_failure_leaves_empty_results() =
        runTest {
            coEvery { repo.getHomeDocuments(any()) } returns
                NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = makeVm()
            vm.load()
            assertFalse(vm.isLoading.value)
            vm.onQueryChange("lease")
            assertTrue(vm.results.value.isEmpty())
        }

    @Test fun row_model_reuses_document_row_with_tag_chips() =
        runTest {
            coEvery { repo.getHomeDocuments(any()) } returns
                NetworkResult.Success(
                    GetHomeDocumentsResponse(
                        documents =
                            listOf(
                                dto(
                                    id = "d1",
                                    docType = "insurance",
                                    title = "Renters Policy.pdf",
                                    details = mapOf("tags" to "renters,policy"),
                                ),
                            ),
                    ),
                )
            val vm = makeVm()
            vm.load()
            vm.onQueryChange("renters")
            val match = vm.results.value.first()
            val row = vm.rowModel(match)
            assertEquals("Renters Policy.pdf", row.title)
            assertEquals("Insurance", row.chips?.first()?.text)
            assertTrue(row.chips?.any { it.text == "renters" } == true)
            assertTrue(row.chips?.any { it.text == "policy" } == true)
            assertTrue(row.leading is RowLeading.TypeIcon)
        }
}
