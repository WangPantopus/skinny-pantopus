@file:Suppress("PackageNaming", "MagicNumber", "LongMethod")

package app.pantopus.android.ui.screens.mailbox.mail_detail

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.screens.mailbox.item_detail.MailItemCategory
import app.pantopus.android.ui.screens.mailbox.item_detail.MailItemSampleData
import app.pantopus.android.ui.screens.mailbox.item_detail.MailTrust
import app.pantopus.android.ui.screens.mailbox.item_detail.bodies.MemorySampleData
import app.pantopus.android.ui.screens.mailbox.mail_detail.variants.CouponDetailLayout
import app.pantopus.android.ui.screens.mailbox.mail_detail.variants.GenericMailDetailLayout
import app.pantopus.android.ui.screens.mailbox.mail_detail.variants.GigDetailLayout
import app.pantopus.android.ui.screens.mailbox.mail_detail.variants.MemoryDetailLayout
import app.pantopus.android.ui.screens.mailbox.mail_detail.variants.PackageDetailLayout
import app.pantopus.android.ui.screens.mailbox.mail_detail.variants.RecordsDetailLayout
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
import java.time.LocalDate

/**
 * A17.1, A17.5–A17.8 — Paparazzi snapshots for the bespoke generic
 * layout extraction plus the four new ceremonial variants (Coupon,
 * Gig, Memory, Package). Mirrors iOS `CeremonialVariantsSnapshotTests`.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class CeremonialVariantsSnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig = DeviceConfig.PIXEL_5.copy(screenHeight = 2800, softButtons = false),
        )

    @Before fun setup() = Dispatchers.setMain(UnconfinedTestDispatcher())

    @After fun tearDown() = Dispatchers.resetMain()

    @Test
    fun generic_layout_renders() {
        paparazzi.snapshot {
            Root {
                GenericMailDetailLayout(
                    content = makeContent(category = MailItemCategory.Notice, title = "Generic extraction"),
                    ackInFlight = false,
                    onBack = {},
                    onAcknowledge = {},
                    onOpenSenderProfile = {},
                    onSaveToVault = {},
                )
            }
        }
    }

    @Test
    fun coupon_layout_unused() {
        paparazzi.snapshot {
            Root {
                CouponDetailLayout(
                    content = makeContent(category = MailItemCategory.Coupon, title = "25% off at Brass Owl"),
                    coupon = MailItemSampleData.couponUnused,
                    redeemInFlight = false,
                    onBack = {},
                    onRedeem = {},
                    onOpenSenderProfile = {},
                    onSaveToVault = {},
                    // Pin "today" so the unused/expired split never depends on the
                    // wall clock. The sample coupon expires 2026-06-30; without this
                    // the snapshot silently flipped to the Expired variant on
                    // 2026-07-01 and the test began failing on date alone.
                    today = FIXED_TODAY,
                )
            }
        }
    }

    @Test
    fun coupon_layout_redeemed() {
        paparazzi.snapshot {
            Root {
                CouponDetailLayout(
                    content =
                        makeContent(category = MailItemCategory.Coupon, title = "Redeemed coupon")
                            .copy(isAcknowledged = true),
                    coupon = MailItemSampleData.couponRedeemed,
                    redeemInFlight = false,
                    onBack = {},
                    onRedeem = {},
                    onOpenSenderProfile = {},
                    onSaveToVault = {},
                    today = FIXED_TODAY,
                )
            }
        }
    }

    @Test
    fun gig_layout_received() {
        paparazzi.snapshot {
            Root {
                GigDetailLayout(
                    content = makeContent(category = MailItemCategory.Gig, title = "Sofa move — bid received"),
                    gig = MailItemSampleData.gigReceived,
                    bidInFlight = false,
                    onBack = {},
                    onAccept = {},
                    onOpenSenderProfile = {},
                    onSaveToVault = {},
                )
            }
        }
    }

    @Test
    fun gig_layout_accepted() {
        paparazzi.snapshot {
            Root {
                GigDetailLayout(
                    content = makeContent(category = MailItemCategory.Gig, title = "Sofa move — accepted"),
                    gig = MailItemSampleData.gigAccepted,
                    bidInFlight = false,
                    onBack = {},
                    onAccept = {},
                    onOpenSenderProfile = {},
                    onSaveToVault = {},
                )
            }
        }
    }

    @Test
    fun memory_layout_fresh() {
        paparazzi.snapshot {
            Root {
                MemoryDetailLayout(
                    content =
                        makeContent(
                            category = MailItemCategory.Memory,
                            title = MemorySampleData.memory.title,
                        ),
                    memory = MemorySampleData.memory,
                    saveInFlight = false,
                    onBack = {},
                    onSaveMemory = {},
                    onOpenSenderProfile = {},
                    onSaveToVault = {},
                )
            }
        }
    }

    @Test
    fun memory_layout_saved() {
        paparazzi.snapshot {
            Root {
                MemoryDetailLayout(
                    content = makeContent(category = MailItemCategory.Memory, title = "Saved memory"),
                    memory = MemorySampleData.savedMemory,
                    saveInFlight = false,
                    onBack = {},
                    onSaveMemory = {},
                    onOpenSenderProfile = {},
                    onSaveToVault = {},
                )
            }
        }
    }

    @Test
    fun package_layout_out_for_delivery() {
        paparazzi.snapshot {
            Root {
                PackageDetailLayout(
                    content = makeContent(category = MailItemCategory.Package, title = "Out for delivery"),
                    packageDetail = MailItemSampleData.packageOutForDelivery,
                    ackInFlight = false,
                    onBack = {},
                    onAcknowledgeDelivery = {},
                    onOpenSenderProfile = {},
                    onSaveToVault = {},
                )
            }
        }
    }

    @Test
    fun package_layout_delivered() {
        paparazzi.snapshot {
            Root {
                PackageDetailLayout(
                    content =
                        makeContent(category = MailItemCategory.Package, title = "Delivered")
                            .copy(isAcknowledged = true),
                    packageDetail = MailItemSampleData.packageDelivered,
                    ackInFlight = false,
                    onBack = {},
                    onAcknowledgeDelivery = {},
                    onOpenSenderProfile = {},
                    onSaveToVault = {},
                )
            }
        }
    }

    @Test
    fun records_layout_open() {
        paparazzi.snapshot {
            Root {
                RecordsDetailLayout(
                    content = makeContent(category = MailItemCategory.Records, title = "Q1 2026 Statement"),
                    records = MailItemSampleData.recordsOpen,
                    fileInFlight = false,
                    onBack = {},
                    onFileInVault = {},
                    onSaveToVault = {},
                )
            }
        }
    }

    @Test
    fun records_layout_filed() {
        paparazzi.snapshot {
            Root {
                RecordsDetailLayout(
                    content = makeContent(category = MailItemCategory.Records, title = "Filed statement"),
                    records = MailItemSampleData.recordsFiled,
                    fileInFlight = false,
                    onBack = {},
                    onFileInVault = {},
                    onSaveToVault = {},
                )
            }
        }
    }

    @Test
    fun package_layout_ups_delivered() {
        paparazzi.snapshot {
            Root {
                PackageDetailLayout(
                    content =
                        makeContent(category = MailItemCategory.Package, title = "UPS package delivered")
                            .copy(isAcknowledged = true),
                    packageDetail = MailItemSampleData.packageUpsDelivered,
                    ackInFlight = false,
                    onBack = {},
                    onAcknowledgeDelivery = {},
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
            senderDisplayName = "Sender Name",
            senderMeta = "@sender",
            senderTypeLabel = "Verified sender",
            carrierLine = "via Pantopus Mail",
            senderInitials = "SN",
            senderUserId = "sender-1",
            title = title,
            excerpt = "A short preview line keeps the subject block in the same shape as production mail.",
            referenceLabel = "Ref ${category.raw.uppercase()}-2026",
            createdAtLabel = "Fri May 15, 2026",
            expiresAtLabel = null,
            readStatusLabel = "Unread",
            bodyParagraphs = emptyList(),
            attachments = emptyList(),
            aiSummary = null,
            ackRequired = false,
            isAcknowledged = false,
        )

    @Composable
    private fun Root(content: @Composable () -> Unit) {
        Box(modifier = Modifier.fillMaxSize().background(PantopusColors.appBg)) { content() }
    }

    private companion object {
        /**
         * Reference "today" for coupon expiry, held before
         * [MailItemSampleData.couponUnused]'s 2026-06-30 expiry so the unused
         * variant stays unused regardless of when the suite runs.
         */
        val FIXED_TODAY: LocalDate = LocalDate.of(2026, 6, 1)
    }
}
