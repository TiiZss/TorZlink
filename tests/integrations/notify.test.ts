import { describe, expect, it } from "vitest";
import * as notify from "../../src/integrations/notify";
import * as telegram from "../../src/integrations/telegram";

describe("notify hub", () => {
  it("re-exports telegram notify helpers", () => {
    expect(notify.notifyMagnetCopied).toBe(telegram.notifyMagnetCopied);
    expect(notify.notifyDownloadStarted).toBe(telegram.notifyDownloadStarted);
    expect(notify.notifyDownloadCompleted).toBe(telegram.notifyDownloadCompleted);
    expect(notify.notifyDownloadFailed).toBe(telegram.notifyDownloadFailed);
  });
});
