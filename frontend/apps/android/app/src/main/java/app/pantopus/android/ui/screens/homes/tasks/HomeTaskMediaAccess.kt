package app.pantopus.android.ui.screens.homes.tasks

import app.pantopus.android.data.api.models.homes.HomeTaskMediaDto
import app.pantopus.android.data.api.models.homes.HomeTaskMediaList
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HOME_EVIDENCE_MAX_BYTES
import app.pantopus.android.data.homes.HOME_EVIDENCE_MIMES
import app.pantopus.android.data.homes.HomeTaskMediaBytes
import app.pantopus.android.data.homes.HomeTaskMediaRepository
import kotlinx.coroutines.CoroutineScope
import javax.inject.Inject

private const val MEDIA_CHANGED = "The attachment changed. Reload its current details."
internal val TASK_MEDIA_UUID = Regex("^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$")

class HomeTaskMediaAccessFactory
    @Inject
    constructor(
        private val tasks: HomeTaskAccessFactory,
        private val repository: HomeTaskMediaRepository,
    ) {
        fun create(
            homeId: String,
            taskId: String,
            scope: CoroutineScope,
        ) = HomeTaskMediaAccess(homeId, taskId, tasks.create(homeId, scope), repository)
    }

/** Created with task detail's opening identity, before any suspended media read. */
class HomeTaskMediaAccess(
    private val homeId: String,
    private val taskId: String,
    private val tasks: HomeTaskAccess,
    private val repository: HomeTaskMediaRepository,
) {
    val invalidated get() = tasks.invalidated
    val isCurrent get() = tasks.isCurrent
    private var mutating = false

    suspend fun requireCurrent() = tasks.requireCurrent()

    suspend fun list(): HomeTaskMediaList {
        tasks.read(taskId)
        val result = repository.list(tasks.currentSession(), taskId).mediaValue()
        tasks.requireCurrent()
        val current = tasks.read(taskId)
        result.media.forEach(::validate)
        check(result.media.map { it.id }.toSet().size == result.media.size) { MEDIA_CHANGED }
        return result.copy(canUpload = result.canUpload && current.capabilities?.canUpload == true)
    }

    internal suspend fun upload(pending: PendingTaskMediaUpload): HomeTaskMediaDto {
        check(!mutating) { "An attachment action is already running." }
        mutating = true
        try {
            check(list().canUpload) { TASK_ACCESS_CHANGED }
            val bytes = pending.copyBytes()
            val response =
                try {
                    repository.upload(tasks.currentSession(), taskId, pending.id, pending.serverFilename, pending.mimeType, bytes)
                        .mediaValue()
                } catch (error: NetworkError) {
                    throw HomeTaskMediaUploadFailure(error)
                } finally {
                    bytes.fill(0)
                }
            tasks.requireCurrent()
            val record = response.media.singleOrNull()
            check(record != null) { MEDIA_CHANGED }
            validate(record)
            check(record.id == pending.id && record.uploadedBy == tasks.actorId) { MEDIA_CHANGED }
            check(record.fileName == pending.serverFilename) { MEDIA_CHANGED }
            check(record.mimeType == pending.mimeType && record.fileSize == pending.size.toLong()) { MEDIA_CHANGED }
            check(record.state == "ready" && record.available) { MEDIA_CHANGED }
            check(list().media.contains(record)) { MEDIA_CHANGED }
            return record
        } finally {
            mutating = false
        }
    }

    suspend fun read(record: HomeTaskMediaDto): HomeTaskMediaBytes {
        requireDownload(record, list())
        val download = repository.download(tasks.currentSession(), taskId, record.id).mediaValue()
        var delivered = false
        try {
            tasks.requireCurrent()
            requireDownload(record, list())
            check(download.bytes.size.toLong() == record.fileSize && download.mimeType == record.mimeType) { MEDIA_CHANGED }
            delivered = true
            return download
        } finally {
            if (!delivered) download.bytes.fill(0)
        }
    }

    suspend fun remove(record: HomeTaskMediaDto): HomeTaskMediaDto {
        check(!mutating) { "An attachment action is already running." }
        mutating = true
        try {
            val before = list()
            check(before.canUpload) { TASK_ACCESS_CHANGED }
            validate(record)
            check(record.state != "legacy") { MEDIA_CHANGED }
            before.media.singleOrNull { it.id == record.id }?.let { check(it.sameFile(record)) { MEDIA_CHANGED } }
            val result = repository.remove(tasks.currentSession(), taskId, record.id).mediaValue().media
            tasks.requireCurrent()
            requireRemoved(result, record)
            val after = list()
            after.media.singleOrNull { it.id == record.id }?.let { requireRemoved(it, record) }
            return result
        } finally {
            mutating = false
        }
    }

    private fun requireRemoved(
        current: HomeTaskMediaDto,
        original: HomeTaskMediaDto,
    ) {
        check(current.sameFile(original) && current.state == "retired") { MEDIA_CHANGED }
        check(!current.available && current.cleanupPending == false) { "Attachment cleanup is unconfirmed. Retry removal." }
    }

    private fun requireDownload(
        record: HomeTaskMediaDto,
        list: HomeTaskMediaList,
    ) {
        check(record.available && record.state == "ready" && list.media.contains(record)) { MEDIA_CHANGED }
    }

    private fun validate(record: HomeTaskMediaDto) {
        check(record.homeId == homeId && record.taskId == taskId && TASK_MEDIA_UUID.matches(record.id)) { MEDIA_CHANGED }
        check(record.fileName.isNotBlank() && record.fileSize >= 0) { MEDIA_CHANGED }
        check(record.state in setOf("reserved", "ready", "retired", "legacy")) { MEDIA_CHANGED }
        if (record.available) {
            check(record.state == "ready" && record.mimeType in HOME_EVIDENCE_MIMES) { MEDIA_CHANGED }
            check(record.fileSize in 1..HOME_EVIDENCE_MAX_BYTES.toLong()) { MEDIA_CHANGED }
        }
    }
}

private fun <T> NetworkResult<T>.mediaValue(): T =
    when (this) {
        is NetworkResult.Success -> data
        is NetworkResult.Failure -> throw error
    }
