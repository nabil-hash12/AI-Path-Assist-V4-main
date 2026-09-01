"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { io, Socket } from "socket.io-client";
import { getToken } from "./api";

interface JobProgressEvent {
  jobId: string;
  caseId: string;
  fileName: string;
  status: string;
  progress: number;
  eta: string;
}

interface JobDoneEvent {
  jobId: string;
  caseId: string;
  fileName: string;
  status: "done" | "failed";
  errorMsg?: string;
}

interface CaseUpdatedEvent {
  caseCode: string;
  status?: string;
  uploadStatus?: string;
}

interface SocketContextValue {
  connected: boolean;
  joinCase: (caseCode: string) => void;
  leaveCase: (caseCode: string) => void;
  onJobProgress: (cb: (e: JobProgressEvent) => void) => () => void;
  onJobDone: (cb: (e: JobDoneEvent) => void) => () => void;
  onCaseUpdated: (cb: (e: CaseUpdatedEvent) => void) => () => void;
  onCasesChanged: (cb: (e: { caseCode: string }) => void) => () => void;
  onAnalysisReady: (cb: (e: { caseId: string }) => void) => () => void;
}

const SocketContext = createContext<SocketContextValue | undefined>(undefined);

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function SocketProvider({ children }: { children: ReactNode }) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = io(API_BASE, {
      transports: ["websocket", "polling"],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });

    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", () => setConnected(false));

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const joinCase = useCallback((caseCode: string) => {
    socketRef.current?.emit("join:case", caseCode);
  }, []);

  const leaveCase = useCallback((caseCode: string) => {
    socketRef.current?.emit("leave:case", caseCode);
  }, []);

  const onJobProgress = useCallback((cb: (e: JobProgressEvent) => void) => {
    socketRef.current?.on("job:progress", cb);
    return () => { socketRef.current?.off("job:progress", cb); };
  }, [connected]);

  const onJobDone = useCallback((cb: (e: JobDoneEvent) => void) => {
    socketRef.current?.on("job:done", cb);
    return () => { socketRef.current?.off("job:done", cb); };
  }, [connected]);

  const onCaseUpdated = useCallback((cb: (e: CaseUpdatedEvent) => void) => {
    socketRef.current?.on("case:updated", cb);
    return () => { socketRef.current?.off("case:updated", cb); };
  }, [connected]);

  const onCasesChanged = useCallback((cb: (e: { caseCode: string }) => void) => {
    socketRef.current?.on("cases:changed", cb);
    return () => { socketRef.current?.off("cases:changed", cb); };
  }, [connected]);

  const onAnalysisReady = useCallback((cb: (e: { caseId: string }) => void) => {
    socketRef.current?.on("analysis:ready", cb);
    return () => { socketRef.current?.off("analysis:ready", cb); };
  }, [connected]);

  return (
    <SocketContext.Provider
      value={{ connected, joinCase, leaveCase, onJobProgress, onJobDone, onCaseUpdated, onCasesChanged, onAnalysisReady }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useSocket must be used within SocketProvider");
  return ctx;
}
