@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.add_home

import app.pantopus.android.data.homes.HomeCreationCodec
import app.pantopus.android.data.homes.HomeCreationOutcome
import app.pantopus.android.data.homes.HomeCreationScope
import app.pantopus.android.data.homes.PendingHomeCreation
import app.pantopus.android.data.homes.PendingHomeCreationStore
import com.squareup.moshi.Moshi

/** Synthetic storage/transport for existing wizard checks; installed acceptance uses the actual API. */
internal class HomeCreationTestFixture {
    val codec = HomeCreationCodec(Moshi.Builder().build())
    val scope = HomeCreationScope("http://127.0.0.1:18084/", "ddc24200-0000-4000-8000-000000000001")
    var saved: PendingHomeCreation? = null
    var failTransport = false
    var failRead = false
    var failWrite = false
    var response: (PendingHomeCreation, HomeCreationAction) -> HomeCreationOutcome = { draft, _ -> completed(draft) }
    val calls = mutableListOf<Pair<HomeCreationAction, PendingHomeCreation>>()
    val store =
        object : PendingHomeCreationStore {
            override suspend fun read(scope: HomeCreationScope): PendingHomeCreation? {
                check(!failRead)
                return saved
            }

            override suspend fun replace(
                scope: HomeCreationScope,
                expected: PendingHomeCreation?,
                next: PendingHomeCreation?,
            ) {
                check(!failWrite && saved == expected)
                saved = next
            }
        }

    fun coordinator(requireCurrent: suspend () -> Unit = {}): HomeCreationCoordinator =
        HomeCreationCoordinator(
            scope,
            store,
            codec,
            { draft, action ->
                calls.add(action to draft)
                check(!failTransport) { "The original Home request could not be confirmed." }
                response(draft, action)
            },
            requireCurrent,
        )

    fun completed(draft: PendingHomeCreation): HomeCreationOutcome {
        val request = codec.request(draft)
        return HomeCreationOutcome(
            state = "completed",
            command = HomeCreationOutcome.Command(scope.actorId, draft.requestId, "2026-09-11T12:00:00Z", "2026-09-11T12:00:01Z"),
            home = HomeCreationOutcome.Home(HOME_ID),
            ownershipClaimId = if (request.role == "owner") "ddc24200-0000-4000-8000-000000000002" else null,
            accessSecretIds =
                request.accessSecrets.orEmpty().mapIndexed {
                        index,
                        _,
                    ->
                    "ddc24200-0000-4000-8000-${(index + 10).toString().padStart(12, '0')}"
                },
            role = request.role, requiresVerification = true,
            verificationType = if (request.role == "owner") "ownership" else "residency",
            currentAccess = "not_checked",
        )
    }

    companion object {
        const val HOME_ID = "ddc24200-0000-4000-8000-000000000003"
    }
}
