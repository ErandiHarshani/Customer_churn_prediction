import { apiClient } from "./client";
import type {
  CreateCustomerRequest,
  CustomerDetail,
  CustomerFieldOptions,
  CustomerListResponse,
  RiskLevel,
} from "../types";

export interface CustomerListParams {
  page?: number;
  page_size?: number;
  search?: string;
  risk_level?: RiskLevel;
  prefered_order_cat?: string;
}

export async function getCustomers(params: CustomerListParams): Promise<CustomerListResponse> {
  const { data } = await apiClient.get<CustomerListResponse>("/api/customers", { params });
  return data;
}

export async function getCustomerDetail(customerId: number): Promise<CustomerDetail> {
  const { data } = await apiClient.get<CustomerDetail>(`/api/customers/${customerId}`);
  return data;
}

export async function getCustomerFieldOptions(): Promise<CustomerFieldOptions> {
  const { data } = await apiClient.get<CustomerFieldOptions>("/api/customers/meta/options");
  return data;
}

export async function createCustomer(payload: CreateCustomerRequest): Promise<CustomerDetail> {
  const { data } = await apiClient.post<CustomerDetail>("/api/customers", payload);
  return data;
}

export async function updateCustomerPhone(
  customerId: number,
  phoneNumber: string
): Promise<CustomerDetail> {
  const { data } = await apiClient.put<CustomerDetail>(`/api/customers/${customerId}/phone`, {
    phone_number: phoneNumber,
  });
  return data;
}
