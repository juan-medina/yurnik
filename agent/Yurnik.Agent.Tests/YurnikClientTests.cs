// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

using System.Net;
using Yurnik.Agent.Api;
using Xunit;

namespace Yurnik.Agent.Tests;

public class YurnikClientTests
{
    class MockHttpMessageHandler(string responseJson, HttpStatusCode statusCode = HttpStatusCode.OK) : HttpMessageHandler
    {
        public HttpRequestMessage? LastRequest { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            LastRequest = request;
            var response = new HttpResponseMessage(statusCode)
            {
                Content = new StringContent(responseJson)
            };
            return Task.FromResult(response);
        }
    }

    [Fact]
    public async Task GetEchoesAsync_ParsesApiResponseCorrectly()
    {
        var json = """
        {
            "echoes": [
                {
                    "id": 123456789,
                    "type": "comment",
                    "actor_count": 2,
                    "subject_title": "Journey in TestGame",
                    "read": false
                },
                {
                    "id": 987654321,
                    "type": "follow",
                    "actor_count": 1,
                    "read": true
                }
            ],
            "unread_count": 1
        }
        """;

        var handler = new MockHttpMessageHandler(json);
        var client = new YurnikClient("http://localhost", handler);

        var result = await client.GetEchoesAsync();

        Assert.Equal(ApiResult.Ok, result.Status);
        Assert.NotNull(result.Echoes);
        Assert.Equal(2, result.Echoes.Count);

        var e1 = result.Echoes[0];
        Assert.Equal("123456789", e1.Id);
        Assert.Equal("comment", e1.Type);
        Assert.Equal(2, e1.ActorCount);
        Assert.Equal("Journey in TestGame", e1.SubjectTitle);
        Assert.False(e1.Read);

        var e2 = result.Echoes[1];
        Assert.Equal("987654321", e2.Id);
        Assert.Equal("follow", e2.Type);
        Assert.Equal(1, e2.ActorCount);
        Assert.Null(e2.SubjectTitle);
        Assert.True(e2.Read);
    }
}
