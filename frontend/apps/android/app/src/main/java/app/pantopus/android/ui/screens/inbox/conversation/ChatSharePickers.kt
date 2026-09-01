@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.inbox.conversation

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import coil.compose.AsyncImage

/**
 * Attachment sheet mirroring the RN share grid
 * (`apps/mobile/src/components/chat/ChatAttachmentSheet.tsx`): centered
 * "Share" title over tinted icon tiles. Camera capture rides
 * `TakePicture()` against the app FileProvider with a runtime CAMERA
 * permission request — wired by the conversation screen's [onCamera].
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun ChatAttachSheet(
    onDismiss: () -> Unit,
    onCamera: () -> Unit,
    onPhotos: () -> Unit,
    onDocument: () -> Unit,
    onLocation: () -> Unit,
    onGig: () -> Unit,
    onListing: () -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = PantopusColors.appSurface,
    ) {
        val options =
            listOf(
                AttachGridItem("Camera", PantopusIcon.Camera, PantopusColors.warningBg, PantopusColors.warning) {
                    onDismiss()
                    onCamera()
                },
                AttachGridItem("Photos", PantopusIcon.Image, PantopusColors.successBg, PantopusColors.success) {
                    onDismiss()
                    onPhotos()
                },
                AttachGridItem("Location", PantopusIcon.MapPin, PantopusColors.errorBg, PantopusColors.error) {
                    onDismiss()
                    onLocation()
                },
                AttachGridItem("Document", PantopusIcon.FileText, PantopusColors.primary50, PantopusColors.primary600) {
                    onDismiss()
                    onDocument()
                },
                AttachGridItem("Task", PantopusIcon.Briefcase, PantopusColors.businessBg, PantopusColors.business) {
                    onDismiss()
                    onGig()
                },
                AttachGridItem("Marketplace", PantopusIcon.ShoppingBag, PantopusColors.successBg, PantopusColors.success) {
                    onDismiss()
                    onListing()
                },
            )
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = Spacing.s6)
                    .padding(bottom = Spacing.s6)
                    .testTag("chatAttachSheet"),
            verticalArrangement = Arrangement.spacedBy(Spacing.s4),
        ) {
            Text(
                text = "Share",
                modifier = Modifier.fillMaxWidth(),
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
                textAlign = TextAlign.Center,
            )
            options.chunked(3).forEach { rowOptions ->
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s4),
                ) {
                    rowOptions.forEach { option -> AttachGridOption(item = option) }
                }
            }
        }
    }
}

private data class AttachGridItem(
    val label: String,
    val icon: PantopusIcon,
    val tileColor: Color,
    val iconColor: Color,
    val onClick: () -> Unit,
)

@Composable
private fun AttachGridOption(item: AttachGridItem) {
    Column(
        modifier =
            Modifier
                .width(72.dp)
                .clip(RoundedCornerShape(Radii.lg))
                .clickable(onClick = item.onClick)
                .testTag("chatAttachOption_${item.label}"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Box(
            modifier =
                Modifier
                    .size(56.dp)
                    .clip(RoundedCornerShape(Radii.xl))
                    .background(item.tileColor),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = item.icon,
                contentDescription = null,
                size = 26.dp,
                tint = item.iconColor,
            )
        }
        Text(
            text = item.label,
            fontSize = 12.sp,
            fontWeight = FontWeight.Medium,
            color = PantopusColors.appTextStrong,
            maxLines = 1,
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun ChatShareGigPickerSheet(
    gigs: List<ChatShareGigOption>,
    isLoading: Boolean,
    error: String?,
    onDismiss: () -> Unit,
    onSelect: (ChatShareGigOption) -> Unit,
    onLoad: () -> Unit,
) {
    LaunchedEffect(Unit) { onLoad() }
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = PantopusColors.appSurface,
    ) {
        Column(modifier = Modifier.fillMaxWidth().padding(bottom = Spacing.s4)) {
            Text(
                text = "Share a Task",
                modifier = Modifier.padding(horizontal = Spacing.s4, vertical = Spacing.s3),
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
            )
            when {
                isLoading ->
                    CircularProgressIndicator(
                        modifier = Modifier.align(Alignment.CenterHorizontally).padding(Spacing.s6),
                        color = PantopusColors.primary600,
                    )
                error != null ->
                    Text(
                        text = error,
                        modifier = Modifier.padding(horizontal = Spacing.s4),
                        color = PantopusColors.appTextSecondary,
                    )
                gigs.isEmpty() ->
                    Text(
                        text = "No tasks to share yet.",
                        modifier = Modifier.padding(horizontal = Spacing.s4),
                        color = PantopusColors.appTextSecondary,
                    )
                else ->
                    LazyColumn {
                        items(gigs, key = { it.id }) { gig ->
                            Row(
                                modifier =
                                    Modifier
                                        .fillMaxWidth()
                                        .clickable { onSelect(gig) }
                                        .padding(horizontal = Spacing.s4, vertical = Spacing.s3),
                                verticalAlignment = Alignment.Top,
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = gig.title,
                                        fontSize = 15.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        color = PantopusColors.appText,
                                        maxLines = 2,
                                        overflow = TextOverflow.Ellipsis,
                                    )
                                    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                                        gig.category?.let {
                                            Text(it, fontSize = 12.sp, color = PantopusColors.appTextSecondary)
                                        }
                                        gig.price?.let {
                                            Text("$$${it.toInt()}", fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                                        }
                                    }
                                }
                            }
                        }
                    }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun ChatShareListingPickerSheet(
    listings: List<ChatShareListingOption>,
    isLoading: Boolean,
    error: String?,
    onDismiss: () -> Unit,
    onSelect: (ChatShareListingOption) -> Unit,
    onLoad: () -> Unit,
) {
    LaunchedEffect(Unit) { onLoad() }
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = PantopusColors.appSurface,
    ) {
        Column(modifier = Modifier.fillMaxWidth().padding(bottom = Spacing.s4)) {
            Text(
                text = "Share a Listing",
                modifier = Modifier.padding(horizontal = Spacing.s4, vertical = Spacing.s3),
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
            )
            when {
                isLoading ->
                    CircularProgressIndicator(
                        modifier = Modifier.align(Alignment.CenterHorizontally).padding(Spacing.s6),
                        color = PantopusColors.primary600,
                    )
                error != null ->
                    Text(
                        text = error,
                        modifier = Modifier.padding(horizontal = Spacing.s4),
                        color = PantopusColors.appTextSecondary,
                    )
                listings.isEmpty() ->
                    Text(
                        text = "No listings to share yet.",
                        modifier = Modifier.padding(horizontal = Spacing.s4),
                        color = PantopusColors.appTextSecondary,
                    )
                else ->
                    LazyColumn {
                        items(listings, key = { it.id }) { listing ->
                            Row(
                                modifier =
                                    Modifier
                                        .fillMaxWidth()
                                        .clickable { onSelect(listing) }
                                        .padding(horizontal = Spacing.s4, vertical = Spacing.s3),
                                horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
                                verticalAlignment = Alignment.Top,
                            ) {
                                listing.imageUrl?.let { imageUrl ->
                                    AsyncImage(
                                        model = imageUrl,
                                        contentDescription = null,
                                        contentScale = ContentScale.Crop,
                                        modifier = Modifier.size(48.dp).clip(RoundedCornerShape(Radii.md)),
                                    )
                                }
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = listing.title,
                                        fontSize = 15.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        color = PantopusColors.appText,
                                        maxLines = 2,
                                        overflow = TextOverflow.Ellipsis,
                                    )
                                    Text(
                                        text =
                                            if (listing.isFree) {
                                                "FREE"
                                            } else {
                                                listing.price?.let { "$${it.toInt()}" } ?: "Make Offer"
                                            },
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        color = PantopusColors.appText,
                                    )
                                }
                            }
                        }
                    }
            }
        }
    }
}
