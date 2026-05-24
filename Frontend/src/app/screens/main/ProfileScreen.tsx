"use client";

import { motion } from "motion/react";
import { 
  User, 
  Mail, 
  Phone, 
  Calendar, 
  MapPin,
  Activity,
  Clock,
  Heart,
  Pill,
  Settings,
  Bell,
  Shield,
  LogOut,
  ChevronRight
} from "lucide-react";
import { GlassCard } from "../../components/GlassCard";
import { useAuth } from "../../providers/AuthProvider";
import { useMemo, useState } from "react";
import { supabase } from "../../../../lib/supabase";
import { useRouter } from "next/navigation";

const profileInfo = {
  name: "Sarah Johnson",
  email: "sarah.johnson@email.com",
  phone: "+1 (555) 123-4567",
  dob: "April 15, 1984",
  location: "San Francisco, CA",
  memberId: "CM-2847",
};

const healthHistory = [
  { category: "Active Symptoms", count: 2, icon: Activity, color: "from-red-200/50 to-orange-200/50" },
  { category: "Medical History", count: 1, icon: Clock, color: "from-blue-200/50 to-cyan-200/50" },
  { category: "Lifestyle Factors", count: 2, icon: Heart, color: "from-green-200/50 to-emerald-200/50" },
  { category: "Medications", count: 1, icon: Pill, color: "from-purple-200/50 to-pink-200/50" },
];

const settingsOptions = [
  { label: "Notifications", icon: Bell, color: "text-purple-600" },
  { label: "Privacy & Security", icon: Shield, color: "text-blue-600" },
  { label: "Account Settings", icon: Settings, color: "text-gray-600" },
];

export function ProfileScreen() {
  const { profile, user, signOut, updateProfile } = useAuth();
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [isUpdatingPhone, setIsUpdatingPhone] = useState(false);
  const [isUpdatingLocation, setIsUpdatingLocation] = useState(false);
  const profileName =
    profile?.full_name ||
    user?.user_metadata?.full_name ||
    profileInfo.name;
  const profileEmail = user?.email || profileInfo.email;
  const phone = profile?.phone || profileInfo.phone;
  const memberId = user?.id.slice(0, 8).toUpperCase() || profileInfo.memberId;
  const location = profile?.location || profileInfo.location;
  const dateOfBirth = profile?.date_of_birth
    ? new Date(`${profile.date_of_birth}T00:00:00`).toLocaleDateString()
    : profileInfo.dob;
  const healthTags = useMemo(() => {
    const tags = [];

    if (profile?.gender) {
      tags.push(profile.gender);
    }

    if (profile?.diagnosis) {
      tags.push(profile.diagnosis);
    }

    return tags.slice(0, 2);
  }, [profile?.diagnosis, profile?.gender]);

  async function handleSignOut() {
    try {
      setIsSigningOut(true);
      await signOut();
    } catch (error) {
      console.error("Sign out failed", error);
      window.alert("We couldn't sign you out. Please try again.");
      setIsSigningOut(false);
    }
  }

  function handleEditProfile() {
    router.push("/app/profile/setup?mode=edit");
  }

  async function handleChangeEmail() {
    const nextEmail = window.prompt("Enter your new email", profileEmail);

    if (nextEmail === null) {
      return;
    }

    const trimmedEmail = nextEmail.trim().toLowerCase();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(trimmedEmail)) {
      window.alert("Please enter a valid email address.");
      return;
    }

    try {
      setIsUpdatingEmail(true);
      const { error } = await supabase.auth.updateUser({ email: trimmedEmail });

      if (error) {
        throw error;
      }

      window.alert("Email update requested. Please check your inbox to confirm the change.");
    } catch (error) {
      console.error("Email update failed", error);
      window.alert("We couldn't update your email. Please try again.");
    } finally {
      setIsUpdatingEmail(false);
    }
  }

  async function handleChangeLocation() {
    const nextLocation = window.prompt("Enter your location", location);

    if (nextLocation === null) {
      return;
    }

    const trimmedLocation = nextLocation.trim();

    if (!trimmedLocation) {
      window.alert("Location cannot be empty.");
      return;
    }

    try {
      setIsUpdatingLocation(true);
      await updateProfile({ location: trimmedLocation });
      window.alert("Location updated.");
    } catch (error) {
      console.error("Location update failed", error);
      window.alert("We couldn't update your location. Please try again.");
    } finally {
      setIsUpdatingLocation(false);
    }
  }

  async function handleChangePhone() {
    const nextPhone = window.prompt("Enter your phone number", phone);

    if (nextPhone === null) {
      return;
    }

    const trimmedPhone = nextPhone.trim();

    if (!trimmedPhone) {
      window.alert("Phone cannot be empty.");
      return;
    }

    try {
      setIsUpdatingPhone(true);
      await updateProfile({ phone: trimmedPhone });
      window.alert("Phone updated.");
    } catch (error) {
      console.error("Phone update failed", error);
      window.alert("We couldn't update your phone. Please try again.");
    } finally {
      setIsUpdatingPhone(false);
    }
  }

  return (
    <div className="p-6 pt-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h1 className="text-2xl font-light text-gray-800 mb-2">Profile</h1>
        <p className="text-sm text-gray-500">Manage your health information</p>
      </motion.div>

      {/* Profile Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="mb-6"
      >
        <GlassCard className="bg-gradient-to-br from-purple-100/50 to-pink-100/50">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-300 to-pink-300 flex items-center justify-center">
              <User className="w-10 h-10 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-light text-gray-800">{profileName}</h2>
              <p className="text-sm text-gray-500">ID: {memberId}</p>
              <div className="flex gap-2 mt-2">
                {healthTags.length > 0 ? (
                  healthTags.map((tag) => (
                    <span key={tag} className="text-xs bg-purple-200/60 text-purple-700 px-2 py-1 rounded-full">
                      {tag}
                    </span>
                  ))
                ) : (
                  <span className="text-xs bg-pink-200/60 text-pink-700 px-2 py-1 rounded-full">
                    CareMosaic member
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={handleEditProfile}
            className="w-full py-2 rounded-[16px] bg-white/50 text-gray-700 text-sm hover:bg-white/70 transition-colors"
          >
            Edit Profile
          </button>
        </GlassCard>
      </motion.div>

      {/* Contact Information */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-6"
      >
        <h3 className="text-sm text-gray-500 mb-3 uppercase tracking-wider">Contact Information</h3>
        <GlassCard className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100/70 flex items-center justify-center">
              <Mail className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-500">Email</p>
              <p className="text-sm text-gray-800">{profileEmail}</p>
            </div>
            <button
              onClick={handleChangeEmail}
              disabled={isUpdatingEmail}
              className="rounded-lg bg-white/60 px-3 py-1.5 text-xs text-blue-700 hover:bg-white/80 transition-colors disabled:opacity-70"
            >
              {isUpdatingEmail ? "Saving..." : "Change"}
            </button>
          </div>
          <div className="h-px bg-gray-200/50"></div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100/70 flex items-center justify-center">
              <Phone className="w-5 h-5 text-green-600" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-500">Phone</p>
              <p className="text-sm text-gray-800">{phone}</p>
            </div>
            <button
              onClick={handleChangePhone}
              disabled={isUpdatingPhone}
              className="rounded-lg bg-white/60 px-3 py-1.5 text-xs text-green-700 hover:bg-white/80 transition-colors disabled:opacity-70"
            >
              {isUpdatingPhone ? "Saving..." : "Change"}
            </button>
          </div>
          <div className="h-px bg-gray-200/50"></div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-100/70 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-purple-600" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-500">Date of Birth</p>
              <p className="text-sm text-gray-800">{dateOfBirth}</p>
            </div>
          </div>
          <div className="h-px bg-gray-200/50"></div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-100/70 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-orange-600" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-500">Location</p>
              <p className="text-sm text-gray-800">{location}</p>
            </div>
            <button
              onClick={handleChangeLocation}
              disabled={isUpdatingLocation}
              className="rounded-lg bg-white/60 px-3 py-1.5 text-xs text-orange-700 hover:bg-white/80 transition-colors disabled:opacity-70"
            >
              {isUpdatingLocation ? "Saving..." : "Change"}
            </button>
          </div>
        </GlassCard>
      </motion.div>

      {/* Health Data Summary */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mb-6"
      >
        <h3 className="text-sm text-gray-500 mb-3 uppercase tracking-wider">Health Data Summary</h3>
        <div className="grid grid-cols-2 gap-3">
          {healthHistory.map((item, index) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.category}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 + index * 0.05 }}
              >
                <GlassCard className="cursor-pointer hover:scale-105 transition-transform">
                  <div className={`bg-gradient-to-br ${item.color} rounded-[16px] p-4`}>
                    <Icon className="w-5 h-5 text-gray-700 mb-2" />
                    <p className="text-xs text-gray-600 mb-1">{item.category}</p>
                    <p className="text-2xl font-light text-gray-800">{item.count}</p>
                  </div>
                </GlassCard>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* Settings */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="mb-6"
      >
        <h3 className="text-sm text-gray-500 mb-3 uppercase tracking-wider">Settings</h3>
        <GlassCard className="divide-y divide-gray-200/30">
          {settingsOptions.map((option, index) => {
            const Icon = option.icon;
            return (
              <button
                key={option.label}
                className="w-full flex items-center justify-between py-4 first:pt-0 last:pb-0 hover:opacity-70 transition-opacity"
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${option.color}`} />
                  <span className="text-sm text-gray-800">{option.label}</span>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </button>
            );
          })}
        </GlassCard>
      </motion.div>

      {/* Sign Out */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
      >
        <button
          onClick={handleSignOut}
          disabled={isSigningOut}
          className="w-full py-4 rounded-[20px] bg-white/50 backdrop-blur-sm border border-white/60 text-red-600 font-medium flex items-center justify-center gap-2 hover:bg-white/70 transition-all disabled:opacity-70"
        >
          <LogOut className="w-5 h-5" />
          {isSigningOut ? "Signing out..." : "Sign Out"}
        </button>
      </motion.div>
    </div>
  );
}
