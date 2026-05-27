import Foundation

final class HealthSyncService {
    static let shared = HealthSyncService()

    // Replace with your deployed Vercel domain.
    private let endpoint = URL(string: "https://care-bridge-pwa-three.vercel.app/api/health-sync")!

    func sync(snapshot: HealthSnapshot) async throws {
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let payload = HealthSyncPayload(snapshot: snapshot)
        request.httpBody = try JSONEncoder().encode(payload)

        let (_, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw SyncError.serverError
        }
    }
}

enum SyncError: LocalizedError {
    case serverError

    var errorDescription: String? {
        switch self {
        case .serverError:
            return "No se pudo sincronizar con el servidor"
        }
    }
}
