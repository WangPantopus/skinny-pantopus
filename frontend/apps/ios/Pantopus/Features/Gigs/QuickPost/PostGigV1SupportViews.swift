//
//  PostGigV1SupportViews.swift
//  Pantopus
//
//  Shared support states for the A13.8 V1 single-screen gig composer.
//

// swiftlint:disable file_length

import SwiftUI

struct PostGigV1ErrorBanner: View {
    let errors: [PostGigV1ValidationError]

    private var heading: String {
        "\(errors.count) problem\(errors.count == 1 ? "" : "s") — please fix"
    }

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.s3) {
            Icon(.alertTriangle, size: 12, color: Theme.Color.appTextInverse)
                .frame(width: 22, height: 22)
                .background(Theme.Color.error)
                .clipShape(Circle())
                .padding(.top, 1)
            VStack(alignment: .leading, spacing: Spacing.s1) {
                Text(heading)
                    .pantopusTextStyle(.small)
                    .fontWeight(.bold)
                    .foregroundStyle(Theme.Color.error)
                Text("We couldn't post your gig. See the highlighted fields below.")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.error)
            }
            Spacer(minLength: Spacing.s0)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2 + 2)
        .background(Theme.Color.errorBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.errorLight, lineWidth: 1)
        )
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(heading). \(errors.map(\.message).joined(separator: " "))")
        .accessibilityIdentifier("postGigV1_errorBanner")
    }
}

struct PostGigV1InlineError: View {
    let message: String

    var body: some View {
        HStack(spacing: Spacing.s1) {
            Icon(.alertCircle, size: 11, color: Theme.Color.error)
            Text(message)
                .font(.system(size: 11, weight: .regular))
                .foregroundStyle(Theme.Color.error)
        }
        .accessibilityElement(children: .combine)
    }
}

struct PostGigV1FieldLabel: View {
    let title: String
    let required: Bool

    init(_ title: String, required: Bool) {
        self.title = title
        self.required = required
    }

    var body: some View {
        HStack(spacing: 2) {
            Text(title)
                .pantopusTextStyle(.caption)
                .fontWeight(.semibold)
                .foregroundStyle(Theme.Color.appTextStrong)
            if required {
                Text("*")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.error)
                    .accessibilityHidden(true)
            }
        }
        .accessibilityLabel(required ? "\(title), required" : title)
    }
}

/// 4-up photo grid riding the real upload pipeline: per-tile state
/// chrome, dashed "+ Add" tile, cover badge on the first photo, and the
/// design's italic helper captions.
struct PostGigV1PhotosGrid: View {
    let photos: [PostGigV1Photo]
    let canAdd: Bool
    let onAdd: () -> Void
    let onRetry: (String) -> Void
    let onRemove: (String) -> Void

    private let columns = Array(repeating: GridItem(.flexible(), spacing: Spacing.s2), count: 4)

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(spacing: Spacing.s1) {
                PostGigV1FieldLabel("Photos", required: false)
                Text("(up to \(PostGigV1SampleData.maxPhotos))")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
            LazyVGrid(columns: columns, spacing: Spacing.s2) {
                ForEach(Array(photos.enumerated()), id: \.element.id) { index, photo in
                    PostGigV1PhotoTile(
                        photo: photo,
                        isCover: index == 0,
                        onRetry: { onRetry(photo.id) },
                        onRemove: { onRemove(photo.id) }
                    )
                }
                if canAdd {
                    Button(action: onAdd) {
                        VStack(spacing: Spacing.s1) {
                            Icon(.plus, size: 18, color: Theme.Color.appTextSecondary)
                            Text("Add")
                                .pantopusTextStyle(.caption)
                                .fontWeight(.semibold)
                                .foregroundStyle(Theme.Color.appTextSecondary)
                        }
                        .frame(maxWidth: .infinity)
                        .aspectRatio(1, contentMode: .fit)
                        .background(Theme.Color.appSurfaceMuted)
                        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                                .stroke(Theme.Color.appBorderStrong, style: StrokeStyle(lineWidth: 1.5, dash: [4, 4]))
                        )
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Add photo")
                    .accessibilityIdentifier("postGigV1_addPhoto")
                }
            }
            Text(photos.isEmpty
                ? "Photos help your gig get picked up faster."
                : "First photo is the cover. Tap × to remove.")
                .font(.system(size: 11, weight: .regular))
                .italic()
                .foregroundStyle(Theme.Color.appTextSecondary)
                .accessibilityIdentifier("postGigV1_photoHint")
        }
    }
}

/// One grid tile — uploading spinner / failed tap-to-retry / uploaded
/// thumbnail (first tile carries the "Cover" badge). Mirrors the V2
/// wizard's `GigPhotoTile` states.
struct PostGigV1PhotoTile: View {
    let photo: PostGigV1Photo
    let isCover: Bool
    let onRetry: () -> Void
    let onRemove: () -> Void

    var body: some View {
        ZStack(alignment: .topTrailing) {
            tileBody
                .aspectRatio(1, contentMode: .fit)
                .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                        .stroke(Theme.Color.appBorder, lineWidth: 1)
                )

            if isCover {
                Text("Cover")
                    .pantopusTextStyle(.overline)
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
                    .padding(.horizontal, Spacing.s1)
                    .padding(.vertical, 2)
                    .background(Theme.Color.appText.opacity(0.78))
                    .clipShape(RoundedRectangle(cornerRadius: Radii.xs, style: .continuous))
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                    .padding(Spacing.s1)
                    .accessibilityHidden(true)
            }

            Button(action: onRemove) {
                Icon(.x, size: 12, color: Theme.Color.appTextInverse)
                    .frame(width: 24, height: 24)
                    .background(Theme.Color.appText.opacity(0.72))
                    .clipShape(Circle())
            }
            .buttonStyle(.plain)
            .padding(5)
            .accessibilityLabel(isCover ? "Remove cover photo" : "Remove photo")
            .accessibilityIdentifier("postGigV1_removePhoto_\(photo.id)")
        }
        .accessibilityLabel(statusAccessibilityText)
    }

    @ViewBuilder private var tileBody: some View {
        switch photo.status {
        case .uploading:
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .fill(Theme.Color.appSurfaceSunken)
                .overlay(ProgressView().tint(Theme.Color.primary600))
        case .failed:
            Button(action: onRetry) {
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .fill(Theme.Color.errorBg)
                    .overlay(
                        VStack(spacing: 2) {
                            Icon(.alertCircle, size: 16, color: Theme.Color.error)
                            Text("Retry")
                                .font(.system(size: 9, weight: .bold))
                                .foregroundStyle(Theme.Color.error)
                        }
                    )
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("postGigV1_retryPhoto_\(photo.id)")
        case let .uploaded(url):
            if let uiImage = UIImage(data: photo.imageData) {
                Image(uiImage: uiImage)
                    .resizable()
                    .scaledToFill()
            } else {
                // Edit-mode prefill carries no bytes — fetch the stored
                // attachment URL, glyph placeholder while it loads.
                AsyncImage(url: URL(string: url)) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                        .fill(Theme.Color.primary50)
                        .overlay(Icon(.image, size: 20, color: Theme.Color.primary600))
                }
            }
        }
    }

    private var statusAccessibilityText: String {
        switch photo.status {
        case .uploading: "Photo, uploading"
        case .failed: "Photo, upload failed, tap to retry"
        case .uploaded: isCover ? "Cover photo, uploaded" : "Photo, uploaded"
        }
    }
}

// MARK: - A13.8 P5 — the rest of RN's editable field set

/// `cancellation_policy` picker — one card per policy with the backend's
/// own blurb (`gigs.js:541`), so the poster sees the real fee rule.
struct PostGigV1CancellationPolicyField: View {
    let selected: PostGigV1CancellationPolicy
    let onSelect: (PostGigV1CancellationPolicy) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            PostGigV1FieldLabel("Cancellation policy", required: false)
            ForEach(PostGigV1CancellationPolicy.allCases) { policy in
                Button {
                    onSelect(policy)
                } label: {
                    HStack(alignment: .top, spacing: Spacing.s2) {
                        Circle()
                            .stroke(
                                policy == selected ? Theme.Color.primary600 : Theme.Color.appBorderStrong,
                                lineWidth: policy == selected ? 5 : 1.5
                            )
                            .frame(width: 18, height: 18)
                            .padding(.top, 2)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(policy.label)
                                .pantopusTextStyle(.caption)
                                .fontWeight(policy == selected ? .semibold : .medium)
                                .foregroundStyle(Theme.Color.appText)
                            Text(policy.blurb)
                                .font(.system(size: 11, weight: .regular))
                                .foregroundStyle(Theme.Color.appTextSecondary)
                                .multilineTextAlignment(.leading)
                        }
                        Spacer(minLength: Spacing.s0)
                    }
                    .frame(minHeight: 44)
                    .padding(.horizontal, Spacing.s3)
                    .padding(.vertical, Spacing.s2)
                    .background(policy == selected ? Theme.Color.primary50 : Theme.Color.appSurface)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                            .stroke(
                                policy == selected ? Theme.Color.primary600 : Theme.Color.appBorder,
                                lineWidth: 1
                            )
                    )
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(policy == selected ? [.isSelected] : [])
                .accessibilityIdentifier("postGigV1_cancellationPolicy_\(policy.rawValue)")
            }
        }
    }
}

/// `is_urgent` toggle — RN's "urgent" checkbox.
struct PostGigV1UrgentToggle: View {
    @Binding var isOn: Bool

    var body: some View {
        Toggle(isOn: $isOn) {
            VStack(alignment: .leading, spacing: 2) {
                Text("Mark as urgent")
                    .pantopusTextStyle(.caption)
                    .fontWeight(.semibold)
                    .foregroundStyle(Theme.Color.appText)
                Text("Surfaces the task in the urgent feed and unlocks the live status stepper.")
                    .font(.system(size: 11, weight: .regular))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
        }
        .tint(Theme.Color.primary600)
        .frame(minHeight: 44)
        .accessibilityIdentifier("postGigV1_isUrgent")
    }
}

/// Optional `deadline` — off by default; enabling reveals the picker.
/// `Joi.date().iso().min('now')` has no `allow(null)`, so once a
/// deadline exists the editor can move it but not clear it.
struct PostGigV1DeadlineField: View {
    let deadline: Date?
    let onChange: (Date?) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Toggle(isOn: Binding(
                get: { deadline != nil },
                set: { onChange($0 ? (deadline ?? Date().addingTimeInterval(172_800)) : nil) }
            )) {
                Text("Set a deadline")
                    .pantopusTextStyle(.caption)
                    .fontWeight(.semibold)
                    .foregroundStyle(Theme.Color.appText)
            }
            .tint(Theme.Color.primary600)
            .frame(minHeight: 44)
            .accessibilityIdentifier("postGigV1_deadlineToggle")

            if let deadline {
                HStack(spacing: Spacing.s3) {
                    Icon(.calendarClock, size: 16, color: Theme.Color.appTextSecondary)
                    DatePicker(
                        "Deadline",
                        selection: Binding(get: { deadline }, set: { onChange($0) }),
                        displayedComponents: [.date, .hourAndMinute]
                    )
                    .labelsHidden()
                    .datePickerStyle(.compact)
                    .tint(Theme.Color.primary600)
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .frame(minHeight: 44)
                .padding(.horizontal, Spacing.s3)
                .background(Theme.Color.appSurface)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .stroke(Theme.Color.appBorder, lineWidth: 1)
                )
                .accessibilityIdentifier("postGigV1_deadline")
            }
        }
    }
}

/// Errand / shopping line items (`items[]`) — add / edit / remove.
struct PostGigV1ItemsField: View {
    let items: [PostGigV1Item]
    let canAdd: Bool
    let onAdd: () -> Void
    let onUpdate: (PostGigV1Item) -> Void
    let onRemove: (String) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(spacing: Spacing.s1) {
                PostGigV1FieldLabel("Items to pick up", required: false)
                Text("(up to \(PostGigV1SampleData.maxItems))")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
            if items.isEmpty {
                Text("Add a shopping or errand list so your helper knows exactly what to get.")
                    .font(.system(size: 11, weight: .regular))
                    .italic()
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .accessibilityIdentifier("postGigV1_itemsHint")
            }
            ForEach(items) { item in
                itemCard(item)
            }
            if canAdd {
                Button(action: onAdd) {
                    HStack(spacing: Spacing.s1) {
                        Icon(.plus, size: 14, strokeWidth: 2.4, color: Theme.Color.primary600)
                        Text("Add item")
                            .pantopusTextStyle(.caption)
                            .fontWeight(.semibold)
                            .foregroundStyle(Theme.Color.primary600)
                    }
                    .frame(maxWidth: .infinity)
                    .frame(minHeight: 44)
                    .background(Theme.Color.primary50)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("postGigV1_addItem")
            }
        }
    }

    private func itemCard(_ item: PostGigV1Item) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(spacing: Spacing.s2) {
                Text("Item")
                    .pantopusTextStyle(.caption)
                    .fontWeight(.semibold)
                    .foregroundStyle(Theme.Color.appTextStrong)
                Spacer()
                Button {
                    onRemove(item.id)
                } label: {
                    Icon(.x, size: 14, strokeWidth: 2.4, color: Theme.Color.error)
                        .frame(width: 28, height: 28)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Remove item")
                .accessibilityIdentifier("postGigV1_removeItem_\(item.id)")
            }
            field("Name", text: item.name, identifier: "postGigV1_itemName_\(item.id)") { value in
                var copy = item
                copy.name = value
                onUpdate(copy)
            }
            field("Notes", text: item.notes, identifier: "postGigV1_itemNotes_\(item.id)") { value in
                var copy = item
                copy.notes = value
                onUpdate(copy)
            }
            field("Budget cap", text: item.budgetCap, identifier: "postGigV1_itemBudget_\(item.id)") { value in
                var copy = item
                copy.budgetCap = value
                onUpdate(copy)
            }
            field("Preferred store", text: item.preferredStore, identifier: "postGigV1_itemStore_\(item.id)") { value in
                var copy = item
                copy.preferredStore = value
                onUpdate(copy)
            }
        }
        .padding(Spacing.s3)
        .background(Theme.Color.appSurfaceMuted)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
    }

    private func field(
        _ label: String,
        text: String,
        identifier: String,
        onChange: @escaping (String) -> Void
    ) -> some View {
        TextField(label, text: Binding(get: { text }, set: onChange))
            .font(Theme.Font.small)
            .foregroundStyle(Theme.Color.appText)
            .frame(minHeight: 40)
            .padding(.horizontal, Spacing.s3)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.sm, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.sm, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .accessibilityLabel(label)
            .accessibilityIdentifier(identifier)
    }
}

struct PostGigV1LegacyStamp: View {
    var body: some View {
        HStack(spacing: Spacing.s1) {
            Icon(.info, size: 11, color: Theme.Color.appTextMuted)
            Text("gig composer · v1.4.2")
                .font(.system(size: 10.5, weight: .regular, design: .monospaced))
                .foregroundStyle(Theme.Color.appTextMuted)
        }
        .frame(maxWidth: .infinity)
        .padding(.bottom, Spacing.s2)
        .accessibilityIdentifier("postGigV1_legacyStamp")
    }
}

struct PostGigV1LoadingView: View {
    var body: some View {
        ForEach(
            ["Category", "Details", "Pay", "When", "Photos", "More details", "Items", "Cancellation"],
            id: \.self
        ) { title in
            FormFieldGroup(title) {
                VStack(spacing: Spacing.s3) {
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .fill(Theme.Color.appSurfaceSunken)
                        .frame(height: 44)
                    if title == "Details" {
                        RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                            .fill(Theme.Color.appSurfaceSunken)
                            .frame(height: 108)
                    }
                }
                .accessibilityHidden(true)
            }
        }
    }
}

struct PostGigV1EmptyView: View {
    let onStart: () -> Void

    var body: some View {
        VStack(spacing: Spacing.s3) {
            Icon(.briefcase, size: 30, color: Theme.Color.primary600)
                .frame(width: 72, height: 72)
                .background(Theme.Color.primary50)
                .clipShape(Circle())
            Text("No quick-post draft")
                .pantopusTextStyle(.h3)
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)
            Text("Start with the V1 form when you already know the title, price, and time.")
                .pantopusTextStyle(.small)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
            Button(action: onStart) {
                Text("Start quick post")
                    .pantopusTextStyle(.small)
                    .fontWeight(.bold)
                    .foregroundStyle(Theme.Color.appTextInverse)
                    .padding(.horizontal, Spacing.s5)
                    .frame(minHeight: 44)
                    .background(Theme.Color.primary600)
                    .clipShape(Capsule())
            }
            .accessibilityIdentifier("postGigV1_emptyStart")
        }
        .frame(maxWidth: .infinity)
        .padding(Spacing.s6)
        .accessibilityIdentifier("postGigV1_empty")
    }
}

struct PostGigV1FatalErrorView: View {
    let message: String
    let onRetry: () -> Void

    var body: some View {
        VStack(spacing: Spacing.s3) {
            Icon(.alertTriangle, size: 28, color: Theme.Color.error)
                .frame(width: 64, height: 64)
                .background(Theme.Color.errorBg)
                .clipShape(Circle())
            Text("Quick post unavailable")
                .pantopusTextStyle(.h3)
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)
            Text(message)
                .pantopusTextStyle(.small)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
            Button("Retry", action: onRetry)
                .foregroundStyle(Theme.Color.primary600)
                .frame(minHeight: 44)
                .accessibilityIdentifier("postGigV1_retry")
        }
        .frame(maxWidth: .infinity)
        .padding(Spacing.s6)
        .accessibilityIdentifier("postGigV1_error")
    }
}
