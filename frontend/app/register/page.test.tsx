import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import RegisterPage from "./page";

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

describe("RegisterPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    Object.defineProperty(window, "localStorage", {
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
            json: async () => ({
              token: "register-token",
              userId: "user-1",
              username: "ashley",
              email: "test@example.com",
              sessionId: "session-1",
            })
        } as unknown as Response)
        );
  });

  it("renders register form", () => {
    render(<RegisterPage />);

    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /create account/i })
    ).toBeInTheDocument();
  });

  it("shows error when passwords do not match", async () => {
    render(<RegisterPage />);

    fireEvent.change(screen.getByLabelText(/username/i), {
      target: { value: "ashley" },
    });
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "123456" },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: "654321" },
    });

    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("registers successfully and stores token + user", async () => {
    const responseData = {
      token: "register-token",
      userId: "user-1",
      username: "ashley",
      email: "test@example.com",
      sessionId: "session-1",
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: () => "application/json",
      },
      json: async () => responseData,
    });

    render(<RegisterPage />);

    fireEvent.change(screen.getByLabelText(/username/i), {
      target: { value: "ashley" },
    });
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "123456" },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: "123456" },
    });

    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    expect(localStorage.setItem).toHaveBeenCalledWith("token", "register-token");
    expect(localStorage.setItem).toHaveBeenCalledWith("sessionId", "session-1");

    expect(localStorage.setItem).toHaveBeenCalledWith(
      "user",
      JSON.stringify({
        userId: "user-1",
        username: "ashley",
        email: "test@example.com",
      })
    );
  });

  it("shows backend error when registration fails", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 400,
      headers: {
        get: () => "text/plain",
      },
      text: async () => "Email already in use",
    });

    render(<RegisterPage />);

    fireEvent.change(screen.getByLabelText(/username/i), {
      target: { value: "ashley" },
    });
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "123456" },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: "123456" },
    });

    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/email already in use/i)).toBeInTheDocument();
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

    render(<RegisterPage />);

    fireEvent.change(screen.getByLabelText(/username/i), {
      target: { value: "ashley" },
    });
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "123456" },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: "123456" },
    });

    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    expect(
      screen.getByRole("button", { name: /creating account/i })
    ).toBeDisabled();

    resolveFetch({
      ok: true,
      status: 200,
      headers: {
        get: () => "application/json",
      },
      json: async () => ({
        token: "register-token",
        userId: "user-1",
        username: "ashley",
        email: "test@example.com",
        sessionId: "session-1",
      })
    });

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/dashboard");
    });
  });
});