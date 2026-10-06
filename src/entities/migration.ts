export interface Migration {
  id: string;
  name: string;
  up: () => Promise<void>;
  // Optional down function for rolling back the migration
  down?: () => Promise<void>;
}