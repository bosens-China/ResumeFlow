import { Outlet, createRootRoute } from "@tanstack/react-router";

export const Route = createRootRoute({
  component: () => (
    <div className="h-full bg-background text-foreground">
      <Outlet />
    </div>
  ),
});
