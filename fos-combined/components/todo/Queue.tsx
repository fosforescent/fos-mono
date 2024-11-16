import React, { useState } from 'react';
import { Send } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AppState, FosReactGlobal, FosRoute } from '@/fos-combined/types';
import { useProps } from '@/fos-combined/App';
import { getAvailableTasks, getNodeInfo, getRootNodes } from '@/fos-combined/lib/utils';

interface Message {
  id: string;
  text: string;
  timestamp: string;
}

interface AnimatedMessagesState {
  messages: Message[];
  animatingMessages: string[];
}

interface MessageCardProps {
  message: Message;
  isAnimating: boolean;
  // onAnimationEnd: (messageId: string) => void;
}

const MessageCard: React.FC<MessageCardProps> = ({ 
  message, 
  isAnimating, 
  // onAnimationEnd 
}) => (
  <Card 
    className={`transform transition-all duration-500 ${
      isAnimating
        ? '-translate-y-full opacity-0'
        : 'translate-y-0 opacity-100'
    }`}
    // onAnimationEnd={() => onAnimationEnd(message.id)}
  >
    <CardContent className="p-4">
      <div className="text-gray-800">{message.text}</div>
      <div className="text-xs text-gray-500 mt-2">{message.timestamp}</div>
    </CardContent>
  </Card>
);

const TodoQueue = () => {





  const { 
    data,
    setData,
    options,
    nodeRoute: route,
    ...props
  } : {
    options: FosReactGlobal
    data: AppState
    nodeRoute: FosRoute
    setData: (state: AppState) => void
  } = useProps()




  const rootTodos = getRootNodes(data, 'todo');

  const allTodos: FosRoute[] = rootTodos.todos.flatMap((todoRoute) => getAvailableTasks(data, todoRoute));

  const messages = allTodos.map((todoRoute: FosRoute) => {
    const { nodeDescription, nodeData, nodeId } = getNodeInfo(todoRoute, data);
    return {
      id: nodeId,
      text: nodeDescription,
      timestamp: new Date().toLocaleTimeString(),
    }
  })
  


  const [newMessage, setNewMessage] = useState<string>('');

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    // const message: Message = {
    //   id: Date.now(),
    //   text: newMessage,
    //   timestamp: new Date().toLocaleTimeString(),
    // };


    setNewMessage('');
  };

  const handleAnimationEnd = (messageId: number): void => {
 
    
  };

  return (
    <div className="flex flex-col w-screen border-t"
        style={{ height: 'calc(100vh - 4rem)' }}
        >

      
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <MessageCard
              key={message.id}
              message={message}
              isAnimating={false}
              // onAnimationEnd={handleAnimationEnd}
            />
          ))}
        </div>
      </ScrollArea>

      <div className="border-t p-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            type="text"
            value={newMessage}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1"
          />
          <Button type="submit" variant="default">
            <Send className="h-4 w-4 mr-2" />
            Send
          </Button>
        </form>
      </div>
    </div>
  );
};

export default TodoQueue;