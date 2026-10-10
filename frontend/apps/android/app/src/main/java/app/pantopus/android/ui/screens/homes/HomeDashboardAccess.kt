package app.pantopus.android.ui.screens.homes

import app.pantopus.android.data.api.models.homedashboard.HomeDashboardAuthorityDto
import app.pantopus.android.data.api.models.homes.HomeAccessDto
import app.pantopus.android.data.homes.HomeDashboardAccessRepository
import app.pantopus.android.data.homes.HomeTasksRepository
import app.pantopus.android.data.store.Stored
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimReviewSnapshot
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimSessionScope
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimSessionScopeFactory
import app.pantopus.android.ui.screens.homes.tasks.HomeTaskAccess
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import java.time.Instant
import java.util.UUID
import javax.inject.Inject

class HomeDashboardAccessFactory
    @Inject
    constructor(
        private val repository: HomeDashboardAccessRepository,
        private val tasks: HomeTasksRepository,
        private val sessions: HomeClaimSessionScopeFactory,
    ) {
        fun create(
            homeId: String,
            scope: CoroutineScope,
        ): HomeDashboardAccess = HomeDashboardAccess(homeId, repository, tasks, sessions.create(scope))
    }

class HomeDashboardAccess(
    private val homeId: String,
    private val repository: HomeDashboardAccessRepository,
    private val tasks: HomeTasksRepository,
    private val session: HomeClaimSessionScope,
) {
    val isCurrent get() = session.isCurrent
    val invalidated get() = session.invalidated

    /** A fresh exact collection capability in the same captured account/session. */
    suspend fun readTasks() = HomeTaskAccess(homeId, tasks, session).list()

    /** [readTasks] through the screens' store (Instant Screens); [force] reads now. */
    suspend fun readTasksStored(force: Boolean) = HomeTaskAccess(homeId, tasks, session).listStored(force)

    /** The stored task list, without a request, when it checks out. */
    fun storedTasks() = HomeTaskAccess(homeId, tasks, session).storedList()

    /**
     * [read] through the screens' store (Instant Screens): a fresh copy answers without a request, [force] reads now.
     * A copy is checked like a reply. No data with a 403 means no access: [read] keeps the server's typed refusal.
     */
    suspend fun readStored(force: Boolean): Stored<HomeDashboardAuthorityDto> {
        session.requireCurrent()
        check(UUID.fromString(homeId).toString() == homeId) { "Invalid Home identity." }
        val stored = repository.readStored(homeId, force)
        currentCoroutineContext().ensureActive()
        session.requireCurrent()
        val response = stored.data ?: return stored
        check(confirmed(response)) { "Current Home authority could not be confirmed." }
        return stored.copy(data = response.copy(permissions = response.permissions.distinct().sorted()))
    }

    /** The stored authority without a request, when it checks out like a reply; null otherwise. */
    fun storedAuthority(): HomeDashboardAuthorityDto? =
        repository.storedAuthority(homeId)?.takeIf(::confirmed)?.let { it.copy(permissions = it.permissions.distinct().sorted()) }

    private fun confirmed(response: HomeDashboardAuthorityDto): Boolean =
        response.homeId == homeId &&
            HomeClaimReviewSnapshot.validToken(response.accessRevision) &&
            response.expiryMillis()?.let { it > System.currentTimeMillis() } != false

    suspend fun read(): HomeDashboardAuthorityDto {
        session.requireCurrent()
        check(UUID.fromString(homeId).toString() == homeId) { "Invalid Home identity." }
        val response = repository.read(homeId)
        currentCoroutineContext().ensureActive()
        session.requireCurrent()
        check(response.homeId == homeId && HomeClaimReviewSnapshot.validToken(response.accessRevision)) {
            "Current Home authority could not be confirmed."
        }
        check(response.expiryMillis()?.let { it > System.currentTimeMillis() } != false) {
            "Home access expired."
        }
        return response.copy(permissions = response.permissions.distinct().sorted())
    }
}

internal fun HomeDashboardAuthorityDto.expiryMillis(): Long? = accessExpiresAt?.let { Instant.parse(it).toEpochMilli() }

internal fun HomeDashboardAuthorityDto.sharedAccess(): HomeAccessDto? =
    if (hasAccess && "home.view" in permissions) {
        HomeAccessDto(hasAccess = true, isOwner = isOwner == true, roleBase = roleBase, permissions = permissions)
    } else {
        null
    }

internal fun HomeDashboardAuthorityDto.currentVerificationKind(): String? =
    verificationKind?.takeIf {
        !hasAccess && verificationRequired && it in setOf("ownership", "residency") &&
            verificationStatus in
            setOf(
                "unverified", "provisional", "provisional_bootstrap", "pending_doc", "pending_postcard",
                "pending_approval", "pending", "none",
            )
    }
