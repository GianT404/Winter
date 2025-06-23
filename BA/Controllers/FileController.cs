using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;

namespace BA.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class FileController : ControllerBase
{
    private readonly IWebHostEnvironment _environment;
    private readonly ILogger<FileController> _logger;

    public FileController(IWebHostEnvironment environment, ILogger<FileController> logger)
    {
        _environment = environment;
        _logger = logger;
    }

    [HttpPost("upload")]
    public async Task<ActionResult> UploadFile(IFormFile file)
    {
        try
        {
            if (file == null || file.Length == 0)
                return BadRequest("No file uploaded");

            // Validate file size (max 10MB)
            if (file.Length > 10 * 1024 * 1024)
                return BadRequest("File size exceeds 10MB limit");

            // Validate file type
            var allowedTypes = new[] { 
                "image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp",
                "application/pdf", "text/plain", "application/msword", 
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "application/vnd.ms-excel", 
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            };

            if (!allowedTypes.Contains(file.ContentType))
                return BadRequest("File type not supported");

            // Generate unique filename
            var fileName = $"{Guid.NewGuid()}_{Path.GetFileName(file.FileName)}";
            var uploadsPath = Path.Combine(_environment.WebRootPath, "uploads");
            
            // Ensure uploads directory exists
            if (!Directory.Exists(uploadsPath))
                Directory.CreateDirectory(uploadsPath);

            var filePath = Path.Combine(uploadsPath, fileName);

            // Save file
            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            // Return file URL
            var fileUrl = $"/uploads/{fileName}";
            
            return Ok(new { url = fileUrl, fileName = file.FileName });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading file");
            return StatusCode(500, "Internal server error");
        }
    }

    [HttpGet("download/{fileName}")]
    [AllowAnonymous]
    public ActionResult DownloadFile(string fileName)
    {
        try
        {
            var uploadsPath = Path.Combine(_environment.WebRootPath, "uploads");
            var filePath = Path.Combine(uploadsPath, fileName);

            if (!System.IO.File.Exists(filePath))
                return NotFound("File not found");

            var memory = new MemoryStream();
            using (var stream = new FileStream(filePath, FileMode.Open))
            {
                stream.CopyTo(memory);
            }
            memory.Position = 0;

            var contentType = GetContentType(filePath);
            var originalFileName = fileName.Contains('_') ? fileName.Substring(fileName.IndexOf('_') + 1) : fileName;

            return File(memory, contentType, originalFileName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error downloading file");
            return StatusCode(500, "Internal server error");
        }
    }

    private string GetContentType(string path)
    {
        var types = new Dictionary<string, string>
        {
            { ".txt", "text/plain" },
            { ".pdf", "application/pdf" },
            { ".doc", "application/vnd.ms-word" },
            { ".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
            { ".xls", "application/vnd.ms-excel" },
            { ".xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
            { ".png", "image/png" },
            { ".jpg", "image/jpeg" },
            { ".jpeg", "image/jpeg" },
            { ".gif", "image/gif" },
            { ".csv", "text/csv" }
        };

        var ext = Path.GetExtension(path).ToLowerInvariant();
        return types.TryGetValue(ext, out string? contentType) ? contentType : "application/octet-stream";
    }
}
