using Microsoft.EntityFrameworkCore;
using BA.Models;

namespace BA.Data;

public class ChatDbContext : DbContext
{
    public ChatDbContext(DbContextOptions<ChatDbContext> options) : base(options)
    {
    }    public DbSet<User> Users { get; set; }
    public DbSet<Friendship> Friendships { get; set; }
    public DbSet<Conversation> Conversations { get; set; }
    public DbSet<Message> Messages { get; set; }
    public DbSet<Block> Blocks { get; set; }
    
    // Group-related DbSets
    public DbSet<Group> Groups { get; set; }
    public DbSet<GroupMember> GroupMembers { get; set; }
    public DbSet<GroupJoinRequest> GroupJoinRequests { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // User entity configuration
        modelBuilder.Entity<User>(entity =>
        {
            entity.HasIndex(e => e.Email).IsUnique();
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("GETDATE()");
        });

        // Friendship entity configuration
        modelBuilder.Entity<Friendship>(entity =>
        {
            entity.HasOne(f => f.Requester)
                  .WithMany(u => u.SentFriendRequests)
                  .HasForeignKey(f => f.RequesterId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(f => f.Receiver)
                  .WithMany(u => u.ReceivedFriendRequests)
                  .HasForeignKey(f => f.ReceiverId)
                  .OnDelete(DeleteBehavior.Restrict);            entity.Property(e => e.CreatedAt).HasDefaultValueSql("GETDATE()");

            entity.ToTable(t => t.HasCheckConstraint("CK_Friendship_Status", "Status IN ('Pending', 'Accepted', 'Declined')"));
        });

        // Conversation entity configuration
        modelBuilder.Entity<Conversation>(entity =>
        {
            entity.HasOne(c => c.User1)
                  .WithMany(u => u.ConversationsAsUser1)
                  .HasForeignKey(c => c.User1Id)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(c => c.User2)
                  .WithMany(u => u.ConversationsAsUser2)
                  .HasForeignKey(c => c.User2Id)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.Property(e => e.CreatedAt).HasDefaultValueSql("GETDATE()");
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("GETDATE()");        });

        // Block entity configuration
        modelBuilder.Entity<Block>(entity =>
        {
            entity.HasOne(b => b.Blocker)
                  .WithMany(u => u.BlocksInitiated)
                  .HasForeignKey(b => b.BlockerUserId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(b => b.BlockedUser)
                  .WithMany(u => u.BlocksReceived)
                  .HasForeignKey(b => b.BlockedUserId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.Property(e => e.CreatedAt).HasDefaultValueSql("GETDATE()");
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("GETDATE()");            entity.ToTable(t => t.HasCheckConstraint("CK_Block_Status", "Status IN ('Blocked', 'Unblocked')"));
        });

        // Group entity configuration
        modelBuilder.Entity<Group>(entity =>
        {
            entity.HasOne(g => g.CreatedBy)
                  .WithMany(u => u.CreatedGroups)
                  .HasForeignKey(g => g.CreatedById)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.Property(e => e.CreatedAt).HasDefaultValueSql("GETDATE()");
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("GETDATE()");

            entity.ToTable(t => t.HasCheckConstraint("CK_Group_Privacy", "Privacy IN ('Public', 'Private')"));
        });

        // GroupMember entity configuration
        modelBuilder.Entity<GroupMember>(entity =>
        {
            entity.HasOne(gm => gm.Group)
                  .WithMany(g => g.Members)
                  .HasForeignKey(gm => gm.GroupId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(gm => gm.User)
                  .WithMany(u => u.GroupMemberships)
                  .HasForeignKey(gm => gm.UserId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.Property(e => e.JoinedAt).HasDefaultValueSql("GETDATE()");

            // Ensure unique membership per user per group
            entity.HasIndex(e => new { e.GroupId, e.UserId }).IsUnique();

            entity.ToTable(t => t.HasCheckConstraint("CK_GroupMember_Role", "Role IN ('Admin', 'Member')"));
        });

        // GroupJoinRequest entity configuration
        modelBuilder.Entity<GroupJoinRequest>(entity =>
        {
            entity.HasOne(gjr => gjr.Group)
                  .WithMany(g => g.JoinRequests)
                  .HasForeignKey(gjr => gjr.GroupId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(gjr => gjr.User)
                  .WithMany(u => u.GroupJoinRequests)
                  .HasForeignKey(gjr => gjr.UserId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(gjr => gjr.RespondedBy)
                  .WithMany(u => u.RespondedGroupJoinRequests)
                  .HasForeignKey(gjr => gjr.RespondedById)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.Property(e => e.RequestedAt).HasDefaultValueSql("GETDATE()");

            // Ensure unique pending request per user per group
            entity.HasIndex(e => new { e.GroupId, e.UserId, e.Status });

            entity.ToTable(t => t.HasCheckConstraint("CK_GroupJoinRequest_Status", "Status IN ('Pending', 'Approved', 'Rejected')"));
        });

        // Update Message entity configuration to support groups
        modelBuilder.Entity<Message>(entity =>
        {
            entity.HasOne(m => m.Conversation)
                  .WithMany(c => c.Messages)
                  .HasForeignKey(m => m.ConversationId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(m => m.Group)
                  .WithMany(g => g.Messages)
                  .HasForeignKey(m => m.GroupId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(m => m.Sender)
                  .WithMany(u => u.SentMessages)
                  .HasForeignKey(m => m.SenderId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.Property(e => e.SentAt).HasDefaultValueSql("GETDATE()");

            // Ensure a message belongs to either a conversation OR a group, not both
            entity.ToTable(t => t.HasCheckConstraint("CK_Message_ConversationOrGroup", 
                "(ConversationId IS NOT NULL AND GroupId IS NULL) OR (ConversationId IS NULL AND GroupId IS NOT NULL)"));
        });
    }
}
