import { motion } from "motion/react";
import { 
  TrendingUp, 
  AlertCircle, 
  CheckCircle, 
  Heart, 
  Activity, 
  Moon,
  Droplet,
  Brain,
  ArrowUpRight
} from "lucide-react";
import { GlassCard } from "../../components/GlassCard";

const insights = [
  {
    type: "alert",
    title: "Attention Needed",
    description: "Your symptoms may be related to high blood pressure. Consider scheduling a checkup.",
    icon: AlertCircle,
    color: "from-red-50/80 to-orange-50/80",
    iconColor: "text-red-500",
    priority: "high",
  },
  {
    type: "recommendation",
    title: "Sleep Quality",
    description: "Irregular sleep patterns may contribute to headaches and dizziness. Aim for 7-8 hours.",
    icon: Moon,
    color: "from-indigo-50/80 to-purple-50/80",
    iconColor: "text-indigo-500",
    priority: "medium",
  },
  {
    type: "positive",
    title: "Great Progress",
    description: "Your daily exercise routine supports cardiovascular health. Keep it up!",
    icon: CheckCircle,
    color: "from-green-50/80 to-emerald-50/80",
    iconColor: "text-green-500",
    priority: "low",
  },
];

const metrics = [
  { label: "Blood Pressure", value: "High", status: "alert", icon: Heart, trend: "+5%" },
  { label: "Activity Level", value: "Active", status: "good", icon: Activity, trend: "+12%" },
  { label: "Sleep Quality", value: "Poor", status: "alert", icon: Moon, trend: "-8%" },
  { label: "Hydration", value: "Good", status: "good", icon: Droplet, trend: "+3%" },
];

const connections = [
  {
    title: "Connected Pattern Detected",
    items: ["Headaches", "High BP", "Poor Sleep"],
    insight: "These symptoms often occur together and may indicate stress-related hypertension",
  },
];

export function InsightsScreen() {
  return (
    <div className="p-6 pt-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h1 className="text-2xl font-light text-gray-800 mb-2">Health Insights</h1>
        <p className="text-sm text-gray-500">AI-powered analysis of your health data</p>
      </motion.div>

      {/* Health Score */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="mb-6"
      >
        <GlassCard className="bg-gradient-to-br from-purple-100/60 to-pink-100/60">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-medium text-gray-800">Overall Health Score</h3>
            <TrendingUp className="w-5 h-5 text-purple-600" />
          </div>
          <div className="flex items-end gap-2 mb-3">
            <span className="text-5xl font-light text-gray-800">72</span>
            <span className="text-xl text-gray-500 mb-2">/100</span>
            <span className="text-sm text-purple-600 mb-2 ml-2">↑ 3 pts</span>
          </div>
          <div className="h-3 w-full bg-white/50 rounded-full overflow-hidden">
            <div className="h-full w-[72%] bg-gradient-to-r from-purple-400 to-pink-400 rounded-full"></div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Key Metrics */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-6"
      >
        <h3 className="text-sm text-gray-500 mb-3 uppercase tracking-wider">Key Metrics</h3>
        <div className="grid grid-cols-2 gap-3">
          {metrics.map((metric, index) => {
            const Icon = metric.icon;
            return (
              <motion.div
                key={metric.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 + index * 0.05 }}
              >
                <GlassCard className="relative overflow-hidden">
                  <div className={`absolute top-2 right-2 ${
                    metric.status === "alert" 
                      ? "text-red-600" 
                      : "text-green-600"
                  }`}>
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                  <Icon className={`w-5 h-5 mb-2 ${
                    metric.status === "alert" 
                      ? "text-red-600" 
                      : "text-green-600"
                  }`} />
                  <p className="text-xs text-gray-500 mb-1">{metric.label}</p>
                  <p className={`text-lg font-medium ${
                    metric.status === "alert" 
                      ? "text-red-700" 
                      : "text-green-700"
                  }`}>{metric.value}</p>
                  <p className="text-xs text-gray-400 mt-1">{metric.trend}</p>
                </GlassCard>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* Connected Patterns */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mb-6"
      >
        <h3 className="text-sm text-gray-500 mb-3 uppercase tracking-wider flex items-center gap-2">
          <Brain className="w-4 h-4" />
          Connected Patterns
        </h3>
        {connections.map((connection, index) => (
          <GlassCard key={index} className="bg-gradient-to-br from-amber-50/70 to-yellow-50/70">
            <h4 className="text-sm font-medium text-gray-800 mb-3">{connection.title}</h4>
            <div className="flex flex-wrap gap-2 mb-3">
              {connection.items.map((item, i) => (
                <div key={i} className="bg-white/60 px-3 py-1.5 rounded-full text-xs text-gray-700">
                  {item}
                </div>
              ))}
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">{connection.insight}</p>
          </GlassCard>
        ))}
      </motion.div>

      {/* AI Insights */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="mb-6"
      >
        <h3 className="text-sm text-gray-500 mb-3 uppercase tracking-wider">AI Insights</h3>
        <div className="space-y-3">
          {insights.map((insight, index) => {
            const Icon = insight.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7 + index * 0.1 }}
              >
                <GlassCard className="hover:scale-[1.02] transition-transform">
                  <div className={`bg-gradient-to-r ${insight.color} rounded-[16px] p-4`}>
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-white/70 flex items-center justify-center flex-shrink-0">
                        <Icon className={`w-5 h-5 ${insight.iconColor}`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-1">
                          <h4 className="text-sm font-medium text-gray-800">{insight.title}</h4>
                          {insight.priority === "high" && (
                            <span className="text-xs bg-red-200/60 text-red-700 px-2 py-0.5 rounded-full">
                              High
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 leading-relaxed">{insight.description}</p>
                      </div>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* Action Button */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1 }}
      >
        <button className="w-full py-4 rounded-[20px] bg-gradient-to-r from-purple-400 to-pink-400 text-white font-medium shadow-lg shadow-purple-300/30 hover:shadow-xl hover:shadow-purple-300/40 transition-all duration-300">
          Schedule Doctor Consultation
        </button>
      </motion.div>
    </div>
  );
}