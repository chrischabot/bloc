declare module 'hono' {
  interface ContextVariableMap {
    requestId: string;
  }
}

// Re-export nothing; the file exists for the side-effect of the module augmentation.
export {};
