"use client";

import ContentRail from "@/components/ContentRail";
import { RouteError, type RouteErrorProps } from "@/components/atlas/RouteError";

/** Error loading the panel content — the globe stays and you can try again. */
export default function MapError(props: RouteErrorProps) {
  return (
    <ContentRail>
      <RouteError variant="map" {...props} />
    </ContentRail>
  );
}
