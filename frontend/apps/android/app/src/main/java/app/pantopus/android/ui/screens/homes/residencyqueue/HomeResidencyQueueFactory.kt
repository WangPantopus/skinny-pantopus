package app.pantopus.android.ui.screens.homes.residencyqueue

import app.pantopus.android.data.api.services.HomeResidencyQueueApi
import app.pantopus.android.data.homes.APIHomeResidencyQueueTransport
import app.pantopus.android.data.homes.HomeCreationScope
import app.pantopus.android.data.homes.HomeResidencyQueueCodec
import app.pantopus.android.data.homes.HomeResidencyQueueTransport
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimSessionScope
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimSessionScopeFactory
import com.squareup.moshi.Moshi
import kotlinx.coroutines.CoroutineScope
import retrofit2.Retrofit
import javax.inject.Inject

class HomeResidencyQueueFactory
    @Inject
    constructor(
        private val retrofit: Retrofit,
        private val sessions: HomeClaimSessionScopeFactory,
        moshi: Moshi,
    ) {
        val transport: HomeResidencyQueueTransport =
            APIHomeResidencyQueueTransport(
                retrofit.create(HomeResidencyQueueApi::class.java),
                HomeResidencyQueueCodec(moshi),
            )

        fun session(scope: CoroutineScope): HomeClaimSessionScope = sessions.create(scope)

        fun identity(session: HomeClaimSessionScope): HomeCreationScope =
            HomeCreationScope(
                retrofit.baseUrl().toString(),
                session.actorId.orEmpty().lowercase(),
            )
    }
