package app.pantopus.android.data.chats

import android.content.Context
import app.pantopus.android.BuildConfig
import app.pantopus.android.data.api.models.chats.ChatMessageDto
import app.pantopus.android.data.api.models.chats.SendChatMessageBody
import app.pantopus.android.data.storage.ChatFileCipher
import app.pantopus.android.data.upload.UploadFile
import com.squareup.moshi.JsonClass
import com.squareup.moshi.Moshi
import dagger.hilt.android.qualifiers.ApplicationContext
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.RequestBody
import okio.BufferedSink
import timber.log.Timber
import java.io.DataInputStream
import java.io.DataOutputStream
import java.io.File
import java.io.FileOutputStream
import java.io.OutputStream
import java.nio.file.Files
import java.nio.file.StandardCopyOption
import java.security.MessageDigest
import java.time.Instant
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

/** The destination is captured when Send is tapped, independently of subsequent navigation or topic changes. */
@JsonClass(generateAdapter = true)
data class ChatSendTarget(
    val accountId: String,
    val kind: String,
    val id: String,
    val asBusinessUserId: String? = null,
)

@JsonClass(generateAdapter = true)
data class ChatOutboxAttachment(
    val id: String,
    val filename: String,
    val mimeType: String,
    val size: Int,
)

@JsonClass(generateAdapter = true)
data class ChatOutboxTopic(val type: String, val referenceId: String, val title: String)

@Suppress("LongParameterList")
@JsonClass(generateAdapter = true)
data class ChatOutboxEntry(
    val clientId: String,
    val target: ChatSendTarget,
    val pending: ChatMessageDto,
    val body: SendChatMessageBody,
    val attachments: List<ChatOutboxAttachment> = emptyList(),
    val attempts: Int = 0,
    val retryAt: Long = 0,
    val error: String? = null,
    val terminal: Boolean = false,
    val refused: Boolean = false,
    val topic: ChatOutboxTopic? = null,
)

/**
 * Unsent messages are durable data, separate from the evictable recent-history cache. Metadata and original
 * attachments are encrypted before they touch disk, under noBackupFilesDir. Atomic replacement and fsync happen
 * before Send clears the composer. This store never evicts an unsent message to make room for a newer one.
 * The coordinator serializes access and performs all disk work off the UI thread.
 */
@Singleton
class ChatOutboxStore
    @Inject
    constructor(
        @ApplicationContext context: Context,
        private val cipher: ChatFileCipher,
        moshi: Moshi,
    ) {
        private val root = File(context.noBackupFilesDir, "chat-outbox")
        private val adapter = moshi.adapter(ChatOutboxEntry::class.java)

        fun load(account: String): List<ChatOutboxEntry> {
            val folder = accountFolder(account)
            // An account switch never exposes or retries the previous account's unsent work.
            root.listFiles().orEmpty().filter { it != folder }.forEach { it.deleteRecursively() }
            folder.listFiles().orEmpty().filter { it.name.endsWith(".tmp") }.forEach { it.deleteRecursively() }
            return folder.listFiles().orEmpty().filter { it.isDirectory }.mapNotNull { directory ->
                runCatching {
                    val file = File(directory, "message.enc")
                    val entry = adapter.fromJson(cipher.decrypt(file.readBytes(), scope(file)).toString(Charsets.UTF_8))
                    entry?.takeIf { it.target.accountId == account && it.clientId == directory.name }
                }.onFailure { Timber.w("An encrypted unsent chat could not be opened") }.getOrNull()
            }.sortedWith(compareBy<ChatOutboxEntry> { Instant.parse(it.pending.createdAt) }.thenBy { it.clientId })
        }

        fun insert(
            entry: ChatOutboxEntry,
            files: List<UploadFile>,
        ): ChatOutboxEntry {
            val folder = accountFolder(entry.target.accountId)
            check(folder.listFiles().orEmpty().count { it.isDirectory } < MAX_MESSAGES) {
                "There are too many unsent messages. Send or remove some before trying again."
            }
            val needed = files.sumOf { it.bytes.size.toLong() }
            val held = root.walkTopDown().filter { it.isFile }.sumOf { it.length() }
            check(needed <= MAX_BYTES && held + needed <= MAX_BYTES) {
                "Unsent attachments have filled the device queue. Send or remove some before adding more."
            }
            val destination = entryFolder(entry)
            check(!destination.exists()) { "This message is already queued." }
            val temporary = File(folder, "${entry.clientId}.tmp")
            check(temporary.mkdirs()) { "Couldn't save the message on this device." }
            try {
                val attachments = files.map { ChatOutboxAttachment(UUID.randomUUID().toString(), it.filename, it.mimeType, it.bytes.size) }
                val saved = entry.copy(attachments = attachments)
                files.zip(attachments).forEach { (input, attachment) ->
                    val temporaryFile = File(temporary, "${attachment.id}.enc")
                    writeAttachment(temporaryFile, input.bytes, scope(File(destination, temporaryFile.name)))
                }
                val metadata = File(destination, "message.enc")
                atomicWrite(File(temporary, metadata.name), cipher.encrypt(adapter.toJson(saved).toByteArray(), scope(metadata)))
                val storedBytes = temporary.walkTopDown().filter { it.isFile }.sumOf { it.length() }
                check(held + storedBytes <= MAX_BYTES) {
                    "Unsent attachments have filled the device queue. Send or remove some before adding more."
                }
                Files.move(temporary.toPath(), destination.toPath(), StandardCopyOption.ATOMIC_MOVE)
                return saved
            } finally {
                temporary.deleteRecursively()
            }
        }

        fun update(entry: ChatOutboxEntry) {
            val file = File(entryFolder(entry), "message.enc")
            check(file.isFile) { "This message is no longer queued." }
            atomicWrite(file, cipher.encrypt(adapter.toJson(entry).toByteArray(), scope(file)))
        }

        fun attachments(entry: ChatOutboxEntry): List<UploadFile> =
            entry.attachments.map { attachment ->
                val file = File(entryFolder(entry), "${UUID.fromString(attachment.id)}.enc")
                val body =
                    object : RequestBody() {
                        override fun contentType() = attachment.mimeType.toMediaTypeOrNull()

                        override fun contentLength() = attachment.size.toLong()

                        override fun writeTo(sink: BufferedSink) = writeDecryptedAttachment(file, attachment.size, sink.outputStream())
                    }
                UploadFile(attachment.filename, attachment.mimeType, streamingBody = body)
            }

        fun remove(entry: ChatOutboxEntry) {
            entryFolder(entry).deleteRecursively()
        }

        fun clear() {
            root.deleteRecursively()
        }

        /** Chunk authentication keeps a 100 MB attachment from requiring several full-size decryption buffers. */
        private fun writeAttachment(
            file: File,
            bytes: ByteArray,
            scope: String,
        ) {
            FileOutputStream(file).use { output ->
                val framed = DataOutputStream(output)
                var offset = 0
                var index = 0
                while (offset < bytes.size) {
                    val end = (offset + CHUNK_BYTES).coerceAtMost(bytes.size)
                    val chunk = cipher.encrypt(bytes.copyOfRange(offset, end), "$scope:$index:${bytes.size}")
                    framed.writeInt(chunk.size)
                    framed.write(chunk)
                    offset = end
                    index++
                }
                framed.flush()
                output.fd.sync()
            }
        }

        private fun writeDecryptedAttachment(
            file: File,
            size: Int,
            output: OutputStream,
        ) {
            require(size.toLong() in 0..MAX_BYTES)
            DataInputStream(file.inputStream().buffered()).use { input ->
                var offset = 0
                var index = 0
                while (offset < size) {
                    val length = input.readInt()
                    require(length in 1..MAX_CHUNK_BYTES)
                    val encrypted = ByteArray(length)
                    input.readFully(encrypted)
                    val plain = cipher.decrypt(encrypted, "${scope(file)}:$index:$size")
                    require(plain.size == (size - offset).coerceAtMost(CHUNK_BYTES))
                    output.write(plain)
                    offset += plain.size
                    index++
                }
                require(input.read() == -1)
            }
        }

        private fun atomicWrite(
            file: File,
            bytes: ByteArray,
        ) {
            val temporary = File.createTempFile("message-", ".tmp", file.parentFile)
            try {
                FileOutputStream(temporary).use { output ->
                    output.write(bytes)
                    output.fd.sync()
                }
                Files.move(temporary.toPath(), file.toPath(), StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING)
            } finally {
                temporary.delete()
            }
        }

        private fun entryFolder(entry: ChatOutboxEntry) =
            File(accountFolder(entry.target.accountId), UUID.fromString(entry.clientId).toString())

        private fun accountFolder(account: String): File {
            val identity = "${BuildConfig.PANTOPUS_API_BASE_URL}|$account".toByteArray()
            val hash = MessageDigest.getInstance("SHA-256").digest(identity).joinToString("") { "%02x".format(it) }
            return File(root, hash)
        }

        private fun scope(file: File) = file.relativeTo(root).path

        private companion object {
            const val MAX_MESSAGES = 200
            const val MAX_BYTES = 100L * 1024 * 1024
            const val CHUNK_BYTES = 1024 * 1024
            const val MAX_CHUNK_BYTES = CHUNK_BYTES + 64
        }
    }
