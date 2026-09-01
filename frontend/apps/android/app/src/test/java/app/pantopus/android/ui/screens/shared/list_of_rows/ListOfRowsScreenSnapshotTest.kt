@file:Suppress("MagicNumber", "PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.shared.list_of_rows

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.components.StatusChipVariant
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusTheme
import app.pantopus.android.ui.theme.Spacing
import org.junit.Rule
import org.junit.Test

/**
 * T5.0 — Paparazzi baselines for the extended `ListOfRows` row
 * variants. Each test renders one row shape in isolation so a regression
 * in the renderer flags the exact variant that drifted.
 *
 * Record new baselines: `./gradlew paparazziRecord --tests
 * "*ListOfRowsScreenSnapshotTest*"`.
 */
class ListOfRowsScreenSnapshotTest {
    @get:Rule
    val paparazzi: Paparazzi =
        Paparazzi(
            deviceConfig =
                DeviceConfig.PIXEL_5.copy(
                    screenHeight = 1200,
                    softButtons = false,
                ),
        )

    @Test fun row_typeIcon_with_chips_and_unread_highlight() {
        paparazzi.snapshot {
            Frame {
                RowView(
                    row =
                        RowModel(
                            id = "notif",
                            title = "Maria Kovács replied to your gig",
                            template = RowTemplate.StatusChip,
                            leading =
                                RowLeading.TypeIcon(
                                    icon = PantopusIcon.Send,
                                    background = PantopusColors.personalBg,
                                    foreground = PantopusColors.personal,
                                ),
                            trailing = RowTrailing.None,
                            onTap = {},
                            body = "“Sounds great — can we move it to Saturday instead of Friday?”",
                            chips =
                                listOf(
                                    RowChip(
                                        text = "Reply",
                                        icon = PantopusIcon.Send,
                                        tint = RowChip.Tint.Status(StatusChipVariant.Personal),
                                    ),
                                ),
                            timeMeta = "12m",
                            highlight = RowHighlight.Unread,
                        ),
                )
            }
        }
    }

    @Test fun row_categoryGradient_with_footer_actions() {
        paparazzi.snapshot {
            Frame {
                RowView(
                    row =
                        RowModel(
                            id = "bid",
                            title = "Mount 65″ TV above brick fireplace · drill anchors included",
                            subtitle = "for Sarah Kowalski · Elm Park · 2d ago",
                            template = RowTemplate.StatusChip,
                            leading =
                                RowLeading.CategoryGradientIcon(
                                    icon = PantopusIcon.Hammer,
                                    gradient =
                                        GradientPair(
                                            start = PantopusColors.primary400,
                                            end = PantopusColors.primary700,
                                        ),
                                ),
                            trailing =
                                RowTrailing.PriceStack(amount = "$95", sublabel = "budget $120"),
                            onTap = {},
                            chips =
                                listOf(
                                    RowChip(
                                        text = "Top bid",
                                        icon = PantopusIcon.Check,
                                        tint = RowChip.Tint.Status(StatusChipVariant.Success),
                                    ),
                                ),
                            metaTail = "· 3 others bid · 1d left to reply",
                            footer =
                                RowFooter(
                                    actions =
                                        listOf(
                                            RowFooterAction(
                                                title = "Withdraw",
                                                icon = PantopusIcon.X,
                                                variant = CompactButtonVariant.Destructive,
                                            ) {},
                                            RowFooterAction(
                                                title = "Edit bid",
                                                icon = PantopusIcon.Check,
                                                variant = CompactButtonVariant.Primary,
                                            ) {},
                                        ),
                                ),
                        ),
                )
            }
        }
    }

    @Test fun row_avatarWithBadge_circular_action() {
        paparazzi.snapshot {
            Frame {
                RowView(
                    row =
                        RowModel(
                            id = "connection",
                            title = "Maria Kovács",
                            subtitle = "Elm Park · 0.2 mi",
                            template = RowTemplate.AvatarKebab,
                            leading =
                                RowLeading.AvatarWithBadge(
                                    name = "Maria Kovács",
                                    imageUrl = null,
                                    background =
                                        AvatarBackground.Gradient(
                                            GradientPair(PantopusColors.primary400, PantopusColors.primary700),
                                        ),
                                    size = AvatarBadgeSize.Large,
                                    verified = true,
                                ),
                            trailing =
                                RowTrailing.CircularAction(
                                    icon = PantopusIcon.Send,
                                    accessibilityLabel = "Message Maria",
                                    background = PantopusColors.primary50,
                                    foreground = PantopusColors.primary600,
                                    onClick = {},
                                ),
                            onTap = {},
                            body = "Last chat 2 days ago",
                        ),
                )
            }
        }
    }

    @Test fun row_avatarWithBadge_vertical_actions_pending() {
        paparazzi.snapshot {
            Frame {
                RowView(
                    row =
                        RowModel(
                            id = "pending",
                            title = "Sofia Romero",
                            subtitle = "Elm Park · 0.5 mi",
                            template = RowTemplate.AvatarKebab,
                            leading =
                                RowLeading.AvatarWithBadge(
                                    name = "Sofia Romero",
                                    imageUrl = null,
                                    background =
                                        AvatarBackground.Gradient(
                                            GradientPair(PantopusColors.business, PantopusColors.warning),
                                        ),
                                    size = AvatarBadgeSize.Large,
                                    verified = false,
                                ),
                            trailing =
                                RowTrailing.VerticalActions(
                                    primary =
                                        VerticalAction(
                                            label = "Accept",
                                            variant = CompactButtonVariant.Primary,
                                            onClick = {},
                                        ),
                                    secondary =
                                        VerticalAction(
                                            label = "Ignore",
                                            variant = CompactButtonVariant.Ghost,
                                            onClick = {},
                                        ),
                                ),
                            onTap = {},
                        ),
                )
            }
        }
    }

    @Test fun row_thumbnail_inline_chip_kebab() {
        paparazzi.snapshot {
            Frame {
                RowView(
                    row =
                        RowModel(
                            id = "pet",
                            title = "Mango",
                            subtitle = "Golden Retriever · 3 yr",
                            template = RowTemplate.AvatarKebab,
                            leading =
                                RowLeading.Thumbnail(
                                    image =
                                        ThumbnailImage.IconOnGradient(
                                            icon = PantopusIcon.Heart,
                                            gradient =
                                                GradientPair(
                                                    PantopusColors.handyman,
                                                    PantopusColors.warning,
                                                ),
                                        ),
                                    size = ThumbnailSize.Large,
                                ),
                            trailing = RowTrailing.Kebab,
                            onTap = {},
                            onSecondary = {},
                            inlineChip =
                                RowChip(
                                    text = "Dog",
                                    tint =
                                        RowChip.Tint.Custom(
                                            background = PantopusColors.warningBg,
                                            foreground = PantopusColors.warning,
                                        ),
                                ),
                        ),
                )
            }
        }
    }

    @Test fun row_bidderStack_with_status_chip() {
        paparazzi.snapshot {
            Frame {
                RowView(
                    row =
                        RowModel(
                            id = "task",
                            title = "Saturday move help, 2 hours, a few boxes + couch",
                            template = RowTemplate.StatusChip,
                            leading =
                                RowLeading.BidderStack(
                                    bidders =
                                        listOf(
                                            Bidder(id = "1", initials = "AR", tone = BidderTone.Violet),
                                            Bidder(id = "2", initials = "MT", tone = BidderTone.Amber),
                                            Bidder(id = "3", initials = "JP", tone = BidderTone.Teal),
                                        ),
                                    overflow = 9,
                                ),
                            trailing = RowTrailing.PriceStack(amount = "$80/hr"),
                            onTap = {},
                            chips =
                                listOf(
                                    RowChip(
                                        text = "Reviewing bids",
                                        icon = PantopusIcon.Inbox,
                                        tint = RowChip.Tint.Status(StatusChipVariant.Info),
                                    ),
                                ),
                        ),
                )
            }
        }
    }

    @Test fun row_amountWithChip_bills() {
        paparazzi.snapshot {
            Frame {
                RowView(
                    row =
                        RowModel(
                            id = "bill",
                            title = "ConEd Electric",
                            subtitle = "Oct 15",
                            template = RowTemplate.StatusChip,
                            leading =
                                RowLeading.TypeIcon(
                                    icon = PantopusIcon.File,
                                    background = PantopusColors.primary50,
                                    foreground = PantopusColors.primary600,
                                ),
                            trailing =
                                RowTrailing.AmountWithChip(
                                    amount = "$142.80",
                                    chipText = "Due Oct 15",
                                    chipVariant = StatusChipVariant.Warning,
                                    chipIcon = PantopusIcon.AlertCircle,
                                ),
                            onTap = {},
                        ),
                )
            }
        }
    }

    @Test fun row_offer_category_gradient_with_price_stack() {
        paparazzi.snapshot {
            Frame {
                RowView(
                    row =
                        RowModel(
                            id = "offer-cross",
                            title = "Mid-century walnut credenza",
                            subtitle = "From Anika R. · Mid-City · 12m",
                            template = RowTemplate.StatusChip,
                            leading =
                                RowLeading.CategoryGradientIcon(
                                    icon = PantopusIcon.Package,
                                    gradient =
                                        GradientPair(
                                            PantopusColors.moving,
                                            PantopusColors.business,
                                        ),
                                ),
                            trailing =
                                RowTrailing.PriceStack(
                                    amount = "$220",
                                    sublabel = "asking $240",
                                ),
                            onTap = {},
                            chips =
                                listOf(
                                    RowChip(
                                        text = "New offer",
                                        icon = PantopusIcon.Sparkles,
                                        tint = RowChip.Tint.Status(StatusChipVariant.Personal),
                                    ),
                                ),
                        ),
                )
            }
        }
    }

    @Test fun row_leading_offer_with_note_block() {
        paparazzi.snapshot {
            Frame {
                RowView(
                    row =
                        RowModel(
                            id = "offer",
                            title = "Anika Reyes",
                            subtitle = "Elm Park · 4.9 ★ · 12 trades",
                            template = RowTemplate.AvatarKebab,
                            leading =
                                RowLeading.AvatarWithBadge(
                                    name = "Anika Reyes",
                                    imageUrl = null,
                                    background =
                                        AvatarBackground.Gradient(
                                            GradientPair(PantopusColors.business, PantopusColors.primary600),
                                        ),
                                    size = AvatarBadgeSize.Medium,
                                ),
                            trailing = RowTrailing.PriceStack(amount = "$240"),
                            onTap = {},
                            chips =
                                listOf(
                                    RowChip(
                                        text = "New",
                                        icon = PantopusIcon.Star,
                                        tint = RowChip.Tint.Status(StatusChipVariant.Personal),
                                    ),
                                ),
                            note = "Love the dovetail joinery. Can pick up Saturday in my truck.",
                            highlight = RowHighlight.Leading,
                        ),
                )
            }
        }
    }

    @Test fun row_myPosts_headerChips_with_engagement_active() {
        paparazzi.snapshot {
            Frame {
                RowView(
                    row =
                        RowModel(
                            id = "post-active",
                            title = "",
                            template = RowTemplate.StatusChip,
                            leading = RowLeading.None,
                            trailing = RowTrailing.Kebab,
                            onTap = {},
                            onSecondary = {},
                            body =
                                "Anyone know a good chimney sweep for a 1920s flue? " +
                                    "Want someone with old-house experience, not just a tech with a vacuum.",
                            bodyEmphasis = RowBodyEmphasis.Primary,
                            headerChips =
                                listOf(
                                    RowChip(
                                        text = "Ask",
                                        icon = PantopusIcon.HelpCircle,
                                        tint =
                                            RowChip.Tint.Custom(
                                                background = PantopusColors.warningBg,
                                                foreground = PantopusColors.warning,
                                            ),
                                    ),
                                ),
                            timeMeta = "2h · Elm Park",
                            engagement =
                                RowEngagement(
                                    items =
                                        listOf(
                                            RowEngagementItem(
                                                id = "replies",
                                                icon = PantopusIcon.MessageCircle,
                                                label = "8 replies",
                                            ),
                                            RowEngagementItem(
                                                id = "likes",
                                                icon = PantopusIcon.ThumbsUp,
                                                label = "3 likes",
                                            ),
                                        ),
                                    cta =
                                        RowEngagementCta(
                                            label = "Edit",
                                            icon = PantopusIcon.Pencil,
                                            onClick = {},
                                        ),
                                ),
                        ),
                )
            }
        }
    }

    @Test fun row_myPosts_headerChips_with_engagement_archived() {
        paparazzi.snapshot {
            Frame {
                RowView(
                    row =
                        RowModel(
                            id = "post-archived",
                            title = "",
                            template = RowTemplate.StatusChip,
                            leading = RowLeading.None,
                            trailing = RowTrailing.Kebab,
                            onTap = {},
                            onSecondary = {},
                            body =
                                "Stoop coffee Saturday 9am. BYO mug, " +
                                    "I'll do a big pot of the good stuff.",
                            bodyEmphasis = RowBodyEmphasis.Primary,
                            headerChips =
                                listOf(
                                    RowChip(
                                        text = "Event",
                                        icon = PantopusIcon.Calendar,
                                        tint =
                                            RowChip.Tint.Custom(
                                                background = PantopusColors.appSurfaceSunken,
                                                foreground = PantopusColors.appTextSecondary,
                                            ),
                                    ),
                                    RowChip(
                                        text = "ARCHIVED",
                                        icon = PantopusIcon.Archive,
                                        tint =
                                            RowChip.Tint.Custom(
                                                background = PantopusColors.appSurfaceSunken,
                                                foreground = PantopusColors.appTextSecondary,
                                            ),
                                    ),
                                ),
                            timeMeta = "3d · Elm Park",
                            highlight = RowHighlight.Archived,
                            engagement =
                                RowEngagement(
                                    items =
                                        listOf(
                                            RowEngagementItem(
                                                id = "going",
                                                icon = PantopusIcon.CheckCircle,
                                                label = "12 going",
                                            ),
                                            RowEngagementItem(
                                                id = "replies",
                                                icon = PantopusIcon.MessageCircle,
                                                label = "5 replies",
                                            ),
                                        ),
                                    cta =
                                        RowEngagementCta(
                                            label = "Restore",
                                            icon = PantopusIcon.ArrowsRepeat,
                                            onClick = {},
                                        ),
                                ),
                        ),
                )
            }
        }
    }

    @Test fun row_typeIcon_with_iconActions_trailing() {
        // T6.4a — Access codes row variant. Validates the new
        // `RowTrailing.IconActions` pair (copy + kebab) sits next to a
        // tinted `TypeIcon` leading and a masked monospace subtitle.
        paparazzi.snapshot {
            Frame {
                RowView(
                    row =
                        RowModel(
                            id = "access-wifi",
                            title = "Main network",
                            subtitle = "••••••••••••",
                            template = RowTemplate.FileChevron,
                            leading =
                                RowLeading.TypeIcon(
                                    icon = PantopusIcon.Wifi,
                                    background = androidx.compose.ui.graphics.Color(0xFFDBEAFE),
                                    foreground = androidx.compose.ui.graphics.Color(0xFF1D4ED8),
                                ),
                            trailing =
                                RowTrailing.IconActions(
                                    primary =
                                        RowIconAction(
                                            icon = PantopusIcon.Copy,
                                            accessibilityLabel = "Copy Main network",
                                            onClick = {},
                                        ),
                                    secondary =
                                        RowIconAction(
                                            icon = PantopusIcon.MoreHorizontal,
                                            accessibilityLabel = "More actions for Main network",
                                            onClick = {},
                                        ),
                                ),
                            onTap = {},
                            body = "Household · 4 members",
                        ),
                )
            }
        }
    }

    @Composable
    private fun Frame(content: @Composable () -> Unit) {
        PantopusTheme {
            Box(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .background(PantopusColors.appBg)
                        .padding(Spacing.s4),
            ) { content() }
        }
    }
}
