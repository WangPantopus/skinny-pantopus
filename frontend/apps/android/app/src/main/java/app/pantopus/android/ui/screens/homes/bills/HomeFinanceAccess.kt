@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.bills

import app.pantopus.android.data.api.models.homes.HomeAccessDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.TokenStorage
import app.pantopus.android.data.homes.HomeAdminRepository
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.emptyFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import retrofit2.Retrofit
import java.security.MessageDigest
import javax.inject.Inject

internal const val FINANCE_SESSION_CHANGED = "Your session changed. Reopen Bills to continue."
internal const val FINANCE_DENIED = "You don't have permission for this bill action."

data class HomeFinanceIdentity(val userId: String, val session: String, val apiOrigin: String)

data class HomeFinanceRights(
    val canView: Boolean = false,
    val canManage: Boolean = false,
    val invalidated: Boolean = false,
)

/** The actual injected API origin and immutable opening session own each screen. */
class HomeFinanceAccessFactory
    @Inject
    constructor(
        private val admin: HomeAdminRepository,
        private val tokens: TokenStorage,
        private val retrofit: Retrofit,
    ) {
        fun create(
            homeId: String,
            scope: CoroutineScope,
        ): HomeFinanceAccess =
            HomeFinanceAccess(
                scope = scope,
                loadAccess = { admin.myAccess(homeId) },
                identity = { currentIdentity() },
                identityChanges = tokens.accessTokenFlow.map { Unit },
            )

        private suspend fun currentIdentity(): HomeFinanceIdentity? {
            val account = tokens.sessionIdentity() ?: return null
            // Old valid sessions may lack session_id. A memory-only token
            // digest fences their replacement without denying every old login.
            val session =
                account.second ?: tokens.accessToken()?.let { token ->
                    MessageDigest.getInstance("SHA-256").digest(token.toByteArray()).joinToString("") { "%02x".format(it) }
                } ?: return null
            if (tokens.sessionIdentity() != account) return null
            return HomeFinanceIdentity(account.first, session, retrofit.baseUrl().toString())
        }
    }

/** Effective permission checks supplement, never replace, server authorization. */
class HomeFinanceAccess(
    scope: CoroutineScope,
    private val loadAccess: suspend () -> NetworkResult<HomeAccessDto>,
    private val identity: suspend () -> HomeFinanceIdentity?,
    identityChanges: Flow<Unit> = emptyFlow(),
) {
    private val _rights = MutableStateFlow(HomeFinanceRights())
    val rights = _rights.asStateFlow()
    private val openingIdentity = scope.async(start = CoroutineStart.UNDISPATCHED) { readIdentity() }
    private var generation = 0

    init {
        scope.launch {
            identityChanges.collect {
                if (!sameIdentity()) invalidate()
            }
        }
    }

    suspend fun refresh(managing: Boolean = false) {
        val revision = ++generation
        if (!_rights.value.invalidated) _rights.value = HomeFinanceRights()
        checkIdentity()
        val result = loadAccess()
        checkIdentity()
        check(revision == generation) { "Bill permissions changed. Try again." }
        when (result) {
            is NetworkResult.Success -> {
                val view = result.data.can("finance.view")
                _rights.value = HomeFinanceRights(view, view && result.data.can("finance.manage"))
                require(managing)
            }
            is NetworkResult.Failure -> error(result.error.message)
        }
    }

    suspend fun require(managing: Boolean = false) {
        checkIdentity()
        check(if (managing) _rights.value.canManage else _rights.value.canView) { FINANCE_DENIED }
    }

    private suspend fun checkIdentity() {
        if (_rights.value.invalidated || !sameIdentity()) {
            invalidate()
            error(FINANCE_SESSION_CHANGED)
        }
    }

    private suspend fun sameIdentity(): Boolean {
        val initial = openingIdentity.await()
        return initial != null && readIdentity() == initial
    }

    private suspend fun readIdentity(): HomeFinanceIdentity? =
        try {
            identity()
        } catch (error: CancellationException) {
            throw error
        } catch (_: Exception) {
            null
        }

    private fun invalidate() {
        generation++
        _rights.value = HomeFinanceRights(invalidated = true)
    }
}
