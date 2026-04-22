export type HabitStatus = "active" | "archived";
export type HabitType = "binary" | "value";

export type HabitResponseDto = {
  habitId: string;
  habitTeamId: string;
  creatorId: string;
  name: string;
  goal?: string | null;
  habitState: number | string;
  expiryDate?: string | null;
  habitType: string;
  unit?: string | null;
};

export type UpdateHabitRequestDto = {
  name?: string;
  goal?: string | null;
  habitType?: string;
  expiryDate?: string | null;
  unit?: string | null;
};

export type Habit = {
  id: string;
  habitTeamId: string;
  creatorId: string;
  name: string;
  type: HabitType;
  goal?: string;
  unit?: string;
  endDate?: string;
  status: HabitStatus;
};

export type HabitFormData = {
  name: string;
  type: HabitType;
  goal: string;
  unit: string;
  endDate: string;
};