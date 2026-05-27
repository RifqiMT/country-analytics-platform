import { Outlet } from "react-router-dom";
import { useAppBootstrap } from "../hooks/useAppBootstrap";
import ApiToastStack from "./ApiToastStack";
import AppFooter from "./layout/AppFooter";
import AppHeader from "./layout/AppHeader";
import MobileBottomNav from "./layout/MobileBottomNav";

export default function Layout() {
  useAppBootstrap();

  return (
    <div className="flex min-h-screen flex-col bg-slate-100 text-slate-900">
      <AppHeader />
      <main className="w-full flex-1 px-3 py-3 pb-[calc(5rem+env(safe-area-inset-bottom))] sm:px-4 sm:py-4 lg:px-6 lg:py-5 lg:pb-10 xl:px-8">
        <Outlet />
      </main>
      <ApiToastStack />
      <MobileBottomNav />
      <AppFooter />
    </div>
  );
}
