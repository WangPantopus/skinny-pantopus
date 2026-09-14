package app.pantopus.android.ui.screens.homes

import app.pantopus.android.data.api.models.homedashboard.HomeDashboardAuthorityDto
import app.pantopus.android.data.api.models.homes.HomeAccessDto
import app.pantopus.android.data.homes.HomeDashboardAccessRepository
import app.pantopus.android.data.homes.HomeTasksRepository
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimReviewSnapshot
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimSessionScope
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimSessionScopeFactory
import app.pantopus.android.ui.screens.homes.tasks.HomeTaskAccess
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
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

    suspend fun read(): HomeDashboardAuthorityDto {
        session.requireCurrent()
        check(UUID.fromString(homeId).toString() == homeId) { "Invalid Home identity." }
        val response = repository.read(homeId)
        currentCoroutineContext().ensureActive()
        session.requireCurrent()
        check(response.homeId == homeId && HomeClaimReviewSnapshot.validToken(response.accessRevision)) {
            "Current Home authority could not be confirmed."
        }
        return response.copy(permissions = response.permissions.distinct().sorted())
    }
}

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
