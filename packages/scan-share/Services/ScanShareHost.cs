using NAPS2.Escl;
using NAPS2.Escl.Server;
using NAPS2.Images.ImageSharp;
using NAPS2.Remoting.Server;
using NAPS2.Scan;
using NAPS2.WebScan.LocalService.Models;

namespace NAPS2.WebScan.LocalService.Services;

/// <summary>
/// Dono do ciclo de vida do servidor eSCL. Enumera dispositivos TWAIN,
/// registra cada um em uma porta estavel e permite reenumerar (refresh)
/// sem reiniciar o servico do Windows.
/// </summary>
public class ScanShareHost : IAsyncDisposable
{
    private readonly ScannerRegistryService _registry;
    private readonly PortRegistryService _ports;
    private readonly ILogger<ScanShareHost> _logger;
    private readonly SemaphoreSlim _lock = new(1, 1);

    private ScanningContext? _context;
    private ScanController? _controller;
    private ScanServer? _server;

    public ScanShareHost(
        ScannerRegistryService registry,
        PortRegistryService ports,
        ILogger<ScanShareHost> logger)
    {
        _registry = registry;
        _ports = ports;
        _logger = logger;
    }

    /// <summary>
    /// Reenumera os dispositivos TWAIN e (re)inicia o servidor eSCL.
    /// Atencao: reiniciar interrompe scans em andamento.
    /// </summary>
    public async Task<int> RefreshAsync(CancellationToken ct = default)
    {
        await _lock.WaitAsync(ct);
        try
        {
            await StopServerAsync();

            _context ??= CreateContext();
            _controller ??= new ScanController(_context);

            _logger.LogInformation("Buscando dispositivos TWAIN...");
            var allDevices = await _controller.GetDeviceList(new ScanOptions { Driver = Driver.Twain });
            var devices = allDevices.Where(d => d.Driver == Driver.Twain).ToList();

            _registry.ClearScanners();

            if (devices.Count == 0)
            {
                _logger.LogWarning("Nenhum dispositivo TWAIN encontrado. Servidor eSCL nao iniciado.");
                return 0;
            }

            _server = new ScanServer(_context, new EsclServer
            {
                // Necessario para que o scan pelo navegador funcione
                SecurityPolicy = EsclSecurityPolicy.ServerAllowAnyOrigin
            });

            foreach (var device in devices)
            {
                var port = _ports.GetOrAssign(device.ID);
                _logger.LogInformation("Registrando {DeviceName} (ID: {DeviceId}) na porta {Port}",
                    device.Name, device.ID, port);

                _registry.RegisterScanner(new ScannerInfo
                {
                    Id = device.ID,
                    Name = device.Name,
                    Device = device,
                    Port = port,
                    RegisteredAt = DateTime.UtcNow
                });

                _server.RegisterDevice(device, displayName: device.Name, port: port);
            }

            await _server.Start();
            _logger.LogInformation("Servidor eSCL iniciado com {Count} dispositivo(s)", devices.Count);
            return devices.Count;
        }
        finally
        {
            _lock.Release();
        }
    }

    public async Task ShutdownAsync()
    {
        await _lock.WaitAsync();
        try
        {
            await StopServerAsync();
            _context?.Dispose();
            _context = null;
            _controller = null;
        }
        finally
        {
            _lock.Release();
        }
    }

    public async ValueTask DisposeAsync()
    {
        await ShutdownAsync();
        _lock.Dispose();
    }

    private async Task StopServerAsync()
    {
        if (_server == null)
        {
            return;
        }

        _logger.LogInformation("Parando servidor eSCL...");
        await _server.Stop();
        _server.Dispose();
        _server = null;
    }

    private static ScanningContext CreateContext()
    {
        var context = new ScanningContext(new ImageSharpImageContext());
        // Worker 32-bit para comunicar com drivers TWAIN (mais estavel)
        context.SetUpWin32Worker();
        return context;
    }
}
