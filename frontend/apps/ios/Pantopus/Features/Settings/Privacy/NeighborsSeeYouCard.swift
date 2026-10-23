//
//  NeighborsSeeYouCard.swift
//  Pantopus
//
//  How neighbors see you, drawn in Privacy's header slot like the Home
//  settings identity card: what other people see (photo, name, handle), the
//  name field, and the photo choices. `NeighborsSeeYouViewModel` holds the
//  state. Test tags are mirrored on Android.
//

import PhotosUI
import SwiftUI
import UniformTypeIdentifiers

struct NeighborsSeeYouCard: View {
    @Bindable var viewModel: NeighborsSeeYouViewModel
    @State private var showsPicker = false
    @State private var selection: PhotosPickerItem?

    var body: some View {
        if viewModel.state != .unavailable {
            card
        }
    }

    private var card: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            VStack(alignment: .leading, spacing: Spacing.s1) {
                Text("How neighbors see you")
                    .pantopusTextStyle(.h3)
                    .foregroundStyle(Theme.Color.appText)
                Text("Your name and photo on your posts, comments, chats, tasks and notices. Your account name stays private.")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            switch viewModel.state {
            case .loading, .unavailable:
                loadingRow
            case .failed:
                failedRow
            case let .loaded(view):
                loadedContent(view)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Spacing.s4)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityIdentifier("neighborsSeeYou")
        .photosPicker(isPresented: $showsPicker, selection: $selection, matching: .images)
        .onChange(of: selection) { _, newValue in
            guard let newValue else { return }
            selection = nil
            load(newValue)
        }
    }

    private var loadingRow: some View {
        HStack(spacing: Spacing.s3) {
            Circle().fill(Theme.Color.appSurfaceSunken).frame(width: 56, height: 56)
            RoundedRectangle(cornerRadius: Radii.sm).fill(Theme.Color.appSurfaceSunken).frame(width: 140, height: 14)
        }
        .accessibilityIdentifier("neighborsSeeYouLoading")
    }

    private var failedRow: some View {
        HStack(spacing: Spacing.s2) {
            Text("We couldn't load how neighbors see you.")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
            Spacer(minLength: Spacing.s0)
            Button {
                Task { await viewModel.retry() }
            } label: {
                secondaryLabel("Try again")
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("neighborsSeeYouRetry")
        }
    }

    private func loadedContent(_ view: OwnLocalProfileResponse) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            // What other people see.
            HStack(spacing: Spacing.s3) {
                avatar(view)
                VStack(alignment: .leading, spacing: 2) {
                    Text(view.profile.displayName)
                        .pantopusTextStyle(.body)
                        .fontWeight(.semibold)
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(1)
                        .accessibilityIdentifier("neighborsSeeYouName")
                    if let handle = view.profile.handle, !handle.isEmpty {
                        Text("@\(handle)")
                            .pantopusTextStyle(.caption)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                            .lineLimit(1)
                    }
                }
                Spacer(minLength: Spacing.s0)
            }
            nameEditor(view)
            photoChoices(view)
        }
    }

    private func avatar(_ view: OwnLocalProfileResponse) -> some View {
        let initial = String(view.profile.displayName.trimmingCharacters(in: .whitespaces).prefix(1)).uppercased()
        return ZStack {
            Circle().fill(Theme.Color.personalBg)
            if let url = view.profile.avatarUrl.flatMap(URL.init(string:)) {
                AsyncImage(url: url) { phase in
                    if case let .success(image) = phase {
                        image.resizable().scaledToFill()
                    } else {
                        Text(initial).pantopusTextStyle(.h3).foregroundStyle(Theme.Color.personal)
                    }
                }
            } else {
                Text(initial).pantopusTextStyle(.h3).foregroundStyle(Theme.Color.personal)
            }
        }
        .frame(width: 56, height: 56)
        .clipShape(Circle())
        .opacity(viewModel.busy == .photo ? 0.6 : 1)
        .accessibilityHidden(true)
    }

    private func nameEditor(_ view: OwnLocalProfileResponse) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            PantopusTextField(
                "Name neighbors see",
                text: Binding(get: { viewModel.nameText }, set: { viewModel.editName($0) }),
                state: viewModel.nameError.map { .error($0) } ?? .default,
                contentType: .nickname,
                identifier: "neighborsSeeYouNameField"
            )
            .disabled(viewModel.busy != nil)
            // Weakly: UIKit can keep a field's environment, and .onSubmit with it, after the screen closes.
            .onSubmit { [weak viewModel] in Task { await viewModel?.saveName() } }
            Text(viewModel.nameNote)
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .fixedSize(horizontal: false, vertical: true)
            HStack(spacing: Spacing.s2) {
                Button {
                    Task { await viewModel.saveName() }
                } label: {
                    Text(viewModel.busy == .name ? "Saving…" : "Save")
                        .pantopusTextStyle(.caption)
                        .fontWeight(.semibold)
                        .foregroundStyle(Theme.Color.appTextInverse)
                        .padding(.horizontal, Spacing.s3)
                        .frame(minHeight: 36)
                        .background(Theme.Color.primarySolid)
                        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                        .frame(minHeight: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .disabled(!viewModel.isNameChanged || viewModel.busy != nil)
                .opacity(viewModel.isNameChanged ? 1 : 0.5)
                .accessibilityIdentifier("neighborsSeeYouSave")
                if !view.followsAccount.displayName {
                    Button {
                        Task { await viewModel.useAccountName() }
                    } label: {
                        Text("Use my account name (\(view.account.displayName))")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(Theme.Color.primaryInk)
                            .lineLimit(2)
                            .multilineTextAlignment(.leading)
                            .frame(minHeight: 44)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .disabled(viewModel.busy != nil)
                    .accessibilityIdentifier("neighborsSeeYouUseAccountName")
                }
                Spacer(minLength: Spacing.s0)
            }
        }
    }

    private func photoChoices(_ view: OwnLocalProfileResponse) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text("Photo neighbors see")
                .pantopusTextStyle(.small)
                .fontWeight(.semibold)
                .foregroundStyle(Theme.Color.appTextStrong)
            // Wraps on narrow phones: three buttons don't fit one line at large text sizes.
            ViewThatFits(in: .horizontal) {
                HStack(spacing: Spacing.s2) { photoButtons(view) }
                VStack(alignment: .leading, spacing: Spacing.s2) { photoButtons(view) }
            }
            Text(viewModel.photoNote)
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    @ViewBuilder
    private func photoButtons(_ view: OwnLocalProfileResponse) -> some View {
        Button {
            showsPicker = true
        } label: {
            secondaryLabel(viewModel.busy == .photo ? "Saving…" : (view.profile.avatarUrl == nil ? "Add photo" : "Change photo"))
        }
        .buttonStyle(.plain)
        .disabled(viewModel.busy != nil)
        .accessibilityIdentifier("neighborsSeeYouChangePhoto")
        if view.account.avatarUrl != nil, !view.followsAccount.avatarUrl {
            Button {
                Task { await viewModel.useAccountPhoto() }
            } label: {
                secondaryLabel("Use account photo")
            }
            .buttonStyle(.plain)
            .disabled(viewModel.busy != nil)
            .accessibilityIdentifier("neighborsSeeYouUseAccountPhoto")
        }
        if view.profile.avatarUrl != nil {
            Button {
                Task { await viewModel.removePhoto() }
            } label: {
                secondaryLabel("Remove photo")
            }
            .buttonStyle(.plain)
            .disabled(viewModel.busy != nil)
            .accessibilityIdentifier("neighborsSeeYouRemovePhoto")
        }
    }

    private func secondaryLabel(_ title: String) -> some View {
        Text(title)
            .pantopusTextStyle(.caption)
            .fontWeight(.semibold)
            .foregroundStyle(Theme.Color.appTextStrong)
            .padding(.horizontal, Spacing.s3)
            .frame(minHeight: 36)
            .background(Theme.Color.appSurfaceSunken)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            .frame(minHeight: 44)
            .contentShape(Rectangle())
    }

    /// Reads the picked photo as the Edit profile avatar block does; a failed read is passed on as nil.
    private func load(_ item: PhotosPickerItem) {
        let isPNG = item.supportedContentTypes.contains { $0.conforms(to: .png) }
        let mimeType = isPNG ? "image/png" : "image/jpeg"
        let filename = "profile-\(Int(Date().timeIntervalSince1970)).\(isPNG ? "png" : "jpg")"
        Task {
            let data = try? await item.loadTransferable(type: Data.self)
            await viewModel.uploadPhoto(data, filename: filename, mimeType: mimeType)
        }
    }
}
