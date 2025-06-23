using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BA.Migrations
{
    /// <inheritdoc />
    public partial class AddMessageIndexesForPerformance : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Create composite index for conversation messages ordering by time (most important)
            migrationBuilder.CreateIndex(
                name: "IX_Messages_ConversationId_SentAt_Desc",
                table: "Messages",
                columns: new[] { "ConversationId", "SentAt" },
                descending: new[] { false, true });

            // Create composite index for group messages ordering by time
            migrationBuilder.CreateIndex(
                name: "IX_Messages_GroupId_SentAt_Desc", 
                table: "Messages",
                columns: new[] { "GroupId", "SentAt" },
                descending: new[] { false, true });

            // Create index for sender queries
            migrationBuilder.CreateIndex(
                name: "IX_Messages_SenderId_SentAt",
                table: "Messages", 
                columns: new[] { "SenderId", "SentAt" });

            // Create index for reply lookups
            migrationBuilder.CreateIndex(
                name: "IX_Messages_ReplyToMessageId",
                table: "Messages",
                column: "ReplyToMessageId");

            // Create index for unread messages
            migrationBuilder.CreateIndex(
                name: "IX_Messages_ConversationId_IsRead_SentAt",
                table: "Messages",
                columns: new[] { "ConversationId", "IsRead", "SentAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Messages_ConversationId_SentAt_Desc",
                table: "Messages");

            migrationBuilder.DropIndex(
                name: "IX_Messages_GroupId_SentAt_Desc",
                table: "Messages");

            migrationBuilder.DropIndex(
                name: "IX_Messages_SenderId_SentAt",
                table: "Messages");

            migrationBuilder.DropIndex(
                name: "IX_Messages_ReplyToMessageId", 
                table: "Messages");

            migrationBuilder.DropIndex(
                name: "IX_Messages_ConversationId_IsRead_SentAt",
                table: "Messages");
        }
    }
}
