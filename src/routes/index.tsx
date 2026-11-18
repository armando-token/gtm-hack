import { createFileRoute, redirect } from "@tanstack/react-router";

// The app opens directly on the animated six-act presentation.
// The decision-workbench overview lives at /overview.
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/presentation" });
  },
});
