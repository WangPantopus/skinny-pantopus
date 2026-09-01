//
//  SuggestionsBanner.swift
//  Pantopus
//
//  A12.9 Snap-and-Sell review components: photo strip, AI suggestions
//  banner, editable suggested fields, comp-range track, condition
//  segmented control, and pickup / delivery toggles.
//

import PhotosUI
import SwiftUI

// swiftlint:disable file_length

struct ListingComposeSnapReviewStep: View {
    @Bindable var viewModel: ListingComposeWizardViewModel
    @State private var showsPhotosPicker = false
    @State private var photosPickerSelection: [PhotosPickerItem] = []

    private var remainingSlots: Int {
        max(0, ListingComposeFormState.maxPhotos - viewModel.form.photos.count)
    }

    var body: some View {
        ListingComposeIdentityChip()
        HeadlineBlock("Review your listing")
        SubcopyBlock(
            viewModel.aiDraftApplied
                ? "We pulled title, category, and price from your photos. Edit anything that looks off."
                : "Check your photos and fill in the details below."
        )
        ListingComposePhotoStrip(
            photos: viewModel.form.photos,
            canAddMore: remainingSlots > 0
        ) {
            showsPhotosPicker = true
        }
        .photosPicker(
            isPresented: $showsPhotosPicker,
            selection: $photosPickerSelection,
            maxSelectionCount: max(1, remainingSlots),
            matching: .images
        )
        .onChange(of: photosPickerSelection) { _, newItems in
            handleLibraryPicks(newItems)
        }
        SuggestionsBanner(
            aiApplied: viewModel.aiDraftApplied,
            basis: viewModel.form.priceSuggestion?.basis
        )
        SuggestedTitleField(viewModel: viewModel)
        SuggestedCategoryField(viewModel: viewModel)
        SuggestedPriceField(viewModel: viewModel)
        SuggestedConditionControl(viewModel: viewModel)
        PickupDeliveryPanel(viewModel: viewModel)
    }

    private func handleLibraryPicks(_ items: [PhotosPickerItem]) {
        guard !items.isEmpty else { return }
        Task {
            var loaded: [Data] = []
            for item in items.prefix(remainingSlots) {
                if let raw = try? await item.loadTransferable(type: Data.self),
                   let data = ListingPhotoProcessor.uploadData(from: raw) {
                    loaded.append(data)
                }
            }
            let images = loaded
            await MainActor.run {
                viewModel.addLibraryPhotos(images)
                photosPickerSelection = []
            }
        }
    }
}

private struct ListingComposeIdentityChip: View {
    var body: some View {
        HStack(spacing: Spacing.s1) {
            Icon(.user, size: 11, color: Theme.Color.personal)
            Text("Personal · You")
        }
        .font(.system(size: 10.5, weight: .bold))
        .foregroundStyle(Theme.Color.personal)
        .textCase(.uppercase)
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s1)
        .background(Theme.Color.personalBg)
        .clipShape(Capsule())
        .accessibilityIdentifier("listingComposeIdentityChip")
    }
}

private struct ListingComposePhotoStrip: View {
    let photos: [ListingComposePhoto]
    let canAddMore: Bool
    let onAddPhoto: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text("Photos · \(photos.count) of \(ListingComposeFormState.maxPhotos)")
                .pantopusTextStyle(.overline)
                .foregroundStyle(Theme.Color.appTextSecondary)
            PhotoStripGrid(photos: photos, canAddMore: canAddMore, onAddPhoto: onAddPhoto)
        }
        .accessibilityIdentifier("listingComposePhotoStrip")
    }
}

private struct PhotoStripGrid: View {
    let photos: [ListingComposePhoto]
    let canAddMore: Bool
    let onAddPhoto: () -> Void

    var body: some View {
        GeometryReader { proxy in
            let gap: CGFloat = 6
            let smallWidth = (proxy.size.width - gap * 3) / 4
            let heroWidth = smallWidth * 2 + gap
            HStack(spacing: gap) {
                PhotoStripTile(index: 0, photo: photos.first, isHero: true)
                    .frame(width: heroWidth, height: 168)
                VStack(spacing: gap) {
                    HStack(spacing: gap) {
                        PhotoStripTile(index: 1, photo: photo(at: 1))
                        PhotoStripTile(index: 2, photo: photo(at: 2))
                    }
                    HStack(spacing: gap) {
                        PhotoStripTile(index: 3, photo: photo(at: 3))
                        if canAddMore {
                            AddMorePhotoTile(onTap: onAddPhoto)
                        } else {
                            PhotoStripTile(index: 4, photo: photo(at: 4))
                        }
                    }
                }
                .frame(width: heroWidth, height: 168)
            }
        }
        .frame(height: 168)
    }

    private func photo(at index: Int) -> ListingComposePhoto? {
        photos.indices.contains(index) ? photos[index] : nil
    }
}

private struct PhotoStripTile: View {
    let index: Int
    let photo: ListingComposePhoto?
    var isHero = false

    var body: some View {
        Color.clear
            .overlay {
                if let photo {
                    ListingPhotoThumbnail(photo: photo)
                } else {
                    Rectangle()
                        .fill(Theme.Color.appSurfaceMuted)
                        .overlay(
                            Icon(.image, size: isHero ? 26 : 20, color: Theme.Color.appTextSecondary)
                        )
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: isHero ? Radii.xl : Radii.lg, style: .continuous))
            .overlay(alignment: .topLeading) {
                if isHero && photo != nil {
                    Text("Cover")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(.white)
                        .textCase(.uppercase)
                        .padding(.horizontal, Spacing.s2)
                        .padding(.vertical, 3)
                        .background(.black.opacity(0.56))
                        .clipShape(Capsule())
                        .padding(Spacing.s2)
                }
            }
            .overlay(
                RoundedRectangle(cornerRadius: isHero ? Radii.xl : Radii.lg, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .accessibilityIdentifier("listingComposeSnapPhoto_\(index)")
    }
}

private struct AddMorePhotoTile: View {
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .fill(Theme.Color.appSurfaceRaised)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                        .stroke(Theme.Color.appBorderStrong, style: StrokeStyle(lineWidth: 1, dash: [4, 4]))
                )
                .overlay {
                    VStack(spacing: 2) {
                        Icon(.plus, size: 18, color: Theme.Color.appTextSecondary)
                        Text("Add photo")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                }
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("listingComposeSnapAddPhoto")
        .accessibilityLabel("Add photo")
    }
}

struct SuggestionsBanner: View {
    let aiApplied: Bool
    let basis: String?

    var body: some View {
        HStack(spacing: Spacing.s3) {
            ZStack {
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .fill(Theme.Color.business)
                    .frame(width: 28, height: 28)
                Icon(.sparkles, size: 14, strokeWidth: 2.4, color: .white)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(aiApplied ? "Snap-and-sell suggested everything below" : "Add the details below")
                    .font(.system(size: 12.5, weight: .bold))
                    .foregroundStyle(Theme.Color.business)
                Text(subtitle)
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            Spacer(minLength: Spacing.s0)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, 10)
        .background(Theme.Color.businessBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.business.opacity(0.25), lineWidth: 1)
        )
        .accessibilityIdentifier("listingComposeSuggestionsBanner")
    }

    private var subtitle: String {
        if let basis, !basis.isEmpty {
            return "Tap any field to edit. Price based on \(basis)."
        }
        return "Tap any field to edit before you post."
    }
}

private struct SuggestedTitleField: View {
    @Bindable var viewModel: ListingComposeWizardViewModel

    var body: some View {
        SuggestedFieldShell(
            label: "Title",
            hint: viewModel.aiDraftApplied ? "Snap-and-sell pulled this from the photos" : nil,
            showsAIBadge: viewModel.aiDraftApplied
        ) {
            TextField(
                "What are you listing?",
                text: Binding(get: { viewModel.form.title }, set: { viewModel.setTitle($0) })
            )
            .font(.system(size: 14, weight: .semibold))
            .foregroundStyle(Theme.Color.appText)
            Icon(.pencil, size: 14, color: Theme.Color.appTextMuted)
        }
        .accessibilityIdentifier("listingComposeSnapTitle")
    }
}

private struct SuggestedCategoryField: View {
    @Bindable var viewModel: ListingComposeWizardViewModel

    var body: some View {
        SuggestedFieldShell(label: "Category", showsAIBadge: viewModel.aiDraftApplied) {
            HStack(spacing: Spacing.s2) {
                ForEach(ListingComposeCategory.allCases, id: \.self) { category in
                    CategoryChip(
                        category: category,
                        isSelected: viewModel.form.category == category
                    ) {
                        viewModel.setCategory(category)
                    }
                }
            }
        }
        .accessibilityIdentifier("listingComposeSnapCategory")
    }
}

private struct CategoryChip: View {
    let category: ListingComposeCategory
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(category.label)
                .font(.system(size: 11.5, weight: .bold))
                .foregroundStyle(isSelected ? Theme.Color.business : Theme.Color.appTextSecondary)
                .padding(.horizontal, Spacing.s2)
                .padding(.vertical, 7)
                .background(isSelected ? Theme.Color.businessBg : Theme.Color.appSurfaceRaised)
                .clipShape(Capsule())
                .overlay(
                    Capsule()
                        .stroke(isSelected ? Theme.Color.business : Theme.Color.appBorder, lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("listingComposeSnapCategory_\(category.rawValue)")
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }
}

private struct SuggestedPriceField: View {
    @Bindable var viewModel: ListingComposeWizardViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            SuggestedLabel(label: "Price", showsAIBadge: viewModel.aiDraftApplied)
            VStack(alignment: .leading, spacing: Spacing.s3) {
                HStack(alignment: .firstTextBaseline, spacing: Spacing.s1) {
                    Text("$")
                        .font(.system(size: 22, weight: .bold))
                    TextField(
                        "0",
                        text: Binding(get: { viewModel.form.priceAmount }, set: { viewModel.setPriceAmount($0) })
                    )
                    .font(.system(size: 28, weight: .bold))
                    .keyboardType(.decimalPad)
                    Spacer()
                    Text("USD")
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                if let suggestion = viewModel.form.priceSuggestion {
                    PriceCompRangeTrack(
                        suggestion: suggestion,
                        currentPrice: viewModel.parsedPrice
                    )
                }
            }
            .padding(Spacing.s3)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
        }
        .accessibilityIdentifier("listingComposeSnapPrice")
    }
}

private struct PriceCompRangeTrack: View {
    let suggestion: ListingComposePriceSuggestion
    let currentPrice: Double?

    /// Track domain pads the comp band so the thumb has room either
    /// side of the p25–p75 range.
    private var domain: ClosedRange<Double> {
        let pad = max((suggestion.high - suggestion.low) * 0.3, 1)
        return (suggestion.low - pad)...(suggestion.high + pad)
    }

    private func fraction(of value: Double) -> CGFloat {
        let span = domain.upperBound - domain.lowerBound
        guard span > 0 else { return 0.5 }
        let clamped = min(max(value, domain.lowerBound), domain.upperBound)
        return CGFloat((clamped - domain.lowerBound) / span)
    }

    var body: some View {
        VStack(spacing: Spacing.s2) {
            GeometryReader { proxy in
                let width = proxy.size.width
                let bandStart = width * fraction(of: suggestion.low)
                let bandWidth = max(width * fraction(of: suggestion.high) - bandStart, 6)
                let thumbX = width * fraction(of: currentPrice ?? suggestion.median)
                ZStack(alignment: .leading) {
                    Capsule()
                        .fill(Theme.Color.appSurfaceSunken)
                        .frame(height: 6)
                    Capsule()
                        .fill(Theme.Color.successLight)
                        .frame(width: bandWidth, height: 6)
                        .offset(x: bandStart)
                    Circle()
                        .fill(Theme.Color.primary600)
                        .frame(width: 12, height: 12)
                        .overlay(Circle().stroke(.white, lineWidth: 2))
                        .shadow(color: .black.opacity(0.18), radius: 4, x: 0, y: 1)
                        .offset(x: min(max(thumbX - 6, 0), width - 12))
                }
            }
            .frame(height: 12)
            HStack {
                Text("$\(Self.amount(suggestion.low)) low")
                Spacer()
                Text("$\(Self.amount(suggestion.median)) typical")
                    .fontWeight(.semibold)
                    .foregroundStyle(Theme.Color.success)
                Spacer()
                Text("$\(Self.amount(suggestion.high)) high")
            }
            .font(.system(size: 10.5))
            .foregroundStyle(Theme.Color.appTextSecondary)
        }
        .accessibilityIdentifier("listingComposeCompRange")
        .accessibilityLabel(rangeAccessibilityLabel)
    }

    private var rangeAccessibilityLabel: String {
        "Similar items sell between $\(Self.amount(suggestion.low)) and "
            + "$\(Self.amount(suggestion.high)), typically $\(Self.amount(suggestion.median))"
    }

    private static func amount(_ value: Double) -> String {
        ListingComposeWizardViewModel.formatAmount(value)
    }
}

private struct SuggestedConditionControl: View {
    @Bindable var viewModel: ListingComposeWizardViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text("Condition")
                .pantopusTextStyle(.overline)
                .foregroundStyle(Theme.Color.appTextSecondary)
            HStack(spacing: Spacing.s1) {
                ForEach(ListingComposeCondition.allCases, id: \.self) { condition in
                    Button {
                        viewModel.setCondition(condition)
                    } label: {
                        Text(shortLabel(for: condition))
                            .font(.system(size: 11.5, weight: .bold))
                            .foregroundStyle(viewModel.form.condition == condition ? Theme.Color.primary700 : Theme.Color.appTextStrong)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 9)
                            .background(viewModel.form.condition == condition ? Theme.Color.primary50 : Theme.Color.appSurface)
                            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                            .overlay(
                                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                                    .stroke(
                                        viewModel.form.condition == condition ? Theme.Color.primary600 : Theme.Color.appBorder,
                                        lineWidth: viewModel.form.condition == condition ? 1.5 : 1
                                    )
                            )
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("listingComposeSnapCondition_\(condition.rawValue)")
                }
            }
            Text("Add wear notes in the description so buyers know what to expect.")
                .font(.system(size: 11))
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
    }

    private func shortLabel(for condition: ListingComposeCondition) -> String {
        switch condition {
        case .new: "New"
        case .likeNew: "Like new"
        case .good: "Good"
        case .fair: "Fair"
        case .forParts: "Parts"
        }
    }
}

private struct PickupDeliveryPanel: View {
    @Bindable var viewModel: ListingComposeWizardViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text("Pickup & delivery")
                .pantopusTextStyle(.overline)
                .foregroundStyle(Theme.Color.appTextSecondary)
            VStack(spacing: Spacing.s0) {
                Button {
                    let next: ListingComposeLocationKind =
                        viewModel.form.locationKind == .meetPoint ? .savedAddress : .meetPoint
                    viewModel.setLocationKind(next)
                } label: {
                    HStack(spacing: Spacing.s3) {
                        ZStack {
                            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                                .fill(Theme.Color.primary50)
                                .frame(width: 28, height: 28)
                            Icon(.mapPin, size: 14, color: Theme.Color.primary600)
                        }
                        VStack(alignment: .leading, spacing: 2) {
                            Text(locationTitle)
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(Theme.Color.appText)
                            Text("Shown as approximate location to buyers")
                                .font(.system(size: 11))
                                .foregroundStyle(Theme.Color.appTextSecondary)
                        }
                        Spacer()
                        Icon(.chevronRight, size: 14, color: Theme.Color.appTextMuted)
                    }
                    .padding(Spacing.s3)
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("listingComposeSnapLocation")
                if viewModel.form.locationKind == .meetPoint {
                    PantopusTextField(
                        "Meet point name",
                        text: Binding(
                            get: { viewModel.form.locationLabel },
                            set: { viewModel.setLocationLabel($0) }
                        ),
                        placeholder: "Lincoln Park bandshell",
                        identifier: "listingComposeSnapLocationLabel"
                    )
                    .padding(.horizontal, Spacing.s3)
                    .padding(.bottom, Spacing.s3)
                }
                Divider()
                VStack(spacing: Spacing.s2) {
                    FulfillmentToggleRow(
                        icon: .handCoins,
                        title: "Local pickup",
                        subtitle: "Buyers come to you",
                        isOn: viewModel.form.fulfillment == .pickup
                    ) {
                        viewModel.setFulfillment(.pickup)
                    }
                    FulfillmentToggleRow(
                        icon: .package,
                        title: "Local delivery",
                        subtitle: "You drop off nearby",
                        isOn: viewModel.form.deliveryEnabled
                    ) {
                        viewModel.setDeliveryEnabled(!viewModel.form.deliveryEnabled)
                    }
                    FulfillmentToggleRow(
                        icon: .package,
                        title: "Ship nationwide",
                        subtitle: "Coming soon",
                        isOn: false,
                        isDisabled: true
                    ) {}
                }
                .padding(Spacing.s3)
            }
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
        }
        .accessibilityIdentifier("listingComposePickupDelivery")
    }

    private var locationTitle: String {
        switch viewModel.form.locationKind {
        case .meetPoint:
            viewModel.form.locationLabel.isEmpty
                ? "Pick a meet point"
                : viewModel.form.locationLabel
        case .savedAddress, nil:
            "Your saved address"
        }
    }
}

private struct FulfillmentToggleRow: View {
    let icon: PantopusIcon
    let title: String
    let subtitle: String
    let isOn: Bool
    var isDisabled = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Spacing.s3) {
                Icon(icon, size: 15, color: Theme.Color.appTextSecondary)
                VStack(alignment: .leading, spacing: 1) {
                    Text(title)
                        .font(.system(size: 12.5, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                    Text(subtitle)
                        .font(.system(size: 10.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                Spacer()
                TogglePill(isOn: isOn)
            }
            .opacity(isDisabled ? 0.55 : 1)
        }
        .disabled(isDisabled)
        .buttonStyle(.plain)
    }
}

private struct TogglePill: View {
    let isOn: Bool

    var body: some View {
        Capsule()
            .fill(isOn ? Theme.Color.primary600 : Theme.Color.appBorderStrong)
            .frame(width: 32, height: 18)
            .overlay(alignment: isOn ? .trailing : .leading) {
                Circle()
                    .fill(.white)
                    .frame(width: 14, height: 14)
                    .padding(2)
                    .shadow(color: .black.opacity(0.18), radius: 2, x: 0, y: 1)
            }
    }
}

private struct SuggestedFieldShell<Content: View>: View {
    let label: String
    var hint: String?
    var showsAIBadge: Bool = true
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            SuggestedLabel(label: label, showsAIBadge: showsAIBadge)
            HStack(spacing: Spacing.s2) {
                content
            }
            .padding(.horizontal, Spacing.s3)
            .frame(minHeight: 44)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            if let hint {
                Text(hint)
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
        }
    }
}

private struct SuggestedLabel: View {
    let label: String
    var showsAIBadge: Bool = true

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(label)
                .font(.system(size: 10.5, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .textCase(.uppercase)
            Spacer()
            if showsAIBadge {
                HStack(spacing: 3) {
                    Icon(.sparkles, size: 10, color: Theme.Color.business)
                    Text("AI suggested")
                        .font(.system(size: 10, weight: .semibold))
                }
                .foregroundStyle(Theme.Color.business)
            }
        }
    }
}
