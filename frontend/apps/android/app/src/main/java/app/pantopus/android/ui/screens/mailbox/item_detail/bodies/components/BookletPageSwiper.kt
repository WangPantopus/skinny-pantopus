@file:Suppress("MagicNumber", "PackageNaming", "UnusedPrivateMember")

package app.pantopus.android.ui.screens.mailbox.item_detail.bodies.components

import androidx.compose.animation.core.Animatable
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusElevations
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import app.pantopus.android.ui.theme.pantopusShadow
import coil.compose.SubcomposeAsyncImage
import kotlinx.coroutines.launch

/**
 * Horizontal pager + page-indicator dots + pinch-to-zoom for the
 * FrameBooklet body.
 */
@Composable
fun BookletPageSwiper(
    pages: List<String>,
    modifier: Modifier = Modifier,
    totalPages: Int = pages.size,
) {
    if (pages.isEmpty()) {
        EmptyBookletPageSwiper(modifier = modifier)
        return
    }
    val displayTotalPages = maxOf(totalPages, pages.size)
    val pagerState = rememberPagerState(pageCount = { pages.size })
    Column(
        modifier = modifier.fillMaxWidth().testTag("bookletPageSwiper"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        HorizontalPager(
            state = pagerState,
            modifier = Modifier.fillMaxWidth().height(420.dp),
            pageSpacing = Spacing.s4,
        ) { pageIndex ->
            Box(
                modifier = Modifier.fillMaxSize().padding(horizontal = Spacing.s4),
                contentAlignment = Alignment.Center,
            ) {
                BookletPage(
                    url = pages[pageIndex],
                    pageNumber = pageIndex + 1,
                    hasNextPage = pageIndex < displayTotalPages - 1,
                    modifier = Modifier.fillMaxHeight(),
                )
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
            repeat(displayTotalPages) { idx ->
                Box(
                    modifier =
                        Modifier
                            .size(6.dp)
                            .clip(CircleShape)
                            .background(
                                if (idx == pagerState.currentPage) {
                                    PantopusColors.primary600
                                } else {
                                    PantopusColors.appBorder
                                },
                            ),
                )
            }
        }
        Text(
            text = "Page ${pagerState.currentPage + 1} of $displayTotalPages",
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
            modifier =
                Modifier
                    .testTag("bookletPageSwiper_pageLabel")
                    .semantics {
                        contentDescription = "Page ${pagerState.currentPage + 1} of $displayTotalPages"
                    },
        )
    }
}

@Composable
private fun BookletPage(
    url: String,
    pageNumber: Int,
    hasNextPage: Boolean,
    modifier: Modifier = Modifier,
) {
    val scope = rememberCoroutineScope()
    val scale = remember { Animatable(1f) }
    BookletPaperPageChrome(
        modifier =
            modifier
                .aspectRatio(3f / 4f)
                .pointerInput(Unit) {
                    detectTransformGestures { _, _, zoom, _ ->
                        scope.launch {
                            scale.snapTo((scale.value * zoom).coerceIn(1f, 3f))
                        }
                    }
                },
        hasNextPage = hasNextPage,
        contentDescription = "Booklet page $pageNumber",
    ) {
        // Reset zoom whenever the URL changes (i.e., user swipes).
        LaunchedEffect(url) { scale.snapTo(1f) }
        SubcomposeAsyncImage(
            model = url,
            contentDescription = null,
            modifier =
                Modifier
                    .fillMaxSize()
                    .graphicsLayer(
                        scaleX = scale.value,
                        scaleY = scale.value,
                    ),
            contentScale = ContentScale.Fit,
            loading = {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(strokeWidth = 2.dp, modifier = Modifier.size(20.dp))
                }
            },
            error = {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    PantopusIconImage(
                        icon = PantopusIcon.AlertCircle,
                        contentDescription = null,
                        size = 22.dp,
                        tint = PantopusColors.appTextMuted,
                    )
                }
            },
        )
    }
}

@Composable
internal fun BookletPaperPageChrome(
    modifier: Modifier = Modifier,
    hasNextPage: Boolean,
    foldSize: Dp = Spacing.s8,
    cornerRadius: Dp = Radii.lg,
    contentDescription: String? = null,
    content: @Composable BoxScope.() -> Unit,
) {
    val shape = RoundedCornerShape(cornerRadius)
    val edgeShape =
        RoundedCornerShape(
            topStart = Spacing.s0,
            topEnd = cornerRadius,
            bottomEnd = cornerRadius,
            bottomStart = Spacing.s0,
        )
    val semanticsModifier =
        if (contentDescription == null) {
            Modifier
        } else {
            Modifier.semantics { this.contentDescription = contentDescription }
        }

    Box(
        modifier = modifier.then(semanticsModifier),
        contentAlignment = Alignment.Center,
    ) {
        Box(
            modifier =
                Modifier
                    .matchParentSize()
                    .padding(end = if (hasNextPage) Spacing.s3 else Spacing.s0)
                    .pantopusShadow(PantopusElevations.lg, shape)
                    .clip(shape)
                    .background(PantopusColors.appSurfaceRaised)
                    .border(1.dp, PantopusColors.appBorder, shape),
        ) {
            PaperPageScaffold(modifier = Modifier.matchParentSize())
            content()
            PageFold(
                modifier =
                    Modifier
                        .align(Alignment.TopEnd)
                        .size(foldSize),
            )
        }

        if (hasNextPage) {
            Box(
                modifier =
                    Modifier
                        .align(Alignment.CenterEnd)
                        .padding(vertical = Spacing.s3)
                        .fillMaxHeight()
                        .width(Spacing.s3)
                        .clip(edgeShape)
                        .background(PantopusColors.appSurfaceSunken)
                        .border(
                            width = 1.dp,
                            color = PantopusColors.appBorderStrong,
                            shape = edgeShape,
                        ),
            )
        }
    }
}

@Composable
private fun PaperPageScaffold(modifier: Modifier = Modifier) {
    Column(
        modifier = modifier.padding(Spacing.s5),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .width(92.dp)
                    .height(4.dp)
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.appTextMuted.copy(alpha = 0.32f)),
        )
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            Box(
                modifier =
                    Modifier
                        .size(width = 52.dp, height = 64.dp)
                        .background(PantopusColors.appBorderStrong.copy(alpha = 0.34f)),
            )
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                PaperLine(widthFraction = 0.78f)
                PaperLine(widthFraction = 0.64f)
                PaperLine(widthFraction = 0.72f)
                PaperLine(widthFraction = 0.48f)
            }
        }
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(1.dp)
                    .background(PantopusColors.appBorderSubtle),
        )
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            PaperLine(widthFraction = 0.96f)
            PaperLine(widthFraction = 0.88f)
            PaperLine(widthFraction = 0.94f)
            PaperLine(widthFraction = 0.62f)
        }
        Spacer(Modifier.weight(1f))
        Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
            Box(
                modifier =
                    Modifier
                        .width(36.dp)
                        .height(3.dp)
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(PantopusColors.appBorderStrong.copy(alpha = 0.34f)),
            )
        }
    }
}

@Composable
private fun PaperLine(widthFraction: Float) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth(widthFraction)
                .height(3.dp)
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.appTextMuted.copy(alpha = 0.32f)),
    )
}

@Composable
private fun PageFold(modifier: Modifier = Modifier) {
    Canvas(modifier = modifier) {
        val foldPath =
            Path().apply {
                moveTo(size.width, 0f)
                lineTo(size.width, size.height)
                lineTo(0f, 0f)
                close()
            }
        drawPath(path = foldPath, color = PantopusColors.appSurfaceSunken)
        drawLine(
            color = PantopusColors.appBorderStrong,
            start = Offset(0f, 0f),
            end = Offset(size.width, size.height),
            strokeWidth = 1.dp.toPx(),
        )
    }
}

@Composable
private fun EmptyBookletPageSwiper(modifier: Modifier = Modifier) {
    Box(
        modifier =
            modifier
                .fillMaxWidth()
                .height(220.dp)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .testTag("bookletPageSwiper_empty")
                .semantics { contentDescription = "No booklet pages available" },
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.FileText,
                contentDescription = null,
                size = Radii.xl3,
                tint = PantopusColors.appTextMuted,
            )
            Text(
                text = "No booklet pages available",
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
            )
        }
    }
}

@Preview(showBackground = true, widthDp = 360, heightDp = 420)
@Composable
private fun BookletPageSwiperPreview() {
    BookletPageSwiper(
        pages =
            listOf(
                "https://placehold.co/640x360",
                "https://placehold.co/640x360/orange/white",
                "https://placehold.co/640x360/blue/white",
            ),
    )
}
