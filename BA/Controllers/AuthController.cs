using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using BA.Services;
using BA.DTOs;

namespace BA.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IConfiguration _configuration;
    private readonly IUserService _userService;

    public AuthController(IConfiguration configuration, IUserService userService)
    {
        _configuration = configuration;
        _userService = userService;
    }

    [HttpGet("test")]
    public ActionResult<string> Test()
    {
        return Ok("Auth controller is working!");
    }

    [HttpPost("login")]
    public async Task<ActionResult<object>> Login([FromBody] LoginDto loginDto)
    {
        try
        {
            // Add validation
            if (string.IsNullOrEmpty(loginDto.Email) || string.IsNullOrEmpty(loginDto.Password))
            {
                return BadRequest(new { message = "Email and password are required" });
            }

            var user = await _userService.GetUserByEmailAsync(loginDto.Email);
            if (user == null)
            {
                return NotFound(new { message = "User not found" });
            }

            // Validate password
            if (!_userService.VerifyPassword(user, loginDto.Password))
            {
                return Unauthorized(new { message = "Invalid password" });
            }

            var token = GenerateJwtToken(user);
            return Ok(new { Token = token, User = user });
        }
        catch (Exception ex)
        {
            // Log the exception for debugging
            Console.WriteLine($"Login error: {ex.Message}");
            return BadRequest(new { message = "Login failed", error = ex.Message });
        }
    }

    [HttpPost("register")]
    public async Task<ActionResult<object>> Register([FromBody] RegisterDto registerDto)
    {
        try
        {
            // Check if user already exists
            var existingUser = await _userService.GetUserByEmailAsync(registerDto.Email);
            if (existingUser != null)
            {
                return BadRequest(new { message = "User with this email already exists" });
                
            }            // Create new user
            var createUserDto = new CreateUserDto
            {
                Email = registerDto.Email,
                Name = registerDto.Name,
                Password = registerDto.Password
            };
            
            var user = await _userService.CreateUserAsync(createUserDto);
            var token = GenerateJwtToken(user);
            
            return Ok(new { Token = token, User = user });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    private string GenerateJwtToken(UserDto user)
    {
        var key = _configuration["Jwt:Key"] ?? throw new InvalidOperationException("JWT Key is not configured");
        var issuer = _configuration["Jwt:Issuer"];
        var audience = _configuration["Jwt:Audience"];

        var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key));
        var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.Name, user.Name)
        };

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            expires: DateTime.Now.AddDays(7),
            signingCredentials: credentials
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}