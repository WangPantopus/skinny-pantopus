//
//  StorageDataView.swift
//  Pantopus
//
//  Settings → This iPhone → Storage & data. Wording is the Instant Screens
//  contract's (section 7), the same on every platform.
//

import SwiftUI

struct StorageDataView: View {
    @State private var viewModel = StorageDataViewModel()
    private let onBack: @MainActor () -> Void

    init(onBack: @escaping @MainActor () -> Void) {
        self.onBack = onBack
    }

    var body: some View {
        ContentDetailShell(
            title: "Storage & data",
            onBack: onBack,
            header: { header },
            body: { content }
        )
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("storageData")
        .task { await viewModel.load() }
        .alert(
            "Clear \(clearableText)?",
            isPresented: $viewModel.confirmsClear
        ) {
            Button("Clear cache", role: .destructive) { Task { await viewModel.clearCache() } }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Your homes, messages, posts and unsent drafts stay. Photos and pages download again when you open them.")
        }
        .overlay(alignment: .bottom) {
            if let message = viewModel.toastMessage {
                ToastView(message: ToastMessage(text: message, kind: .success))
                    .padding(.bottom, Spacing.s10)
                    .task(id: message) {
                        try? await Task.sleep(nanoseconds: 2_500_000_000)
                        viewModel.toastMessage = nil
                    }
            }
        }
    }

    private var clearableText: String {
        StorageDataViewModel.format(viewModel.sizes?.clearable ?? 0)
    }

    // MARK: - Header: total + meter

    private var header: some View {
        VStack(spacing: Spacing.s2) {
            Text(viewModel.sizes.map { StorageDataViewModel.format($0.total) } ?? "—")
                .pantopusTextStyle(.h1)
                .foregroundStyle(Theme.Color.appText)
                .accessibilityIdentifier("storageDataTotal")
            Text("Pantopus on this iPhone")
                .pantopusTextStyle(.small)
                .foregroundStyle(Theme.Color.appTextSecondary)
            StorageMeter(sizes: viewModel.sizes, limitBytes: viewModel.limitMegabytes * 1024 * 1024)
                .padding(.top, Spacing.s2)
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, Spacing.s5)
        .accessibilityElement(children: .combine)
    }

    // MARK: - Body

    private var content: some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            VStack(spacing: Spacing.s0) {
                sizeRow(
                    "Photos and images",
                    subtext: "From posts, messages and homes you opened",
                    bytes: viewModel.sizes?.photos,
                    swatch: StorageMeter.photosColor
                )
                Divider().padding(.leading, Spacing.s4)
                sizeRow(
                    "Saved pages",
                    subtext: "So your tabs open instantly and offline",
                    bytes: viewModel.sizes?.savedPages,
                    swatch: StorageMeter.pagesColor
                )
                Divider().padding(.leading, Spacing.s4)
                sizeRow(
                    "Drafts and uploads in progress",
                    subtext: "Kept until you send or finish them",
                    bytes: viewModel.sizes?.drafts,
                    swatch: StorageMeter.draftsColor
                )
            }
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))

            PantopusButton(
                title: "Clear cache (\(clearableText))",
                kind: .ghost,
                isLoading: viewModel.isClearing,
                isEnabled: (viewModel.sizes?.clearable ?? 0) > 0
            ) { viewModel.confirmsClear = true }
                .accessibilityIdentifier("storageDataClearCache")
            footnote(
                "Nothing in your account is deleted. Your homes, messages, posts and unsent drafts stay. " +
                    "Pages load from the internet the next time you open them."
            )

            Text("Automatic cleanup", style: .overline)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .padding(.top, Spacing.s2)
            limitRow
            footnote("At the limit, the oldest photos go first. Anything you haven't opened in 30 days goes too.")
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, Spacing.s4)
    }

    private func sizeRow(_ label: String, subtext: String, bytes: Int?, swatch: Color) -> some View {
        HStack(spacing: Spacing.s3) {
            Circle()
                .fill(swatch)
                .frame(width: 10, height: 10)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: Spacing.s1) {
                Text(label)
                    .pantopusTextStyle(.body)
                    .foregroundStyle(Theme.Color.appText)
                Text(subtext)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            Spacer(minLength: Spacing.s2)
            Text(bytes.map(StorageDataViewModel.format) ?? "—")
                .pantopusTextStyle(.small)
                .foregroundStyle(Theme.Color.appTextStrong)
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, Spacing.s3)
        .frame(minHeight: 44)
        .accessibilityElement(children: .combine)
    }

    private var limitRow: some View {
        Menu {
            Picker("Keep up to", selection: Binding(
                get: { viewModel.limitMegabytes },
                set: { megabytes in Task { await viewModel.setLimit(megabytes) } }
            )) {
                ForEach(StorageLimit.choices, id: \.self) { megabytes in
                    Text("\(megabytes) MB").tag(megabytes)
                }
            }
        } label: {
            HStack {
                Text("Keep up to")
                    .pantopusTextStyle(.body)
                    .foregroundStyle(Theme.Color.appText)
                Spacer()
                Text("\(viewModel.limitMegabytes) MB")
                    .pantopusTextStyle(.body)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
            }
            .padding(.horizontal, Spacing.s4)
            .frame(minHeight: 48)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        }
        .accessibilityIdentifier("storageDataLimit")
    }

    private func footnote(_ text: String) -> some View {
        Text(text)
            .pantopusTextStyle(.caption)
            .foregroundStyle(Theme.Color.appTextSecondary)
            .fixedSize(horizontal: false, vertical: true)
    }
}

/// Photos, saved pages and drafts as three segments, against the limit.
private struct StorageMeter: View {
    static let photosColor = Theme.Color.primary600
    static let pagesColor = Theme.Color.home
    static let draftsColor = Theme.Color.business

    let sizes: StorageDataViewModel.Sizes?
    let limitBytes: Int

    var body: some View {
        GeometryReader { geometry in
            let scale = geometry.size.width / CGFloat(max(limitBytes, sizes?.total ?? 0, 1))
            HStack(spacing: 2) {
                segment(sizes?.photos ?? 0, scale: scale, color: Self.photosColor)
                segment(sizes?.savedPages ?? 0, scale: scale, color: Self.pagesColor)
                segment(sizes?.drafts ?? 0, scale: scale, color: Self.draftsColor)
                Spacer(minLength: Spacing.s0)
            }
        }
        .frame(height: 10)
        .background(Theme.Color.appSurfaceSunken)
        .clipShape(Capsule())
        .accessibilityHidden(true)
    }

    @ViewBuilder
    private func segment(_ bytes: Int, scale: CGFloat, color: Color) -> some View {
        if bytes > 0 {
            Rectangle().fill(color).frame(width: max(2, CGFloat(bytes) * scale))
        }
    }
}

#Preview {
    StorageDataView {}
}
