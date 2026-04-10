import { Habit, HabitResponseDto, HabitStatus, HabitType } from "../dto/Habit";

export function mapHabitType(value: number | string): HabitType {
  if (typeof value === "string") {
    return value.toLowerCase() === "quantitative" ? "value" : "binary";
  }

  return value === 1 ? "value" : "binary";
}

export function mapHabitState(value: number | string): HabitStatus {
  if (typeof value === "string") {
    return value.toLowerCase() === "archived" ? "archived" : "active";
  }

  return value === 1 ? "archived" : "active";
}

export function mapHabit(dto: HabitResponseDto): Habit {
  return {
    id: dto.habitId,
    habitTeamId: dto.habitTeamId,
    creatorId: dto.creatorId,
    name: dto.name,
    type: mapHabitType(dto.habitType),
    goal: dto.goal ?? undefined,
    unit: dto.unit ?? undefined,
    endDate: dto.expiryDate ?? undefined,
    status: mapHabitState(dto.habitState),
  };
}