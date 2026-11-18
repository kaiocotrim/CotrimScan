using NAPS2.WebScan.LocalService.Models;
using System.Collections.Concurrent;

namespace NAPS2.WebScan.LocalService.Services;

public class ScannerRegistryService
{
    private readonly ConcurrentDictionary<string, ScannerInfo> _scanners = new();
    private readonly ILogger<ScannerRegistryService> _logger;

    public ScannerRegistryService(ILogger<ScannerRegistryService> logger)
    {
        _logger = logger;
    }

    public void RegisterScanner(ScannerInfo scannerInfo)
    {
        _scanners[scannerInfo.Id] = scannerInfo;
        _logger.LogInformation("Scanner registrado: {Name} (ID: {Id})", scannerInfo.Name, scannerInfo.Id);
    }

    public IEnumerable<ScannerInfo> GetAllScanners()
    {
        return _scanners.Values.OrderBy(s => s.Name);
    }

    public ScannerInfo? GetScanner(string id)
    {
        _scanners.TryGetValue(id, out var scanner);
        return scanner;
    }

    public void ClearScanners()
    {
        _scanners.Clear();
        _logger.LogInformation("Todos os scanners foram removidos do registro");
    }

    public int Count => _scanners.Count;
}
