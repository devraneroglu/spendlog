using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SpendLogV2.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddSecurityAndLockoutEnhancements : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "RefreshToken",
                table: "AspNetUsers",
                type: "nvarchar(450)",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)",
                oldNullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PreviousRefreshToken",
                table: "AspNetUsers",
                type: "nvarchar(450)",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "SecurityAuditLogs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Email = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Action = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    IpAddress = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    UserAgent = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Success = table.Column<bool>(type: "bit", nullable: false),
                    FailureReason = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Timestamp = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SecurityAuditLogs", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AspNetUsers_PreviousRefreshToken",
                table: "AspNetUsers",
                column: "PreviousRefreshToken");

            migrationBuilder.CreateIndex(
                name: "IX_AspNetUsers_RefreshToken",
                table: "AspNetUsers",
                column: "RefreshToken");

            migrationBuilder.CreateIndex(
                name: "IX_SecurityAuditLogs_Email",
                table: "SecurityAuditLogs",
                column: "Email");

            migrationBuilder.CreateIndex(
                name: "IX_SecurityAuditLogs_Timestamp",
                table: "SecurityAuditLogs",
                column: "Timestamp");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SecurityAuditLogs");

            migrationBuilder.DropIndex(
                name: "IX_AspNetUsers_PreviousRefreshToken",
                table: "AspNetUsers");

            migrationBuilder.DropIndex(
                name: "IX_AspNetUsers_RefreshToken",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "PreviousRefreshToken",
                table: "AspNetUsers");

            migrationBuilder.AlterColumn<string>(
                name: "RefreshToken",
                table: "AspNetUsers",
                type: "nvarchar(max)",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(450)",
                oldNullable: true);
        }
    }
}
