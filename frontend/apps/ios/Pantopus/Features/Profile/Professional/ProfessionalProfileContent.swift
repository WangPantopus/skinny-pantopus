//
//  ProfessionalProfileContent.swift
//  Pantopus
//
//  A.5 (A13.11) — render models for the Professional Profile editor: the
//  Business-pillar identity surface (company, certifications, portfolio,
//  skills, visibility). Distinct from the Personal `EditProfile` (A13.9):
//  every high-trust claim (company affiliation, certifications) carries a
//  verification status, and the sticky-save bar is verification-aware.
//
//  Hydrated from `backend/routes/professional.js` (`profile/me`); previews
//  and tests seed the same shapes from `ProfessionalProfileSampleData`.
//

import SwiftUI

// MARK: - Verification status

/// Verification outcome for a high-trust claim (company affiliation or a
/// certification). Drives the inline pill color: verified → success,
/// pending → warning, expiring → error.
public enum ProVerificationStatus: String, Sendable, Hashable {
    /// Confirmed by Pantopus — green success pill.
    case verified
    /// Awaiting confirmation (usually 1–2 business days) — amber warning pill.
    case pending
    /// Claim was rejected or has not been backed by proof — red error pill.
    case unverified
    /// Credential nearing its expiry date — red error pill.
    case expiring

    /// Whether this status counts toward the "claims pending verification"
    /// total surfaced on the strength meter + sticky bar.
    public var isAwaitingReview: Bool {
        self == .pending
    }

    var label: String {
        switch self {
        case .verified: "Verified"
        case .pending: "Pending"
        case .unverified: "Unverified"
        case .expiring: "Expiring"
        }
    }

    var icon: PantopusIcon {
        switch self {
        case .verified: .badgeCheck
        case .pending: .clock
        case .unverified: .alertCircle
        case .expiring: .alertTriangle
        }
    }

    var foreground: Color {
        switch self {
        case .verified: Theme.Color.success
        case .pending: Theme.Color.warning
        case .unverified: Theme.Color.error
        case .expiring: Theme.Color.error
        }
    }

    var background: Color {
        switch self {
        case .verified: Theme.Color.successBg
        case .pending: Theme.Color.warningBg
        case .unverified: Theme.Color.errorBg
        case .expiring: Theme.Color.errorBg
        }
    }
}

// MARK: - Section models

/// The user's company affiliation. A claimed company can be confirmed,
/// awaiting confirmation, or nearing lapse.
public struct CompanyClaim: Sendable, Hashable {
    public var name: String
    public var locality: String
    public var status: ProVerificationStatus
    /// True when the company was changed in this editing session.
    public var isDirty: Bool
    /// Inline note shown beneath the field (e.g. the co-op confirmation copy).
    public var hint: String?

    public init(
        name: String,
        locality: String,
        status: ProVerificationStatus,
        isDirty: Bool = false,
        hint: String? = nil
    ) {
        self.name = name
        self.locality = locality
        self.status = status
        self.isDirty = isDirty
        self.hint = hint
    }
}

/// A trade / specialty chip. Skills carry no verification, but a chip added
/// this session shows a "fresh" amber dot.
public struct ProSkill: Sendable, Hashable, Identifiable {
    public let id: String
    public var label: String
    public var icon: PantopusIcon
    public var isFresh: Bool

    public init(id: String, label: String, icon: PantopusIcon, isFresh: Bool = false) {
        self.id = id
        self.label = label
        self.icon = icon
        self.isFresh = isFresh
    }
}

/// A certification card: name + issuer + dates + verification status.
public struct Certification: Sendable, Hashable, Identifiable {
    public let id: String
    public var name: String
    public var issuer: String
    public var issued: String
    public var expires: String
    public var status: ProVerificationStatus
    /// True when uploaded this session (amber ring + dot).
    public var isFresh: Bool

    public init(
        id: String,
        name: String,
        issuer: String,
        issued: String,
        expires: String,
        status: ProVerificationStatus,
        isFresh: Bool = false
    ) {
        self.id = id
        self.name = name
        self.issuer = issuer
        self.issued = issued
        self.expires = expires
        self.status = status
        self.isFresh = isFresh
    }
}

/// Resolution state for an auto-fetched portfolio link preview.
public enum PortfolioLinkState: Sendable, Hashable {
    /// Preview resolved and is showing.
    case resolved
    /// Preview is being fetched (spinner).
    case loading
    /// Preview fetch failed (error tint + retry copy).
    case error
}

/// A portfolio link with an auto-fetched site preview.
public struct PortfolioLink: Sendable, Hashable, Identifiable {
    public let id: String
    public var host: String
    public var title: String
    public var url: String
    public var state: PortfolioLinkState
    /// True when added this session (amber ring + dot).
    public var isFresh: Bool

    public init(
        id: String,
        host: String,
        title: String,
        url: String,
        state: PortfolioLinkState,
        isFresh: Bool = false
    ) {
        self.id = id
        self.host = host
        self.title = title
        self.url = url
        self.state = state
        self.isFresh = isFresh
    }

    /// Host-derived leading glyph. Behance → palette, YouTube → play-circle,
    /// everything else → a generic link glyph (SF Symbols ships no brand
    /// logos, matching the design's `link-2` fallback).
    public var icon: PantopusIcon {
        let host = host.lowercased()
        if host.contains("behance") { return .palette }
        if host.contains("youtube") || host.contains("youtu.be") { return .playCircle }
        return .link
    }
}

/// A visibility toggle row, optionally with a scope chip shown when on.
public struct ProVisibilityRow: Sendable, Hashable, Identifiable {
    public let id: String
    public var label: String
    public var sub: String?
    public var isOn: Bool
    /// Baseline used to detect a toggle change this session.
    public var originalOn: Bool
    /// Scope chip text (e.g. "Elm Park · 0.6 mi radius"), shown when on.
    public var scope: String?

    public init(
        id: String,
        label: String,
        sub: String? = nil,
        isOn: Bool,
        scope: String? = nil
    ) {
        self.id = id
        self.label = label
        self.sub = sub
        self.isOn = isOn
        originalOn = isOn
        self.scope = scope
    }

    /// True when toggled away from its loaded baseline this session.
    public var isDirty: Bool {
        isOn != originalOn
    }
}

// MARK: - Verification

/// The professional record's verification leg —
/// `verification_tier` + `verification_status` (`professional.js:372`).
/// `canStart` gates the "Start verification" CTA exactly like RN
/// (`professional.tsx:385`, which shows it only for status `none`).
public struct ProVerificationSummary: Sendable, Hashable {
    public var status: ProVerificationStatus
    public var tier: Int?
    /// True while `POST /verification/start` is in flight.
    public var isStarting: Bool

    public init(status: ProVerificationStatus, tier: Int? = nil, isStarting: Bool = false) {
        self.status = status
        self.tier = tier
        self.isStarting = isStarting
    }

    /// One-line status copy — mirrors RN `professional.tsx:378`.
    public var summary: String {
        switch status {
        case .verified: tier.map { "Tier \($0) verified" } ?? "Verified"
        case .pending: "Pending"
        default: "Not verified"
        }
    }

    /// RN only offers the CTA when nothing has been submitted yet.
    public var canStart: Bool {
        status != .verified && status != .pending
    }
}

// MARK: - Aggregate content

/// The full editable Professional-profile payload.
public struct ProfessionalProfileContent: Sendable, Equatable {
    /// Display name shown in the pillar header (e.g. "Maria Kovács").
    public var proName: String
    /// Profile strength 0–100; gates the Pro+ tier.
    public var strength: Int
    public var title: FormFieldState
    public var yearsInRole: FormFieldState
    public var company: CompanyClaim
    public var skills: [ProSkill]
    public var certifications: [Certification]
    public var portfolio: [PortfolioLink]
    public var visibility: [ProVisibilityRow]
    /// Selected backend category keys — written to `categories[]` on
    /// `PATCH /profile/me`. Capped at `ProfessionalCategory.selectionLimit`.
    public var categories: [String]
    /// Last-saved category baseline, used for dirty tracking.
    public var originalCategories: [String]
    /// `service_area.city` / `.state` / `.radius_km`.
    public var serviceCity: FormFieldState
    public var serviceState: FormFieldState
    public var serviceRadiusKm: FormFieldState
    /// `pricing_meta.hourly_rate` (currency is always USD, like RN).
    public var hourlyRate: FormFieldState
    /// Verification tier + status, and whether a start call is in flight.
    public var verification: ProVerificationSummary

    public init(
        proName: String,
        strength: Int,
        title: FormFieldState,
        yearsInRole: FormFieldState,
        company: CompanyClaim,
        skills: [ProSkill],
        certifications: [Certification],
        portfolio: [PortfolioLink],
        visibility: [ProVisibilityRow],
        categories: [String] = [],
        serviceCity: FormFieldState = FormFieldState(id: "serviceCity", originalValue: ""),
        serviceState: FormFieldState = FormFieldState(id: "serviceState", originalValue: ""),
        serviceRadiusKm: FormFieldState = FormFieldState(id: "serviceRadiusKm", originalValue: ""),
        hourlyRate: FormFieldState = FormFieldState(id: "hourlyRate", originalValue: ""),
        verification: ProVerificationSummary = ProVerificationSummary(status: .unverified)
    ) {
        self.proName = proName
        self.strength = strength
        self.title = title
        self.yearsInRole = yearsInRole
        self.company = company
        self.skills = skills
        self.certifications = certifications
        self.portfolio = portfolio
        self.visibility = visibility
        self.categories = categories
        originalCategories = categories
        self.serviceCity = serviceCity
        self.serviceState = serviceState
        self.serviceRadiusKm = serviceRadiusKm
        self.hourlyRate = hourlyRate
        self.verification = verification
    }

    /// True when the category selection differs from the last-saved set.
    public var categoriesAreDirty: Bool {
        categories != originalCategories
    }

    /// False once the server's 5-category cap is reached
    /// (`professional.js:45`) — unselected chips go disabled.
    public var canSelectMoreCategories: Bool {
        categories.count < ProfessionalCategory.selectionLimit
    }

    /// Number of unsaved edits made this session — drives the "N edits"
    /// pill and whether the form is dirty.
    public var dirtyCount: Int {
        var count = 0
        if title.isDirty { count += 1 }
        if yearsInRole.isDirty { count += 1 }
        if company.isDirty { count += 1 }
        count += skills.filter(\.isFresh).count
        count += certifications.filter(\.isFresh).count
        count += portfolio.filter(\.isFresh).count
        count += visibility.filter(\.isDirty).count
        if categoriesAreDirty { count += 1 }
        if serviceCity.isDirty { count += 1 }
        if serviceState.isDirty { count += 1 }
        if serviceRadiusKm.isDirty { count += 1 }
        if hourlyRate.isDirty { count += 1 }
        return count
    }

    /// Number of claims awaiting verification (company + certs). Drives the
    /// strength caption and the sticky bar's SLA note.
    public var pendingCount: Int {
        var count = 0
        if company.status.isAwaitingReview { count += 1 }
        count += certifications.filter(\.status.isAwaitingReview).count
        return count
    }

    public var isDirty: Bool {
        dirtyCount > 0
    }

    /// Strength-meter caption — accurate regardless of dirty state so the
    /// post-submit "verified but in review" case reads correctly.
    public var strengthCaption: String {
        pendingCount == 0
            ? "All claims verified · ready for high-trust clients."
            : "\(pendingCount) \(pendingCount == 1 ? "claim" : "claims") pending verification · finish to reach Pro+."
    }
}

// MARK: - Enable (create) draft

/// Working copy for the "Professional mode is off" state — the fields
/// `POST /api/professional/profile` accepts (`professional.js:42`). Mirrors
/// RN's create-mode form (`professional.tsx:123`).
public struct ProfessionalEnableDraft: Sendable, Equatable {
    public var headline: String
    public var bio: String
    /// Selected backend category keys, capped at
    /// `ProfessionalCategory.selectionLimit`.
    public var categories: [String]
    public var city: String
    public var state: String
    /// Digits only; blank falls back to 50 like RN.
    public var radiusKm: String
    /// Digits + one decimal separator; blank omits `pricing_meta`.
    public var hourlyRate: String
    public var isPublic: Bool
    /// True when a soft-disabled row already exists, so the CTA re-enables
    /// it (`PATCH is_active: true`) instead of creating a new one.
    public var isReEnable: Bool
    /// A create/re-enable request is in flight.
    public var isSubmitting: Bool
    /// Last failure from the enable call, shown inline above the CTA.
    public var errorMessage: String?

    public init(
        headline: String = "",
        bio: String = "",
        categories: [String] = [],
        city: String = "",
        state: String = "",
        radiusKm: String = "50",
        hourlyRate: String = "",
        isPublic: Bool = true,
        isReEnable: Bool = false,
        isSubmitting: Bool = false,
        errorMessage: String? = nil
    ) {
        self.headline = headline
        self.bio = bio
        self.categories = categories
        self.city = city
        self.state = state
        self.radiusKm = radiusKm
        self.hourlyRate = hourlyRate
        self.isPublic = isPublic
        self.isReEnable = isReEnable
        self.isSubmitting = isSubmitting
        self.errorMessage = errorMessage
    }

    /// False once the 5-category cap is reached — unselected chips go
    /// disabled rather than silently no-op'ing.
    public var canSelectMoreCategories: Bool {
        categories.count < ProfessionalCategory.selectionLimit
    }

    /// CTA label — "Enable" for a first-time profile, "Re-enable" when a
    /// disabled record is being switched back on.
    public var ctaLabel: String {
        isReEnable ? "Re-enable professional mode" : "Enable professional mode"
    }

    /// Seed a draft from an existing (disabled) backend record so
    /// re-enabling keeps what the user already wrote.
    public static func from(_ dto: ProfessionalProfileDTO?) -> ProfessionalEnableDraft {
        guard let dto else { return ProfessionalEnableDraft() }
        let rate = dto.pricingMeta?.hourlyRate
        return ProfessionalEnableDraft(
            headline: dto.headline ?? "",
            bio: dto.bio ?? "",
            categories: dto.categories ?? [],
            city: dto.serviceArea?.city ?? "",
            state: dto.serviceArea?.state ?? "",
            radiusKm: dto.serviceArea?.radiusKm.map { String(Int($0)) } ?? "50",
            hourlyRate: rate.map { $0 == $0.rounded() ? String(Int($0)) : String($0) } ?? "",
            isPublic: dto.isPublic ?? true,
            isReEnable: true
        )
    }
}

// MARK: - Screen state

/// Top-level render state for the Professional Profile editor.
public enum ProfessionalProfileState: Sendable, Equatable {
    case loading
    /// Professional mode is **off** — either no record at all, or a
    /// soft-disabled one. Renders the enable form + CTA.
    case create(ProfessionalEnableDraft)
    /// Published & clean — no unsaved edits. Save is disabled.
    case verified(ProfessionalProfileContent)
    /// Unsaved edits present — `dirtyCount` edits, `pendingCount` of which
    /// are new claims needing 1–2 day verification.
    case pending(ProfessionalProfileContent, dirtyCount: Int, pendingCount: Int)
    case error(message: String)
}
