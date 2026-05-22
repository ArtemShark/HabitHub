using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HabitHub.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddHabitReminderTime : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "ReminderTime",
                table: "Habits",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ReminderTime",
                table: "Habits");
        }
    }
}