// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

namespace Yurnik.Agent.Api;

interface IYurnikClient
{
    void SetToken(string token);
    void ClearToken();
    Task<HeartbeatResult> HeartbeatAsync();
    Task<MeResult> GetMeAsync();
    Task<EchoesResult> GetEchoesAsync();
    Task<ExclusionsResult> GetExclusionsAsync();
    Task<InclusionsResult> GetInclusionsAsync();
    Task<CreatePendingResult> CreatePendingJourneyAsync(
        string exeName, string windowTitle, DateTimeOffset startedAt, DateTimeOffset endedAt);
}
