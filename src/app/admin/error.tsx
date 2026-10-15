"use client";

import { RouteError, type RouteErrorProps } from "@/components/atlas/RouteError";

/** Error in the admin (loading from DB). Message without details; details are in the server log. */
export default function AdminError(props: RouteErrorProps) {
  return <RouteError variant="admin" {...props} />;
}
