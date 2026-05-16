// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { initials } from "./mock";

describe("initials", () => {
  it("returns uppercase initials for a two-word name", () => {
    expect(initials("Maria Chen")).toBe("MC");
  });

  it("uses only the first two words for names with more parts", () => {
    expect(initials("Jean Paul Martin")).toBe("JP");
  });

  it("returns a single character for a one-word name", () => {
    expect(initials("Solo")).toBe("S");
  });
});
