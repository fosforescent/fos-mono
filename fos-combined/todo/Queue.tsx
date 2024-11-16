import React, { useState } from 'react';
import { Send } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Message {
  id: number;
  text: string;
  timestamp: string;
}

interface AnimatedMessagesState {
  messages: Message[];
  animatingMessages: number[];
}

interface MessageCardProps {
  message: Message;
  isAnimating: boolean;
  onAnimationEnd: (messageId: number) => void;
}

const MessageCard: React.FC<MessageCardProps> = ({ message, isAnimating, onAnimationEnd }) => (
  <Card 
    className={`transform transition-all duration-500 ${
      isAnimating
        ? '-translate-y-full opacity-0'
        : 'translate-y-0 opacity-100'
    }`}
    onAnimationEnd={() => onAnimationEnd(message.id)}
  >
    <CardContent className="p-4">
      <div className="text-gray-800">{message.text}</div>
      <div className="text-xs text-gray-500 mt-2">{message.timestamp}</div>
    </CardContent>
  </Card>
);

const TodoQueue: React.FC = () => {
  const [messageState, setMessageState] = useState<AnimatedMessagesState>({
    messages: [
        {
            id: 1,
            text: 'Hello, World!',
            timestamp: new Date().toLocaleTimeString(),
        },
        {
            id: 2,
            text: 'This is a message',
            timestamp: new Date().toLocaleTimeString(),
        },
        {
            id: 3,
            text: 'This is another message',
            timestamp: new Date().toLocaleTimeString(),
        },
    
    ],
    animatingMessages: []
  });
  const [newMessage, setNewMessage] = useState<string>('');

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const message: Message = {
      id: Date.now(),
      text: newMessage,
      timestamp: new Date().toLocaleTimeString(),
    };

    setMessageState(prev => ({
      messages: [...prev.messages, message],
      animatingMessages: [...prev.animatingMessages, message.id]
    }));
    setNewMessage('');
  };

  const handleAnimationEnd = (messageId: number): void => {
    setMessageState(prev => ({
      ...prev,
      animatingMessages: prev.animatingMessages.filter(id => id !== messageId)
    }));
  };

  return (
    <div className="flex flex-col w-screen border-t"
        style={{ height: 'calc(100vh - 4rem)' }}
        >

      
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messageState.messages.map((message) => (
            <MessageCard
              key={message.id}
              message={message}
              isAnimating={messageState.animatingMessages.includes(message.id)}
              onAnimationEnd={handleAnimationEnd}
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