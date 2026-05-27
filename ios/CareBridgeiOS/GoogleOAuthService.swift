import Foundation
import AuthenticationServices
import UIKit

struct GoogleAuthUser {
    let id: String
    let email: String
    let accessToken: String
}

final class GoogleOAuthService: NSObject {
    static let shared = GoogleOAuthService()

    private let supabaseURL = "https://ggqxtmwozsdmwxohvupu.supabase.co"
    private let anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdncXh0bXdvenNkbXd4b2h2dXB1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NDU0MDgsImV4cCI6MjA5MTMyMTQwOH0.AO1iy-V0DmiCE08p4MS5HdASOB1_gP_g_cVbseUcpUs"
    private let callbackScheme = "carebridgeios"
    private let callbackURL = "carebridgeios://auth/callback"

    private var authSession: ASWebAuthenticationSession?

    func signInWithGoogle() async throws -> GoogleAuthUser {
        let authURL = try buildAuthorizeURL()
        let callback = try await startWebAuth(url: authURL)
        let accessToken = try extractAccessToken(from: callback)
        let user = try await fetchUser(accessToken: accessToken)
        return GoogleAuthUser(id: user.id, email: user.email ?? "", accessToken: accessToken)
    }

    private func buildAuthorizeURL() throws -> URL {
        guard var components = URLComponents(string: "\(supabaseURL)/auth/v1/authorize") else {
            throw OAuthError.invalidConfiguration
        }

        components.queryItems = [
            URLQueryItem(name: "provider", value: "google"),
            URLQueryItem(name: "redirect_to", value: callbackURL)
        ]

        guard let url = components.url else {
            throw OAuthError.invalidConfiguration
        }
        return url
    }

    private func startWebAuth(url: URL) async throws -> URL {
        try await withCheckedThrowingContinuation { continuation in
            let session = ASWebAuthenticationSession(url: url, callbackURLScheme: callbackScheme) { callbackURL, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                guard let callbackURL else {
                    continuation.resume(throwing: OAuthError.missingCallback)
                    return
                }
                continuation.resume(returning: callbackURL)
            }

            session.prefersEphemeralWebBrowserSession = false
            session.presentationContextProvider = self
            authSession = session

            if !session.start() {
                continuation.resume(throwing: OAuthError.failedToStart)
            }
        }
    }

    private func extractAccessToken(from callback: URL) throws -> String {
        guard let fragment = callback.fragment else {
            throw OAuthError.missingToken
        }

        let pairs = fragment.split(separator: "&")
        let map = Dictionary(uniqueKeysWithValues: pairs.compactMap { pair -> (String, String)? in
            let parts = pair.split(separator: "=", maxSplits: 1).map(String.init)
            guard parts.count == 2 else { return nil }
            return (parts[0], parts[1].removingPercentEncoding ?? parts[1])
        })

        guard let token = map["access_token"], !token.isEmpty else {
            throw OAuthError.missingToken
        }
        return token
    }

    private func fetchUser(accessToken: String) async throws -> SupabaseOAuthUser {
        guard let url = URL(string: "\(supabaseURL)/auth/v1/user") else {
            throw OAuthError.invalidConfiguration
        }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        request.setValue(anonKey, forHTTPHeaderField: "apikey")

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw OAuthError.invalidResponse
        }

        guard (200...299).contains(http.statusCode) else {
            let body = String(data: data, encoding: .utf8) ?? ""
            throw OAuthError.serverError(http.statusCode, body)
        }

        return try JSONDecoder().decode(SupabaseOAuthUser.self, from: data)
    }
}

extension GoogleOAuthService: ASWebAuthenticationPresentationContextProviding {
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        if let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
           let window = scene.windows.first {
            return window
        }
        return ASPresentationAnchor()
    }
}

private struct SupabaseOAuthUser: Decodable {
    let id: String
    let email: String?
}

enum OAuthError: LocalizedError {
    case invalidConfiguration
    case failedToStart
    case missingCallback
    case missingToken
    case invalidResponse
    case serverError(Int, String)

    var errorDescription: String? {
        switch self {
        case .invalidConfiguration:
            return "Configuración OAuth inválida"
        case .failedToStart:
            return "No se pudo iniciar Google login"
        case .missingCallback:
            return "No se recibió callback de Google"
        case .missingToken:
            return "No se recibió access token"
        case .invalidResponse:
            return "Respuesta inválida del servidor"
        case .serverError(let code, let body):
            return "OAuth \(code): \(body)"
        }
    }
}
