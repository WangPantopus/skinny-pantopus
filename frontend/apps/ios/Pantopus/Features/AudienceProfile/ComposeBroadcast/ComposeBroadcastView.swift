//
//  ComposeBroadcastView.swift
//  Pantopus
//
//  A.7 (A22.2) Compose Broadcast — full-screen broadcast composer
//  pushed from the Audience Profile. No bottom tab bar; a sticky action
//  bar carries Save draft + Send. Top to bottom: 52pt top bar (close /
//  title + unsaved-draft chip / Save) → composer card → schedule row →
//  recent broadcasts (or first-broadcast prompt) → sticky actions.
//

// swiftlint:disable file_length type_body_length

import PhotosUI
import SwiftUI
import UniformTypeIdentifiers

public struct ComposeBroadcastView: View {
    @State private var viewModel: ComposeBroadcastViewModel
    @State private var showsAudienceSheet = false
    @State private var showsScheduleSheet = false
    @State private var showsPlacePicker = false
    @State private var showsPhotosPicker = false
    @State private var photoSelections: [PhotosPickerItem] = []
    @State private var scheduleDraftDate = Date()

    private let onClose: @MainActor () -> Void

    public init(
        viewModel: ComposeBroadcastViewModel,
        onClose: @escaping @MainActor () -> Void = {}
    ) {
        _viewModel = State(initialValue: viewModel)
        self.onClose = onClose
    }

    public var body: some View {
        VStack(spacing: Spacing.s0) {
            topBar
            scrollBody
        }
        .background(Theme.Color.appBg)
        .toolbar(.hidden, for: .tabBar)
        .task { await viewModel.load() }
        // Multi-select up to the remaining slots — RN parity
        // (`pickPostMediaFromLibrary(9 - mediaFiles.length)`).
        .photosPicker(
            isPresented: $showsPhotosPicker,
            selection: $photoSelections,
            maxSelectionCount: max(1, viewModel.remainingMediaSlots),
            matching: .any(of: [.images, .videos])
        )
        .onChange(of: photoSelections) { _, newValue in
            handlePicked(newValue)
        }
        .sheet(isPresented: $showsAudienceSheet) { audienceSheet }
        .sheet(isPresented: $showsScheduleSheet) { scheduleSheet }
        .sheet(isPresented: $showsPlacePicker) {
            PlacePickerSheet(
                currentTag: viewModel.selectedPlaceTag,
                mediaLocation: viewModel.mediaCaptureLocation,
                onSelect: { tag in
                    viewModel.selectPlaceTag(tag)
                    showsPlacePicker = false
                },
                onRemove: {
                    viewModel.clearPlaceTag()
                    showsPlacePicker = false
                },
                onDismiss: { showsPlacePicker = false }
            )
            .presentationDetents([.medium, .large])
            .presentationDragIndicator(.visible)
        }
        .accessibilityIdentifier("composeBroadcast")
    }

    // MARK: - Top bar

    private var topBar: some View {
        HStack(spacing: Spacing.s0) {
            Button(action: onClose) {
                Icon(.x, size: 22, color: Theme.Color.appText)
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Close")
            .accessibilityIdentifier("composeBroadcastClose")

            Spacer(minLength: Spacing.s0)

            VStack(spacing: 1) {
                Text("Compose broadcast")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                    .accessibilityAddTraits(.isHeader)
                if viewModel.isDirty {
                    unsavedDraftChip
                }
            }

            Spacer(minLength: Spacing.s0)

            Button(
                action: { viewModel.saveDraft() },
                label: {
                    Text("Save")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(viewModel.isDirty ? Theme.Color.primary600 : Theme.Color.appTextMuted)
                        .padding(.horizontal, Spacing.s2)
                        .frame(minWidth: 44, minHeight: 44)
                }
            )
            .buttonStyle(.plain)
            .disabled(!viewModel.isDirty)
            .accessibilityLabel("Save draft")
            .accessibilityIdentifier("composeBroadcastSaveTop")
        }
        .padding(.horizontal, Spacing.s1)
        .frame(height: 52)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
        }
    }

    private var unsavedDraftChip: some View {
        HStack(spacing: 5) {
            Circle().fill(Theme.Color.warning).frame(width: 5, height: 5)
            Text("Unsaved draft")
                .font(.system(size: 10))
                .foregroundStyle(Theme.Color.appTextMuted)
        }
        .accessibilityIdentifier("composeBroadcastUnsavedChip")
    }

    // MARK: - Scroll body

    private var scrollBody: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s4) {
                if case let .error(message) = viewModel.state {
                    errorBanner(message)
                }
                editor
                locationRow
                scheduleRow
                recentBroadcastsSection
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s3)
            .padding(.bottom, Spacing.s4)
        }
        .scrollDismissesKeyboard(.interactively)
        .overlay { if viewModel.isSending { sendingOverlay } }
        .safeAreaInset(edge: .bottom, spacing: Spacing.s0) { stickyActions }
        .accessibilityIdentifier("composeBroadcastScroll")
    }

    private var editor: some View {
        ComposeBroadcastEditor(
            persona: viewModel.persona,
            text: Binding(
                get: { viewModel.draft.body },
                set: { viewModel.updateBody($0) }
            ),
            media: viewModel.draft.media,
            audience: viewModel.draft.audience,
            audienceReach: viewModel.reach(for: viewModel.draft.audience),
            characterCount: viewModel.characterCount,
            maxCharacterCount: viewModel.maxCharacterCount,
            isOverLimit: viewModel.isOverLimit,
            placeholder: "What's worth sharing with your beacons today?",
            onAddMedia: { showsPhotosPicker = true },
            onRemoveMedia: { id in viewModel.removeMedia(id: id) },
            onChangeAudience: { showsAudienceSheet = true }
        )
    }

    // MARK: - Location row

    /// Instagram-style place tag — same shared picker as the Pulse
    /// composer. Row re-opens the picker; the trailing ✕ clears the tag.
    private var locationRow: some View {
        HStack(spacing: Spacing.s0) {
            Button { showsPlacePicker = true } label: {
                HStack(spacing: Spacing.s3) {
                    Icon(
                        .mapPin,
                        size: 15,
                        color: viewModel.selectedPlaceTag == nil
                            ? Theme.Color.appTextStrong
                            : Theme.Color.primary600
                    )
                    .frame(width: 30, height: 30)
                    .background(
                        viewModel.selectedPlaceTag == nil
                            ? Theme.Color.appSurfaceSunken
                            : Theme.Color.primary50
                    )
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))

                    VStack(alignment: .leading, spacing: 1) {
                        Text(viewModel.selectedPlaceTag?.name ?? "Add location")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(Theme.Color.appText)
                            .lineLimit(1)
                        Text(locationSubtitle)
                            .font(.system(size: 11))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                            .lineLimit(1)
                    }
                    Spacer(minLength: Spacing.s0)
                    if viewModel.selectedPlaceTag == nil {
                        Icon(.chevronRight, size: 14, color: Theme.Color.appTextMuted)
                    }
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(
                viewModel.selectedPlaceTag.map { "Change location, \($0.name)" } ?? "Add location"
            )
            .accessibilityIdentifier("composeBroadcastAddLocationRow")

            if viewModel.selectedPlaceTag != nil {
                Button { viewModel.clearPlaceTag() } label: {
                    Icon(.x, size: 16, color: Theme.Color.appTextSecondary)
                        .frame(width: 44, height: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Remove location")
                .accessibilityIdentifier("composeBroadcastClearLocationButton")
            }
        }
        .padding(.vertical, Spacing.s3)
        .padding(.leading, Spacing.s3)
        .padding(.trailing, viewModel.selectedPlaceTag == nil ? Spacing.s3 : Spacing.s0)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
    }

    private var locationSubtitle: String {
        guard let tag = viewModel.selectedPlaceTag else {
            return "Tag a place on this update"
        }
        return tag.address ?? "Tagged place"
    }

    // MARK: - Schedule row

    private var scheduleRow: some View {
        Button {
            scheduleDraftDate = viewModel.scheduledAt ?? defaultScheduleDate()
            showsScheduleSheet = true
        } label: {
            HStack(spacing: Spacing.s3) {
                Icon(
                    viewModel.scheduledAt == nil ? .send : .calendarClock,
                    size: 15,
                    color: viewModel.scheduledAt == nil ? Theme.Color.appTextStrong : Theme.Color.primary600
                )
                .frame(width: 30, height: 30)
                .background(viewModel.scheduledAt == nil ? Theme.Color.appSurfaceSunken : Theme.Color.primary50)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))

                VStack(alignment: .leading, spacing: 1) {
                    Text(scheduleTitle)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                    Text(viewModel.scheduledAt == nil ? "Tap to schedule for later" : "Pinned for 24h after send")
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                Spacer(minLength: Spacing.s0)
                Icon(.chevronRight, size: 14, color: Theme.Color.appTextMuted)
            }
            .padding(Spacing.s3)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(scheduleTitle)
        .accessibilityHint("Choose when to send this broadcast")
        .accessibilityIdentifier("composeBroadcastScheduleRow")
    }

    private var scheduleTitle: String {
        guard let sendAt = viewModel.scheduledAt else { return "Send now" }
        return "Scheduled · " + sendAt.formatted(date: .abbreviated, time: .shortened)
    }

    // MARK: - Recent broadcasts

    @ViewBuilder private var recentBroadcastsSection: some View {
        if viewModel.recentsLoading && !viewModel.hasRecentBroadcasts {
            recentsLoadingCard
        } else if let message = viewModel.recentsError, !viewModel.hasRecentBroadcasts {
            recentsErrorCard(message)
        } else if viewModel.hasRecentBroadcasts {
            VStack(alignment: .leading, spacing: Spacing.s2) {
                sectionHeader(title: "Last \(viewModel.recentBroadcasts.count) broadcasts")
                VStack(spacing: Spacing.s0) {
                    ForEach(Array(viewModel.recentBroadcasts.enumerated()), id: \.element.id) { offset, broadcast in
                        recentBroadcastRow(broadcast)
                        if offset < viewModel.recentBroadcasts.count - 1 {
                            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
                        }
                    }
                }
                .background(Theme.Color.appSurface)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                        .stroke(Theme.Color.appBorder, lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            }
            .accessibilityIdentifier("composeBroadcastRecentSection")
        } else {
            VStack(alignment: .leading, spacing: Spacing.s2) {
                sectionHeader(title: "Past broadcasts")
                firstBroadcastCard
                emptyAnalyticsStrip
            }
            .accessibilityIdentifier("composeBroadcastEmptySection")
        }
    }

    private var recentsLoadingCard: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            sectionHeader(title: "Recent broadcasts")
            VStack(spacing: Spacing.s2) {
                Shimmer(height: 84, cornerRadius: Radii.lg)
                Shimmer(height: 84, cornerRadius: Radii.lg)
            }
        }
        .accessibilityIdentifier("composeBroadcastRecentLoading")
    }

    private func recentsErrorCard(_ message: String) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            sectionHeader(title: "Recent broadcasts")
            VStack(alignment: .leading, spacing: Spacing.s2) {
                Text(message)
                    .font(.system(size: 12.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Button { Task { await viewModel.load() } } label: {
                    Text("Try again")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.Color.primary600)
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("composeBroadcastRecentRetry")
            }
            .padding(Spacing.s3)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        }
        .accessibilityIdentifier("composeBroadcastRecentError")
    }

    private func sectionHeader(title: String) -> some View {
        Text(title.uppercased())
            .font(.system(size: 10.5, weight: .bold))
            .kerning(0.6)
            .foregroundStyle(Theme.Color.appTextSecondary)
            .accessibilityAddTraits(.isHeader)
    }

    private func recentBroadcastRow(_ broadcast: RecentBroadcastContent) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(spacing: Spacing.s2) {
                Text(broadcast.timeLabel)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                recentTierChip(broadcast.audience)
                Spacer(minLength: Spacing.s0)
                Icon(.moreHorizontal, size: 14, color: Theme.Color.appTextMuted)
            }
            HStack(alignment: .top, spacing: Spacing.s2) {
                Text(broadcast.body)
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(3)
                    .frame(maxWidth: .infinity, alignment: .leading)
                if broadcast.hasMedia {
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .fill(Theme.Color.appSurfaceSunken)
                        .frame(width: 54, height: 54)
                        .overlay { Icon(.image, size: 16, color: Theme.Color.appTextMuted) }
                        .accessibilityHidden(true)
                }
            }
            recentStats(broadcast)
        }
        .padding(Spacing.s3)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(recentRowAccessibilityLabel(broadcast))
        .accessibilityIdentifier("composeBroadcastRecentRow_\(broadcast.id)")
    }

    private func recentStats(_ broadcast: RecentBroadcastContent) -> some View {
        HStack(spacing: Spacing.s1) {
            statItem(icon: .radioTower, value: broadcast.reach)
            statDivider
            HStack(spacing: 3) {
                Icon(.eye, size: 11, color: Theme.Color.appTextSecondary)
                Text(broadcast.read)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextStrong)
                Text(broadcast.readPct)
                    .font(.system(size: 10.5, weight: .bold))
                    .foregroundStyle(Theme.Color.success)
            }
            statDivider
            statItem(icon: .heart, value: broadcast.reactions)
            statDivider
            statItem(icon: .messageCircle, value: broadcast.replies)
            Spacer(minLength: Spacing.s0)
            Icon(.chevronRight, size: 12, color: Theme.Color.appTextMuted)
        }
    }

    private func statItem(icon: PantopusIcon, value: String) -> some View {
        HStack(spacing: 3) {
            Icon(icon, size: 11, color: Theme.Color.appTextSecondary)
            Text(value)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextStrong)
        }
    }

    private var statDivider: some View {
        Text("·").font(.system(size: 11)).foregroundStyle(Theme.Color.appTextMuted)
    }

    private func recentTierChip(_ audience: BroadcastAudience) -> some View {
        let accent = ComposeBroadcastEditor.audienceColor(audience)
        return HStack(spacing: 3) {
            Icon(audience.icon, size: 9, color: accent)
            Text(audience.title.uppercased())
                .font(.system(size: 9, weight: .bold))
                .kerning(0.3)
                .foregroundStyle(accent)
        }
        .padding(.horizontal, 6)
        .padding(.vertical, 2)
        .background(accent.opacity(0.12))
        .clipShape(Capsule())
        .accessibilityHidden(true)
    }

    private func recentRowAccessibilityLabel(_ broadcast: RecentBroadcastContent) -> String {
        "\(broadcast.timeLabel), \(broadcast.audience.title). \(broadcast.body). " +
            "Reach \(broadcast.reach), read \(broadcast.read) at \(broadcast.readPct), " +
            "\(broadcast.reactions) reactions, \(broadcast.replies) replies."
    }

    private var firstBroadcastCard: some View {
        VStack(spacing: Spacing.s2) {
            Icon(.send, size: 19, color: Theme.Color.primary600)
                .frame(width: 46, height: 46)
                .background(Theme.Color.primary50)
                .clipShape(Circle())
                .overlay(Circle().stroke(Theme.Color.primary100, lineWidth: 1))
            Text("Send your first broadcast")
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            Text("Stats — reach, read, reactions, replies — show here after you send.")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 240)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Spacing.s5)
        .padding(.horizontal, Spacing.s4)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorderStrong, style: StrokeStyle(lineWidth: 1, dash: [5, 4]))
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("composeBroadcastFirstBroadcastCard")
    }

    private var emptyAnalyticsStrip: some View {
        HStack(spacing: Spacing.s0) {
            ForEach(Array(["Reach", "Read", "React.", "Replies"].enumerated()), id: \.offset) { offset, label in
                VStack(spacing: 2) {
                    Text("—")
                        .font(.system(size: 16, weight: .bold))
                        .foregroundStyle(Theme.Color.appTextMuted)
                    Text(label.uppercased())
                        .font(.system(size: 9.5, weight: .semibold))
                        .kerning(0.3)
                        .foregroundStyle(Theme.Color.appTextMuted)
                }
                .frame(maxWidth: .infinity)
                .overlay(alignment: .trailing) {
                    if offset < 3 {
                        Rectangle().fill(Theme.Color.appBorder).frame(width: 1, height: 24)
                    }
                }
            }
        }
        .padding(.vertical, Spacing.s3)
        .padding(.horizontal, Spacing.s3)
        .background(Theme.Color.appSurfaceSunken)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .accessibilityHidden(true)
    }

    // MARK: - Sticky actions

    private var stickyActions: some View {
        HStack(spacing: Spacing.s2) {
            Button(
                action: { viewModel.saveDraft() },
                label: {
                    Text("Save draft")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(viewModel.isDirty ? Theme.Color.appTextStrong : Theme.Color.appTextMuted)
                        .padding(.horizontal, Spacing.s3)
                        .frame(minWidth: 96, minHeight: 44)
                        .background(Theme.Color.appSurface)
                        .overlay(
                            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                                .stroke(Theme.Color.appBorder, lineWidth: 1)
                        )
                        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                }
            )
            .buttonStyle(.plain)
            .disabled(!viewModel.isDirty)
            .accessibilityIdentifier("composeBroadcastSaveDraft")

            Button(
                action: { Task { await viewModel.send() } },
                label: {
                    HStack(spacing: Spacing.s1) {
                        if viewModel.isSending {
                            ProgressView().tint(Theme.Color.appTextInverse)
                        } else {
                            Icon(.send, size: 14, strokeWidth: 2.4, color: Theme.Color.appTextInverse)
                        }
                        Text(viewModel.primaryActionTitle)
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(Theme.Color.appTextInverse)
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 44)
                    .background(viewModel.canSend ? Theme.Color.primary600 : Theme.Color.appBorderStrong)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                }
            )
            .buttonStyle(.plain)
            .disabled(!viewModel.canSend)
            .accessibilityLabel(viewModel.primaryActionTitle)
            .accessibilityIdentifier("composeBroadcastSend")
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s3)
        .padding(.bottom, Spacing.s2)
        .background(
            Theme.Color.appSurface
                .overlay(alignment: .top) {
                    Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
                }
        )
        .accessibilityIdentifier("composeBroadcastStickyActions")
    }

    // MARK: - Sending / error chrome

    private var sendingOverlay: some View {
        ZStack {
            Theme.Color.appBg.opacity(0.6)
            VStack(spacing: Spacing.s2) {
                ProgressView().tint(Theme.Color.primary600)
                Text("Sending broadcast…")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
            }
            .padding(Spacing.s5)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        }
        .ignoresSafeArea()
        .accessibilityIdentifier("composeBroadcastSendingOverlay")
        .accessibilityLabel("Sending broadcast")
    }

    private func errorBanner(_ message: String) -> some View {
        HStack(spacing: Spacing.s2) {
            Icon(.alertCircle, size: 16, color: Theme.Color.error)
            Text(message)
                .font(.system(size: 12.5, weight: .medium))
                .foregroundStyle(Theme.Color.error)
                .frame(maxWidth: .infinity, alignment: .leading)
            Button("Dismiss") { viewModel.retry() }
                .font(.system(size: 12.5, weight: .semibold))
                .foregroundStyle(Theme.Color.error)
                .buttonStyle(.plain)
                .accessibilityIdentifier("composeBroadcastErrorDismiss")
        }
        .padding(Spacing.s3)
        .background(Theme.Color.errorBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("composeBroadcastErrorBanner")
    }

    // MARK: - Audience sheet

    private var audienceSheet: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            Text("Who can see this?")
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
                .padding(.horizontal, Spacing.s4)
                .padding(.top, Spacing.s4)
                .padding(.bottom, Spacing.s2)
                .accessibilityAddTraits(.isHeader)
            ForEach(BroadcastAudience.allCases) { audience in
                audienceRow(audience)
                if audience != BroadcastAudience.allCases.last {
                    Rectangle()
                        .fill(Theme.Color.appBorderSubtle)
                        .frame(height: 1)
                        .padding(.leading, Spacing.s4)
                }
            }
            Spacer(minLength: Spacing.s0)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .presentationDetents([.medium])
        .presentationDragIndicator(.visible)
        .accessibilityIdentifier("composeBroadcastAudienceSheet")
    }

    private func audienceRow(_ audience: BroadcastAudience) -> some View {
        let accent = ComposeBroadcastEditor.audienceColor(audience)
        let isSelected = audience == viewModel.draft.audience
        return Button {
            viewModel.setAudience(audience)
            showsAudienceSheet = false
        } label: {
            HStack(spacing: Spacing.s3) {
                Icon(audience.icon, size: 16, color: accent)
                    .frame(width: 32, height: 32)
                    .background(accent.opacity(0.12))
                    .clipShape(Circle())
                VStack(alignment: .leading, spacing: 1) {
                    Text(audience.title)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                    if let reach = viewModel.reach(for: audience) {
                        Text("\(reach.formatted()) people")
                            .font(.system(size: 11))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                }
                Spacer(minLength: Spacing.s0)
                if isSelected {
                    Icon(.check, size: 18, color: Theme.Color.primary600)
                }
            }
            .padding(.horizontal, Spacing.s4)
            .frame(minHeight: 56)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(audience.title)\(isSelected ? ", selected" : "")")
        .accessibilityIdentifier("composeBroadcastAudienceOption_\(audience.rawValue)")
    }

    // MARK: - Schedule sheet

    private var scheduleSheet: some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            Text("Schedule broadcast")
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)

            DatePicker(
                "Send at",
                selection: $scheduleDraftDate,
                in: Date()...,
                displayedComponents: [.date, .hourAndMinute]
            )
            .datePickerStyle(.graphical)
            .accessibilityIdentifier("composeBroadcastDatePicker")

            VStack(spacing: Spacing.s2) {
                Button {
                    viewModel.schedule(at: scheduleDraftDate)
                    showsScheduleSheet = false
                } label: {
                    Text("Schedule")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(Theme.Color.appTextInverse)
                        .frame(maxWidth: .infinity)
                        .frame(height: 48)
                        .background(Theme.Color.primary600)
                        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("composeBroadcastConfirmSchedule")

                Button {
                    viewModel.sendNow()
                    showsScheduleSheet = false
                } label: {
                    Text("Send now instead")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Theme.Color.appTextStrong)
                        .frame(maxWidth: .infinity)
                        .frame(height: 44)
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("composeBroadcastSendNow")
            }
        }
        .padding(Spacing.s4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .accessibilityIdentifier("composeBroadcastScheduleSheet")
    }

    // MARK: - Helpers

    /// Default the schedule picker an hour out, on a clean 5-minute mark.
    private func defaultScheduleDate() -> Date {
        Date().addingTimeInterval(3600)
    }

    /// Load every picked asset's bytes, then hand the batch to the VM.
    /// Videos keep their bytes too — the post-media route accepts both.
    private func handlePicked(_ items: [PhotosPickerItem]) {
        guard !items.isEmpty else { return }
        Task {
            var picked: [ComposeMediaPreview] = []
            for item in items {
                let isVideo = item.supportedContentTypes.contains { $0.conforms(to: .movie) }
                guard let data = try? await item.loadTransferable(type: Data.self) else { continue }
                let mime = item.supportedContentTypes.first?.preferredMIMEType
                    ?? (isVideo ? "video/mp4" : "image/jpeg")
                // Off-main, failure-silent capture-location read. The
                // coordinate is ONLY a local place-picker anchor — it
                // never rides the publish body.
                let capture = isVideo
                    ? await MediaLocationExtractor.videoLocation(from: data)
                    : await MediaLocationExtractor.imageLocation(from: data)
                picked.append(
                    ComposeMediaPreview(
                        kind: isVideo ? .video : .image,
                        caption: isVideo ? "Video attached" : "Photo attached",
                        data: data,
                        mimeType: mime,
                        capturedLatitude: capture?.latitude,
                        capturedLongitude: capture?.longitude
                    )
                )
            }
            await MainActor.run {
                viewModel.attachMedia(picked)
                photoSelections = []
            }
        }
    }
}

#Preview("Populated") {
    ComposeBroadcastView(viewModel: .previewPopulated())
}

#Preview("Empty") {
    ComposeBroadcastView(viewModel: .previewEmpty())
}

#Preview("Scheduled") {
    ComposeBroadcastView(viewModel: .previewScheduled())
}
