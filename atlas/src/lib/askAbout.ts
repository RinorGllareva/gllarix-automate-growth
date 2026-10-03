/** "Ask about this": open the AI co-founder with a question about a record already typed in (nothing is sent until you press Ask). */
export const askAboutHref = (question: string) => `/advisor?ask=${encodeURIComponent(question)}`;
