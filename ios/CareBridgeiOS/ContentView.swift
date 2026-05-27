import SwiftUI

struct ContentView: View {
    @State private var status = "Aún no conectado"
    @State private var syncStatus = "Aún no sincronizado"
    @State private var authStatus = "No has iniciado sesión"
    @State private var isRequesting = false
    @State private var isSigningIn = false
    @State private var isConnected = false
    @State private var snapshot: HealthSnapshot?
    @AppStorage("carebridge_profile_id") private var profileId = ""
    @AppStorage("carebridge_email") private var email = ""
    @AppStorage("carebridge_access_token") private var accessToken = ""

    private let manager = HealthKitManager.shared

    var body: some View {
        VStack(spacing: 16) {
            Text("CareBridge iOS")
                .font(.title2)
                .bold()

            Text(status)
                .font(.footnote)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)

            Button(profileId.isEmpty ? "Continuar con Google" : "Sesión iniciada") {
                Task {
                    await signInWithGoogle()
                }
            }
            .buttonStyle(.bordered)
            .disabled(isSigningIn || !profileId.isEmpty)

            if !email.isEmpty {
                Text(email)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }

            Text(authStatus)
                .font(.footnote)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)

            Button(isConnected ? "Apple Health conectado" : "Conectar Apple Health") {
                connectAndLoadData()
            }
            .buttonStyle(.borderedProminent)
            .disabled(isRequesting || isConnected || profileId.isEmpty)

            if let snapshot {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Resumen de hoy")
                        .font(.headline)

                    metricRow(title: "Actividad", value: activityLabel(for: snapshot.stepsToday))
                    metricRow(title: "Peso registrado", value: formattedKg(snapshot.bodyWeightKg))

                    if let sleep = snapshot.sleepHoursLastNight {
                        metricRow(title: "Sueño", value: String(format: "%.1f h", sleep))
                    }

                    if let hr = snapshot.restingHeartRate {
                        metricRow(title: "FC en reposo", value: String(format: "%.0f lpm", hr))
                    }

                    if let bp = snapshot.bloodPressure {
                        metricRow(title: "Presión arterial", value: "\(Int(bp.systolic))/\(Int(bp.diastolic)) mmHg")
                    }

                    Text(availabilityHint(snapshot))
                        .font(.footnote)
                        .foregroundStyle(.secondary)

                    metricRow(title: "Última actualización", value: snapshot.updatedAt.formatted(date: .abbreviated, time: .shortened))
                    metricRow(title: "Sync Vercel", value: syncStatus)
                }
                .font(.subheadline)
                .padding()
                .background(Color(.secondarySystemBackground))
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .padding(.top, 8)
            }
        }
        .padding()
        .onAppear {
            if !profileId.isEmpty {
                authStatus = "Sesión activa"
            }
        }
    }

    private func signInWithGoogle() async {
        isSigningIn = true
        defer { isSigningIn = false }

        do {
            let user = try await GoogleOAuthService.shared.signInWithGoogle()
            await MainActor.run {
                profileId = user.id
                email = user.email
                accessToken = user.accessToken
                authStatus = "Sesión iniciada: \(user.email)"
            }
        } catch {
            await MainActor.run {
                authStatus = error.localizedDescription
            }
        }
    }

    private func connectAndLoadData() {
        isRequesting = true
        status = "Solicitando permisos de Apple Health..."

        manager.requestAuthorization { result in
            DispatchQueue.main.async {
                switch result {
                case .failure(let error):
                    isRequesting = false
                    status = error.localizedDescription
                case .success:
                    isConnected = true
                    status = "Permisos concedidos. Cargando datos..."
                    loadHealthData()
                }
            }
        }
    }

    private func loadHealthData() {
        manager.fetchSnapshot { result in
            DispatchQueue.main.async {
                isRequesting = false

                switch result {
                case .failure(let error):
                    status = "Conectado, pero hubo un error leyendo datos: \(error.localizedDescription)"
                case .success(let snapshot):
                    self.snapshot = snapshot
                    status = "Permisos concedidos. Apple Health conectado."
                    syncStatus = "Sincronizando..."
                    Task {
                        await syncToServer(snapshot)
                    }
                }
            }
        }
    }

    private func syncToServer(_ snapshot: HealthSnapshot) async {
        guard !accessToken.isEmpty else {
            await MainActor.run {
                syncStatus = "Falta sesión válida. Cierra e inicia sesión de nuevo."
            }
            return
        }

        do {
            try await HealthSyncService.shared.sync(snapshot: snapshot, userId: profileId, accessToken: accessToken)
            await MainActor.run {
                syncStatus = "OK"
            }
        } catch {
            await MainActor.run {
                syncStatus = error.localizedDescription
            }
        }
    }

    private func metricRow(title: String, value: String) -> some View {
        HStack {
            Text(title)
                .foregroundStyle(.secondary)
            Spacer()
            Text(value)
                .bold()
        }
    }

    private func formattedHours(_ value: Double?) -> String {
        guard let value else { return "Sin datos" }
        return String(format: "%.1f h", value)
    }

    private func activityLabel(for steps: Int) -> String {
        switch steps {
        case 0:
            return "Sin pasos registrados hoy"
        case 1..<3000:
            return "\(steps) pasos · actividad ligera"
        case 3000..<8000:
            return "\(steps) pasos · buen progreso"
        default:
            return "\(steps) pasos · excelente actividad"
        }
    }

    private func availabilityHint(_ snapshot: HealthSnapshot) -> String {
        var pending: [String] = []
        if snapshot.sleepHoursLastNight == nil { pending.append("sueño") }
        if snapshot.restingHeartRate == nil { pending.append("FC reposo") }
        if snapshot.bloodPressure == nil { pending.append("presión") }

        if pending.isEmpty {
            return "Tus métricas clave están completas."
        }

        return "Pendiente por sincronizar: \(pending.joined(separator: ", "))."
    }

    private func formattedBPM(_ value: Double?) -> String {
        guard let value else { return "Sin datos" }
        return String(format: "%.0f lpm", value)
    }

    private func formattedKg(_ value: Double?) -> String {
        guard let value else { return "Sin datos" }
        return String(format: "%.1f kg", value)
    }

    private func formattedBloodPressure(_ value: (systolic: Double, diastolic: Double)?) -> String {
        guard let value else { return "Sin datos" }
        return "\(Int(value.systolic))/\(Int(value.diastolic)) mmHg"
    }
}

#Preview {
    ContentView()
}
