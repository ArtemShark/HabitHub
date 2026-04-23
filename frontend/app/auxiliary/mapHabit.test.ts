import { mapHabit, mapHabitType, mapHabitState } from "./mapHabit";
import type { HabitResponseDto } from "../dto/Habit";

describe("mapHabitType", () => {
  it("maps string 'quantitative' to 'value'", () => {
    expect(mapHabitType("quantitative")).toBe("value");
  });

  it("maps string 'Quantitative' to 'value' (case insensitive)", () => {
    expect(mapHabitType("Quantitative")).toBe("value");
  });

  it("maps string 'binary' to 'binary'", () => {
    expect(mapHabitType("binary")).toBe("binary");
  });

  it("maps any other string to 'binary'", () => {
    expect(mapHabitType("something")).toBe("binary");
  });

  it("maps number 1 to 'value'", () => {
    expect(mapHabitType(1)).toBe("value");
  });

  it("maps number 0 to 'binary'", () => {
    expect(mapHabitType(0)).toBe("binary");
  });

  it("maps any other number to 'binary'", () => {
    expect(mapHabitType(99)).toBe("binary");
  });
});

describe("mapHabitState", () => {
  it("maps string 'archived' to 'archived'", () => {
    expect(mapHabitState("archived")).toBe("archived");
  });

  it("maps string 'Archived' to 'archived' (case insensitive)", () => {
    expect(mapHabitState("Archived")).toBe("archived");
  });

  it("maps string 'active' to 'active'", () => {
    expect(mapHabitState("active")).toBe("active");
  });

  it("maps any other string to 'active'", () => {
    expect(mapHabitState("something")).toBe("active");
  });

  it("maps number 1 to 'archived'", () => {
    expect(mapHabitState(1)).toBe("archived");
  });

  it("maps number 0 to 'active'", () => {
    expect(mapHabitState(0)).toBe("active");
  });

  it("maps any other number to 'active'", () => {
    expect(mapHabitState(99)).toBe("active");
  });
});

describe("mapHabit", () => {
  it("maps a complete DTO to a Habit object", () => {
    const dto: HabitResponseDto = {
      habitId: "abc-123",
      habitTeamId: "team-1",
      creatorId: "user-1",
      name: "Walk 10k steps",
      goal: "10000",
      habitState: "active",
      expiryDate: "2026-12-31T00:00:00Z",
      habitType: "quantitative",
      unit: "steps",
    };

    const result = mapHabit(dto);

    expect(result).toEqual({
      id: "abc-123",
      habitTeamId: "team-1",
      creatorId: "user-1",
      name: "Walk 10k steps",
      type: "value",
      goal: "10000",
      unit: "steps",
      endDate: "2026-12-31T00:00:00Z",
      status: "active",
    });
  });

  it("maps null goal to undefined", () => {
    const dto: HabitResponseDto = {
      habitId: "abc-123",
      habitTeamId: "team-1",
      creatorId: "user-1",
      name: "Meditate",
      goal: null,
      habitState: "active",
      habitType: "binary",
      unit: null,
      expiryDate: null,
    };

    const result = mapHabit(dto);

    expect(result.goal).toBeUndefined();
    expect(result.unit).toBeUndefined();
    expect(result.endDate).toBeUndefined();
  });

  it("maps missing optional fields to undefined", () => {
    const dto: HabitResponseDto = {
      habitId: "abc-456",
      habitTeamId: "team-2",
      creatorId: "user-2",
      name: "Read",
      habitState: "archived",
      habitType: "binary",
    };

    const result = mapHabit(dto);

    expect(result.id).toBe("abc-456");
    expect(result.status).toBe("archived");
    expect(result.goal).toBeUndefined();
    expect(result.unit).toBeUndefined();
    expect(result.endDate).toBeUndefined();
  });
});