"use client";

import { RouteError, type RouteErrorProps } from "@/components/atlas/RouteError";

/** Error on a page outside the map (the account and patrons groups re-export it). */
export default function PagesError(props: RouteErrorProps) {
  return <RouteError variant="page" {...props} />;
}
