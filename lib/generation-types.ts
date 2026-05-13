export type AssistantType = "voice" | "chat";

export type GeneratedSections = {
  customizedPrompt: string;
  welcomeMessage: string;
  knowledgeBase: string;
  businessInfoSummary: string;
  servicesFound: string;
  hoursFound: string;
  bookingRules: string;
  transferRules: string;
  missingInfoToConfirm: string;
};

export type GenerateResponse = {
  sections: GeneratedSections;
  scraped: {
    pageCount: number;
    pages: { title: string; url: string }[];
    warnings: string[];
  };
};

export type GenerateJobStatus = "queued" | "scraping" | "generating" | "completed" | "failed";

export type GenerateJob = {
  id: string;
  status: GenerateJobStatus;
  createdAt: string;
  updatedAt: string;
  message: string;
  result?: GenerateResponse;
  error?: string;
};
