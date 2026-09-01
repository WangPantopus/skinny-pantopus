@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.homes.claims

import app.pantopus.android.data.api.models.homes.MyOwnershipClaimsResponse
import app.pantopus.android.data.api.models.homes.OwnershipClaimDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.ui.components.StatusChipVariant
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsUiState
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTrailing
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
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class MyClaimsListViewModelTest {
    private val repo: HomesRepository = mockk()

    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun makeClaim(
        id: String = "claim-abcd1234",
        status: String = "under_review",
    ) = OwnershipClaimDto(
        id = id,
        homeId = "h1",
        claimType = "owner",
        method = "doc_upload",
        status = status,
        createdAt = "2025-05-08T12:00:00Z",
        updatedAt = "2025-05-08T12:00:00Z",
    )

    @Test fun empty_response_renders_empty_state() =
        runTest {
            coEvery { repo.myOwnershipClaims() } returns
                NetworkResult.Success(MyOwnershipClaimsResponse(claims = emptyList()))
            val vm = MyClaimsListViewModel(repo)
            vm.load()
            val state = vm.state.value
            assertTrue(state is ListOfRowsUiState.Empty)
            assertEquals("No claims yet", (state as ListOfRowsUiState.Empty).headline)
        }

    @Test fun loaded_response_maps_to_status_chip_row() =
        runTest {
            coEvery { repo.myOwnershipClaims() } returns
                NetworkResult.Success(MyOwnershipClaimsResponse(claims = listOf(makeClaim())))
            val vm = MyClaimsListViewModel(repo)
            vm.load()
            val state = vm.state.value
            assertTrue(state is ListOfRowsUiState.Loaded)
            val loaded = state as ListOfRowsUiState.Loaded
            assertEquals(1, loaded.sections[0].rows.size)
            val row = loaded.sections[0].rows[0]
            assertEquals("claim-abcd1234", row.id)
            assertTrue(row.title.startsWith("Claim "))
            val trailing = row.trailing
            assertTrue(trailing is RowTrailing.Status)
            assertEquals("Under review", (trailing as RowTrailing.Status).text)
            assertEquals(StatusChipVariant.Info, trailing.variant)
        }

    @Test fun verified_status_uses_success_variant() =
        runTest {
            coEvery { repo.myOwnershipClaims() } returns
                NetworkResult.Success(MyOwnershipClaimsResponse(listOf(makeClaim(status = "verified"))))
            val vm = MyClaimsListViewModel(repo)
            vm.load()
            val state = vm.state.value as ListOfRowsUiState.Loaded
            val trailing = state.sections[0].rows[0].trailing as RowTrailing.Status
            assertEquals("Verified", trailing.text)
            assertEquals(StatusChipVariant.Success, trailing.variant)
        }

    @Test fun rejected_status_uses_error_variant() =
        runTest {
            coEvery { repo.myOwnershipClaims() } returns
                NetworkResult.Success(MyOwnershipClaimsResponse(listOf(makeClaim(status = "rejected"))))
            val vm = MyClaimsListViewModel(repo)
            vm.load()
            val state = vm.state.value as ListOfRowsUiState.Loaded
            val trailing = state.sections[0].rows[0].trailing as RowTrailing.Status
            assertEquals("Not approved", trailing.text)
            assertEquals(StatusChipVariant.ErrorVariant, trailing.variant)
        }

    @Test fun failure_renders_error_state() =
        runTest {
            coEvery { repo.myOwnershipClaims() } returns
                NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = MyClaimsListViewModel(repo)
            vm.load()
            assertTrue(vm.state.value is ListOfRowsUiState.Error)
        }
}
