import { toNullable } from "@/lib/utils";

type ProductFormValues = {
  name: string;
  nameAr: string;
  description?: string;
  descriptionAr?: string;
  price: number;
  imageUrl?: string;
};

/** Create: cleared optional fields are simply left out. */
export function buildProductCreatePayload(values: ProductFormValues) {
  return {
    name: values.name,
    nameAr: values.nameAr,
    description: values.description?.trim() || undefined,
    descriptionAr: values.descriptionAr?.trim() || undefined,
    price: values.price,
    imageUrl: values.imageUrl?.trim() || undefined,
  };
}

/**
 * Update: cleared optional fields are sent as null. undefined is dropped from
 * the JSON body, so the backend would keep the old value.
 */
export function buildProductUpdatePayload(values: ProductFormValues) {
  return {
    name: values.name,
    nameAr: values.nameAr,
    description: toNullable(values.description),
    descriptionAr: toNullable(values.descriptionAr),
    price: values.price,
    imageUrl: toNullable(values.imageUrl),
  };
}
