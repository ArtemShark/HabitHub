import { render, screen } from "@testing-library/react";
import HomePage from "./page";

jest.mock("next/link", () => {
    return ({ children, href }: { children: React.ReactNode; href: string }) => (
        <a href={href}>{children}</a>
    );
});

jest.mock("framer-motion", () => {
    const React = require("react");

    const MockMotionComponent = React.forwardRef(
        (
            {
                children,
                whileHover,
                whileTap,
                ...props
            }: React.PropsWithChildren<Record<string, unknown>>,
            ref: React.Ref<HTMLElement>
        ) => React.createElement("div", { ...props, ref }, children)
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

describe("DashboardPage", () => {
    it("renders main dashboard content", () => {
        render(<HomePage />);

        expect(screen.getByText(/habithub dashboard/i)).toBeInTheDocument();
        expect(screen.getByText(/welcome back/i)).toBeInTheDocument();
        expect(screen.getByText(/active sessions/i)).toBeInTheDocument();
        expect(screen.getByText(/progress overview/i)).toBeInTheDocument();
        expect(screen.getByText(/today's goals/i)).toBeInTheDocument();
    });

    it("renders main navigation links", () => {
        render(<HomePage />);

        expect(screen.getByRole("link", { name: /home/i })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /teams/i })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /^habits$/i })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /progress/i })).toBeInTheDocument();
    });
});