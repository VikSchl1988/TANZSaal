import type { AppData } from "../shared/types";

export interface TabProps {
  data: AppData;
  refresh: () => Promise<void>;
}
