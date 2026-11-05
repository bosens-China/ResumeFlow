import { Outlet, createRootRoute } from "@tanstack/react-router";
import { GlobalHelpMenu } from "@/components/global-help-menu";
import { Toaster } from "@/components/ui/sonner";

export const Route = createRootRoute({
  component: () => (
    <div className="h-full bg-background text-foreground">
      <Outlet />
      <GlobalHelpMenu />
      <Toaster position="top-center" richColors />
    </div>
  ),
});
