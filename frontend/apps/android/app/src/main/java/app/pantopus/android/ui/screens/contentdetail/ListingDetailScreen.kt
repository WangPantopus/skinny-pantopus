@file:Suppress("MagicNumber", "PackageNaming", "LongMethod")
@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package app.pantopus.android.ui.screens.contentdetail

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.screens.settings.payments.StripePaymentSheets
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import com.stripe.android.paymentsheet.rememberPaymentSheet

@Composable
fun ListingDetailScreen(
    onBack: () -> Unit = {},
    onOpenMessages: (app.pantopus.android.data.api.models.listings.ListingDto) -> Unit = {},
    onViewOffers: ((app.pantopus.android.data.api.models.listings.ListingDto) -> Unit)? = null,
    onEditListing: ((app.pantopus.android.data.api.models.listings.ListingDto) -> Unit)? = null,
    /** A sold listing's "Find similar": the host opens the marketplace. */
    onFindSimilar: (() -> Unit)? = null,
    viewModel: ListingDetailViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val saved by viewModel.saved.collectAsStateWithLifecycle()
    val context = LocalContext.current
    var sheetVisible by remember { mutableStateOf(false) }
    val sheetState = rememberModalBottomSheetState()
    // One offer request at a time; a refused offer keeps the sheet open with the server's reason.
    var offerSending by remember { mutableStateOf(false) }
    var offerError by remember { mutableStateOf<String?>(null) }
    var toastText by remember { mutableStateOf<String?>(null) }
    var toastIsError by remember { mutableStateOf(false) }

    val showCheckoutError: (String) -> Unit = { message ->
        toastIsError = true
        toastText = message
    }
    val paymentSheet =
        rememberPaymentSheet { result ->
            viewModel.onCheckoutOutcome(StripePaymentSheets.checkoutOutcome(result), showCheckoutError)
        }
    val continueCheckout = {
        viewModel.continueCheckout(
            onReady = { params ->
                paymentSheet.presentWithPaymentIntent(
                    paymentIntentClientSecret = params.clientSecret.orEmpty(),
                    configuration =
                        StripePaymentSheets.paymentConfiguration(
                            context = context,
                            customerId = params.customer,
                            ephemeralKey = params.ephemeralKey,
                            publishableKey = params.publishableKey,
                        ),
                )
            },
            onError = showCheckoutError,
        )
    }

    LaunchedEffect(Unit) { viewModel.load() }
    LaunchedEffect(toastText) {
        if (toastText != null) {
            kotlinx.coroutines.delay(2_500)
            toastText = null
        }
    }

    val openMessages: () -> Unit = {
        viewModel.listingSnapshot()?.let { onOpenMessages(it) }
    }

    // Owner-only overflow: "Edit listing" surfaces here so the dock can
    // stay clean ("Message" + "View offers"). Buyers see no overflow.
    val overflowItems =
        if (onEditListing != null && viewModel.isOwnedByMe()) {
            val listing = viewModel.listingSnapshot()
            if (listing != null) {
                listOf(
                    ContentDetailOverflowItem(
                        label = "Edit listing",
                        testTag = "listingDetailEditListing",
                        onClick = { onEditListing(listing) },
                    ),
                )
            } else {
                emptyList()
            }
        } else {
            emptyList()
        }

    ContentDetailShell(
        state = state,
        onBack = onBack,
        onPrimaryAction = {
            val listing = viewModel.listingSnapshot()
            if (viewModel.hasCheckoutAction()) {
                continueCheckout()
            } else if (viewModel.isSold()) {
                // A sold listing's "Find similar" browses the marketplace; a sold listing takes no offers.
                onFindSimilar?.invoke()
            } else if (listing != null && viewModel.isOwnedByMe() && onViewOffers != null) {
                onViewOffers(listing)
            } else {
                offerError = null
                sheetVisible = true
            }
        },
        onSecondaryAction = openMessages,
        onRetry = { viewModel.load() },
        onMessageCounterparty = openMessages,
        overflowItems = overflowItems,
        onGlassAction = { icon ->
            onListingGlassAction(icon, context, viewModel) { message ->
                toastIsError = true
                toastText = message
            }
        },
        activeGlassActions = setOfNotNull(PantopusIcon.Bookmark.takeIf { saved }),
    )

    if (sheetVisible) {
        ModalBottomSheet(
            onDismissRequest = { sheetVisible = false },
            sheetState = sheetState,
        ) {
            val isFree = viewModel.listingSnapshot()?.isFree == true
            OfferSheetContent(
                isFree = isFree,
                askingPrice = viewModel.listingSnapshot()?.price,
                sending = offerSending,
                errorText = offerError,
                onSubmit = { amount, message ->
                    if (!offerSending) {
                        offerSending = true
                        offerError = null
                        viewModel.makeOffer(amount, message, onFailure = { offerError = it }) { ok ->
                            offerSending = false
                            if (ok) {
                                sheetVisible = false
                                toastIsError = false
                                toastText = if (isFree) "Interest sent" else "Offer sent"
                            }
                        }
                    }
                },
            )
        }
    }

    toastText?.let { text ->
        Box(
            modifier = Modifier.fillMaxWidth(),
            contentAlignment = Alignment.BottomCenter,
        ) {
            Box(
                modifier =
                    Modifier
                        .padding(Spacing.s4)
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(if (toastIsError) PantopusColors.error else PantopusColors.success)
                        .padding(horizontal = Spacing.s4, vertical = Spacing.s2)
                        .testTag("listing-detail-toast"),
            ) {
                Text(
                    text = text,
                    style = PantopusTextStyle.small,
                    color = PantopusColors.appTextInverse,
                )
            }
        }
    }
}

/** The cover's chips: share sends the listing's web link (as the gig detail shares); the bookmark saves or unsaves it. */
private fun onListingGlassAction(
    icon: PantopusIcon,
    context: android.content.Context,
    viewModel: ListingDetailViewModel,
    onError: (String) -> Unit,
) {
    when (icon) {
        PantopusIcon.Share -> viewModel.listingSnapshot()?.let { shareListing(context, it) }
        PantopusIcon.Bookmark -> viewModel.toggleSave(onError)
        else -> Unit
    }
}

private fun shareListing(
    context: android.content.Context,
    listing: app.pantopus.android.data.api.models.listings.ListingDto,
) {
    val url = ListingDetailViewModel.shareUrl(listing.id)
    val intent =
        android.content.Intent(android.content.Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(
                android.content.Intent.EXTRA_TEXT,
                if (listing.title.isNullOrEmpty()) url else "${listing.title} — $url",
            )
        }
    context.startActivity(android.content.Intent.createChooser(intent, "Share listing"))
}

@Composable
private fun OfferSheetContent(
    isFree: Boolean,
    askingPrice: Double?,
    sending: Boolean,
    errorText: String?,
    onSubmit: (Double?, String?) -> Unit,
) {
    // Starts at the asking price, as on web; a free listing sends interest without an amount.
    val initialAmount = askingPrice?.takeIf { it > 0 && !isFree }?.let { if (it % 1.0 == 0.0) it.toLong().toString() else it.toString() }
    var amountField by remember { mutableStateOf(TextFieldValue(initialAmount.orEmpty())) }
    var messageField by remember { mutableStateOf(TextFieldValue("")) }
    Column(
        modifier = Modifier.fillMaxWidth().padding(Spacing.s5),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Text(text = "Make an offer", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appText)
        Text(
            text = "Send the seller your offer. Pickup details get worked out in chat.",
            fontSize = 13.sp,
            color = PantopusColors.appTextSecondary,
        )
        if (!isFree) {
            OutlinedTextField(
                value = amountField,
                onValueChange = { amountField = it },
                label = { Text("Offer amount") },
                singleLine = true,
                keyboardOptions =
                    androidx.compose.foundation.text.KeyboardOptions(keyboardType = KeyboardType.Decimal),
                modifier = Modifier.fillMaxWidth(),
            )
        }
        OutlinedTextField(
            value = messageField,
            onValueChange = { messageField = it },
            label = { Text("Message (optional)") },
            minLines = 2,
            maxLines = 4,
            modifier = Modifier.fillMaxWidth(),
        )
        errorText?.let {
            Text(
                text = it,
                style = PantopusTextStyle.small,
                color = PantopusColors.error,
                modifier = Modifier.testTag("listingDetail.offerError"),
            )
        }
        Spacer(modifier = Modifier.height(Spacing.s1))
        val amount = amountField.text.trim().replace(",", ".").toDoubleOrNull()
        val canSubmit = !sending && (isFree || (amount != null && amount > 0))
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(if (canSubmit) PantopusColors.primary600 else PantopusColors.appBorder)
                    .clickable(enabled = canSubmit) {
                        onSubmit(if (isFree) null else amount, messageField.text.trim().ifEmpty { null })
                    }
                    .heightIn(min = 48.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = if (sending) "Sending…" else "Send",
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appTextInverse,
            )
        }
        Spacer(modifier = Modifier.height(Spacing.s5))
    }
}
