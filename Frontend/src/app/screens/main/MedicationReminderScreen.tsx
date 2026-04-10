"use client";

import { motion } from "motion/react";
import { BellRing, Pill } from "lucide-react";
import { MedicationReminderFeature } from "../../components/MedicationReminderFeature";

export function MedicationReminderScreen() {
  return (
    <div className="p-6 pt-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-light text-gray-800">Medication reminders</h1>
            <p className="mt-1 text-sm text-gray-500">
              Organize schedules, doses, and adherence in one place
            </p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-sky-500 text-white">
            <BellRing className="h-6 w-6" />
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-cyan-700">
          <Pill className="h-4 w-4" />
          Dedicated feature inspired by your medication reminder reference
        </div>
      </motion.div>

      <MedicationReminderFeature />
    </div>
  );
}
