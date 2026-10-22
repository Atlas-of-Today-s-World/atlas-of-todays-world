/** Author shapes shared by the editor reads and the (client) admin form. */

export interface AuthorRow {
  id: string;
  name: string;
  slug: string;
  photo_url: string | null;
  bio: string;
  positionality: string;
  works_html: string;
}
