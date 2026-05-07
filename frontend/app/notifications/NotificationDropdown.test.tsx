import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import NotificationDropdown from "./NotificationDropdown";
import { apiFetch } from "../auxiliary/apiFetch";

jest.mock("../auxiliary/apiFetch", () => ({
  apiFetch: jest.fn(),
}));

jest.mock("framer-motion", () => {
  const React = require("react");
  const cleanProps = (props: Record<string, unknown>) => {
    const { whileHover, whileTap, layout, initial, animate, exit, transition, variants, ...rest } = props;
    return rest;
  };
  const MockMotionComponent = React.forwardRef(
    ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>, ref: React.Ref<HTMLElement>) =>
      React.createElement("div", { ...cleanProps(props), ref }, children)
  );
  return {
    motion: new Proxy({}, { get: () => MockMotionComponent }),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

function getBellTrigger() {
  return document.querySelector(".relative > div") as HTMLElement;
}

describe("NotificationDropdown", () => {
  beforeEach(() => {
    jest.mocked(apiFetch).mockImplementation(async (endpoint) => {
      if (String(endpoint).endsWith("/read")) {
        return undefined;
      }

      return [
        {
          notificationId: "1",
          content: "Password changed successfully",
          createdAt: "2026-05-07T18:20:00Z",
          read: false,
        },
        {
          notificationId: "2",
          content: "Email updated successfully",
          createdAt: "2026-05-07T18:21:00Z",
          read: false,
        },
      ];
    });
  });

  it("renders the bell icon", async () => {
    render(<NotificationDropdown />);
    expect(getBellTrigger()).toBeInTheDocument();
    expect(await screen.findByText("2")).toBeInTheDocument();
  });

  it("shows unread count badge", async () => {
    render(<NotificationDropdown />);
    expect(await screen.findByText("2")).toBeInTheDocument();
  });

  it("dropdown is closed by default", async () => {
    render(<NotificationDropdown />);
    expect(await screen.findByText("2")).toBeInTheDocument();
    expect(screen.queryByText("Notifications")).not.toBeInTheDocument();
  });

  it("opens dropdown when bell is clicked", async () => {
    render(<NotificationDropdown />);
    fireEvent.click(getBellTrigger());
    expect(screen.getByText("Notifications")).toBeInTheDocument();
    expect(await screen.findByText("2")).toBeInTheDocument();
  });

  it("displays notification content when opened", async () => {
    render(<NotificationDropdown />);
    fireEvent.click(getBellTrigger());
    expect(await screen.findByText("Password changed successfully")).toBeInTheDocument();
    expect(await screen.findByText("Email updated successfully")).toBeInTheDocument();
  });

  it("decreases unread count when a notification is clicked", async () => {
    render(<NotificationDropdown />);
    expect(await screen.findByText("2")).toBeInTheDocument();

    fireEvent.click(getBellTrigger());
    fireEvent.click(await screen.findByText("Password changed successfully"));

    await waitFor(() => {
      expect(screen.getByText("1")).toBeInTheDocument();
    });
  });

  it("closes dropdown when clicking trigger again", async () => {
    render(<NotificationDropdown />);
    fireEvent.click(getBellTrigger());
    expect(screen.getByText("Notifications")).toBeInTheDocument();
    expect(await screen.findByText("2")).toBeInTheDocument();
    fireEvent.click(getBellTrigger());
    expect(screen.queryByText("Notifications")).not.toBeInTheDocument();
  });

  it("closes dropdown when clicking outside", async () => {
    render(<NotificationDropdown />);
    fireEvent.click(getBellTrigger());
    expect(screen.getByText("Notifications")).toBeInTheDocument();
    expect(await screen.findByText("2")).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByText("Notifications")).not.toBeInTheDocument();
  });
});
