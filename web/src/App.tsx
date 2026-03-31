import { Outlet, Link, useLocation } from "react-router-dom";
import { useChainStore } from "./store/chainStore";

export default function App() {
  const location = useLocation();
  const pallets = useChainStore((s) => s.pallets);

  const navItems = [
    { path: "/", label: "Home", enabled: true },
    { path: "/pallet", label: "Pallet PoE", enabled: pallets.templatePallet === true },
    { path: "/evm", label: "EVM PoE", enabled: pallets.revive === true },
    { path: "/pvm", label: "PVM PoE", enabled: pallets.revive === true },
    { path: "/accounts", label: "Accounts", enabled: true },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <nav className="border-b border-gray-800 bg-gray-900">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-6">
          <span className="text-lg font-bold text-pink-500">
            Polkadot Stack Template
          </span>
          <div className="flex gap-1">
            {navItems.map((item) =>
              item.enabled ? (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-3 py-1.5 rounded text-sm transition-colors ${
                    location.pathname === item.path
                      ? "bg-pink-600 text-white"
                      : "text-gray-400 hover:text-white hover:bg-gray-800"
                  }`}
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  key={item.path}
                  className="px-3 py-1.5 rounded text-sm text-gray-600 cursor-not-allowed"
                  title="Pallet not available on connected chain"
                >
                  {item.label}
                </span>
              )
            )}
          </div>
        </div>
      </nav>
      <main className="max-w-5xl mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
