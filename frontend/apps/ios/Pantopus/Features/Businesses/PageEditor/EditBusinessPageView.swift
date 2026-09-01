//
//  EditBusinessPageView.swift
//  Pantopus
//
//  P4.2 — A13.10 Edit Business Page. Top-level editor view. Mirrors the
//  design's two frames (published / setup) — the strip under the top
//  bar swaps between `IdentityStrip` and `CompletionStrip`, and the
//  sticky save footer swaps between the dirty Discard/Save pair and the
//  Save draft / Publish · N to go pair. Body is a single scrolling
//  stack of overline-headed sections; field rendering uses the
//  identity-violet `BizLabel` primitive for label + required asterisk
//  + dirty dot + optional hint.
//
//  Routing: pushed from `BusinessProfileView`'s owner-only "Edit" trailing
//  action and from the `pantopus://businesses/:id/page-editor` deep
//  link. The host supplies the back closure.
//

// swiftlint:disable file_length

import SwiftUI

/// Top-level edit screen for a business profile.
@MainActor
public struct EditBusinessPageView: View {
    @State private var viewModel: EditBusinessPageViewModel
    private let onBack: @MainActor () -> Void
    private let onPreview: @MainActor () -> Void

    public init(
        businessId: String,
        preview: EditBusinessPageContent? = nil,
        onBack: @escaping @MainActor () -> Void,
        onPreview: @escaping @MainActor () -> Void = {}
    ) {
        _viewModel = State(initialValue: EditBusinessPageViewModel(
            businessId: businessId,
            preview: preview
        ))
        self.onBack = onBack
        self.onPreview = onPreview
    }

    public var body: some View {
        ZStack(alignment: .bottom) {
            content
            if let toast = viewModel.toastMessage {
                ToastView(message: ToastMessage(text: toast, kind: .neutral))
                    .padding(.bottom, Spacing.s16)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                    .task(id: toast) {
                        try? await Task.sleep(nanoseconds: 2_000_000_000)
                        viewModel.toastMessage = nil
                    }
            }
        }
        .background(Theme.Color.appBg)
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .accessibilityIdentifier("editBusinessPage")
        .task { await viewModel.load() }
        .confirmationDialog(
            "Discard unsaved edits?",
            isPresented: Binding(
                get: { viewModel.showsDiscardConfirm },
                set: { viewModel.showsDiscardConfirm = $0 }
            ),
            titleVisibility: .visible
        ) {
            Button("Discard edits", role: .destructive) {
                Task { await viewModel.discardConfirmed() }
            }
            Button("Keep editing", role: .cancel) {}
        }
    }

    @ViewBuilder private var content: some View {
        switch viewModel.state {
        case .loading:
            VStack(spacing: Spacing.s0) {
                EditBusinessTopBar(
                    title: "Edit business page",
                    rightLabel: "Preview",
                    rightEnabled: false,
                    onBack: onBack
                ) {}
                // Hand-rolled shimmer mirroring the loaded geometry — strip,
                // banner, two section placeholders. Never a screen-level
                // `ProgressView` per the iOS state-rule.
                ScrollView {
                    VStack(alignment: .leading, spacing: Spacing.s4) {
                        Shimmer(height: 32, cornerRadius: 0)
                        Shimmer(height: 140, cornerRadius: Radii.lg)
                            .padding(.horizontal, Spacing.s4)
                        Shimmer(height: 24, cornerRadius: Radii.sm)
                            .frame(width: 180)
                            .padding(.horizontal, Spacing.s4)
                        Shimmer(height: 88, cornerRadius: Radii.md)
                            .padding(.horizontal, Spacing.s4)
                        Shimmer(height: 24, cornerRadius: Radii.sm)
                            .frame(width: 120)
                            .padding(.horizontal, Spacing.s4)
                        Shimmer(height: 240, cornerRadius: Radii.lg)
                            .padding(.horizontal, Spacing.s4)
                    }
                    .padding(.top, Spacing.s4)
                }
            }
            .accessibilityIdentifier("editBusinessPage.loading")
        case let .loaded(payload):
            EditBusinessPageLoadedView(
                content: payload,
                onBack: onBack,
                onPreview: onPreview,
                onDiscard: { viewModel.discardRequested() },
                onSave: { Task { await viewModel.save() } },
                onSaveDraft: { Task { await viewModel.saveDraft() } },
                onPublish: { Task { await viewModel.publish() } },
                onFieldChange: { key, value in viewModel.update(key, to: value) },
                onBeginDescription: { viewModel.beginDescriptionEditing() }
            )
        case .empty:
            VStack(spacing: Spacing.s0) {
                EditBusinessTopBar(
                    title: "Edit business page",
                    rightLabel: "Preview",
                    rightEnabled: false,
                    onBack: onBack
                ) {}
                EmptyState(
                    icon: .building2,
                    headline: "Business not found",
                    subcopy: "This business page isn't available to edit.",
                    cta: EmptyState.CTA(title: "Try again") {
                        await viewModel.refresh()
                    }
                )
                .frame(maxHeight: .infinity)
            }
            .accessibilityIdentifier("editBusinessPage.empty")
        case let .error(message):
            VStack(spacing: Spacing.s0) {
                EditBusinessTopBar(
                    title: "Edit business page",
                    rightLabel: "Preview",
                    rightEnabled: false,
                    onBack: onBack
                ) {}
                EmptyState(
                    icon: .alertCircle,
                    headline: "Couldn't load editor",
                    subcopy: message,
                    cta: EmptyState.CTA(title: "Try again") {
                        await viewModel.refresh()
                    }
                )
                .frame(maxHeight: .infinity)
            }
            .accessibilityIdentifier("editBusinessPage.error")
        }
    }
}

// MARK: - Loaded layout

/// Pulled out so snapshot tests can render a fixed payload without
/// going through the view-model's load path.
@MainActor
public struct EditBusinessPageLoadedView: View {
    public let content: EditBusinessPageContent
    public let onBack: @MainActor () -> Void
    public let onPreview: @MainActor () -> Void
    public let onDiscard: @MainActor () -> Void
    public let onSave: @MainActor () -> Void
    public let onSaveDraft: @MainActor () -> Void
    public let onPublish: @MainActor () -> Void
    public let onFieldChange: @MainActor (EditBusinessPageFieldKey, String) -> Void
    public let onBeginDescription: @MainActor () -> Void

    public init(
        content: EditBusinessPageContent,
        onBack: @escaping @MainActor () -> Void,
        onPreview: @escaping @MainActor () -> Void = {},
        onDiscard: @escaping @MainActor () -> Void = {},
        onSave: @escaping @MainActor () -> Void = {},
        onSaveDraft: @escaping @MainActor () -> Void = {},
        onPublish: @escaping @MainActor () -> Void = {},
        onFieldChange: @escaping @MainActor (EditBusinessPageFieldKey, String) -> Void = { _, _ in },
        onBeginDescription: @escaping @MainActor () -> Void = {}
    ) {
        self.content = content
        self.onBack = onBack
        self.onPreview = onPreview
        self.onDiscard = onDiscard
        self.onSave = onSave
        self.onSaveDraft = onSaveDraft
        self.onPublish = onPublish
        self.onFieldChange = onFieldChange
        self.onBeginDescription = onBeginDescription
    }

    public var body: some View {
        VStack(spacing: Spacing.s0) {
            EditBusinessTopBar(
                title: "Edit business page",
                rightLabel: "Preview",
                rightEnabled: !isSetupMode,
                onBack: onBack,
                onRight: onPreview
            )
            stripUnderTopBar
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.s5) {
                    EditBusinessBannerLogoEditor(banner: content.banner, logo: content.logo)
                        .padding(.horizontal, Spacing.s4)
                        .padding(.top, Spacing.s4)

                    nameAndTaglineSection
                    descriptionSection
                    hoursSection
                    servicesSection
                    gallerySection
                    contactSection
                    locationSection

                    Color.clear.frame(height: 100)
                }
            }
            .background(Theme.Color.appBg)
        }
        .overlay(alignment: .bottom) {
            EditBusinessStickySave(
                mode: stickyMode,
                onDiscard: onDiscard,
                onSave: onSave,
                onSaveDraft: onSaveDraft,
                onPublish: onPublish
            )
        }
    }

    private var isSetupMode: Bool {
        if case .setup = content.mode { return true }
        return false
    }

    private var stickyMode: EditBusinessStickySaveMode {
        switch content.mode {
        case let .published(count, _): .dirty(count: count)
        case let .setup(_, _, remaining, _): .setup(remaining: remaining)
        }
    }

    @ViewBuilder private var stripUnderTopBar: some View {
        switch content.mode {
        case let .published(_, label):
            EditBusinessIdentityStrip(
                name: identityName,
                lastPublishedLabel: label
            )
        case let .setup(done, total, _, items):
            EditBusinessCompletionStrip(done: done, total: total, items: items)
        }
    }

    private var identityName: String {
        // The strip uses the business name + locality from the address
        // for the secondary detail. Fall back to just the name.
        content.name.current
    }

    // MARK: Sections

    private var nameAndTaglineSection: some View {
        EditBusinessSection(overline: "Business name & tagline") {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                BizField(
                    label: "Name",
                    required: true,
                    field: content.name,
                    state: .valid
                ) { onFieldChange(.name, $0) }
                BizField(
                    label: "Tagline",
                    hint: "Shows in search and on map pins",
                    field: content.tagline
                ) { onFieldChange(.tagline, $0) }
                HStack(spacing: Spacing.s3) {
                    BizField(
                        label: "Category",
                        required: content.categoryRequired,
                        field: content.category,
                        trailing: .chevron
                    ) { onFieldChange(.category, $0) }
                    BizField(
                        label: "Price",
                        field: content.price
                    ) { onFieldChange(.price, $0) }
                        .frame(width: 110)
                }
            }
        }
    }

    private var descriptionSection: some View {
        EditBusinessSection(overline: "Description") {
            switch content.description {
            case let .field(field, limit):
                VStack(alignment: .leading, spacing: 6) {
                    BizLabel(
                        label: "About",
                        dirty: field.isDirty,
                        hint: "Markdown supported"
                    )
                    BizTextarea(
                        field: field,
                        charLimit: limit
                    ) { onFieldChange(.description, $0) }
                }
            case let .prompt(prompt):
                PromptBlock(prompt: prompt, onTap: onBeginDescription)
            }
        }
    }

    private var hoursSection: some View {
        EditBusinessSection(overline: "Hours") {
            EditBusinessHoursEditor(state: content.hours)
        }
    }

    private var servicesSection: some View {
        EditBusinessSection(overline: "Services") {
            switch content.services {
            case let .chips(chips):
                VStack(alignment: .leading, spacing: 6) {
                    BizLabel(label: "What you offer")
                    EditBusinessServiceChipsEditor(chips: chips)
                }
            case let .prompt(prompt):
                PromptBlock(prompt: prompt)
            }
        }
    }

    private var gallerySection: some View {
        EditBusinessSection(overline: "Gallery") {
            VStack(alignment: .leading, spacing: 6) {
                BizLabel(label: "Photos", hint: content.gallery.hintLabel)
                EditBusinessGalleryEditor(state: content.gallery)
            }
        }
    }

    private var contactSection: some View {
        EditBusinessSection(overline: "Contact") {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                BizField(
                    label: "Phone",
                    field: content.phone,
                    state: .valid,
                    leading: "+1"
                ) { onFieldChange(.phone, $0) }
                BizField(
                    label: "Email",
                    field: content.email,
                    state: .valid
                ) { onFieldChange(.email, $0) }
                BizField(
                    label: "Website",
                    field: content.website,
                    leading: "https://"
                ) { onFieldChange(.website, $0) }
                if let booking = content.bookingLink {
                    BizField(
                        label: "Booking link",
                        hint: "Public on profile",
                        field: booking,
                        leading: "https://"
                    ) { onFieldChange(.bookingLink, $0) }
                }
            }
        }
    }

    private var locationSection: some View {
        EditBusinessSection(overline: "Location") {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                BizField(
                    label: "Address",
                    required: true,
                    field: content.location.address,
                    state: content.location.error.map { .error($0) } ?? .valid,
                    trailing: .mapPin,
                    identifier: "editBusinessPage.field.address"
                ) { onFieldChange(.address, $0) }
                BizField(
                    label: "City",
                    required: true,
                    field: content.location.city,
                    state: .valid,
                    identifier: "editBusinessPage.field.city"
                ) { onFieldChange(.city, $0) }
                HStack(spacing: Spacing.s3) {
                    BizField(
                        label: "State",
                        field: content.location.state,
                        identifier: "editBusinessPage.field.state"
                    ) { onFieldChange(.state, $0) }
                    BizField(
                        label: "ZIP code",
                        field: content.location.zip,
                        keyboardType: .numberPad,
                        identifier: "editBusinessPage.field.zip"
                    ) { onFieldChange(.zip, $0) }
                        .frame(width: 110)
                }
                VStack(alignment: .leading, spacing: 6) {
                    BizLabel(label: "Map", hint: "Drag the pin to refine")
                    EditBusinessMapPreview(
                        verified: content.location.mapVerified,
                        pinDirty: content.location.pinDirty
                    )
                }
                if case .published = content.mode {
                    HideAddressToggle(on: content.location.hideExactAddress)
                }
            }
        }
    }
}

// MARK: - Top bar

private struct EditBusinessTopBar: View {
    let title: String
    let rightLabel: String
    let rightEnabled: Bool
    let onBack: @MainActor () -> Void
    let onRight: @MainActor () -> Void

    var body: some View {
        ZStack {
            Text(title)
                .font(.system(size: PantopusTextStyle.body.size, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)
            HStack {
                Button {
                    onBack()
                } label: {
                    Icon(.chevronLeft, size: 22, color: Theme.Color.appText)
                        .frame(width: 44, height: 44)
                }
                .accessibilityLabel("Back")
                .accessibilityIdentifier("editBusinessPage.back")
                Spacer()
                Button {
                    if rightEnabled { onRight() }
                } label: {
                    Text(rightLabel)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(rightEnabled ? Theme.Color.business : Theme.Color.appTextMuted)
                        .padding(.horizontal, Spacing.s3)
                        .frame(minHeight: 44)
                }
                .disabled(!rightEnabled)
                .accessibilityIdentifier("editBusinessPage.preview")
                .accessibilityLabel(rightEnabled ? "Preview public page" : "Preview (unavailable)")
            }
            .padding(.horizontal, Spacing.s2)
        }
        .frame(height: 44)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
        }
    }
}

// MARK: - Section wrapper

private struct EditBusinessSection<Content: View>: View {
    let overline: String
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text(overline.uppercased())
                .font(.system(size: 11, weight: .semibold))
                .tracking(0.6)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .accessibilityAddTraits(.isHeader)
            content()
        }
        .padding(.horizontal, Spacing.s4)
    }
}

// MARK: - BizLabel primitive

/// Field label + optional required asterisk + optional dirty dot +
/// optional italic hint right-aligned.
struct BizLabel: View {
    let label: String
    var required: Bool = false
    var dirty: Bool = false
    var hint: String?

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            HStack(spacing: 2) {
                Text(label)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextStrong)
                if required {
                    Text("*")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Theme.Color.error)
                }
                if dirty {
                    Circle()
                        .fill(Theme.Color.warning)
                        .frame(width: 6, height: 6)
                        .overlay(
                            Circle().stroke(Theme.Color.warningBg, lineWidth: 2)
                        )
                        .padding(.leading, 4)
                        .accessibilityHidden(true)
                }
            }
            Spacer()
            if let hint {
                Text(hint)
                    .font(.system(size: 10.5).italic())
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
        }
        .accessibilityLabel(a11yLabel)
    }

    private var a11yLabel: String {
        var parts = [label]
        if required { parts.append("required") }
        if dirty { parts.append("unsaved") }
        if let hint { parts.append(hint) }
        return parts.joined(separator: ", ")
    }
}

// MARK: - BizField

enum BizFieldState {
    case `default`
    case valid
    case error(String)
}

enum BizFieldTrailing {
    case none
    case chevron
    case mapPin
}

/// 44pt field row with the `BizLabel` above and a token-styled input
/// below. Supports `leading` (prefix string like "+1" / "https://") and
/// a `trailing` enum (chevron / mapPin).
struct BizField: View {
    let label: String
    var required: Bool = false
    var hint: String?
    let field: EditBusinessPageField
    var state: BizFieldState = .default
    var leading: String?
    var trailing: BizFieldTrailing = .none
    var keyboardType: UIKeyboardType = .default
    var identifier: String?
    var onChange: ((String) -> Void)?

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            BizLabel(label: label, required: required, dirty: field.isDirty, hint: hint)
            HStack(spacing: 6) {
                if let leading {
                    Text(leading)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .padding(.leading, 10)
                }
                TextField(
                    field.placeholder,
                    text: Binding(
                        get: { field.current },
                        set: { onChange?($0) }
                    )
                )
                .font(Theme.Font.small)
                .foregroundStyle(Theme.Color.appText)
                .keyboardType(keyboardType)
                .padding(.leading, leading == nil ? Spacing.s3 : 0)
                .padding(.vertical, 11)
                .frame(maxWidth: .infinity, alignment: .leading)
                .disabled(onChange == nil)
                trailingIcon
            }
            .frame(minHeight: 44)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(borderColor, lineWidth: 1)
            )
            if case let .error(message) = state {
                Text(message)
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.error)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(a11yLabel)
        .accessibilityIdentifier(identifier ?? "")
    }

    @ViewBuilder private var trailingIcon: some View {
        switch (state, trailing) {
        case (.valid, _):
            Icon(.check, size: 16, color: Theme.Color.success)
                .padding(.trailing, Spacing.s3)
        case (.error, _):
            Icon(.alertCircle, size: 16, color: Theme.Color.error)
                .padding(.trailing, Spacing.s3)
        case (.default, .chevron):
            Icon(.chevronDown, size: 14, color: Theme.Color.appTextSecondary)
                .padding(.trailing, Spacing.s3)
        case (.default, .mapPin):
            Icon(.mapPin, size: 14, color: Theme.Color.appTextSecondary)
                .padding(.trailing, Spacing.s3)
        case (.default, .none):
            EmptyView()
        }
    }

    private var borderColor: Color {
        switch state {
        case .valid: Theme.Color.success
        case .error: Theme.Color.error
        case .default: Theme.Color.appBorder
        }
    }

    private var a11yLabel: String {
        var parts = [label]
        if required { parts.append("required") }
        if !field.current.isEmpty { parts.append("value: \(field.current)") }
        if field.isDirty { parts.append("unsaved") }
        if case let .error(message) = state { parts.append("error: \(message)") }
        return parts.joined(separator: ", ")
    }
}

// MARK: - BizTextarea

private struct BizTextarea: View {
    let field: EditBusinessPageField
    let charLimit: Int
    var onChange: ((String) -> Void)?

    var body: some View {
        ZStack(alignment: .topLeading) {
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .fill(Theme.Color.appSurface)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .stroke(Theme.Color.appBorder, lineWidth: 1)
                )

            VStack(alignment: .leading, spacing: 8) {
                TextEditor(
                    text: Binding(
                        get: { field.current },
                        set: { onChange?($0) }
                    )
                )
                .font(.system(size: 13))
                .foregroundStyle(Theme.Color.appText)
                .scrollContentBackground(.hidden)
                .frame(minHeight: 72, alignment: .topLeading)
                HStack {
                    Spacer()
                    Text("\(field.current.count) / \(charLimit)")
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundStyle(Theme.Color.appTextMuted)
                }
            }
            .padding(12)
        }
        .frame(minHeight: 124)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Description, \(field.current.count) of \(charLimit) characters")
    }
}

// MARK: - PromptBlock

private struct PromptBlock: View {
    let prompt: EditBusinessPagePrompt
    var onTap: (() -> Void)?

    var body: some View {
        Button {
            onTap?()
        } label: {
            HStack(spacing: Spacing.s3) {
                ZStack {
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .fill(Theme.Color.businessBg)
                        .frame(width: 36, height: 36)
                    Icon(iconFor(prompt.iconKey), size: 18, color: Theme.Color.business)
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text(prompt.title)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                    Text(prompt.subtitle)
                        .font(.system(size: 11.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                Spacer()
                Text(prompt.ctaLabel)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextInverse)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 7)
                    .background(Theme.Color.business)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.sm, style: .continuous))
            }
            .padding(14)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .strokeBorder(
                        Theme.Color.appBorderStrong,
                        style: StrokeStyle(lineWidth: 1.5, dash: [5, 4])
                    )
            )
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(prompt.title). \(prompt.subtitle)")
    }

    private func iconFor(_ key: String) -> PantopusIcon {
        switch key {
        case "fileText": .fileText
        case "sparkles": .sparkles
        default: .info
        }
    }
}

// MARK: - Hide address toggle

private struct HideAddressToggle: View {
    let on: Bool

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.s2) {
            VStack(alignment: .leading, spacing: 2) {
                Text("Hide exact address until contact")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                Text("Show street name only on the public page.")
                    .font(.system(size: 11.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            Spacer()
            Capsule()
                .fill(on ? Theme.Color.business : Theme.Color.appSurfaceSunken)
                .overlay(
                    Capsule()
                        .stroke(Theme.Color.appBorder, lineWidth: 1)
                )
                .frame(width: 44, height: 26)
                .overlay(alignment: on ? .trailing : .leading) {
                    Circle()
                        .fill(Theme.Color.appSurface)
                        .frame(width: 22, height: 22)
                        .padding(2)
                        .pantopusShadow(.sm)
                }
        }
        .padding(14)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Hide exact address until contact, \(on ? "on" : "off")")
    }
}

#Preview("Published") {
    EditBusinessPageView(
        businessId: "biz-roost",
        preview: EditBusinessPageSampleData.publishedRoostCafe
    ) {}
}

#Preview("Setup") {
    EditBusinessPageView(
        businessId: "biz-patch-paw",
        preview: EditBusinessPageSampleData.setupPatchAndPaw
    ) {}
}
