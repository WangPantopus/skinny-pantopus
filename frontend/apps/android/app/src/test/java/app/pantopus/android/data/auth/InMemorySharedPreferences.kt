package app.pantopus.android.data.auth

import android.content.SharedPreferences

/**
 * Complete in-memory [SharedPreferences] for JVM unit tests (no Robolectric).
 * Shared by `TokenStorageTest`, `DeviceIdentityTest` and the auth
 * repository tests. `commit()` / `apply()` are synchronous.
 */
class InMemorySharedPreferences : SharedPreferences {
    private val data = linkedMapOf<String, Any?>()

    override fun getString(
        key: String?,
        defValue: String?,
    ): String? = (data[key] as? String) ?: defValue

    override fun getBoolean(
        key: String?,
        defValue: Boolean,
    ): Boolean = (data[key] as? Boolean) ?: defValue

    override fun getInt(
        key: String?,
        defValue: Int,
    ): Int = (data[key] as? Int) ?: defValue

    override fun getLong(
        key: String?,
        defValue: Long,
    ): Long = (data[key] as? Long) ?: defValue

    override fun getFloat(
        key: String?,
        defValue: Float,
    ): Float = (data[key] as? Float) ?: defValue

    @Suppress("UNCHECKED_CAST")
    override fun getStringSet(
        key: String?,
        defValues: MutableSet<String>?,
    ): MutableSet<String>? = (data[key] as? MutableSet<String>) ?: defValues

    override fun contains(key: String?): Boolean = data.containsKey(key)

    override fun getAll(): MutableMap<String, *> = data.toMutableMap()

    override fun registerOnSharedPreferenceChangeListener(listener: SharedPreferences.OnSharedPreferenceChangeListener?) = Unit

    override fun unregisterOnSharedPreferenceChangeListener(listener: SharedPreferences.OnSharedPreferenceChangeListener?) = Unit

    override fun edit(): SharedPreferences.Editor = Editor()

    private inner class Editor : SharedPreferences.Editor {
        private val ops = mutableListOf<() -> Unit>()

        private fun put(
            key: String?,
            value: Any?,
        ): SharedPreferences.Editor {
            ops += { data[requireNotNull(key)] = value }
            return this
        }

        override fun putString(
            key: String?,
            value: String?,
        ): SharedPreferences.Editor = put(key, value)

        override fun putBoolean(
            key: String?,
            value: Boolean,
        ): SharedPreferences.Editor = put(key, value)

        override fun putInt(
            key: String?,
            value: Int,
        ): SharedPreferences.Editor = put(key, value)

        override fun putLong(
            key: String?,
            value: Long,
        ): SharedPreferences.Editor = put(key, value)

        override fun putFloat(
            key: String?,
            value: Float,
        ): SharedPreferences.Editor = put(key, value)

        override fun putStringSet(
            key: String?,
            values: MutableSet<String>?,
        ): SharedPreferences.Editor = put(key, values?.toMutableSet())

        override fun remove(key: String?): SharedPreferences.Editor {
            ops += { data.remove(key) }
            return this
        }

        override fun clear(): SharedPreferences.Editor {
            ops += { data.clear() }
            return this
        }

        override fun commit(): Boolean {
            ops.forEach { it() }
            ops.clear()
            return true
        }

        override fun apply() {
            commit()
        }
    }
}
