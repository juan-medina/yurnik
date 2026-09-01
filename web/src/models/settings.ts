// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

export type Exclusion = {
  exeName: string;
  pathHash?: string;
};

export type Inclusion = {
  exeName: string;
};

export type GameHint = {
  exeName: string;
  pathHash?: string;
  game: string;
};

