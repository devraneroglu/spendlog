using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SpendLogV2.Application.Features.Categories;
using SpendLogV2.Domain.Enums;

namespace SpendLogV2.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class CategoriesController : ControllerBase
{
    private readonly IMediator _mediator;

    public CategoriesController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpGet]
    public async Task<ActionResult<List<CategoryDto>>> GetCategories([FromQuery] CategoryType? type)
    {
        var result = await _mediator.Send(new GetCategoriesQuery(type));
        return Ok(result);
    }

    [HttpPost]
    public async Task<ActionResult<CategoryDto>> CreateCategory([FromBody] CreateCategoryCommand command)
    {
        var result = await _mediator.Send(command);
        return Ok(result);
    }

    [HttpPut("{id}")]
    public async Task<ActionResult> UpdateCategory(int id, [FromBody] UpdateCategoryCommand command)
    {
        if (id != command.Id) return BadRequest();
        var result = await _mediator.Send(command);
        return result ? NoContent() : NotFound();
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult> DeleteCategory(int id)
    {
        var result = await _mediator.Send(new DeleteCategoryCommand(id));
        return result ? NoContent() : NotFound();
    }

    [HttpPost("reindex")]
    public async Task<ActionResult> ReindexCategories()
    {
        var result = await _mediator.Send(new ReindexCategoriesCommand());
        return result ? Ok(new { message = "Kategoriler başarıyla sıralandı." }) : BadRequest();
    }

    [HttpPost("seed-defaults")]
    public async Task<ActionResult> SeedDefaultCategories()
    {
        var result = await _mediator.Send(new SeedDefaultCategoriesCommand());
        return result ? Ok(new { message = "Önerilen finansal kategori şablonu (8 Ana, 38 Alt Kategori) başarıyla yüklendi." }) : BadRequest();
    }
}
