@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.mailbox.mail_detail

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.data.api.models.mailbox.v2.BookletDetailDto
import app.pantopus.android.ui.screens.mailbox.item_detail.MailItemCategory
import app.pantopus.android.ui.screens.mailbox.item_detail.MailItemSampleData
import app.pantopus.android.ui.screens.mailbox.item_detail.MailTrust
import app.pantopus.android.ui.screens.mailbox.mail_detail.variants.BookletDetailLayout
import app.pantopus.android.ui.screens.mailbox.mail_detail.variants.GenericMailDetailLayout
import app.pantopus.android.ui.theme.PantopusColors
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Before
import org.junit.Rule
import org.junit.Test

/** A17.1 generic mail-detail snapshots across three category accents. */
@OptIn(ExperimentalCoroutinesApi::class)
class MailDetailSnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig = DeviceConfig.PIXEL_5.copy(screenHeight = 2400, softButtons = false),
        )

    @Before fun setup() = Dispatchers.setMain(UnconfinedTestDispatcher())

    @After fun tearDown() = Dispatchers.resetMain()

    @Test
    fun notice_generic_detail() {
        snapshot(MailItemCategory.Notice, "Notice of public hearing")
    }

    @Test
    fun package_generic_detail() {
        snapshot(MailItemCategory.Package, "Package delivered to porch")
    }

    @Test
    fun coupon_generic_detail() {
        snapshot(MailItemCategory.Coupon, "Neighborhood bakery coupon")
    }

    @Test
    fun booklet_voter_guide_detail() {
        bookletSnapshot(
            booklet = MailItemSampleData.bookletVoterGuide,
            title = "June 2026 primary voter guide",
            sender = "League of Women Voters",
            excerpt = "Vol. 47 · Nonpartisan · Local races and measures",
        )
    }

    @Test
    fun booklet_catalog_detail() {
        bookletSnapshot(
            booklet = MailItemSampleData.bookletNeighborhoodCatalog,
            title = "Spring home services booklet",
            sender = "Elm Park Merchant Guild",
            excerpt = "Seasonal repair windows and neighborhood-only pricing",
        )
    }

    private fun snapshot(
        category: MailItemCategory,
        title: String,
    ) {
        paparazzi.snapshot {
            Root {
                GenericMailDetailLayout(
                    content = makeContent(category = category, title = title),
                    ackInFlight = false,
                    onBack = {},
                    onAcknowledge = {},
                    onOpenSenderProfile = {},
                    onSaveToVault = {},
                )
            }
        }
    }

    private fun bookletSnapshot(
        booklet: BookletDetailDto,
        title: String,
        sender: String,
        excerpt: String,
    ) {
        paparazzi.snapshot {
            Root {
                BookletDetailLayout(
                    content = makeBookletContent(title = title, sender = sender, excerpt = excerpt),
                    booklet = booklet,
                    onBack = {},
                    onOpenSenderProfile = {},
                    onSaveToVault = {},
                )
            }
        }
    }

    private fun makeContent(
        category: MailItemCategory,
        title: String,
    ): MailDetailContent =
        MailDetailContent(
            mailId = "mail-${category.raw}",
            category = category,
            trust = MailTrust.Verified,
            detailTrust = category.detailTrust,
            senderDisplayName = "City of Oakland",
            senderMeta = "@oakland",
            senderTypeLabel = "Verified sender",
            carrierLine = "via Pantopus Mail",
            senderInitials = "CO",
            senderUserId = "sender-1",
            title = title,
            excerpt = "A short preview line keeps the subject block in the same shape as production mail.",
            referenceLabel = "Ref ${category.raw.uppercase()}-2026",
            createdAtLabel = "Fri May 15, 2026",
            expiresAtLabel = null,
            readStatusLabel = "Unread",
            bodyParagraphs =
                listOf(
                    "This is the first paragraph of the mail body, rendered in the category body slot.",
                    "A second paragraph validates spacing before the sticky action shelf.",
                ),
            attachments = listOf("notice.pdf"),
            aiSummary = null,
            ackRequired = category == MailItemCategory.Notice,
            isAcknowledged = false,
        )

    private fun makeBookletContent(
        title: String,
        sender: String,
        excerpt: String,
    ): MailDetailContent =
        MailDetailContent(
            mailId = "mail-booklet-${title.lowercase().replace(" ", "-")}",
            category = MailItemCategory.Booklet,
            trust = MailTrust.Verified,
            detailTrust = MailItemCategory.Booklet.detailTrust,
            senderDisplayName = sender,
            senderMeta = "Verified nonprofit",
            senderTypeLabel = "Verified sender",
            carrierLine = "via Pantopus Mail",
            senderInitials =
                sender
                    .split(" ")
                    .take(2)
                    .mapNotNull { it.firstOrNull()?.toString() }
                    .joinToString(""),
            senderUserId = "sender-booklet",
            title = title,
            excerpt = excerpt,
            referenceLabel = "Booklet · 2026",
            createdAtLabel = "Fri May 15, 2026",
            expiresAtLabel = null,
            readStatusLabel = "Unread",
            bodyParagraphs = emptyList(),
            attachments = listOf("booklet.pdf"),
            aiSummary = "Pantopus found the key sections and can jump you to the relevant pages.",
            ackRequired = false,
            isAcknowledged = false,
        )

    @Composable
    private fun Root(content: @Composable () -> Unit) {
        Box(modifier = Modifier.fillMaxSize().background(PantopusColors.appBg)) { content() }
    }
}
