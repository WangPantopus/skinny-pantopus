package app.pantopus.android.data.wallet

import app.pantopus.android.data.api.models.wallet.WalletBalanceResponse
import app.pantopus.android.data.api.models.wallet.WalletPendingReleaseResponse
import app.pantopus.android.data.api.models.wallet.WalletTransactionsResponse
import app.pantopus.android.data.api.models.wallet.WalletWithdrawRequest
import app.pantopus.android.data.api.models.wallet.WalletWithdrawResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.WalletApi
import javax.inject.Inject
import javax.inject.Singleton

/** Wraps the read-path [WalletApi] in the [NetworkResult] taxonomy. */
@Singleton
class WalletRepository
    @Inject
    constructor(
        private val api: WalletApi,
    ) {
        /** `GET /api/wallet`. */
        suspend fun balance(): NetworkResult<WalletBalanceResponse> = safeApiCall { api.balance() }

        /** `GET /api/wallet/transactions`. */
        suspend fun transactions(
            limit: Int = 50,
            offset: Int = 0,
        ): NetworkResult<WalletTransactionsResponse> = safeApiCall { api.transactions(limit, offset) }

        /** `GET /api/wallet/pending-release`. */
        suspend fun pendingRelease(): NetworkResult<WalletPendingReleaseResponse> = safeApiCall { api.pendingRelease() }

        /** `POST /api/wallet/withdraw` — earned funds to bank (Block 3C). */
        suspend fun withdraw(request: WalletWithdrawRequest): NetworkResult<WalletWithdrawResponse> = safeApiCall { api.withdraw(request) }
    }
