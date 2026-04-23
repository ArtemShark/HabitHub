export type HabitStatus = "active" | "archived";
export type HabitType = "binary" | "value";
export type EntryStatus = "Logged" | "Pending" | "Skipped";

//  habitType: number | string;

export type HabitResponseDto = {
  habitId: string;
  habitTeamId: string;
  creatorId: string;
  name: string;
  goal?: string | null;
  habitState: HabitStatus;
  expiryDate?: string | null;
  habitType: HabitType;
  unit?: string | null;
};

export type UpdateHabitRequestDto = {
  name?: string;
  goal?: string | null;
  habitType?: HabitType;
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

export type HabitEntryResponse = {
  habitEntryId: string;
  habitId: string;
  memberId: string;
  value?: number;
  status: number | string;
  notes: string;
  date: string;
};


export type HabitEntryRequest = {
  value?: number;
  status: EntryStatus;
  notes: string;
}