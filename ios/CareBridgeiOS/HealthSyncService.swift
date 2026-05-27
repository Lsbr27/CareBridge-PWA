import Foundation

final class HealthSyncService {
    static let shared = HealthSyncService()

    private let endpointBase = URL(string: "https://care-bridge-pwa-three.vercel.app/api/health-sync/apple")!

    func sync(snapshot: HealthSnapshot, userId: String, accessToken: String) async throws {
        try validateUUID(userId)
        try await patchConnectionStatus(userId: userId, status: "connected", accessToken: accessToken)
        try await postSamples(snapshot: snapshot, userId: userId, accessToken: accessToken)
    }

    private func patchConnectionStatus(userId: String, status: String, accessToken: String) async throws {
        var request = URLRequest(url: endpointBase)
        request.httpMethod = "PATCH"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")

        let payload = PatchPayload(userId: userId, status: status)
        request.httpBody = try JSONEncoder().encode(payload)

        try await perform(request)
    }

    private func postSamples(snapshot: HealthSnapshot, userId: String, accessToken: String) async throws {
        var request = URLRequest(url: endpointBase)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")

        let payload = PostPayload(userId: userId, samples: Self.buildSamples(from: snapshot))
        request.httpBody = try JSONEncoder().encode(payload)

        try await perform(request)
    }

    private func perform(_ request: URLRequest) async throws {
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw SyncError.invalidResponse
        }
        guard (200...299).contains(http.statusCode) else {
            let message = String(data: data, encoding: .utf8)
            throw SyncError.serverError(code: http.statusCode, body: message)
        }
    }

    private func validateUUID(_ userId: String) throws {
        guard UUID(uuidString: userId) != nil else {
            throw SyncError.invalidUserId
        }
    }

    private static func buildSamples(from snapshot: HealthSnapshot) -> [Sample] {
        let isoDate = ISO8601DateFormatter().string(from: snapshot.updatedAt)
        var samples: [Sample] = []

        samples.append(
            Sample(
                metric: "steps",
                value: Double(snapshot.stepsToday),
                unit: "count",
                measuredAt: isoDate,
                externalId: "steps-\(isoDate)"
            )
        )

        if let sleep = snapshot.sleepHoursLastNight {
            samples.append(
                Sample(
                    metric: "sleep_hours",
                    value: sleep,
                    unit: "h",
                    measuredAt: isoDate,
                    externalId: "sleep-\(isoDate)"
                )
            )
        }

        if let hr = snapshot.restingHeartRate {
            samples.append(
                Sample(
                    metric: "heart_rate_resting",
                    value: hr,
                    unit: "bpm",
                    measuredAt: isoDate,
                    externalId: "resting-hr-\(isoDate)"
                )
            )
        }

        if let weight = snapshot.bodyWeightKg {
            samples.append(
                Sample(
                    metric: "weight_kg",
                    value: weight,
                    unit: "kg",
                    measuredAt: isoDate,
                    externalId: "weight-\(isoDate)"
                )
            )
        }

        if let bp = snapshot.bloodPressure {
            samples.append(
                Sample(
                    metric: "blood_pressure_systolic",
                    value: bp.systolic,
                    unit: "mmHg",
                    measuredAt: isoDate,
                    externalId: "bp-sys-\(isoDate)"
                )
            )
            samples.append(
                Sample(
                    metric: "blood_pressure_diastolic",
                    value: bp.diastolic,
                    unit: "mmHg",
                    measuredAt: isoDate,
                    externalId: "bp-dia-\(isoDate)"
                )
            )
        }

        return samples
    }
}

private struct PatchPayload: Encodable {
    let userId: String
    let status: String
}

private struct PostPayload: Encodable {
    let userId: String
    let samples: [Sample]
}

private struct Sample: Encodable {
    let metric: String
    let value: Double
    let unit: String
    let measuredAt: String
    let externalId: String
}

enum SyncError: LocalizedError {
    case invalidUserId
    case invalidResponse
    case serverError(code: Int, body: String?)

    var errorDescription: String? {
        switch self {
        case .invalidUserId:
            return "userId inválido (debe ser UUID)"
        case .invalidResponse:
            return "Respuesta inválida del servidor"
        case .serverError(let code, let body):
            if let body, !body.isEmpty {
                return "Servidor \(code): \(body)"
            }
            return "Servidor \(code)"
        }
    }
}
