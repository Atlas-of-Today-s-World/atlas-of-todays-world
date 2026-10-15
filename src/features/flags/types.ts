/** Switch shapes shared by the admin reads and the (client) admin forms. */

export interface FlagRow {
  key: string;
  enabled: boolean;
  note: string;
  updated_at: string;
}

export interface MaintenanceMessage {
  maintenance_title: string;
  maintenance_text: string;
  updated_at: string | null;
}
