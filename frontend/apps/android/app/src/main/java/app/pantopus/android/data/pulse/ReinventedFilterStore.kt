package app.pantopus.android.data.pulse

import android.content.Context
import app.pantopus.android.data.api.models.reinvented.ReinventedFilters
import app.pantopus.android.data.auth.AuthRepository
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton

/**
 * The new Pulse's filters ("Pulse, reinvented" PHASE-5 B, CONTRACT 10a), one choice for the List and the Map, kept on the
 * phone per person (another account starts with none; signed out, none). Nothing is kept until a filter is chosen.
 */
@Singleton
class ReinventedFilterStore
    @Inject
    constructor(
        @ApplicationContext context: Context,
        private val auth: AuthRepository,
    ) {
        private val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        private val _filters = MutableStateFlow(ReinventedFilters())
        private var userId: String? = null

        /** What is on now; empty: today's requests. */
        val filters: StateFlow<ReinventedFilters> = _filters.asStateFlow()

        init {
            CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate).launch {
                auth.state.collect { state ->
                    val id = (state as? AuthRepository.State.SignedIn)?.user?.id
                    if (id == userId) return@collect
                    userId = id
                    _filters.value = id?.let(::load) ?: ReinventedFilters()
                }
            }
        }

        fun set(filters: ReinventedFilters) {
            _filters.value = filters
            val id = userId ?: return
            if (filters.isEmpty && !prefs.contains("$id$KINDS")) return
            prefs.edit()
                .putStringSet("$id$KINDS", filters.kinds)
                .putString("$id$WHEN", filters.whenKey)
                .putString("$id$FROM", filters.from)
                .putStringSet("$id$STATE", filters.state)
                .putString("$id$SINCE", filters.since)
                .apply()
        }

        fun clear() = set(ReinventedFilters())

        private fun load(id: String): ReinventedFilters =
            ReinventedFilters(
                kinds = prefs.getStringSet("$id$KINDS", null).orEmpty().filter { it in ReinventedFilters.KINDS }.toSet(),
                whenKey = prefs.getString("$id$WHEN", null)?.takeIf { it in ReinventedFilters.WHENS },
                from = prefs.getString("$id$FROM", null)?.takeIf { it == ReinventedFilters.CONNECTIONS },
                state = prefs.getStringSet("$id$STATE", null).orEmpty().filter { it in ReinventedFilters.STATES }.toSet(),
                since = prefs.getString("$id$SINCE", null),
            )

        private companion object {
            const val PREFS = "pulse_reinvented_filters"
            const val KINDS = ".kinds"
            const val WHEN = ".when"
            const val FROM = ".from"
            const val STATE = ".state"
            const val SINCE = ".since"
        }
    }
