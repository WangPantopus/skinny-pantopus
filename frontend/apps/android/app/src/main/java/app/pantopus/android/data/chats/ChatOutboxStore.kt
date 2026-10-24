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
import java.io.ByteArrayOutputStream
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
    val encryptionScope: String? = null,
)

@JsonClass(generateAdapter = true)
data class ChatOutboxTopic(val type: String, val referenceId: String, val title: String)

@Suppress("LongParameterList")
@JsonClass(generateAdapter = true)
data class ChatComposerDraft(
    val target: ChatSendTarget,
    val topicId: String?,
    val text: String,
    val attachments: List<ChatOutboxAttachment> = emptyList(),
    val replyMessageId: String? = null,
    val replyName: String? = null,
    val replyText: String? = null,
    val editingMessageId: String? = null,
    val queuedClientId: String? = null,
    val replyRoomId: String? = null,
)

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
 * before a message counts as queued (and before it is delivered). This store never evicts an unsent message to make
 * room for a newer one. The coordinator serializes access and performs all disk work off the UI thread.
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
        private val draftAdapter = moshi.adapter(ChatComposerDraft::class.java)

        fun load(account: String): List<ChatOutboxEntry> {
            val folder = accountFolder(account)
            // An account switch never exposes or retries the previous account's unsent work.
            root.listFiles().orEmpty().filter { it != folder }.forEach { it.deleteRecursively() }
            folder.listFiles().orEmpty().filter { it.name.endsWith(".tmp") }.forEach { it.deleteRecursively() }
            val entries =
                folder.listFiles().orEmpty().filter { it.isDirectory && !it.name.startsWith("draft-") }.mapNotNull { directory ->
                    runCatching {
                        val file = File(directory, "message.enc")
                        val entry = adapter.fromJson(cipher.decrypt(file.readBytes(), scope(file)).toString(Charsets.UTF_8))
                        entry?.takeIf { it.target.accountId == account && it.clientId == directory.name }
                    }.onFailure { Timber.w("An encrypted unsent chat could not be opened") }.getOrNull()
                }.sortedWith(compareBy<ChatOutboxEntry> { Instant.parse(it.pending.createdAt) }.thenBy { it.clientId })
            val queuedIds = entries.mapTo(mutableSetOf()) { it.clientId }
            folder.listFiles().orEmpty().filter { it.name.startsWith("draft-") }.forEach { draftFolder ->
                if (runCatching { readDraftMetadata(draftFolder)?.queuedClientId in queuedIds }.getOrDefault(false)) {
                    draftFolder.deleteRecursively()
                }
            }
            return entries
        }

        /**
         * Queues [entry] with one encrypted metadata write (one Keystore operation and one fsync) before one atomic move.
         * The composer's draft folder, when there is one, becomes the message's folder: an attachment already encrypted
         * there for the same picked file is kept instead of being encrypted again, and the move both queues the message
         * and retires that draft. The draft itself is neither rewritten nor decrypted on the way.
         */
        fun insert(
            entry: ChatOutboxEntry,
            files: List<UploadFile>,
            draft: ChatComposerDraft? = null,
        ): ChatOutboxEntry {
            val folder = accountFolder(entry.target.accountId)
            check(folder.listFiles().orEmpty().count { it.isDirectory && !it.name.startsWith("draft-") } < MAX_MESSAGES) {
                "There are too many unsent messages. Send or remove some before trying again."
            }
            val destination = entryFolder(entry)
            check(!destination.exists()) { "This message is already queued." }
            val draftFolder =
                draft?.takeIf { it.target == entry.target }?.let { draftFolder(it.target, it.topicId) }?.takeIf { it.isDirectory }
            val staging = draftFolder ?: File(folder, "${entry.clientId}.tmp")
            check(staging.isDirectory || staging.mkdirs()) { "Couldn't save the message on this device." }
            val described = draft?.attachments?.takeIf { it.size == files.size }
            val sources =
                files.mapIndexed { index, input ->
                    val known =
                        described?.get(index)?.takeIf {
                            it.size == input.bytes.size && it.mimeType == input.mimeType && it.filename == input.filename
                        }
                    val id = UUID.fromString(known?.id ?: UUID.randomUUID().toString()).toString()
                    val file = File(staging, "$id.enc")
                    // A draft file is only reused when the draft describes this same picked file; it was encrypted under
                    // the draft folder's scope, which the queued metadata records.
                    Triple(input, id, file.takeIf { known != null && draftFolder != null && it.isFile })
                }
            val needed = sources.filter { it.third == null }.sumOf { it.first.bytes.size.toLong() }
            val held = root.walkTopDown().filter { it.isFile }.sumOf { it.length() }
            check(needed <= MAX_BYTES && held + needed <= MAX_BYTES) {
                "Unsent attachments have filled the device queue. Send or remove some before adding more."
            }
            val written = mutableListOf<File>()
            var committed = false
            try {
                val attachments = sources.map { (input, id, reused) -> stage(input, id, reused, staging, destination, written) }
                val saved = entry.copy(attachments = attachments)
                val metadata = File(destination, "message.enc")
                val encrypted = cipher.encrypt(adapter.toJson(saved).toByteArray(), scope(metadata))
                check(held + needed + encrypted.size <= MAX_BYTES) {
                    "Unsent attachments have filled the device queue. Send or remove some before adding more."
                }
                atomicWrite(File(staging, metadata.name), encrypted)
                // Android denies hard links in app data. Moving the folder commits its encrypted files together with the
                // outgoing metadata; the authenticated original scope of a reused draft file remains in the metadata.
                Files.move(staging.toPath(), destination.toPath(), StandardCopyOption.ATOMIC_MOVE)
                committed = true
                val kept = attachments.mapTo(mutableSetOf("message.enc")) { "${it.id}.enc" }
                destination.listFiles().orEmpty().filter { it.name !in kept }.forEach { it.deleteRecursively() }
                return saved
            } finally {
                if (!committed) discard(staging, draftFolder != null, written)
            }
        }

        /** A reused draft file keeps its recorded scope; a new one is encrypted for its queued location. */
        private fun stage(
            input: UploadFile,
            id: String,
            reused: File?,
            staging: File,
            destination: File,
            written: MutableList<File>,
        ): ChatOutboxAttachment {
            if (reused != null) {
                return ChatOutboxAttachment(id, input.filename, input.mimeType, input.bytes.size, encryptionScope = scope(reused))
            }
            val file = File(staging, "$id.enc")
            written += file
            writeAttachment(file, input.bytes, scope(File(destination, file.name)))
            return ChatOutboxAttachment(id, input.filename, input.mimeType, input.bytes.size)
        }

        /** A commit that did not happen leaves a draft folder exactly as it was saved; a staging folder goes entirely. */
        private fun discard(
            staging: File,
            isDraft: Boolean,
            written: List<File>,
        ) {
            if (!isDraft) {
                staging.deleteRecursively()
                return
            }
            File(staging, "message.enc").delete()
            written.forEach { it.delete() }
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

                        override fun writeTo(sink: BufferedSink) =
                            writeDecryptedAttachment(file, attachment.size, sink.outputStream(), attachment.encryptionScope ?: scope(file))
                    }
                UploadFile(attachment.filename, attachment.mimeType, streamingBody = body)
            }

        fun remove(entry: ChatOutboxEntry) {
            entryFolder(entry).deleteRecursively()
        }

        /** Drafts share the queue's encryption, account boundary and byte budget; they are never submitted. */
        fun saveDraft(
            draft: ChatComposerDraft,
            files: List<UploadFile>,
        ) {
            val folder = draftFolder(draft.target, draft.topicId)
            val hasAction = draft.replyMessageId != null || draft.editingMessageId != null
            if (draft.text.isEmpty() && draft.attachments.isEmpty() && !hasAction) {
                folder.deleteRecursively()
                return
            }
            check(files.size == draft.attachments.size)
            val draftCount = accountFolder(draft.target.accountId).listFiles().orEmpty().count { it.name.startsWith("draft-") }
            check(folder.exists() || draftCount < MAX_DRAFTS) {
                "There are too many saved chat drafts. Send or clear one before saving another."
            }
            check(folder.exists() || folder.mkdirs()) { "Couldn't save the chat draft on this device." }
            val old = readDraftMetadata(folder)
            var saved = false
            try {
                draft.attachments.zip(files).forEach { (attachment, input) ->
                    val file = File(folder, "${UUID.fromString(attachment.id)}.enc")
                    if (old?.attachments?.contains(attachment) == true && file.isFile) return@forEach
                    check(root.walkTopDown().filter { it.isFile }.sumOf { it.length() } + input.bytes.size <= MAX_BYTES) {
                        "Unsent attachments have filled the device queue. Send or remove some before saving more."
                    }
                    writeAttachment(file, input.bytes, scope(file))
                }
                val metadata = File(folder, "draft.enc")
                val encoded = draftAdapter.toJson(draft).toByteArray()
                check(encoded.size <= MAX_DRAFT_METADATA_BYTES) { "This chat draft is too large to save on the device." }
                val encrypted = cipher.encrypt(encoded, scope(metadata))
                check(root.walkTopDown().filter { it.isFile }.sumOf { it.length() } + encrypted.size <= MAX_BYTES) {
                    "Unsent attachments have filled the device queue. Send or remove some before saving more."
                }
                atomicWrite(metadata, encrypted)
                saved = true
            } finally {
                val retainedAttachments = if (saved) draft.attachments else old?.attachments.orEmpty()
                val retained = retainedAttachments.mapTo(mutableSetOf()) { "${it.id}.enc" } + "draft.enc"
                folder.listFiles().orEmpty().filter { it.name !in retained }.forEach { it.delete() }
            }
        }

        fun loadDraft(
            target: ChatSendTarget,
            topicId: String?,
        ): Pair<ChatComposerDraft, List<UploadFile>>? {
            val folder = draftFolder(target, topicId)
            val draft = readDraftMetadata(folder)?.takeIf { it.target == target && it.topicId == topicId } ?: return null
            if (draft.queuedClientId?.let { File(accountFolder(target.accountId), "$it/message.enc").isFile } == true) {
                folder.deleteRecursively()
                return null
            }
            val files =
                draft.attachments.map { attachment ->
                    val file = File(folder, "${UUID.fromString(attachment.id)}.enc")
                    val bytes =
                        ByteArrayOutputStream(attachment.size).use { output ->
                            writeDecryptedAttachment(file, attachment.size, output)
                            output.toByteArray()
                        }
                    UploadFile(attachment.filename, attachment.mimeType, bytes)
                }
            return draft to files
        }

        private fun readDraftMetadata(folder: File): ChatComposerDraft? {
            val file = File(folder, "draft.enc")
            if (!file.isFile) return null
            return draftAdapter.fromJson(cipher.decrypt(file.readBytes(), scope(file)).toString(Charsets.UTF_8))
        }

        private fun draftFolder(
            target: ChatSendTarget,
            topicId: String?,
        ): File {
            val key = listOf(target.kind, target.id, target.asBusinessUserId.orEmpty(), topicId.orEmpty()).joinToString("|")
            val hash = MessageDigest.getInstance("SHA-256").digest(key.toByteArray()).joinToString("") { "%02x".format(it) }
            return File(accountFolder(target.accountId), "draft-$hash")
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
            encryptionScope: String = scope(file),
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
                    val plain = cipher.decrypt(encrypted, "$encryptionScope:$index:$size")
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
            const val MAX_DRAFTS = 20
            const val MAX_DRAFT_METADATA_BYTES = 128 * 1024
            const val MAX_BYTES = 100L * 1024 * 1024
            const val CHUNK_BYTES = 1024 * 1024
            const val MAX_CHUNK_BYTES = CHUNK_BYTES + 64
        }
    }
