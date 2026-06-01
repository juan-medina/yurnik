// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

using System.Runtime.InteropServices;
using System.Text;
using Agon.Agent.Infrastructure;

namespace Agon.Agent.Auth;

/// <summary>
/// Reads and writes the agent JWT token using Windows Credential Manager.
/// The token is stored under the target name "Agon/AgentToken".
/// Never touches disk in plaintext.
/// </summary>
sealed class CredentialStore
{
    const string Target = "Agon/AgentToken";

    public string? LoadToken()
    {
        if (!NativeCredRead(Target, 1, 0, out var credPtr))
            return null;

        try
        {
            var cred = Marshal.PtrToStructure<NativeCredential>(credPtr);
            if (cred.CredentialBlob == IntPtr.Zero || cred.CredentialBlobSize == 0)
                return null;

            var bytes = new byte[cred.CredentialBlobSize];
            Marshal.Copy(cred.CredentialBlob, bytes, 0, bytes.Length);
            return Encoding.UTF8.GetString(bytes);
        }
        finally
        {
            NativeCredFree(credPtr);
        }
    }

    public bool SaveToken(string token)
    {
        var bytes = Encoding.UTF8.GetBytes(token);
        var blobPtr = Marshal.AllocHGlobal(bytes.Length);
        try
        {
            Marshal.Copy(bytes, 0, blobPtr, bytes.Length);
            var cred = new NativeCredential
            {
                Type = 1, // CRED_TYPE_GENERIC
                TargetName = Target,
                CredentialBlob = blobPtr,
                CredentialBlobSize = (uint)bytes.Length,
                Persist = 2, // CRED_PERSIST_LOCAL_MACHINE
            };
            return NativeCredWrite(ref cred, 0);
        }
        finally
        {
            Marshal.FreeHGlobal(blobPtr);
        }
    }

    public void DeleteToken()
    {
        NativeCredDelete(Target, 1, 0);
    }

    // -- P/Invoke --

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    struct NativeCredential
    {
        public uint Flags;
        public uint Type;
        public string? TargetName;
        public string? Comment;
        public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
        public uint CredentialBlobSize;
        public IntPtr CredentialBlob;
        public uint Persist;
        public uint AttributeCount;
        public IntPtr Attributes;
        public string? TargetAlias;
        public string? UserName;
    }

    [DllImport("advapi32.dll", EntryPoint = "CredReadW", CharSet = CharSet.Unicode, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    static extern bool NativeCredRead(string target, uint type, uint flags, out IntPtr credential);

    [DllImport("advapi32.dll", EntryPoint = "CredWriteW", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    static extern bool NativeCredWrite(ref NativeCredential credential, uint flags);

    [DllImport("advapi32.dll", EntryPoint = "CredDeleteW", CharSet = CharSet.Unicode, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    static extern bool NativeCredDelete(string target, uint type, uint flags);

    [DllImport("advapi32.dll", EntryPoint = "CredFree")]
    static extern void NativeCredFree(IntPtr buffer);
}
