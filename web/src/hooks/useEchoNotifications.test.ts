// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { renderHook } from "@testing-library/react";
import "@/i18n";
import { useEchoNotifications } from "./useEchoNotifications";
import * as useDesktopNotificationsModule from "./useDesktopNotifications";
import type { Echo } from "@/models";

function makeEcho(overrides: Partial<Echo> = {}): Echo {
  return {
    id: "echo-1",
    type: "new_comment",
    actors: [{ id: "u1", handle: "u1", name: "Player One", color: "#fff" }],
    actorCount: 1,
    subjectId: "journey-1",
    subjectTitle: "Some Game",
    read: false,
    createdAt: new Date("2026-06-10T10:00:00Z"),
    updatedAt: new Date("2026-06-10T10:00:00Z"),
    ...overrides,
  };
}

describe("useEchoNotifications", () => {
  let notificationSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    notificationSpy = vi.fn();
    vi.stubGlobal("Notification", notificationSpy);
    vi.spyOn(useDesktopNotificationsModule, "useDesktopNotifications").mockReturnValue({
      enabled: true,
      setEnabled: vi.fn(),
      supported: true,
      denied: false,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("does not notify retroactively for unread echoes present on first render", () => {
    renderHook(({ echoes }) => useEchoNotifications(echoes), {
      initialProps: { echoes: [makeEcho()] },
    });
    expect(notificationSpy).not.toHaveBeenCalled();
  });

  it("notifies once when a new echo row appears", () => {
    const { rerender } = renderHook(({ echoes }) => useEchoNotifications(echoes), {
      initialProps: { echoes: [] as Echo[] },
    });
    rerender({ echoes: [makeEcho()] });
    expect(notificationSpy).toHaveBeenCalledTimes(1);
  });

  it("notifies again when the same echo row is upserted with a later updatedAt (a new commenter joined)", () => {
    const { rerender } = renderHook(({ echoes }) => useEchoNotifications(echoes), {
      initialProps: { echoes: [makeEcho()] },
    });
    rerender({ echoes: [makeEcho({ updatedAt: new Date("2026-06-10T11:00:00Z"), actorCount: 2 })] });
    expect(notificationSpy).toHaveBeenCalledTimes(1);
  });

  it("does not re-notify when the same echo row is unchanged across renders", () => {
    const { rerender } = renderHook(({ echoes }) => useEchoNotifications(echoes), {
      initialProps: { echoes: [makeEcho()] },
    });
    rerender({ echoes: [makeEcho()] });
    expect(notificationSpy).not.toHaveBeenCalled();
  });
});
