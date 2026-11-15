// backend/src/SmartDroneDelivery.Infrastructure/Ai/LlmOptions.cs
namespace SmartDroneDelivery.Infrastructure.Ai;

/// <summary>
/// Cấu hình LLM, đọc từ mục "Ai:Llm". KHÔNG đặt ApiKey trong file commit lên Git:
/// dùng user-secrets hoặc biến môi trường Ai__Llm__ApiKey.
/// </summary>
public class LlmOptions
{
    public const string SectionName = "Ai:Llm";

    /// <summary>Endpoint tương thích OpenAI Chat Completions (gốc, không kèm /chat/completions).</summary>
    public string BaseUrl { get; set; } = "https://api.openai.com/v1";
    public string ApiKey { get; set; } = string.Empty;
    public string Model { get; set; } = "gpt-4o-mini";
    public int TimeoutSeconds { get; set; } = 10;
}
