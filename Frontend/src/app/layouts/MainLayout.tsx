import { Outlet, useNavigate, useLocation } from "react-router";
import { Home, PlusCircle, TrendingUp, User } from "lucide-react";

const navItems = [
  { path: "/app", icon: Home, label: "Home" },
  { path: "/app/add", icon: PlusCircle, label: "Add" },
  { path: "/app/insights", icon: TrendingUp, label: "Insights" },
  { path: "/app/profile", icon: User, label: "Profile" },
];

export function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === "/app") {
      return location.pathname === "/app";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F5F1EB] via-[#E8E4DD] to-[#DED9D1] flex items-center justify-center">
      <div className="w-full max-w-[425px] min-h-screen flex flex-col relative">
        {/* Main content */}
        <div className="flex-1 overflow-y-auto pb-24">
          <Outlet />
        </div>

        {/* Bottom navigation */}
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[425px] px-6 pb-6">
          <div className="bg-white/50 backdrop-blur-xl rounded-[24px] border border-white/60 shadow-xl p-2">
            <div className="flex items-center justify-around">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={`flex flex-col items-center gap-1 py-3 px-5 rounded-[16px] transition-all duration-300 ${
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
