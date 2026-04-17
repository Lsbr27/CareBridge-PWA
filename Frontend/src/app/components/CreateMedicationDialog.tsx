"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Plus, X } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import type { CreateMedicationInput } from "../hooks/useMedications";

export interface CreateMedicationDialogProps {
  onCreateMedication: (input: CreateMedicationInput) => Promise<void>;
  loading?: boolean;
}

export function CreateMedicationDialog({
  onCreateMedication,
  loading = false,
}: CreateMedicationDialogProps) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<CreateMedicationInput>({
    name: "",
    dosage: "",
    schedule_time: "09:00",
    frequency: "",
    notes: "",
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      alert("Please enter medication name");
      return;
    }

    try {
      setSubmitting(true);
      await onCreateMedication(formData);
      setFormData({
        name: "",
        dosage: "",
        schedule_time: "09:00",
        frequency: "",
        notes: "",
      });
      setOpen(false);
    } catch (error) {
      console.error("Error creating medication:", error);
      alert(error instanceof Error ? error.message : "Failed to create medication");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="flex h-11 w-11 items-center justify-center rounded-full bg-white/80 text-slate-700 shadow-[0_10px_28px_rgba(143,162,184,0.18)] hover:bg-white disabled:opacity-50">
          <Plus className="h-5 w-5" />
        </button>
      </DialogTrigger>
      <DialogContent className="w-full max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Add New Medication</DialogTitle>
          <DialogDescription>
            Create a new medication reminder with details and schedule.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
          >
            <Label htmlFor="name" className="text-sm font-medium text-slate-700">
              Medication Name *
            </Label>
            <Input
              id="name"
              name="name"
              placeholder="e.g., Aspirin"
              value={formData.name}
              onChange={handleInputChange}
              disabled={submitting}
              className="mt-1"
              required
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Label htmlFor="dosage" className="text-sm font-medium text-slate-700">
              Dosage
            </Label>
            <Input
              id="dosage"
              name="dosage"
              placeholder="e.g., 2 tablets"
              value={formData.dosage || ""}
              onChange={handleInputChange}
              disabled={submitting}
              className="mt-1"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <Label htmlFor="schedule_time" className="text-sm font-medium text-slate-700">
              Time
            </Label>
            <Input
              id="schedule_time"
              name="schedule_time"
              type="time"
              value={formData.schedule_time || "09:00"}
              onChange={handleInputChange}
              disabled={submitting}
              className="mt-1"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Label htmlFor="frequency" className="text-sm font-medium text-slate-700">
              Frequency
            </Label>
            <Input
              id="frequency"
              name="frequency"
              placeholder="e.g., Daily, Twice daily"
              value={formData.frequency || ""}
              onChange={handleInputChange}
              disabled={submitting}
              className="mt-1"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <Label htmlFor="notes" className="text-sm font-medium text-slate-700">
              Notes
            </Label>
            <Input
              id="notes"
              name="notes"
              placeholder="e.g., Take with food"
              value={formData.notes || ""}
              onChange={handleInputChange}
              disabled={submitting}
              className="mt-1"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex gap-3 pt-4"
          >
            <DialogClose asChild>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                disabled={submitting}
              >
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="submit"
              className="flex-1"
              disabled={submitting || loading}
            >
              {submitting ? "Creating..." : "Create Medication"}
            </Button>
          </motion.div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
