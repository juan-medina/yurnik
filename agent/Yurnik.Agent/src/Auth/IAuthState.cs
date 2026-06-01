// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

namespace Yurnik.Agent.Auth;

interface IAuthState
{
    bool IsAuthenticated { get; }
    void OnUnauthorized();
}
