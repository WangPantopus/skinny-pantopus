@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.maintenance

import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

/**
 * P2.9 — Session-scoped store for the maintenance form's *extras* the
 * current backend schema (`HomeMaintenanceLog`) doesn't yet persist:
 * photos, receipt, notes, performed-by category, and the category enum
 * the user picked in the form.
 *
 * The detail screen reads the matching draft (keyed by the
 * server-returned task id) so a freshly-logged maintenance entry
 * surfaces its photos + notes + receipt in the 2×2 grid the design
 * specifies. When the app process restarts the drafts are dropped —
 * that's acceptable because these fields aren't part of the backend
 * contract today; the next refresh from the server will return the
 * canonical row without them.
 *
 * When the backend grows columns for these fields, the consumers will
 * flip to reading them off [MaintenanceTaskDto] directly and this
 * store can be deleted in one diff.
 */

/** One captured photo or receipt file, kept entirely in-memory. */
data class MaintenanceDraftFile(
    val id: String = UUID.randomUUID().toString(),
    val filename: String,
    val mimeType: String,
    val bytes: ByteArray,
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is MaintenanceDraftFile) return false
        return id == other.id &&
            filename == other.filename &&
            mimeType == other.mimeType &&
            bytes.contentEquals(other.bytes)
    }

    override fun hashCode(): Int {
        var result = id.hashCode()
        result = 31 * result + filename.hashCode()
        result = 31 * result + mimeType.hashCode()
        result = 31 * result + bytes.contentHashCode()
        return result
    }
}

/** Whether the user said this maintenance was done by self / member /
 *  contractor. Persisted only in the draft store. */
enum class MaintenancePerformedBy {
    Self,
    Member,
    Contractor,
}

/** One in-flight or recently-submitted maintenance draft. */
data class MaintenanceDraft(
    val category: MaintenanceCategory = MaintenanceCategory.Generic,
    val performedBy: MaintenancePerformedBy = MaintenancePerformedBy.Self,
    val performerName: String = "",
    val performerContact: String = "",
    val notes: String = "",
    val photos: List<MaintenanceDraftFile> = emptyList(),
    val receipt: MaintenanceDraftFile? = null,
)

@Singleton
class MaintenanceDraftStore
    @Inject
    constructor() {
        private val drafts: MutableMap<String, MaintenanceDraft> = mutableMapOf()

        fun draft(id: String): MaintenanceDraft? = drafts[id]

        fun upsert(
            id: String,
            draft: MaintenanceDraft,
        ) {
            drafts[id] = draft
        }

        fun remove(id: String) {
            drafts.remove(id)
        }

        fun clear() {
            drafts.clear()
        }
    }
