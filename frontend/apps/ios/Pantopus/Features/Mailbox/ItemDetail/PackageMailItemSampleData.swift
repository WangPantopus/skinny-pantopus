//
//  PackageMailItemSampleData.swift
//  Pantopus
//
//  Package fixtures for mailbox item-detail bodies.
//

import Foundation

private struct PackageTrackingFixture {
    let id: String
    let title: String
    let subtitle: String
}

public extension MailItemSampleData {
    static let packageContents = PackageContents(
        title: "Lerina Books - order #LB-44218",
        items: [
            .init(
                id: "calvino",
                quantity: 1,
                name: "Italo Calvino - Invisible Cities",
                detail: "paperback"
            ),
            .init(
                id: "dillard",
                quantity: 1,
                name: "Annie Dillard - Pilgrim at Tinker Creek",
                detail: "paperback"
            )
        ],
        subtotal: "$28.40",
        shipping: "$5.20",
        total: "$33.60"
    )

    static let packageDeliveryPhoto = PackageDeliveryPhoto(
        capturedAt: "1:47 PM",
        watermark: "USPS - 18/05/2026 13:47:08",
        location: "Front porch - 1428 Elm St",
        verificationLabel: "GPS verified"
    )

    static let packageInTransit = PackageBodyContent(
        carrier: "USPS Priority Mail",
        service: "USPS Priority Mail",
        dimensions: "12 x 9 x 4 in",
        weight: "2.4 lb",
        trackingUrl: "https://tools.usps.com/go/TrackConfirmAction?tLabels=9505512588416014220317",
        etaLine: "Expected today by 3 PM",
        status: .inTransit,
        trackingNumber: "9505 5125 8841 6014 2203 17",
        referenceLine: "USPS - weight 2.4 lb - 12x9x4 in",
        statusTitle: "In transit",
        statusDetail: "Moving through Sacramento, CA",
        trackingSteps: packageTrackingSteps(status: .inTransit),
        handoffSteps: [
            .init(
                id: "in-transit",
                title: "In transit",
                location: "Sacramento, CA",
                timestamp: "Sat May 16 - 11:40 PM",
                icon: .arrowRight
            ),
            .init(
                id: "picked-up",
                title: "Picked up by courier",
                location: "Portland, OR",
                timestamp: "Thu May 14 - 4:21 PM",
                icon: .package
            ),
            .init(
                id: "label-created",
                title: "Label created - Lerina Books",
                location: "Portland, OR",
                timestamp: "Wed May 13 - 10:02 AM",
                icon: .tag
            )
        ],
        contents: packageContents
    )

    static let packageOutForDelivery = PackageBodyContent(
        carrier: "USPS Priority Mail",
        service: "USPS Priority Mail",
        dimensions: "12 x 9 x 4 in",
        weight: "2.4 lb",
        trackingUrl: "https://tools.usps.com/go/TrackConfirmAction?tLabels=9505512588416014220317",
        etaLine: "ETA window 1:00 - 3:00 PM - about 6 stops away",
        status: .outForDelivery,
        trackingNumber: "9505 5125 8841 6014 2203 17",
        referenceLine: "USPS - weight 2.4 lb - 12x9x4 in",
        statusTitle: "Out for delivery - Route 22",
        statusDetail: "ETA window 1:00 - 3:00 PM - about 6 stops away",
        trackingSteps: packageTrackingSteps(status: .outForDelivery),
        handoffSteps: [
            .init(
                id: "pending-delivery",
                title: "Delivered to front porch",
                location: "Pending",
                timestamp: "Expected today - by 3 PM",
                icon: .home
            ),
            .init(
                id: "out-for-delivery",
                title: "Out for delivery",
                location: "Oakland Branch - Route 22",
                timestamp: "Mon May 18 - 8:12 AM",
                icon: .package
            ),
            .init(
                id: "local-facility",
                title: "Arrived at local facility",
                location: "Oakland, CA",
                timestamp: "Mon May 18 - 5:03 AM",
                icon: .building2
            ),
            .init(
                id: "in-transit",
                title: "In transit",
                location: "Sacramento, CA",
                timestamp: "Sat May 16 - 11:40 PM",
                icon: .arrowRight
            )
        ],
        contents: packageContents
    )

    static let packageDelivered = PackageBodyContent(
        carrier: "USPS Priority Mail",
        service: "USPS Priority Mail",
        dimensions: "12 x 9 x 4 in",
        weight: "2.4 lb",
        trackingUrl: "https://tools.usps.com/go/TrackConfirmAction?tLabels=9505512588416014220317",
        etaLine: "Today - 1:47 PM - front porch - left in shade",
        status: .delivered,
        trackingNumber: "9505 5125 8841 6014 2203 17",
        referenceLine: "USPS - weight 2.4 lb - 12x9x4 in",
        statusTitle: "Delivered to your porch",
        statusDetail: "Today - 1:47 PM - front porch - left in shade",
        trackingSteps: packageTrackingSteps(status: .delivered),
        handoffSteps: [
            .init(
                id: "delivered",
                title: "Delivered to front porch",
                location: "Oakland, CA - 1428 Elm St",
                timestamp: "Mon May 18 - 1:47 PM",
                icon: .home
            ),
            .init(
                id: "out-for-delivery",
                title: "Out for delivery",
                location: "Oakland Branch - Route 22",
                timestamp: "Mon May 18 - 8:12 AM",
                icon: .package
            ),
            .init(
                id: "local-facility",
                title: "Arrived at local facility",
                location: "Oakland, CA",
                timestamp: "Mon May 18 - 5:03 AM",
                icon: .building2
            ),
            .init(
                id: "in-transit",
                title: "In transit",
                location: "Sacramento, CA",
                timestamp: "Sat May 16 - 11:40 PM",
                icon: .arrowRight
            )
        ],
        deliveryPhoto: packageDeliveryPhoto,
        contents: packageContents
    )

    static func packageBody(status: PackageDeliveryStatus) -> PackageBodyContent {
        switch status {
        case .shipped, .inTransit: packageInTransit
        case .outForDelivery: packageOutForDelivery
        case .delivered: packageDelivered
        }
    }

    /// UPS fixture - in transit. Used by A17.8 acceptance tests.
    static let packageUpsInTransit = PackageBodyContent(
        carrier: "UPS",
        service: "UPS Ground",
        dimensions: "14 x 10 x 6 in",
        weight: "3.8 lb",
        trackingUrl: "https://www.ups.com/track?tracknum=1Z999AA10123456784",
        etaLine: "Expected tomorrow by 8 PM",
        status: .inTransit,
        trackingNumber: "1Z 999 AA1 0123 4567 84",
        referenceLine: "UPS Ground - 3.8 lb - 14x10x6 in",
        statusTitle: "In transit",
        statusDetail: "Moving through Reno, NV",
        trackingSteps: packageTrackingSteps(status: .inTransit),
        handoffSteps: [
            .init(
                id: "in-transit",
                title: "In transit",
                location: "Reno, NV",
                timestamp: "Sun May 17 - 9:14 PM",
                icon: .arrowRight
            ),
            .init(
                id: "picked-up",
                title: "Picked up by UPS",
                location: "Hayward, CA",
                timestamp: "Sat May 16 - 5:42 PM",
                icon: .package
            ),
            .init(
                id: "label-created",
                title: "Label created",
                location: "Hayward, CA",
                timestamp: "Sat May 16 - 11:11 AM",
                icon: .tag
            )
        ]
    )

    /// UPS fixture - delivered. Used by A17.8 acceptance tests.
    static let packageUpsDelivered = PackageBodyContent(
        carrier: "UPS",
        service: "UPS Ground",
        dimensions: "14 x 10 x 6 in",
        weight: "3.8 lb",
        trackingUrl: "https://www.ups.com/track?tracknum=1Z999AA10123456784",
        etaLine: "Today - 11:22 AM - front porch",
        status: .delivered,
        trackingNumber: "1Z 999 AA1 0123 4567 84",
        referenceLine: "UPS Ground - 3.8 lb - 14x10x6 in",
        statusTitle: "Delivered to your porch",
        statusDetail: "Today - 11:22 AM - front porch",
        trackingSteps: packageTrackingSteps(status: .delivered),
        handoffSteps: [
            .init(
                id: "delivered",
                title: "Delivered to front porch",
                location: "Oakland, CA - 1428 Elm St",
                timestamp: "Tue May 19 - 11:22 AM",
                icon: .home
            ),
            .init(
                id: "out-for-delivery",
                title: "Out for delivery",
                location: "Oakland Hub - Route 14",
                timestamp: "Tue May 19 - 7:38 AM",
                icon: .truck
            ),
            .init(
                id: "in-transit",
                title: "In transit",
                location: "Reno, NV",
                timestamp: "Sun May 17 - 9:14 PM",
                icon: .arrowRight
            )
        ],
        deliveryPhoto: PackageDeliveryPhoto(
            capturedAt: "11:22 AM",
            watermark: "UPS - 19/05/2026 11:22:14",
            location: "Front porch - 1428 Elm St",
            verificationLabel: "GPS verified"
        )
    )

    static func packageTrackingSteps(status: PackageDeliveryStatus) -> [TimelineStep] {
        let currentIndex = switch status {
        case .shipped: 0
        case .inTransit: 1
        case .outForDelivery: 2
        case .delivered: 3
        }
        let items = [
            PackageTrackingFixture(
                id: "shipped",
                title: "Shipped",
                subtitle: "Wed May 13 - label created"
            ),
            PackageTrackingFixture(
                id: "in_transit",
                title: "In transit",
                subtitle: "Sat May 16 - Sacramento, CA"
            ),
            PackageTrackingFixture(
                id: "out_for_delivery",
                title: "Out for delivery",
                subtitle: "Mon May 18 - Route 22"
            ),
            PackageTrackingFixture(
                id: "delivered",
                title: "Delivered",
                subtitle: status == .delivered ? "Mon May 18 - 1:47 PM" : "Expected today"
            )
        ]
        return items.enumerated().map { index, item in
            let state: TimelineStepState = if index < currentIndex {
                .done
            } else if index == currentIndex {
                .current
            } else {
                .upcoming
            }
            return TimelineStep(id: item.id, title: item.title, subtitle: item.subtitle, state: state)
        }
    }
}
