using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SpendLogV2.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddCustomTelegramBotToAppUser : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CustomTelegramBotToken",
                table: "AspNetUsers",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CustomTelegramBotUsername",
                table: "AspNetUsers",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TelegramWebhookSecret",
                table: "AspNetUsers",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CustomTelegramBotToken",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "CustomTelegramBotUsername",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "TelegramWebhookSecret",
                table: "AspNetUsers");
        }
    }
}
