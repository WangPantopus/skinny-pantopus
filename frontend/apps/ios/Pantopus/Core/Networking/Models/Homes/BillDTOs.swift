//
//  BillDTOs.swift
//  Pantopus
//
//  DTOs for the Home Bills endpoints under `backend/routes/home.js`:
//   - GET    /api/homes/:id/bills              (line 4506)
//   - POST   /api/homes/:id/bills              (line 4539)
//   - PUT    /api/homes/:id/bills/:billId      (line 4585)
//   - GET    /api/homes/:id/bills/:billId/splits (line 4627)
//
//  Backend stores `amount` as a numeric column — it can arrive on the
//  wire as either a JSON number or a JSON string ("142.80"). The DTO
//  decodes both shapes to a `Decimal` so view-model maths stay stable.
//  A legacy `amount_cents` column is also accepted in case some older
//  records still carry it.
//

import Foundation

/// One row from `GET /api/homes/:id/bills`.
public struct BillDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let homeId: String
    public let billType: String
    public let providerName: String?
    public let amount: Decimal
    public let amountCents: Int?
    public let currency: String?
    public let periodStart: String?
    public let periodEnd: String?
    public let dueDate: String?
    public let status: String
    public let paidAt: String?
    public let paidBy: String?
    public let createdAt: String?
    public let updatedAt: String?
    /// Backend-stored JSONB bag. Used today only by the Add Bill
    /// wizard to round-trip the recurrence selection through
    /// `details.schedule` / `details.frequency`. Stays string-only
    /// because every value the wizard writes is a plain string key.
    public let details: [String: String]?

    private enum CodingKeys: String, CodingKey {
        case id
        case homeId = "home_id"
        case billType = "bill_type"
        case providerName = "provider_name"
        case amount
        case amountCents = "amount_cents"
        case currency
        case periodStart = "period_start"
        case periodEnd = "period_end"
        case dueDate = "due_date"
        case status
        case paidAt = "paid_at"
        case paidBy = "paid_by"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case details
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        homeId = try container.decode(String.self, forKey: .homeId)
        billType = try container.decode(String.self, forKey: .billType)
        providerName = try container.decodeIfPresent(String.self, forKey: .providerName)
        amount = try BillDTO.decodeDecimal(in: container, key: .amount)
        amountCents = try container.decodeIfPresent(Int.self, forKey: .amountCents)
        currency = try container.decodeIfPresent(String.self, forKey: .currency)
        periodStart = try container.decodeIfPresent(String.self, forKey: .periodStart)
        periodEnd = try container.decodeIfPresent(String.self, forKey: .periodEnd)
        dueDate = try container.decodeIfPresent(String.self, forKey: .dueDate)
        status = try container.decodeIfPresent(String.self, forKey: .status) ?? "pending"
        paidAt = try container.decodeIfPresent(String.self, forKey: .paidAt)
        paidBy = try container.decodeIfPresent(String.self, forKey: .paidBy)
        createdAt = try container.decodeIfPresent(String.self, forKey: .createdAt)
        updatedAt = try container.decodeIfPresent(String.self, forKey: .updatedAt)
        details = try container.decodeIfPresent([String: String].self, forKey: .details)
    }

    public init(
        id: String,
        homeId: String,
        billType: String,
        providerName: String?,
        amount: Decimal,
        amountCents: Int? = nil,
        currency: String? = nil,
        periodStart: String? = nil,
        periodEnd: String? = nil,
        dueDate: String?,
        status: String,
        paidAt: String? = nil,
        paidBy: String? = nil,
        createdAt: String? = nil,
        updatedAt: String? = nil,
        details: [String: String]? = nil
    ) {
        self.id = id
        self.homeId = homeId
        self.billType = billType
        self.providerName = providerName
        self.amount = amount
        self.amountCents = amountCents
        self.currency = currency
        self.periodStart = periodStart
        self.periodEnd = periodEnd
        self.dueDate = dueDate
        self.status = status
        self.paidAt = paidAt
        self.paidBy = paidBy
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.details = details
    }

    /// Best-effort cents-or-decimal → `Decimal` extraction. Treats
    /// `amount_cents` as authoritative when set, then falls back to
    /// `amount`.
    public var displayAmount: Decimal {
        if let cents = amountCents {
            return Decimal(cents) / 100
        }
        return amount
    }

    private static func decodeDecimal<K: CodingKey>(
        in container: KeyedDecodingContainer<K>,
        key: K
    ) throws -> Decimal {
        // Try the string path first — backend NUMERIC columns come over
        // the wire as strings (`"142.80"`), and `Decimal(string:)` keeps
        // exact precision. Fall through to numeric decoders only when
        // the payload is a JSON number; round-tripping via `String(_:)`
        // avoids the IEEE-754 noise of the raw `Decimal(Double)` init.
        if let asString = try? container.decodeIfPresent(String.self, forKey: key) {
            return Decimal(string: asString) ?? 0
        }
        if let asDouble = try? container.decodeIfPresent(Double.self, forKey: key) {
            return Decimal(string: String(asDouble)) ?? Decimal(asDouble)
        }
        if let asInt = try? container.decodeIfPresent(Int.self, forKey: key) {
            return Decimal(asInt)
        }
        return 0
    }
}

/// Envelope for `GET /api/homes/:id/bills`.
public struct GetHomeBillsResponse: Decodable, Sendable {
    public let bills: [BillDTO]
}

/// Envelope for `POST /api/homes/:id/bills` and `PUT …/:billId`.
public struct HomeBillResponse: Decodable, Sendable {
    public let bill: BillDTO
}

/// Body for `POST /api/homes/:id/bills`. Server requires
/// `bill_type` + `amount`; everything else optional.
public struct CreateBillRequest: Encodable, Sendable {
    public let billType: String
    public let providerName: String?
    public let amount: Decimal
    public let dueDate: String?
    public let details: [String: String]?

    private enum CodingKeys: String, CodingKey {
        case billType = "bill_type"
        case providerName = "provider_name"
        case amount
        case dueDate = "due_date"
        case details
    }

    public init(
        billType: String,
        providerName: String?,
        amount: Decimal,
        dueDate: String?,
        details: [String: String]? = nil
    ) {
        self.billType = billType
        self.providerName = providerName
        self.amount = amount
        self.dueDate = dueDate
        self.details = details
    }

    public func encode(to encoder: any Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(billType, forKey: .billType)
        if let providerName { try c.encode(providerName, forKey: .providerName) }
        try c.encode(NSDecimalNumber(decimal: amount).doubleValue, forKey: .amount)
        if let dueDate { try c.encode(dueDate, forKey: .dueDate) }
        if let details { try c.encode(details, forKey: .details) }
    }
}

/// Body for `PUT /api/homes/:id/bills/:billId`. All fields optional —
/// the server picks up whichever are sent (whitelist mirrored from
/// `backend/routes/home.js:4593`).
public struct UpdateBillRequest: Encodable, Sendable {
    public let status: String?
    public let paidAt: String?
    public let amount: Decimal?
    public let providerName: String?
    public let dueDate: String?
    public let details: [String: String]?

    private enum CodingKeys: String, CodingKey {
        case status
        case paidAt = "paid_at"
        case amount
        case providerName = "provider_name"
        case dueDate = "due_date"
        case details
    }

    public init(
        status: String? = nil,
        paidAt: String? = nil,
        amount: Decimal? = nil,
        providerName: String? = nil,
        dueDate: String? = nil,
        details: [String: String]? = nil
    ) {
        self.status = status
        self.paidAt = paidAt
        self.amount = amount
        self.providerName = providerName
        self.dueDate = dueDate
        self.details = details
    }

    public func encode(to encoder: any Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        if let status { try c.encode(status, forKey: .status) }
        if let paidAt { try c.encode(paidAt, forKey: .paidAt) }
        if let amount {
            try c.encode(NSDecimalNumber(decimal: amount).doubleValue, forKey: .amount)
        }
        if let providerName { try c.encode(providerName, forKey: .providerName) }
        if let dueDate { try c.encode(dueDate, forKey: .dueDate) }
        if let details { try c.encode(details, forKey: .details) }
    }
}

/// One row from `GET /api/homes/:id/bills/:billId/splits`.
public struct BillSplitDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let billId: String
    public let userId: String
    public let amount: Decimal
    public let status: String?
    public let user: BillSplitUser?

    public struct BillSplitUser: Decodable, Sendable, Hashable {
        public let id: String
        public let username: String?
        public let name: String?
        public let profilePictureUrl: String?

        private enum CodingKeys: String, CodingKey {
            case id, username, name
            case profilePictureUrl = "profile_picture_url"
        }
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case billId = "bill_id"
        case userId = "user_id"
        case amount, status, user
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        billId = try container.decode(String.self, forKey: .billId)
        userId = try container.decode(String.self, forKey: .userId)
        status = try container.decodeIfPresent(String.self, forKey: .status)
        user = try container.decodeIfPresent(BillSplitUser.self, forKey: .user)
        if let asDouble = try? container.decodeIfPresent(Double.self, forKey: .amount) {
            amount = Decimal(asDouble)
        } else if let asString = try? container.decodeIfPresent(String.self, forKey: .amount) {
            amount = Decimal(string: asString) ?? 0
        } else {
            amount = 0
        }
    }
}

/// Envelope for `GET /api/homes/:id/bills/:billId/splits`.
public struct GetBillSplitsResponse: Decodable, Sendable {
    public let splits: [BillSplitDTO]
}
