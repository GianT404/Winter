using BA.DTOs;

namespace BA.DTOs
{
    public class PaginatedMessageDto
    {
        public List<MessageDto> Messages { get; set; } = new();
        public int TotalCount { get; set; }
        public int PageNumber { get; set; }
        public int PageSize { get; set; }
        public bool HasNextPage { get; set; }
        public bool HasPreviousPage { get; set; }
        public string? NextCursor { get; set; }
        public string? PreviousCursor { get; set; }
    }

    public class MessagePaginationDto
    {
        public int PageNumber { get; set; } = 1;
        public int PageSize { get; set; } = 20;
        public string? Cursor { get; set; }
        public bool UseInfiniteScroll { get; set; } = true;
        /// <summary>
        /// Direction: 'older' for loading older messages, 'newer' for loading newer messages
        /// </summary>
        public string Direction { get; set; } = "older";
    }
}
