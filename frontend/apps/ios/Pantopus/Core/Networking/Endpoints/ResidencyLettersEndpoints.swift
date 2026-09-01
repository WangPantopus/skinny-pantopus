//
//  ResidencyLettersEndpoints.swift
//  Pantopus
//
//  Endpoint builders for `backend/routes/residencyLetters.js`
//  (mounted under `/api/homes`) and the public third-party check on
//  `backend/routes/public.js`.
//

import Foundation

public enum ResidencyLettersEndpoints {
    /// `POST /api/homes/:id/residency-letters` — route
    /// `backend/routes/residencyLetters.js:39`. Issue (verified T4
    /// occupants only; 10/day limiter server-side).
    public static func issue(homeId: String, request: IssueResidencyLetterRequest) -> Endpoint {
        Endpoint(method: .post, path: "/api/homes/\(homeId)/residency-letters", body: request)
    }

    /// `GET /api/homes/:id/residency-letters` — route
    /// `backend/routes/residencyLetters.js:67`. The caller's own
    /// letters for this home (issuer-scoped; household members never
    /// see each other's letters).
    public static func list(homeId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/homes/\(homeId)/residency-letters")
    }

    /// `GET /api/homes/:id/residency-letters/:letterId/pdf` — route
    /// `backend/routes/residencyLetters.js:84`. The exact issued PDF
    /// artifact (raw bytes — fetch via `APIClient.requestData`).
    public static func pdf(homeId: String, letterId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/homes/\(homeId)/residency-letters/\(letterId)/pdf")
    }

    /// `POST /api/homes/:id/residency-letters/:letterId/revoke` — route
    /// `backend/routes/residencyLetters.js:109`. Kills the letter's
    /// public verification.
    public static func revoke(homeId: String, letterId: String) -> Endpoint {
        Endpoint(method: .post, path: "/api/homes/\(homeId)/residency-letters/\(letterId)/revoke")
    }

    /// `GET /api/public/residency-letters/:code` — route
    /// `backend/routes/public.js:479`. Anonymous third-party check;
    /// unknown codes come back as a uniform `{ valid: false }`.
    public static func publicVerify(code: String) -> Endpoint {
        let encoded = code.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? code
        return Endpoint(
            method: .get,
            path: "/api/public/residency-letters/\(encoded)",
            authenticated: false
        )
    }
}
