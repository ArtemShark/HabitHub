using System.ComponentModel.DataAnnotations;

namespace HabitHub.Api.Models;

public class TeamChat
{
    public Guid TeamChatId { get; set; }

    public Guid HabitTeamId { get; set; }
    public HabitTeam Team { get; set; } = null!;

    public ICollection<Message> Messages { get; set; } = new List<Message>();
    
}
