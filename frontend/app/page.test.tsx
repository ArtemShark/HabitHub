import Home from "./page";

const redirectMock = jest.fn();

jest.mock("next/navigation", () => ({
    redirect: (url: string) => redirectMock(url),
}));

describe("Home page redirect", () => {
    it("redirects root page to login", () => {
        Home();

        expect(redirectMock).toHaveBeenCalledWith("/login");
    });
});