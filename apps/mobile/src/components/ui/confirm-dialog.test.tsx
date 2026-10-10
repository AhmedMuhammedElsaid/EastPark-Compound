import { act, fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";
import { StyleSheet } from "react-native";

import { showConfirm } from "@/lib/confirm-dialog";
import { SEMANTIC } from "@/theme/tokens";

import { ConfirmDialogHost } from "./confirm-dialog";

const mockSelection = jest.fn();
const mockImpact = jest.fn();
const mockNotification = jest.fn();

jest.mock("expo-haptics", () => ({
  selectionAsync: () => mockSelection(),
  impactAsync: () => mockImpact(),
  notificationAsync: () => mockNotification(),
  ImpactFeedbackStyle: { Medium: "medium" },
  NotificationFeedbackType: { Warning: "warning" },
}));
jest.mock("react-i18next", () => ({ useTranslation: jest.fn(() => ({ t: (k: string) => k })) }));
jest.mock("@/lib/hooks/use-app-colors", () => ({ useAppColors: jest.fn(() => require("@/theme/tokens").DARK) }));

beforeEach(() => {
  mockSelection.mockReset();
  mockImpact.mockReset();
  mockNotification.mockReset();
});

function ask(options: Parameters<typeof showConfirm>[0]) {
  let answer!: Promise<boolean>;
  act(() => {
    answer = showConfirm(options);
  });
  return answer;
}

describe("confirm dialog host", () => {
  it("renders nothing until asked", () => {
    render(<ConfirmDialogHost />);
    expect(screen.queryByTestId("confirm-dialog-confirm")).toBeNull();
  });

  it("shows title and message and resolves true on the action", async () => {
    render(<ConfirmDialogHost />);
    const answer = ask({ title: "Vote", message: "Vote for Option A?", confirmLabel: "Vote" });

    expect(screen.getByRole("header")).toHaveTextContent("Vote");
    expect(screen.getByText("Vote for Option A?")).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId("confirm-dialog-confirm"));

    await expect(answer).resolves.toBe(true);
    expect(mockImpact).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("confirm-dialog-confirm")).toBeNull();
  });

  it("puts dismiss first, defaults its label to common.cancel and resolves false", async () => {
    render(<ConfirmDialogHost />);
    const answer = ask({ title: "Clear cart?", confirmLabel: "Clear" });

    const buttons = screen.getAllByRole("button");
    expect(buttons.map(b => b.props.accessibilityLabel)).toEqual(["common.cancel", "Clear"]);
    fireEvent.press(screen.getByTestId("confirm-dialog-cancel"));

    await expect(answer).resolves.toBe(false);
    expect(mockSelection).toHaveBeenCalledTimes(1);
  });

  it("uses a custom dismiss label", () => {
    render(<ConfirmDialogHost />);
    ask({ title: "Cancel this order?", confirmLabel: "Cancel order", cancelLabel: "Keep order", destructive: true });
    expect(screen.getByLabelText("Keep order")).toBeOnTheScreen();
  });

  it("paints a destructive action in the error colour with a warning haptic", async () => {
    render(<ConfirmDialogHost />);
    const answer = ask({ title: "Sign out?", confirmLabel: "Sign out", destructive: true });

    const style = StyleSheet.flatten(screen.getByTestId("confirm-dialog-confirm").props.style);
    expect(style.backgroundColor).toBe(SEMANTIC.error);
    fireEvent.press(screen.getByTestId("confirm-dialog-confirm"));

    await expect(answer).resolves.toBe(true);
    expect(mockNotification).toHaveBeenCalledTimes(1);
  });

  it("treats Android Back (request close) as dismiss", async () => {
    const { UNSAFE_getByType } = render(<ConfirmDialogHost />);
    const answer = ask({ title: "Discard changes?", confirmLabel: "Discard" });

    const { Modal } = require("react-native");
    act(() => {
      UNSAFE_getByType(Modal).props.onRequestClose();
    });
    await expect(answer).resolves.toBe(false);
  });

  it("treats a tap on the scrim as dismiss", async () => {
    render(<ConfirmDialogHost />);
    const answer = ask({ title: "Delete?", confirmLabel: "Delete", destructive: true });
    fireEvent.press(screen.getByTestId("confirm-dialog-scrim", { includeHiddenElements: true }));
    await expect(answer).resolves.toBe(false);
  });

  it("resolves false when the host is not mounted", async () => {
    await expect(showConfirm({ title: "Orphan", confirmLabel: "OK" })).resolves.toBe(false);
  });
});
