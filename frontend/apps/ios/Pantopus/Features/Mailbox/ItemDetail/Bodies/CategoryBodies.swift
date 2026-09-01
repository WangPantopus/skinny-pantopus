//
//  CategoryBodies.swift
//  Pantopus
//
//  Category-specific body slots. `PackageBody` is the concrete A17.8 body;
//  `GenericMailBody` renders the readable message (document card +
//  attachments + tags) for every category without a bespoke body, so no
//  category falls back to a placeholder.
//

// swiftlint:disable file_length

import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

/// A17.8 Package body: courier status, proof photo, tracking stepper,
/// carrier handoff scans, contents, and the carrier-tracking +
/// confirm-pickup split dock.
public struct PackageBody: View {
    private let content: PackageBodyContent
    private let isReceiveEnabled: Bool
    private let isReceiveLoading: Bool
    private let isReceived: Bool
    private let showsActions: Bool
    private let onReceiveAtDoor: @MainActor () -> Void

    public init(
        content: PackageBodyContent,
        isReceiveEnabled: Bool = true,
        isReceiveLoading: Bool = false,
        isReceived: Bool = false,
        showsActions: Bool = true,
        onReceiveAtDoor: @escaping @MainActor () -> Void = {}
    ) {
        self.content = content
        self.isReceiveEnabled = isReceiveEnabled
        self.isReceiveLoading = isReceiveLoading
        self.isReceived = isReceived
        self.showsActions = showsActions
        self.onReceiveAtDoor = onReceiveAtDoor
    }

    public init(
        carrier: String,
        etaLine: String? = nil,
        status: PackageDeliveryStatus = .outForDelivery,
        trackingNumber: String? = nil,
        referenceLine: String? = nil,
        trackingSteps: [TimelineStep]? = nil,
        handoffSteps: [PackageHandoffStep]? = nil,
        deliveryPhoto: PackageDeliveryPhoto? = nil,
        contents: PackageContents? = nil,
        isReceiveEnabled: Bool = true,
        isReceiveLoading: Bool = false,
        isReceived: Bool = false,
        showsActions: Bool = true,
        onReceiveAtDoor: @escaping @MainActor () -> Void = {}
    ) {
        let sample = MailItemSampleData.packageBody(status: status)
        content = PackageBodyContent(
            carrier: carrier,
            service: sample.service,
            dimensions: sample.dimensions,
            weight: sample.weight,
            trackingUrl: sample.trackingUrl,
            etaLine: etaLine ?? sample.etaLine,
            status: status,
            trackingNumber: trackingNumber ?? sample.trackingNumber,
            referenceLine: referenceLine ?? sample.referenceLine,
            statusTitle: sample.statusTitle,
            statusDetail: sample.statusDetail,
            trackingSteps: trackingSteps ?? sample.trackingSteps,
            handoffSteps: handoffSteps ?? sample.handoffSteps,
            deliveryPhoto: deliveryPhoto ?? sample.deliveryPhoto,
            contents: contents ?? sample.contents
        )
        self.isReceiveEnabled = isReceiveEnabled
        self.isReceiveLoading = isReceiveLoading
        self.isReceived = isReceived
        self.showsActions = showsActions
        self.onReceiveAtDoor = onReceiveAtDoor
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            PackageStatusCard(content: content)
            if let photo = content.deliveryPhoto {
                PackageDeliveryPhotoCard(photo: photo)
            }
            PackageInsightCard(status: content.status)
            PackageTimelineCard(content: content)
            PackageHandoffCard(steps: content.handoffSteps)
            if let contents = content.contents {
                PackageContentsCard(contents: contents)
            }
            if showsActions {
                PackageSplitDock(
                    content: content,
                    isEnabled: isReceiveEnabled,
                    isLoading: isReceiveLoading,
                    isReceived: isReceived || content.deliveryPhoto?.isReceived == true,
                    onConfirmPickup: onReceiveAtDoor
                )
            }
        }
        .padding(.horizontal, Spacing.s4)
        .accessibilityIdentifier("packageBody")
    }
}

private struct PackageStatusCard: View {
    let content: PackageBodyContent

    var body: some View {
        PackageCard(noPadding: true) {
            HStack(spacing: Spacing.s3) {
                CarrierBadge(carrier: content.carrier)
                VStack(alignment: .leading, spacing: 2) {
                    Text("\(content.carrier) - Tracking #")
                        .pantopusTextStyle(.overline)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                    Text(content.trackingNumber ?? "Tracking pending")
                        .pantopusTextStyle(.small)
                        .foregroundStyle(Theme.Color.appText)
                        .textSelection(.enabled)
                    if let referenceLine = content.referenceLine {
                        Text(referenceLine)
                            .pantopusTextStyle(.caption)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                }
                Spacer(minLength: Spacing.s2)
                Button(action: {}, label: {
                    Icon(.copy, size: 16, color: Theme.Color.appTextStrong)
                        .frame(width: 44, height: 44)
                        .background(Theme.Color.appSurfaceSunken)
                        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                })
                .buttonStyle(.plain)
                .accessibilityLabel("Copy tracking number")
                .accessibilityIdentifier("packageBody.copyTracking")
            }
            .padding(Spacing.s3)
            Divider().background(Theme.Color.appBorderSubtle)
            statusBanner
        }
    }

    private var statusBanner: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            HStack(spacing: Spacing.s2) {
                ZStack {
                    RoundedRectangle(cornerRadius: markerRadius, style: .continuous)
                        .fill(markerBackground)
                    Icon(markerIcon, size: 15, color: Theme.Color.appTextInverse)
                }
                .frame(width: 28, height: 28)
                VStack(alignment: .leading, spacing: 2) {
                    Text(content.statusTitle)
                        .pantopusTextStyle(.body)
                        .foregroundStyle(titleColor)
                    Text(content.statusDetail)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(detailColor)
                }
            }
            if content.status == .outForDelivery {
                EtaProgressBar()
            }
        }
        .padding(Spacing.s4)
        .background(bannerBackground)
    }

    private var markerIcon: PantopusIcon {
        content.status == .delivered ? .check : .package
    }

    private var markerBackground: Color {
        content.status == .delivered ? Theme.Color.success : Theme.Color.primary600
    }

    private var markerRadius: CGFloat {
        content.status == .delivered ? Radii.pill : Radii.md
    }

    private var bannerBackground: Color {
        content.status == .delivered ? Theme.Color.successBg : Theme.Color.primary50
    }

    private var titleColor: Color {
        content.status == .delivered ? Theme.Color.success : Theme.Color.primary700
    }

    private var detailColor: Color {
        content.status == .delivered ? Theme.Color.success : Theme.Color.primary700
    }
}

private struct EtaProgressBar: View {
    var body: some View {
        HStack(spacing: Spacing.s2) {
            Text("Branch")
                .pantopusTextStyle(.overline)
                .foregroundStyle(Theme.Color.primary700)
            GeometryReader { proxy in
                ZStack(alignment: .leading) {
                    Capsule().fill(Theme.Color.primary100)
                    Capsule()
                        .fill(Theme.Color.primary600)
                        .frame(width: proxy.size.width * 0.68)
                    Circle()
                        .fill(Theme.Color.appSurface)
                        .overlay(Circle().stroke(Theme.Color.primary600, lineWidth: 2))
                        .frame(width: 12, height: 12)
                        .offset(x: max(0, proxy.size.width * 0.68 - 6))
                }
            }
            .frame(height: 12)
            Text("Porch")
                .pantopusTextStyle(.overline)
                .foregroundStyle(Theme.Color.primary700)
        }
        .accessibilityLabel("Delivery progress from branch to porch, about 68 percent")
    }
}

private struct PackageInsightCard: View {
    let status: PackageDeliveryStatus

    var body: some View {
        PackageCard {
            HStack(alignment: .top, spacing: Spacing.s2) {
                ZStack {
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .fill(Theme.Color.primary600)
                    Icon(.sparkles, size: 14, color: Theme.Color.appTextInverse)
                }
                .frame(width: 26, height: 26)
                VStack(alignment: .leading, spacing: Spacing.s2) {
                    Text(headline)
                        .pantopusTextStyle(.body)
                        .foregroundStyle(Theme.Color.primary800)
                    Text(summary)
                        .pantopusTextStyle(.small)
                        .foregroundStyle(Theme.Color.primary900)
                    VStack(alignment: .leading, spacing: Spacing.s1) {
                        bullet(icon: .camera, text: firstBullet)
                        bullet(icon: .mapPin, text: secondBullet)
                        bullet(icon: .shieldCheck, text: thirdBullet)
                    }
                }
            }
        }
        .background(Theme.Color.primary50)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.primary200, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .accessibilityIdentifier("packageBody.insight")
    }

    private func bullet(icon: PantopusIcon, text: String) -> some View {
        HStack(alignment: .top, spacing: Spacing.s2) {
            Icon(icon, size: 12, color: Theme.Color.primary700)
                .frame(width: 18, height: 18)
                .background(Theme.Color.appSurface)
                .clipShape(RoundedRectangle(cornerRadius: Radii.xs, style: .continuous))
            Text(text)
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextStrong)
        }
    }

    private var headline: String {
        status == .delivered ? "On your porch, photo looks right" : "Pantopus is watching this for you"
    }

    private var summary: String {
        status == .delivered
            ? "The carrier scan and proof photo match your verified address and normal drop spot."
            : "Carrier handoff is active. Pantopus will keep the delivery window and scan trail together."
    }

    private var firstBullet: String {
        status == .delivered ? "Photo matches your porch" : "Carrier route is moving toward your block"
    }

    private var secondBullet: String {
        status == .delivered ? "Delivered to 1428 Elm St" : "ETA window stays visible here"
    }

    private var thirdBullet: String {
        status == .delivered ? "No signature required" : "No signature required"
    }
}

@MainActor
private struct PackageTimelineCard: View {
    let content: PackageBodyContent

    var body: some View {
        PackageTrackingTimeline(
            steps: content.trackingSteps,
            carrier: content.carrier,
            onOpenCarrier: openCarrierAction
        )
        .accessibilityIdentifier("packageBody.trackingTimeline")
    }

    private var openCarrierAction: (@MainActor () -> Void)? {
        guard let urlString = content.trackingUrl, let url = URL(string: urlString) else {
            return nil
        }
        return {
            #if canImport(UIKit)
            UIApplication.shared.open(url)
            #endif
        }
    }
}

private struct PackageHandoffCard: View {
    let steps: [PackageHandoffStep]

    var body: some View {
        PackageCard {
            SectionHeader("Carrier handoff")
            VStack(alignment: .leading, spacing: Spacing.s0) {
                ForEach(Array(steps.enumerated()), id: \.element.id) { index, step in
                    HStack(alignment: .top, spacing: Spacing.s3) {
                        Icon(step.icon, size: 14, color: Theme.Color.primary600)
                            .frame(width: 24, height: 24)
                            .background(Theme.Color.primary50)
                            .clipShape(Circle())
                        VStack(alignment: .leading, spacing: 2) {
                            Text(step.title)
                                .pantopusTextStyle(.small)
                                .foregroundStyle(Theme.Color.appText)
                            Text("\(step.location) - \(step.timestamp)")
                                .pantopusTextStyle(.caption)
                                .foregroundStyle(Theme.Color.appTextSecondary)
                        }
                    }
                    .padding(.vertical, Spacing.s2)
                    if index < steps.count - 1 {
                        Divider().background(Theme.Color.appBorderSubtle)
                    }
                }
            }
        }
        .accessibilityIdentifier("packageBody.carrierHandoff")
    }
}

private struct PackageDeliveryPhotoCard: View {
    let photo: PackageDeliveryPhoto

    var body: some View {
        PackageCard(noPadding: true) {
            HStack(spacing: Spacing.s2) {
                Icon(.camera, size: 13, color: Theme.Color.appTextSecondary)
                Text("Courier proof photo")
                    .pantopusTextStyle(.overline)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                Spacer()
                Text(photo.capturedAt)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, Spacing.s2)
            Divider().background(Theme.Color.appBorderSubtle)
            PorchPhotoIllustration(photo: photo)
            Divider().background(Theme.Color.appBorderSubtle)
            HStack(spacing: Spacing.s2) {
                Icon(.mapPin, size: 13, color: Theme.Color.appTextSecondary)
                Text(photo.location)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextStrong)
                Spacer()
                Text(photo.verificationLabel)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.success)
                    .padding(.horizontal, Spacing.s2)
                    .padding(.vertical, 3)
                    .background(Theme.Color.appSurface)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, Spacing.s2)
            .background(Theme.Color.appSurfaceSunken)
        }
        .accessibilityIdentifier("packageBody.deliveryPhoto")
    }
}

private struct PorchPhotoIllustration: View {
    let photo: PackageDeliveryPhoto

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            GeometryReader { proxy in
                let width = proxy.size.width
                let height = proxy.size.height
                ZStack {
                    Theme.Color.appTextStrong
                    Theme.Color.warningLight
                        .frame(height: height * 0.62)
                        .frame(maxHeight: .infinity, alignment: .top)
                    Theme.Color.appTextStrong.opacity(0.85)
                        .frame(height: height * 0.38)
                        .frame(maxHeight: .infinity, alignment: .bottom)
                    RoundedRectangle(cornerRadius: Radii.sm)
                        .fill(Theme.Color.primary900)
                        .frame(width: width * 0.30, height: height * 0.64)
                        .position(x: width * 0.78, y: height * 0.39)
                    RoundedRectangle(cornerRadius: Radii.sm)
                        .fill(Theme.Color.warning)
                        .frame(width: width * 0.20, height: height * 0.20)
                        .overlay(
                            Rectangle()
                                .fill(Theme.Color.warningLight)
                                .frame(height: 6)
                        )
                        .position(x: width * 0.42, y: height * 0.76)
                    RoundedRectangle(cornerRadius: Radii.sm)
                        .fill(Theme.Color.appTextStrong)
                        .frame(width: width * 0.34, height: height * 0.08)
                        .position(x: width * 0.76, y: height * 0.86)
                    Circle()
                        .fill(Theme.Color.home)
                        .frame(width: 44, height: 44)
                        .position(x: width * 0.15, y: height * 0.68)
                    Theme.Color.appText.opacity(0.20)
                }
                .accessibilityHidden(true)
            }
            Text(photo.watermark)
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextInverse)
                .padding(.horizontal, Spacing.s2)
                .padding(.vertical, Spacing.s1)
                .background(Theme.Color.appText.opacity(0.55))
                .clipShape(RoundedRectangle(cornerRadius: Radii.xs, style: .continuous))
                .padding(Spacing.s3)
            HStack(spacing: Spacing.s2) {
                Spacer()
                photoButton(icon: .search, label: "Zoom proof photo", identifier: "packageBody.zoomPhoto")
                photoButton(icon: .flag, label: "Flag proof photo", identifier: "packageBody.flagPhoto")
            }
            .padding(Spacing.s3)
            if photo.isReceived {
                HStack(spacing: Spacing.s1) {
                    Icon(.check, size: 11, color: Theme.Color.appTextInverse)
                    Text("In your hands")
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextInverse)
                }
                .padding(.horizontal, Spacing.s2)
                .padding(.vertical, Spacing.s1)
                .background(Theme.Color.success)
                .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
                .padding(Spacing.s3)
            }
        }
        .aspectRatio(4.0 / 3.0, contentMode: .fit)
        .background(Theme.Color.appText)
        .accessibilityLabel("Courier proof photo at \(photo.location)")
    }

    private func photoButton(icon: PantopusIcon, label: String, identifier: String) -> some View {
        Button(action: {}, label: {
            Icon(icon, size: 14, color: Theme.Color.appText)
                .frame(width: 44, height: 44)
                .background(Theme.Color.appSurface.opacity(0.95))
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        })
        .buttonStyle(.plain)
        .accessibilityLabel(label)
        .accessibilityIdentifier(identifier)
    }
}

private struct PackageContentsCard: View {
    let contents: PackageContents

    var body: some View {
        PackageCard(noPadding: true) {
            HStack {
                Text("What's inside")
                    .pantopusTextStyle(.overline)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                Spacer()
                Text("Order details")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.primary600)
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, Spacing.s2)
            Divider().background(Theme.Color.appBorderSubtle)
            VStack(alignment: .leading, spacing: Spacing.s2) {
                Text(contents.title)
                    .pantopusTextStyle(.small)
                    .foregroundStyle(Theme.Color.appText)
                ForEach(contents.items) { item in
                    HStack(alignment: .top, spacing: Spacing.s2) {
                        Text("\(item.quantity)x")
                            .pantopusTextStyle(.caption)
                            .foregroundStyle(Theme.Color.appTextStrong)
                            .frame(width: 28, height: 24)
                            .background(Theme.Color.appSurfaceSunken)
                            .clipShape(RoundedRectangle(cornerRadius: Radii.sm, style: .continuous))
                        VStack(alignment: .leading, spacing: 2) {
                            Text(item.name)
                                .pantopusTextStyle(.small)
                                .foregroundStyle(Theme.Color.appText)
                            Text(item.detail)
                                .pantopusTextStyle(.caption)
                                .foregroundStyle(Theme.Color.appTextSecondary)
                        }
                    }
                }
            }
            .padding(Spacing.s3)
            if contents.subtotal != nil || contents.shipping != nil || contents.total != nil {
                Divider().background(Theme.Color.appBorderSubtle)
                HStack(spacing: Spacing.s2) {
                    if let subtotal = contents.subtotal {
                        Text("Subtotal \(subtotal)")
                            .pantopusTextStyle(.caption)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                    if let shipping = contents.shipping {
                        Text("Ship \(shipping)")
                            .pantopusTextStyle(.caption)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                    Spacer()
                    if let total = contents.total {
                        Text(total)
                            .pantopusTextStyle(.caption)
                            .foregroundStyle(Theme.Color.appText)
                    }
                }
                .padding(Spacing.s3)
                .background(Theme.Color.appSurfaceSunken)
            }
        }
        .accessibilityIdentifier("packageBody.contents")
    }
}

/// A17.8 split dock: "Track on carrier" (secondary, opens the browser to
/// the carrier tracking URL) + "Confirm pickup" (primary, fires the
/// receive-at-door flow). The primary flips into a "Picked up" indicator
/// once the recipient confirms in-hand receipt. Mirrors the Android
/// `PackageSplitDock`.
private struct PackageSplitDock: View {
    let content: PackageBodyContent
    let isEnabled: Bool
    let isLoading: Bool
    let isReceived: Bool
    let onConfirmPickup: @MainActor () -> Void

    var body: some View {
        HStack(spacing: Spacing.s2) {
            trackButton
            confirmButton
        }
        .accessibilityIdentifier("packageBody.actions")
    }

    @ViewBuilder
    private var trackButton: some View {
        if let urlString = content.trackingUrl, let url = URL(string: urlString) {
            Link(destination: url) { trackLabel }
                .accessibilityIdentifier("mailDetail_package_trackOnCarrier")
        } else {
            Button(action: {}, label: { trackLabel })
                .buttonStyle(.plain)
                .disabled(true)
                .opacity(0.5)
                .accessibilityIdentifier("mailDetail_package_trackOnCarrier")
        }
    }

    private var trackLabel: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.externalLink, size: 15, color: Theme.Color.appTextStrong)
            Text("Track on \(carrierShort)")
                .pantopusTextStyle(.small)
                .foregroundStyle(Theme.Color.appTextStrong)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, minHeight: 48)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
    }

    @ViewBuilder
    private var confirmButton: some View {
        if isReceived {
            HStack(spacing: Spacing.s2) {
                Icon(.checkCircle, size: 16, color: Theme.Color.success)
                Text("Picked up")
                    .pantopusTextStyle(.body)
                    .foregroundStyle(Theme.Color.success)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity, minHeight: 48)
            .background(Theme.Color.successBg)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(Theme.Color.successLight, lineWidth: 1.5)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .onTapGesture { onConfirmPickup() }
            .accessibilityIdentifier("mailDetail_package_received")
        } else {
            Button {
                onConfirmPickup()
            } label: {
                HStack(spacing: Spacing.s2) {
                    if isLoading {
                        ProgressView().tint(Theme.Color.appTextInverse)
                    } else {
                        Icon(.checkCircle, size: 16, color: Theme.Color.appTextInverse)
                    }
                    Text("Confirm pickup")
                        .pantopusTextStyle(.body)
                        .foregroundStyle(Theme.Color.appTextInverse)
                        .lineLimit(1)
                }
                .frame(maxWidth: .infinity, minHeight: 48)
                .background(Theme.Color.primary600)
                .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                .opacity(isEnabled ? 1 : 0.6)
            }
            .buttonStyle(.plain)
            .disabled(!isEnabled || isLoading)
            .accessibilityIdentifier("mailDetail_package_confirmPickup")
        }
    }

    private var carrierShort: String {
        let upper = content.carrier.uppercased()
        if upper.contains("USPS") { return "USPS" }
        if upper.contains("UPS") { return "UPS" }
        if upper.contains("FEDEX") { return "FedEx" }
        if upper.contains("DHL") { return "DHL" }
        return "carrier"
    }
}

private struct PackageCard<Content: View>: View {
    let noPadding: Bool
    let content: Content

    init(noPadding: Bool = false, @ViewBuilder content: () -> Content) {
        self.noPadding = noPadding
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: noPadding ? 0 : Spacing.s2) {
            content
        }
        .padding(noPadding ? 0 : Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .pantopusShadow(.sm)
    }
}

// MARK: - Generic body

/// Projection for the generic mailbox body — the readable surface for any
/// category without a bespoke ceremonial body (Bill, Notice, Statement,
/// Insurance, Tax, Legal, Healthcare, Membership, Delivery, Social, …). It
/// carries the mail's body text, attachments, and tags so the surface shows
/// the real message rather than a placeholder.
public struct GenericMailBodyContent: Sendable, Hashable {
    public let category: MailItemCategory
    /// Body paragraphs (the mail's `content` / `preview_text`, split on
    /// blank lines). Empty when the wire payload carried no body — the view
    /// then renders the category explainer so the surface is never blank.
    public let paragraphs: [String]
    /// Attachment file names surfaced as a list of file rows.
    public let attachments: [String]
    /// Free-form tags from the mail row.
    public let tags: [String]
    /// When set, a warning pill in the card header ("Action needed" /
    /// "Acknowledge"); derived from `action_required` / `ack_required`.
    public let actionLabel: String?

    public init(
        category: MailItemCategory,
        paragraphs: [String] = [],
        attachments: [String] = [],
        tags: [String] = [],
        actionLabel: String? = nil
    ) {
        self.category = category
        self.paragraphs = paragraphs
        self.attachments = attachments
        self.tags = tags
        self.actionLabel = actionLabel
    }
}

/// Generic mailbox body. Renders the mail's readable content in a themed
/// document card plus optional attachments + tags. Replaces the former
/// `MailItemPlaceholderBody` NotYetAvailable placeholder so every category
/// without a bespoke body still shows real content. Mirrors the A17.1
/// notice-text card used by `GenericMailDetailLayout`.
@MainActor
public struct GenericMailBody: View {
    private let content: GenericMailBodyContent

    public init(content: GenericMailBodyContent) {
        self.content = content
    }

    /// Convenience for the defensive path — renders the category explainer
    /// when the screen has no projected body content.
    public init(category: MailItemCategory) {
        self.init(content: GenericMailBodyContent(category: category))
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            documentCard
            if !content.attachments.isEmpty {
                attachmentsCard
            }
            if !content.tags.isEmpty {
                tagRow
            }
        }
        .padding(.horizontal, Spacing.s4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityIdentifier("genericMailBody")
    }

    /// Real body text when present, otherwise the category explainer so the
    /// card is never empty.
    private var paragraphs: [String] {
        content.paragraphs.isEmpty ? [Self.explainer(for: content.category)] : content.paragraphs
    }

    private var documentCard: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            HStack(spacing: Spacing.s2) {
                Icon(content.category.icon, size: 15, color: content.category.accent)
                    .frame(width: 30, height: 30)
                    .background(content.category.rowBackground)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                Text(content.category.label.uppercased())
                    .font(.system(size: 11, weight: .bold))
                    .tracking(0.5)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .accessibilityAddTraits(.isHeader)
                Spacer(minLength: Spacing.s2)
                if let actionLabel = content.actionLabel {
                    actionPill(actionLabel)
                }
            }
            VStack(alignment: .leading, spacing: Spacing.s2) {
                ForEach(Array(paragraphs.enumerated()), id: \.offset) { _, paragraph in
                    Text(paragraph)
                        .font(.system(size: 13))
                        .foregroundStyle(Theme.Color.appTextStrong)
                        .lineSpacing(3)
                        .fixedSize(horizontal: false, vertical: true)
                        .accessibilityLabel(paragraph)
                }
            }
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
        .accessibilityIdentifier("genericMailBody_document")
    }

    private func actionPill(_ label: String) -> some View {
        HStack(spacing: Spacing.s1) {
            Icon(.alertTriangle, size: 11, color: Theme.Color.warning)
            Text(label)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Theme.Color.warning)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, Spacing.s1)
        .background(Theme.Color.warningBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
        .accessibilityLabel(label)
    }

    private var attachmentsCard: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            Text("ATTACHMENTS")
                .font(.system(size: 11, weight: .bold))
                .tracking(0.5)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, Spacing.s3)
                .padding(.vertical, Spacing.s2)
                .accessibilityAddTraits(.isHeader)
            Divider().background(Theme.Color.appBorderSubtle)
            ForEach(Array(content.attachments.enumerated()), id: \.offset) { index, name in
                HStack(spacing: Spacing.s3) {
                    Icon(Self.attachmentIcon(for: name), size: 14, color: Theme.Color.primary600)
                        .frame(width: 28, height: 28)
                        .background(Theme.Color.primary50)
                        .clipShape(RoundedRectangle(cornerRadius: Radii.sm, style: .continuous))
                    Text(name)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(1)
                    Spacer(minLength: Spacing.s2)
                    Icon(.chevronRight, size: 14, color: Theme.Color.appTextMuted)
                }
                .padding(.horizontal, Spacing.s3)
                .padding(.vertical, Spacing.s2)
                .accessibilityElement(children: .combine)
                .accessibilityLabel("Attachment: \(name)")
                if index < content.attachments.count - 1 {
                    Divider().background(Theme.Color.appBorderSubtle).padding(.leading, Spacing.s10)
                }
            }
        }
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
        .accessibilityIdentifier("genericMailBody_attachments")
    }

    private var tagRow: some View {
        ContentDetailFlowLayout(spacing: 6) {
            ForEach(content.tags, id: \.self) { tag in
                HStack(spacing: Spacing.s1) {
                    Icon(.tag, size: 11, color: Theme.Color.primary700)
                    Text(tag)
                        .font(.system(size: PantopusTextStyle.caption.size, weight: .semibold))
                        .foregroundStyle(Theme.Color.primary700)
                }
                .padding(.horizontal, Spacing.s3)
                .padding(.vertical, Spacing.s1)
                .background(Theme.Color.primary100)
                .clipShape(Capsule())
            }
        }
        .accessibilityIdentifier("genericMailBody_tags")
    }

    /// Category-keyed one-liner shown when the mail row carried no body text,
    /// so the surface always frames what the item is rather than going blank.
    private static let categoryExplainers: [MailItemCategory: String] = [
        .bill: "This looks like a bill. Review the amount due and the due date, then pay or schedule it.",
        .statement: "An account statement. Review the balance and recent activity — usually no action is needed.",
        .notice: "An official notice. Read the details closely; some notices ask you to respond by a deadline.",
        .insurance: "Insurance mail. Check your coverage, claim status, or renewal date.",
        .tax: "Tax mail. Keep this for your records and note any filing or payment deadlines.",
        .subscription: "A subscription update. Review your plan, renewal date, or billing change.",
        .legal: "A legal document. Read it carefully — it may need acknowledgement or a timely response.",
        .healthcare: "Healthcare mail. Review the appointment, billing, or coverage details inside.",
        .membership: "A membership update. Check your status, benefits, or renewal date.",
        .delivery: "A delivery update. Track the latest status and expected arrival.",
        .social: "A neighborhood message. Catch up on what's happening nearby.",
        .party: "A personal invite. Open it for the details and let the host know if you're coming.",
        .records: "An archived record. Filed for safekeeping — open it any time from your Vault.",
        .general: "Mail from your neighborhood. Open it to read the full message."
    ]

    private static func explainer(for category: MailItemCategory) -> String {
        categoryExplainers[category] ?? "Open this item to read the full message."
    }

    private static func attachmentIcon(for name: String) -> PantopusIcon {
        let lower = name.lowercased()
        if lower.hasSuffix(".pdf") { return .fileText }
        let imageExtensions = [".jpg", ".jpeg", ".png", ".heic", ".webp"]
        if imageExtensions.contains(where: lower.hasSuffix) { return .image }
        return .paperclip
    }
}
