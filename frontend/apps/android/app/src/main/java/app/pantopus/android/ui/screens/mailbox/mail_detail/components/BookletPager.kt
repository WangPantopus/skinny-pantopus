@file:Suppress(
    "PackageNaming",
    "MagicNumber",
    "LongMethod",
    "TooManyFunctions",
    "LongParameterList",
    "MatchingDeclarationName",
    "ModifierMissing",
)

package app.pantopus.android.ui.screens.mailbox.mail_detail.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
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
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.mailbox.item_detail.bodies.components.BookletPaperPageChrome
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import coil.compose.AsyncImage
import kotlinx.coroutines.launch

/**
 * T6.5c (P21) — Android twin of iOS `BookletPager`. Two render modes:
 *  - **page** — control strip (prev / page-N-of-M / next + scrubber +
 *    "view all pages") over the folded-paper `HorizontalPager`.
 *  - **grid** — 3-column thumbnail grid; tap a thumbnail to switch back
 *    to page mode at that page.
 */

enum class BookletPagerMode { Page, Grid }

const val BOOKLET_PAGER_TAG = "bookletPager"

@Composable
fun BookletPager(
    pages: List<String>,
    modifier: Modifier = Modifier,
    pageCount: Int = pages.size,
    ocrTexts: List<String> = emptyList(),
    initialPage: Int = 0,
    initialMode: BookletPagerMode = BookletPagerMode.Page,
) {
    if (pages.isEmpty()) return
    var mode by rememberSaveable { mutableStateOf(initialMode) }
    val totalPages = maxOf(pageCount, pages.size)
    val pagerState =
        rememberPagerState(
            initialPage = initialPage.coerceIn(0, pages.size - 1),
        ) { pages.size }
    val scope = rememberCoroutineScope()

    Column(
        modifier = modifier.fillMaxWidth().testTag(BOOKLET_PAGER_TAG),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        when (mode) {
            BookletPagerMode.Page ->
                PageMode(
                    pages = pages,
                    totalPages = totalPages,
                    ocrTexts = ocrTexts,
                    state = pagerState,
                    onPrev = {
                        if (pagerState.currentPage > 0) {
                            scope.launch { pagerState.animateScrollToPage(pagerState.currentPage - 1) }
                        }
                    },
                    onNext = {
                        if (pagerState.currentPage < pages.size - 1) {
                            scope.launch { pagerState.animateScrollToPage(pagerState.currentPage + 1) }
                        }
                    },
                    onShowGrid = { mode = BookletPagerMode.Grid },
                )
            BookletPagerMode.Grid ->
                GridMode(
                    pages = pages,
                    totalPages = totalPages,
                    currentPage = pagerState.currentPage,
                    onJump = { idx ->
                        scope.launch { pagerState.scrollToPage(idx) }
                        mode = BookletPagerMode.Page
                    },
                    onBackToReader = { mode = BookletPagerMode.Page },
                )
        }
    }
}

@Composable
private fun PageMode(
    pages: List<String>,
    totalPages: Int,
    ocrTexts: List<String>,
    state: androidx.compose.foundation.pager.PagerState,
    onPrev: () -> Unit,
    onNext: () -> Unit,
    onShowGrid: () -> Unit,
) {
    PageIndicator(
        currentPage = state.currentPage,
        totalPages = totalPages,
        onPrev = onPrev,
        onNext = onNext,
        onShowGrid = onShowGrid,
    )
    HorizontalPager(
        state = state,
        modifier = Modifier.fillMaxWidth().height(420.dp),
        pageSpacing = Spacing.s3,
    ) { idx ->
        Box(
            modifier =
                Modifier
                    .fillMaxSize()
                    .padding(horizontal = Spacing.s4)
                    .testTag("bookletPager_page_$idx"),
            contentAlignment = Alignment.Center,
        ) {
            BookletPageImage(
                url = pages[idx],
                pageNumber = idx + 1,
                hasNextPage = idx < totalPages - 1,
                modifier = Modifier.fillMaxHeight(),
            )
        }
    }
    // A17.2 — per-page OCR transcript, when the sample data carries one.
    val ocrText = ocrTexts.getOrNull(state.currentPage)
    if (!ocrText.isNullOrEmpty()) {
        BookletOcrCard(text = ocrText)
    }
}

/**
 * OCR transcript card (booklet.jsx OCRCard): scan chip + "Text from this
 * page" header with the OCR confidence pill, the per-page transcript
 * (first line = overline, second = title, rest = body), and inert
 * Copy / Translate / Read aloud actions.
 */
@Composable
private fun BookletOcrCard(text: String) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s3)
                .testTag("bookletPager_ocrCard"),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            Box(
                modifier =
                    Modifier
                        .size(22.dp)
                        .clip(RoundedCornerShape(Radii.sm))
                        .background(PantopusColors.appSurfaceSunken),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.ScanLine,
                    contentDescription = null,
                    size = 13.dp,
                    tint = PantopusColors.appTextSecondary,
                )
            }
            Text(
                text = "Text from this page",
                modifier = Modifier.weight(1f).semantics { heading() },
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
            )
            Text(
                text = "OCR · 99%",
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(PantopusColors.successBg)
                        .padding(horizontal = 7.dp, vertical = 2.dp),
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.success,
            )
        }
        // Transcript lines map onto the JSX kinds by position: line 0 is
        // the overline, line 1 the title, the remainder body copy.
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            text.split("\n").forEachIndexed { idx, line ->
                when (idx) {
                    0 ->
                        Text(
                            text = line.uppercase(),
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 0.8.sp,
                            color = PantopusColors.appTextMuted,
                        )
                    1 ->
                        Text(
                            text = line,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold,
                            color = PantopusColors.appText,
                        )
                    else ->
                        Text(
                            text = line,
                            fontSize = 12.5.sp,
                            lineHeight = 18.sp,
                            color = PantopusColors.appTextSecondary,
                        )
                }
            }
        }
        Box(Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorderSubtle))
        Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            OcrAction(icon = PantopusIcon.Copy, label = "Copy text", color = PantopusColors.primary600)
            OcrAction(icon = PantopusIcon.Globe, label = "Translate", color = PantopusColors.appTextMuted)
            OcrAction(icon = PantopusIcon.Megaphone, label = "Read aloud", color = PantopusColors.appTextMuted)
        }
    }
}

@Composable
private fun OcrAction(
    icon: PantopusIcon,
    label: String,
    color: Color,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(
            icon = icon,
            contentDescription = null,
            size = 12.dp,
            tint = color,
        )
        Text(
            text = label,
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            color = color,
        )
    }
}

@Composable
private fun PageIndicator(
    currentPage: Int,
    totalPages: Int,
    onPrev: () -> Unit,
    onNext: () -> Unit,
    onShowGrid: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(
                    width = 1.dp,
                    color = PantopusColors.appBorder,
                    shape = RoundedCornerShape(Radii.lg),
                )
                .padding(Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            CircularIconButton(
                icon = PantopusIcon.ChevronLeft,
                contentDescription = "Previous page",
                tag = "bookletPager_prev",
                enabled = currentPage > 0,
                onClick = onPrev,
            )
            Row(
                modifier = Modifier.weight(1f),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = "Page ${currentPage + 1}",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appText,
                    modifier = Modifier.testTag("bookletPager_pageLabel"),
                )
                Spacer(Modifier.width(Spacing.s1))
                Text(
                    text = "of $totalPages",
                    fontSize = 13.sp,
                    color = PantopusColors.appTextSecondary,
                )
            }
            CircularIconButton(
                icon = PantopusIcon.ChevronRight,
                contentDescription = "Next page",
                tag = "bookletPager_next",
                enabled = currentPage < totalPages - 1,
                onClick = onNext,
            )
        }
        Scrubber(currentPage = currentPage, totalPages = totalPages)
        Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
            Row(
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(PantopusColors.primary50)
                        .clickable(onClick = onShowGrid)
                        .padding(horizontal = Spacing.s3, vertical = Spacing.s1)
                        .testTag("bookletPager_toggleGrid")
                        .semantics { contentDescription = "View all pages" },
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.FileType,
                    contentDescription = null,
                    size = Radii.lg,
                    tint = PantopusColors.primary600,
                )
                Text(
                    text = "View all pages",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.primary600,
                )
            }
        }
    }
}

@Composable
private fun CircularIconButton(
    icon: PantopusIcon,
    contentDescription: String,
    tag: String,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .size(32.dp)
                .clip(CircleShape)
                .background(PantopusColors.appSurfaceSunken)
                .clickable(enabled = enabled, onClick = onClick)
                .testTag(tag)
                .semantics { this.contentDescription = contentDescription },
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(
            icon = icon,
            contentDescription = null,
            size = 14.dp,
            tint = if (enabled) PantopusColors.appTextStrong else PantopusColors.appTextMuted,
        )
    }
}

@Composable
private fun Scrubber(
    currentPage: Int,
    totalPages: Int,
) {
    val ratio =
        if (totalPages <= 1) 1f else currentPage.coerceAtMost(totalPages - 1).toFloat() / (totalPages - 1)
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(4.dp)
                .clip(RoundedCornerShape(2.dp))
                .background(PantopusColors.appSurfaceSunken),
        contentAlignment = Alignment.CenterStart,
    ) {
        Box(
            modifier =
                Modifier
                    .fillMaxWidth(ratio.coerceAtLeast(0.05f))
                    .height(4.dp)
                    .clip(RoundedCornerShape(2.dp))
                    .background(PantopusColors.primary600),
        )
    }
}

@Composable
private fun GridMode(
    pages: List<String>,
    totalPages: Int,
    currentPage: Int,
    onJump: (Int) -> Unit,
    onBackToReader: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg)),
    ) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
                Text(
                    text = "ALL PAGES",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 0.5.sp,
                    color = PantopusColors.appTextSecondary,
                )
                Text(
                    text = "Tap a thumbnail to jump there",
                    fontSize = 11.sp,
                    color = PantopusColors.appTextSecondary,
                )
            }
            Text(
                text = "$totalPages pages",
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(PantopusColors.appSurfaceSunken)
                        .padding(horizontal = Spacing.s2, vertical = Spacing.s1),
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appTextStrong,
            )
        }
        LaunchedEffect(Unit) { /* layout hook for tests */ }
        LazyVerticalGrid(
            columns = GridCells.Fixed(3),
            modifier = Modifier.fillMaxWidth().height(360.dp).padding(Spacing.s3),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            items(pages.size) { idx ->
                ThumbnailCell(
                    url = pages[idx],
                    page = idx + 1,
                    isCurrent = idx == currentPage,
                    hasNextPage = idx < totalPages - 1,
                    onClick = { onJump(idx) },
                )
            }
        }
        Box(
            modifier = Modifier.fillMaxWidth().padding(bottom = Spacing.s3),
            contentAlignment = Alignment.Center,
        ) {
            Row(
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(PantopusColors.primary50)
                        .clickable(onClick = onBackToReader)
                        .padding(horizontal = Spacing.s3, vertical = Spacing.s1)
                        .testTag("bookletPager_togglePage")
                        .semantics { contentDescription = "Back to reader" },
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.ChevronLeft,
                    contentDescription = null,
                    size = Radii.lg,
                    tint = PantopusColors.primary600,
                )
                Text(
                    text = "Back to reader",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.primary600,
                )
            }
        }
    }
}

@Composable
private fun BookletPageImage(
    url: String,
    pageNumber: Int,
    hasNextPage: Boolean,
    modifier: Modifier = Modifier,
) {
    BookletPaperPageChrome(
        modifier =
            modifier
                .aspectRatio(3f / 4f),
        hasNextPage = hasNextPage,
        contentDescription = "Booklet page $pageNumber",
    ) {
        AsyncImage(
            model = url,
            contentDescription = null,
            modifier = Modifier.fillMaxSize(),
            contentScale = ContentScale.Fit,
        )
    }
}

@Composable
private fun ThumbnailCell(
    url: String,
    page: Int,
    isCurrent: Boolean,
    hasNextPage: Boolean,
    onClick: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .aspectRatio(3f / 4f)
                .clip(RoundedCornerShape(Radii.sm))
                .border(
                    width = if (isCurrent) 2.5.dp else 1.dp,
                    color = if (isCurrent) PantopusColors.primary600 else PantopusColors.appBorder,
                    shape = RoundedCornerShape(Radii.sm),
                )
                .clickable(onClick = onClick)
                .testTag("bookletPager_thumb_${page - 1}")
                .semantics { contentDescription = "Jump to page $page" },
    ) {
        BookletPaperPageChrome(
            modifier = Modifier.matchParentSize(),
            hasNextPage = hasNextPage,
            foldSize = Spacing.s4,
            cornerRadius = Radii.sm,
        ) {
            AsyncImage(
                model = url,
                contentDescription = null,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Fit,
            )
        }
        if (isCurrent) {
            Box(
                modifier =
                    Modifier
                        .padding(Spacing.s1)
                        .size(18.dp)
                        .clip(CircleShape)
                        .background(PantopusColors.primary600)
                        .align(Alignment.TopEnd),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Eye,
                    contentDescription = null,
                    size = 10.dp,
                    tint = PantopusColors.appTextInverse,
                )
            }
        }
        Text(
            text = "$page",
            modifier =
                Modifier
                    .align(Alignment.BottomCenter)
                    .padding(bottom = Spacing.s1),
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            fontStyle = FontStyle.Italic,
            fontFamily = FontFamily.Serif,
            color = PantopusColors.appTextSecondary,
        )
    }
}
