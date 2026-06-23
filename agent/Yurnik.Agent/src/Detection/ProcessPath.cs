// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

using System.Runtime.InteropServices;
using System.Text;

namespace Yurnik.Agent.Detection;

/// <summary>
/// Resolves a process's executable path via QueryFullProcessImageName, which
/// only requires PROCESS_QUERY_LIMITED_INFORMATION. Unlike Process.MainModule
/// (which needs PROCESS_VM_READ), this works even when the target process is
/// elevated relative to the agent, or protected by anti-cheat against
/// external memory inspection — both deny live module enumeration but still
/// allow querying the image path.
/// </summary>
static class ProcessPath
{
    const uint ProcessQueryLimitedInformation = 0x1000;

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern IntPtr OpenProcess(uint dwDesiredAccess, bool bInheritHandle, int dwProcessId);

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool QueryFullProcessImageName(IntPtr hProcess, uint dwFlags, StringBuilder lpExeName, ref uint lpdwSize);

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool CloseHandle(IntPtr hObject);

    public static string? TryGetExecutablePath(int pid)
    {
        var handle = OpenProcess(ProcessQueryLimitedInformation, false, pid);
        if (handle == IntPtr.Zero) return null;

        try
        {
            var buffer = new StringBuilder(1024);
            var size = (uint)buffer.Capacity;
            return QueryFullProcessImageName(handle, 0, buffer, ref size) ? buffer.ToString() : null;
        }
        finally
        {
            CloseHandle(handle);
        }
    }
}
