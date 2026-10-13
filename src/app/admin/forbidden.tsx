import { NoAccess } from "@/components/admin/NoAccess";

/**
 * A section the role has no permission for: a page calls `forbidden()`, the
 * response is a 403 and this renders inside the admin shell (menu kept).
 */
export default function AdminSectionForbidden() {
  return <NoAccess />;
}
