package app.pantopus.android.ui.screens.settings.storage

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.storage.StorageLimit
import app.pantopus.android.data.storage.StorageUsage
import app.pantopus.android.ui.components.ToastKind
import app.pantopus.android.ui.components.ToastMessage
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Settings → This phone → Storage & data (Instant Screens contract §7): what Pantopus keeps on this phone (photos,
 * saved pages, drafts and uploads in progress), Clear cache, and the one limit for photos and saved pages. Clear cache
 * never touches drafts, uploads in progress, unfinished actions (refund and stop records), the sign-in or settings.
 * iOS `StorageDataViewModel`.
 */
@HiltViewModel
class StorageDataViewModel
    @Inject
    constructor(
        private val usage: StorageUsage,
        private val limit: StorageLimit,
    ) : ViewModel() {
        private val _sizes = MutableStateFlow<StorageUsage.Sizes?>(null)

        /** Null until measured. */
        val sizes: StateFlow<StorageUsage.Sizes?> = _sizes.asStateFlow()

        private val _limitMegabytes = MutableStateFlow(limit.megabytes)
        val limitMegabytes: StateFlow<Int> = _limitMegabytes.asStateFlow()

        private val _clearing = MutableStateFlow(false)
        val clearing: StateFlow<Boolean> = _clearing.asStateFlow()

        private val _toast = MutableStateFlow<ToastMessage?>(null)
        val toast: StateFlow<ToastMessage?> = _toast.asStateFlow()

        /** Entry and every return: the sizes are measured again (the cache grows while other screens are open). */
        fun load() {
            viewModelScope.launch { _sizes.value = usage.measure() }
        }

        fun setLimit(megabytes: Int) {
            limit.megabytes = megabytes
            _limitMegabytes.value = limit.megabytes
        }

        /** Photos and saved pages go; the toast says how much that freed. A second tap while clearing does nothing. */
        fun clearCache() {
            if (_clearing.value) return
            _clearing.value = true
            viewModelScope.launch {
                try {
                    val before = usage.measure()
                    usage.clearCache()
                    val after = usage.measure()
                    _sizes.value = after
                    val freed = (before.clearable - after.clearable).coerceAtLeast(0L)
                    _toast.value = ToastMessage("Cleared ${StorageUsage.format(freed)}", ToastKind.Success)
                } finally {
                    _clearing.value = false
                }
            }
        }

        fun consumeToast() {
            _toast.value = null
        }
    }
