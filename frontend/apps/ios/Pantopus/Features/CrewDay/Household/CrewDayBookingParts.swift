//
//  CrewDayBookingParts.swift
//  Pantopus
//
//  The pieces of 5. Your Crew Day (boards `CrewDay`, `CdDoneLarge`): the
//  four-step status line (a list at the accessibility text sizes), the
//  tinted state card, the photo grid, the booking card's rows and the
//  action rows. Tokens only.
//

import SwiftUI

/// Booked · On the way · Done · Paid, with the word a booking is stuck on.
struct CrewDayStatusLine: View {
    let steps: [CrewDayBookingStep]
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        Group {
            if typeSize.isAccessibilitySize {
                VStack(alignment: .leading, spacing: 10) {
                    ForEach(steps) { step in
                        HStack(spacing: 10) {
                            dot(step)
                            label(step)
                        }
                    }
                }
            } else {
                HStack(alignment: .top, spacing: 0) {
                    ForEach(Array(steps.enumerated()), id: \.element.id) { index, step in
                        VStack(spacing: 6) {
                            HStack(spacing: 0) {
                                segment(index == 0 ? nil : step)
                                dot(step)
                                segment(index + 1 < steps.count ? steps[index + 1] : nil)
                            }
                            label(step).multilineTextAlignment(.center)
                        }
                        .frame(maxWidth: .infinity)
                    }
                }
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Where your booking is: " + steps.map { $0.label + $0.spoken }.joined(separator: "; "))
        .accessibilityIdentifier("crewDayBookingSteps")
    }

    /// The line into a step: colored once that step is reached.
    private func segment(_ step: CrewDayBookingStep?) -> some View {
        Rectangle()
            .fill(step == nil ? Color.clear : step?.state == "todo" ? Theme.Color.appBorderStrong : Theme.Color.primarySolid)
            .frame(height: 2)
            .frame(maxWidth: .infinity)
    }

    private func dot(_ step: CrewDayBookingStep) -> some View {
        let ring: Color = switch step.tone {
        case .warning: Theme.Color.warning
        case .error: Theme.Color.error
        case .normal: step.state == "todo" ? Theme.Color.appBorderStrong : Theme.Color.primarySolid
        }
        return ZStack {
            Circle().fill(step.state == "done" && step.tone == .normal ? Theme.Color.primarySolid : Theme.Color.appSurface)
            Circle().stroke(ring, lineWidth: step.state == "todo" ? 1 : 2)
            if step.state == "done", step.tone == .normal {
                Icon(.check, size: 12, strokeWidth: 3, color: Theme.Color.appTextInverse)
            } else if step.state == "current" {
                Circle().fill(ring).frame(width: 8, height: 8)
            }
        }
        .frame(width: 20, height: 20)
    }

    private func label(_ step: CrewDayBookingStep) -> some View {
        let ink: Color = switch step.tone {
        case .warning: Theme.Color.warningDeep
        case .error: Theme.Color.error
        case .normal: step.state == "todo" ? Theme.Color.appTextSecondary : Theme.Color.appText
        }
        return Text(step.label)
            .planFont(step.state == "todo" && step.tone == .normal ? .footnote : .label)
            .foregroundStyle(ink)
            .fixedSize(horizontal: false, vertical: true)
    }
}

/// The state card: a tinted card with an icon tile, a title and what fits the state.
struct CrewDayStateCard<Content: View>: View {
    enum Tone { case success, warning, info, error, neutral }

    let tone: Tone
    let icon: PantopusIcon
    let title: String
    @ViewBuilder var content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            HStack(alignment: .top, spacing: Spacing.s3) {
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(tile)
                    .frame(width: 40, height: 40)
                    .overlay(Icon(icon, size: 20, color: glyph))
                    .accessibilityHidden(true)
                Text(title)
                    .planFont(.h4)
                    .foregroundStyle(Theme.Color.appText)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, Spacing.s2)
                    .accessibilityAddTraits(.isHeader)
                    .accessibilityIdentifier("crewDayBookingStateTitle")
            }
            content()
        }
        .padding(Spacing.s4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: Radii.xl2, style: .continuous).fill(fill))
        .overlay(RoundedRectangle(cornerRadius: Radii.xl2, style: .continuous).stroke(line, lineWidth: 1))
        .accessibilityElement(children: .contain)
    }

    private var fill: Color {
        switch tone {
        case .success: Theme.Color.successBg
        case .warning: Theme.Color.warningBg
        case .info: Theme.Color.infoBg
        case .error: Theme.Color.errorBg
        case .neutral: Theme.Color.appSurface
        }
    }

    private var line: Color {
        switch tone {
        case .success: Theme.Color.successLight
        case .warning: Theme.Color.warningLight
        case .info: Theme.Color.infoLight
        case .error: Theme.Color.errorLight
        case .neutral: Theme.Color.appBorder
        }
    }

    private var tile: Color {
        switch tone {
        case .success: Theme.Color.successSolid
        case .warning: Theme.Color.warningLight
        case .info: Theme.Color.infoSolid
        case .error: Theme.Color.errorSolid
        case .neutral: Theme.Color.appSurfaceSunken
        }
    }

    private var glyph: Color {
        switch tone {
        case .success, .info, .error: Theme.Color.appTextInverse
        case .warning: Theme.Color.warningDeep
        case .neutral: Theme.Color.appTextStrong
        }
    }
}

/// A sentence in a state card.
struct CrewDayStateText: View {
    let text: String
    var identifier: String?

    var body: some View {
        Text(text)
            .planFont(.body)
            .foregroundStyle(Theme.Color.appTextStrong)
            .fixedSize(horizontal: false, vertical: true)
            .accessibilityIdentifier(identifier ?? "")
    }
}

/// "From Example Gutter Co." over a quoted note, on a sunken panel.
struct CrewDayQuote: View {
    let label: String
    let text: String
    var identifier = "crewDayBookingQuote"

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            Text(label).planFont(.footnote).foregroundStyle(Theme.Color.appTextSecondary)
            Text(text)
                .planFont(.body)
                .foregroundStyle(Theme.Color.appText)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).fill(Theme.Color.appSurfaceSunken))
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier(identifier)
    }
}

/// A check line in a state card ("We told the crew the gate is ready.").
struct CrewDayDoneLine: View {
    let text: String
    var identifier = "crewDayBookingDoneLine"

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: Spacing.s2) {
            Icon(.check, size: 16, strokeWidth: 2.5, color: Theme.Color.success)
            Text(text)
                .planFont(.body)
                .foregroundStyle(Theme.Color.success)
                .fixedSize(horizontal: false, vertical: true)
        }
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier(identifier)
    }
}

/// Up to 8 photos in a grid of three; a tap opens them full screen.
struct CrewDayPhotoGrid: View {
    let photos: [CrewDayPhoto]
    /// "of the finished work", "you sent".
    var what = "of the finished work"
    let onOpen: (Int) -> Void
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        LazyVGrid(
            columns: Array(repeating: GridItem(.flexible(), spacing: Spacing.s2), count: typeSize.isAccessibilitySize ? 2 : 3),
            spacing: Spacing.s2
        ) {
            ForEach(Array(photos.enumerated()), id: \.element.id) { index, photo in
                Button { onOpen(index) } label: {
                    Color.clear
                        .aspectRatio(1, contentMode: .fit)
                        .overlay {
                            CachedAsyncImage(url: URL(string: photo.url), keepsOnDisk: false, maxPixelSize: 480) { phase in
                                if let image = phase.image {
                                    image.resizable().scaledToFill()
                                } else {
                                    Theme.Color.appSurfaceSunken.overlay(Icon(.image, size: 20, color: Theme.Color.appTextSecondary))
                                }
                            }
                        }
                        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Photo \(index + 1) of \(photos.count) \(what)")
                .accessibilityIdentifier("crewDayBookingPhoto_\(index)")
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("crewDayBookingPhotos")
    }

    /// The photos as the shared viewer's items.
    static func items(_ photos: [CrewDayPhoto]) -> [PostMediaItem] {
        photos.compactMap { photo in
            URL(string: photo.url).map { PostMediaItem(id: photo.path, kind: .image, url: $0) }
        }
    }
}

/// One row of the booking card: an icon, a line, a second line.
struct CrewDayInfoRow<Extra: View>: View {
    let icon: PantopusIcon
    let title: String
    var detail: String?
    var identifier: String?
    @ViewBuilder var extra: () -> Extra

    init(
        icon: PantopusIcon,
        title: String,
        detail: String? = nil,
        identifier: String? = nil,
        @ViewBuilder extra: @escaping () -> Extra = { EmptyView() }
    ) {
        self.icon = icon
        self.title = title
        self.detail = detail
        self.identifier = identifier
        self.extra = extra
    }

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.s3) {
            Icon(icon, size: 20, color: Theme.Color.appTextStrong).padding(.top, 1)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .planFont(.body)
                    .foregroundStyle(Theme.Color.appText)
                    .fixedSize(horizontal: false, vertical: true)
                if let detail, !detail.isEmpty {
                    Text(detail)
                        .planFont(.small)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                extra()
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.vertical, Spacing.s1)
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier(identifier ?? "")
    }
}

/// An action row under the page ("Message the crew", "Change or cancel").
struct CrewDayActionRow: View {
    let icon: PantopusIcon
    let title: String
    let identifier: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Spacing.s3) {
                Icon(icon, size: 20, color: Theme.Color.appTextStrong)
                Text(title)
                    .planFont(.body)
                    .foregroundStyle(Theme.Color.appText)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .fixedSize(horizontal: false, vertical: true)
                Icon(.chevronRight, size: 16, color: Theme.Color.appTextSecondary)
            }
            .padding(.horizontal, Spacing.s4)
            .frame(minHeight: 56)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(identifier)
    }
}
