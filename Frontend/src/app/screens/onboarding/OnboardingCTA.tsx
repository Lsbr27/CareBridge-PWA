import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { Sparkles, Chrome, LoaderCircle } from "lucide-react";
import { useSearchParams } from "react-router";
import { useState } from "react";
import { useAuth } from "../../providers/AuthProvider";

export function OnboardingCTA() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signInWithGoogle } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleGoogleSignIn() {
    try {
      setIsSubmitting(true);
      await signInWithGoogle(next);
    } catch (error) {
      console.error("Google sign-in failed", error);
      setIsSubmitting(false);
      window.alert("We couldn't start Google sign-in. Please check your Supabase Google provider settings.");
    }
  }

  const next = searchParams.get("next");

  return (
    <div className="min-h-screen bg-transparent flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-[425px] h-screen flex flex-col justify-between py-16">
        {/* Logo with sparkle */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          className="text-center pt-12"
        >
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
            className="inline-block"
          >
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-300 to-pink-300 flex items-center justify-center mx-auto mb-6 shadow-xl">
              <Sparkles className="w-10 h-10 text-white" />
            </div>
          </motion.div>
          <h1 className="text-4xl font-light text-gray-800 mb-3">CareMosaic</h1>
          <p className="text-gray-500">Your health, beautifully organized</p>
        </motion.div>

        {/* Main content */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="flex-1 flex flex-col justify-center text-center px-4"
        >
          <h2 className="text-3xl font-light text-gray-800 mb-6 leading-relaxed">
            Ready to build<br />your health story?
          </h2>
          <p className="text-gray-500 leading-relaxed mb-4">
            Sign in with Google to save your profile, medications, daily logs, and appointments in your own private CareMosaic space.
          </p>
          {next ? (
            <p className="text-xs uppercase tracking-[0.3em] text-purple-500">
              We&apos;ll take you back to your app after login
            </p>
          ) : null}
        </motion.div>

        {/* CTA and skip */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="space-y-4 pb-8"
        >
          <button
            onClick={handleGoogleSignIn}
            disabled={isSubmitting}
            className="w-full py-4 px-5 rounded-[20px] bg-gradient-to-r from-purple-400 to-pink-400 text-white font-medium shadow-xl shadow-purple-300/40 hover:shadow-2xl hover:shadow-purple-300/50 transition-all duration-300 disabled:opacity-80 disabled:cursor-wait flex items-center justify-center gap-3"
          >
            {isSubmitting ? (
              <LoaderCircle className="w-5 h-5 animate-spin" />
            ) : (
              <Chrome className="w-5 h-5" />
            )}
            Continue with Google
          </button>
          <button
            onClick={() => navigate("/")}
            className="w-full py-4 text-gray-500 hover:text-gray-700 transition-colors"
          >
            Back to onboarding
          </button>
        </motion.div>

        {/* Progress dots */}
        <div className="flex justify-center gap-2 pb-4">
          <div className="w-2 h-2 rounded-full bg-gray-300"></div>
          <div className="w-2 h-2 rounded-full bg-gray-300"></div>
          <div className="w-2 h-2 rounded-full bg-gray-300"></div>
          <div className="w-2 h-2 rounded-full bg-purple-400"></div>
        </div>
      </div>
    </div>
  );
}
