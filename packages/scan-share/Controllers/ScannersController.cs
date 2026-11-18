using Microsoft.AspNetCore.Mvc;
using NAPS2.WebScan.LocalService.Models;
using NAPS2.WebScan.LocalService.Services;

namespace NAPS2.WebScan.LocalService.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ScannersController : ControllerBase
{
    private readonly ScannerRegistryService _scannerRegistry;
    private readonly ScanShareHost _host;
    private readonly ILogger<ScannersController> _logger;

    public ScannersController(
        ScannerRegistryService scannerRegistry,
        ScanShareHost host,
        ILogger<ScannersController> logger)
    {
        _scannerRegistry = scannerRegistry;
        _host = host;
        _logger = logger;
    }

    /// <summary>
    /// Lista todos os scanners TWAIN disponiveis e a porta eSCL de cada um
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(IEnumerable<ScannerListDto>), 200)]
    public IActionResult GetAllScanners()
    {
        var scanners = _scannerRegistry.GetAllScanners().Select(ToDto).ToList();
        _logger.LogInformation("Listando {Count} scanners disponiveis", scanners.Count);
        return Ok(scanners);
    }

    /// <summary>
    /// Obtem informacoes de um scanner especifico
    /// </summary>
    [HttpGet("{id}")]
    [ProducesResponseType(typeof(ScannerListDto), 200)]
    [ProducesResponseType(404)]
    public IActionResult GetScanner(string id)
    {
        var scanner = _scannerRegistry.GetScanner(id);
        if (scanner == null)
        {
            return NotFound(new { message = $"Scanner '{id}' nao encontrado" });
        }

        return Ok(ToDto(scanner));
    }

    /// <summary>
    /// Reenumera os dispositivos TWAIN (util apos conectar/desconectar um scanner).
    /// Reinicia o servidor eSCL e interrompe scans em andamento.
    /// </summary>
    [HttpPost("refresh")]
    [ProducesResponseType(200)]
    public async Task<IActionResult> Refresh(CancellationToken ct)
    {
        var count = await _host.RefreshAsync(ct);
        return Ok(new { count, timestamp = DateTime.UtcNow });
    }

    /// <summary>
    /// Retorna o total de scanners disponiveis
    /// </summary>
    [HttpGet("count")]
    [ProducesResponseType(typeof(object), 200)]
    public IActionResult GetScannersCount()
    {
        return Ok(new { count = _scannerRegistry.Count, timestamp = DateTime.UtcNow });
    }

    private static ScannerListDto ToDto(ScannerInfo s) => new()
    {
        Id = s.Id,
        Name = s.Name,
        Port = s.Port,
        RegisteredAt = s.RegisteredAt
    };
}
