@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.compose.listing

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTheme
import org.junit.Rule
import org.junit.Test

/**
 * P2.3 Paparazzi baselines for the Snap & Sell listing wizard. Covers
 * the six step bodies plus the success terminal, exercising the
 * happy-path render of each step's content (loading lives at the
 * wizard-shell level — the steps themselves don't shimmer).
 */
class ListingComposeWizardSnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig =
                DeviceConfig.PIXEL_5.copy(
                    screenHeight = 2400,
                    softButtons = false,
                ),
        )

    private val seededPhotos =
        listOf(
            ListingComposePhoto(id = "p1", token = "photo_1"),
            ListingComposePhoto(id = "p2", token = "photo_2"),
            ListingComposePhoto(id = "p3", token = "photo_3"),
        )

    @Test
    fun listing_compose_step1_photos_empty() {
        paparazzi.snapshot {
            Frame {
                ListingComposeSnapCameraPreview(
                    state = ListingComposeUiState(form = ListingComposeFormState.EMPTY),
                )
            }
        }
    }

    @Test
    fun listing_compose_step1_photos_populated() {
        paparazzi.snapshot {
            Frame {
                ListingComposeStepPreview(
                    state =
                        ListingComposeUiState(
                            form =
                                ListingComposeFormState(
                                    entryMode = ListingComposeEntryMode.Manual,
                                    photos = seededPhotos,
                                ),
                        ),
                )
            }
        }
    }

    @Test
    fun listing_compose_snap_review_populated() {
        paparazzi.snapshot {
            Frame {
                ListingComposeSnapReviewPreview(
                    state =
                        ListingComposeUiState(
                            form =
                                ListingComposeFormState(
                                    step = ListingComposeStep.TitleCategory.ordinal0,
                                    entryMode = ListingComposeEntryMode.Snap,
                                    photos = seededPhotos,
                                    title = "Sage green velvet sofa, 3-seater",
                                    category = ListingComposeCategory.Goods,
                                    condition = ListingComposeCondition.Good,
                                    bodyText = "Comfortable three-seat velvet sofa with light wear on one cushion and minor sun fade.",
                                    priceKind = ListingComposePriceKind.Fixed,
                                    priceAmount = "280",
                                    fulfillment = ListingComposeFulfillment.Pickup,
                                    deliveryEnabled = true,
                                    locationKind = ListingComposeLocationKind.SavedAddress,
                                ),
                        ),
                )
            }
        }
    }

    @Test
    fun listing_compose_step2_title_category() {
        paparazzi.snapshot {
            Frame {
                ListingComposeStepPreview(
                    state =
                        ListingComposeUiState(
                            form =
                                ListingComposeFormState(
                                    step = ListingComposeStep.TitleCategory.ordinal0,
                                    entryMode = ListingComposeEntryMode.Manual,
                                    photos = seededPhotos,
                                    title = "Moving boxes — bundle of 18",
                                    category = ListingComposeCategory.Goods,
                                ),
                        ),
                )
            }
        }
    }

    @Test
    fun listing_compose_step3_condition_description() {
        paparazzi.snapshot {
            Frame {
                ListingComposeStepPreview(
                    state =
                        ListingComposeUiState(
                            form =
                                ListingComposeFormState(
                                    step = ListingComposeStep.ConditionDescription.ordinal0,
                                    entryMode = ListingComposeEntryMode.Manual,
                                    photos = seededPhotos,
                                    title = "Moving boxes — bundle of 18",
                                    category = ListingComposeCategory.Goods,
                                    condition = ListingComposeCondition.LikeNew,
                                    bodyText = "Lightly used, perfect for a one-bedroom move across town.",
                                ),
                        ),
                )
            }
        }
    }

    @Test
    fun listing_compose_step4_price_fixed() {
        paparazzi.snapshot {
            Frame {
                ListingComposeStepPreview(
                    state =
                        ListingComposeUiState(
                            form =
                                ListingComposeFormState(
                                    step = ListingComposeStep.Price.ordinal0,
                                    entryMode = ListingComposeEntryMode.Manual,
                                    photos = seededPhotos,
                                    title = "Moving boxes — bundle of 18",
                                    category = ListingComposeCategory.Goods,
                                    condition = ListingComposeCondition.LikeNew,
                                    bodyText = "Lightly used, perfect for a one-bedroom move across town.",
                                    priceKind = ListingComposePriceKind.Fixed,
                                    priceAmount = "25",
                                    fulfillment = ListingComposeFulfillment.Pickup,
                                ),
                        ),
                )
            }
        }
    }

    @Test
    fun listing_compose_step5_location_meet_point() {
        paparazzi.snapshot {
            Frame {
                ListingComposeStepPreview(
                    state =
                        ListingComposeUiState(
                            form =
                                ListingComposeFormState(
                                    step = ListingComposeStep.Location.ordinal0,
                                    entryMode = ListingComposeEntryMode.Manual,
                                    photos = seededPhotos,
                                    title = "Moving boxes — bundle of 18",
                                    category = ListingComposeCategory.Goods,
                                    condition = ListingComposeCondition.LikeNew,
                                    bodyText = "Lightly used, perfect for a one-bedroom move across town.",
                                    priceKind = ListingComposePriceKind.Fixed,
                                    priceAmount = "25",
                                    fulfillment = ListingComposeFulfillment.Pickup,
                                    locationKind = ListingComposeLocationKind.MeetPoint,
                                    locationLabel = "Lincoln Park bandshell",
                                ),
                        ),
                )
            }
        }
    }

    @Test
    fun listing_compose_step6_review() {
        paparazzi.snapshot {
            Frame {
                ListingComposeStepPreview(
                    state =
                        ListingComposeUiState(
                            form =
                                ListingComposeFormState(
                                    step = ListingComposeStep.Review.ordinal0,
                                    entryMode = ListingComposeEntryMode.Manual,
                                    photos = seededPhotos,
                                    title = "Moving boxes — bundle of 18",
                                    category = ListingComposeCategory.Goods,
                                    condition = ListingComposeCondition.LikeNew,
                                    bodyText = "Lightly used, perfect for a one-bedroom move across town.",
                                    priceKind = ListingComposePriceKind.Fixed,
                                    priceAmount = "25",
                                    fulfillment = ListingComposeFulfillment.Pickup,
                                    locationKind = ListingComposeLocationKind.SavedAddress,
                                ),
                        ),
                )
            }
        }
    }

    @Test
    fun listing_compose_success() {
        paparazzi.snapshot {
            Frame {
                ListingComposeStepPreview(
                    state =
                        ListingComposeUiState(
                            form =
                                ListingComposeFormState(
                                    step = ListingComposeStep.Success.ordinal0,
                                ),
                            createdListingId = "listing_42",
                        ),
                )
            }
        }
    }

    @Test
    fun listing_compose_error_banner() {
        paparazzi.snapshot {
            Frame {
                ListingComposeStepPreview(
                    state =
                        ListingComposeUiState(
                            form =
                                ListingComposeFormState(
                                    step = ListingComposeStep.Review.ordinal0,
                                    entryMode = ListingComposeEntryMode.Manual,
                                    photos = seededPhotos,
                                    title = "Moving boxes — bundle of 18",
                                    category = ListingComposeCategory.Goods,
                                    condition = ListingComposeCondition.LikeNew,
                                    bodyText = "Lightly used, perfect for a one-bedroom move across town.",
                                    priceKind = ListingComposePriceKind.Fixed,
                                    priceAmount = "25",
                                    fulfillment = ListingComposeFulfillment.Pickup,
                                    locationKind = ListingComposeLocationKind.SavedAddress,
                                ),
                            errorMessage = "Couldn't list your item. Please try again.",
                        ),
                )
            }
        }
    }

    // P3.3 — Edit-mode prefill, landing on Review. Same step-body
    // geometry as the create flow but every field is filled (title,
    // condition, price, fulfillment, location) so the user can scan
    // and tap Save changes. The wizard chrome (title, CTA labels)
    // lives at the shell level and isn't captured here.
    @Test
    fun listing_compose_edit_prefill_review() {
        paparazzi.snapshot {
            Frame {
                ListingComposeStepPreview(
                    state =
                        ListingComposeUiState(
                            form =
                                ListingComposeFormState(
                                    step = ListingComposeStep.Review.ordinal0,
                                    entryMode = ListingComposeEntryMode.Manual,
                                    photos = seededPhotos,
                                    title = "Mid-century walnut credenza",
                                    category = ListingComposeCategory.Goods,
                                    condition = ListingComposeCondition.LikeNew,
                                    bodyText =
                                        "Solid walnut, four sliding doors, dovetail joinery. " +
                                            "Lightly used — happy to deliver within Lincoln Park.",
                                    priceKind = ListingComposePriceKind.Fixed,
                                    priceAmount = "420",
                                    fulfillment = ListingComposeFulfillment.Pickup,
                                    locationKind = ListingComposeLocationKind.MeetPoint,
                                    locationLabel = "Lincoln Park bandshell",
                                ),
                        ),
                )
            }
        }
    }

    // P3.3 — Edit-mode "Edit price" entry point. Reached via the
    // pencil chip on the listing-offers header. Prefilled form
    // lands on the Price step so the seller can tweak the amount
    // and save in one tap.
    @Test
    fun listing_compose_edit_jump_to_price() {
        paparazzi.snapshot {
            Frame {
                ListingComposeStepPreview(
                    state =
                        ListingComposeUiState(
                            form =
                                ListingComposeFormState(
                                    step = ListingComposeStep.Price.ordinal0,
                                    entryMode = ListingComposeEntryMode.Manual,
                                    photos = seededPhotos,
                                    title = "Mid-century walnut credenza",
                                    category = ListingComposeCategory.Goods,
                                    condition = ListingComposeCondition.LikeNew,
                                    bodyText =
                                        "Solid walnut, four sliding doors, dovetail joinery.",
                                    priceKind = ListingComposePriceKind.Fixed,
                                    priceAmount = "420",
                                    fulfillment = ListingComposeFulfillment.Pickup,
                                    locationKind = ListingComposeLocationKind.MeetPoint,
                                    locationLabel = "Lincoln Park bandshell",
                                ),
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
                        .background(PantopusColors.appBg),
            ) { content() }
        }
    }
}
