//
//  BannerLogoEditor.swift
//  Pantopus
//
//  P4.2 — A13.10 Edit Business Page. Banner + logo composite. Two
//  variants: empty (dashed drop targets with "Add banner" / "Logo"
//  labels) and filled (the real image with optional dirty rim +
//  "New" chip + Change buttons). With `onPick`, each target opens the
//  photo picker.
//

import PhotosUI
import SwiftUI

/// Banner + logo editor block. Banner is 16:7 with the logo well
/// overlapping the bottom-left; total content includes 32pt of
/// breathing room below the logo so the next section starts cleanly.
@MainActor
public struct EditBusinessBannerLogoEditor: View {
    private let banner: EditBusinessPageBannerState
    private let logo: EditBusinessPageLogoState
    private let uploading: BusinessMediaKind?
    /// Receives the picked image and its MIME type. `nil` (previews) leaves
    /// the targets inert.
    private let onPick: (@MainActor (BusinessMediaKind, Data, String) -> Void)?
    @State private var bannerSelection: PhotosPickerItem?
    @State private var logoSelection: PhotosPickerItem?
    @State private var showsBannerPicker = false
    @State private var showsLogoPicker = false

    public init(
        banner: EditBusinessPageBannerState,
        logo: EditBusinessPageLogoState,
        uploading: BusinessMediaKind? = nil,
        onPick: (@MainActor (BusinessMediaKind, Data, String) -> Void)? = nil
    ) {
        self.banner = banner
        self.logo = logo
        self.uploading = uploading
        self.onPick = onPick
    }

    public var body: some View {
        ZStack(alignment: .topLeading) {
            VStack(spacing: Spacing.s0) {
                pickerTarget(.banner, isPresented: $showsBannerPicker, selection: $bannerSelection) { bannerBlock }
                Color.clear.frame(height: 44)
            }

            pickerTarget(.logo, isPresented: $showsLogoPicker, selection: $logoSelection) { logoBlock }
                .padding(.leading, Spacing.s4)
                .offset(y: logoOffset)
        }
        .onChange(of: bannerSelection) { _, item in load(item, as: .banner) }
        .onChange(of: logoSelection) { _, item in load(item, as: .logo) }
        .accessibilityIdentifier("editBusinessPage.bannerLogo")
    }

    /// A plain button that presents the photo picker (the modifier form keeps
    /// the label out of PhotosPicker's nonisolated label closure).
    @ViewBuilder
    private func pickerTarget(
        _ kind: BusinessMediaKind,
        isPresented: Binding<Bool>,
        selection: Binding<PhotosPickerItem?>,
        @ViewBuilder label: () -> some View
    ) -> some View {
        if onPick == nil {
            label()
        } else {
            Button { isPresented.wrappedValue = true } label: {
                label()
                    .overlay {
                        if uploading == kind {
                            ProgressView()
                                .tint(Theme.Color.appTextInverse)
                                .padding(Spacing.s2)
                                .background(Theme.Color.appText.opacity(0.6))
                                .clipShape(Circle())
                        }
                    }
            }
            .buttonStyle(.plain)
            .disabled(uploading != nil)
            .photosPicker(isPresented: isPresented, selection: selection, matching: .images)
            .accessibilityIdentifier("editBusinessPage.pick.\(kind.rawValue)")
        }
    }

    private func load(_ item: PhotosPickerItem?, as kind: BusinessMediaKind) {
        guard let item, let onPick else { return }
        // Clear the selection so picking the same photo again still fires.
        switch kind {
        case .banner: bannerSelection = nil
        case .logo: logoSelection = nil
        }
        Task {
            guard let data = try? await item.loadTransferable(type: Data.self) else { return }
            let mime = item.supportedContentTypes.first?.preferredMIMEType ?? "image/jpeg"
            onPick(kind, data, mime)
        }
    }

    /// Approximate baseline — at typical iPhone width (~328pt after the
    /// section's 16pt insets), the 16:7 banner is ~144pt tall. The 76pt
    /// logo well straddles the bottom edge by ~38pt.
    private var logoOffset: CGFloat {
        106
    }

    private var bannerBlock: some View {
        Group {
            switch banner {
            case .empty:
                emptyBanner
            case let .filled(dirty, _, imageURL):
                filledBanner(dirty: dirty, imageURL: imageURL)
            }
        }
        .aspectRatio(16 / 7, contentMode: .fit)
    }

    private var emptyBanner: some View {
        VStack(spacing: Spacing.s1) {
            Icon(.imagePlus, size: 22, color: Theme.Color.appTextSecondary)
            Text("Add banner")
                .font(.system(size: PantopusTextStyle.caption.size, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextSecondary)
            Text("1600 × 700 · JPG or PNG")
                .font(.system(size: 10))
                .foregroundStyle(Theme.Color.appTextMuted)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.Color.appSurfaceSunken)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .strokeBorder(
                    Theme.Color.appBorderStrong,
                    style: StrokeStyle(lineWidth: 1.5, dash: [5, 4])
                )
        )
    }

    private func filledBanner(dirty: Bool, imageURL: String?) -> some View {
        ZStack(alignment: .topTrailing) {
            // The business's own banner over a neutral surface (shown while it
            // loads or without a URL). An overlay, so the image fills the 16:7
            // frame instead of sizing it (uploads are 16:9).
            Theme.Color.appSurfaceSunken
                .overlay {
                    if let url = imageURL.flatMap(URL.init(string:)) {
                        AsyncImage(url: url) { image in
                            image.resizable().scaledToFill()
                        } placeholder: {
                            Theme.Color.appSurfaceSunken
                        }
                        .accessibilityLabel("Business banner")
                    }
                }
                .clipped()
            // Change-cover affordance — pill chip top-right.
            HStack(spacing: 5) {
                Icon(.image, size: 12, color: Theme.Color.appTextInverse)
                Text("Change banner")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextInverse)
            }
            .padding(.horizontal, Spacing.s2)
            .padding(.vertical, 6)
            .background(Theme.Color.appText.opacity(0.7))
            .clipShape(Capsule())
            .padding(.horizontal, Spacing.s2)
            .padding(.top, Spacing.s2)
            .accessibilityIdentifier("editBusinessPage.changeBanner")

            if dirty {
                HStack(spacing: 0) {
                    Text("New")
                        .font(.system(size: 9.5, weight: .bold))
                        .tracking(0.3)
                        .foregroundStyle(Theme.Color.appTextInverse)
                }
                .padding(.horizontal, Spacing.s2)
                .padding(.vertical, 3)
                .background(Theme.Color.warningSolid)
                .clipShape(Capsule())
                .padding(.horizontal, Spacing.s2)
                .padding(.top, Spacing.s2)
                .frame(maxWidth: .infinity, alignment: .leading)
                .accessibilityLabel("New banner uploaded")
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .strokeBorder(Theme.Color.warning, lineWidth: dirty ? 2 : 0)
        )
        .accessibilityElement(children: .contain)
    }

    @ViewBuilder private var logoBlock: some View {
        switch logo {
        case .empty:
            VStack(spacing: 2) {
                Icon(.plus, size: 18, color: Theme.Color.appTextSecondary)
                Text("Logo")
                    .font(.system(size: 9.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            .frame(width: 76, height: 76)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                    .strokeBorder(
                        Theme.Color.appBorderStrong,
                        style: StrokeStyle(lineWidth: 1.5, dash: [5, 4])
                    )
            )
            .pantopusShadow(.sm)
            .accessibilityIdentifier("editBusinessPage.logoEmpty")
        case let .filled(initial, palette, imageURL):
            VStack(alignment: .leading, spacing: 2) {
                LogoDisc(initial: initial, palette: palette, imageURL: imageURL)
                Text("Change logo")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.Color.business)
                    .padding(.leading, 4)
            }
            .accessibilityIdentifier("editBusinessPage.logoFilled")
        }
    }
}

private struct LogoDisc: View {
    let initial: String
    let palette: EditBusinessPageLogoState.LogoPalette
    let imageURL: String?

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .fill(
                    RadialGradient(
                        colors: gradientColors,
                        center: UnitPoint(x: 0.3, y: 0.3),
                        startRadius: 4,
                        endRadius: 60
                    )
                )
            Text(initial)
                .font(.system(size: 28, weight: .bold, design: .serif))
                .tracking(-1)
                .foregroundStyle(Theme.Color.appTextInverse)
            if let url = imageURL.flatMap(URL.init(string:)) {
                // The real logo; the initial disc shows while it loads.
                AsyncImage(url: url) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    Color.clear
                }
                .frame(width: 76, height: 76)
                .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
            }
        }
        .frame(width: 76, height: 76)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .strokeBorder(Theme.Color.appSurface, lineWidth: 3)
        )
        .pantopusShadow(.md)
        .accessibilityLabel("Logo, \(initial)")
    }

    private var gradientColors: [Color] {
        switch palette {
        case .sunrise:
            // Warm cream → amber → bronze, matches the cafe palette.
            [Theme.Color.warningLight, Theme.Color.warning, Theme.Color.warmAmber]
        }
    }
}

#Preview("Empty") {
    EditBusinessBannerLogoEditor(banner: .empty, logo: .empty)
        .padding()
        .background(Theme.Color.appBg)
}

#Preview("Filled dirty") {
    EditBusinessBannerLogoEditor(
        banner: .filled(dirty: true, palette: .cafeGoldenHour),
        logo: .filled(initial: "R", palette: .sunrise)
    )
    .padding()
    .background(Theme.Color.appBg)
}
