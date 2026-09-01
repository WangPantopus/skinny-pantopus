@file:Suppress("MagicNumber", "PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.identity_center

import app.pantopus.android.data.api.models.identity.AudienceProfileDto
import app.pantopus.android.data.api.models.identity.BlockCountsDto
import app.pantopus.android.data.api.models.identity.BridgesDto
import app.pantopus.android.data.api.models.identity.BridgesEchoResponse
import app.pantopus.android.data.api.models.identity.BusinessIdentityDto
import app.pantopus.android.data.api.models.identity.HomeIdentityDto
import app.pantopus.android.data.api.models.identity.IdentityCenterResponse
import app.pantopus.android.data.api.models.identity.LocalProfileDto
import app.pantopus.android.data.api.models.identity.PrivateAccountDto
import app.pantopus.android.data.api.models.identity.UpdateBridgesBody
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.identity.IdentityCenterRepository
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
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * Mirrors the iOS [IdentityCenterViewModelTests]:
 * - load() projects all four cards, bridges, privacy + disclosure rows.
 * - setBridge() applies optimistically; success keeps it; failure rolls
 *   back to the previous value.
 * - When the audience profile is missing, the Public-profile card
 *   carries a SetupNeeded CTA and bridges collapse to empty.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class IdentityCenterViewModelTest {
    private val repository: IdentityCenterRepository = mockk()

    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun fullResponse(
        showPersonaOnLocal: Boolean = false,
        showLocalOnPersona: Boolean = false,
    ): IdentityCenterResponse =
        IdentityCenterResponse(
            privateAccount =
                PrivateAccountDto(
                    id = "u1",
                    email = "maria@pantopus.app",
                    name = "Maria K.",
                    verified = true,
                ),
            localProfile =
                LocalProfileDto(
                    id = "lp1",
                    handle = "maria.k",
                    displayName = "Maria K.",
                    postCount = 47,
                    connectionCount = 23,
                    verified = true,
                ),
            audienceProfile =
                AudienceProfileDto(
                    id = "ap1",
                    handle = "mariathemason",
                    displayName = "Maria the Mason",
                    followerCount = 1_247,
                    postCadence = "weekly",
                    status = "live",
                ),
            bridges =
                BridgesDto(
                    showPersonaOnLocal = showPersonaOnLocal,
                    showLocalOnPersona = showLocalOnPersona,
                ),
            homes = listOf(HomeIdentityDto(id = "h1", name = "Maple Street")),
            businessProfiles =
                listOf(
                    BusinessIdentityDto(id = "b1", displayName = "Maria Masonry", isActive = true),
                    BusinessIdentityDto(id = "b2", displayName = "Side Hustle Co", isActive = true),
                ),
            personaCount = 1,
            blockCounts = BlockCountsDto(personal = 2, audience = 5),
        )

    @Test fun load_projects_all_four_cards_and_rows() =
        runTest {
            coEvery { repository.overview() } returns NetworkResult.Success(fullResponse())
            val vm = IdentityCenterViewModel(repository)
            vm.load()
            val loaded = vm.state.value as IdentityCenterUiState.Loaded
            assertEquals(4, loaded.content.identities.size)
            assertEquals(
                listOf(IdentityKind.Local, IdentityKind.Personal, IdentityKind.PublicProfile, IdentityKind.Professional),
                loaded.content.identities.map { it.kind },
            )
            assertEquals(2, loaded.content.bridges.size)
            assertEquals("showPublicOnLocal", loaded.content.bridges[0].id)
            assertEquals("showLocalOnPublic", loaded.content.bridges[1].id)
            assertEquals(3, loaded.content.privacyRows.size)
            assertEquals(3, loaded.content.disclosureRows.size)
            // BlockCounts trickle into trailing values.
            val blockedPersonal = loaded.content.privacyRows.first { it.id == "blockedPersonal" }
            assertEquals("2", blockedPersonal.trailing)
            val businessRow = loaded.content.disclosureRows.first { it.id == "businessProfiles" }
            assertEquals("2", businessRow.trailing)
            val homesRow = loaded.content.disclosureRows.first { it.id == "homes" }
            assertEquals("1 connected", homesRow.trailing)
        }

    @Test fun missing_audience_profile_yields_setup_card_and_no_bridges() =
        runTest {
            val response = fullResponse().copy(audienceProfile = null, personaCount = 0)
            coEvery { repository.overview() } returns NetworkResult.Success(response)
            val vm = IdentityCenterViewModel(repository)
            vm.load()
            val loaded = vm.state.value as IdentityCenterUiState.Loaded
            val publicCard = loaded.content.identities.first { it.kind == IdentityKind.PublicProfile }
            assertTrue(publicCard.status is IdentityStatus.SetupNeeded)
            assertEquals("Create", (publicCard.status as IdentityStatus.SetupNeeded).cta)
            assertTrue(loaded.content.bridges.isEmpty())
        }

    @Test fun missing_local_profile_yields_setup_card() =
        runTest {
            val response = fullResponse().copy(localProfile = null)
            coEvery { repository.overview() } returns NetworkResult.Success(response)
            val vm = IdentityCenterViewModel(repository)
            vm.load()
            val loaded = vm.state.value as IdentityCenterUiState.Loaded
            val localCard = loaded.content.identities.first { it.kind == IdentityKind.Local }
            assertTrue(localCard.status is IdentityStatus.SetupNeeded)
            assertEquals("Set up", (localCard.status as IdentityStatus.SetupNeeded).cta)
        }

    @Test fun setBridge_success_persists_optimistic_value() =
        runTest {
            coEvery { repository.overview() } returns NetworkResult.Success(fullResponse())
            coEvery { repository.updateBridges(any<String>(), any<UpdateBridgesBody>()) } returns
                NetworkResult.Success(BridgesEchoResponse(bridge = BridgesDto(showPersonaOnLocal = true, showLocalOnPersona = false)))
            val vm = IdentityCenterViewModel(repository)
            vm.load()
            vm.setBridge("showPublicOnLocal", isOn = true)
            val loaded = vm.state.value as IdentityCenterUiState.Loaded
            val row = loaded.content.bridges.first { it.id == "showPublicOnLocal" }
            assertTrue(row.isOn)
        }

    @Test fun setBridge_failure_rolls_back_to_previous_value() =
        runTest {
            coEvery { repository.overview() } returns NetworkResult.Success(fullResponse())
            coEvery { repository.updateBridges(any<String>(), any<UpdateBridgesBody>()) } returns
                NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = IdentityCenterViewModel(repository)
            vm.load()
            vm.setBridge("showLocalOnPublic", isOn = true)
            val loaded = vm.state.value as IdentityCenterUiState.Loaded
            val row = loaded.content.bridges.first { it.id == "showLocalOnPublic" }
            assertEquals(false, row.isOn)
        }

    @Test fun load_failure_transitions_error() =
        runTest {
            coEvery { repository.overview() } returns NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = IdentityCenterViewModel(repository)
            vm.load()
            assertTrue(vm.state.value is IdentityCenterUiState.Error)
            assertNotNull((vm.state.value as IdentityCenterUiState.Error).message)
        }

    @Test fun overview_with_no_audience_uses_activate_cta_when_persona_count_positive() =
        runTest {
            val response = fullResponse().copy(audienceProfile = null, personaCount = 2)
            coEvery { repository.overview() } returns NetworkResult.Success(response)
            val vm = IdentityCenterViewModel(repository)
            vm.load()
            val loaded = vm.state.value as IdentityCenterUiState.Loaded
            val publicCard = loaded.content.identities.first { it.kind == IdentityKind.PublicProfile }
            assertEquals("Activate", (publicCard.status as IdentityStatus.SetupNeeded).cta)
        }

    @Test fun homes_empty_yields_not_connected_label() =
        runTest {
            val response = fullResponse().copy(homes = emptyList())
            coEvery { repository.overview() } returns NetworkResult.Success(response)
            val vm = IdentityCenterViewModel(repository)
            vm.load()
            val loaded = vm.state.value as IdentityCenterUiState.Loaded
            val homesRow = loaded.content.disclosureRows.first { it.id == "homes" }
            assertEquals("Not connected", homesRow.trailing)
        }

    @Test fun setBridge_with_unknown_row_id_is_a_noop() =
        runTest {
            coEvery { repository.overview() } returns NetworkResult.Success(fullResponse())
            val vm = IdentityCenterViewModel(repository)
            vm.load()
            val before = vm.state.value
            vm.setBridge("unknownRow", isOn = true)
            // State should not have advanced.
            assertEquals(before, vm.state.value)
        }

    @Test fun professional_card_uses_setup_when_no_business_profiles() =
        runTest {
            val response = fullResponse().copy(businessProfiles = emptyList())
            coEvery { repository.overview() } returns NetworkResult.Success(response)
            val vm = IdentityCenterViewModel(repository)
            vm.load()
            val loaded = vm.state.value as IdentityCenterUiState.Loaded
            val card = loaded.content.identities.first { it.kind == IdentityKind.Professional }
            assertTrue(card.status is IdentityStatus.SetupNeeded)
            assertEquals("Add", (card.status as IdentityStatus.SetupNeeded).cta)
            val businessRow = loaded.content.disclosureRows.first { it.id == "businessProfiles" }
            assertEquals("0", businessRow.trailing)
        }

    @Test fun public_profile_card_shows_live_chip_when_status_live() =
        runTest {
            coEvery { repository.overview() } returns NetworkResult.Success(fullResponse())
            val vm = IdentityCenterViewModel(repository)
            vm.load()
            val loaded = vm.state.value as IdentityCenterUiState.Loaded
            val publicCard = loaded.content.identities.first { it.kind == IdentityKind.PublicProfile }
            assertNotNull(publicCard.chip)
            assertEquals("Live", publicCard.chip?.label)
            assertEquals(IdentityChip.Tone.Success, publicCard.chip?.tone)
        }

    @Test fun loading_state_is_emitted_first() =
        runTest {
            coEvery { repository.overview() } returns NetworkResult.Success(fullResponse())
            val vm = IdentityCenterViewModel(repository)
            assertTrue(vm.state.value is IdentityCenterUiState.Loading)
            vm.load()
            assertTrue(vm.state.value is IdentityCenterUiState.Loaded)
        }

    @Test fun bridge_subtext_is_present_on_both_rows() =
        runTest {
            coEvery { repository.overview() } returns NetworkResult.Success(fullResponse())
            val vm = IdentityCenterViewModel(repository)
            vm.load()
            val loaded = vm.state.value as IdentityCenterUiState.Loaded
            loaded.content.bridges.forEach { row -> assertNotNull(row.subtext) }
        }

    @Test fun setBridge_sends_both_booleans_to_satisfy_backend_validation() =
        runTest {
            // Backend Joi schema marks BOTH `show_persona_on_local` and
            // `show_local_on_persona` as required(). Verify we send the
            // current snapshot for the untouched key, not a null.
            coEvery { repository.overview() } returns
                NetworkResult.Success(fullResponse(showPersonaOnLocal = false, showLocalOnPersona = true))
            val captured = slot<UpdateBridgesBody>()
            coEvery { repository.updateBridges(any(), capture(captured)) } returns
                NetworkResult.Success(BridgesEchoResponse(bridge = null))
            val vm = IdentityCenterViewModel(repository)
            vm.load()
            vm.setBridge("showPublicOnLocal", isOn = true)
            assertEquals(true, captured.captured.showPersonaOnLocal)
            assertEquals(true, captured.captured.showLocalOnPersona) // preserved from snapshot
        }

    @Test fun privacy_preview_row_has_no_trailing() =
        runTest {
            coEvery { repository.overview() } returns NetworkResult.Success(fullResponse())
            val vm = IdentityCenterViewModel(repository)
            vm.load()
            val loaded = vm.state.value as IdentityCenterUiState.Loaded
            val previewRow = loaded.content.privacyRows.first { it.id == "privacyPreview" }
            assertNull(previewRow.trailing)
        }
}
