package app.pantopus.android.data.store

import android.content.Context
import android.system.Os
import android.system.OsConstants
import app.pantopus.android.BuildConfig
import app.pantopus.android.data.storage.ChatFileCipher
import com.squareup.moshi.JsonClass
import com.squareup.moshi.Moshi
import dagger.hilt.android.qualifiers.ApplicationContext
import timber.log.Timber
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.DataInputStream
import java.io.DataOutputStream
import java.io.File
import java.io.FileOutputStream
import java.lang.reflect.Type
import java.nio.file.Files
import java.nio.file.StandardCopyOption
import java.security.MessageDigest
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import javax.inject.Inject
import javax.inject.Singleton

/** Contract §6 "Saved copy": at most 20 MB of saved pages (photos get the rest of the storage limit)… */
const val SAVED_PAGES_MAX_BYTES = 20L * 1024 * 1024

/** …and nothing older than 7 days is read (a saved household copy is shown for at most 7 days, contract §5). */
private const val CHAT_MAX_BYTES = 5L * 1024 * 1024
private const val CHAT_MAX_THREADS = 20
const val CHAT_MEDIA_FILE_MAX_BYTES = 5L * 1024 * 1024
private const val CHAT_MEDIA_MAX_BYTES = 15L * 1024 * 1024
private const val CHAT_MEDIA_MAX_FILES = 40

private const val MAX_AGE_MS = 7L * 24 * 60 * 60 * 1000

/**
 * The envelope's format. A file written in another format is deleted instead of read. 3: Place copies keep their Ballot
 * fields; a schema-2 copy lost them, and revalidating it with its ETag (a 304) would keep showing it without them.
 */
private const val SCHEMA = 3

/**
 * The screens' store on the phone (Instant Screens contract §6 "Saved copy", §5 "At rest on Android"): one file per
 * entry under `cacheDir/screen-store/<account>/`, never in backups. Each file holds an envelope line (schema, app build,
 * when the copy was read, its ETag, topics, kind and staleness) and the reply's JSON on the next line, written atomically
 * (temporary file, sync, rename) as [app.pantopus.android.data.payments.PersistentPendingRefundStore] does. Names are hashes:
 * no account id, home id or token appears in them.
 *
 * At most 20 MB, the least recently used first; nothing older than 7 days, from another app build or in another format
 * is read, and a file that doesn't decode is deleted. Recent conversations and inbox previews use Keystore-encrypted `.enc` files within
 * a shared 5 MB / 20-copy budget; schema-compatible chat copies survive app updates. Their authenticated scope
 * includes the account and key hashes. Sign-out, an account switch and Clear cache delete everything.
 */
@Singleton
@Suppress("TooManyFunctions") // Page/history/media copies share the same encryption, budget and durable retirement namespace.
class SavedCopies
    internal constructor(
        private val root: File,
        private val moshi: Moshi,
        private val build: String,
        private val chatCipher: ChatFileCipher? = null,
        private val epochsRoot: File = File(root.parentFile, "${root.name}-chat-epochs"),
    ) {
        @Inject
        constructor(
            @ApplicationContext context: Context,
            moshi: Moshi,
            chatCipher: ChatFileCipher,
        ) : this(
            File(context.cacheDir, "screen-store"),
            moshi,
            // Version name and code stay the same between builds; the commit doesn't. An older build's copy may lack
            // fields this build reads, and revalidating it (a 304) would keep it.
            "${BuildConfig.VERSION_NAME}+${BuildConfig.VERSION_CODE}+${BuildConfig.GIT_COMMIT}",
            chatCipher,
            File(context.noBackupFilesDir, "chat-history-epochs"),
        )

        private val envelopes = moshi.adapter(Envelope::class.java)

        /**
         * Each copy's envelope as this process last wrote or checked it (under the store's disk lock). An invalidation
         * that cannot change a copy (another topic, already out of date, fetched after the mark) skips it without
         * decrypting it; a copy it must rewrite is still read and checked from the file itself.
         */
        private val envelopeIndex = ConcurrentHashMap<String, Envelope>()

        /** Small received files share history's account/retirement boundary, never the generic image cache. */
        class MediaCopy(val bytes: ByteArray, val contentType: String)

        fun mediaNamespace(account: String): String = file(account, "chat-media", encrypted = true).name

        fun loadMedia(
            account: String,
            key: String,
        ): MediaCopy? {
            val target = mediaFile(account, key)
            if (!target.isFile) return null
            return runCatching {
                require(target.length() <= CHAT_MEDIA_FILE_MAX_BYTES + MEDIA_ENVELOPE_BYTES)
                val plain = requireNotNull(chatCipher).decrypt(target.readBytes(), scope(target))
                DataInputStream(ByteArrayInputStream(plain)).use { input ->
                    require(System.currentTimeMillis() - input.readLong() in 0 until MAX_AGE_MS)
                    val contentType = input.readUTF()
                    val size = input.readInt()
                    require(size in 1..CHAT_MEDIA_FILE_MAX_BYTES)
                    val bytes = ByteArray(size).also { input.readFully(it) }
                    target.setLastModified(System.currentTimeMillis())
                    MediaCopy(bytes, contentType)
                }
            }.getOrElse {
                target.delete()
                null
            }
        }

        fun saveMedia(
            account: String,
            key: String,
            copy: MediaCopy,
        ) {
            if (copy.bytes.isEmpty() || copy.bytes.size > CHAT_MEDIA_FILE_MAX_BYTES) return
            runCatching {
                val buffer = ByteArrayOutputStream()
                DataOutputStream(buffer).use { output ->
                    output.writeLong(System.currentTimeMillis())
                    output.writeUTF(copy.contentType.take(MEDIA_CONTENT_TYPE_LENGTH))
                    output.writeInt(copy.bytes.size)
                    output.write(copy.bytes)
                }
                val target = mediaFile(account, key)
                writeBytes(target, requireNotNull(chatCipher).encrypt(buffer.toByteArray(), scope(target)))
                trim()
            }.onFailure { Timber.w("Received chat file was not saved") }
        }

        /** A file the server reports gone (its message was deleted) leaves the offline store at once, with its thumbnail. */
        fun forgetMedia(
            account: String,
            key: String,
        ) {
            val file = key.removeSuffix(THUMBNAIL_KEY_SUFFIX)
            mediaFile(account, file).delete()
            mediaFile(account, file + THUMBNAIL_KEY_SUFFIX).delete()
        }

        private fun mediaFile(
            account: String,
            key: String,
        ): File {
            val target = file(account, "chat-media:$key", encrypted = true)
            return File(target.parentFile, "${target.nameWithoutExtension}.media")
        }

        init {
            // An offline upgrade might never open an old household entry: retire it before any screen reads.
            val now = System.currentTimeMillis()
            root.walkTopDown().filter { it.isFile }.forEach { file ->
                if (file.extension == "tmp") {
                    file.delete()
                } else if (file.extension == "json") {
                    val envelope =
                        runCatching {
                            file.bufferedReader().use { reader -> reader.readLine()?.let { envelopes.fromJson(it) } }
                        }.getOrNull()
                    if (isChat(envelope?.kind) || !usable(envelope, now)) file.delete()
                }
            }
        }

        private fun isChat(kind: StoreKind?): Boolean = kind == StoreKind.CONVERSATION || kind == StoreKind.MESSAGES_LIST

        private fun usable(
            envelope: Envelope?,
            now: Long,
        ): Boolean {
            if (envelope == null) return false
            val compatible = isChat(envelope.kind) || envelope.build == build
            return envelope.schema == SCHEMA && compatible && now - envelope.fetchedAt in 0 until MAX_AGE_MS
        }

        /** One saved entry as read back: the reply, when it was read (wall clock) and its ETag. */
        data class Copy<T>(
            val data: T,
            val fetchedAt: Long,
            val etag: String?,
            val stale: Boolean,
            /** Written before copies carried topics and kind: any mark applies to it. */
            val legacy: Boolean = false,
        )

        /** One invalidation: a topic or kinds, own edit or not, for copies fetched at or before [upTo]. */
        data class Mark(
            val topic: String? = null,
            val kinds: Set<StoreKind> = emptySet(),
            val edited: Boolean = false,
            val upTo: Long = Long.MAX_VALUE,
            val retainChatList: Boolean = false,
            val topics: Set<String> = emptySet(),
        )

        @JsonClass(generateAdapter = true)
        internal data class Envelope(
            val schema: Int,
            val build: String,
            val fetchedAt: Long,
            val etag: String?,
            val topics: Set<String>? = null,
            val kind: StoreKind? = null,
            val stale: Boolean = false,
        ) {
            val legacy: Boolean get() = topics == null || kind == null

            fun matches(
                topic: String?,
                kinds: Set<StoreKind>,
            ): Boolean =
                kind in kinds ||
                    topics.orEmpty().any {
                        it == topic || (it.endsWith(":*") && topic?.startsWith(it.dropLast(1)) == true)
                    }
        }

        /**
         * The saved copy of [keyId] for [account], or null. Small files, read on the caller's thread so a screen's
         * first frame can show it.
         */
        fun <T : Any> load(
            account: String,
            keyId: String,
            type: Type,
            now: Long = System.currentTimeMillis(),
            kind: StoreKind? = null,
        ): Copy<T>? {
            if (isChat(kind)) file(account, keyId).delete()
            val file = file(account, keyId, isChat(kind))
            if (!file.isFile) return null
            return try {
                val text = read(file)
                val split = text.indexOf('\n')
                val envelope = if (split > 0) envelopes.fromJson(text.substring(0, split)) else null
                val data = if (usable(envelope, now)) moshi.adapter<T>(type).fromJson(text.substring(split + 1)) else null
                if (data == null || envelope == null) {
                    file.delete()
                    null
                } else {
                    // Least recently used goes first: reading counts as use.
                    file.setLastModified(now)
                    Copy(data, envelope.fetchedAt, envelope.etag, envelope.stale, envelope.legacy)
                }
            } catch (
                @Suppress("TooGenericExceptionCaught") error: Exception,
            ) {
                // A copy that doesn't decode (or can't be read) is deleted, never shown.
                Timber.w(error, "saved copy dropped")
                file.delete()
                null
            }
        }

        /** Saves [data] for [key], replacing any older copy, then trims the folder to its budget. Never throws. */
        fun <T : Any> save(
            account: String,
            key: StoreKey<*>,
            data: T,
            fetchedAt: Long,
            etag: String?,
            stale: Boolean,
        ) {
            val type = key.type ?: return
            if (isChat(key.kind)) file(account, key.id).delete()
            val target = file(account, key.id, isChat(key.kind))
            try {
                val envelope = Envelope(SCHEMA, build, fetchedAt, etag, key.topics, key.kind, stale)
                write(target, envelope, moshi.adapter<T>(type).toJson(data))
                trim()
            } catch (
                @Suppress("TooGenericExceptionCaught") error: Exception,
            ) {
                // The phone copy is an optimization: a type that can't be written, or a full disk, never breaks a read.
                Timber.w(error, "saved copy not written")
            }
        }

        /**
         * Ordinary invalidation also reaches entries whose memory slot has gone. Access retirement uses [retireChat]
         * before cleanup, so interruption cannot expose an unopened old copy. Runs off the
         * caller's thread; [guard] wraps each file's work (the store's lock and wipe check), one file at a time.
         */
        fun invalidate(
            account: String,
            mark: Mark,
            guard: (() -> Unit) -> Unit = { it() },
        ) {
            if (mark.topic == null && mark.topics.isEmpty() && mark.kinds.isEmpty()) return
            val folder = file(account, "").parentFile ?: return
            folder.listFiles()?.filter { it.extension in setOf("json", "enc") }?.forEach {
                    target ->
                guard { invalidateFile(target, mark) }
            }
            guard { trim() }
        }

        private fun invalidateFile(
            target: File,
            mark: Mark,
        ) {
            if (!target.isFile) {
                envelopeIndex.remove(target.path)
                return
            }
            if (envelopeIndex[target.path]?.let { invalidation(it, mark) } == Invalidation.NONE) return
            try {
                read(target).reader().buffered().use { reader ->
                    val envelope = reader.readLine()?.let { envelopes.fromJson(it) } ?: return@use
                    when (invalidation(envelope, mark)) {
                        Invalidation.NONE -> envelopeIndex[target.path] = envelope
                        Invalidation.DELETE -> {
                            envelopeIndex.remove(target.path)
                            target.delete()
                        }
                        Invalidation.MARK_STALE -> {
                            // Older schema-2 copies lack topics. Keep their offline content, but require a check.
                            val lastUsed = target.lastModified()
                            write(target, envelope.copy(stale = true, etag = envelope.etag.takeUnless { mark.edited }), reader.readText())
                            target.setLastModified(lastUsed)
                        }
                    }
                }
            } catch (
                @Suppress("TooGenericExceptionCaught") error: Exception,
            ) {
                // A copy whose invalidation cannot be recorded must not later look current.
                envelopeIndex.remove(target.path)
                target.delete()
                Timber.w(error, "saved copy invalidation failed")
            }
        }

        private enum class Invalidation { NONE, DELETE, MARK_STALE }

        private fun invalidation(
            envelope: Envelope,
            mark: Mark,
        ): Invalidation {
            // A copy saved after the mark came from a later read and keeps its own state.
            if (envelope.fetchedAt > mark.upTo) return Invalidation.NONE
            val matches = envelope.matches(mark.topic, mark.kinds) || mark.topics.any { envelope.matches(it, emptySet()) }
            if (!envelope.legacy && !matches) return Invalidation.NONE
            val retainChatList = mark.retainChatList && envelope.kind == StoreKind.MESSAGES_LIST
            return when {
                mark.edited && !envelope.legacy && !retainChatList -> Invalidation.DELETE
                !envelope.stale || (mark.edited && envelope.etag != null) -> Invalidation.MARK_STALE
                else -> Invalidation.NONE
            }
        }

        private fun write(
            target: File,
            envelope: Envelope,
            data: String,
        ) {
            envelopeIndex.remove(target.path)
            val body = (envelopes.toJson(envelope) + "\n" + data).toByteArray(Charsets.UTF_8)
            val bytes = if (target.extension == "enc") requireNotNull(chatCipher).encrypt(body, scope(target)) else body
            writeBytes(target, bytes)
            if (target.isFile) envelopeIndex[target.path] = envelope
        }

        private fun writeBytes(
            target: File,
            bytes: ByteArray,
        ) {
            val folder = target.parentFile ?: return
            if (!folder.isDirectory && !folder.mkdirs()) return
            val temporary = File.createTempFile("entry-", ".tmp", folder)
            try {
                FileOutputStream(temporary).use { output ->
                    output.write(bytes)
                    output.fd.sync()
                }
                Files.move(temporary.toPath(), target.toPath(), StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING)
            } finally {
                temporary.delete()
            }
        }

        /** Deletes the saved copy of [keyId] (access ended, the entry was removed). */
        fun delete(
            account: String,
            keyId: String,
        ) {
            listOf(file(account, keyId), file(account, keyId, encrypted = true)).forEach {
                envelopeIndex.remove(it.path)
                it.delete()
            }
        }

        /**
         * Retire the entire account's encrypted history/inbox namespace before deleting any old file. The marker is
         * outside the evictable cache, is never trimmed, and does not change the key used by drafts or outgoing files.
         * Legacy `.enc` paths and their AAD remain readable until the first retirement; they are never a fallback after it.
         */
        fun retireChat(account: String) {
            val accountHash = accountHash(account)
            rotateEpoch(accountHash)
            envelopeIndex.clear()
            // The new account epoch already hides every older thread epoch's copies.
            File(epochsRoot, accountHash + THREADS_SUFFIX).delete()
            // Cleanup is optional for correctness: all these paths became unreadable at the atomic marker change.
            File(root, accountHash).listFiles()?.filter { it.extension in setOf("enc", "media") }?.forEach { it.delete() }
        }

        /**
         * A Read correction retires only the copies saved under [paths], each with every query (a person's All window
         * and each topic, a room for each identity), not the account's. Each path gets a new epoch in the account's
         * thread marker, written like [retireChat]'s before any old file is deleted; a copy's name carries its path's
         * epoch, so no old copy can be read after this returns, even if cleanup stops. Other conversations and received
         * files stay. [keyIds] name the old copies to delete now; others become unreadable and leave with a trim or the
         * account's retirement. Throws when the epochs cannot be recorded: the caller then retires the account.
         */
        fun retireChatThreads(
            account: String,
            paths: Set<String>,
            keyIds: Collection<String>,
        ) {
            val accountHash = accountHash(account)
            val epochs = checkNotNull(readThreadEpochs(accountHash)) { "Chat thread retirement is unavailable." }
            val retiring = paths.map(::hash).toSet()
            val previous = retiring.mapNotNull { epochs[it] }
            val old = keyIds.map { file(account, it, encrypted = true) }
            val next = epochs + retiring.associateWith { UUID.randomUUID().toString() }
            check(next.size <= MAX_THREAD_EPOCHS) { "Too many retired chat threads." }
            writeMarker(accountHash + THREADS_SUFFIX, next.entries.joinToString("\n") { "${it.key} ${it.value}" })
            envelopeIndex.clear()
            old.forEach { it.delete() }
            File(root, accountHash).listFiles()?.filter { file ->
                file.extension == "enc" && previous.any { file.name.contains(".$it.") }
            }?.forEach { it.delete() }
        }

        private fun rotateEpoch(name: String) = writeMarker(name, UUID.randomUUID().toString())

        private fun writeMarker(
            name: String,
            contents: String,
        ) {
            check(epochsRoot.isDirectory || epochsRoot.mkdirs()) { "Chat history retirement is unavailable." }
            val marker = File(epochsRoot, name)
            val temporary = File.createTempFile("epoch-", ".tmp", epochsRoot)
            try {
                FileOutputStream(temporary).use { output ->
                    output.write(contents.toByteArray(Charsets.UTF_8))
                    output.fd.sync()
                }
                Files.move(temporary.toPath(), marker.toPath(), StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING)
                // Persist the renamed directory entry as well as its contents before reporting access retirement.
                val directory = Os.open(epochsRoot.path, OsConstants.O_RDONLY, 0)
                try {
                    Os.fsync(directory)
                } finally {
                    Os.close(directory)
                }
            } finally {
                temporary.delete()
            }
        }

        /** Sign-out, a revoked session, an account switch and Clear cache: every account's saved pages go. */
        fun deleteAll() {
            // One durable marker retires even unopened accounts before interruptible recursive cleanup starts.
            rotateEpoch("all")
            envelopeIndex.clear()
            epochsRoot.listFiles()?.filter { it.name.endsWith(THREADS_SUFFIX) }?.forEach { it.delete() }
            root.deleteRecursively()
        }

        /** Bytes the saved pages take now (the Storage & data screen). */
        fun sizeBytes(): Long = root.walkBottomUp().filter { it.isFile }.sumOf { it.length() }

        /** Least recently used first, until the folder fits [SAVED_PAGES_MAX_BYTES]. */
        private fun trim() {
            val files = root.walkBottomUp().filter { it.isFile && it.extension in setOf("json", "enc", "media") }.toMutableList()
            val media = files.filter { it.extension == "media" }.sortedBy { it.lastModified() }
            var mediaBytes = media.sumOf { it.length() }
            var mediaCount = media.size
            media.forEach { file ->
                if (mediaBytes > CHAT_MEDIA_MAX_BYTES || mediaCount > CHAT_MEDIA_MAX_FILES) {
                    mediaBytes -= file.length()
                    mediaCount--
                    file.delete()
                    files.remove(file)
                }
            }
            val chats = files.filter { it.extension == "enc" }.sortedBy { it.lastModified() }
            var chatBytes = chats.sumOf { it.length() }
            var chatCount = chats.size
            chats.forEach { file ->
                if (chatBytes > CHAT_MAX_BYTES || chatCount > CHAT_MAX_THREADS) {
                    chatBytes -= file.length()
                    chatCount--
                    envelopeIndex.remove(file.path)
                    file.delete()
                    files.remove(file)
                }
            }
            var total = files.sumOf { it.length() }
            if (total <= SAVED_PAGES_MAX_BYTES) return
            files.sortBy { it.lastModified() }
            for (file in files) {
                if (total <= SAVED_PAGES_MAX_BYTES) break
                total -= file.length()
                envelopeIndex.remove(file.path)
                file.delete()
            }
        }

        private fun file(
            account: String,
            keyId: String,
            encrypted: Boolean = false,
        ): File {
            val extension = if (encrypted) "enc" else "json"
            val accountHash = accountHash(account)
            val epoch =
                if (encrypted) {
                    listOfNotNull(readEpoch("all"), readEpoch(accountHash), threadEpoch(accountHash, keyId))
                        .joinToString(".").takeIf { it.isNotEmpty() }
                } else {
                    null
                }
            return File(File(root, accountHash), "${hash(keyId)}${epoch?.let { ".$it" }.orEmpty()}.$extension")
        }

        private fun readEpoch(name: String): String? {
            val marker = File(epochsRoot, name)
            if (!marker.exists()) return null
            // Corrupt/unreadable metadata fails closed into a separate namespace, never back to legacy files.
            return runCatching { UUID.fromString(marker.readText()).toString() }.getOrDefault(UNAVAILABLE)
        }

        /** A store key's thread is its path, whatever its query. Received files and other names have none. */
        private fun threadEpoch(
            accountHash: String,
            keyId: String,
        ): String? {
            if (!keyId.startsWith(KEY_METHOD)) return null
            val epochs = readThreadEpochs(accountHash) ?: return UNAVAILABLE
            return epochs[hash(keyId.removePrefix(KEY_METHOD).substringBefore('?'))]
        }

        /** Each retired path's hash and epoch; null when the marker can't be read, which fails closed like [readEpoch]. */
        private fun readThreadEpochs(accountHash: String): Map<String, String>? {
            val marker = File(epochsRoot, accountHash + THREADS_SUFFIX)
            if (!marker.exists()) return emptyMap()
            return runCatching {
                marker.readLines().filter { it.isNotEmpty() }.associate { line ->
                    val fields = line.split(' ')
                    require(fields.size == 2 && fields[0].length == HASH_CHARS)
                    fields[0] to UUID.fromString(fields[1]).toString()
                }
            }.getOrNull()
        }

        private fun accountHash(account: String): String = hash("${BuildConfig.PANTOPUS_API_BASE_URL}|$account")

        private fun scope(file: File): String = file.relativeTo(root).path

        private fun read(file: File): String {
            val bytes = file.readBytes()
            val plain = if (file.extension == "enc") requireNotNull(chatCipher).decrypt(bytes, scope(file)) else bytes
            return plain.toString(Charsets.UTF_8)
        }

        private fun hash(value: String): String =
            MessageDigest.getInstance("SHA-256").digest(value.toByteArray()).joinToString("") { "%02x".format(it) }.take(HASH_CHARS)

        private companion object {
            const val THUMBNAIL_KEY_SUFFIX = "?thumbnail"
            const val HASH_CHARS = 32
            const val KEY_METHOD = "GET "
            const val THREADS_SUFFIX = ".threads"
            const val UNAVAILABLE = "unavailable"

            /** Read corrections are rare; past this many retired threads one retires the whole account instead. */
            const val MAX_THREAD_EPOCHS = 64
            const val MEDIA_ENVELOPE_BYTES = 512
            const val MEDIA_CONTENT_TYPE_LENGTH = 128
        }
    }
