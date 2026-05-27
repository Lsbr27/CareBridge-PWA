import SwiftUI

struct ContentView: View {
    @State private var status = "Aún no conectado"
    @State private var syncStatus = "Aún no sincronizado"
    @State private var isRequesting = false
    @State private var isConnected = false
    @State private var snapshot: HealthSnapshot?

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

            Button(isConnected ? "Apple Health conectado" : "Conectar Apple Health") {
                connectAndLoadData()
            }
            .buttonStyle(.borderedProminent)
            .disabled(isRequesting || isConnected)

            if let snapshot {
                VStack(alignment: .leading, spacing: 8) {
                    metricRow(title: "Pasos hoy", value: "\(snapshot.stepsToday)")
                    metricRow(title: "Sueño última noche", value: formattedHours(snapshot.sleepHoursLastNight))
                    metricRow(title: "FC en reposo", value: formattedBPM(snapshot.restingHeartRate))
                    metricRow(title: "Peso", value: formattedKg(snapshot.bodyWeightKg))
                    metricRow(title: "Presión arterial", value: formattedBloodPressure(snapshot.bloodPressure))
                    metricRow(title: "Actualizado", value: snapshot.updatedAt.formatted(date: .abbreviated, time: .shortened))
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
        do {
            try await HealthSyncService.shared.sync(snapshot: snapshot)
            await MainActor.run {
                syncStatus = "OK"
            }
        } catch {
            await MainActor.run {
                syncStatus = "Error"
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
