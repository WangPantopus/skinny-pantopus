//
//  HomeDocumentDTOs.swift
//  Pantopus
//
//  DTOs for the Home Documents endpoints under
//  `backend/routes/home.js`:
//   - GET  /api/homes/:id/documents   (line 4944)
//   - POST /api/homes/:id/documents   (line 4985)
//
//  Backend `HomeDocument.doc_type` is one of ten constants:
//    lease · insurance · warranty · manual · permit · floor_plan ·
//    receipt · photo · paint_color · other
//

import Foundation

/// One row from `GET /api/homes/:id/documents`.
public struct HomeDocumentDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let homeId: String
    public let fileId: String?
    public let docType: String
    public let title: String
    public let storageBucket: String?
    public let storagePath: String?
    public let mimeType: String?
    public let sizeBytes: Int64?
    public let visibility: String
    public let details: [String: String]
    public let createdBy: String?
    public let createdAt: String?
    public let updatedAt: String?

    private enum CodingKeys: String, CodingKey {
        case id
        case homeId = "home_id"
        case fileId = "file_id"
        case docType = "doc_type"
        case title
        case storageBucket = "storage_bucket"
        case storagePath = "storage_path"
        case mimeType = "mime_type"
        case sizeBytes = "size_bytes"
        case visibility
        case details
        case createdBy = "created_by"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        homeId = try container.decode(String.self, forKey: .homeId)
        fileId = try container.decodeIfPresent(String.self, forKey: .fileId)
        docType = try container.decode(String.self, forKey: .docType)
        title = try container.decode(String.self, forKey: .title)
        storageBucket = try container.decodeIfPresent(String.self, forKey: .storageBucket)
        storagePath = try container.decodeIfPresent(String.self, forKey: .storagePath)
        mimeType = try container.decodeIfPresent(String.self, forKey: .mimeType)
        sizeBytes = try container.decodeIfPresent(Int64.self, forKey: .sizeBytes)
        visibility = try container.decodeIfPresent(String.self, forKey: .visibility) ?? "members"
        details = (try? container.decode([String: String].self, forKey: .details)) ?? [:]
        createdBy = try container.decodeIfPresent(String.self, forKey: .createdBy)
        createdAt = try container.decodeIfPresent(String.self, forKey: .createdAt)
        updatedAt = try container.decodeIfPresent(String.self, forKey: .updatedAt)
    }

    public init(
        id: String,
        homeId: String,
        fileId: String? = nil,
        docType: String,
        title: String,
        storageBucket: String? = nil,
        storagePath: String? = nil,
        mimeType: String? = nil,
        sizeBytes: Int64? = nil,
        visibility: String = "members",
        details: [String: String] = [:],
        createdBy: String? = nil,
        createdAt: String? = nil,
        updatedAt: String? = nil
    ) {
        self.id = id
        self.homeId = homeId
        self.fileId = fileId
        self.docType = docType
        self.title = title
        self.storageBucket = storageBucket
        self.storagePath = storagePath
        self.mimeType = mimeType
        self.sizeBytes = sizeBytes
        self.visibility = visibility
        self.details = details
        self.createdBy = createdBy
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

/// Wrapper for the list response — backend returns
/// `{ "documents": [HomeDocumentDTO, …] }`.
public struct GetHomeDocumentsResponse: Decodable, Sendable {
    public let documents: [HomeDocumentDTO]
}

/// Wrapper for the create response — backend returns
/// `{ "document": HomeDocumentDTO }` on `POST /api/homes/:id/documents`.
public struct CreateDocumentResponse: Decodable, Sendable {
    public let document: HomeDocumentDTO
}

/// Request body for `POST /api/homes/:id/documents`. Backend rejects
/// the call without `doc_type` + `title`.
public struct CreateDocumentRequest: Encodable, Sendable {
    public let docType: String
    public let title: String
    public let fileId: String?
    public let storageBucket: String?
    public let storagePath: String?
    public let mimeType: String?
    public let sizeBytes: Int64?
    public let visibility: String?
    public let details: [String: String]?

    private enum CodingKeys: String, CodingKey {
        case docType = "doc_type"
        case title
        case fileId = "file_id"
        case storageBucket = "storage_bucket"
        case storagePath = "storage_path"
        case mimeType = "mime_type"
        case sizeBytes = "size_bytes"
        case visibility
        case details
    }

    public init(
        docType: String,
        title: String,
        fileId: String? = nil,
        storageBucket: String? = nil,
        storagePath: String? = nil,
        mimeType: String? = nil,
        sizeBytes: Int64? = nil,
        visibility: String? = nil,
        details: [String: String]? = nil
    ) {
        self.docType = docType
        self.title = title
        self.fileId = fileId
        self.storageBucket = storageBucket
        self.storagePath = storagePath
        self.mimeType = mimeType
        self.sizeBytes = sizeBytes
        self.visibility = visibility
        self.details = details
    }
}
