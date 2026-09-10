package app.pantopus.android.data.gigs

import android.content.Context
import app.pantopus.android.data.api.models.gigs.GigStopRequest
import com.squareup.moshi.Moshi
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import java.nio.file.Files
import java.nio.file.NoSuchFileException
import java.nio.file.StandardCopyOption
import java.security.MessageDigest
import javax.inject.Inject
import javax.inject.Singleton

class GigStopRecoveryChanged : IllegalStateException("Another task action is saved. Check status to recover that request first.")

interface PendingGigStopStore {
    suspend fun read(key: String): GigStopRequest?

    suspend fun retain(
        key: String,
        request: GigStopRequest,
        replacing: GigStopRequest? = null,
        canCommit: () -> Boolean = { true },
    )

    suspend fun complete(
        key: String,
        request: GigStopRequest,
        canCommit: () -> Boolean = { true },
    )
}

/** Atomic local receipt identity, excluded from backup. No tokens or free text. */
@Singleton
class PersistentPendingGigStopStore internal constructor(private val directory: File, moshi: Moshi) : PendingGigStopStore {
    @Inject
    constructor(
        @ApplicationContext context: Context,
        moshi: Moshi,
    ) : this(File(context.noBackupFilesDir, "pending-gig-stops"), moshi)

    private val adapter = moshi.adapter(GigStopRequest::class.java)

    override suspend fun read(key: String): GigStopRequest? = withContext(Dispatchers.IO) { lock.withLock { readFile(key) } }

    override suspend fun retain(
        key: String,
        request: GigStopRequest,
        replacing: GigStopRequest?,
        canCommit: () -> Boolean,
    ) = withContext(Dispatchers.IO) {
        lock.withLock {
            check(GigStopValidation.request(request, request.gigId)) { "Recovery details could not be verified." }
            val previous = readFile(key)
            if (previous != null && previous != request && previous != replacing) throw GigStopRecoveryChanged()
            checkCommit(canCommit)
            check(directory.isDirectory || directory.mkdirs()) { "Could not save task recovery." }
            val temporary = File.createTempFile("stop-", ".tmp", directory)
            try {
                FileOutputStream(temporary).use { output ->
                    output.write(adapter.toJson(request).toByteArray(Charsets.UTF_8))
                    output.fd.sync()
                }
                checkCommit(canCommit)
                Files.move(temporary.toPath(), file(key).toPath(), StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING)
            } finally {
                temporary.delete()
            }
            Unit
        }
    }

    override suspend fun complete(
        key: String,
        request: GigStopRequest,
        canCommit: () -> Boolean,
    ) = withContext(Dispatchers.IO) {
        lock.withLock {
            val previous = readFile(key)
            if (previous != null && previous != request) throw GigStopRecoveryChanged()
            checkCommit(canCommit)
            if (previous == request) Files.deleteIfExists(file(key).toPath())
            Unit
        }
    }

    private suspend fun checkCommit(canCommit: () -> Boolean) {
        currentCoroutineContext().ensureActive()
        if (!canCommit()) throw CancellationException("Task action view is no longer current.")
    }

    private fun readFile(key: String): GigStopRequest? {
        val raw =
            try {
                Files.readAllBytes(file(key).toPath()).toString(Charsets.UTF_8)
            } catch (_: NoSuchFileException) {
                return null
            }
        val request = checkNotNull(adapter.fromJson(raw)) { "Saved task recovery is unavailable." }
        check(GigStopValidation.request(request, request.gigId)) { "Saved task recovery is unavailable." }
        return request
    }

    private fun file(key: String): File {
        val hash = MessageDigest.getInstance("SHA-256").digest(key.toByteArray()).joinToString("") { "%02x".format(it) }
        return File(directory, "$hash.json")
    }

    private companion object {
        val lock = Mutex()
    }
}
