package app.pantopus.android.data.storage

import android.content.Context
import androidx.core.content.edit
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * The one limit for photos and saved pages together (Instant Screens contract §1 decision 6, §7): 100 MB by default,
 * with 50, 100 or 250 MB to choose from. A setting of the phone, not the account: Clear cache and sign-out keep it.
 * iOS `StorageLimit`.
 */
@Singleton
class StorageLimit
    @Inject
    constructor(
        @ApplicationContext context: Context,
    ) {
        private val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

        /** The chosen limit in MB, one of [CHOICES]. */
        var megabytes: Int
            get() = prefs.getInt(KEY, DEFAULT_MEGABYTES).takeIf { it in CHOICES } ?: DEFAULT_MEGABYTES
            set(value) {
                if (value in CHOICES) prefs.edit { putInt(KEY, value) }
            }

        /** The limit in bytes, counted as the storage screens count them (1 MB = 1,000,000 bytes). */
        val bytes: Long get() = megabytes * BYTES_PER_MEGABYTE

        companion object {
            /** The picker's choices, in MB. */
            val CHOICES = listOf(50, 100, 250)
            const val DEFAULT_MEGABYTES = 100
            const val BYTES_PER_MEGABYTE = 1_000_000L
            private const val PREFS = "pantopus.storage"
            private const val KEY = "limit_mb"
        }
    }
