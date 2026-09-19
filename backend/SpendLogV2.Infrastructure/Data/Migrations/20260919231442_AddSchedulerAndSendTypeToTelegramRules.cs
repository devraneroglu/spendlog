using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SpendLogV2.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddSchedulerAndSendTypeToTelegramRules : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "DaysOfWeek",
                table: "TelegramRules",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ExecutionTime",
                table: "TelegramRules",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Frequency",
                table: "TelegramRules",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "IntervalMinutes",
                table: "TelegramRules",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "LastRunAt",
                table: "TelegramRules",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "NextRunAt",
                table: "TelegramRules",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ScheduleType",
                table: "TelegramRules",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "SendType",
                table: "TelegramRules",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DaysOfWeek",
                table: "TelegramRules");

            migrationBuilder.DropColumn(
                name: "ExecutionTime",
                table: "TelegramRules");

            migrationBuilder.DropColumn(
                name: "Frequency",
                table: "TelegramRules");

            migrationBuilder.DropColumn(
                name: "IntervalMinutes",
                table: "TelegramRules");

            migrationBuilder.DropColumn(
                name: "LastRunAt",
                table: "TelegramRules");

            migrationBuilder.DropColumn(
                name: "NextRunAt",
                table: "TelegramRules");

            migrationBuilder.DropColumn(
                name: "ScheduleType",
                table: "TelegramRules");

            migrationBuilder.DropColumn(
                name: "SendType",
                table: "TelegramRules");
        }
    }
}
