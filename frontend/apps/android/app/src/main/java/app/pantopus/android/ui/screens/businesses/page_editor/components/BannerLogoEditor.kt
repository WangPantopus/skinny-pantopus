@file:Suppress("MagicNumber", "PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.businesses.page_editor.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.businesses.page_editor.EditBusinessMediaKind
import app.pantopus.android.ui.screens.businesses.page_editor.EditBusinessPageBannerState
import app.pantopus.android.ui.screens.businesses.page_editor.EditBusinessPageLogoState
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import coil.compose.AsyncImage

/**
 * P4.2 — A13.10 Edit Business Page. Banner + logo composite. Two
 * variants: empty (dashed drop targets) and filled (the uploaded image,
 * or the background palette without one, with optional dirty rim +
 * "New" chip + Change buttons). Each target calls [onPick] to choose a
 * new image; [uploading] dims the one being uploaded.
 */
@Composable
fun EditBusinessBannerLogoEditor(
    banner: EditBusinessPageBannerState,
    logo: EditBusinessPageLogoState,
    modifier: Modifier = Modifier,
    uploading: EditBusinessMediaKind? = null,
    onPick: (EditBusinessMediaKind) -> Unit = {},
) {
    Box(
        modifier =
            modifier
                .fillMaxWidth()
                .testTag("editBusinessPage.bannerLogo"),
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            BannerView(
                banner = banner,
                uploading = uploading == EditBusinessMediaKind.Banner,
                onPick = { if (uploading == null) onPick(EditBusinessMediaKind.Banner) },
            )
            Box(modifier = Modifier.height(44.dp))
        }
        Box(
            modifier =
                Modifier
                    .offset(x = Spacing.s4, y = 116.dp)
                    .align(Alignment.TopStart),
        ) {
            LogoView(
                logo = logo,
                uploading = uploading == EditBusinessMediaKind.Logo,
                onPick = { if (uploading == null) onPick(EditBusinessMediaKind.Logo) },
            )
        }
    }
}

@Composable
private fun BannerView(
    banner: EditBusinessPageBannerState,
    uploading: Boolean,
    onPick: () -> Unit,
) {
    when (banner) {
        EditBusinessPageBannerState.Empty -> EmptyBanner(uploading = uploading, onPick = onPick)
        is EditBusinessPageBannerState.Filled ->
            FilledBanner(dirty = banner.dirty, imageUrl = banner.imageUrl, uploading = uploading, onPick = onPick)
    }
}

/** Dims an image target while its upload runs. */
@Composable
private fun BoxScope.UploadingOverlay() {
    Box(
        modifier =
            Modifier
                .matchParentSize()
                .background(PantopusColors.appText.copy(alpha = 0.6f)),
        contentAlignment = Alignment.Center,
    ) {
        CircularProgressIndicator(
            modifier = Modifier.size(24.dp),
            color = PantopusColors.appTextInverse,
            strokeWidth = 2.dp,
        )
    }
}

@Composable
private fun EmptyBanner(
    uploading: Boolean,
    onPick: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .aspectRatio(16f / 7f)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurfaceSunken)
                .border(
                    width = 1.5.dp,
                    color = PantopusColors.appBorderStrong,
                    shape = RoundedCornerShape(Radii.lg),
                )
                .clickable(onClickLabel = "Add banner", onClick = onPick),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Image,
                contentDescription = null,
                size = 22.dp,
                tint = PantopusColors.appTextSecondary,
            )
            Text(
                text = "Add banner",
                style = TextStyle(fontSize = 12.sp, fontWeight = FontWeight.SemiBold),
                color = PantopusColors.appTextSecondary,
            )
            Text(
                text = "1600 × 700 · JPG or PNG",
                style = TextStyle(fontSize = 10.sp),
                color = PantopusColors.appTextMuted,
            )
        }
        if (uploading) UploadingOverlay()
    }
}

@Composable
private fun FilledBanner(
    dirty: Boolean,
    imageUrl: String?,
    uploading: Boolean,
    onPick: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .aspectRatio(16f / 7f)
                .clip(RoundedCornerShape(Radii.lg))
                .background(
                    Brush.verticalGradient(
                        colors =
                            listOf(
                                PantopusColors.warningLight,
                                PantopusColors.warning,
                                PantopusColors.warmAmber,
                            ),
                    ),
                )
                .then(
                    if (dirty) {
                        Modifier.border(
                            width = 2.dp,
                            color = PantopusColors.warning,
                            shape = RoundedCornerShape(Radii.lg),
                        )
                    } else {
                        Modifier
                    },
                )
                .clickable(onClickLabel = "Change banner", onClick = onPick),
    ) {
        if (imageUrl != null) {
            // Sized by the 16:7 box, so any upload fills it instead of resizing it.
            AsyncImage(
                model = imageUrl,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.matchParentSize(),
            )
        } else {
            // Storefront silhouette — keep it minimal vs the iOS version since
            // the snapshot resolution still reads as a warm-amber band even
            // without per-window geometry.
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .height(56.dp)
                        .align(Alignment.BottomCenter)
                        .background(PantopusColors.appText),
            )
        }
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = Spacing.s2, vertical = Spacing.s2)
                    .align(Alignment.TopStart),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            if (dirty) {
                Row(
                    modifier =
                        Modifier
                            .clip(RoundedCornerShape(Radii.pill))
                            .background(PantopusColors.warning)
                            .padding(horizontal = Spacing.s2, vertical = 3.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = "NEW",
                        style = TextStyle(fontSize = 9.5.sp, fontWeight = FontWeight.Bold),
                        color = PantopusColors.appTextInverse,
                    )
                }
            } else {
                Box(modifier = Modifier.size(0.dp))
            }
            Row(
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(PantopusColors.appText.copy(alpha = 0.7f))
                        .padding(horizontal = Spacing.s2, vertical = 6.dp)
                        .testTag("editBusinessPage.changeBanner"),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(5.dp),
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Image,
                    contentDescription = null,
                    size = 12.dp,
                    tint = PantopusColors.appTextInverse,
                )
                Text(
                    text = "Change banner",
                    style = TextStyle(fontSize = 11.sp, fontWeight = FontWeight.SemiBold),
                    color = PantopusColors.appTextInverse,
                )
            }
        }
        if (uploading) UploadingOverlay()
    }
}

@Composable
private fun LogoView(
    logo: EditBusinessPageLogoState,
    uploading: Boolean,
    onPick: () -> Unit,
) {
    when (logo) {
        EditBusinessPageLogoState.Empty ->
            Box(
                modifier =
                    Modifier
                        .size(76.dp)
                        .clip(RoundedCornerShape(Radii.xl))
                        .background(PantopusColors.appSurface)
                        .border(
                            width = 1.5.dp,
                            color = PantopusColors.appBorderStrong,
                            shape = RoundedCornerShape(Radii.xl),
                        )
                        .clickable(onClickLabel = "Add logo", onClick = onPick)
                        .testTag("editBusinessPage.logoEmpty"),
                contentAlignment = Alignment.Center,
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    PantopusIconImage(
                        icon = PantopusIcon.Plus,
                        contentDescription = null,
                        size = 18.dp,
                        tint = PantopusColors.appTextSecondary,
                    )
                    Text(
                        text = "Logo",
                        style = TextStyle(fontSize = 9.5.sp, fontWeight = FontWeight.SemiBold),
                        color = PantopusColors.appTextSecondary,
                    )
                }
                if (uploading) UploadingOverlay()
            }
        is EditBusinessPageLogoState.Filled ->
            Column(
                modifier =
                    Modifier
                        .clickable(onClickLabel = "Change logo", onClick = onPick)
                        .testTag("editBusinessPage.logoFilled"),
            ) {
                Box(
                    modifier =
                        Modifier
                            .size(76.dp)
                            .clip(RoundedCornerShape(Radii.xl))
                            .background(
                                Brush.radialGradient(
                                    colors =
                                        listOf(
                                            PantopusColors.warningLight,
                                            PantopusColors.warning,
                                            PantopusColors.warmAmber,
                                        ),
                                ),
                            )
                            .border(
                                width = 3.dp,
                                color = PantopusColors.appSurface,
                                shape = RoundedCornerShape(Radii.xl),
                            ),
                    contentAlignment = Alignment.Center,
                ) {
                    if (logo.imageUrl != null) {
                        AsyncImage(
                            model = logo.imageUrl,
                            contentDescription = null,
                            contentScale = ContentScale.Crop,
                            modifier = Modifier.matchParentSize(),
                        )
                    } else {
                        Text(
                            text = logo.initial,
                            style =
                                TextStyle(
                                    fontSize = 28.sp,
                                    fontWeight = FontWeight.Bold,
                                    fontFamily = FontFamily.Serif,
                                ),
                            color = PantopusColors.appTextInverse,
                        )
                    }
                    if (uploading) UploadingOverlay()
                }
                Text(
                    text = "Change logo",
                    style = TextStyle(fontSize = 12.sp, fontWeight = FontWeight.SemiBold),
                    color = PantopusColors.business,
                    modifier = Modifier.padding(start = 4.dp, top = 2.dp),
                )
            }
    }
}
