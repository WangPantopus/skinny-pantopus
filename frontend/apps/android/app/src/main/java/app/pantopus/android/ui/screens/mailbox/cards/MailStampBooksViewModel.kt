@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.mailbox.cards

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.mailbox.HolidayCardStamps
import app.pantopus.android.data.api.models.mailbox.StampBalance
import app.pantopus.android.data.api.models.mailbox.StampConfirmation
import app.pantopus.android.data.api.services.HolidayCardsApi
import app.pantopus.android.data.mailbox.HolidayCardsRepository
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.ConsumeParams
import com.android.billingclient.api.PendingPurchasesParams
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryPurchasesParams
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Digital stamps (server `MAIL_STAMPS_ENABLED`): the balance, Google Play's books and buying them, for the card composer
 * and the Stamps wallet. Store receipts are credited by the server before consumption; unfinished purchases are
 * recovered on resume.
 */
@HiltViewModel
class MailStampBooksViewModel
    @Inject
    constructor(
        @ApplicationContext context: Context,
        private val api: HolidayCardsApi,
    ) : ViewModel() {
        var balance by mutableStateOf<StampBalance?>(null)
            private set
        var products by mutableStateOf<List<ProductDetails>>(emptyList())
            private set

        /** Google Play answered about the books (or couldn't be reached): until then the sheet keeps their places. */
        var storeAnswered by mutableStateOf(false)
            private set
        var message by mutableStateOf<String?>(null)
            private set
        var busy by mutableStateOf(false)
            private set

        /** The Stamps wallet reads the latest stamp moves and the stamps used with every balance. */
        var withHistory = false
        private val processing = mutableSetOf<String>()
        private var connecting = false
        private val client =
            BillingClient.newBuilder(context)
                .setListener { result, purchases ->
                    busy = false
                    if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                        purchases.orEmpty().forEach(::process)
                    } else if (result.responseCode != BillingClient.BillingResponseCode.USER_CANCELED) {
                        message = "The purchase couldn’t finish. Tap Check for your stamps before you try again."
                    }
                }
                .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
                .enableAutoServiceReconnection()
                .build()

        val isOut: Boolean get() = balance?.available == 0

        fun refresh() {
            viewModelScope.launch {
                try {
                    read()
                    if (client.isReady) queryStore() else connect()
                } catch (_: Exception) {
                    message = "Could not load your stamps. Try again in a moment."
                }
            }
        }

        /** The balance from the server; the Mailbox's row says the same. */
        private suspend fun read() {
            val read = api.stampBooks(history = "1".takeIf { withHistory })
            balance = read
            HolidayCardsRepository.noteStamps(HolidayCardStamps(read.available, read.freeRemaining, read.paidRemaining))
        }

        private fun connect() {
            if (connecting) return
            connecting = true
            client.startConnection(
                object : BillingClientStateListener {
                    override fun onBillingSetupFinished(result: BillingResult) {
                        connecting = false
                        if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                            queryStore()
                        } else {
                            // The sheet says the books are unavailable in Google Play right now.
                            products = emptyList()
                            storeAnswered = true
                        }
                    }

                    override fun onBillingServiceDisconnected() {
                        busy = false
                        connecting = false
                    }
                },
            )
        }

        private fun queryStore() {
            val books = balance?.books ?: return
            client.queryProductDetailsAsync(
                QueryProductDetailsParams.newBuilder().setProductList(
                    books.map {
                        QueryProductDetailsParams.Product.newBuilder().setProductId(
                            it.id,
                        ).setProductType(BillingClient.ProductType.INAPP).build()
                    },
                ).build(),
            ) { result, details ->
                if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                    products = details.productDetailsList.sortedBy { p -> books.firstOrNull { it.id == p.productId }?.credits }
                }
                storeAnswered = true
            }
            client.queryPurchasesAsync(
                QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build(),
            ) { result, purchases ->
                if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                    busy = false
                    purchases.forEach(::process)
                }
            }
        }

        private fun process(purchase: Purchase) {
            val product = purchase.products.singleOrNull() ?: return
            if (balance?.books?.none { it.id == product } != false) return
            if (purchase.purchaseState == Purchase.PurchaseState.PENDING) {
                message = "Your purchase is waiting for approval. Your stamps arrive once it’s approved."
                return
            }
            if (purchase.purchaseState != Purchase.PurchaseState.PURCHASED || !processing.add(purchase.purchaseToken)) return
            viewModelScope.launch {
                try {
                    api.confirmStamps(StampConfirmation(reference = purchase.purchaseToken, productId = product))
                    client.consumeAsync(ConsumeParams.newBuilder().setPurchaseToken(purchase.purchaseToken).build()) { _, _ ->
                        processing.remove(purchase.purchaseToken)
                    }
                    read()
                    message = "Your stamps are ready."
                } catch (_: Exception) {
                    processing.remove(purchase.purchaseToken)
                    message = "Your purchase is saved. Tap Check for your stamps to finish; you don’t need to pay again."
                }
            }
        }

        fun buy(
            activity: Activity,
            product: ProductDetails,
        ) {
            if (busy || balance?.salesOpen == false) return
            val account = balance?.googleAccount ?: return
            val offer = product.oneTimePurchaseOfferDetails ?: return
            val details =
                BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(product)
                    .apply { offer.offerToken?.let { setOfferToken(it) } }.build()
            busy = true
            message = null
            val result =
                client.launchBillingFlow(
                    activity,
                    BillingFlowParams.newBuilder()
                        .setObfuscatedAccountId(account).setProductDetailsParamsList(listOf(details)).build(),
                )
            if (result.responseCode != BillingClient.BillingResponseCode.OK) {
                busy = false
                message = "Google Play could not open this purchase. Please try again."
            }
        }

        override fun onCleared() {
            client.endConnection()
        }
    }

/** The activity a composable's context belongs to (Google Play's purchase sheet opens over it). */
internal fun Context.activity(): Activity? =
    when (this) {
        is Activity -> this
        is ContextWrapper -> baseContext.activity()
        else -> null
    }
