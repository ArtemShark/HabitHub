import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ForgotPasswordPage from "./page";

process.env.NEXT_PUBLIC_API_BASE_URL = "http://test";

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

function jsonResponse(data: unknown, status = 200) {
    return {
        ok: status >= 200 && status < 300,
        status,
        headers: {
            get: (key: string) =>
                key.toLowerCase() === "content-type" ? "application/json" : null,
        },
        json: async () => data,
        text: async () => JSON.stringify(data),
    };
}

function textResponse(text: string, status = 500) {
    return {
        ok: status >= 200 && status < 300,
        status,
        headers: {
            get: (key: string) =>
                key.toLowerCase() === "content-type" ? "text/plain" : null,
        },
        json: async () => {
            throw new Error("not json");
        },
        text: async () => text,
    };
}

describe("ForgotPasswordPage", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        window.scrollTo = jest.fn();

        global.fetch = jest.fn(() =>
            Promise.resolve(
                jsonResponse({
                    message: "Password reset successfully. Please log in with your new password.",
                }) as unknown as Response
            )
        );
    });

    it("renders reset password form", () => {
        render(<ForgotPasswordPage />);

        expect(screen.getByRole("heading", { name: /reset password/i })).toBeInTheDocument();
        expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/^new password$/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/^confirm password$/i)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /reset password/i })).toBeInTheDocument();
    });

    it("submits forgot password request", async () => {
        render(<ForgotPasswordPage />);

        fireEvent.change(screen.getByLabelText(/email/i), {
            target: { value: "test@example.com" },
        });
        fireEvent.change(screen.getByLabelText(/^new password$/i), {
            target: { value: "newpass123" },
        });
        fireEvent.change(screen.getByLabelText(/^confirm password$/i), {
            target: { value: "newpass123" },
        });

        fireEvent.click(screen.getByRole("button", { name: /reset password/i }));

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining("/api/auth/forgot-password"),
                expect.objectContaining({
                    method: "POST",
                    body: JSON.stringify({
                        email: "test@example.com",
                        newPassword: "newpass123",
                        confirmPassword: "newpass123",
                    }),
                })
            );
        });

        expect(
            await screen.findByText(/password reset successfully/i)
        ).toBeInTheDocument();
    });

    it("validates password confirmation before request", () => {
        render(<ForgotPasswordPage />);

        fireEvent.change(screen.getByLabelText(/email/i), {
            target: { value: "test@example.com" },
        });
        fireEvent.change(screen.getByLabelText(/^new password$/i), {
            target: { value: "newpass123" },
        });
        fireEvent.change(screen.getByLabelText(/^confirm password$/i), {
            target: { value: "different" },
        });

        fireEvent.click(screen.getByRole("button", { name: /reset password/i }));

        expect(screen.getByText(/password confirmation does not match/i)).toBeInTheDocument();
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it("shows backend error", async () => {
        (global.fetch as jest.Mock).mockResolvedValue(
            textResponse("No account with this email was found.", 404)
        );

        render(<ForgotPasswordPage />);

        fireEvent.change(screen.getByLabelText(/email/i), {
            target: { value: "missing@example.com" },
        });
        fireEvent.change(screen.getByLabelText(/^new password$/i), {
            target: { value: "newpass123" },
        });
        fireEvent.change(screen.getByLabelText(/^confirm password$/i), {
            target: { value: "newpass123" },
        });

        fireEvent.click(screen.getByRole("button", { name: /reset password/i }));

        expect(
            await screen.findByText(/no account with this email was found/i)
        ).toBeInTheDocument();
    });
});
