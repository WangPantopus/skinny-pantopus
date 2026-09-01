//
//  ShareLinkSheet.swift
//  Pantopus
//
//  Foundation (I0b) — C3 Share your link. A system share sheet for the owner's
//  booking link: a context overline + pillar dot, a copyable URL with a sky
//  Copy button, share targets, a QR (real, CoreImage), two settings toggles,
//  and a quiet Regenerate. Identity (overline/dot/QR) follows the link's pillar;
//  functional controls stay product sky. A draft banner leads when not live.
//

// swiftlint:disable file_length
import CoreImage.CIFilterBuiltins
import Photos
import SwiftUI
import UIKit

// swiftlint:disable type_body_length

/// Owner booking-link share sheet. Persistence (toggles), system share, and
/// regeneration are wired by the presenting stream via callbacks.
public struct ShareLinkSheet: View {
    private let url: String
    private let theme: SchedulingIdentityTheme
    private let isLive: Bool
    private let showOnProfile: Bool
    private let addToSignature: Bool
    private let onCopy: () -> Void
    private let onShare: () -> Void
    private let onMessages: () -> Void
    private let onEmail: () -> Void
    private let onToggleShowOnProfile: @Sendable (Bool) -> Void
    private let onToggleSignature: @Sendable (Bool) -> Void
    private let onRegenerate: () -> Void
    private let onTurnOnPage: (() -> Void)?

    @State private var copied = false
    @State private var copiedResetTask: Task<Void, Never>?
    @State private var showQR = false
    @State private var confirmRegenerate = false
    /// Print-resolution QR render, produced once per `url` by `.task(id:)` —
    /// body evaluations must never rasterize (CoreImage work on every state
    /// flip froze layout).
    @State private var qrCG: CGImage?
    /// Photos-denied alert (Save to Photos with photo access switched off).
    @State private var showSaveDenied = false
    /// Transient Save-to-Photos outcome toast (success and failure).
    @State private var saveFeedback: SaveFeedback?
    @State private var saveFeedbackTask: Task<Void, Never>?

    private struct SaveFeedback {
        let text: String
        let isError: Bool
    }

    public init(
        url: String,
        theme: SchedulingIdentityTheme,
        isLive: Bool,
        showOnProfile: Bool,
        addToSignature: Bool,
        onCopy: @escaping () -> Void,
        onShare: @escaping () -> Void,
        onMessages: @escaping () -> Void,
        onEmail: @escaping () -> Void,
        onToggleShowOnProfile: @escaping @Sendable (Bool) -> Void,
        onToggleSignature: @escaping @Sendable (Bool) -> Void,
        onRegenerate: @escaping () -> Void,
        onTurnOnPage: (() -> Void)? = nil
    ) {
        self.url = url
        self.theme = theme
        self.isLive = isLive
        self.showOnProfile = showOnProfile
        self.addToSignature = addToSignature
        self.onCopy = onCopy
        self.onShare = onShare
        self.onMessages = onMessages
        self.onEmail = onEmail
        self.onToggleShowOnProfile = onToggleShowOnProfile
        self.onToggleSignature = onToggleSignature
        self.onRegenerate = onRegenerate
        self.onTurnOnPage = onTurnOnPage
    }

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 11) {
                if !isLive { draftBanner }
                VStack(alignment: .leading, spacing: Spacing.s2) {
                    overline
                    urlCard
                    Text("Anyone with this link can book you.")
                        .font(.system(size: 11, weight: .regular))
                        .foregroundStyle(Theme.Color.appTextMuted)
                }
                shareTargets
                qrCard
                toggles
                regenerate
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.vertical, Spacing.s5)
        }
        .background(Theme.Color.appSurface)
        .accessibilityIdentifier("scheduling.shareLinkSheet")
        .overlay(alignment: .bottom) { copiedToast }
        .task(id: url) { qrCG = Self.qrCGImage(url, size: Self.qrRenderSize) }
        .fullScreenCover(isPresented: $showQR) { qrFullScreen }
        .alert("Regenerate this link?", isPresented: $confirmRegenerate) {
            Button("Cancel", role: .cancel) {}
            Button("Regenerate", role: .destructive, action: onRegenerate)
        } message: {
            Text("The old link stops working. Anyone using it will need the new one.")
        }
    }

    /// Floating green "Link copied" pill toast (design Frame 3).
    @ViewBuilder
    private var copiedToast: some View {
        if copied {
            HStack(spacing: Spacing.s2) {
                Icon(.checkCircle2, size: 15, strokeWidth: 2.4, color: Theme.Color.success)
                Text("Link copied")
                    .font(.system(size: 12.5, weight: .bold))
                    .foregroundStyle(Theme.Color.success)
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.vertical, Spacing.s2)
            .background(Theme.Color.successBg)
            .overlay(
                Capsule().stroke(Theme.Color.success.opacity(0.35), lineWidth: 1)
            )
            .clipShape(Capsule())
            .pantopusShadow(PantopusShadow.md)
            .padding(.bottom, Spacing.s5)
            .transition(.opacity)
        }
    }

    // MARK: - Pieces

    private var draftBanner: some View {
        HStack(alignment: .top, spacing: 9) {
            Icon(.triangleAlert, size: 15, strokeWidth: 2.2, color: Theme.Color.warning)
                .padding(.top, 1)
            VStack(alignment: .leading, spacing: 5) {
                Text("This page isn't live yet. People can't book until you turn it on.")
                    .font(.system(size: 11.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                    .fixedSize(horizontal: false, vertical: true)
                if let onTurnOnPage {
                    Button(action: onTurnOnPage) {
                        HStack(spacing: 4) {
                            Text("Turn on")
                                .font(.system(size: 11.5, weight: .bold))
                            Icon(.arrowRight, size: 12, strokeWidth: 2.4, color: Theme.Color.warning)
                        }
                        .foregroundStyle(Theme.Color.warning)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(.horizontal, 11)
        .padding(.vertical, Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.warningBg)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.warning.opacity(0.4), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
    }

    private var overline: some View {
        HStack(spacing: Spacing.s2) {
            Circle().fill(theme.accent).frame(width: 8, height: 8)
            Text("\(theme.title) booking link")
                .pantopusTextStyle(.overline)
                .foregroundStyle(theme.accent)
        }
    }

    private var urlCard: some View {
        HStack(spacing: Spacing.s2) {
            Text(url)
                .font(.system(size: 13, weight: .semibold, design: .monospaced))
                .foregroundStyle(Theme.Color.appText)
                .lineLimit(1)
                .truncationMode(.tail)
                .frame(maxWidth: .infinity, alignment: .leading)
            Button {
                UIPasteboard.general.string = url
                withAnimation(.easeOut(duration: 0.15)) { copied = true }
                // Transient toast (design Frame 3): reset after 1.8s, mirroring
                // SchedulingHubScreen.copyLink(), so repeat copies give feedback.
                copiedResetTask?.cancel()
                copiedResetTask = Task {
                    try? await Task.sleep(for: .seconds(1.8))
                    guard !Task.isCancelled else { return }
                    withAnimation(.easeOut(duration: 0.15)) { copied = false }
                }
                onCopy()
            } label: {
                HStack(spacing: Spacing.s1) {
                    Icon(copied ? .check : .copy, size: 14, strokeWidth: 2.4, color: Theme.Color.appTextInverse)
                    Text(copied ? "Copied" : "Copy")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(Theme.Color.appTextInverse)
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 9)
                .background(copied ? Theme.Color.success : Theme.Color.primary600)
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                .pantopusShadow(PantopusShadow.md)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(copied ? "Link copied" : "Copy link")
        }
        .padding(.leading, Spacing.s3)
        .padding(.trailing, Spacing.s2)
        .padding(.vertical, Spacing.s2)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .pantopusShadow(PantopusShadow.sm)
    }

    private var shareTargets: some View {
        HStack(spacing: Spacing.s2) {
            shareTile(icon: .share, label: "Share", action: onShare)
            shareTile(icon: .qrCode, label: "QR code") { showQR = true }
            shareTile(icon: .messageCircle, label: "Messages", action: onMessages)
            shareTile(icon: .mail, label: "Email", action: onEmail)
        }
    }

    private func shareTile(icon: PantopusIcon, label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: Spacing.s2) {
                ZStack {
                    RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                        .fill(Theme.Color.appSurface)
                        .overlay(
                            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                                .stroke(Theme.Color.appBorder, lineWidth: 1)
                        )
                        .frame(width: 52, height: 52)
                        .pantopusShadow(PantopusShadow.sm)
                    Icon(icon, size: 21, strokeWidth: 2, color: Theme.Color.primary600)
                }
                Text(label)
                    .font(.system(size: 10.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextStrong)
            }
        }
        .buttonStyle(.plain)
        .frame(maxWidth: .infinity)
        .accessibilityLabel(label)
    }

    private var qrCard: some View {
        HStack(spacing: 11) {
            qrImage
                .frame(width: 32, height: 32)
                .padding(4)
                .background(Color.white)
                .overlay(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .stroke(Theme.Color.appBorder, lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            VStack(alignment: .leading, spacing: 1) {
                Text("Scan to book")
                    .font(.system(size: 12.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                Text("Print it or show it at a desk.")
                    .font(.system(size: 10.5, weight: .regular))
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
            Spacer(minLength: Spacing.s2)
            Button { showQR = true } label: {
                Text("Show QR")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Theme.Color.primary700)
                    .padding(.horizontal, Spacing.s3)
                    .padding(.vertical, 7)
                    .background(Theme.Color.primary50)
                    .overlay(
                        RoundedRectangle(cornerRadius: 9, style: .continuous)
                            .stroke(Theme.Color.primary100, lineWidth: 1)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Show QR code")
        }
        .padding(.horizontal, 11)
        .padding(.vertical, 9)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .pantopusShadow(PantopusShadow.sm)
    }

    private var toggles: some View {
        VStack(spacing: 0) {
            toggleRow(
                icon: .userRound,
                label: "Show on my profile",
                sub: "Neighbors see a Book button on your page.",
                isOn: showOnProfile,
                onChange: onToggleShowOnProfile
            )
            Divider().overlay(Theme.Color.appBorder)
            toggleRow(
                icon: .mail,
                label: "Add to email signature",
                sub: "Appends the link to outgoing mail.",
                isOn: addToSignature,
                onChange: onToggleSignature
            )
        }
        .padding(.horizontal, Spacing.s3)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .pantopusShadow(PantopusShadow.sm)
    }

    private func toggleRow(
        icon: PantopusIcon,
        label: String,
        sub: String,
        isOn: Bool,
        onChange: @escaping @Sendable (Bool) -> Void
    ) -> some View {
        Toggle(isOn: Binding(get: { isOn }, set: onChange)) {
            HStack(spacing: 11) {
                ZStack {
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .fill(isOn ? Theme.Color.primary50 : Theme.Color.appSurfaceSunken)
                        .frame(width: 30, height: 30)
                    Icon(icon, size: 15, strokeWidth: 2, color: isOn ? Theme.Color.primary600 : Theme.Color.appTextSecondary)
                }
                VStack(alignment: .leading, spacing: 1) {
                    Text(label)
                        .font(.system(size: 12.5, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                    Text(sub)
                        .font(.system(size: 10.5, weight: .regular))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
        .tint(Theme.Color.primary600)
        .padding(.vertical, 9)
    }

    private var regenerate: some View {
        Button { confirmRegenerate = true } label: {
            HStack(spacing: Spacing.s1) {
                Icon(.rotateCcw, size: 14, strokeWidth: 2.2, color: Theme.Color.error)
                Text("Regenerate link")
                    .font(.system(size: 12.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.error)
            }
        }
        .buttonStyle(.plain)
        .frame(maxWidth: .infinity)
        .padding(.top, Spacing.s1)
    }

    // MARK: - QR fullscreen

    private var qrFullScreen: some View {
        VStack(spacing: 0) {
            HStack {
                Spacer()
                Button("Done") { showQR = false }
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(Theme.Color.primary600)
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, Spacing.s2)

            Spacer()

            VStack(spacing: 0) {
                overline
                Spacer().frame(height: 18)
                qrImage
                    .frame(width: 184, height: 184)
                    .padding(18)
                    .background(Color.white)
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.xl3, style: .continuous)
                            .stroke(Theme.Color.appBorder, lineWidth: 1)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: Radii.xl3, style: .continuous))
                    .pantopusShadow(PantopusShadow.xl)
                Text(url)
                    .font(.system(size: 12.5, weight: .semibold, design: .monospaced))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.top, 22)
                Text("Point a camera here to open the booking page.")
                    .font(.system(size: 11.5, weight: .regular))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 200)
                    .padding(.top, 14)
            }
            .padding(.horizontal, Spacing.s6)

            Spacer()

            Button(action: saveQRToPhotos) {
                HStack(spacing: 7) {
                    Icon(.download, size: 15, color: Theme.Color.appTextStrong)
                    Text("Save to Photos")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(Theme.Color.appTextStrong)
                }
                .padding(.horizontal, Spacing.s4)
                .padding(.vertical, 10)
                .background(Theme.Color.appSurface)
                .overlay(
                    RoundedRectangle(cornerRadius: 11, style: .continuous)
                        .stroke(Theme.Color.appBorder, lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: 11, style: .continuous))
                .pantopusShadow(PantopusShadow.sm)
            }
            .buttonStyle(.plain)
            .padding(.bottom, Spacing.s6)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottom) { saveFeedbackToast }
        .alert("Allow access to save", isPresented: $showSaveDenied) {
            Button("Open Settings") {
                if let settings = URL(string: UIApplication.openSettingsURLString) {
                    UIApplication.shared.open(settings)
                }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Photos access is off for Pantopus. Turn on \"Add Photos Only\" in Settings to save the QR code.")
        }
    }

    /// Transient Save-to-Photos outcome pill (success and failure), floating
    /// above the fullscreen QR's home indicator like the copied toast.
    @ViewBuilder
    private var saveFeedbackToast: some View {
        if let saveFeedback {
            let tint = saveFeedback.isError ? Theme.Color.warning : Theme.Color.success
            HStack(spacing: Spacing.s2) {
                Icon(
                    saveFeedback.isError ? .triangleAlert : .checkCircle2,
                    size: 15,
                    strokeWidth: 2.4,
                    color: tint
                )
                Text(saveFeedback.text)
                    .font(.system(size: 12.5, weight: .bold))
                    .foregroundStyle(tint)
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.vertical, Spacing.s2)
            .background(saveFeedback.isError ? Theme.Color.warningBg : Theme.Color.successBg)
            .overlay(
                Capsule().stroke(tint.opacity(0.35), lineWidth: 1)
            )
            .clipShape(Capsule())
            .pantopusShadow(PantopusShadow.md)
            .padding(.bottom, Spacing.s5)
            .transition(.opacity)
        }
    }

    /// Renders the booking-link QR at print resolution and writes it to the
    /// user's photo library, requesting add-only authorization first. Denied /
    /// restricted access routes to a Settings alert; both save outcomes flash a
    /// toast (the previous nil-completion `UIImageWriteToSavedPhotosAlbum` was
    /// silently unobservable either way).
    private func saveQRToPhotos() {
        guard let cg = qrCG ?? Self.qrCGImage(url, size: Self.qrRenderSize) else {
            flashSaveFeedback("Couldn't render the QR code", isError: true)
            return
        }
        let image = UIImage(cgImage: cg)
        Task { @MainActor in
            let status = await PHPhotoLibrary.requestAuthorization(for: .addOnly)
            switch status {
            case .authorized, .limited:
                do {
                    try await PHPhotoLibrary.shared().performChanges {
                        PHAssetChangeRequest.creationRequestForAsset(from: image)
                    }
                    flashSaveFeedback("Saved to Photos", isError: false)
                } catch {
                    flashSaveFeedback("Couldn't save — try again", isError: true)
                }
            case .denied, .restricted:
                showSaveDenied = true
            case .notDetermined:
                break
            @unknown default:
                break
            }
        }
    }

    private func flashSaveFeedback(_ text: String, isError: Bool) {
        withAnimation(.easeOut(duration: 0.15)) { saveFeedback = SaveFeedback(text: text, isError: isError) }
        saveFeedbackTask?.cancel()
        saveFeedbackTask = Task {
            try? await Task.sleep(for: .seconds(1.8))
            guard !Task.isCancelled else { return }
            withAnimation(.easeOut(duration: 0.15)) { saveFeedback = nil }
        }
    }

    /// The cached QR render (`.task(id: url)`), downscaled per surface with no
    /// interpolation; the sunken placeholder covers the pre-render frame.
    @ViewBuilder
    private var qrImage: some View {
        if let cg = qrCG {
            Image(decorative: cg, scale: 1)
                .interpolation(.none)
                .resizable()
                .scaledToFit()
        } else {
            RoundedRectangle(cornerRadius: Radii.sm, style: .continuous)
                .fill(Theme.Color.appSurfaceSunken)
        }
    }

    /// One shared Metal-backed context — CIContext is documented-expensive and
    /// Apple guidance is create-once/reuse; it is immutable + thread-safe, so
    /// sharing is safe under strict concurrency.
    private nonisolated(unsafe) static let qrContext = CIContext()
    /// Print-resolution edge, reused by both on-screen sizes and Save to Photos.
    private static let qrRenderSize: CGFloat = 1024

    private static func qrCGImage(_ string: String, size: CGFloat) -> CGImage? {
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(string.utf8)
        filter.correctionLevel = "M"
        guard let ciImage = filter.outputImage, ciImage.extent.width > 0 else { return nil }
        let scale = max(size / ciImage.extent.width, 1)
        let scaled = ciImage.transformed(by: CGAffineTransform(scaleX: scale, y: scale))
        return qrContext.createCGImage(scaled, from: scaled.extent)
    }
}

#if DEBUG
#Preview {
    ShareLinkSheet(
        url: "pantopus.com/book/alexkim",
        theme: SchedulingIdentityTheme(.personal),
        isLive: false,
        showOnProfile: true,
        addToSignature: false,
        onCopy: {},
        onShare: {},
        onMessages: {},
        onEmail: {},
        onToggleShowOnProfile: { _ in },
        onToggleSignature: { _ in },
        onRegenerate: {},
        onTurnOnPage: {}
    )
}
#endif
