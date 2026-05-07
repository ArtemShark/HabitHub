import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import HabitHubLoginPage from "./page";

const pushMock = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

jest.mock("next/link", () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
});

const successResponse = {
  token: "fake-token",
  userId: "user-1",
  email: "test@example.com",
  username: "ashley",
  sessionId: "session-1",
};

describe("HabitHubLoginPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    window.scrollTo = jest.fn();

    Object.defineProperty(window, "localStorage", {
      value: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn(),
      },
      writable: true,
    });

    Object.defineProperty(window, "sessionStorage", {
      value: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn(),
      },
      writable: true,
    });

    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        headers: {
          get: () => "application/json",
        },
        json: async () => successResponse,
      } as unknown as Response)
    );
  });

  it("renders login form", () => {
    render(<HabitHubLoginPage />);

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/remember me/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /log in/i })).toBeInTheDocument();
  });

  it("logs in successfully and stores auth data in localStorage", async () => {
    render(<HabitHubLoginPage />);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "123456" },
    });

    fireEvent.click(screen.getByRole("button", { name: /log in/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    expect(localStorage.setItem).toHaveBeenCalledWith("token", "fake-token");
    expect(localStorage.setItem).toHaveBeenCalledWith("sessionId", "session-1");
    expect(localStorage.setItem).toHaveBeenCalledWith(
      "user",
      JSON.stringify({
        userId: "user-1",
        username: "ashley",
        email: "test@example.com",
      })
    );

    expect(sessionStorage.setItem).not.toHaveBeenCalled();
    expect(pushMock).toHaveBeenCalledWith("/dashboard");
  });

  it("logs in successfully when remember me is checked", async () => {
    render(<HabitHubLoginPage />);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByLabelText(/remember me/i));
    fireEvent.click(screen.getByRole("button", { name: /log in/i }));

    await waitFor(() => {
      expect(localStorage.setItem).toHaveBeenCalledWith("token", "fake-token");
    });

    expect(localStorage.setItem).toHaveBeenCalledWith("sessionId", "session-1");
    expect(pushMock).toHaveBeenCalledWith("/dashboard");
  });

  it("shows error when login fails", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 401,
      headers: {
        get: () => "text/plain",
      },
      text: async () => "Invalid credentials",
    });

    render(<HabitHubLoginPage />);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "wrong@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "wrongpass" },
    });

    fireEvent.click(screen.getByRole("button", { name: /log in/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
    });

    expect(pushMock).not.toHaveBeenCalled();
  });

  it("shows loading state while submitting", async () => {
    let resolveFetch: (value: unknown) => void = () => {};

    (global.fetch as jest.Mock).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        })
    );

    render(<HabitHubLoginPage />);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "123456" },
    });

    fireEvent.click(screen.getByRole("button", { name: /log in/i }));

    expect(screen.getByRole("button", { name: /logging in/i })).toBeDisabled();

    resolveFetch({
      ok: true,
      status: 200,
      headers: {
        get: () => "application/json",
      },
      json: async () => successResponse,
    });

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/dashboard");
    });
  });
});