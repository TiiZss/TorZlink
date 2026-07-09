import { useEffect } from "react";
import { useStore, useQueueItems } from "../state/store";

export function TabTitle() {
  const { queue } = useStore();
  useQueueItems(queue);
  const active = queue.activeCount;

  useEffect(() => {
    const title = active > 0 ? `↓${active} · TorZlink` : "TorZlink";
    process.stdout.write(`\x1b]0;${title}\x07`);
    if (process.platform === "win32") process.title = title;
  }, [active]);

  return null;
}
