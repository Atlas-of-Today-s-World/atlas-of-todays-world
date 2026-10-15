/** Patron shapes shared by the admin reads and the (client) admin forms. */

export interface PatronFaqRow {
  id: string;
  question: string;
  answer_html: string;
  sort: number;
  visible: boolean;
  updated_at: string;
}
