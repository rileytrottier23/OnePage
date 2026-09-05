import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import AIInsightsPage from "./AIInsightsPage";
import { queryClient as sharedQc } from "@/lib/queryClient";

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: 1, username: "testuser" } }),
}));

vi.mock("@/components/Header", () => ({
  default: () => null,
}));

const { mockApiRequest } = vi.hoisted(() => ({
  mockApiRequest: vi.fn(),
}));

vi.mock("@/lib/queryClient", async () => {
  const { QueryClient } = await import("@tanstack/react-query");
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    apiRequest: mockApiRequest,
    queryClient: qc,
  };
});

vi.mock("dompurify", () => ({
  default: {
    sanitize: (html: string) => html,
  },
}));

function buildWrapper() {
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: sharedQc }, children);
  return { Wrapper };
}

describe("AIInsightsPage client", () => {
  beforeEach(() => {
    mockApiRequest.mockReset();
    localStorage.clear();
    sharedQc.clear();
  });

  it("renders the page heading and generate button", async () => {
    mockApiRequest.mockResolvedValue({
      json: async () => ({ insights: null, generatedAt: null }),
    });

    const { Wrapper } = buildWrapper();
    render(createElement(AIInsightsPage), { wrapper: Wrapper });

    expect(screen.getByText("AI Productivity Insights")).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /generate insights/i })
      ).toBeInTheDocument()
    );
  });

  it("shows error Alert with message and Try again button on mutation failure", async () => {
    mockApiRequest
      .mockResolvedValueOnce({
        json: async () => ({ insights: null, generatedAt: null }),
      })
      .mockRejectedValueOnce(
        new Error(
          "AI_RATE_LIMITED: OpenAI is receiving too many requests right now. Please wait a moment and try again."
        )
      );

    const { Wrapper } = buildWrapper();
    render(createElement(AIInsightsPage), { wrapper: Wrapper });

    const generateBtn = await screen.findByRole("button", {
      name: /generate insights/i,
    });
    await userEvent.click(generateBtn);

    await waitFor(() =>
      expect(
        screen.getByText("Could not generate insights")
      ).toBeInTheDocument()
    );

    expect(
      screen.getByText(/OpenAI is receiving too many requests/)
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: /try again/i })
    ).toBeInTheDocument();
  });

  it("shows error Alert for missing API key", async () => {
    mockApiRequest
      .mockResolvedValueOnce({
        json: async () => ({ insights: null, generatedAt: null }),
      })
      .mockRejectedValueOnce(
        new Error(
          "AI_KEY_MISSING: No Anthropic API key is configured. Please add your ANTHROPIC_API_KEY to the environment."
        )
      );

    const { Wrapper } = buildWrapper();
    render(createElement(AIInsightsPage), { wrapper: Wrapper });

    const generateBtn = await screen.findByRole("button", {
      name: /generate insights/i,
    });
    await userEvent.click(generateBtn);

    await waitFor(() =>
      expect(
        screen.getByText("Could not generate insights")
      ).toBeInTheDocument()
    );

    expect(
      screen.getByText(/No Anthropic API key is configured/)
    ).toBeInTheDocument();
  });

  it("shows error Alert for quota exceeded", async () => {
    mockApiRequest
      .mockResolvedValueOnce({
        json: async () => ({ insights: null, generatedAt: null }),
      })
      .mockRejectedValueOnce(
        new Error(
          "AI_QUOTA_EXCEEDED: Your OpenAI account has exceeded its usage quota. Please check your billing details."
        )
      );

    const { Wrapper } = buildWrapper();
    render(createElement(AIInsightsPage), { wrapper: Wrapper });

    const generateBtn = await screen.findByRole("button", {
      name: /generate insights/i,
    });
    await userEvent.click(generateBtn);

    await waitFor(() =>
      expect(
        screen.getByText("Could not generate insights")
      ).toBeInTheDocument()
    );

    expect(
      screen.getByText(/exceeded its usage quota/)
    ).toBeInTheDocument();
  });

  it("renders DOMPurify-sanitized HTML in success card", async () => {
    const insightHtml =
      "<h3>Summary</h3><p>You completed <strong>5</strong> tasks.</p>";

    mockApiRequest
      .mockResolvedValueOnce({
        json: async () => ({ insights: null, generatedAt: null }),
      })
      .mockResolvedValueOnce({
        json: async () => ({
          insights: insightHtml,
          generatedAt: new Date().toISOString(),
        }),
      });

    const { Wrapper } = buildWrapper();
    render(createElement(AIInsightsPage), { wrapper: Wrapper });

    const generateBtn = await screen.findByRole("button", {
      name: /generate insights/i,
    });
    await userEvent.click(generateBtn);

    await waitFor(() =>
      expect(screen.getByText("Summary")).toBeInTheDocument()
    );

    expect(screen.getByText(/You completed/)).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("shows Regenerate Insights button after successful generation", async () => {
    const insightHtml = "<p>Great work this month!</p>";

    mockApiRequest
      .mockResolvedValueOnce({
        json: async () => ({ insights: null, generatedAt: null }),
      })
      .mockResolvedValueOnce({
        json: async () => ({
          insights: insightHtml,
          generatedAt: new Date().toISOString(),
        }),
      });

    const { Wrapper } = buildWrapper();
    render(createElement(AIInsightsPage), { wrapper: Wrapper });

    const generateBtn = await screen.findByRole("button", {
      name: /generate insights/i,
    });
    await userEvent.click(generateBtn);

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /regenerate insights/i })
      ).toBeInTheDocument()
    );
  });

  it("shows service-down error message and Try again button", async () => {
    mockApiRequest
      .mockResolvedValueOnce({
        json: async () => ({ insights: null, generatedAt: null }),
      })
      .mockRejectedValueOnce(
        new Error(
          "AI_SERVICE_DOWN: The OpenAI service is temporarily unavailable. Please try again in a few minutes."
        )
      );

    const { Wrapper } = buildWrapper();
    render(createElement(AIInsightsPage), { wrapper: Wrapper });

    const generateBtn = await screen.findByRole("button", {
      name: /generate insights/i,
    });
    await userEvent.click(generateBtn);

    await waitFor(() =>
      expect(
        screen.getByText("Could not generate insights")
      ).toBeInTheDocument()
    );

    expect(
      screen.getByText(/temporarily unavailable/)
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: /try again/i })
    ).toBeInTheDocument();
  });
});
