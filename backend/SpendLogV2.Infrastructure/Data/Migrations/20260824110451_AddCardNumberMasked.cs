using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SpendLogV2.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddCardNumberMasked : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CardNumberMasked",
                table: "CreditCardExpenses",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CardNumberMasked",
                table: "CreditCardExpenses");
        }
    }
}
