"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Search, Activity, Clock, Heart, Pill, Plus, Check } from "lucide-react";
import { GlassCard } from "../../components/GlassCard";
import { PillButton } from "../../components/PillButton";

const categories = [
  { id: "symptoms", label: "Symptoms", icon: <Activity className="w-4 h-4" /> },
  { id: "history", label: "History", icon: <Clock className="w-4 h-4" /> },
  { id: "lifestyle", label: "Lifestyle", icon: <Heart className="w-4 h-4" /> },
  { id: "medications", label: "Medications", icon: <Pill className="w-4 h-4" /> },
];

const suggestions = {
  symptoms: ["Headache", "Fatigue", "Dizziness", "Nausea", "Fever", "Cough"],
  history: ["High blood pressure", "Diabetes", "Asthma", "Allergies", "Surgery"],
  lifestyle: ["Exercise routine", "Sleep pattern", "Diet", "Stress level", "Smoking"],
  medications: ["Aspirin", "Ibuprofen", "Vitamins", "Prescription meds"],
};

export function AddDataScreen() {
  const [activeCategory, setActiveCategory] = useState<keyof typeof suggestions>("symptoms");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const toggleItem = (item: string) => {
    setSelectedItems(prev => 
      prev.includes(item) 
        ? prev.filter(i => i !== item)
        : [...prev, item]
    );
  };

  return (
    <div className="p-6 pt-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h1 className="text-2xl font-light text-gray-800 mb-2">Add Health Data</h1>
        <p className="text-sm text-gray-500">Build your health mosaic piece by piece</p>
      </motion.div>

      {/* Search Bar */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="mb-6"
      >
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Describe your symptoms or condition..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-4 rounded-[20px] bg-white/50 backdrop-blur-sm border border-white/80 text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-300/50 transition-all"
          />
        </div>
      </motion.div>

      {/* Category Pills */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-6"
      >
        <p className="text-xs text-gray-500 mb-3 uppercase tracking-wider">Category</p>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {categories.map((cat) => (
            <PillButton
              key={cat.id}
              label={cat.label}
              icon={cat.icon}
              active={activeCategory === cat.id}
              onClick={() => setActiveCategory(cat.id as keyof typeof suggestions)}
            />
          ))}
        </div>
      </motion.div>

      {/* Suggestions */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mb-6"
      >
        <p className="text-xs text-gray-500 mb-3 uppercase tracking-wider">Suggestions</p>
        <div className="grid grid-cols-2 gap-3">
          {suggestions[activeCategory].map((item, index) => {
            const isSelected = selectedItems.includes(item);
            return (
              <motion.div
                key={item}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 + index * 0.05 }}
              >
                <GlassCard 
                  onClick={() => toggleItem(item)}
                  className={`cursor-pointer transition-all duration-300 ${
                    isSelected 
                      ? "bg-gradient-to-br from-purple-200/50 to-pink-200/50 border-purple-300/60" 
                      : "hover:scale-105"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-800">{item}</p>
                    {isSelected ? (
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    ) : (
                      <Plus className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </GlassCard>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* Custom Input */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="mb-6"
      >
        <p className="text-xs text-gray-500 mb-3 uppercase tracking-wider">Or Add Custom</p>
        <GlassCard>
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Type something custom..."
              className="flex-1 bg-transparent border-none outline-none text-gray-700 placeholder:text-gray-400"
            />
            <button className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center hover:scale-110 transition-transform">
              <Plus className="w-5 h-5 text-white" />
            </button>
          </div>
        </GlassCard>
      </motion.div>

      {/* Selected Items Summary */}
      {selectedItems.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <p className="text-xs text-gray-500 mb-3 uppercase tracking-wider">
            Selected ({selectedItems.length})
          </p>
          <GlassCard className="bg-gradient-to-br from-green-100/50 to-emerald-100/50">
            <div className="flex flex-wrap gap-2">
              {selectedItems.map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-2 bg-white/60 px-3 py-1.5 rounded-full"
                >
                  <span className="text-sm text-gray-800">{item}</span>
                  <button
                    onClick={() => toggleItem(item)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </GlassCard>
        </motion.div>
      )}

      {/* Save Button */}
      {selectedItems.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <button className="w-full py-4 rounded-[20px] bg-gradient-to-r from-purple-400 to-pink-400 text-white font-medium shadow-lg shadow-purple-300/30 hover:shadow-xl hover:shadow-purple-300/40 transition-all duration-300">
            Save to My Mosaic
          </button>
        </motion.div>
      )}
    </div>
  );
}
