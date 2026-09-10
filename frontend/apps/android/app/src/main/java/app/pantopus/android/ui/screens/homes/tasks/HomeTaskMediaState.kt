package app.pantopus.android.ui.screens.homes.tasks

import app.pantopus.android.data.api.models.homes.HomeTaskMediaDto
import app.pantopus.android.data.homes.HomeTaskMediaBytes

data class TaskMediaSelection(val id: String, val localName: String, val size: Int)

data class TaskMediaPreview(val record: HomeTaskMediaDto, val content: HomeTaskMediaBytes)

data class TaskMediaProgress(
    val selection: TaskMediaSelection? = null,
    val attempted: Boolean = false,
    val removedUploadId: String? = null,
    val removing: HomeTaskMediaDto? = null,
)

data class HomeTaskMediaState(
    val visible: Boolean = false,
    val active: Boolean = false,
    val busy: Boolean = false,
    val confirmed: Boolean = false,
    val media: List<HomeTaskMediaDto> = emptyList(),
    val canUpload: Boolean = false,
    val progress: TaskMediaProgress = TaskMediaProgress(),
    val preview: TaskMediaPreview? = null,
    val error: String? = null,
    val notice: String? = null,
) {
    val pending get() = progress.selection
    val attempted get() = progress.attempted
    val removedUploadId get() = progress.removedUploadId
    val removing get() = progress.removing
    private val idle get() = visible && active && !busy
    private val emptyPending get() = pending == null && removing == null
    private val confirmedUpload get() = confirmed && canUpload
    private val noRemoval get() = removing == null && removedUploadId == null
    val mayChoose get() = idle && confirmedUpload && emptyPending
    val mayRetryUpload get() = idle && pending != null && noRemoval
    val mayDiscard get() = idle && pending != null && !attempted
    val mayAcknowledge get() = idle && removedUploadId != null && pending?.id == removedUploadId
    val mayRetryRemoval get() = idle && removing != null

    fun mayRemove(record: HomeTaskMediaDto) = mayChoose && record in media && record.removable

    internal fun withProgress(
        pending: TaskMediaSelection? = this.pending,
        attempted: Boolean = this.attempted,
        removedUploadId: String? = this.removedUploadId,
        removing: HomeTaskMediaDto? = this.removing,
    ) = copy(progress = TaskMediaProgress(pending, attempted, removedUploadId, removing))

    internal fun hidden(): HomeTaskMediaState {
        preview?.content?.bytes?.fill(0)
        return copy(confirmed = false, media = emptyList(), canUpload = false, preview = null)
    }
}
