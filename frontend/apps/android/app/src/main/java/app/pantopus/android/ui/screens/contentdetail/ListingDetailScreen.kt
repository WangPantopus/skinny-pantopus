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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

@Composable
fun ListingDetailScreen(
    onBack: () -> Unit = {},
    onOpenMessages: (app.pantopus.android.data.api.models.listings.ListingDto) -> Unit = {},
    onViewOffers: ((app.pantopus.android.data.api.models.listings.ListingDto) -> Unit)? = null,
    onEditListing: ((app.pantopus.android.data.api.models.listings.ListingDto) -> Unit)? = null,
    viewModel: ListingDetailViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    var sheetVisible by remember { mutableStateOf(false) }
    val sheetState = rememberModalBottomSheetState()

    LaunchedEffect(Unit) { viewModel.load() }

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
            if (listing != null && viewModel.isOwnedByMe() && onViewOffers != null) {
                onViewOffers(listing)
            } else {
                sheetVisible = true
            }
        },
        onSecondaryAction = openMessages,
        onRetry = { viewModel.load() },
        onMessageCounterparty = openMessages,
        overflowItems = overflowItems,
    )

    if (sheetVisible) {
        ModalBottomSheet(
            onDismissRequest = { sheetVisible = false },
            sheetState = sheetState,
        ) {
            OfferSheetContent(
                onSubmit = { amount, message ->
                    viewModel.sendMessage(message, amount) { ok ->
                        if (ok) sheetVisible = false
                    }
                },
            )
        }
    }
}

@Composable
private fun OfferSheetContent(onSubmit: (Double?, String) -> Unit) {
    var amountField by remember { mutableStateOf(TextFieldValue("")) }
    var messageField by remember { mutableStateOf(TextFieldValue("")) }
    Column(
        modifier = Modifier.fillMaxWidth().padding(Spacing.s5),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Text(text = "Make an offer", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appText)
        Text(
            text = "Send the seller a message with your offer. Pickup details get worked out in chat.",
            fontSize = 13.sp,
            color = PantopusColors.appTextSecondary,
        )
        OutlinedTextField(
            value = amountField,
            onValueChange = { amountField = it },
            label = { Text("Offer amount (optional)") },
            singleLine = true,
            keyboardOptions =
                androidx.compose.foundation.text.KeyboardOptions(keyboardType = KeyboardType.Decimal),
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = messageField,
            onValueChange = { messageField = it },
            label = { Text("Message") },
            minLines = 2,
            maxLines = 4,
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(modifier = Modifier.height(Spacing.s1))
        val canSubmit = messageField.text.isNotEmpty()
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(if (canSubmit) PantopusColors.primary600 else PantopusColors.appBorder)
                    .clickable(enabled = canSubmit) {
                        onSubmit(amountField.text.toDoubleOrNull(), messageField.text)
                    }
                    .heightIn(min = 48.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text(text = "Send", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appTextInverse)
        }
        Spacer(modifier = Modifier.height(Spacing.s5))
    }
}
