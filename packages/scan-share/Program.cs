using NAPS2.WebScan.LocalService;
using NAPS2.WebScan.LocalService.Services;

var builder = WebApplication.CreateBuilder(args);

// Windows Service no Windows; unit systemd no Linux
if (OperatingSystem.IsWindows())
{
    builder.Services.AddWindowsService(options =>
    {
        options.ServiceName = "NAPS2.WebScan Service";
    });
}
else
{
    builder.Services.AddSystemd();
}

// Adicionar controladores para API REST
builder.Services.AddControllers();

// Adicionar CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowWebServer", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

// Adicionar servi�os
builder.Services.AddSingleton<ScannerRegistryService>();
builder.Services.AddSingleton<PortRegistryService>();
builder.Services.AddSingleton<ScanShareHost>();
builder.Services.AddHostedService<Worker>();

var app = builder.Build();

// Configurar pipeline HTTP
app.UseCors("AllowWebServer");
app.UseRouting();
app.MapControllers();

app.Run();