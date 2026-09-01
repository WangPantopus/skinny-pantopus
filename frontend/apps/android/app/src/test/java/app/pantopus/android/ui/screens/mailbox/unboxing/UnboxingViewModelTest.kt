@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.mailbox.unboxing

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.mailbox.v2.PackageGigResponse
import app.pantopus.android.data.api.models.mailbox.v2.PackageSaveWarrantyResponse
import app.pantopus.android.data.api.models.mailbox.v2.UnboxingPackageDto
import app.pantopus.android.data.api.models.mailbox.v2.UnboxingPackageResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.files.FilesRepository
import app.pantopus.android.data.mailbox.MailboxPackageRepository
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * A17.14 — JVM unit tests for the Unboxing view-model. Everything on the
 * screen now round-trips to `api/mailbox/v2/p2`, so the repository is
 * mocked and the projection asserted against a real `MailPackage` row.
 * Mirrors iOS `UnboxingSnapshotTests`' behaviour assertions.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class UnboxingViewModelTest {
    private val repository = mockk<MailboxPackageRepository>(relaxed = true)
    private val files = mockk<FilesRepository>(relaxed = true)

    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun row(
        warrantySaved: Boolean = false,
        conditionPhoto: String? = null,
    ) = UnboxingPackageDto(
        id = "pkg-1",
        mailId = "mail-1",
        carrier = "UPS",
        trackingIdMasked = "1Z••4417",
        status = "delivered",
        deliveryPhotoUrl = null,
        deliveryLocationNote = "Front porch",
        conditionPhotoUrl = conditionPhoto,
        unboxingVideoUrl = null,
        unboxingCompleted = false,
        warrantySaved = warrantySaved,
        manualSaved = false,
        gigId = null,
        gigType = null,
        inferredItemName = "Espresso machine",
        updatedAt = null,
    )

    private fun vm(
        mailId: String? = "mail-1",
        packageRow: UnboxingPackageDto = row(),
    ): UnboxingViewModel {
        coEvery { repository.packageDetail(any()) } returns
            NetworkResult.Success(UnboxingPackageResponse(packageRow = packageRow, sender = null))
        val handle =
            SavedStateHandle(
                mapOf(UNBOXING_MAIL_ID_KEY to (mailId ?: UNBOXING_MAIL_ID_NONE)),
            )
        return UnboxingViewModel(repository, files, handle)
    }

    @Test
    fun `without a mail id the screen is unavailable and never fetches`() {
        val model = vm(mailId = null)
        model.load()
        assertTrue(model.state.value is UnboxingUiState.Unavailable)
    }

    @Test
    fun `loads the real package row into the capture frame`() {
        val model = vm()
        model.load()
        val state = model.state.value
        assertTrue(state is UnboxingUiState.Capture)
        val content = (state as UnboxingUiState.Capture).content
        assertEquals("Espresso machine", content.productTitle)
        assertEquals("UPS · 1Z••4417", content.productSubtitle)
        // Facts come only off the package row — no invented OCR.
        assertTrue(content.facts.any { it.label == "Carrier" && it.value == "UPS" })
        assertTrue(content.facts.any { it.label == "Left at" && it.value == "Front porch" })
        // No classifier → no re-route alternatives and no confidence score.
        assertTrue(content.alternates.isEmpty())
        assertEquals(null, content.suggestion.confidence)
    }

    @Test
    fun `a package with the warranty already filed opens in the filed frame`() {
        val model = vm(packageRow = row(warrantySaved = true))
        model.load()
        assertTrue(model.state.value is UnboxingUiState.Filed)
    }

    @Test
    fun `an existing condition photo shows up in the filmstrip`() {
        val model = vm(packageRow = row(conditionPhoto = "https://s3/condition.jpg"))
        model.load()
        val content = (model.state.value as UnboxingUiState.Capture).content
        assertEquals(1, content.shots.size)
        assertEquals("CONDITION", content.shots.first().tag)
    }

    @Test
    fun `confirm files the warranty and advances to the filed frame`() {
        coEvery { repository.saveWarranty("mail-1", "warranty") } returns
            NetworkResult.Success(PackageSaveWarrantyResponse(message = "warranty saved", folder = "f1"))
        val model = vm()
        model.load()
        model.confirm()
        assertTrue(model.state.value is UnboxingUiState.Filed)
        assertEquals("Filed to Home › Warranties", model.toast.value)
    }

    @Test
    fun `a failed confirm keeps the capture frame and surfaces the error`() {
        coEvery { repository.saveWarranty(any(), any()) } returns
            NetworkResult.Failure(NetworkError.NotFound)
        val model = vm()
        model.load()
        model.confirm()
        assertTrue(model.state.value is UnboxingUiState.Capture)
        assertEquals("Couldn't file this — try again", model.toast.value)
    }

    @Test
    fun `posting the assembly gig surfaces the created task title`() {
        coEvery { repository.createPackageGig(any(), any()) } returns
            NetworkResult.Success(
                PackageGigResponse(message = "Gig created", gigId = "g1", title = "Help assembling", preDelivery = false),
            )
        val model = vm()
        model.load()
        model.postAssemblyGig()
        assertEquals("Help assembling", model.toast.value)
    }

    @Test
    fun `a failed package fetch lands on the error frame`() {
        coEvery { repository.packageDetail(any()) } returns NetworkResult.Failure(NetworkError.NotFound)
        val model =
            UnboxingViewModel(
                repository,
                files,
                SavedStateHandle(mapOf(UNBOXING_MAIL_ID_KEY to "mail-1")),
            )
        model.load()
        assertTrue(model.state.value is UnboxingUiState.Error)
    }

    @Test
    fun `undo returns to capture without claiming the vault entry was removed`() {
        val model = vm(packageRow = row(warrantySaved = true))
        model.load()
        model.undo()
        assertTrue(model.state.value is UnboxingUiState.Capture)
        assertEquals("Back to capture · the saved document stays in your vault", model.toast.value)
    }

    @Test
    fun `openDrawer notifies the host`() {
        val model = vm()
        var opened = false
        model.configure(onScanNext = {}, onOpenDrawer = { opened = true })
        model.openDrawer()
        assertTrue(opened)
    }
}
