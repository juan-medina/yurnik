// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

// Maximum length, in characters, for free-text fields: journey log, comments,
// and bio. Mirrored on the API side and enforced by Postgres CHECK constraints.
export const MAX_TEXT_LENGTH = 400;
