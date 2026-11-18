using NAPS2.WebScan.LocalService.Services;

namespace NAPS2.WebScan.LocalService;

public class Worker : BackgroundService
{
    private readonly ScanShareHost _host;
    private readonly ILogger<Worker> _logger;

    public Worker(ScanShareHost host, ILogger<Worker> logger)
    {
        _host = host;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            _logger.LogInformation("Iniciando Worker...");
            var count = await _host.RefreshAsync(stoppingToken);
            _logger.LogInformation("Dispositivos disponiveis: {Count}. API: http://localhost:5000/api/scanners", count);

            await Task.Delay(Timeout.Infinite, stoppingToken);
        }
        catch (OperationCanceledException)
        {
            _logger.LogInformation("Worker cancelado normalmente");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro fatal ao executar o Worker: {Message}", ex.Message);
            throw;
        }
        finally
        {
            await _host.ShutdownAsync();
        }
    }
}
