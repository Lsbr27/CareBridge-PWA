"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../providers/AuthProvider";

export type Medication = {
  id: string;
  profile_id: string;
  name: string;
  dosage: string | null;
  schedule_time: string | null;
  frequency: string | null;
  status: "pending" | "taken" | "skipped";
  notes: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateMedicationInput = {
  name: string;
  dosage?: string;
  schedule_time?: string;
  frequency?: string;
  notes?: string;
  start_date?: string;
  end_date?: string;
};

export type UpdateMedicationInput = Partial<CreateMedicationInput> & {
  status?: "pending" | "taken" | "skipped";
};

type UseMedicationsReturn = {
  medications: Medication[];
  loading: boolean;
  error: Error | null;
  createMedication: (input: CreateMedicationInput) => Promise<Medication>;
  updateMedication: (id: string, input: UpdateMedicationInput) => Promise<Medication>;
  deleteMedication: (id: string) => Promise<void>;
  markAsTaken: (id: string) => Promise<void>;
  markAsSkipped: (id: string) => Promise<void>;
};

export function useMedications(): UseMedicationsReturn {
  const { user } = useAuth();
  const [medications, setMedications] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);

  // Load medications from the database
  async function loadMedications(userId: string) {
    try {
      setLoading(true);
      setError(null);

      const { data, error: loadError } = await supabase
        .from("medications")
        .select("*")
        .eq("profile_id", userId)
        .order("schedule_time", { ascending: true });

      if (loadError) {
        throw loadError;
      }

      if (mountedRef.current) {
        setMedications(data || []);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to load medications");
      if (mountedRef.current) {
        setError(error);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }

  // Initialize: load medications when user is available
  useEffect(() => {
    mountedRef.current = true;

    if (user?.id) {
      loadMedications(user.id);
    } else {
      setMedications([]);
      setLoading(false);
    }

    return () => {
      mountedRef.current = false;
    };
  }, [user?.id]);

  async function createMedication(input: CreateMedicationInput): Promise<Medication> {
    if (!user?.id) {
      throw new Error("No authenticated user found.");
    }

    const payload = {
      profile_id: user.id,
      name: input.name,
      dosage: input.dosage?.trim() || null,
      schedule_time: input.schedule_time || null,
      frequency: input.frequency?.trim() || null,
      notes: input.notes?.trim() || null,
      start_date: input.start_date || null,
      end_date: input.end_date || null,
      status: "pending" as const,
    };

    const { data, error: createError } = await supabase
      .from("medications")
      .insert([payload])
      .select()
      .single();

    if (createError) {
      throw createError;
    }

    if (mountedRef.current) {
      setMedications((prev) => [...prev, data].sort((a, b) => {
        const timeA = a.schedule_time || "23:59";
        const timeB = b.schedule_time || "23:59";
        return timeA.localeCompare(timeB);
      }));
    }

    return data;
  }

  async function updateMedication(
    id: string,
    input: UpdateMedicationInput
  ): Promise<Medication> {
    if (!user?.id) {
      throw new Error("No authenticated user found.");
    }

    const payload: Record<string, unknown> = {};

    if (input.name !== undefined) payload.name = input.name;
    if (input.dosage !== undefined) payload.dosage = input.dosage?.trim() || null;
    if (input.schedule_time !== undefined) payload.schedule_time = input.schedule_time || null;
    if (input.frequency !== undefined) payload.frequency = input.frequency?.trim() || null;
    if (input.notes !== undefined) payload.notes = input.notes?.trim() || null;
    if (input.start_date !== undefined) payload.start_date = input.start_date || null;
    if (input.end_date !== undefined) payload.end_date = input.end_date || null;
    if (input.status !== undefined) payload.status = input.status;

    const { data, error: updateError } = await supabase
      .from("medications")
      .update(payload)
      .eq("id", id)
      .eq("profile_id", user.id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    if (mountedRef.current) {
      setMedications((prev) =>
        prev.map((med) => (med.id === id ? data : med))
      );
    }

    return data;
  }

  async function deleteMedication(id: string): Promise<void> {
    if (!user?.id) {
      throw new Error("No authenticated user found.");
    }

    const { error: deleteError } = await supabase
      .from("medications")
      .delete()
      .eq("id", id)
      .eq("profile_id", user.id);

    if (deleteError) {
      throw deleteError;
    }

    if (mountedRef.current) {
      setMedications((prev) => prev.filter((med) => med.id !== id));
    }
  }

  async function markAsTaken(id: string): Promise<void> {
    await updateMedication(id, { status: "taken" });
  }

  async function markAsSkipped(id: string): Promise<void> {
    await updateMedication(id, { status: "skipped" });
  }

  return {
    medications,
    loading,
    error,
    createMedication,
    updateMedication,
    deleteMedication,
    markAsTaken,
    markAsSkipped,
  };
}
