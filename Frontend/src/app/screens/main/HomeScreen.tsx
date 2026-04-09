import { motion } from "motion/react";
import { 
  Activity, 
  Heart, 
  Pill, 
  Clock, 
  TrendingUp, 
  Calendar,
  AlertCircle,
  User as UserIcon
} from "lucide-react";
import { GlassCard } from "../../components/GlassCard";
import { useAuth } from "../../providers/AuthProvider";

const healthData = [
  {
    category: "Active Symptoms",
    icon: Activity,
    color: "from-red-100/70 to-orange-100/70",
    iconColor: "text-red-600",
    items: ["Persistent headaches", "Dizziness"],
    count: 2,
  },
  {
    category: "Medications",
    icon: Pill,
    color: "from-purple-100/70 to-pink-100/70",
    iconColor: "text-purple-600",
    items: ["Aspirin 81mg"],
    count: 1,
  },
  {
    category: "Lifestyle",
    icon: Heart,
    color: "from-green-100/70 to-emerald-100/70",
    iconColor: "text-green-600",
    items: ["Daily exercise", "Irregular sleep"],
    count: 2,
  },
  {
    category: "Medical History",
    icon: Clock,
    color: "from-blue-100/70 to-cyan-100/70",
    iconColor: "text-blue-600",
    items: ["High blood pressure"],
    count: 1,
  },
];

export function HomeScreen() {
  const { profile, user } = useAuth();
  const displayName =
    profile?.full_name ||
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "there";

  return (
    <div className="p-6 pt-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl font-light text-gray-800">Welcome back</h1>
            <p className="text-sm text-gray-500 mt-1">{displayName}</p>
          </div>
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-300 to-pink-300 flex items-center justify-center">
            <UserIcon className="w-6 h-6 text-white" />
          </div>
        </div>
      </motion.div>

      {/* Health Score Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="mb-6"
      >
        <GlassCard className="bg-gradient-to-br from-purple-100/60 to-pink-100/60">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-medium text-gray-800">Health Score</h3>
            <TrendingUp className="w-5 h-5 text-purple-600" />
          </div>
          <div className="flex items-end gap-2 mb-3">
            <span className="text-5xl font-light text-gray-800">72</span>
            <span className="text-xl text-gray-500 mb-2">/100</span>
          </div>
          <div className="h-3 w-full bg-white/50 rounded-full overflow-hidden mb-3">
            <div className="h-full w-[72%] bg-gradient-to-r from-purple-400 to-pink-400 rounded-full"></div>
          </div>
          <p className="text-sm text-gray-600">Based on your recent health data</p>
        </GlassCard>
      </motion.div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-6"
      >
        <h3 className="text-sm text-gray-500 mb-3 uppercase tracking-wider">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-3">
          <GlassCard className="text-center py-4 cursor-pointer hover:scale-105 transition-transform">
            <Calendar className="w-6 h-6 text-green-600 mx-auto mb-2" />
            <p className="text-sm text-gray-800">Book Appointment</p>
          </GlassCard>
          <GlassCard className="text-center py-4 cursor-pointer hover:scale-105 transition-transform">
            <AlertCircle className="w-6 h-6 text-orange-600 mx-auto mb-2" />
            <p className="text-sm text-gray-800">View Alerts</p>
          </GlassCard>
        </div>
      </motion.div>

      {/* Health Mosaic - Data Cards */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mb-6"
      >
        <h3 className="text-sm text-gray-500 mb-3 uppercase tracking-wider">Your Health Mosaic</h3>
        <div className="space-y-3">
          {healthData.map((section, index) => {
            const Icon = section.icon;
            return (
              <motion.div
                key={section.category}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + index * 0.1 }}
              >
                <GlassCard className="cursor-pointer hover:scale-[1.02] transition-transform">
                  <div className={`bg-gradient-to-br ${section.color} rounded-[16px] p-4`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-white/70 flex items-center justify-center">
                          <Icon className={`w-5 h-5 ${section.iconColor}`} />
                        </div>
                        <h4 className="text-sm font-medium text-gray-800">{section.category}</h4>
                      </div>
                      <span className="text-xs bg-white/60 text-gray-700 px-2 py-1 rounded-full">
                        {section.count}
                      </span>
                    </div>
                    <div className="space-y-2 pl-13">
                      {section.items.map((item, itemIndex) => (
                        <p key={itemIndex} className="text-sm text-gray-700">
                          • {item}
                        </p>
                      ))}
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* Next Appointment */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
      >
        <h3 className="text-sm text-gray-500 mb-3 uppercase tracking-wider">Upcoming</h3>
        <GlassCard className="bg-gradient-to-br from-indigo-100/60 to-blue-100/60">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Next Checkup</p>
              <p className="text-xl font-light text-gray-800">March 25, 2026</p>
              <p className="text-sm text-gray-600 mt-1">Dr. Emily Chen</p>
            </div>
            <Calendar className="w-8 h-8 text-indigo-600" />
          </div>
        </GlassCard>
      </motion.div>
    </div>
  );
}
