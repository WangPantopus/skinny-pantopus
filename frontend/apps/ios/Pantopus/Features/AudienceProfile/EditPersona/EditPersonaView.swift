//
//  EditPersonaView.swift
//  Pantopus
//
//  A13.12 — Edit Beacon. The creator-facing editor for a Beacon
//  (persona). Built on `FormShell` (X + title + @handle subtitle) with a
//  bespoke sticky save bar below the scroll.
//
//  Every control here writes into `EditPersonaViewModel.form` and is
//  persisted by `save()` → `POST /api/personas` / `PATCH /api/personas/:id`
//  plus `POST /api/upload/persona-media/:id`. Sections the persona write
//  contract does not cover (tiers, Stripe Connect, posting cap, quiet
//  hours, analytics) are intentionally absent rather than rendered from a
//  fixture — they belong to the tier/monetization routes.
//
//  Beacon accent is sky / `primary600`, flat.
//

// swiftlint:disable file_length

import PhotosUI
import SwiftUI
import UIKit

public struct EditPersonaView: View {
    @State private var viewModel: EditPersonaViewModel
    private let onClose: @MainActor () -> Void
    private let onViewBeacon: @MainActor (String) -> Void

    @State private var avatarSelection: PhotosPickerItem?
    @State private var bannerSelection: PhotosPickerItem?
    @State private var showsSavedPrompt = false

    /// Not `public`: the default `EditPersonaViewModel()` argument reaches an
    /// internal initialiser (it takes the internal `APIClient`), and a public
    /// init cannot carry an internal default. Same-module callers are
    /// unaffected.
    init(
        viewModel: EditPersonaViewModel = EditPersonaViewModel(),
        onClose: @escaping @MainActor () -> Void = {},
        onViewBeacon: @escaping @MainActor (String) -> Void = { _ in }
    ) {
        _viewModel = State(initialValue: viewModel)
        self.onClose = onClose
        self.onViewBeacon = onViewBeacon
    }

    public var body: some View {
        content
            .background(Theme.Color.appBg)
            .task { await viewModel.load() }
            .onChange(of: avatarSelection) { _, item in
                loadPick(item) { viewModel.attachAvatar($0) }
                avatarSelection = nil
            }
            .onChange(of: bannerSelection) { _, item in
                loadPick(item) { viewModel.attachBanner($0) }
                bannerSelection = nil
            }
            .alert("Saved", isPresented: $showsSavedPrompt) {
                Button("Stay Here", role: .cancel) {}
                Button("View Beacon") {
                    if let handle = viewModel.savedHandle { onViewBeacon(handle) }
                }
            } message: {
                Text(viewModel.statusMessage ?? "Beacon saved.")
            }
            .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
            .accessibilityIdentifier("editPersona")
    }

    @ViewBuilder private var content: some View {
        switch viewModel.state {
        case .loading:
            shell(subtitle: nil, body: { EditPersonaLoadingBody() }, stickyBottom: nil)
        case .editing:
            shell(
                subtitle: viewModel.form.atHandle.isEmpty ? nil : viewModel.form.atHandle,
                body: { editor },
                stickyBottom: { AnyView(stickyBar) }
            )
        case let .error(message):
            shell(
                subtitle: nil,
                body: { EditPersonaErrorBody(message: message) { Task { await viewModel.refresh() } } },
                stickyBottom: nil
            )
        }
    }

    private var editor: some View {
        VStack(alignment: .leading, spacing: Spacing.s5) {
            if viewModel.isCreate {
                EditPersonaCreateHero()
            }
            mediaSection
            identitySection
            categorySection
            audienceSection
            linksSection
            if !viewModel.form.shareURL.isEmpty, !viewModel.isCreate {
                shareSection
            }
        }
        .padding(.horizontal, Spacing.s4)
        .accessibilityIdentifier("editPersonaContent")
    }

    /// Compose `FormShell` (chrome + scroll + dirty-close confirm) with the
    /// bespoke sticky save bar.
    private func shell(
        subtitle: String?,
        @ViewBuilder body: () -> some View,
        stickyBottom: (() -> AnyView)?
    ) -> some View {
        FormShell(
            title: viewModel.isCreate ? "Create Beacon" : "Edit Beacon",
            subtitle: subtitle,
            rightActionLabel: nil,
            isValid: viewModel.isValid,
            isDirty: viewModel.isDirty,
            onClose: onClose,
            onCommit: {},
            content: { body() },
            stickyBottom: stickyBottom
        )
    }

    // MARK: - Media

    private var mediaSection: some View {
        PersonaSection("Beacon media") {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                PersonaBannerPicker(
                    imageData: viewModel.form.bannerPick?.data,
                    remoteURL: viewModel.form.bannerURL,
                    selection: $bannerSelection,
                    hasPick: viewModel.form.bannerPick != nil
                ) { viewModel.removeBannerPick() }
                PersonaAvatarPicker(
                    imageData: viewModel.form.avatarPick?.data,
                    remoteURL: viewModel.form.avatarURL,
                    selection: $avatarSelection,
                    hasPick: viewModel.form.avatarPick != nil
                ) { viewModel.removeAvatarPick() }
            }
        }
    }

    // MARK: - Identity

    private var identitySection: some View {
        PersonaSection("Identity") {
            VStack(alignment: .leading, spacing: Spacing.s4) {
                VStack(alignment: .leading, spacing: Spacing.s0) {
                    PLabel("Handle", required: true, hint: "3–40 chars · letters, numbers, . _ -")
                    PersonaHandleField(handle: $viewModel.form.handle)
                }
                VStack(alignment: .leading, spacing: Spacing.s0) {
                    PLabel("Display name", required: true)
                    PersonaTextField(
                        text: $viewModel.form.displayName,
                        placeholder: "What your audience sees",
                        identifier: "editPersonaDisplayName"
                    )
                }
                VStack(alignment: .leading, spacing: Spacing.s0) {
                    PLabel("Bio")
                    PersonaBioEditor(text: $viewModel.form.bio)
                    Text(viewModel.form.bioCharCount)
                        .font(.system(size: 11))
                        .foregroundStyle(
                            viewModel.form.bio.count > EditPersonaForm.bioLimit
                                ? Theme.Color.error
                                : Theme.Color.appTextMuted
                        )
                        .frame(maxWidth: .infinity, alignment: .trailing)
                        .padding(.top, Spacing.s1)
                        .accessibilityIdentifier("editPersonaBioCount")
                }
            }
        }
    }

    // MARK: - Category

    private var categorySection: some View {
        PersonaSection("Category") {
            VStack(alignment: .leading, spacing: Spacing.s2) {
                Text("What this Beacon is for. Sensitive professional categories stay gated until credentials are verified.")
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                FilterSheetFlowLayout(spacing: 6) {
                    ForEach(viewModel.categories) { option in
                        PersonaChoiceChip(
                            label: option.isEnabled ? option.label : "\(option.label) (gated)",
                            icon: option.isEnabled ? nil : .lock,
                            isSelected: viewModel.form.category == option.value,
                            isDisabled: !option.isEnabled,
                            identifier: "editPersonaCategory_\(option.value)"
                        ) {
                            viewModel.setCategory(option.value)
                        }
                    }
                }
            }
        }
    }

    // MARK: - Audience

    private var audienceSection: some View {
        PersonaSection("Audience") {
            VStack(alignment: .leading, spacing: Spacing.s4) {
                VStack(alignment: .leading, spacing: Spacing.s0) {
                    PLabel("What you call them")
                    FilterSheetFlowLayout(spacing: 6) {
                        ForEach(PersonaAudienceLabel.allCases) { option in
                            PersonaChoiceChip(
                                label: option.label,
                                icon: nil,
                                isSelected: viewModel.form.audienceLabel == option,
                                isDisabled: false,
                                identifier: "editPersonaAudienceLabel_\(option.rawValue)"
                            ) {
                                viewModel.setAudienceLabel(option)
                            }
                        }
                    }
                }
                VStack(alignment: .leading, spacing: Spacing.s2) {
                    PLabel("How they join")
                    ForEach(PersonaAudienceMode.allCases) { option in
                        PersonaModeRow(
                            option: option,
                            isSelected: viewModel.form.audienceMode == option
                        ) {
                            viewModel.setAudienceMode(option)
                        }
                    }
                }
            }
        }
    }

    // MARK: - Public links

    private var linksSection: some View {
        PersonaSection("Public links") {
            VStack(alignment: .leading, spacing: Spacing.s2) {
                if viewModel.form.links.isEmpty {
                    Text("Add up to 8 links your audience can open from your Beacon.")
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                ForEach(viewModel.form.links) { link in
                    PersonaLinkRow(
                        link: link,
                        onLabel: { viewModel.updateLink(id: link.id, label: $0) },
                        onURL: { viewModel.updateLink(id: link.id, url: $0) },
                        onRemove: { viewModel.removeLink(id: link.id) }
                    )
                }
                if viewModel.form.hasIncompleteLink {
                    HStack(spacing: Spacing.s1) {
                        Icon(.alertCircle, size: 12, color: Theme.Color.error)
                        Text("Each public link needs both a label and a URL.")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(Theme.Color.error)
                    }
                    .accessibilityIdentifier("editPersonaLinkError")
                }
                PersonaAddLinkRow(disabled: !viewModel.canAddLink) { viewModel.addLink() }
            }
        }
    }

    // MARK: - Share

    private var shareSection: some View {
        PersonaSection("Share") {
            PersonaShareCardView(url: viewModel.form.shareURL) {
                onViewBeacon(viewModel.form.normalizedHandle)
            }
        }
    }

    // MARK: - Sticky bar

    private var stickyBar: some View {
        PersonaStickyBar(
            label: viewModel.saveButtonLabel,
            isSaving: viewModel.isSaving,
            isEnabled: viewModel.isValid && !viewModel.isSaving,
            statusMessage: viewModel.statusMessage,
            errorMessage: viewModel.saveError,
            onDiscard: onClose
        ) {
            Task {
                if await viewModel.save() != nil { showsSavedPrompt = true }
            }
        }
    }

    // MARK: - Picker plumbing

    private func loadPick(_ item: PhotosPickerItem?, assign: @escaping @MainActor (PersonaImagePick) -> Void) {
        guard let item else { return }
        Task {
            guard let data = try? await item.loadTransferable(type: Data.self) else { return }
            let mime = item.supportedContentTypes.first?.preferredMIMEType ?? "image/jpeg"
            let ext = mime == "image/png" ? "png" : "jpg"
            await MainActor.run {
                // Randomised filename — the picker's `IMG_xxxx` never reaches
                // S3 / access logs. Mirrors RN's persona media firewall.
                assign(
                    PersonaImagePick(
                        data: data,
                        fileName: "beacon-\(UUID().uuidString.prefix(8)).\(ext)",
                        mimeType: mime
                    )
                )
            }
        }
    }
}

// MARK: - Loading / error bodies

private struct EditPersonaLoadingBody: View {
    var body: some View {
        VStack(spacing: Spacing.s5) {
            Shimmer(height: 120, cornerRadius: Radii.lg)
            Shimmer(height: 160, cornerRadius: Radii.lg)
            Shimmer(height: 200, cornerRadius: Radii.lg)
            Shimmer(height: 120, cornerRadius: Radii.lg)
        }
        .padding(.horizontal, Spacing.s4)
        .accessibilityIdentifier("editPersonaLoading")
    }
}

private struct EditPersonaErrorBody: View {
    let message: String
    let onRetry: () -> Void

    var body: some View {
        VStack(spacing: Spacing.s3) {
            Icon(.alertCircle, size: 40, color: Theme.Color.error)
            Text("Couldn't load Beacon")
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)
            Text(message)
                .font(.system(size: 13.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
            Button(action: onRetry) {
                Text("Try again")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
                    .padding(.horizontal, Spacing.s5)
                    .frame(height: 44)
                    .background(Theme.Color.primary600)
                    .clipShape(Capsule())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("editPersonaRetry")
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s10)
        .accessibilityIdentifier("editPersonaError")
    }
}

// MARK: - Create hero

private struct EditPersonaCreateHero: View {
    var body: some View {
        HStack(spacing: Spacing.s3) {
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .fill(Theme.Color.primary600)
                .frame(width: 40, height: 40)
                .overlay { Icon(.radio, size: 18, color: Theme.Color.appTextInverse) }
            VStack(alignment: .leading, spacing: 2) {
                Text("Create your Beacon")
                    .font(.system(size: 13.5, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                Text("A public identity, separate from your personal profile. Pick a handle and you're live.")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(Theme.Color.primary700)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: Spacing.s0)
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.primary50)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.primary200, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("editPersonaCreateHero")
    }
}

// MARK: - Section scaffold

private struct PersonaSection<Content: View>: View {
    let overline: String
    let content: Content

    init(_ overline: String, @ViewBuilder content: () -> Content) {
        self.overline = overline
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text(overline.uppercased())
                .font(.system(size: 10.5, weight: .bold))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .kerning(0.7)
                .accessibilityAddTraits(.isHeader)
            content
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct PLabel: View {
    let text: String
    let required: Bool
    let hint: String?

    init(_ text: String, required: Bool = false, hint: String? = nil) {
        self.text = text
        self.required = required
        self.hint = hint
    }

    var body: some View {
        HStack(spacing: 3) {
            Text(text)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextStrong)
            if required {
                Text("*").font(.system(size: 12, weight: .semibold)).foregroundStyle(Theme.Color.primary600)
            }
            if let hint {
                Text(hint)
                    .font(.system(size: 11, weight: .medium))
                    .italic()
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
            Spacer(minLength: Spacing.s0)
        }
        .padding(.bottom, Spacing.s2)
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Media pickers

private struct PersonaBannerPicker: View {
    let imageData: Data?
    let remoteURL: String?
    @Binding var selection: PhotosPickerItem?
    let hasPick: Bool
    let onRemove: @MainActor () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            PLabel("Banner", hint: "16:6")
            ZStack(alignment: .topTrailing) {
                PhotosPicker(selection: $selection, matching: .images) {
                    Group {
                        if let imageData, let image = UIImage(data: imageData) {
                            Image(uiImage: image).resizable().scaledToFill()
                        } else if let remoteURL, let url = URL(string: remoteURL) {
                            AsyncImage(url: url) { image in
                                image.resizable().scaledToFill()
                            } placeholder: {
                                Color.clear
                            }
                        } else {
                            placeholder
                        }
                    }
                    .frame(height: 96)
                    .frame(maxWidth: .infinity)
                    .clipped()
                    .background(Theme.Color.appSurfaceSunken)
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                            .stroke(Theme.Color.appBorder, lineWidth: 1)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Choose banner image")
                .accessibilityIdentifier("editPersonaBannerPicker")

                if hasPick {
                    RemovePickButton(action: onRemove, identifier: "editPersonaBannerRemove")
                }
            }
        }
    }

    private var placeholder: some View {
        VStack(spacing: Spacing.s1) {
            Icon(.imagePlus, size: 20, color: Theme.Color.appTextMuted)
            Text("Add a banner")
                .font(.system(size: 11.5, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
        .frame(maxWidth: .infinity)
    }
}

private struct PersonaAvatarPicker: View {
    let imageData: Data?
    let remoteURL: String?
    @Binding var selection: PhotosPickerItem?
    let hasPick: Bool
    let onRemove: @MainActor () -> Void

    var body: some View {
        HStack(spacing: Spacing.s3) {
            ZStack(alignment: .topTrailing) {
                PhotosPicker(selection: $selection, matching: .images) {
                    Group {
                        if let imageData, let image = UIImage(data: imageData) {
                            Image(uiImage: image).resizable().scaledToFill()
                        } else if let remoteURL, let url = URL(string: remoteURL) {
                            AsyncImage(url: url) { image in
                                image.resizable().scaledToFill()
                            } placeholder: {
                                Color.clear
                            }
                        } else {
                            Icon(.imagePlus, size: 20, color: Theme.Color.appTextMuted)
                        }
                    }
                    .frame(width: 72, height: 72)
                    .background(Theme.Color.appSurfaceSunken)
                    .clipShape(Circle())
                    .overlay(Circle().stroke(Theme.Color.appBorder, lineWidth: 1))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Choose avatar image")
                .accessibilityIdentifier("editPersonaAvatarPicker")

                if hasPick {
                    RemovePickButton(action: onRemove, identifier: "editPersonaAvatarRemove")
                }
            }
            VStack(alignment: .leading, spacing: 2) {
                Text("Avatar")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextStrong)
                Text("Use an image that isn't your personal profile photo — your Beacon is a separate identity.")
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: Spacing.s0)
        }
    }
}

private struct RemovePickButton: View {
    let action: @MainActor () -> Void
    let identifier: String

    var body: some View {
        Button(action: action) {
            Icon(.x, size: 12, strokeWidth: 2.6, color: Theme.Color.appTextInverse)
                .frame(width: 24, height: 24)
                .background(Theme.Color.appTextStrong)
                .clipShape(Circle())
        }
        .buttonStyle(.plain)
        .padding(Spacing.s1)
        .accessibilityLabel("Remove picked image")
        .accessibilityIdentifier(identifier)
    }
}

// MARK: - Fields

private struct PersonaHandleField: View {
    @Binding var handle: String

    var body: some View {
        HStack(spacing: Spacing.s1) {
            Text("@")
                .font(.system(size: 14, weight: .bold, design: .monospaced))
                .foregroundStyle(Theme.Color.primary600)
            TextField("yourhandle", text: $handle)
                .font(.system(size: 14, weight: .semibold, design: .monospaced))
                .foregroundStyle(Theme.Color.appText)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .accessibilityIdentifier("editPersonaHandle")
        }
        .padding(.horizontal, Spacing.s3)
        .frame(height: 44)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1.5)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .accessibilityLabel("Beacon handle")
    }
}

private struct PersonaTextField: View {
    @Binding var text: String
    let placeholder: String
    let identifier: String

    var body: some View {
        TextField(placeholder, text: $text)
            .font(.system(size: 14))
            .foregroundStyle(Theme.Color.appText)
            .padding(.horizontal, Spacing.s3)
            .frame(height: 44)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            .accessibilityIdentifier(identifier)
    }
}

private struct PersonaBioEditor: View {
    @Binding var text: String

    var body: some View {
        ZStack(alignment: .topLeading) {
            if text.isEmpty {
                Text("What do you post about?")
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.Color.appTextMuted)
                    .padding(.horizontal, Spacing.s3 + 2)
                    .padding(.vertical, Spacing.s3)
                    .allowsHitTesting(false)
                    .accessibilityHidden(true)
            }
            TextEditor(text: $text)
                .font(.system(size: 14))
                .foregroundStyle(Theme.Color.appText)
                .scrollContentBackground(.hidden)
                .padding(.horizontal, Spacing.s2)
                .padding(.vertical, Spacing.s2)
                .frame(minHeight: 96)
                .accessibilityIdentifier("editPersonaBio")
                .accessibilityLabel("Bio")
        }
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
    }
}

// MARK: - Choice chips

private struct PersonaChoiceChip: View {
    let label: String
    let icon: PantopusIcon?
    let isSelected: Bool
    let isDisabled: Bool
    let identifier: String
    let action: @MainActor () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 5) {
                if let icon {
                    Icon(icon, size: 11, color: foreground)
                }
                Text(label)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(foreground)
            }
            .padding(.horizontal, Spacing.s3)
            .frame(minHeight: 34)
            .background(background)
            .overlay(Capsule().stroke(border, lineWidth: 1))
            .clipShape(Capsule())
        }
        .buttonStyle(.plain)
        .disabled(isDisabled)
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
        .accessibilityIdentifier(identifier)
    }

    private var foreground: Color {
        if isDisabled { return Theme.Color.appTextMuted }
        return isSelected ? Theme.Color.primary700 : Theme.Color.appTextStrong
    }

    private var background: Color {
        if isDisabled { return Theme.Color.appSurfaceSunken }
        return isSelected ? Theme.Color.primary50 : Theme.Color.appSurface
    }

    private var border: Color {
        if isDisabled { return Theme.Color.appBorder }
        return isSelected ? Theme.Color.primary200 : Theme.Color.appBorder
    }
}

private struct PersonaModeRow: View {
    let option: PersonaAudienceMode
    let isSelected: Bool
    let action: @MainActor () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Spacing.s3) {
                Icon(
                    isSelected ? .checkCircle : .circle,
                    size: 18,
                    color: isSelected ? Theme.Color.primary600 : Theme.Color.appBorderStrong
                )
                VStack(alignment: .leading, spacing: 1) {
                    Text(option.label)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                    Text(option.blurb)
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                Spacer(minLength: Spacing.s0)
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, Spacing.s3)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(isSelected ? Theme.Color.primary50 : Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(isSelected ? Theme.Color.primary200 : Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
        .accessibilityIdentifier("editPersonaAudienceMode_\(option.rawValue)")
    }
}

// MARK: - Public links

private struct PersonaLinkRow: View {
    let link: PersonaLinkDraft
    let onLabel: @MainActor (String) -> Void
    let onURL: @MainActor (String) -> Void
    let onRemove: @MainActor () -> Void

    var body: some View {
        HStack(spacing: Spacing.s2) {
            VStack(spacing: Spacing.s2) {
                TextField(
                    "Label",
                    text: Binding(get: { link.label }, set: { onLabel($0) })
                )
                .font(.system(size: 13))
                .foregroundStyle(Theme.Color.appText)
                .padding(.horizontal, Spacing.s3)
                .frame(height: 40)
                .background(Theme.Color.appSurface)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.sm, style: .continuous)
                        .stroke(Theme.Color.appBorder, lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: Radii.sm, style: .continuous))
                .accessibilityIdentifier("editPersonaLinkLabel")

                TextField(
                    "https://",
                    text: Binding(get: { link.url }, set: { onURL($0) })
                )
                .font(.system(size: 13, design: .monospaced))
                .foregroundStyle(Theme.Color.appText)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .keyboardType(.URL)
                .padding(.horizontal, Spacing.s3)
                .frame(height: 40)
                .background(Theme.Color.appSurface)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.sm, style: .continuous)
                        .stroke(Theme.Color.appBorder, lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: Radii.sm, style: .continuous))
                .accessibilityIdentifier("editPersonaLinkUrl")
            }
            Button(action: onRemove) {
                Icon(.trash, size: 16, color: Theme.Color.error)
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Remove link \(link.label)")
            .accessibilityIdentifier("editPersonaRemoveLink")
        }
        .padding(Spacing.s2)
        .background(Theme.Color.appSurfaceSunken)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
    }
}

private struct PersonaAddLinkRow: View {
    let disabled: Bool
    let action: @MainActor () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Spacing.s2) {
                Icon(.plusCircle, size: 15, color: disabled ? Theme.Color.appTextMuted : Theme.Color.primary700)
                Text("Add link")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(disabled ? Theme.Color.appTextMuted : Theme.Color.primary700)
                Spacer(minLength: Spacing.s0)
                Text("up to 8")
                    .font(.system(size: 10))
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
            .padding(.horizontal, Spacing.s4)
            .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .strokeBorder(
                        disabled ? Theme.Color.appBorder : Theme.Color.primary200,
                        style: StrokeStyle(lineWidth: 1.5, dash: [4, 3])
                    )
            )
        }
        .buttonStyle(.plain)
        .disabled(disabled)
        .accessibilityLabel("Add link, up to 8")
        .accessibilityIdentifier("editPersonaAddLink")
    }
}

// MARK: - Share card

private struct PersonaShareCardView: View {
    let url: String
    let onOpen: @MainActor () -> Void

    @State private var didCopy = false

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text("Public link · anyone can follow".uppercased())
                .font(.system(size: 10.5, weight: .bold))
                .foregroundStyle(Theme.Color.primary700)
            Text(url)
                .font(.system(size: 11.5, design: .monospaced))
                .foregroundStyle(Theme.Color.appTextStrong)
                .lineLimit(1)
                .truncationMode(.tail)
                .padding(.horizontal, Spacing.s2)
                .padding(.vertical, 6)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Theme.Color.appSurfaceMuted)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.sm, style: .continuous)
                        .stroke(Theme.Color.appBorder, lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: Radii.sm, style: .continuous))
            HStack(spacing: 6) {
                Button {
                    UIPasteboard.general.string = url
                    didCopy = true
                } label: {
                    shareButtonLabel(.copy, didCopy ? "Copied" : "Copy")
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Copy Beacon link")
                .accessibilityIdentifier("editPersonaShareCopy")

                ShareLink(item: url) {
                    shareButtonLabel(.share, "Share")
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("editPersonaShareShare")

                Button(action: onOpen) {
                    shareButtonLabel(.externalLink, "View")
                }
                .buttonStyle(.plain)
                .accessibilityLabel("View Beacon")
                .accessibilityIdentifier("editPersonaShareView")
            }
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityIdentifier("editPersonaShareCard")
    }

    private func shareButtonLabel(_ icon: PantopusIcon, _ label: String) -> some View {
        HStack(spacing: 5) {
            Icon(icon, size: 12, color: Theme.Color.appText)
            Text(label)
                .font(.system(size: 11.5, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
        }
        .frame(maxWidth: .infinity)
        .frame(height: 34)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.sm, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.sm, style: .continuous))
    }
}

// MARK: - Sticky bar

private struct PersonaStickyBar: View {
    let label: String
    let isSaving: Bool
    let isEnabled: Bool
    let statusMessage: String?
    let errorMessage: String?
    let onDiscard: @MainActor () -> Void
    let onSave: @MainActor () -> Void

    var body: some View {
        VStack(spacing: Spacing.s0) {
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
            VStack(spacing: Spacing.s2) {
                if let errorMessage {
                    banner(icon: .alertCircle, text: errorMessage, tone: .error)
                } else if let statusMessage {
                    banner(icon: .checkCircle, text: statusMessage, tone: .success)
                }
                HStack(spacing: Spacing.s2) {
                    Button(action: onDiscard) {
                        Text("Cancel")
                            .font(.system(size: 13.5, weight: .semibold))
                            .foregroundStyle(Theme.Color.appTextStrong)
                            .frame(height: 42)
                            .padding(.horizontal, Spacing.s3)
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("editPersonaDiscard")

                    Spacer(minLength: Spacing.s0)

                    Button(action: onSave) {
                        HStack(spacing: 6) {
                            if isSaving {
                                ProgressView().tint(Theme.Color.appTextInverse)
                            } else {
                                Icon(.check, size: 15, color: Theme.Color.appTextInverse)
                            }
                            Text(label)
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(Theme.Color.appTextInverse)
                        }
                        .frame(height: 42)
                        .padding(.horizontal, Spacing.s5)
                        .background(isEnabled ? Theme.Color.primary600 : Theme.Color.appBorder)
                        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                    }
                    .buttonStyle(.plain)
                    .disabled(!isEnabled)
                    .accessibilityLabel(label)
                    .accessibilityIdentifier("editPersonaSave")
                }
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.vertical, Spacing.s3)
        }
        .background(Theme.Color.appSurface)
    }

    private enum Tone { case success, error }

    private func banner(icon: PantopusIcon, text: String, tone: Tone) -> some View {
        HStack(spacing: Spacing.s2) {
            Icon(icon, size: 13, color: tone == .error ? Theme.Color.error : Theme.Color.success)
            Text(text)
                .font(.system(size: 11.5, weight: .semibold))
                .foregroundStyle(tone == .error ? Theme.Color.error : Theme.Color.success)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: Spacing.s0)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, 6)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(tone == .error ? Theme.Color.errorBg : Theme.Color.successBg)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .stroke(tone == .error ? Theme.Color.errorLight : Theme.Color.successLight, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .accessibilityIdentifier("editPersonaStatusBanner")
    }
}

#Preview("Edit Beacon") {
    EditPersonaView()
}
