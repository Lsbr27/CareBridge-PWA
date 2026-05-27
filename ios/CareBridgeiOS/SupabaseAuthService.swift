import Foundation

struct AuthUser {
    let id: String
    let email: String
    let accessToken: String
}

final class SupabaseAuthService {
    static let shared = SupabaseAuthService()

    private let supabaseURL = "https://ggqxtmwozsdmwxohvupu.supabase.co"
    private let anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdncXh0bXdvenNkbXd4b2h2dXB1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NDU0MDgsImV4cCI6MjA5MTMyMTQwOH0.AO1iy-V0DmiCE08p4MS5HdASOB1_gP_g_cVbseUcpUs"

    func signIn(email: String, password: String) async throws -> AuthUser {
        guard !email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              !password.isEmpty else {
            throw AuthError.missingCredentials
        }

        guard let url = URL(string: "\(supabaseURL)/auth/v1/token?grant_type=password") else {
            throw AuthError.invalidConfiguration
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(anonKey, forHTTPHeaderField: "apikey")

        let payload = SignInPayload(email: email, password: password)
        request.httpBody = try JSONEncoder().encode(payload)

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw AuthError.invalidResponse
        }

        guard (200...299).contains(http.statusCode) else {
            let message = String(data: data, encoding: .utf8) ?? ""
            throw AuthError.signInFailed(message)
        }

        let decoded = try JSONDecoder().decode(SupabaseSignInResponse.self, from: data)
        return AuthUser(id: decoded.user.id, email: decoded.user.email ?? email, accessToken: decoded.accessToken)
    }
}

private struct SignInPayload: Encodable {
    let email: String
    let password: String
}

private struct SupabaseSignInResponse: Decodable {
    let accessToken: String
    let user: SupabaseUser

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case user
    }
}

private struct SupabaseUser: Decodable {
    let id: String
    let email: String?
}

enum AuthError: LocalizedError {
    case missingCredentials
    case invalidConfiguration
    case invalidResponse
    case signInFailed(String)

    var errorDescription: String? {
        switch self {
        case .missingCredentials:
            return "Ingresa correo y contraseña"
        case .invalidConfiguration:
            return "Configuración de autenticación inválida"
        case .invalidResponse:
            return "Respuesta inválida del servidor"
        case .signInFailed(let message):
            return "No se pudo iniciar sesión: \(message)"
        }
    }
}
