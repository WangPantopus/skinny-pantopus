package app.pantopus.android.data.payments

import android.content.Context
import app.pantopus.android.data.api.models.payments.PaymentRefundAttempt
import com.squareup.moshi.Moshi
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import java.nio.file.Files
import java.nio.file.NoSuchFileException
import java.nio.file.StandardCopyOption
import java.security.MessageDigest
import javax.inject.Inject
import javax.inject.Singleton

interface PendingRefundStore {
    suspend fun read(scope: String): PaymentRefundAttempt?

    suspend fun save(
        scope: String,
        attempt: PaymentRefundAttempt,
    )

    suspend fun clear(scope: String)
}

/** Atomic, excluded from backup; only UUID, numeric amount and reason code persist. */
@Singleton
class PersistentPendingRefundStore
    internal constructor(
        private val directory: File,
        moshi: Moshi,
    ) : PendingRefundStore {
        @Inject
        constructor(
            @ApplicationContext context: Context,
            moshi: Moshi,
        ) : this(File(context.noBackupFilesDir, "pending-refunds"), moshi)

        private val adapter = moshi.adapter(PaymentRefundAttempt::class.java)

        override suspend fun read(scope: String): PaymentRefundAttempt? =
            withContext(Dispatchers.IO) {
                val raw =
                    try {
                        Files.readAllBytes(file(scope).toPath()).toString(Charsets.UTF_8)
                    } catch (_: NoSuchFileException) {
                        return@withContext null
                    }
                val attempt = checkNotNull(adapter.fromJson(raw)) { "Saved recovery is unavailable." }
                check(RefundValidation.validAttempt(attempt) && attempt.description == null) { "Saved recovery is unavailable." }
                attempt
            }

        override suspend fun save(
            scope: String,
            attempt: PaymentRefundAttempt,
        ) = withContext(Dispatchers.IO) {
            check(RefundValidation.validAttempt(attempt))
            // Server-recovered requests already have durable history. Never store
            // another client's description on this device.
            if (attempt.description != null) return@withContext
            check(directory.isDirectory || directory.mkdirs()) { "Could not save recovery details." }
            val temporary = File.createTempFile("refund-", ".tmp", directory)
            try {
                FileOutputStream(temporary).use { output ->
                    output.write(adapter.toJson(attempt).toByteArray(Charsets.UTF_8))
                    output.fd.sync()
                }
                Files.move(temporary.toPath(), file(scope).toPath(), StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING)
            } finally {
                temporary.delete()
            }
            Unit
        }

        override suspend fun clear(scope: String) =
            withContext(Dispatchers.IO) {
                Files.deleteIfExists(file(scope).toPath())
                Unit
            }

        private fun file(scope: String): File {
            val key = MessageDigest.getInstance("SHA-256").digest(scope.toByteArray()).joinToString("") { "%02x".format(it) }
            return File(directory, "$key.json")
        }
    }
