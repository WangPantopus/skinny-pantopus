@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.documents

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.homes.CreateDocumentResponse
import app.pantopus.android.data.api.models.homes.GetHomeDocumentsResponse
import app.pantopus.android.data.api.models.homes.HomeDocumentDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomesRepository
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.CompletableDeferred
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
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.util.UUID

@OptIn(ExperimentalCoroutinesApi::class)
class DocumentReplacementTest {
    private val repo: HomesRepository = mockk()
    private val original =
        HomeDocumentDto(
            id = "doc-1", homeId = "home-1", fileId = "doc-1", docType = "receipt", title = "Original title",
            storageBucket = null, storagePath = null, mimeType = "text/plain", sizeBytes = 5,
            visibility = "members", details = mapOf("tags" to "keep"), createdBy = null, createdAt = null, updatedAt = null,
            contentUrl = "/api/homes/home-1/documents/doc-1/content", fileVersion = "f3b52a86-5d16-4c30-b96d-cc3eb3c37323",
        )
    private val bytes = "new private replacement bytes".encodeUtf8()

    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        allow(original)
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun vm() = DocumentDetailViewModel(repo, SavedStateHandle(mapOf("homeId" to "home-1", "documentId" to "doc-1")))

    private fun allow(document: HomeDocumentDto) {
        coEvery { repo.getHomeDocuments("home-1") } returns NetworkResult.Success(GetHomeDocumentsResponse(listOf(document)))
        coEvery { repo.homeDocumentContent("home-1", "doc-1") } returns NetworkResult.Success(bytes)
    }

    private suspend fun pick(vm: DocumentDetailViewModel) {
        assertTrue(vm.beginReplacement())
        vm.readReplacement("replacement.txt", "text/plain") { bytes.toByteArray().inputStream() }
        assertEquals(bytes, vm.replacementFile.value?.bytes)
    }

    @Test fun `retry keeps upload identity and reloads exact bytes at original link`() =
        runTest {
            val attempts = mutableListOf<String>()
            var response: NetworkResult<CreateDocumentResponse> = NetworkResult.Failure(NetworkError.Server(503, null))
            coEvery {
                repo.replaceHomeDocument("home-1", "doc-1", any(), original.fileVersion!!, "replacement.txt", "text/plain", bytes)
            } coAnswers {
                attempts.add(thirdArg())
                response
            }
            val vm = vm()
            vm.load()
            pick(vm)
            vm.replace()
            assertTrue(vm.state.value is DocumentDetailUiState.Error)
            assertFalse(vm.shouldDismiss.value)
            val id = attempts.single()
            assertNotNull(UUID.fromString(id))
            val current = original.copy(fileVersion = id)
            response = NetworkResult.Success(CreateDocumentResponse(current))
            allow(current)
            vm.replace()
            assertEquals(listOf(id, id), attempts)
            val loaded = vm.state.value as DocumentDetailUiState.Loaded
            assertEquals("doc-1", loaded.document.id)
            assertEquals("Original title", loaded.document.title)
            assertEquals(original.details, loaded.document.details)
            assertEquals(bytes, loaded.content)
            assertEquals("File replaced.", vm.toast.value?.text)
            assertNull(vm.replacementFile.value)
            assertFalse(vm.shouldDismiss.value)
        }

    @Test fun `denied stale and unconfirmed responses hide content without claiming success`() =
        runTest {
            for (response in listOf(
                NetworkResult.Failure(NetworkError.Forbidden),
                NetworkResult.Failure(NetworkError.Server(409, null)),
                NetworkResult.Failure(NetworkError.Server(503, null)),
                NetworkResult.Success(CreateDocumentResponse(original)),
            )) {
                coEvery { repo.replaceHomeDocument(any(), any(), any(), any(), any(), any(), any()) } returns response
                val vm = vm()
                vm.load()
                pick(vm)
                vm.replace()
                assertTrue(vm.state.value is DocumentDetailUiState.Error)
                assertNull(vm.toast.value)
                assertFalse(vm.shouldDismiss.value)
            }
        }

    @Test fun `access revoked before reload never shows replacement success`() =
        runTest {
            coEvery { repo.replaceHomeDocument(any(), any(), any(), any(), any(), any(), any()) } coAnswers {
                coEvery { repo.getHomeDocuments("home-1") } returns NetworkResult.Failure(NetworkError.Forbidden)
                NetworkResult.Success(CreateDocumentResponse(original.copy(fileVersion = thirdArg())))
            }
            val vm = vm()
            vm.load()
            pick(vm)
            vm.replace()
            assertTrue(vm.state.value is DocumentDetailUiState.Error)
            assertNull(vm.toast.value)
        }

    @Test fun `cancellation preserves original and does not upload`() =
        runTest {
            val vm = vm()
            vm.load()
            pick(vm)
            vm.cancelReplacement()
            vm.replace()
            assertNull(vm.replacementFile.value)
            assertEquals(bytes, (vm.state.value as DocumentDetailUiState.Loaded).content)
            coVerify(exactly = 0) { repo.replaceHomeDocument(any(), any(), any(), any(), any(), any(), any()) }
        }

    @Test fun `empty picker file cannot be confirmed`() =
        runTest {
            val vm = vm()
            vm.load()
            assertTrue(vm.beginReplacement())
            vm.readReplacement("replacement.txt", "text/plain") { byteArrayOf().inputStream() }
            vm.replace()
            assertNull(vm.replacementFile.value)
            assertTrue(vm.toast.value?.isError == true)
            coVerify(exactly = 0) { repo.replaceHomeDocument(any(), any(), any(), any(), any(), any(), any()) }
        }

    @Test fun `older server without file version cannot start replacement`() =
        runTest {
            allow(original.copy(fileVersion = null))
            val vm = vm()
            vm.load()
            assertFalse(vm.beginReplacement())
            vm.replace()
            coVerify(exactly = 0) { repo.replaceHomeDocument(any(), any(), any(), any(), any(), any(), any()) }
        }

    @Test fun `repeated taps and foreground load cannot race pending replacement`() =
        runTest {
            val response = CompletableDeferred<NetworkResult<CreateDocumentResponse>>()
            coEvery { repo.replaceHomeDocument(any(), any(), any(), any(), any(), any(), any()) } coAnswers { response.await() }
            val vm = vm()
            vm.load()
            pick(vm)
            vm.replace()
            vm.replace()
            assertFalse(vm.beginReplacement())
            vm.clearContent()
            vm.load()
            response.complete(NetworkResult.Failure(NetworkError.Forbidden))
            assertTrue(vm.state.value is DocumentDetailUiState.Error)
            coVerify(exactly = 1) { repo.replaceHomeDocument(any(), any(), any(), any(), any(), any(), any()) }
            coVerify(exactly = 1) { repo.getHomeDocuments("home-1") }
        }
}
