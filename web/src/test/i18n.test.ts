// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { describe, it, expect } from "vitest";
import en from "@/locales/en.json";
import es from "@/locales/es.json";

describe("i18n locales parity", () => {
  it("en.json and es.json contain the exact same keys", () => {
    const enKeys = Object.keys(en).sort();
    const esKeys = Object.keys(es).sort();

    const missingInEs = enKeys.filter((k) => !(k in es));
    const missingInEn = esKeys.filter((k) => !(k in en));

    expect(missingInEs).toEqual([]);
    expect(missingInEn).toEqual([]);
  });
});
