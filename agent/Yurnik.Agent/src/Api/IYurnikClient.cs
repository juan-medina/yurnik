// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

namespace Yurnik.Agent.Api;

record ExclusionEntry(string ExeName, string PathHash);
record ExclusionsResult(ApiResult Status, List<ExclusionEntry>? Exclusions);

interface IYurnikClient
{
    void SetToken(string token);
    void ClearToken();
    Task<HeartbeatResult> HeartbeatAsync();
    Task<MeResult> GetMeAsync();
    Task<NotificationsResult> GetNotificationsAsync();
    Task<ExclusionsResult> GetExclusionsAsync();
    Task<InclusionsResult> GetInclusionsAsync();
    Task<CreatePendingResult> CreatePendingJourneyAsync(
        string exeName, string? pathHash, string windowTitle, DateTimeOffset startedAt, DateTimeOffset endedAt);
}

