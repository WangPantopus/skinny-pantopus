@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.documents

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.homes.GetHomeDocumentsResponse
import app.pantopus.android.data.api.models.homes.HomeDocumentDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomesRepository
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import okio.ByteString.Companion.encodeUtf8
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class DocumentFileAccessTest {
    private val repo: HomesRepository = mockk()
    private val document =
        HomeDocumentDto(
            id = "doc-1", homeId = "home-1", fileId = "doc-1", docType = "receipt", title = "Private file",
            storageBucket = null, storagePath = null, mimeType = "text/plain", sizeBytes = 5,
            visibility = "members", details = null, createdBy = null, createdAt = null, updatedAt = null,
            contentUrl = "https://untrusted.invalid/file",
        )

    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun vm() = DocumentDetailViewModel(repo, SavedStateHandle(mapOf("homeId" to "home-1", "documentId" to "doc-1")))

    private fun allow() {
        coEvery { repo.getHomeDocuments("home-1") } returns NetworkResult.Success(GetHomeDocumentsResponse(listOf(document)))
        coEvery { repo.homeDocumentContent("home-1", "doc-1") } returns NetworkResult.Success("exact bytes".encodeUtf8())
    }

    @Test fun `download uses Home path and returns exact bytes`() =
        runTest {
            allow()
            val vm = vm()
            vm.load()
            assertEquals("exact bytes".encodeUtf8(), (vm.state.value as DocumentDetailUiState.Loaded).content)
            coVerify(exactly = 1) { repo.homeDocumentContent("home-1", "doc-1") }
        }

    @Test fun `revoked access removes previously displayed bytes`() =
        runTest {
            allow()
            val vm = vm()
            vm.load()
            coEvery { repo.getHomeDocuments("home-1") } returns NetworkResult.Failure(NetworkError.Forbidden)
            vm.load()
            assertTrue(vm.state.value is DocumentDetailUiState.Error)
        }

    @Test fun `allowed list does not bypass denied file retrieval`() =
        runTest {
            allow()
            coEvery { repo.homeDocumentContent("home-1", "doc-1") } returns NetworkResult.Failure(NetworkError.Forbidden)
            val vm = vm()
            vm.load()
            assertTrue(vm.state.value is DocumentDetailUiState.Error)
        }

    @Test fun `background removes private document state`() =
        runTest {
            allow()
            val vm = vm()
            vm.load()
            vm.clearContent()
            assertEquals(DocumentDetailUiState.Loading, vm.state.value)
        }

    @Test fun `export checks access again and does not return a denied copy`() =
        runTest {
            allow()
            val vm = vm()
            vm.load()
            coEvery { repo.getHomeDocuments("home-1") } returns NetworkResult.Failure(NetworkError.Forbidden)
            var exported = false
            vm.export { _, _ -> exported = true }
            assertFalse(exported)
            assertTrue(vm.state.value is DocumentDetailUiState.Error)
        }
}
