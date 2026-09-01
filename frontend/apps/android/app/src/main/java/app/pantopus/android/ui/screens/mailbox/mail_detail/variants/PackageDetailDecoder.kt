@file:Suppress("PackageNaming", "MagicNumber", "ReturnCount", "ComplexMethod", "LongMethod")

package app.pantopus.android.ui.screens.mailbox.mail_detail.variants

import app.pantopus.android.ui.components.TimelineStep
import app.pantopus.android.ui.components.TimelineStepState
import app.pantopus.android.ui.screens.mailbox.item_detail.PackageBodyContent
import app.pantopus.android.ui.screens.mailbox.item_detail.PackageContents
import app.pantopus.android.ui.screens.mailbox.item_detail.PackageContentsItem
import app.pantopus.android.ui.screens.mailbox.item_detail.PackageDeliveryPhoto
import app.pantopus.android.ui.screens.mailbox.item_detail.PackageDeliveryStatus
import app.pantopus.android.ui.screens.mailbox.item_detail.PackageHandoffStep
import app.pantopus.android.ui.theme.PantopusIcon

/**
 * A17.8 — Projects the `mail.object` JSON payload for a package
 * delivery into the reusable [PackageBodyContent] consumed by the
 * Package ceremonial layout. Backend keeps this payload untyped (route
 * handler at `backend/routes/mailboxV2.js:412`), so the decoder is
 * defensive: a missing tracking number or carrier still produces a
 * usable in-transit fallback rather than null. Mirrors iOS
 * `PackageBodyContent.decode(from:)`.
 */
fun decodePackageDetail(payload: Map<String, Any?>?): PackageBodyContent? {
    if (payload == null) return null
    val status = PackageDeliveryStatus.fromRaw(payload["status"] as? String)
    val service =
        (payload["service"] as? String)
            ?: (payload["delivery_service"] as? String)
            ?: (payload["mail_service"] as? String)
    val carrier = (payload["carrier"] as? String) ?: service
    val trackingNumber =
        (payload["tracking_number"] as? String)
            ?: (payload["tracking"] as? String)
    // Reject payloads that don't carry at least a carrier or tracking
    // number — the design's "track pill" needs one of them.
    if (carrier == null && trackingNumber == null) return null
    return PackageBodyContent(
        carrier = carrier ?: "Pantopus Mail",
        service = service,
        dimensions = (payload["dimensions"] as? String) ?: (payload["size"] as? String),
        weight = payload["weight"] as? String,
        trackingUrl = (payload["tracking_url"] as? String) ?: (payload["carrier_url"] as? String),
        etaLine = (payload["eta_line"] as? String) ?: (payload["eta"] as? String),
        status = status,
        trackingNumber = trackingNumber,
        referenceLine = payload["reference_line"] as? String,
        statusTitle = payload["status_title"] as? String ?: defaultStatusTitle(status),
        statusDetail = payload["status_detail"] as? String ?: defaultStatusDetail(status),
        trackingSteps = decodeTimeline(payload["tracking_steps"], status),
        handoffSteps = decodeHandoff(payload["handoff_steps"]),
        deliveryPhoto = decodePhoto(payload["delivery_photo"], status),
        contents = decodeContents(payload["contents"]),
    )
}

private fun defaultStatusTitle(status: PackageDeliveryStatus): String =
    when (status) {
        PackageDeliveryStatus.Shipped -> "Shipped"
        PackageDeliveryStatus.InTransit -> "In transit"
        PackageDeliveryStatus.OutForDelivery -> "Out for delivery"
        PackageDeliveryStatus.Delivered -> "Delivered to your porch"
    }

private fun defaultStatusDetail(status: PackageDeliveryStatus): String =
    when (status) {
        PackageDeliveryStatus.Shipped -> "Label created by the sender."
        PackageDeliveryStatus.InTransit -> "Moving through the carrier network."
        PackageDeliveryStatus.OutForDelivery -> "Expected today by 3 PM."
        PackageDeliveryStatus.Delivered -> "Front porch - left in shade."
    }

private fun decodeTimeline(
    raw: Any?,
    fallback: PackageDeliveryStatus,
): List<TimelineStep> {
    val list = raw as? List<*>
    if (!list.isNullOrEmpty()) {
        return list.mapIndexedNotNull { index, item ->
            val map = item as? Map<*, *> ?: return@mapIndexedNotNull null
            val title = map["title"] as? String ?: return@mapIndexedNotNull null
            val state =
                when (map["state"] as? String) {
                    "done" -> TimelineStepState.Done
                    "current" -> TimelineStepState.Current
                    else -> TimelineStepState.Upcoming
                }
            TimelineStep(
                title = title,
                subtitle = (map["subtitle"] as? String) ?: "",
                state = state,
            )
        }
    }
    // Derive a four-row timeline from the status so the variant still
    // renders its canonical shape when the backend omits the array.
    val labels =
        listOf(
            "Shipped",
            "In transit",
            "Out for delivery",
            "Delivered",
        )
    val currentIndex =
        when (fallback) {
            PackageDeliveryStatus.Shipped -> 0
            PackageDeliveryStatus.InTransit -> 1
            PackageDeliveryStatus.OutForDelivery -> 2
            PackageDeliveryStatus.Delivered -> 3
        }
    return labels.mapIndexed { index, title ->
        val state =
            when {
                index < currentIndex -> TimelineStepState.Done
                index == currentIndex -> TimelineStepState.Current
                else -> TimelineStepState.Upcoming
            }
        TimelineStep(title = title, subtitle = "", state = state)
    }
}

private fun decodeHandoff(raw: Any?): List<PackageHandoffStep> {
    val list = raw as? List<*> ?: return emptyList()
    return list.mapIndexedNotNull { index, item ->
        val map = item as? Map<*, *> ?: return@mapIndexedNotNull null
        val title = map["title"] as? String ?: return@mapIndexedNotNull null
        val icon =
            when (map["icon"] as? String) {
                "package" -> PantopusIcon.Package
                "home" -> PantopusIcon.Home
                "building" -> PantopusIcon.Building2
                "tag" -> PantopusIcon.Tag
                else -> PantopusIcon.ArrowRight
            }
        PackageHandoffStep(
            id = (map["id"] as? String) ?: "handoff-$index",
            title = title,
            location = (map["location"] as? String) ?: "",
            timestamp = (map["timestamp"] as? String) ?: "",
            icon = icon,
        )
    }
}

private fun decodePhoto(
    raw: Any?,
    status: PackageDeliveryStatus,
): PackageDeliveryPhoto? {
    val map = raw as? Map<*, *> ?: return null
    val capturedAt = map["captured_at"] as? String ?: return null
    return PackageDeliveryPhoto(
        capturedAt = capturedAt,
        watermark = (map["watermark"] as? String) ?: "",
        location = (map["location"] as? String) ?: "",
        verificationLabel = (map["verification_label"] as? String) ?: "GPS verified",
        isReceived =
            (map["is_received"] as? Boolean)
                ?: (status == PackageDeliveryStatus.Delivered),
    )
}

private fun decodeContents(raw: Any?): PackageContents? {
    val map = raw as? Map<*, *> ?: return null
    val title = map["title"] as? String ?: return null
    val items =
        (map["items"] as? List<*>).orEmpty().mapIndexedNotNull { index, item ->
            val itemMap = item as? Map<*, *> ?: return@mapIndexedNotNull null
            val name = itemMap["name"] as? String ?: return@mapIndexedNotNull null
            PackageContentsItem(
                id = (itemMap["id"] as? String) ?: "item-$index",
                quantity = (itemMap["quantity"] as? Number)?.toInt() ?: 1,
                name = name,
                detail = (itemMap["detail"] as? String) ?: "",
            )
        }
    return PackageContents(
        title = title,
        items = items,
        subtotal = map["subtotal"] as? String,
        shipping = map["shipping"] as? String,
        total = map["total"] as? String,
    )
}
