/** Redirect shapes shared by the admin reads and the (client) admin forms. */

export interface RedirectRow {
  id: string;
  from_path: string;
  to_path: string;
  permanent: boolean;
  created_at: string;
}
