// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

import type { Journey } from "./journey";
import type { Activity } from "./activity";

export type FeedItem =
  | { kind: "journey"; journey: Journey }
  | { kind: "activity"; activity: Activity };
