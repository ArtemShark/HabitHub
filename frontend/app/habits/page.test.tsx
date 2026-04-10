import { render, screen, fireEvent } from "@testing-library/react";
import HabitsPage from "./page";

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

describe("HabitsPage", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("renders habits page header and description", () => {
        render(<HabitsPage />);

        expect(
            screen.getByRole("heading", { name: /^habits$/i, level: 1 })
        ).toBeInTheDocument();

        expect(
            screen.getByText(/manage, update, archive, and track all team habits/i)
        ).toBeInTheDocument();
    });

    it("renders main navigation links", () => {
        render(<HabitsPage />);

        expect(screen.getByRole("link", { name: /home/i })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /teams/i })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /^habits$/i })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /progress/i })).toBeInTheDocument();
    });

    it("renders habit overview and management sections", () => {
        render(<HabitsPage />);

        expect(screen.getByText(/habit overview/i)).toBeInTheDocument();
        expect(screen.getByText(/habit management/i)).toBeInTheDocument();
    });

    it("renders active and archived tab buttons", () => {
        render(<HabitsPage />);

        expect(screen.getByRole("button", { name: /active habits/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /archived habits/i })).toBeInTheDocument();
    });

    it("allows switching between active and archived tabs", () => {
        render(<HabitsPage />);

        const activeButton = screen.getByRole("button", { name: /active habits/i });
        const archivedButton = screen.getByRole("button", { name: /archived habits/i });

        fireEvent.click(archivedButton);
        expect(screen.getByRole("button", { name: /archived habits/i })).toBeInTheDocument();

        fireEvent.click(activeButton);
        expect(screen.getByRole("button", { name: /active habits/i })).toBeInTheDocument();
    });

    it("shows create action as disabled because endpoint is not added yet", () => {
        render(<HabitsPage />);

        const createButton = screen.getByRole("button", {
            name: /create endpoint not added yet/i,
        });

        expect(createButton).toBeInTheDocument();
        expect(createButton).toBeDisabled();
    });

    it("renders static habit content blocks", () => {
        render(<HabitsPage />);

        expect(screen.getByText(/habit overview/i)).toBeInTheDocument();
        expect(screen.getByText(/habit management/i)).toBeInTheDocument();

        const buttons = screen.getAllByRole("button");
        expect(buttons.length).toBeGreaterThanOrEqual(3);
    });
});