'use client';
import React, { useState, useEffect, useRef } from 'react';
import { Camera, Mic, Send, Square, Play, Pause } from 'lucide-react';
import { Alert, AlertTitle } from './ui/alert';
import { database } from '../firebase';
import { ref, push, onValue, remove } from 'firebase/database';

interface Message {
  id: string;
  content: string;
  type: 'text' | 'image' | 'audio';
  sender: string;
  timestamp: string;
  duration?: number;
}

const EphemeralChat = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [recording, setRecording] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout>();

  // Initialize userId on component mount
  useEffect(() => {
    if (!localStorage.getItem('userId')) {
      localStorage.setItem('userId', Math.random().toString(36).substring(7));
    }
  }, []);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const messagesRef = ref(database, 'messages');
    
    const unsubscribe = onValue(messagesRef, (snapshot) => {
      const messagesData = snapshot.val();
      if (messagesData) {
        const messageList = Object.entries(messagesData).map(([key, value]: [string, any]) => ({
          id: key,
          ...value
        }));
        setMessages(messageList.sort((a, b) => 
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        ));
      } else {
        setMessages([]);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const sendMessage = (content: string, type: 'text' | 'image' | 'audio' = 'text', duration?: number) => {
    const messagesRef = ref(database, 'messages');
    const userId = localStorage.getItem('userId') || Math.random().toString(36).substring(7);
    
    const newMsg = {
      content,
      type,
      sender: userId,
      timestamp: new Date().toISOString(),
      ...(duration && { duration })
    };
    
    const newMsgRef = push(messagesRef, newMsg);
    
    // Delete message after 1 minute
    setTimeout(() => {
      remove(ref(database, `messages/${newMsgRef.key}`));
    }, 60000);
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024 * 2) { // 2MB limit
        setShowAlert(true);
        setTimeout(() => setShowAlert(false), 3000);
        return;
      }

      setUploading(true);
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        sendMessage(base64, 'image');
        setUploading(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSend = () => {
    if (newMessage.trim()) {
      sendMessage(newMessage);
      setNewMessage('');
    }
  };

  const handleImageUpload = () => {
    fileInputRef.current?.click();
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64Audio = event.target?.result as string;
          sendMessage(base64Audio, 'audio', recordingTime);
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setRecording(true);
      setRecordingTime(0);
      
      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error('Error accessing microphone:', error);
      setShowAlert(true);
      setTimeout(() => setShowAlert(false), 3000);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const handleRecord = () => {
    if (!recording) {
      startRecording();
    } else {
      stopRecording();
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const playAudio = (audioData: string, messageId: string) => {
    if (playingAudio === messageId) {
      const audioElements: HTMLCollectionOf<HTMLAudioElement> = document.getElementsByTagName('audio');
      for (const audio of audioElements) {
        audio.pause();
        audio.currentTime = 0;
      }
      setPlayingAudio(null);
    } else {
      const audio: HTMLAudioElement = new Audio(audioData);
      audio.onended = () => setPlayingAudio(null);
      audio.play();
      setPlayingAudio(messageId);
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-gray-100">
      <div className="bg-blue-600 text-white p-4 shadow-md">
        <h1 className="text-xl font-bold">1-Minute Chat</h1>
        <p className="text-sm opacity-75">Messages delete after 1 minute</p>
      </div>

      <input
        type="file"
        accept="image/*"
        className="hidden"
        ref={fileInputRef}
        onChange={handleImageSelect}
      />

      {showAlert && (
        <Alert className="m-2">
          <AlertTitle>File too large</AlertTitle>
          Please select an image under 2MB
        </Alert>
      )}

      {uploading && (
        <Alert className="m-2">
          <AlertTitle>Uploading image...</AlertTitle>
        </Alert>
      )}

      <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => {
          const isMyMessage = message.sender === localStorage.getItem('userId');
          return (
            <div
              key={message.id}
              className={`flex ${isMyMessage ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`rounded-lg px-4 py-2 max-w-[80%] ${
                  isMyMessage
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-800 border'
                }`}
              >
                {message.type === 'text' && <p>{message.content}</p>}
                {message.type === 'image' && (
                  <div className="rounded overflow-hidden">
                    <img 
                      src={message.content} 
                      alt="Shared" 
                      className="max-w-full h-auto rounded"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0yNCAyNEgwVjBoMjR2MjR6Ii8+PC9zdmc+';
                      }}
                    />
                  </div>
                )}
                {message.type === 'audio' && (
                  <div 
                    className={`flex items-center space-x-2 p-2 rounded cursor-pointer ${
                      isMyMessage ? 'bg-blue-500' : 'bg-gray-200'
                    }`}
                    onClick={() => playAudio(message.content, message.id)}
                  >
                    {playingAudio === message.id ? (
                      <Pause className={`w-6 h-6 ${isMyMessage ? 'text-white' : 'text-blue-600'}`} />
                    ) : (
                      <Play className={`w-6 h-6 ${isMyMessage ? 'text-white' : 'text-blue-600'}`} />
                    )}
                    <span className={`text-sm ${isMyMessage ? 'text-white' : 'text-gray-600'}`}>
                      {message.duration ? formatTime(message.duration) : 'Audio'}
                    </span>
                  </div>
                )}
                <span className="text-xs opacity-75 mt-1 block">
                  {new Date(message.timestamp).toLocaleTimeString()}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t bg-white p-4">
        <div className="flex items-center space-x-2">
          <button
            onClick={handleImageUpload}
            className="p-2 rounded-full hover:bg-gray-100"
            disabled={uploading || recording}
          >
            <Camera className={`w-6 h-6 ${uploading || recording ? 'text-gray-400' : 'text-blue-600'}`} />
          </button>
          <button
            onClick={handleRecord}
            className={`p-2 rounded-full hover:bg-gray-100 ${
              recording ? 'bg-red-100' : ''
            }`}
          >
            {recording ? (
              <Square className="w-6 h-6 text-red-600" />
            ) : (
              <Mic className="w-6 h-6 text-blue-600" />
            )}
          </button>
          {recording && (
            <span className="text-red-600 text-sm">
              {formatTime(recordingTime)}
            </span>
          )}
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 p-2 border rounded-full focus:outline-none focus:border-blue-600"
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            disabled={recording}
          />
          <button
            onClick={handleSend}
            className="p-2 rounded-full bg-blue-600 text-white"
            disabled={recording}
          >
            <Send className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default EphemeralChat;
