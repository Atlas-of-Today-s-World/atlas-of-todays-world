import ContentRail from "@/components/ContentRail";
import { ErrorState } from "@/components/atlas/ErrorState";

/** 404 na mapových stránkách — v panelu, globus zůstává. */
export default function NotFound() {
  return (
    <ContentRail>
      <ErrorState
        code="404"
        title="This place is not on our map"
        lead="The page may have moved, or the address has a typo. Search the Atlas or pick a country on the globe."
      />
    </ContentRail>
  );
}
