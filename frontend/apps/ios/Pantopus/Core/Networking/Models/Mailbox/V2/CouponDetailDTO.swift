//
//  CouponDetailDTO.swift
//  Pantopus
//
//  Coupon-shaped sub-payload decoded from `mail.object_payload` when
//  `mail_type == "coupon"`. Backend stores this as untyped JSON in S3
//  (route handler at `backend/routes/mailboxV2.js:412`), so the DTO is
//  defensive: every field is optional and `decode(from:)` returns nil
//  when the payload doesn't match.
//

import Foundation

/// Coupon detail payload. Mirrors the fields the design's `FrameCoupon`
/// reads — brand logo, headline, code, expiry, terms.
public struct CouponDetailDTO: Sendable, Hashable {
    public let brandLogoURL: URL?
    public let brandName: String?
    public let headline: String
    public let subcopy: String?
    public let code: String?
    public let expiresAt: String?
    public let merchant: String?
    public let terms: String?
    public let minimumSpend: String?
    public let finePrint: String?

    public init(
        brandLogoURL: URL?,
        brandName: String?,
        headline: String,
        subcopy: String?,
        code: String?,
        expiresAt: String?,
        merchant: String?,
        terms: String?,
        minimumSpend: String?,
        finePrint: String?
    ) {
        self.brandLogoURL = brandLogoURL
        self.brandName = brandName
        self.headline = headline
        self.subcopy = subcopy
        self.code = code
        self.expiresAt = expiresAt
        self.merchant = merchant
        self.terms = terms
        self.minimumSpend = minimumSpend
        self.finePrint = finePrint
    }

    /// Best-effort decode from a JSON envelope. Returns nil when the
    /// payload is missing the bare-minimum field set (`headline`).
    public static func decode(from value: JSONValue?) -> CouponDetailDTO? {
        guard let dict = value?.dictValue else { return nil }
        guard let headline = dict["headline"]?.stringValue?.trimmingCharacters(in: .whitespacesAndNewlines),
              !headline.isEmpty
        else {
            return nil
        }
        return CouponDetailDTO(
            brandLogoURL: dict["brand_logo_url"]?.stringValue.flatMap(URL.init(string:)),
            brandName: dict["brand_name"]?.stringValue,
            headline: headline,
            subcopy: dict["subcopy"]?.stringValue,
            code: dict["code"]?.stringValue,
            expiresAt: dict["expires_at"]?.stringValue,
            merchant: dict["merchant"]?.stringValue ?? dict["brand_name"]?.stringValue,
            terms: dict["terms"]?.stringValue,
            minimumSpend: dict["minimum_spend"]?.stringValue ?? dict["min_spend"]?.stringValue,
            finePrint: dict["fine_print"]?.stringValue
        )
    }
}
