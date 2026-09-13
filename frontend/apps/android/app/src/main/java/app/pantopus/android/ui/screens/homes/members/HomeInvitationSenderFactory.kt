package app.pantopus.android.ui.screens.homes.members

import app.pantopus.android.data.api.services.HomeInvitationSenderApi
import app.pantopus.android.data.homes.APIHomeInvitationSenderTransport
import app.pantopus.android.data.homes.HomeCreationScope
import app.pantopus.android.data.homes.HomeInvitationSenderCodec
import app.pantopus.android.data.homes.PersistentPendingHomeInvitationSenderStore
import app.pantopus.android.data.homes.homeInvitationSenderRows
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimSessionScope
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimSessionScopeFactory
import com.squareup.moshi.Moshi
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.cancelChildren
import kotlinx.coroutines.coroutineScope
import retrofit2.Retrofit
import javax.inject.Inject

class HomeInvitationSenderFactory
    @Inject
    constructor(
        private val store: PersistentPendingHomeInvitationSenderStore,
        private val retrofit: Retrofit,
        private val sessions: HomeClaimSessionScopeFactory,
        moshi: Moshi,
    ) {
        val codec = HomeInvitationSenderCodec(moshi)
        private val api = retrofit.create(HomeInvitationSenderApi::class.java)
        private val transport = APIHomeInvitationSenderTransport(api, codec)

        suspend fun list(homeId: String) =
            coroutineScope {
                val session = sessions.create(this)
                try {
                    session.requireCurrent()
                    val scope = HomeCreationScope(retrofit.baseUrl().toString(), session.actorId.orEmpty().lowercase())
                    val serverSession = transport.session(scope)
                    session.requireCurrent()
                    val response = api.list(homeId, serverSession)
                    val json = checkNotNull(response.body() ?: response.errorBody()).use { it.string() }
                    session.requireCurrent()
                    check(response.isSuccessful)
                    val row = codec.objectFrom(json)
                    check(codec.session(row["session"], scope) == serverSession)
                    homeInvitationSenderRows(row["invitations"], homeId)
                } finally {
                    coroutineContext.cancelChildren()
                }
            }

        fun session(scope: CoroutineScope): HomeClaimSessionScope = sessions.create(scope)

        fun create(session: HomeClaimSessionScope) =
            HomeInvitationSenderCoordinator(
                HomeCreationScope(retrofit.baseUrl().toString(), session.actorId.orEmpty().lowercase()),
                store,
                codec,
                transport,
                session::requireCurrent,
            )
    }
