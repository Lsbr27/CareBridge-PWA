import { Outlet, useNavigate, useLocation } from "react-router";
import { Home, Pill, TrendingUp, User } from "lucide-react";

const navItems = [
  { path: "/app", icon: Home, label: "Home" },
  { path: "/app/medications", icon: Pill, label: "Meds" },
  { path: "/app/insights", icon: TrendingUp, label: "Insights" },
  { path: "/app/profile", icon: User, label: "Profile" },
];

export function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const isSetupRoute = location.pathname === "/app/profile/setup";

  const isActive = (path: string) => {
    if (path === "/app") {
      return location.pathname === "/app";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-transparent flex items-center justify-center">
      <div className="w-full max-w-[425px] min-h-screen flex flex-col relative">
        {/* Main content */}
        <div className={`flex-1 overflow-y-auto ${isSetupRoute ? "pb-6" : "pb-24"}`}>
          <Outlet />
        </div>

        {/* Bottom navigation */}
        <div className={`${isSetupRoute ? "hidden" : "fixed"} bottom-0 left-1/2 w-full max-w-[425px] -translate-x-1/2 px-6 pb-6`}>
          <div className="rounded-[24px] border border-white/60 bg-white/50 p-2 shadow-xl backdrop-blur-xl">
            <div className="flex items-center justify-around">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={`flex flex-col items-center gap-1 rounded-[16px] px-5 py-3 transition-all duration-300 ${
                      active
                        ? "bg-gradient-to-br from-purple-400/20 to-pink-400/20 text-purple-700"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${active ? "scale-110" : ""} transition-transform`} />
                    <span className="text-xs">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
