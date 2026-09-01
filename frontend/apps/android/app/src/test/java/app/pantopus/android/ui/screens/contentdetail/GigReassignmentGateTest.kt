@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.contentdetail

import app.pantopus.android.data.api.models.gigs.GigDto
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Pre-start release gates: the poster's "Replace worker"
 * (`POST /reopen-bidding`) and the assigned worker's "Can't make it"
 * (`POST /worker-release`). Both must match the backend preconditions in
 * `backend/routes/gigs.js` so the affordance never shows where the server
 * would answer 400/403.
 */
class GigReassignmentGateTest {
    private fun gig(
        status: String = "assigned",
        acceptedBy: String? = "worker-1",
        startedAt: String? = null,
    ) = GigDto(
        id = "g1",
        title = "Task",
        status = status,
        userId = "owner-1",
        acceptedBy = acceptedBy,
        startedAt = startedAt,
    )

    @Test
    fun worker_release_gate_needs_assigned_worker_before_start() {
        assertTrue(GigDetailViewModel.workerCanRelease(gig(), "worker-1"))
        assertFalse("Poster is not the assigned worker", GigDetailViewModel.workerCanRelease(gig(), "owner-1"))
        assertFalse("Signed-out viewer", GigDetailViewModel.workerCanRelease(gig(), null))
        assertFalse(
            "In-progress task is past the exit",
            GigDetailViewModel.workerCanRelease(gig(status = "in_progress"), "worker-1"),
        )
        assertFalse(
            "started_at closes the window even while assigned",
            GigDetailViewModel.workerCanRelease(gig(startedAt = "2026-01-01T10:00:00Z"), "worker-1"),
        )
    }

    @Test
    fun replace_worker_gate_needs_poster_before_start() {
        assertTrue(GigDetailViewModel.ownerCanReplaceWorker(gig(), "owner-1"))
        assertFalse("Worker cannot replace themselves this way", GigDetailViewModel.ownerCanReplaceWorker(gig(), "worker-1"))
        assertFalse("Signed-out viewer", GigDetailViewModel.ownerCanReplaceWorker(gig(), null))
        assertFalse(
            "Open task has no worker to replace",
            GigDetailViewModel.ownerCanReplaceWorker(gig(status = "open", acceptedBy = null), "owner-1"),
        )
        assertFalse(
            "started_at closes the window even while assigned",
            GigDetailViewModel.ownerCanReplaceWorker(gig(startedAt = "2026-01-01T10:00:00Z"), "owner-1"),
        )
    }
}
