@file:Suppress("MagicNumber")

package app.pantopus.android.place

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.place.PlaceRealRentData
import app.pantopus.android.data.api.models.place.RealRentStanding
import app.pantopus.android.data.api.models.place.RealRentState
import app.pantopus.android.data.api.models.place.RemoveRentReportResponse
import app.pantopus.android.data.api.models.place.RentReport
import app.pantopus.android.data.api.models.place.RentReportResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.place.PlaceRepository
import app.pantopus.android.ui.screens.place.components.PlaceChipTone
import app.pantopus.android.ui.screens.place.detail.PLACE_DETAIL_HOME_ID_KEY
import app.pantopus.android.ui.screens.place.detail.PLACE_DETAIL_SLUG_KEY
import app.pantopus.android.ui.screens.place.detail.PlaceDetailViewModel
import app.pantopus.android.ui.screens.place.detail.realRentQuartiles
import app.pantopus.android.ui.screens.place.detail.savedRentLine
import app.pantopus.android.ui.screens.place.detail.standingChip
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import retrofit2.HttpException
import retrofit2.Response

/**
 * The viewer's own half of the Real Rent benchmark. Every case here
 * guards the same thing: what the client SENDS must be the figure the
 * resident is looking at, scoped to the cohort they actually live in.
 *
 * The two that matter most corrupt the whole block if they regress —
 * a dropped decimal point turns $495.75 into $49,575 inside the
 * server's plausibility fence, and a dropped bedroom count silently
 * re-files a 2-bedroom report as a studio. Both poison quartiles every
 * neighbor then reads.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class PlaceRealRentContributionTest {
    private val repo: PlaceRepository = mockk(relaxed = true)

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun makeVm(): PlaceDetailViewModel =
        PlaceDetailViewModel(
            repo = repo,
            savedStateHandle =
                SavedStateHandle(
                    mapOf(
                        PLACE_DETAIL_HOME_ID_KEY to "home-1",
                        PLACE_DETAIL_SLUG_KEY to "money",
                    ),
                ),
        )

    private fun report(
        monthlyRent: Int = 2400,
        bedrooms: Int? = 2,
    ) = RentReport(monthlyRent = monthlyRent, bedrooms = bedrooms, reportedAt = null, updatedAt = null)

    // ── Defect 1: the decimal point is a decimal point ───────────

    @Test
    fun `495_75 is 496 dollars and never 49575`() {
        val parsed = PlaceDetailViewModel.parseMonthlyRent("495.75")
        assertEquals(496, parsed)
        assertNotEquals(49575, parsed)
    }

    @Test
    fun `the amount sent is the amount on screen`() =
        runTest {
            coEvery { repo.setRentReport(any(), any(), any()) } returns
                NetworkResult.Success(RentReportResponse(report(monthlyRent = 496)))
            makeVm().setRentReport("495.75", "2")
            // 49575 would have cleared the server's $50–$50,000 fence and
            // joined the block pool as a $49,575/mo home.
            coVerify(exactly = 1) { repo.setRentReport("home-1", 496, 2) }
            coVerify(exactly = 0) { repo.setRentReport(any(), 49575, any()) }
        }

    @Test
    fun `grouping separators and currency symbols are stripped, the decimal is kept`() {
        assertEquals(2400, PlaceDetailViewModel.parseMonthlyRent("$2,400"))
        assertEquals(2400, PlaceDetailViewModel.parseMonthlyRent("2400"))
        assertEquals(2401, PlaceDetailViewModel.parseMonthlyRent("2400.50"))
        assertEquals(2400, PlaceDetailViewModel.parseMonthlyRent(" 2400.49 "))
    }

    @Test
    fun `un-parseable input is refused inline instead of sending some other number`() =
        runTest {
            assertNull(PlaceDetailViewModel.parseMonthlyRent(""))
            assertNull(PlaceDetailViewModel.parseMonthlyRent("abc"))
            assertNull(PlaceDetailViewModel.parseMonthlyRent("1.2.3"))
            assertNull(PlaceDetailViewModel.parseMonthlyRent("0"))
            assertNull(PlaceDetailViewModel.parseMonthlyRent("0.4"))
            val vm = makeVm()
            vm.setRentReport("1.2.3", "2")
            assertEquals(PlaceDetailViewModel.RENT_AMOUNT_MESSAGE, vm.rentSaveError.value)
            coVerify(exactly = 0) { repo.setRentReport(any(), any(), any()) }
        }

    // ── Defect 2: an update keeps the report's own bedroom count ─

    @Test
    fun `updating preserves the bedroom count the report was filed under`() =
        runTest {
            coEvery { repo.setRentReport(any(), any(), any()) } returns
                NetworkResult.Success(RentReportResponse(report()))
            // Exactly what the own-card hands back: the amount, and the
            // bedroom count seeded from the LOADED report.
            val loaded = report(monthlyRent = 2400, bedrooms = 2)
            makeVm().setRentReport(loaded.monthlyRent.toString(), loaded.bedrooms?.toString().orEmpty())
            coVerify(exactly = 1) { repo.setRentReport("home-1", 2400, 2) }
            // null is what re-scoped the report: the server then falls
            // back to the Home row, and a null row there means STUDIO.
            coVerify(exactly = 0) { repo.setRentReport(any(), any(), null) }
        }

    @Test
    fun `a blank bedrooms field is omitted, never sent as zero`() {
        // Zero means STUDIO on the wire. Blank must stay "use the home's
        // own count", which is the server's documented fallback.
        assertNull(PlaceDetailViewModel.parseBedrooms(""))
        assertNull(PlaceDetailViewModel.parseBedrooms("   "))
        assertEquals(0, PlaceDetailViewModel.parseBedrooms("0"))
        // Regression: digit-filtering turned "2.5" into 25, which the
        // server clamps to 10 — the resident's rent silently joined the
        // 10-bedroom cohort. A non-integer is refused, never reinterpreted.
        assertNull(PlaceDetailViewModel.parseBedrooms("2.5"))
        assertNull(PlaceDetailViewModel.parseBedrooms("2,5"))
        assertNull(PlaceDetailViewModel.parseBedrooms("two"))
        assertNull(PlaceDetailViewModel.parseBedrooms("99"))
        assertEquals(3, PlaceDetailViewModel.parseBedrooms(" 3 "))
        // Free text is omitted rather than mined for a digit. Leniency
        // here is what produced the "2.5" -> 25 corruption, and it now
        // costs nothing: the server treats the HOME's own bedroom count
        // as authoritative, so an omitted value resolves correctly.
        assertNull(PlaceDetailViewModel.parseBedrooms("2 bedrooms"))
    }

    // ── Defect 3: the route's 403 sentence reaches the resident ──

    @Test
    fun `the server's 403 sentence survives to the save error`() =
        runTest {
            val sentence =
                "Verify your address to add your rent — a benchmark is only real if the people in it live there."
            coEvery { repo.setRentReport(any(), any(), any()) } returns
                NetworkResult.Failure(
                    NetworkError.ClientError(403, """{"error":"$sentence","code":"VERIFICATION_REQUIRED"}"""),
                )
            val vm = makeVm()
            vm.setRentReport("2400", "2")
            assertEquals(sentence, vm.rentSaveError.value)
        }

    @Test
    fun `a bodiless 403 names the next step, not the canned permission line`() =
        runTest {
            coEvery { repo.setRentReport(any(), any(), any()) } returns NetworkResult.Failure(NetworkError.Forbidden)
            val vm = makeVm()
            vm.setRentReport("2400", "2")
            assertEquals(PlaceDetailViewModel.VERIFICATION_REQUIRED_MESSAGE, vm.rentSaveError.value)
            assertNotEquals(NetworkError.Forbidden.message, vm.rentSaveError.value)
        }

    private fun forbidden(): HttpException = HttpException(Response.error<Any>(403, """{"error":"go verify"}""".toResponseBody(null)))

    @Test
    fun `safeApiCall keeps the 403 body ONLY where the caller opts in`() =
        runTest {
            // Shared default — byte-for-byte the old behaviour, which is
            // what every other caller in the app still switches on.
            val default = safeApiCall<Unit> { throw forbidden() }
            assertTrue((default as NetworkResult.Failure).error is NetworkError.Forbidden)
            // Opted in — the Real Rent writes, and only those.
            val optedIn = safeApiCall<Unit>(surfaceForbiddenBody = true) { throw forbidden() }
            val error = (optedIn as NetworkResult.Failure).error
            assertTrue(error is NetworkError.ClientError)
            assertTrue(error.code == 403)
            assertEquals("go verify", error.message)
        }

    // ── Defect 5: the delete reports itself as in flight ─────────

    @Test
    fun `removing raises the in-flight flag for the whole request`() =
        runTest {
            val vm = makeVm()
            var inFlight = false
            coEvery { repo.removeRentReport("home-1") } coAnswers {
                inFlight = vm.isSavingRent.value
                NetworkResult.Success(RemoveRentReportResponse(removed = true))
            }
            assertFalse(vm.isSavingRent.value)
            vm.removeRentReport()
            assertTrue("the control must be disabled while the DELETE is in flight", inFlight)
            assertFalse(vm.isSavingRent.value)
        }

    @Test
    fun `a failed removal reports inline and never claims the figure is gone`() =
        runTest {
            coEvery { repo.removeRentReport(any()) } returns
                NetworkResult.Failure(NetworkError.ClientError(400, """{"error":"Could not remove your rent."}"""))
            val vm = makeVm()
            vm.removeRentReport()
            assertEquals("Could not remove your rent.", vm.rentSaveError.value)
            assertFalse(vm.isSavingRent.value)
        }

    // ── Defect 6: the saved contribution reads back as money ─────

    @Test
    fun `the saved contribution renders as money with its bedroom scope`() {
        assertEquals("$2,400 / mo · 2BR", savedRentLine(report()))
        assertEquals("$2,400 / mo · studio", savedRentLine(report(bedrooms = 0)))
        assertEquals("$2,400 / mo", savedRentLine(report(bedrooms = null)))
    }

    // ── Edit mode is a state, not a permanently-live field ───────

    @Test
    fun `edit mode opens on request and closes on a landed save`() =
        runTest {
            coEvery { repo.setRentReport(any(), any(), any()) } returns
                NetworkResult.Success(RentReportResponse(report()))
            val vm = makeVm()
            assertFalse(vm.isEditingRent.value)
            vm.beginEditingRent()
            assertTrue(vm.isEditingRent.value)
            vm.setRentReport("2400", "2")
            assertFalse(vm.isEditingRent.value)
        }

    // ── Defect 7: one standing wording across all three clients ──

    @Test
    fun `the standing chip reads Below In Above the band, with below as the good news`() {
        val below = requireNotNull(standingChip(RealRentStanding.BELOW_BAND))
        val inBand = requireNotNull(standingChip(RealRentStanding.IN_BAND))
        val above = requireNotNull(standingChip(RealRentStanding.ABOVE_BAND))
        assertEquals("Below the band", below.text)
        assertEquals("In the band", inBand.text)
        assertEquals("Above the band", above.text)
        // The viewer is a renter: under the band is good news, over it is
        // the actionable signal.
        assertEquals(PlaceChipTone.SUCCESS, below.tone)
        assertEquals(PlaceChipTone.NEUTRAL, inBand.tone)
        assertEquals(PlaceChipTone.WARNING, above.tone)
        // A vocabulary value this build has never heard of claims nothing.
        assertNull(standingChip(RealRentStanding.UNKNOWN))
        assertNull(standingChip(null))
    }

    // ── Defect 8: all three quartiles are labelled ───────────────

    @Test
    fun `the ready card labels every quartile and leads with the median`() {
        val data =
            PlaceRealRentData(
                state = RealRentState.READY,
                reports = 14,
                needed = 10,
                sampleSize = 14,
                rentP25 = 1980,
                rentMedian = 2180,
                rentP75 = 2420,
                summary = "14 verified reports — a median of $2,180/mo.",
            )
        assertEquals(
            listOf(
                "Lower quarter" to "$1,980",
                "Median" to "$2,180",
                "Upper quarter" to "$2,420",
            ),
            realRentQuartiles(data),
        )
    }

    @Test
    fun `a rejected save keeps the composer open with the message inline`() =
        runTest {
            coEvery { repo.setRentReport(any(), any(), any()) } returns
                NetworkResult.Failure(NetworkError.ClientError(400, """{"error":"That monthly rent looks off."}"""))
            val vm = makeVm()
            vm.beginEditingRent()
            vm.setRentReport("2400", "2")
            assertTrue("a rejection must never collapse the composer", vm.isEditingRent.value)
            assertEquals("That monthly rent looks off.", vm.rentSaveError.value)
        }
}
