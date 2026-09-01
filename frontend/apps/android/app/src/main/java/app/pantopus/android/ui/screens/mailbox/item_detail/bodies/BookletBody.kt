@file:Suppress("MagicNumber", "PackageNaming", "UnusedPrivateMember")

package app.pantopus.android.ui.screens.mailbox.item_detail.bodies

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.tooling.preview.Preview
import app.pantopus.android.data.api.models.mailbox.v2.BookletDetailDto
import app.pantopus.android.ui.screens.mailbox.item_detail.bodies.components.BookletPageSwiper
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Spacing

/**
 * Concrete body for the Booklet mailbox category. Replaces the P9
 * placeholder. Hosts the page swiper and the optional summary copy.
 */
@Composable
fun BookletBody(
    booklet: BookletDetailDto,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        BookletPageSwiper(pages = booklet.pages, totalPages = booklet.pageCount)
        booklet.summary?.takeIf { it.isNotEmpty() }?.let { summary ->
            Text(
                text = summary,
                style = PantopusTextStyle.small,
                color = PantopusColors.appTextStrong,
                modifier =
                    Modifier
                        .padding(horizontal = Spacing.s4)
                        .semantics { contentDescription = "Summary: $summary" },
            )
        }
    }
}

@Preview(showBackground = true, widthDp = 360, heightDp = 480)
@Composable
private fun BookletBodyPreview() {
    Box(modifier = Modifier.background(PantopusColors.appBg)) {
        BookletBody(
            booklet = app.pantopus.android.ui.screens.mailbox.item_detail.MailItemSampleData.bookletNeighborhoodCatalog,
        )
    }
}
