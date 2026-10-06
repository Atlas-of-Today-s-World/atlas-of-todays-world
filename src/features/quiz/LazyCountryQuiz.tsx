"use client";

import dynamic from "next/dynamic";

/**
 * The outline quiz on 404 pages, in its own chunk: a not-found boundary is
 * bundled with its layout, so a direct import would ship the quiz with every
 * map page (home included) although only a missing page shows it.
 */
export const LazyCountryQuiz = dynamic(() =>
  import("./CountryQuiz").then((module) => module.CountryQuiz),
);
