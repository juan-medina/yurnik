// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

export type Player = {
  id: string;
  name: string;
  handle: string;
  color: string;
  avatarUrl?: string;
  bio?: string;
  isAdmin?: boolean;
  followers?: number;
  following?: number;
};
