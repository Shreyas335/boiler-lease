import api from "./axios";

export interface SubmitFeedbackPayload {
  subject?: string;
  message: string;
}

export async function submitFeedback(payload: SubmitFeedbackPayload): Promise<{ detail: string }> {
  const { data } = await api.post<{ detail: string }>("/help/feedback/", payload);
  return data;
}
