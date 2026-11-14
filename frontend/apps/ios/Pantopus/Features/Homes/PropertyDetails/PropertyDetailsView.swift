//
//  PropertyDetailsView.swift
//  Pantopus
//
//  A.4 — Property details (A13.5). Read-mostly variant of the Form
//  archetype. Property facts come from external sources, so the rows are
//  read-only `DataRow`s; the only mutation affordance is "Request
//  correction" sticky-bottom CTA when sources disagree.
//
//  Frames:
//    .clean    — map hero · 3 sections · all source pills green
//    .mismatch — amber banner · flagged Bedrooms row · sticky CTA
//

// swiftlint:disable file_length

import CoreLocation
import MapKit
import SwiftUI
import UniformTypeIdentifiers

public struct PropertyDetailsView: View {
    @State private var viewModel: PropertyDetailsViewModel
    private let onBack: () -> Void
    private let onRequestCorrection: () -> Void
    @State private var editing: HouseholdGroupDTO?
    @State private var reporting: PropertyRecordSection?
    @State private var pickingDocument = false
    @State private var foundDocument: DocumentFactsAnswerDTO?

    public init(
        homeId: String,
        onBack: @escaping () -> Void,
        onRequestCorrection: @escaping () -> Void = {}
    ) {
        _viewModel = State(initialValue: PropertyDetailsViewModel(homeId: homeId))
        self.onBack = onBack
        self.onRequestCorrection = onRequestCorrection
    }

    /// Preview / test seam — inject a pre-seeded view-model.
    init(
        viewModel: PropertyDetailsViewModel,
        onBack: @escaping () -> Void = {},
        onRequestCorrection: @escaping () -> Void = {}
    ) {
        _viewModel = State(initialValue: viewModel)
        self.onBack = onBack
        self.onRequestCorrection = onRequestCorrection
    }

    public var body: some View {
        content
            .background(Theme.Color.appBg.ignoresSafeArea())
            .accessibilityIdentifier("propertyDetails")
            .task { await viewModel.load() }
            // Someone changed this Home (`sync:changed`) or the socket came back: re-check the open
            // details, which stay on screen meanwhile (Instant Screens).
            .refreshesOnStoreChange(affects: { $0.names(topic: ScreenTopic.home(viewModel.homeId), kind: .place) }, perform: {
                await viewModel.load()
            })
            .sheet(item: $editing) { group in
                HouseholdFactEditorSheet(group: group, checkGroup: group.id == viewModel.countyCheckGroup ? group.id : nil) { changes in
                    await viewModel.saveFacts(changes)
                }
            }
            .sheet(item: $reporting) { section in
                HouseholdReportSheet(section: section) { field, note in
                    await viewModel.reportProblem(section: section.id, field: field, note: note)
                }
            }
            // "Add from a document": a PDF from Files, read by the server and dropped; then "Check what we found".
            .fileImporter(isPresented: $pickingDocument, allowedContentTypes: [.pdf]) { result in
                guard case let .success(url) = result else { return }
                Task { foundDocument = await viewModel.readDocument(at: url) }
            }
            .sheet(item: $foundDocument) { answer in
                DocumentFactsSheet(answer: answer) { facts in
                    await viewModel.saveDocumentFacts(kind: answer.kind, facts: facts)
                }
            }
    }

    private var householdActions: HouseholdActions {
        HouseholdActions(
            saving: viewModel.savingFacts,
            save: { changes in Task { await viewModel.saveFacts(changes) } },
            edit: { editing = $0 },
            report: { reporting = $0 },
            answerLayout: { answer in Task { await viewModel.answerFloorPlan(answer) } },
            homeId: viewModel.homeId,
            addDocument: { pickingDocument = true },
            documents: viewModel.documents
        )
    }

    @ViewBuilder private var content: some View {
        switch viewModel.state {
        case .loading:
            LoadingBody(onBack: onBack)
        case let .clean(content):
            loaded(content, isMismatch: false)
        case let .mismatch(content):
            loaded(content, isMismatch: true)
        case let .error(message):
            ErrorBody(message: message, onBack: onBack) {
                Task { await viewModel.refresh() }
            }
        }
    }

    private func loaded(_ content: PropertyDetailsContent, isMismatch: Bool) -> some View {
        LoadedBody(
            content: content,
            isMismatch: isMismatch,
            staleNotice: viewModel.staleNotice,
            householdActions: householdActions,
            onBack: onBack,
            onRequestCorrection: onRequestCorrection
        ) { Task { await viewModel.refresh() } }
    }
}

// MARK: - Loaded

private struct LoadedBody: View {
    let content: PropertyDetailsContent
    let isMismatch: Bool
    let staleNotice: String?
    let householdActions: HouseholdActions
    let onBack: () -> Void
    let onRequestCorrection: () -> Void
    let onRetry: () -> Void

    var body: some View {
        ContentDetailShell(
            title: "Property details",
            onBack: onBack,
            header: {
                PropertyHero(address: content.address)
                    .padding(.horizontal, Spacing.s4)
            },
            body: {
                VStack(alignment: .leading, spacing: Spacing.s5) {
                    if let staleNotice { RefreshNotice(text: staleNotice, onRetry: onRetry) }
                    if isMismatch, let banner = content.banner {
                        MismatchBanner(data: banner)
                    }
                    PropertySection(title: "Property", rows: content.propertyFacts)
                    if let household = content.household, !household.questions.isEmpty {
                        HouseholdQuestionsCard(household: household, actions: householdActions)
                    }
                    if let household = content.household, let check = household.countyCheck, let page = household.countyPage {
                        HouseholdCountyCheckCard(page: page, check: check, actions: householdActions)
                    }
                    // The county record comes for verified owners
                    // only, so everyone else sees just the Property card.
                    ForEach(content.recordSections) { section in
                        PropertySection(title: section.title, rows: section.rows, note: section.note) {
                            if let layout = content.household?.layout(forSection: section.id) {
                                FloorPlanLayoutFooter(layout: layout, actions: householdActions)
                            }
                            if let group = content.household?.group(forSection: section.id) {
                                HouseholdGroupFooter(group: group, section: section, actions: householdActions)
                            }
                        }
                    }
                    if let footer = content.recordFooter {
                        Text(footer)
                            .pantopusTextStyle(.caption)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                            .accessibilityIdentifier("propertyDetails_recordFooter")
                    }
                    if let household = content.household {
                        ForEach(household.sections) { section in
                            PropertySection(title: section.title, rows: section.rows, note: section.note)
                        }
                        if household.questions.isEmpty, household.countyCheck == nil, let page = household.countyPage {
                            HouseholdCountyPageLink(page: page)
                        }
                        ForEach(household.addDetails) { group in
                            HouseholdAddDetailsCard(group: group, actions: householdActions)
                        }
                        if let offer = household.documents {
                            HouseholdDocumentsCard(
                                offer: offer,
                                state: householdActions.documents,
                                saving: householdActions.saving,
                                onPick: householdActions.addDocument
                            )
                        }
                    }
                    // Verification sources have no clean backend mapping
                    // today, so they're hidden when the projection leaves
                    // them empty.
                    if !content.verification.isEmpty {
                        VerificationSectionView(sources: content.verification)
                    }
                }
                .padding(.horizontal, Spacing.s4)
            }
        )
        .safeAreaInset(edge: .bottom, spacing: Spacing.s0) {
            if isMismatch {
                StickyCorrectionBar(onRequestCorrection: onRequestCorrection)
            }
        }
    }
}

// MARK: - Hero + map

private struct PropertyHero: View {
    let address: PropertyAddress

    var body: some View {
        HStack(alignment: .center, spacing: Spacing.s3) {
            VStack(alignment: .leading, spacing: Spacing.s1) {
                Text(address.line1)
                    .pantopusTextStyle(.h3)
                    .foregroundStyle(Theme.Color.appText)
                    .accessibilityAddTraits(.isHeader)
                Text(address.line2)
                    .pantopusTextStyle(.small)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                HouseholdPill()
                    .padding(.top, Spacing.s1)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            mapPreview
                .frame(width: 72, height: 72)
                .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                        .stroke(Theme.Color.appBorder, lineWidth: 1)
                )
                .allowsHitTesting(false)
                .accessibilityHidden(true)
        }
        .padding(Spacing.s3)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .pantopusShadow(.sm)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .accessibilityElement(children: .combine)
        .accessibilityLabel(
            "\(address.line1), \(address.line2). Household" + (address.hasMapLocation ? "" : ". Map unavailable")
        )
    }

    @ViewBuilder private var mapPreview: some View {
        if address.hasMapLocation, let latitude = address.latitude, let longitude = address.longitude {
            PropertyMap(latitude: latitude, longitude: longitude)
        } else {
            VStack(spacing: Spacing.s1) {
                Icon(.mapPin, size: 18, color: Theme.Color.appTextMuted)
                Text("Map unavailable")
                    .font(.system(size: 10, weight: .medium))
                    .multilineTextAlignment(.center)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Theme.Color.appSurfaceSunken)
        }
    }
}

private struct PropertyMap: View {
    let latitude: Double
    let longitude: Double

    private var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }

    private var region: MKCoordinateRegion {
        MKCoordinateRegion(
            center: coordinate,
            span: MKCoordinateSpan(latitudeDelta: 0.008, longitudeDelta: 0.008)
        )
    }

    var body: some View {
        Map(initialPosition: .region(region), interactionModes: []) {
            Annotation("", coordinate: coordinate, anchor: .center) {
                HomePinDot()
            }
        }
        .mapStyle(.standard(pointsOfInterest: .excludingAll))
    }
}

private struct HomePinDot: View {
    var body: some View {
        ZStack {
            Circle().fill(Theme.Color.primary600)
            Icon(.home, size: 10, color: Theme.Color.appTextInverse)
        }
        .frame(width: 22, height: 22)
        .overlay(Circle().stroke(Theme.Color.appSurface, lineWidth: 2))
        .pantopusShadow(.sm)
    }
}

private struct HouseholdPill: View {
    var body: some View {
        HStack(spacing: Spacing.s1) {
            Icon(.home, size: 11, color: Theme.Color.home)
            Text("Household", style: .overline)
                .foregroundStyle(Theme.Color.home)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, Spacing.s1)
        .background(Theme.Color.homeBg)
        .clipShape(Capsule())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Household")
    }
}

// MARK: - Sections

private struct PropertySection<Footer: View>: View {
    let title: String
    let rows: [PropertyFactRow]
    var note: String?
    @ViewBuilder var footer: Footer

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            SectionHeader(title)
            PropertyCard {
                ForEach(Array(rows.enumerated()), id: \.element.id) { index, row in
                    DataRow(
                        label: row.label,
                        value: row.value,
                        sub: row.sub,
                        mono: row.mono,
                        mismatch: row.mismatch,
                        identifier: "propertyDetails_row_\(row.id)"
                    )
                    if index < rows.count - 1 {
                        RowDivider()
                    }
                }
                footer
            }
            if let note {
                Text(note)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}

extension PropertySection where Footer == EmptyView {
    init(title: String, rows: [PropertyFactRow], note: String? = nil) {
        self.init(title: title, rows: rows, note: note) { EmptyView() }
    }
}

private struct VerificationSectionView: View {
    let sources: [VerificationSource]

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            SectionHeader("Verification")
            PropertyCard {
                ForEach(Array(sources.enumerated()), id: \.element.id) { index, source in
                    VerificationRow(source: source)
                    if index < sources.count - 1 {
                        RowDivider()
                    }
                }
            }
        }
    }
}

private struct VerificationRow: View {
    let source: VerificationSource

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            HStack(spacing: Spacing.s2) {
                Text(source.title)
                    .pantopusTextStyle(.small)
                    .fontWeight(.semibold)
                    .foregroundStyle(Theme.Color.appText)
                SourcePill(source.pill.label, tone: source.pill.tone, icon: source.pill.icon)
                Spacer(minLength: Spacing.s0)
            }
            Text(source.detail)
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s3)
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("propertyDetails_source_\(source.id)")
    }
}

/// Card container with no internal padding so flagged rows can tint
/// edge-to-edge. Rows own their own padding via `DataRow` / `VerificationRow`.
private struct PropertyCard<Content: View>: View {
    @ViewBuilder let content: Content

    var body: some View {
        VStack(spacing: Spacing.s0) { content }
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .pantopusShadow(.sm)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
    }
}

private struct RowDivider: View {
    var body: some View {
        Rectangle()
            .fill(Theme.Color.appBorderSubtle)
            .frame(height: 1)
    }
}

// MARK: - Mismatch banner

private struct MismatchBanner: View {
    let data: MismatchBannerData
    @State private var expanded = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        Button {
            withPantopusAnimation(.componentState, reduceMotion: reduceMotion) { expanded.toggle() }
        } label: {
            HStack(alignment: .top, spacing: Spacing.s2) {
                ZStack {
                    RoundedRectangle(cornerRadius: Radii.sm, style: .continuous)
                        .fill(Theme.Color.warningSolid.opacity(0.18))
                    Icon(.alertTriangle, size: 14, color: Theme.Color.warning)
                }
                .frame(width: 26, height: 26)
                VStack(alignment: .leading, spacing: Spacing.s1) {
                    Text(data.summary)
                        .pantopusTextStyle(.small)
                        .fontWeight(.semibold)
                        .foregroundStyle(Theme.Color.appText)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    if expanded {
                        Text(data.detail)
                            .pantopusTextStyle(.caption)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
                Icon(.chevronRight, size: 16, color: Theme.Color.warning)
                    .rotationEffect(.degrees(expanded ? 90 : 0))
            }
            .padding(Spacing.s3)
            .background(Theme.Color.warningBg)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(Theme.Color.warning.opacity(0.35), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("propertyDetails_mismatchBanner")
        .accessibilityLabel("\(data.summary). \(data.detail)")
        .accessibilityHint(expanded ? "Collapse detail" : "Expand for detail")
    }
}

// MARK: - Correction affordances

private struct StickyCorrectionBar: View {
    let onRequestCorrection: () -> Void

    var body: some View {
        VStack(spacing: Spacing.s0) {
            RowDivider()
            Button(action: onRequestCorrection) {
                HStack(spacing: Spacing.s2) {
                    Text("Request correction")
                        .pantopusTextStyle(.body)
                        .fontWeight(.semibold)
                    Icon(.arrowRight, size: 16, color: Theme.Color.appTextInverse)
                }
                .foregroundStyle(Theme.Color.appTextInverse)
                .frame(maxWidth: .infinity, minHeight: 50)
                .background(Theme.Color.primarySolid)
                .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                .pantopusShadow(.primary)
            }
            .buttonStyle(.plain)
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s3)
            .padding(.bottom, Spacing.s2)
            .accessibilityIdentifier("propertyDetails_requestCorrectionCTA")
            .accessibilityLabel("Request correction")
        }
        .background(.ultraThinMaterial)
    }
}

// MARK: - Loading / Error

private struct LoadingBody: View {
    let onBack: () -> Void

    var body: some View {
        ContentDetailShell(
            title: "Property details",
            onBack: onBack,
            header: {
                Shimmer(height: 220, cornerRadius: Radii.lg)
                    .padding(.horizontal, Spacing.s4)
            },
            body: {
                VStack(alignment: .leading, spacing: Spacing.s5) {
                    skeletonSection
                    skeletonSection
                    skeletonSection
                }
                .padding(.horizontal, Spacing.s4)
            }
        )
    }

    private var skeletonSection: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            Shimmer(width: 120, height: 12, cornerRadius: Radii.sm)
            Shimmer(height: 168, cornerRadius: Radii.lg)
        }
    }
}

private struct ErrorBody: View {
    let message: String
    let onBack: () -> Void
    let onRetry: () -> Void

    var body: some View {
        ContentDetailShell(
            title: "Property details",
            onBack: onBack,
            header: { EmptyView() },
            body: {
                EmptyState(
                    icon: .alertCircle,
                    headline: "Couldn't load property details",
                    subcopy: message,
                    cta: EmptyState.CTA(title: "Try again") {
                        await MainActor.run { onRetry() }
                    }
                )
                .frame(height: 400)
                .padding(.horizontal, Spacing.s4)
            }
        )
    }
}

// MARK: - Previews

#Preview("Clean") {
    PropertyDetailsView(
        viewModel: PropertyDetailsViewModel(homeId: "preview") { _ in
            PropertyDetailsSampleData.clean
        }
    )
}

#Preview("Mismatch") {
    PropertyDetailsView(
        viewModel: PropertyDetailsViewModel(homeId: "preview") { _ in
            PropertyDetailsSampleData.mismatch
        }
    )
}

#Preview("Error") {
    PropertyDetailsView(
        viewModel: PropertyDetailsViewModel(homeId: "preview") { _ in
            struct PreviewError: Error {}
            throw PreviewError()
        }
    )
}
