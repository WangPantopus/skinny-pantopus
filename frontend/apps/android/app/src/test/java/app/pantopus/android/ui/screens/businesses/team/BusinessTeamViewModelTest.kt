@file:Suppress("PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.businesses.team

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.businesses.BusinessAccessDto
import app.pantopus.android.data.api.models.businesses.BusinessMemberPermissionsResponse
import app.pantopus.android.data.api.models.businesses.BusinessRolePresetDto
import app.pantopus.android.data.api.models.businesses.BusinessRolePresetsResponse
import app.pantopus.android.data.api.models.businesses.BusinessSeatDto
import app.pantopus.android.data.api.models.businesses.BusinessSeatsResponse
import app.pantopus.android.data.api.models.businesses.BusinessTeamMemberDto
import app.pantopus.android.data.api.models.businesses.BusinessTeamMembersResponse
import app.pantopus.android.data.api.models.businesses.BusinessTeamUserDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.businesses.BusinessTeamRepository
import app.pantopus.android.data.network.NetworkMonitor
import io.mockk.coEvery
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
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

/**
 * B2C — Business team & roles. Mirrors iOS `BusinessTeamViewModelTests`.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class BusinessTeamViewModelTest {
    private val repo: BusinessTeamRepository = mockk()
    private val networkMonitor: NetworkMonitor = mockk { every { isOnline } returns MutableStateFlow(true) }

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun makeVm(): BusinessTeamViewModel =
        BusinessTeamViewModel(
            repo = repo,
            networkMonitor = networkMonitor,
            savedStateHandle = SavedStateHandle(mapOf(BUSINESS_TEAM_ID_KEY to "biz_1")),
        )

    private val accessOwner =
        BusinessAccessDto(
            hasAccess = true,
            isOwner = true,
            roleBase = "owner",
            permissions = listOf("team.view", "team.manage", "team.invite"),
        )
    private val accessViewer =
        BusinessAccessDto(hasAccess = true, isOwner = false, roleBase = "viewer", permissions = listOf("team.view"))

    private fun user(
        id: String,
        name: String,
    ) = BusinessTeamUserDto(id = id, username = id, name = name, email = "$id@x.com")

    private val members =
        listOf(
            BusinessTeamMemberDto(id = "t_owner", roleBase = "owner", joinedAt = "2024-03-01T00:00:00Z", user = user("u_owner", "Maria")),
            BusinessTeamMemberDto(id = "t_admin", roleBase = "admin", joinedAt = "2025-01-15T00:00:00Z", user = user("u_admin", "Jamie")),
            BusinessTeamMemberDto(id = "t_editor", roleBase = "editor", joinedAt = "2025-06-01T00:00:00Z", user = user("u_editor", "Sam")),
        )

    private val seats =
        listOf(
            BusinessSeatDto(
                id = "s_pending",
                displayName = "Front Desk",
                roleBase = "viewer",
                inviteStatus = "pending",
                inviteEmail = "fd@x.com",
                createdAt = "2026-05-14T12:00:00Z",
            ),
            BusinessSeatDto(
                id = "s_accepted",
                displayName = "Bound",
                roleBase = "staff",
                inviteStatus = "accepted",
                inviteEmail = "acc@x.com",
                createdAt = "2025-01-01T00:00:00Z",
            ),
        )

    private val presets =
        listOf(
            BusinessRolePresetDto("business_admin", "Administrator", "Manages the team", "admin", "shield", 20),
            BusinessRolePresetDto("read_only", "Viewer", "Read-only", "viewer", "eye", 50),
        )

    private fun stubHappyPath(
        access: BusinessAccessDto = accessOwner,
        memberList: List<BusinessTeamMemberDto> = members,
        seatList: List<BusinessSeatDto> = seats,
    ) {
        coEvery { repo.access("biz_1") } returns NetworkResult.Success(access)
        coEvery { repo.members("biz_1") } returns NetworkResult.Success(BusinessTeamMembersResponse(memberList))
        coEvery { repo.seats("biz_1") } returns NetworkResult.Success(BusinessSeatsResponse(seatList))
        coEvery { repo.rolePresets("biz_1") } returns NetworkResult.Success(BusinessRolePresetsResponse(presets))
    }

    private fun loaded(vm: BusinessTeamViewModel): BusinessTeamContent {
        val state = vm.state.value
        assertTrue("Expected Loaded, got $state", state is BusinessTeamUiState.Loaded)
        return (state as BusinessTeamUiState.Loaded).content
    }

    @Test
    fun `load groups members by role owner to viewer`() =
        runTest {
            stubHappyPath()
            val vm = makeVm()
            vm.load()
            val content = loaded(vm)
            assertEquals(listOf(BusinessRole.Owner, BusinessRole.Admin, BusinessRole.Editor), content.sections.map { it.role })
            assertEquals("Maria", content.sections.first().rows.first().name)
        }

    @Test
    fun `pending keeps only pending seats`() =
        runTest {
            stubHappyPath()
            val vm = makeVm()
            vm.load()
            val content = loaded(vm)
            assertEquals(1, content.pending.size)
            assertEquals("s_pending", content.pending.first().seatId)
            assertEquals(BusinessRole.Viewer, content.pending.first().role)
        }

    @Test
    fun `members failure transitions to error`() =
        runTest {
            coEvery { repo.access("biz_1") } returns NetworkResult.Success(accessOwner)
            coEvery { repo.members("biz_1") } returns NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = makeVm()
            vm.load()
            assertTrue(vm.state.value is BusinessTeamUiState.Error)
        }

    @Test
    fun `access failure transitions to error`() =
        runTest {
            coEvery { repo.access("biz_1") } returns NetworkResult.Failure(NetworkError.Forbidden)
            val vm = makeVm()
            vm.load()
            assertTrue(vm.state.value is BusinessTeamUiState.Error)
        }

    @Test
    fun `empty members and seats transitions to empty`() =
        runTest {
            stubHappyPath(memberList = emptyList(), seatList = emptyList())
            val vm = makeVm()
            vm.load()
            val state = vm.state.value
            assertTrue(state is BusinessTeamUiState.Empty)
            assertTrue((state as BusinessTeamUiState.Empty).canInvite)
        }

    @Test
    fun `owner can manage and invite`() =
        runTest {
            stubHappyPath()
            val vm = makeVm()
            vm.load()
            val content = loaded(vm)
            assertTrue(content.canManage)
            assertTrue(content.canInvite)
            assertFalse(content.sections.first { it.role == BusinessRole.Owner }.rows.first().canManage)
            assertTrue(content.sections.first { it.role == BusinessRole.Admin }.rows.first().canManage)
        }

    @Test
    fun `viewer cannot manage or invite`() =
        runTest {
            stubHappyPath(access = accessViewer)
            val vm = makeVm()
            vm.load()
            val content = loaded(vm)
            assertFalse(content.canManage)
            assertFalse(content.canInvite)
            assertFalse(content.sections.first { it.role == BusinessRole.Admin }.rows.first().canManage)
            assertFalse(content.pending.first().canManage)
        }

    @Test
    fun `change role optimistically regroups`() =
        runTest {
            stubHappyPath()
            coEvery { repo.changeRole("biz_1", "u_admin", "read_only") } returns NetworkResult.Success(Unit)
            val vm = makeVm()
            vm.load()
            vm.changeRole("u_admin", presets.first { it.key == "read_only" })
            val content = loaded(vm)
            assertNull(content.sections.firstOrNull { it.role == BusinessRole.Admin })
            assertNotNull(content.sections.first { it.role == BusinessRole.Viewer }.rows.firstOrNull { it.userId == "u_admin" })
        }

    @Test
    fun `change role failure rolls back`() =
        runTest {
            stubHappyPath()
            coEvery { repo.changeRole("biz_1", "u_admin", "read_only") } returns NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = makeVm()
            vm.load()
            vm.changeRole("u_admin", presets.first { it.key == "read_only" })
            val content = loaded(vm)
            assertNotNull(content.sections.first { it.role == BusinessRole.Admin }.rows.firstOrNull { it.userId == "u_admin" })
            assertNull(content.sections.firstOrNull { it.role == BusinessRole.Viewer })
        }

    @Test
    fun `remove optimistically removes row`() =
        runTest {
            stubHappyPath()
            coEvery { repo.removeMember("biz_1", "u_editor") } returns NetworkResult.Success(Unit)
            val vm = makeVm()
            vm.load()
            vm.remove("u_editor")
            val content = loaded(vm)
            assertNull(content.sections.firstOrNull { it.role == BusinessRole.Editor })
        }

    @Test
    fun `remove failure rolls back`() =
        runTest {
            stubHappyPath()
            coEvery { repo.removeMember("biz_1", "u_editor") } returns NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = makeVm()
            vm.load()
            vm.remove("u_editor")
            val content = loaded(vm)
            assertNotNull(content.sections.firstOrNull { it.role == BusinessRole.Editor })
        }

    @Test
    fun `cancel invite optimistically removes pending`() =
        runTest {
            stubHappyPath()
            coEvery { repo.cancelSeat("biz_1", "s_pending") } returns NetworkResult.Success(Unit)
            val vm = makeVm()
            vm.load()
            vm.cancelInvite("s_pending")
            assertTrue(loaded(vm).pending.isEmpty())
        }

    @Test
    fun `cancel invite failure rolls back`() =
        runTest {
            stubHappyPath()
            coEvery { repo.cancelSeat("biz_1", "s_pending") } returns NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = makeVm()
            vm.load()
            vm.cancelInvite("s_pending")
            assertEquals(1, loaded(vm).pending.size)
        }

    @Test
    fun `handle invited folds pending at top`() =
        runTest {
            stubHappyPath()
            val vm = makeVm()
            vm.load()
            vm.handleInvited(
                BusinessSeatDto(
                    id = "s_new",
                    displayName = "New Hire",
                    roleBase = "staff",
                    inviteStatus = "pending",
                    inviteEmail = "new@x.com",
                ),
            )
            val content = loaded(vm)
            assertEquals("s_new", content.pending.first().seatId)
            assertEquals(2, content.pending.size)
        }

    @Test
    fun `member permissions surfaces list`() =
        runTest {
            coEvery { repo.memberPermissions("biz_1", "u_admin") } returns
                NetworkResult.Success(BusinessMemberPermissionsResponse(permissions = listOf("profile.edit"), roleBase = "admin"))
            val vm = makeVm()
            val result = vm.memberPermissions("u_admin")
            assertEquals(listOf("profile.edit"), result.getOrNull())
        }

    @Test
    fun `display name falls back to username then email`() {
        val withName = BusinessTeamMemberDto(id = "1", roleBase = "staff", user = BusinessTeamUserDto(id = "u", name = "Real Name"))
        assertEquals("Real Name", BusinessTeamViewModel.displayName(withName))

        val usernameOnly = BusinessTeamMemberDto(id = "2", roleBase = "staff", user = BusinessTeamUserDto(id = "u", username = "handle"))
        assertEquals("@handle", BusinessTeamViewModel.displayName(usernameOnly))

        val emailOnly = BusinessTeamMemberDto(id = "3", roleBase = "staff", user = BusinessTeamUserDto(id = "u", email = "only@x.com"))
        assertEquals("only@x.com", BusinessTeamViewModel.displayName(emailOnly))
    }

    @Test
    fun `role parse and rank`() {
        assertEquals(BusinessRole.Admin, BusinessRole.parse("admin"))
        assertEquals(BusinessRole.Viewer, BusinessRole.parse("unknown"))
        assertEquals(BusinessRole.Viewer, BusinessRole.parse(null))
        assertTrue(BusinessRole.Owner.rank > BusinessRole.Admin.rank)
        assertTrue(BusinessRole.Admin.rank > BusinessRole.Viewer.rank)
    }
}
