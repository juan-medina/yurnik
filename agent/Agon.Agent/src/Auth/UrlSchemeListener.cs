// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

using System.IO.Pipes;
using Agon.Agent.Infrastructure;

namespace Agon.Agent.Auth;

/// <summary>
/// Listens on a named pipe for agon:// URLs forwarded from a second agent instance.
///
/// When Windows routes agon://auth?token=... to the agent exe, it launches a new
/// process with the URL as a command-line argument. That second instance detects
/// another instance is already running, forwards the URL via this pipe, and exits.
/// </summary>
sealed class UrlSchemeListener : IDisposable
{
    internal const string PipeName = "agon-agent-url";

    readonly Action<string> _onUrl;
    readonly CancellationTokenSource _cts = new();
    readonly Task _listenTask;

    public UrlSchemeListener(Action<string> onUrl)
    {
        _onUrl = onUrl;
        _listenTask = ListenAsync(_cts.Token);
    }

    /// <summary>
    /// Called by a second instance to forward the URL to the running instance.
    /// Returns true if successfully forwarded.
    /// </summary>
    public static bool TryForward(string url)
    {
        try
        {
            using var client = new NamedPipeClientStream(".", PipeName, PipeDirection.Out);
            client.Connect(timeout: 2000);
            using var writer = new StreamWriter(client);
            writer.WriteLine(url);
            return true;
        }
        catch
        {
            return false;
        }
    }

    async Task ListenAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            try
            {
                using var server = new NamedPipeServerStream(PipeName, PipeDirection.In,
                    maxNumberOfServerInstances: 1, PipeTransmissionMode.Byte,
                    PipeOptions.Asynchronous);

                await server.WaitForConnectionAsync(ct);

                using var reader = new StreamReader(server);
                var url = await reader.ReadLineAsync(ct);
                if (!string.IsNullOrWhiteSpace(url))
                {
                    Log.Info($"Received URL via pipe: {url}");
                    _onUrl(url);
                }
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                Log.Error("UrlSchemeListener error", ex);
                await Task.Delay(1000, ct).ConfigureAwait(false);
            }
        }
    }

    public void Dispose()
    {
        _cts.Cancel();
        _listenTask.Wait(2000);
        _cts.Dispose();
    }
}
