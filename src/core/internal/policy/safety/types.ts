export type SafetyAction =
  | {
      type: "tool";
      toolName: string;
      input: unknown;
      preview?: string;
    }
  | {
      type: "bash";
      command: string;
      preview?: string;
    };

export type SafetyDecision = {
  allowed: boolean;
  requiresConfirm: boolean;
  reason: string;
};

export type SafetyPolicyConfig = {
  projectRoot: string;
  allowedWriteRoots?: string[];
  autoAllowedBashPrefixes?: string[];
};
