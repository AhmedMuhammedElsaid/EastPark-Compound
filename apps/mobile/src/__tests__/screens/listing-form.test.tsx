import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as React from "react";

import { ListingForm } from "@/components/listings/listing-form";
import { EMPTY_LISTING_FORM } from "@/lib/listings";
import { listingsApi } from "@/services/api/listings";

let mockUnit = { building: "QA", floor: "0", flatNumber: "1", label: "QA-0-1" };

jest.mock("@/store", () => ({
  useAppSelector: (selector: (state: unknown) => unknown) =>
    selector({ auth: { user: { units: [mockUnit], unitNumber: mockUnit.label } } }),
}));
jest.mock("expo-router", () => ({ router: { back: jest.fn(), replace: jest.fn() } }));
jest.mock("expo-haptics", () => ({ impactAsync: jest.fn(), ImpactFeedbackStyle: { Light: "light" } }));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "en" } }),
}));
jest.mock("react-native-flash-message", () => ({ showMessage: jest.fn() }));
jest.mock("@/lib/hooks/use-discard-guard", () => ({ useDiscardGuard: jest.fn() }));
jest.mock("@/lib/hooks/use-app-colors", () => {
  const { DARK } = require("@/theme/tokens");
  return { useAppColors: () => DARK };
});
jest.mock("@/components/listings/listing-photo-field", () => ({ ListingPhotoField: () => null }));
jest.mock("@/services/api/uploads", () => ({ uploadsApi: { uploadImage: jest.fn() } }));
jest.mock("@/services/api/listings", () => ({
  listingKeys: { all: ["listings"] },
  listingsApi: { create: jest.fn(), update: jest.fn() },
}));

function renderForm(overrides = {}) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: Infinity } } });
  return render(
    <QueryClientProvider client={client}>
      <ListingForm
        initialValues={{
          ...EMPTY_LISTING_FORM,
          ...mockUnit,
          price: "5000000",
          areaSqm: "135",
          bedrooms: "3",
          bathrooms: "2",
          contactPhone: "01012345678",
          ...overrides,
        }}
        initialPhotos={[{ uri: "https://example.com/flat.jpg", mime: null }]}
      />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUnit = { building: "QA", floor: "0", flatNumber: "1", label: "QA-0-1" };
  jest.mocked(listingsApi.create).mockResolvedValue({ data: { data: { id: "listing-1" } } } as any);
});

it("explains why the saved QA-0-1 flat cannot be submitted without uploading or posting", async () => {
  renderForm();
  fireEvent.press(screen.getByLabelText("listings.submit"));

  await waitFor(() => expect(screen.getAllByText("listings.error_flat_details")).toHaveLength(2));
  expect(screen.getAllByRole("alert")).toHaveLength(2);
  expect(listingsApi.create).not.toHaveBeenCalled();
});

it("shows offscreen field validation errors next to Submit", async () => {
  mockUnit = { building: "A1", floor: "3", flatNumber: "2", label: "A1-3-2" };
  renderForm({ price: "" });
  fireEvent.press(screen.getByLabelText("listings.submit"));

  await waitFor(() => expect(screen.getByRole("alert").props.children).toBe("listings.error_price"));
  expect(listingsApi.create).not.toHaveBeenCalled();
});

it("submits valid real-flat details", async () => {
  mockUnit = { building: "A1", floor: "3", flatNumber: "2", label: "A1-3-2" };
  renderForm();
  fireEvent.press(screen.getByLabelText("listings.submit"));

  await waitFor(() => expect(listingsApi.create).toHaveBeenCalledWith(expect.objectContaining({
    building: "A1",
    floor: "3",
    flatNumber: "2",
    price: 5000000,
    photos: ["https://example.com/flat.jpg"],
  })));
});
