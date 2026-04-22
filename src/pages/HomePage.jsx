import { useChatStore } from "../store/useChatStore";

import Sidebar from "../components/SideBar";
import NoChatSelected from "../components/NoChatSelected";
import ChatContainer from "../components/ChatContainer";

export const HomePage = () => {
  const { selectedConversation } = useChatStore();

  return (
    <div className="h-screen bg-base-200 pt-16">
      <div className="h-[calc(100vh-4rem)] w-full">
        <div className="bg-base-100 w-full h-full">
          <div className="relative flex h-full min-h-0 overflow-hidden">
            <div className="fixed top-16 left-0 z-30 flex h-[calc(100vh-4rem)] w-20 lg:w-72 flex-col bg-base-100 border-r border-base-300 shadow-sm">
              <Sidebar />
            </div>
            <div className="flex min-h-0 min-w-0 flex-1 flex-col ml-20 lg:ml-72">
              {!selectedConversation ? <NoChatSelected /> : <ChatContainer />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};