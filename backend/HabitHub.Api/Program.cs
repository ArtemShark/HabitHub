using HabitHub.Api.Data;
using Microsoft.EntityFrameworkCore;
using HabitHub.Api.Services;
using HabitHub.Api.Services.Background;
using Microsoft.AspNetCore.Identity;
using HabitHub.Api.Models;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using System.IO;
using HabitHub.Api.Services.Mail;
using HabitHub.Api.Middleware;

LoadDotEnv();

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(
            new System.Text.Json.Serialization.JsonStringEnumConverter());
    });
builder.Services.AddScoped<IJwtTokenService, JwtTokenService>();
builder.Services.AddScoped<IMailService, MailService>();
builder.Services.AddScoped<PasswordHasher<Member>>();

builder.Services.AddOpenApi();

var jwtKey = builder.Configuration["Jwt:Key"]
    ?? throw new InvalidOperationException("Jwt:Key is missing.");
var jwtIssuer = builder.Configuration["Jwt:Issuer"]
    ?? throw new InvalidOperationException("Jwt:Issuer is missing.");
var jwtAudience = builder.Configuration["Jwt:Audience"]
    ?? throw new InvalidOperationException("Jwt:Audience is missing.");

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwtIssuer,

            ValidateAudience = true,
            ValidAudience = jwtAudience,

            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),

            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(1)
        };
    });

builder.Services.AddAuthorization();

builder.Services.AddHostedService<AutoArchiveHabitsService>();

builder.Services.AddHostedService<ReminderDispatchService>();

builder.Services.AddCors(options =>
{
    options.AddPolicy("frontend", policy =>
    {
        policy
            .WithOrigins(
                "http://localhost:3000",
                "https://habit-hub-swart.vercel.app"
            )
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

var app = builder.Build();

app.MapOpenApi();

app.UseHttpsRedirection();

app.UseCors("frontend");

app.UseAuthentication();
app.UseMiddleware<SessionActivityMiddleware>();
app.UseAuthorization();

app.MapControllers();
app.MapGet("/", () => "HabitHub backend is running");

app.Run();

static void LoadDotEnv()
{
    var searchRoots = new[]
    {
        Directory.GetCurrentDirectory(),
        AppContext.BaseDirectory
    };

    string? envPath = null;
    foreach (var root in searchRoots)
    {
        var current = root;
        for (var depth = 0; depth < 5; depth++)
        {
            var candidate = Path.Combine(current, ".env");
            if (File.Exists(candidate))
            {
                envPath = candidate;
                break;
            }

            var parent = Path.GetDirectoryName(current);
            if (string.IsNullOrEmpty(parent) || parent == current)
            {
                break;
            }

            current = parent;
        }

        if (envPath is not null)
        {
            break;
        }
    }

    if (envPath is null)
    {
        return;
    }

    foreach (var line in File.ReadAllLines(envPath))
    {
        var trimmed = line.Trim();
        if (string.IsNullOrEmpty(trimmed) || trimmed.StartsWith("#"))
        {
            continue;
        }

        var separatorIndex = trimmed.IndexOf('=');
        if (separatorIndex < 0)
        {
            continue;
        }

        var key = trimmed[..separatorIndex].Trim();
        var value = trimmed[(separatorIndex + 1)..].Trim();

        if ((value.StartsWith("\"") && value.EndsWith("\"")) ||
            (value.StartsWith("'") && value.EndsWith("'")))
        {
            value = value[1..^1];
        }

        var envKey = key switch
        {
            "SMTP_HOST" => "Email__SmtpHost",
            "SMTP_PORT" => "Email__SmtpPort",
            "SMTP_USER" => "Email__Username",
            "SMTP_PASSWORD" => "Email__Password",
            "SMTP_FROM_EMAIL" => "Email__From",
            _ => key
        };

        Environment.SetEnvironmentVariable(envKey, value);
    }
}

public partial class Program { }
