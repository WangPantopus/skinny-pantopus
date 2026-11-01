//
//  EditProfileView+Sections.swift
//  Pantopus
//
//  The editor's two parts (the 11-01 redesign, `Edit.dc.html`): the live
//  preview card, "Neighbors see this" (the photo and name neighbors see,
//  moved here from Privacy's card, then username, tagline and about you) and
//  "Only you see this" (account photo, where you live, who sees your city).
//

import PhotosUI
import SwiftUI

extension EditProfileView {
    // MARK: - Preview

    /// "How neighbors see you · updates as you type": the header neighbors get,
    /// drawn from the form as it stands.
    var previewSection: some View {
        let neighbors = viewModel.neighbors
        let typedName = neighbors.trimmedName
        let name = typedName.isEmpty ? (neighbors.loaded?.profile.displayName ?? "") : typedName
        let username = viewModel.fields[.username]?.value.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let tagline = viewModel.fields[.tagline]?.value.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let bio = viewModel.fields[.bio]?.value.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return VStack(alignment: .leading, spacing: Spacing.s2) {
            Text("How neighbors see you · updates as you type")
                .scaledFont(13, weight: .semibold)
                .foregroundStyle(Theme.Color.appTextMuted)
            VStack(alignment: .leading, spacing: Spacing.s0) {
                HStack(spacing: Spacing.s3) {
                    ProfileAvatarDisc(
                        name: name,
                        showsInitials: !name.isEmpty,
                        imageURL: neighbors.loaded?.profile.avatarUrl.flatMap(URL.init(string:)),
                        color: ProfileAvatarColor(userId: viewModel.accountId ?? ""),
                        size: 56
                    )
                    VStack(alignment: .leading, spacing: 0) {
                        Text(name.isEmpty ? "Your name" : name)
                            .scaledFont(20, weight: .bold)
                            .foregroundStyle(Theme.Color.appText)
                        if !username.isEmpty {
                            Text(verbatim: "@\(UsernameAvailabilityChecker.normalize(username))")
                                .scaledFont(14)
                                .foregroundStyle(Theme.Color.appTextMuted)
                        }
                    }
                    .fixedSize(horizontal: false, vertical: true)
                }
                if !viewModel.previewFacts.isEmpty {
                    Text(viewModel.previewFacts.spoken.replacingOccurrences(of: ", ", with: " · "))
                        .scaledFont(14)
                        .foregroundStyle(Theme.Color.appTextMuted)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.top, 10)
                }
                if !tagline.isEmpty {
                    Text(tagline)
                        .scaledFont(15, weight: .semibold)
                        .foregroundStyle(Theme.Color.appText)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.top, Spacing.s2)
                }
                if !bio.isEmpty {
                    Text(bio)
                        .scaledFont(14)
                        .foregroundStyle(Theme.Color.appTextStrong)
                        .lineLimit(3)
                        .padding(.top, Spacing.s1)
                }
            }
            .padding(Spacing.s4)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .accessibilityElement(children: .combine)
            .accessibilityLabel("Preview: how neighbors see you")
            .accessibilityIdentifier("editProfilePreview")
        }
        .padding(.horizontal, Spacing.s4)
    }

    // MARK: - Section headers

    var neighborsHeader: some View {
        sectionHeader(
            icon: .shieldCheck,
            tint: Theme.Color.home,
            background: Theme.Color.homeBg,
            title: "Neighbors see this",
            subtitle: "Shown on your profile and next to your posts, comments and messages."
        )
        .accessibilityIdentifier("editProfileNeighborsHeader")
    }

    var onlyYouHeader: some View {
        sectionHeader(
            icon: .lock,
            tint: Theme.Color.appTextStrong,
            background: Theme.Color.appBorder,
            title: "Only you see this",
            subtitle: "Never shown on your profile."
        )
        .padding(.top, Spacing.s4)
        .accessibilityIdentifier("editProfileOnlyYouHeader")
    }

    private func sectionHeader(
        icon: PantopusIcon,
        tint: Color,
        background: Color,
        title: String,
        subtitle: String
    ) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Icon(icon, size: 16, color: tint)
                .frame(width: 32, height: 32)
                .background(background)
                .clipShape(Circle())
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .scaledFont(20, weight: .bold)
                    .foregroundStyle(Theme.Color.appText)
                    .accessibilityAddTraits(.isHeader)
                Text(subtitle)
                    .scaledFont(14)
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
            .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s3)
    }

    // MARK: - Neighbors see this

    /// The photo and name neighbors see, then username, tagline and about you.
    var neighborsSection: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            neighborPhotoRow
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
            neighborNameField
            usernameField
            taglineField
            Text("One line about you. It shows in bold under your name.")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .padding(.top, -Spacing.s2)
            bioField
        }
        .padding(Spacing.s4)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .padding(.horizontal, Spacing.s4)
    }

    /// The photo neighbors see: Add or Change, use your account photo, or
    /// remove it (initials). Each saves at once.
    private var neighborPhotoRow: some View {
        let neighbors = viewModel.neighbors
        let profile = neighbors.loaded?.profile
        let hasPhoto = profile?.avatarUrl != nil
        return HStack(spacing: Spacing.s3) {
            ProfileAvatarDisc(
                name: profile?.displayName ?? "",
                showsInitials: true,
                imageURL: profile?.avatarUrl.flatMap(URL.init(string:)),
                color: ProfileAvatarColor(userId: viewModel.accountId ?? ""),
                size: 56
            )
            .opacity(neighbors.busy == .photo ? 0.6 : 1)
            VStack(alignment: .leading, spacing: 1) {
                Text("Profile photo")
                    .scaledFont(15, weight: .semibold)
                    .foregroundStyle(Theme.Color.appText)
                Text(hasPhoto ? neighbors.photoNote : "Neighbors see your initials until you add one.")
                    .scaledFont(13)
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
            Menu {
                Button(hasPhoto ? "Choose another photo" : "Choose a photo") { showsNeighborPhotoPicker = true }
                if let loaded = neighbors.loaded, loaded.account.avatarUrl != nil, !loaded.followsAccount.avatarUrl {
                    Button("Use my account photo") { Task { await neighbors.useAccountPhoto() } }
                }
                if hasPhoto {
                    Button("Remove photo", role: .destructive) { Task { await neighbors.removePhoto() } }
                }
            } label: {
                Text(neighbors.busy == .photo ? "Saving…" : (hasPhoto ? "Change" : "Add"))
                    .scaledFont(15, weight: .semibold)
                    .foregroundStyle(Theme.Color.primaryInk)
                    .padding(.horizontal, Spacing.s4)
                    .frame(minHeight: 44)
                    .background(Theme.Color.primary100)
                    .clipShape(Capsule())
            }
            .disabled(neighbors.busy != nil || neighbors.loaded == nil)
            .accessibilityLabel(hasPhoto ? "Change the photo neighbors see" : "Add the photo neighbors see")
            .accessibilityIdentifier("editProfileNeighborPhoto")
        }
    }

    /// "Name neighbors see": saved with the form (`PATCH /api/local-profiles/me`).
    private var neighborNameField: some View {
        let neighbors = viewModel.neighbors
        return VStack(alignment: .leading, spacing: Spacing.s1) {
            PantopusTextField(
                "Name neighbors see",
                text: Binding(get: { neighbors.nameText }, set: { neighbors.editName($0) }),
                state: neighbors.nameError.map { .error($0) } ?? .default,
                isDirty: neighbors.isNameChanged,
                contentType: .nickname,
                identifier: "editProfileNeighborName"
            )
            .disabled(neighbors.loaded == nil)
            Text("A first name or nickname is fine. Your account name stays private.")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    func uploadNeighborPhoto(_ item: PhotosPickerItem) {
        let isPNG = item.supportedContentTypes.contains { $0.conforms(to: .png) }
        let mimeType = isPNG ? "image/png" : "image/jpeg"
        let filename = "profile-\(Int(Date().timeIntervalSince1970)).\(isPNG ? "png" : "jpg")"
        let neighbors = viewModel.neighbors
        Task {
            let data = try? await item.loadTransferable(type: Data.self)
            await neighbors.uploadPhoto(data, filename: filename, mimeType: mimeType)
        }
    }

    // MARK: - Only you see this

    /// Your account photo: what your account uses, and what neighbors see
    /// while you haven't picked a photo just for them.
    var accountPhotoSection: some View {
        FormFieldGroup("Account photo") {
            avatarSection
            Text("Your account uses it. Neighbors see the profile photo above.")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .center)
                .multilineTextAlignment(.center)
        }
    }

    /// Home address (never shown) and who sees your city.
    var placeSection: some View {
        FormFieldGroup("Where you live") {
            placeRow(
                PlaceRow(
                    icon: .home,
                    title: "Home address",
                    detail: "Never shown. Neighbors see “Verified neighbor” and your city.",
                    value: nil,
                    identifier: "editProfileHomeAddress"
                ),
                action: onOpenMyHomes.map { open in
                    { @MainActor in
                        if viewModel.isDirty { showsLeaveWithChanges = true } else { open() }
                    }
                }
            )
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
            placeRow(
                PlaceRow(
                    icon: .mapPin,
                    title: "Who sees your city",
                    detail: nil,
                    value: viewModel.cityAudience.map(EditProfileViewModel.cityAudienceLabel),
                    identifier: "editProfileCityAudience"
                )
            ) { showsCityChoices = true }
        }
    }

    private func placeRow(_ row: PlaceRow, action: (@MainActor () -> Void)?) -> some View {
        Button {
            action?()
        } label: {
            HStack(spacing: Spacing.s3) {
                Icon(row.icon, size: 20, color: Theme.Color.appTextStrong)
                VStack(alignment: .leading, spacing: 2) {
                    Text(row.title)
                        .scaledFont(15, weight: .semibold)
                        .foregroundStyle(Theme.Color.appText)
                    if let detail = row.detail {
                        Text(detail)
                            .scaledFont(13)
                            .foregroundStyle(Theme.Color.appTextMuted)
                    }
                }
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
                if let value = row.value {
                    Text(value)
                        .scaledFont(15)
                        .foregroundStyle(Theme.Color.appTextMuted)
                        .multilineTextAlignment(.trailing)
                }
                if action != nil {
                    Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
                }
            }
            .frame(minHeight: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(action == nil)
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier(row.identifier)
    }
}

/// One "Where you live" row.
struct PlaceRow {
    let icon: PantopusIcon
    let title: String
    let detail: String?
    let value: String?
    let identifier: String
}
