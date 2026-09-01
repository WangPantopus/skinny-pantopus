@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.mailbox.package_gig

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.mailbox.v2.PackageGigResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
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
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test

/**
 * A17.8 → "Ask a Neighbor" — JVM unit tests for the package-gig form.
 * The screen has a single write (`POST api/mailbox/v2/p2/package/:mailId/gig`,
 * `backend/routes/mailboxV2Phase2.js:1280`), so the repository is mocked and
 * the form/success transitions are asserted. Mirrors iOS
 * `PackageGigViewModelTests`.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class PackageGigViewModelTest {
    private val repository = mockk<MailboxPackageRepository>(relaxed = true)

    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun vm(isPreDelivery: Boolean = true): PackageGigViewModel {
        val handle =
            SavedStateHandle(
                mapOf(
                    PACKAGE_GIG_MAIL_ID_KEY to "mail-1",
                    PACKAGE_GIG_MODE_KEY to
                        if (isPreDelivery) PACKAGE_GIG_MODE_PRE else PACKAGE_GIG_MODE_POST,
                ),
            )
        return PackageGigViewModel(repository, handle)
    }

    @Test
    fun `pre-delivery hides post-only options`() {
        val model = vm(isPreDelivery = true)
        assertEquals(
            listOf(PackageGigType.Hold, PackageGigType.Inside, PackageGigType.Sign),
            model.options.map { it.type },
        )
        assertEquals("PRE-DELIVERY GIG", model.eyebrow)
    }

    @Test
    fun `post-delivery offers every option`() {
        val model = vm(isPreDelivery = false)
        assertEquals(5, model.options.size)
        assertEquals("POST-DELIVERY GIG", model.eyebrow)
    }

    @Test
    fun `submitting without a type alerts and does not post`() {
        val model = vm()
        model.create()
        assertEquals("Select a type", model.alert.value?.title)
        assertNull(model.created.value)
    }

    @Test
    fun `successful submit renders the created gig`() {
        coEvery { repository.createPackageGig(any(), any()) } returns
            NetworkResult.Success(
                PackageGigResponse(
                    message = "Gig created",
                    gigId = "g-77",
                    title = "Hold my package",
                    preDelivery = true,
                ),
            )
        val model = vm()
        model.select(PackageGigType.Hold)
        model.create()
        assertEquals("g-77", model.created.value?.gigId)
        assertEquals("Hold my package", model.created.value?.title)
        assertNull(model.alert.value)
    }

    @Test
    fun `failed submit alerts and stays on the form`() {
        coEvery { repository.createPackageGig(any(), any()) } returns
            NetworkResult.Failure(NetworkError.NotFound)
        val model = vm(isPreDelivery = false)
        model.select(PackageGigType.Assembly)
        model.create()
        assertEquals("Error", model.alert.value?.title)
        assertNull(model.created.value)
    }

    @Test
    fun `response without a gig id is treated as a failure`() {
        coEvery { repository.createPackageGig(any(), any()) } returns
            NetworkResult.Success(PackageGigResponse(message = "Gig created"))
        val model = vm(isPreDelivery = false)
        model.select(PackageGigType.Custom)
        model.create()
        assertEquals("Error", model.alert.value?.title)
        assertNull(model.created.value)
    }
}
