import { createContext, useContext, type ReactNode } from "react";
const PreviewContext = createContext(false);
export function ContentPreviewBoundary({ children }: { children: ReactNode }) { return <PreviewContext.Provider value={true}>{children}</PreviewContext.Provider>; }
export function useContentPreviewMode() { return useContext(PreviewContext); }
