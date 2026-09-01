//
//  PackageBodyContent+Decode.swift
//  Pantopus
//
//  A17.8 — Projects the `mail.object` JSON payload for a package
//  delivery into the reusable `PackageBodyContent` consumed by the
//  Package ceremonial layout. Backend keeps this payload untyped (route
//  handler at `backend/routes/mailboxV2.js:412`), so the decoder is
//  defensive: a missing carrier or tracking number still produces a
//  usable in-transit fallback rather than nil.
//

import Foundation

extension PackageBodyContent {
    /// Best-effort decode from a JSON envelope. Returns nil when the
    /// payload is empty or doesn't look like a package — the variant
    /// dispatcher then falls back to the generic A17.1 layout.
    public static func decode(from value: JSONValue?) -> PackageBodyContent? {
        guard let dict = value?.dictValue else { return nil }
        let status = PackageDeliveryStatus(rawStatus: dict["status"]?.stringValue)
        let service = dict["service"]?.stringValue
            ?? dict["delivery_service"]?.stringValue
            ?? dict["mail_service"]?.stringValue
        let carrier = dict["carrier"]?.stringValue ?? service
        let trackingNumber = dict["tracking_number"]?.stringValue
            ?? dict["tracking"]?.stringValue
        // Reject payloads that don't carry at least a carrier or
        // tracking number — the design's "track pill" needs one of them.
        guard carrier != nil || trackingNumber != nil else { return nil }
        return PackageBodyContent(
            carrier: carrier ?? "Pantopus Mail",
            service: service,
            dimensions: dict["dimensions"]?.stringValue ?? dict["size"]?.stringValue,
            weight: dict["weight"]?.stringValue,
            trackingUrl: dict["tracking_url"]?.stringValue ?? dict["carrier_url"]?.stringValue,
            etaLine: dict["eta_line"]?.stringValue ?? dict["eta"]?.stringValue,
            status: status,
            trackingNumber: trackingNumber,
            referenceLine: dict["reference_line"]?.stringValue,
            statusTitle: dict["status_title"]?.stringValue,
            statusDetail: dict["status_detail"]?.stringValue,
            trackingSteps: decodeTimeline(dict["tracking_steps"], fallback: status),
            handoffSteps: decodeHandoff(dict["handoff_steps"]),
            deliveryPhoto: decodePhoto(dict["delivery_photo"], status: status),
            contents: decodeContents(dict["contents"])
        )
    }

    private static func decodeTimeline(
        _ value: JSONValue?,
        fallback status: PackageDeliveryStatus
    ) -> [TimelineStep] {
        if let array = value?.arrayValue, !array.isEmpty {
            return array.enumerated().compactMap { index, raw in
                guard let dict = raw.dictValue,
                      let title = dict["title"]?.stringValue else { return nil }
                let state: TimelineStepState = switch dict["state"]?.stringValue {
                case "done": .done
                case "current": .current
                default: .upcoming
                }
                return TimelineStep(
                    id: dict["id"]?.stringValue ?? "tracking-\(index)",
                    title: title,
                    subtitle: dict["subtitle"]?.stringValue ?? "",
                    state: state
                )
            }
        }
        // Backend hasn't sent a timeline yet — build a derived one from
        // the status so the variant still renders its four canonical rows.
        let labels: [(id: String, title: String)] = [
            ("shipped", "Shipped"),
            ("in_transit", "In transit"),
            ("out_for_delivery", "Out for delivery"),
            ("delivered", "Delivered")
        ]
        let currentIndex = switch status {
        case .shipped: 0
        case .inTransit: 1
        case .outForDelivery: 2
        case .delivered: 3
        }
        return labels.enumerated().map { index, item in
            let state: TimelineStepState = if index < currentIndex {
                .done
            } else if index == currentIndex {
                .current
            } else {
                .upcoming
            }
            return TimelineStep(id: item.id, title: item.title, subtitle: "", state: state)
        }
    }

    private static func decodeHandoff(_ value: JSONValue?) -> [PackageHandoffStep] {
        guard let array = value?.arrayValue else { return [] }
        return array.enumerated().compactMap { index, raw in
            guard let dict = raw.dictValue,
                  let title = dict["title"]?.stringValue else { return nil }
            let icon: PantopusIcon = switch dict["icon"]?.stringValue {
            case "package": .package
            case "home": .home
            case "building": .building2
            case "tag": .tag
            default: .arrowRight
            }
            return PackageHandoffStep(
                id: dict["id"]?.stringValue ?? "handoff-\(index)",
                title: title,
                location: dict["location"]?.stringValue ?? "",
                timestamp: dict["timestamp"]?.stringValue ?? "",
                icon: icon
            )
        }
    }

    private static func decodePhoto(
        _ value: JSONValue?,
        status: PackageDeliveryStatus
    ) -> PackageDeliveryPhoto? {
        guard let dict = value?.dictValue,
              let capturedAt = dict["captured_at"]?.stringValue else { return nil }
        return PackageDeliveryPhoto(
            capturedAt: capturedAt,
            watermark: dict["watermark"]?.stringValue ?? "",
            location: dict["location"]?.stringValue ?? "",
            verificationLabel: dict["verification_label"]?.stringValue ?? "GPS verified",
            isReceived: dict["is_received"]?.boolValue ?? (status == .delivered)
        )
    }

    private static func decodeContents(_ value: JSONValue?) -> PackageContents? {
        guard let dict = value?.dictValue,
              let title = dict["title"]?.stringValue else { return nil }
        let items: [PackageContentsItem] = (dict["items"]?.arrayValue ?? []).enumerated().compactMap { index, raw in
            guard let itemDict = raw.dictValue,
                  let name = itemDict["name"]?.stringValue else { return nil }
            return PackageContentsItem(
                id: itemDict["id"]?.stringValue ?? "item-\(index)",
                quantity: Int(itemDict["quantity"]?.numberValue ?? 1),
                name: name,
                detail: itemDict["detail"]?.stringValue ?? ""
            )
        }
        return PackageContents(
            title: title,
            items: items,
            subtotal: dict["subtotal"]?.stringValue,
            shipping: dict["shipping"]?.stringValue,
            total: dict["total"]?.stringValue
        )
    }
}
