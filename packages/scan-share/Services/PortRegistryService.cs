using System.Text.Json;

namespace NAPS2.WebScan.LocalService.Services;

/// <summary>
/// Mantem a porta eSCL de cada dispositivo TWAIN estavel entre reinicios.
/// O mapeamento (deviceId -> porta) fica em um arquivo JSON.
/// </summary>
public class PortRegistryService
{
    public const int BasePort = 9880;

    private readonly string _file;
    private readonly object _sync = new();
    private Dictionary<string, int> _map;

    public PortRegistryService(IConfiguration configuration)
    {
        _file = configuration["ScanShare:PortsFile"]
            ?? Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
                "NAPS2.WebScan",
                "ports.json");
        _map = Load();
    }

    public string FilePath => _file;

    public int GetOrAssign(string deviceId)
    {
        lock (_sync)
        {
            if (_map.TryGetValue(deviceId, out var existing))
            {
                return existing;
            }

            var used = new HashSet<int>(_map.Values);
            var port = BasePort;
            while (used.Contains(port))
            {
                port++;
            }

            _map[deviceId] = port;
            Save();
            return port;
        }
    }

    private Dictionary<string, int> Load()
    {
        try
        {
            if (File.Exists(_file))
            {
                var json = File.ReadAllText(_file);
                return JsonSerializer.Deserialize<Dictionary<string, int>>(json) ?? new();
            }
        }
        catch (JsonException)
        {
            // Arquivo corrompido: recomeca a partir da porta base
        }
        return new();
    }

    private void Save()
    {
        var dir = Path.GetDirectoryName(_file);
        if (!string.IsNullOrEmpty(dir))
        {
            Directory.CreateDirectory(dir);
        }
        File.WriteAllText(_file, JsonSerializer.Serialize(_map, new JsonSerializerOptions { WriteIndented = true }));
    }
}
