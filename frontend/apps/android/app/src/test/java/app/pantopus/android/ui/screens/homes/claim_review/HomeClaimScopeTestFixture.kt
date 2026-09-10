@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.claim_review

import app.pantopus.android.data.auth.TokenStorage
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow

internal class HomeClaimScopeTestFixture {
    val tokens = MutableStateFlow<String?>("opening-token")
    val accounts = MutableStateFlow<String?>("user-1")
    var storedToken: String? = "opening-token"
    var storedAccount: String? = "user-1"
    var storedReadFailure: Exception? = null
}

internal fun claimScopeFactory(session: HomeClaimScopeTestFixture = HomeClaimScopeTestFixture()): HomeClaimSessionScopeFactory =
    mockk<HomeClaimSessionScopeFactory>().also { factory ->
        every { factory.create(any()) } answers {
            HomeClaimSessionScope(firstArg<CoroutineScope>(), session.tokens, {
                session.accounts.value
            }, session.accounts, "https://claim.example.invalid") {
                session.storedReadFailure?.let { throw it }
                val token = session.storedToken
                val actor = session.storedAccount
                if (token == null || actor == null) null else TokenStorage.SessionCredentials(actor, null, token)
            }
        }
    }
