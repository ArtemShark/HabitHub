import { render, screen, waitFor } from "@testing-library/react";
import LogoutPage from "./page";

const replaceMock = jest.fn();

jest.mock("next/navigation", () => ({
    useRouter: () => ({
        replace: replaceMock,
    }),
}));

describe("LogoutPage", () => {
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
    });

    it("removes auth data and redirects to login", async () => {
        render(<LogoutPage />);

        expect(screen.getByText(/logging you out/i)).toBeInTheDocument();

        await waitFor(() => {
            expect(localStorage.removeItem).toHaveBeenCalledWith("token");
            expect(localStorage.removeItem).toHaveBeenCalledWith("user");
            expect(replaceMock).toHaveBeenCalledWith("/login");
        });
    });
});