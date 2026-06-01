// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

namespace Agon.Agent.Api;

interface IAgonClient
{
    void SetToken(string token);
    void ClearToken();
    Task<bool> HeartbeatAsync();
    Task<CreatePendingResult> CreatePendingJourneyAsync(
        string exeName, string windowTitle, DateTimeOffset startedAt, DateTimeOffset endedAt);
}
