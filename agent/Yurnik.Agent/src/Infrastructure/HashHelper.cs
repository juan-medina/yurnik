// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

using System.Security.Cryptography;
using System.Text;

namespace Yurnik.Agent.Infrastructure;

static class HashHelper
{
    public static string ComputePathHash(string? userId, string? fullPath)
    {
        if (string.IsNullOrWhiteSpace(fullPath)) return string.Empty;
        var normalizedPath = fullPath.Trim().ToLowerInvariant();
        var salt = userId?.Trim() ?? string.Empty;
        var input = $"{salt}:{normalizedPath}";
        var hashBytes = SHA256.HashData(Encoding.UTF8.GetBytes(input));
        return Convert.ToHexString(hashBytes).ToLowerInvariant();
    }
}
