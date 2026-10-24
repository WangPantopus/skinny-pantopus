package app.pantopus.android.data.storage

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import javax.inject.Inject
import javax.inject.Singleton

/** Device-only authenticated encryption for account-scoped chat files, never backed up with their key. */
@Singleton
class ChatFileCipher
    @Inject
    constructor() {
        private var cachedKey: SecretKey? = null

        @Synchronized
        private fun key(create: Boolean): SecretKey {
            cachedKey?.let { return it }
            val store = KeyStore.getInstance(KEYSTORE).apply { load(null) }
            (store.getKey(ALIAS, null) as? SecretKey)?.let { return it.also { cachedKey = it } }
            check(create) { "The chat encryption key is unavailable." }
            return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE).run {
                init(
                    KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                        .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                        .setKeySize(KEY_BITS)
                        .build(),
                )
                generateKey().also { cachedKey = it }
            }
        }

        fun encrypt(
            bytes: ByteArray,
            scope: String,
        ): ByteArray {
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(Cipher.ENCRYPT_MODE, key(create = true))
            cipher.updateAAD(scope.toByteArray(Charsets.UTF_8))
            check(cipher.iv.size == IV_BYTES)
            return byteArrayOf(VERSION) + cipher.iv + cipher.doFinal(bytes)
        }

        fun decrypt(
            bytes: ByteArray,
            scope: String,
        ): ByteArray {
            require(bytes.size > IV_BYTES + 1 && bytes[0] == VERSION) { "The chat file format is unavailable." }
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(Cipher.DECRYPT_MODE, key(create = false), GCMParameterSpec(TAG_BITS, bytes.copyOfRange(1, IV_BYTES + 1)))
            cipher.updateAAD(scope.toByteArray(Charsets.UTF_8))
            return cipher.doFinal(bytes, IV_BYTES + 1, bytes.size - IV_BYTES - 1)
        }

        private companion object {
            const val KEYSTORE = "AndroidKeyStore"
            const val ALIAS = "pantopus_chat_files_v1"
            const val TRANSFORMATION = "AES/GCM/NoPadding"
            const val KEY_BITS = 256
            const val TAG_BITS = 128
            const val IV_BYTES = 12
            const val VERSION: Byte = 1
        }
    }
