import type { AppData } from "../shared/types";

export interface TabProps {
  data: AppData;
  refresh: () => Promise<void>;
  /** Springt in einen anderen Reiter. Nur der Start-Reiter braucht das. */
  go?: (tab: string) => void;
}
