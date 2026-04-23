import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import TeamsPage from "./page";
import { head } from "framer-motion/client";

jest.mock("next/link", () => {
    return ({ children, href }: { children: React.ReactNode; href: string }) => (
        <a href={href}>{children}</a>
    );
});

jest.mock("framer-motion", () => {
    const React = require("react");

    const cleanProps = (props: Record<string, unknown>) => {
        const {
            whileHover,
            whileTap,
            layout,
            initial,
            animate,
            exit,
            transition,
            variants,
            ...rest
        } = props;
        return rest;
    };

    const MockMotionComponent = React.forwardRef(
        (
            {
                children,
                ...props
            }: React.PropsWithChildren<Record<string, unknown>>,
            ref: React.Ref<HTMLElement>
        ) => React.createElement("div", { ...cleanProps(props), ref }, children)
    );

    return {
        motion: new Proxy(
            {},
            {
                get: () => MockMotionComponent,
            }
        ),
        AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    };
});

describe("TeamsPage", () => {
    const creatorToken =
        "header." + btoa(JSON.stringify({ nameid: "creator-1" })) + ".signature";

    beforeEach(() => {
        jest.clearAllMocks();

        Object.defineProperty(window, "localStorage", {
            value: {
                getItem: jest.fn((key: string) => {
                    if (key === "token") return creatorToken;
                    return null;
                }),
                setItem: jest.fn(),
                removeItem: jest.fn(),
                clear: jest.fn(),
            },
            writable: true,
        });

        Object.defineProperty(window, "sessionStorage", {
            value: {
                getItem: jest.fn(() => null),
                setItem: jest.fn(),
                removeItem: jest.fn(),
                clear: jest.fn(),
            },
            writable: true,
        });

        Object.defineProperty(window, "navigator", {
            value: {
                clipboard: {
                    writeText: jest.fn(),
                },
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
            json: async () => ({ token: "fake-token", user: { id: "1" } }),
        } as unknown as Response)
        );
    });

    function jsonResponse(data: unknown, status = 200) {
        return Promise.resolve({
            ok: status >= 200 && status < 300,
            status,
            headers: {
            get: () => "application/json",
            },
            json: async () => data,
            text: async () => JSON.stringify(data),
        });
    }

    function textError(message: string, status = 500) {
        return Promise.resolve({
            ok: false,
            status,
            headers: {
            get: () => "text/plain",
            },
            json: async () => {
            throw new Error("No JSON body");
            },
            text: async () => message,
        });
    }

    it("renders create team and join team forms correctly", async () => {
        (global.fetch as jest.Mock)
            .mockImplementationOnce(() => jsonResponse([]));

        render(<TeamsPage />);

        expect(await screen.findByLabelText(/team name/i)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /create team/i })).toBeInTheDocument();
        expect(screen.getByLabelText(/invite code/i)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /join team/i })).toBeInTheDocument();
    });

    it("creates a team successfully and refreshes team list", async () => {
        const createdTeam = {
            habitTeamId: "team-1",
            name: "Morning Momentum",
            creatorId: "creator-1",
            members: [{ memberId: "creator-1", name: "Ashley", email: "ashley@example.com" }],
        };

        (global.fetch as jest.Mock)
            .mockImplementationOnce(() => jsonResponse([]))
            .mockImplementationOnce(() => jsonResponse(createdTeam, 201))
            .mockImplementationOnce(() => jsonResponse([createdTeam]))
            .mockImplementationOnce(() => jsonResponse(createdTeam));

        render(<TeamsPage />);

        fireEvent.change(await screen.findByLabelText(/team name/i), {
            target: { value: "Morning Momentum" },
        });

        fireEvent.click(screen.getByRole("button", { name: /create team/i }));

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                "/api/teams",
                expect.objectContaining({
                    method: "POST",
                    body: JSON.stringify({ name: "Morning Momentum" }),
                })
            );
        });

        expect(await screen.findByText(/team created successfully/i)).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.getAllByText("Morning Momentum").length).toBeGreaterThan(0);
        });
    });

    it("shows error when team creation fails", async () => {
        (global.fetch as jest.Mock)
            .mockImplementationOnce(() => jsonResponse([]))
            .mockImplementationOnce(() => textError("Failed to create team", 400));

        render(<TeamsPage />);

        fireEvent.change(await screen.findByLabelText(/team name/i), {
            target: { value: "Broken Team" },
        });

        fireEvent.click(screen.getByRole("button", { name: /create team/i }));

        expect(await screen.findByText(/failed to create team/i)).toBeInTheDocument();
        expect(screen.queryByText("Broken Team")).not.toBeInTheDocument();
    });

    it("shows loading state while creating team", async () => {
        let resolveCreate: (value: unknown) => void = () => { };

        const createdTeam = {
            habitTeamId: "team-2",
            name: "Loading Team",
            creatorId: "creator-1",
            members: [],
        };

        (global.fetch as jest.Mock)
            .mockImplementationOnce(() => jsonResponse([]))
            .mockImplementationOnce(
                () =>
                    new Promise((resolve) => {
                        resolveCreate = resolve;
                    })
            )
            .mockImplementationOnce(() => jsonResponse([createdTeam]))
            .mockImplementationOnce(() => jsonResponse(createdTeam));

        render(<TeamsPage />);

        fireEvent.change(await screen.findByLabelText(/team name/i), {
            target: { value: "Loading Team" },
        });

        fireEvent.click(screen.getByRole("button", { name: /create team/i }));

        expect(screen.getByRole("button", { name: /creating/i })).toBeDisabled();

        resolveCreate({
            ok: true,
            status: 201,
            headers: {
                get: () => "application/json",
            },
            json: async () => createdTeam,
            text: async () => JSON.stringify(createdTeam),
        });

        expect(await screen.findByText(/team created successfully/i)).toBeInTheDocument();
    });

    it("joins a team successfully and refreshes team list", async () => {
        const joinedTeam = {
            habitTeamId: "team-3",
            name: "Joined Team",
            creatorId: "creator-99",
            members: [
                { memberId: "creator-99", name: "Creator", email: "creator@example.com" },
                { memberId: "creator-1", name: "Ashley", email: "ashley@example.com" },
            ],
        };

        (global.fetch as jest.Mock)
            .mockImplementationOnce(() => jsonResponse([]))
            .mockImplementationOnce(() => jsonResponse({}, 200))
            .mockImplementationOnce(() => jsonResponse([joinedTeam]))
            .mockImplementationOnce(() => jsonResponse(joinedTeam));

        render(<TeamsPage />);

        fireEvent.change(await screen.findByLabelText(/invite code/i), {
            target: { value: "JOIN1234" },
        });

        fireEvent.click(screen.getByRole("button", { name: /join team/i }));

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                "/api/teams/join",
                expect.objectContaining({
                    method: "POST",
                    body: JSON.stringify({ code: "JOIN1234" }),
                })
            );
        });

        expect(await screen.findByText(/joined team successfully/i)).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.getAllByText("Joined Team").length).toBeGreaterThan(0);
        });
    });

    it("shows error when joining team fails", async () => {
        (global.fetch as jest.Mock)
            .mockImplementationOnce(() => jsonResponse([]))
            .mockImplementationOnce(() => textError("Invalid invite code", 409));

        render(<TeamsPage />);

        fireEvent.change(await screen.findByLabelText(/invite code/i), {
            target: { value: "WRONG123" },
        });

        fireEvent.click(screen.getByRole("button", { name: /join team/i }));

        expect(await screen.findByText(/invalid invite code/i)).toBeInTheDocument();
    });

    it("shows loading state while joining team", async () => {
        let resolveJoin: (value: unknown) => void = () => { };

        const joinedTeam = {
            habitTeamId: "team-4",
            name: "Joining Team",
            creatorId: "creator-1",
            members: [],
        };

        (global.fetch as jest.Mock)
            .mockImplementationOnce(() => jsonResponse([]))
            .mockImplementationOnce(
                () =>
                    new Promise((resolve) => {
                        resolveJoin = resolve;
                    })
            )
            .mockImplementationOnce(() => jsonResponse([joinedTeam]))
            .mockImplementationOnce(() => jsonResponse(joinedTeam));

        render(<TeamsPage />);

        fireEvent.change(await screen.findByLabelText(/invite code/i), {
            target: { value: "TEAM2026" },
        });

        fireEvent.click(screen.getByRole("button", { name: /join team/i }));

        expect(screen.getByRole("button", { name: /joining/i })).toBeDisabled();

        resolveJoin({
            ok: true,
            status: 200,
            headers: {
                get: () => "application/json",
            },
            json: async () => ({}),
            text: async () => "",
        });

        expect(await screen.findByText(/joined team successfully/i)).toBeInTheDocument();
    });
});