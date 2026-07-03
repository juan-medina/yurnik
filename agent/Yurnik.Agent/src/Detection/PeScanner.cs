// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection.PortableExecutable;

namespace Yurnik.Agent.Detection;

/// <summary>
/// Scans the Portable Executable (PE) headers of a file to look for specific
/// imported DLLs. This acts as a highly accurate, zero-privilege fallback for
/// detecting standalone games and emulators that aren't installed via mainstream
/// launchers and aren't tracked by Discord.
/// </summary>
public static class PeScanner
{
    // A strict list of DLLs that are almost exclusively used by games/emulators.
    // Deliberately excludes generic graphics APIs (d3d11, opengl32) to prevent
    // false positives with hardware-accelerated desktop apps (browsers, Electron).
    static readonly string[] TargetDlls =
    [
        // Input APIs (The strongest signals)
        "xinput1_4.dll", "xinput1_3.dll", "xinput1_2.dll", "xinput1_1.dll", "xinput9_1_0.dll",
        "dinput8.dll",
        
        // Game Engines and Frameworks
        "unityplayer.dll",
        "sdl2.dll",
        "fna.dll", "xna.dll",
        
        // Audio and Video Middleware
        "fmod.dll", "fmodstudio.dll",
        "aksoundengine.dll",
        "bink2w64.dll", "binkw32.dll",
        
        // Specific Graphics APIs (Vulkan is mostly games, unlike D3D11)
        "vulkan-1.dll",
        
        // Specific PC Launchers APIs
        "steam_api.dll", "steam_api64.dll",
        "galaxy.dll", "galaxy64.dll"
    ];

    public static bool IsGameExecutable(string exePath)
    {
        try
        {
            var imports = GetImportedDlls(exePath);
            return HasGameImports(imports);
        }
        catch (Exception)
        {
            // If the file is locked, not a valid PE, or inaccessible, default to false.
            return false;
        }
    }

    /// <summary>
    /// Internal method exposed for unit testing. Evaluates whether a given list
    /// of imported DLL names contains any of our strict target DLLs.
    /// </summary>
    internal static bool HasGameImports(IEnumerable<string> importedDlls)
    {
        return importedDlls.Any(dll => 
            Array.Exists(TargetDlls, target => dll.Equals(target, StringComparison.OrdinalIgnoreCase)));
    }

    static IEnumerable<string> GetImportedDlls(string path)
    {
        // Read sharing allows the file to be executed/locked by other processes.
        using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
        using var peReader = new PEReader(stream);
        
        var headers = peReader.PEHeaders;
        if (headers == null) yield break;

        var importTable = headers.PEHeader?.ImportTableDirectory;
        if (importTable == null || importTable.Value.Size == 0) yield break;

        int importDirOffset = RvaToOffset(importTable.Value.RelativeVirtualAddress, headers.SectionHeaders);
        if (importDirOffset == -1) yield break;

        stream.Seek(importDirOffset, SeekOrigin.Begin);
        var reader = new BinaryReader(stream);

        var namesRvas = new List<uint>();

        while (true)
        {
            // IMAGE_IMPORT_DESCRIPTOR is 20 bytes long
            uint originalFirstThunk = reader.ReadUInt32();
            uint timeDateStamp = reader.ReadUInt32();
            uint forwarderChain = reader.ReadUInt32();
            uint nameRva = reader.ReadUInt32();
            uint firstThunk = reader.ReadUInt32();

            // Null-padded descriptor signifies end of the array
            if (originalFirstThunk == 0 && nameRva == 0) break;

            namesRvas.Add(nameRva);
        }

        foreach (var nameRva in namesRvas)
        {
            int nameOffset = RvaToOffset((int)nameRva, headers.SectionHeaders);
            if (nameOffset != -1)
            {
                stream.Seek(nameOffset, SeekOrigin.Begin);
                string dllName = "";
                char c;
                while ((c = (char)stream.ReadByte()) != '\0')
                {
                    dllName += c;
                }
                if (!string.IsNullOrWhiteSpace(dllName))
                {
                    yield return dllName;
                }
            }
        }
    }

    static int RvaToOffset(int rva, System.Collections.Immutable.ImmutableArray<SectionHeader> sections)
    {
        foreach (var section in sections)
        {
            if (rva >= section.VirtualAddress && 
                rva < section.VirtualAddress + Math.Max(section.VirtualSize, section.SizeOfRawData))
            {
                return section.PointerToRawData + (rva - section.VirtualAddress);
            }
        }
        return -1;
    }
}
