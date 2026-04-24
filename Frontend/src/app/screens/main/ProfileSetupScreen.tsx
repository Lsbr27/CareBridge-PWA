"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, FileHeart, LoaderCircle, Sparkles, UserRound } from "lucide-react";
import { motion } from "motion/react";
import { GlassCard } from "../../components/GlassCard";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { Label } from "../../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Button } from "../../components/ui/button";
import { useAuth } from "../../providers/AuthProvider";

const genderOptions = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "non_binary", label: "Non-binary" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

export function ProfileSetupScreen() {
  const { profile, user, updateProfile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEditMode = searchParams.get("mode") === "edit";
  const [fullName, setFullName] = useState(
    profile?.full_name || user?.user_metadata?.full_name || "",
  );
  const [dateOfBirth, setDateOfBirth] = useState(profile?.date_of_birth || "");
  const [gender, setGender] = useState(profile?.gender || "");
  const [diagnosis, setDiagnosis] = useState(profile?.diagnosis || "");
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setIsSaving(true);
      await updateProfile({
        full_name: fullName.trim(),
        date_of_birth: dateOfBirth,
        gender,
        diagnosis,
      });
      router.replace(isEditMode ? "/app/profile" : "/app");
    } catch (error) {
      console.error("Profile update failed", error);
      window.alert("We couldn't save your profile yet. Please try again.");
      setIsSaving(false);
    }
  }

  return (
    <div className="p-6 pt-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <div className="inline-flex items-center gap-2 rounded-full bg-white/60 px-3 py-1 text-xs uppercase tracking-[0.3em] text-purple-600 backdrop-blur-xl">
          <Sparkles className="h-3.5 w-3.5" />
          {isEditMode ? "Edit mode" : "First step"}
        </div>
        <h1 className="mt-4 text-3xl font-light text-gray-800">
          {isEditMode ? "Edit your profile" : "Complete your patient profile"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-gray-500">
          We only need a few essentials to personalize your medications, daily logs, and appointments.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <GlassCard className="bg-gradient-to-br from-rose-100/60 via-white/50 to-amber-100/50 p-5">
          <div className="mb-5 flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/80">
              <UserRound className="h-6 w-6 text-rose-500" />
            </div>
            <div>
              <h2 className="text-lg font-medium text-gray-800">Your care baseline</h2>
              <p className="text-sm text-gray-500">
                These fields stay private and are protected by Supabase Row Level Security.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full-name">Full name</Label>
              <Input
                id="full-name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Laura Sofia Baquero"
                required
                className="h-11 rounded-xl border-white/70 bg-white/75"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="date-of-birth">Date of birth</Label>
                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    id="date-of-birth"
                    type="date"
                    value={dateOfBirth}
                    onChange={(event) => setDateOfBirth(event.target.value)}
                    required
                    className="h-11 rounded-xl border-white/70 bg-white/75 pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="gender">Gender</Label>
                <Select value={gender} onValueChange={setGender}>
                  <SelectTrigger
                    id="gender"
                    className="h-11 rounded-xl border-white/70 bg-white/75"
                    aria-label="Gender"
                  >
                    <SelectValue placeholder="Select a value" />
                  </SelectTrigger>
                  <SelectContent>
                    {genderOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="diagnosis">Initial diagnosis or notes</Label>
              <div className="relative">
                <FileHeart className="pointer-events-none absolute top-3 left-3 h-4 w-4 text-gray-400" />
                <Textarea
                  id="diagnosis"
                  value={diagnosis}
                  onChange={(event) => setDiagnosis(event.target.value)}
                  placeholder="Optional. Example: hypothyroidism, hypertension, migraine follow-up..."
                  className="min-h-28 rounded-xl border-white/70 bg-white/75 pl-10"
                />
              </div>
            </div>

            <div className="rounded-2xl bg-white/55 px-4 py-3 text-sm text-gray-600">
              Once this is saved, we can start attaching medications, daily logs, and appointments to your profile.
            </div>

            <Button
              type="submit"
              disabled={isSaving || !gender}
              className="h-12 w-full rounded-2xl bg-gradient-to-r from-rose-400 to-amber-400 text-white shadow-lg shadow-rose-200/70 hover:from-rose-500 hover:to-amber-500"
            >
              {isSaving ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Saving profile...
                </>
              ) : (
                "Save and enter my app"
              )}
            </Button>
          </form>
        </GlassCard>
      </motion.div>
    </div>
  );
}
