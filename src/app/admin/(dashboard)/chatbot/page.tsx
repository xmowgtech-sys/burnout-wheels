import { ChatbotPanel } from "@/components/admin/chatbot-panel";
import { listConversations } from "@/lib/chatbot";
import { getChatbotSettings } from "@/lib/settings";
import { currentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Chatbot · Pit wall", robots: { index: false } };

export default async function ChatbotAdminPage() {
  const [settings, conversations, me] = [getChatbotSettings(), listConversations(), await currentUser()];
  const canManage = me ? can(me.role, "chatbot.manage") : false;

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="u-label">Pit radio</p>
        <h1 className="u-h1 mt-2 text-3xl md:text-4xl">Chatbot</h1>
        <p className="u-label-txt mt-2">Product-aware concierge: answers from live catalogue, captures leads, hands off to humans on request.</p>
      </header>
      <ChatbotPanel settings={settings} conversations={conversations} canManage={canManage} />
    </div>
  );
}
