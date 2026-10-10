export type RiskLevel = "high" | "medium" | "low";

export interface ModelMetric {
  name: string;
  f1: number;
  roc_auc: number;
  accuracy: number;
  precision?: number | null;
  recall?: number | null;
  threshold?: number | null;
}

export interface RiskDistribution {
  high: number;
  medium: number;
  low: number;
}

export interface ChurnDistribution {
  churn: number;
  non_churn: number;
}

export interface DashboardSummary {
  total_customers: number;
  actual_churn_rate: number;
  predicted_churn_rate: number;
  best_model_accuracy: number;
  best_model_name: string;
  model_version?: string | null;
  risk_threshold_high?: number | null;
  risk_threshold_medium?: number | null;
  risk_distribution: RiskDistribution;
  churn_distribution: ChurnDistribution;
  model_metrics: ModelMetric[];
}

export interface ModelCurve {
  name: string;
  fpr: number[];
  tpr: number[];
  auc: number;
  accuracy: number;
}

export interface RocCurveResponse {
  curves: ModelCurve[];
}

export interface CustomerSummary {
  customer_id: number;
  churn_probability: number;
  risk_level: RiskLevel;
  tenure: number | null;
  prefered_order_cat: string | null;
  complain: number | null;
  sentiment_label: string | null;
}

export interface CustomerListResponse {
  items: CustomerSummary[];
  total: number;
  page: number;
  page_size: number;
}

export interface CustomerProfile {
  tenure: number | null;
  city_tier: number | null;
  warehouse_to_home: number | null;
  preferred_login_device: string | null;
  preferred_payment_mode: string | null;
  gender: string | null;
  hour_spend_on_app: number | null;
  number_of_device_registered: number | null;
  prefered_order_cat: string | null;
  satisfaction_score: number | null;
  marital_status: string | null;
  number_of_address: number | null;
  complain: number | null;
  order_amount_hike_from_last_year: number | null;
  coupon_used: number | null;
  order_count: number | null;
  day_since_last_order: number | null;
  cashback_amount: number | null;
  review_text: string | null;
  review_rating: number | null;
  sentiment_score: number | null;
  sentiment_label: string | null;
  review_is_synthetic: boolean;
  last_product_purchased: string | null;
  last_product_purchased_is_generated: boolean;
}

export interface RetentionMessage {
  id: number;
  customer_id: number;
  sms_text: string;
  discount_percent: number;
  source: "gemini" | "fallback";
  generated_at: string;
}

export interface SmsLogEntry {
  id: number;
  phone_number: string;
  provider_status: string | null;
  success: boolean;
  dry_run: boolean;
  sent_at: string;
}

export interface ReasonImpact {
  label: string;
  impact_pct: number;
}

export interface CustomerDetail {
  customer_id: number;
  profile: CustomerProfile;
  churn_probability: number;
  risk_level: RiskLevel;
  top_reasons: string[];
  reason_impacts: ReasonImpact[];
  phone_number: string | null;
  latest_retention_message: RetentionMessage | null;
  sms_log: SmsLogEntry[];
}

export interface CustomerFieldOptions {
  preferred_payment_mode: string[];
  prefered_order_cat: string[];
  marital_status: string[];
}

/** The 12 model inputs are required; review feeds the sentiment input; the rest is stored only. */
export interface CreateCustomerRequest {
  tenure: number;
  city_tier: number;
  warehouse_to_home: number;
  number_of_device_registered: number;
  satisfaction_score: number;
  number_of_address: number;
  complain: number;
  day_since_last_order: number;
  cashback_amount: number;
  preferred_payment_mode: string;
  prefered_order_cat: string;
  marital_status: string;
  review_text?: string;
  phone_number?: string;
  last_product_purchased?: string;
}

export interface SendSmsResponse {
  success: boolean;
  provider_status: string | null;
  dry_run: boolean;
  sent_at: string;
}

export interface BulkTarget {
  customer_ids?: number[];
  all_matching?: boolean;
  search?: string;
  risk_level?: RiskLevel;
  prefered_order_cat?: string;
}

export interface BulkGenerateJobStarted {
  job_id: string;
  target_count: number;
}

export interface BulkGenerateJobStatus {
  job_id: string;
  target_count: number;
  processed: number;
  generated: number;
  already_had_message: number;
  failed: number;
  done: boolean;
  error: string | null;
}

export interface BulkSendSmsResponse {
  target_count: number;
  sent: number;
  failed: number;
  skipped_no_phone: number;
  skipped_no_message: number;
}

export interface SmsStats {
  total_sent: number;
  successful: number;
  failed: number;
  dry_run_count: number;
  real_count: number;
  real_successful: number;
}

export interface RetentionStats {
  total_generated: number;
  gemini_generated: number;
  fallback_generated: number;
}

export interface RecentSmsEntry {
  customer_id: number;
  phone_number: string;
  message: string | null;
  provider_status: string | null;
  success: boolean;
  dry_run: boolean;
  sent_at: string;
}

export interface EngagementAnalytics {
  sms_stats: SmsStats;
  retention_stats: RetentionStats;
  recent_sms: RecentSmsEntry[];
}

export interface RiskExample {
  churn_probability: number;
  risk_level: RiskLevel;
}

export interface LoginStats {
  total_customers: number;
  best_model_auc: number;
  model_name: string;
  model_version: string;
  risk_examples: RiskExample[];
  last_scored_at: string | null;
}

export interface SmsGatewaySettings {
  user_id: string;
  api_key: string;
  sender_id: string;
  dry_run: boolean;
}

export interface SmsBalance {
  active: boolean;
  balance: number;
}

export interface GeminiSettings {
  api_key: string;
  model_name: string;
}

export interface GeminiModelInfo {
  name: string;
  display_name: string;
  input_token_limit: number;
  output_token_limit: number;
  supported_actions: string[];
}
