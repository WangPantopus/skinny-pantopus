//
//  ListingComposeWizardViewModel+Chrome.swift
//  Pantopus
//
//  Derived wizard chrome and validation state for listing compose.
//

import Foundation

extension ListingComposeWizardViewModel {
    var chrome: WizardChrome {
        let step = currentStep
        return WizardChrome(
            title: isEditMode ? "Edit listing" : "List an item",
            progressLabel: progressLabel(for: step),
            progressFraction: progressFraction(for: step),
            leading: leadingControl(for: step),
            primaryCTALabel: primaryCTALabel(for: step),
            primaryCTAEnabled: primaryEnabled(for: step) && !isSubmitting && !isLoadingExisting && !isAnalyzing,
            secondaryCTA: secondaryCTA(for: step),
            isSubmitting: isSubmitting,
            dirty: dirtyForCloseConfirm,
            showsProgressBar: step != .success
        )
    }

    var currentStep: ListingComposeStep {
        ListingComposeStep(rawValue: form.step) ?? .photos
    }

    /// Hero photo for the review summary + step-1 chip rendering.
    var heroPhoto: ListingComposePhoto? {
        form.photos.first
    }

    var isCameraCaptureStep: Bool {
        !isEditMode && currentStep == .photos && form.entryMode == .snap
    }

    var isSnapReviewStep: Bool {
        !isEditMode && currentStep == .titleCategory && form.entryMode == .snap
    }

    var snapCaptureProgressText: String {
        let captured = min(form.photos.count, ListingComposeFormState.targetCaptureAngles)
        let remaining = max(0, ListingComposeFormState.targetCaptureAngles - captured)
        if remaining == 0 { return "\(captured) of 4 angles · ready to review" }
        return "\(captured) of 4 angles · add \(remaining) more"
    }

    var snapCoachingText: String {
        switch form.photos.count {
        case 0: "Center the whole item · step back a bit"
        case 1: "Get a wider shot for scale"
        case 2: "Move closer for fabric and wear"
        default: "Looks great — capture now"
        }
    }

    /// Numeric value parsed from `priceAmount`, or nil when unparseable.
    var parsedPrice: Double? {
        guard !form.priceAmount.isEmpty else { return nil }
        return Double(form.priceAmount)
    }

    func leadingControl(for step: ListingComposeStep) -> WizardLeadingControl {
        switch step {
        case .photos, .success: .close
        default: .back
        }
    }

    var trimmedTitle: String {
        form.title.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    var trimmedDescription: String {
        form.bodyText.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    var isTitleValid: Bool {
        let length = trimmedTitle.count
        return length >= ListingComposeFormState.titleMinLength
            && length <= ListingComposeFormState.titleMaxLength
    }

    var isDescriptionValid: Bool {
        let length = trimmedDescription.count
        return length >= ListingComposeFormState.descriptionMinLength
            && length <= ListingComposeFormState.descriptionMaxLength
    }

    /// Condition is mandatory unless the category is Wanted, which is a
    /// request and so has no condition to report.
    var conditionSatisfied: Bool {
        guard let category = form.category else { return false }
        return !category.requiresCondition || form.condition != nil
    }

    var isPriceValid: Bool {
        guard let kind = form.priceKind else { return false }
        switch kind {
        case .free: return true
        case .fixed, .negotiable:
            guard let value = parsedPrice else { return false }
            return value > 0
        }
    }

    private func progressLabel(for step: ListingComposeStep) -> WizardProgressLabel {
        if !isEditMode && form.entryMode == .snap && (step == .photos || step == .titleCategory) {
            return .stepOf(current: 1, total: 3)
        }
        if let stepNumber = step.stepNumber {
            return .stepOf(current: stepNumber, total: ListingComposeStep.progressTotal)
        }
        return .hidden
    }

    private func progressFraction(for step: ListingComposeStep) -> Double? {
        if !isEditMode && form.entryMode == .snap && (step == .photos || step == .titleCategory) {
            return 1.0 / 3.0
        }
        guard let stepNumber = step.stepNumber else { return nil }
        return Double(stepNumber) / Double(ListingComposeStep.progressTotal)
    }

    private func primaryCTALabel(for step: ListingComposeStep) -> String {
        switch step {
        case .photos: isCameraCaptureStep ? "Review suggestions" : "Continue"
        case .titleCategory: isSnapReviewStep ? "Post listing" : "Continue"
        case .conditionDescription, .price, .location: "Continue"
        case .review: isEditMode ? "Save changes" : "List it"
        case .success: isEditMode ? "Back to listing" : "View listing"
        }
    }

    private func secondaryCTA(for step: ListingComposeStep) -> WizardSecondaryCTA? {
        if isSnapReviewStep {
            return WizardSecondaryCTA(
                label: "Save draft",
                identifier: "listingComposeSaveDraft"
            )
        }
        guard step == .success else { return nil }
        if isEditMode {
            return WizardSecondaryCTA(
                label: "Done",
                identifier: "listingComposeEditDone"
            )
        }
        return WizardSecondaryCTA(
            label: "Back to Marketplace",
            identifier: "listingComposeBackToMarketplace"
        )
    }

    private func primaryEnabled(for step: ListingComposeStep) -> Bool {
        switch step {
        case .photos:
            !form.photos.isEmpty
        case .titleCategory:
            if isSnapReviewStep {
                !form.photos.isEmpty
                    && isTitleValid
                    && form.category != nil
                    && conditionSatisfied
                    && isPriceValid
                    && form.locationKind != nil
            } else {
                isTitleValid && form.category != nil
            }
        case .conditionDescription:
            isDescriptionValid && conditionSatisfied
        case .price:
            isPriceValid
        case .location:
            form.locationKind != nil
        case .review:
            true
        case .success:
            createdListingId != nil
        }
    }

    private var dirtyForCloseConfirm: Bool {
        guard currentStep != .success else { return false }
        // Edit mode is always dirty pre-success — the user already had a
        // listing's state loaded so even "no fields changed" should warn
        // before discarding.
        if isEditMode { return true }
        return !form.photos.isEmpty
            || !form.title.isEmpty
            || !form.bodyText.isEmpty
    }
}
