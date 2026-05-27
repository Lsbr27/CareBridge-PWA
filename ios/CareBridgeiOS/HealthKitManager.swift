import Foundation
import HealthKit

struct HealthSnapshot {
    let stepsToday: Int
    let sleepHoursLastNight: Double?
    let restingHeartRate: Double?
    let bodyWeightKg: Double?
    let bloodPressure: (systolic: Double, diastolic: Double)?
    let updatedAt: Date
}

struct HealthSyncPayload: Encodable {
    struct BloodPressure: Encodable {
        let systolic: Double
        let diastolic: Double
    }

    let stepsToday: Int
    let sleepHoursLastNight: Double?
    let restingHeartRate: Double?
    let bodyWeightKg: Double?
    let bloodPressure: BloodPressure?
    let updatedAt: String

    init(snapshot: HealthSnapshot) {
        let formatter = ISO8601DateFormatter()
        stepsToday = snapshot.stepsToday
        sleepHoursLastNight = snapshot.sleepHoursLastNight
        restingHeartRate = snapshot.restingHeartRate
        bodyWeightKg = snapshot.bodyWeightKg
        if let bp = snapshot.bloodPressure {
            bloodPressure = BloodPressure(systolic: bp.systolic, diastolic: bp.diastolic)
        } else {
            bloodPressure = nil
        }
        updatedAt = formatter.string(from: snapshot.updatedAt)
    }
}

final class HealthKitManager {
    static let shared = HealthKitManager()

    private let healthStore = HKHealthStore()

    private let stepsType = HKQuantityType.quantityType(forIdentifier: .stepCount)
    private let sleepType = HKObjectType.categoryType(forIdentifier: .sleepAnalysis)
    private let restingHeartRateType = HKQuantityType.quantityType(forIdentifier: .restingHeartRate)
    private let bodyMassType = HKQuantityType.quantityType(forIdentifier: .bodyMass)
    private let systolicType = HKQuantityType.quantityType(forIdentifier: .bloodPressureSystolic)
    private let diastolicType = HKQuantityType.quantityType(forIdentifier: .bloodPressureDiastolic)
    private var lastKnownStepsToday = 0

    func requestAuthorization(completion: @escaping (Result<Void, Error>) -> Void) {
        guard HKHealthStore.isHealthDataAvailable() else {
            completion(.failure(HealthError.healthDataNotAvailable))
            return
        }

        guard
            let stepsType,
            let sleepType,
            let restingHeartRateType,
            let bodyMassType,
            let systolicType,
            let diastolicType
        else {
            completion(.failure(HealthError.dataTypesUnavailable))
            return
        }

        let readTypes: Set<HKObjectType> = [
            stepsType,
            sleepType,
            restingHeartRateType,
            bodyMassType,
            systolicType,
            diastolicType
        ]

        healthStore.requestAuthorization(toShare: [], read: readTypes) { success, error in
            if let error {
                completion(.failure(error))
                return
            }

            if success {
                completion(.success(()))
            } else {
                completion(.failure(HealthError.authorizationDenied))
            }
        }
    }

    func fetchSnapshot(completion: @escaping (Result<HealthSnapshot, Error>) -> Void) {
        fetchStepsToday { [weak self] stepsResult in
            guard let self else { return }

            let steps: Int
            switch stepsResult {
            case .success(let value):
                self.lastKnownStepsToday = value
                steps = value
            case .failure:
                // Preserve the last known steps to avoid overriding valid values with 0
                // when HealthKit temporarily returns no data for a strict predicate.
                steps = self.lastKnownStepsToday
            }

            self.fetchLastNightSleepHours { sleep in
                self.fetchLatestQuantity(for: self.restingHeartRateType, unit: HKUnit.count().unitDivided(by: .minute())) { hr in
                    self.fetchLatestQuantity(for: self.bodyMassType, unit: .gramUnit(with: .kilo)) { weight in
                        self.fetchLatestBloodPressure { bloodPressure in
                            completion(.success(HealthSnapshot(
                                stepsToday: steps,
                                sleepHoursLastNight: sleep,
                                restingHeartRate: hr,
                                bodyWeightKg: weight,
                                bloodPressure: bloodPressure,
                                updatedAt: Date()
                            )))
                        }
                    }
                }
            }
        }
    }

    private func fetchStepsToday(completion: @escaping (Result<Int, Error>) -> Void) {
        guard let stepsType else {
            completion(.failure(HealthError.dataTypesUnavailable))
            return
        }

        let calendar = Calendar.autoupdatingCurrent
        let now = Date()
        let startOfDay = calendar.startOfDay(for: now)
        guard let anchorDate = calendar.date(bySettingHour: 0, minute: 0, second: 0, of: now) else {
            completion(.failure(HealthError.dataTypesUnavailable))
            return
        }

        let interval = DateComponents(day: 1)
        let query = HKStatisticsCollectionQuery(
            quantityType: stepsType,
            quantitySamplePredicate: nil,
            options: .cumulativeSum,
            anchorDate: anchorDate,
            intervalComponents: interval
        )

        query.initialResultsHandler = { _, collection, error in
            if let error {
                completion(.failure(error))
                return
            }

            var count = 0
            collection?.enumerateStatistics(from: startOfDay, to: now) { stats, _ in
                count = Int(stats.sumQuantity()?.doubleValue(for: .count()) ?? 0)
            }

            completion(.success(count))
        }

        healthStore.execute(query)
    }

    private func fetchLastNightSleepHours(completion: @escaping (Double?) -> Void) {
        guard let sleepType else {
            completion(nil)
            return
        }

        let start = Calendar.current.date(byAdding: .day, value: -2, to: Date()) ?? Date.distantPast
        let predicate = HKQuery.predicateForSamples(withStart: start, end: Date(), options: .strictStartDate)
        let sort = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)

        let query = HKSampleQuery(sampleType: sleepType, predicate: predicate, limit: 50, sortDescriptors: [sort]) { _, samples, _ in
            guard let categorySamples = samples as? [HKCategorySample], !categorySamples.isEmpty else {
                completion(nil)
                return
            }

            let asleepSamples = categorySamples.filter { sample in
                if #available(iOS 16.0, *) {
                    return sample.value == HKCategoryValueSleepAnalysis.asleepCore.rawValue
                        || sample.value == HKCategoryValueSleepAnalysis.asleepDeep.rawValue
                        || sample.value == HKCategoryValueSleepAnalysis.asleepREM.rawValue
                        || sample.value == HKCategoryValueSleepAnalysis.asleepUnspecified.rawValue
                } else {
                    return sample.value == HKCategoryValueSleepAnalysis.asleep.rawValue
                }
            }

            let seconds = asleepSamples.reduce(0.0) { partial, sample in
                partial + sample.endDate.timeIntervalSince(sample.startDate)
            }

            completion(seconds > 0 ? (seconds / 3600.0) : nil)
        }

        healthStore.execute(query)
    }

    private func fetchLatestQuantity(for type: HKQuantityType?, unit: HKUnit, completion: @escaping (Double?) -> Void) {
        guard let type else {
            completion(nil)
            return
        }

        let sort = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)
        let query = HKSampleQuery(sampleType: type, predicate: nil, limit: 1, sortDescriptors: [sort]) { _, samples, _ in
            guard let sample = samples?.first as? HKQuantitySample else {
                completion(nil)
                return
            }

            completion(sample.quantity.doubleValue(for: unit))
        }

        healthStore.execute(query)
    }

    private func fetchLatestBloodPressure(completion: @escaping ((systolic: Double, diastolic: Double)?) -> Void) {
        fetchLatestQuantity(for: systolicType, unit: .millimeterOfMercury()) { [self] systolic in
            self.fetchLatestQuantity(for: diastolicType, unit: .millimeterOfMercury()) { diastolic in
                guard let systolic, let diastolic else {
                    completion(nil)
                    return
                }

                completion((systolic, diastolic))
            }
        }
    }
}

enum HealthError: LocalizedError {
    case healthDataNotAvailable
    case dataTypesUnavailable
    case authorizationDenied

    var errorDescription: String? {
        switch self {
        case .healthDataNotAvailable:
            return "HealthKit no está disponible en este dispositivo."
        case .dataTypesUnavailable:
            return "No se pudieron preparar los tipos de datos de Apple Health."
        case .authorizationDenied:
            return "Permiso denegado para leer Apple Health."
        }
    }
}
