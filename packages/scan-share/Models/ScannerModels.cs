using NAPS2.Scan;

namespace NAPS2.WebScan.LocalService.Models;

public class ScannerInfo
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public required ScanDevice Device { get; init; }
    public int Port { get; init; }
    public DateTime RegisteredAt { get; init; }
}

public class ScannerListDto
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public int Port { get; init; }
    public string CapabilitiesUrl => $"http://localhost:{Port}/eSCL/ScannerCapabilities";
    public DateTime RegisteredAt { get; init; }
}
