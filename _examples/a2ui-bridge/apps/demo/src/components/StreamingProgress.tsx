/**
 * StreamingProgress - Enhanced visual feedback during A2UI generation
 *
 * Addresses the 35-second wait time issue by providing:
 * - Immediate visual feedback when generation starts
 * - Stage-based progress indicators
 * - Component count as they stream in
 * - Estimated progress based on typical generation patterns
 */

import { useEffect, useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Loader2, Sparkles, CheckCircle2, Zap, Layout, FileCode } from 'lucide-react';

// Generation stages with timing estimates
const STAGES = [
  { id: 'connecting', label: 'Connecting to AI...', icon: Zap, duration: 1000 },
  { id: 'thinking', label: 'Understanding your request...', icon: Sparkles, duration: 3000 },
  { id: 'planning', label: 'Planning interface layout...', icon: Layout, duration: 5000 },
  { id: 'generating', label: 'Building components...', icon: FileCode, duration: 20000 },
  { id: 'finalizing', label: 'Finalizing interface...', icon: CheckCircle2, duration: 5000 },
] as const;

type StageId = typeof STAGES[number]['id'];

interface StreamingProgressProps {
  isGenerating: boolean;
  componentCount: number;
  streamLength: number;
  isDark: boolean;
  className?: string;
  onCancel?: () => void;
}

// Fun loading messages that rotate during generation
const LOADING_MESSAGES = [
  "Crafting the perfect interface...",
  "Arranging pixels with care...",
  "Making it just right for you...",
  "Almost there, hang tight...",
  "Good things take a moment...",
  "Building something special...",
  "Putting finishing touches...",
];

export function StreamingProgress({
  isGenerating,
  componentCount,
  streamLength,
  isDark,
  className,
  onCancel,
}: StreamingProgressProps) {
  const [currentStage, setCurrentStage] = useState<StageId>('connecting');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);

  // Progress based on stages and component count
  const progress = useMemo(() => {
    if (!isGenerating) return 0;

    // Stage-based progress (60% of total)
    const stageIndex = STAGES.findIndex(s => s.id === currentStage);
    const stageProgress = ((stageIndex + 1) / STAGES.length) * 60;

    // Component-based progress (40% of total, assuming ~10 components typical)
    const componentProgress = Math.min(componentCount / 10, 1) * 40;

    return Math.min(stageProgress + componentProgress, 95);
  }, [isGenerating, currentStage, componentCount]);

  // Advance stages based on elapsed time and stream activity
  useEffect(() => {
    if (!isGenerating) {
      setCurrentStage('connecting');
      setElapsedTime(0);
      return;
    }

    const interval = setInterval(() => {
      setElapsedTime(prev => prev + 100);
    }, 100);

    return () => clearInterval(interval);
  }, [isGenerating]);

  // Stage transitions based on time and data
  useEffect(() => {
    if (!isGenerating) return;

    if (elapsedTime < 1000) {
      setCurrentStage('connecting');
    } else if (elapsedTime < 4000 && streamLength === 0) {
      setCurrentStage('thinking');
    } else if (elapsedTime < 8000 && componentCount === 0) {
      setCurrentStage('planning');
    } else if (componentCount > 0 && componentCount < 8) {
      setCurrentStage('generating');
    } else if (componentCount >= 8) {
      setCurrentStage('finalizing');
    }
  }, [isGenerating, elapsedTime, streamLength, componentCount]);

  // Rotate loading messages
  useEffect(() => {
    if (!isGenerating) return;

    const interval = setInterval(() => {
      setMessageIndex(prev => (prev + 1) % LOADING_MESSAGES.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [isGenerating]);

  if (!isGenerating) return null;

  const currentStageData = STAGES.find(s => s.id === currentStage) || STAGES[0];
  const StageIcon = currentStageData.icon;

  return (
    <div className={cn("flex flex-col items-center gap-6", className)}>
      {/* Main spinner with stage icon */}
      <div className="relative">
        {/* Outer rotating ring */}
        <div className={cn(
          "w-24 h-24 rounded-full border-4 border-t-transparent animate-spin",
          isDark ? "border-zinc-700" : "border-zinc-200",
          "border-t-[hsl(var(--brand))]"
        )} />

        {/* Inner icon */}
        <div className={cn(
          "absolute inset-0 flex items-center justify-center",
        )}>
          <div className={cn(
            "w-16 h-16 rounded-full flex items-center justify-center",
            isDark ? "bg-zinc-800" : "bg-white",
          )}>
            <StageIcon className={cn(
              "h-7 w-7",
              currentStage === 'generating' ? "animate-pulse" : "",
              "text-[hsl(var(--brand))]"
            )} />
          </div>
        </div>
      </div>

      {/* Stage indicator */}
      <div className="text-center">
        <p className={cn(
          "text-lg font-medium mb-1",
          isDark ? "text-zinc-200" : "text-zinc-800"
        )}>
          {currentStageData.label}
        </p>
        <p className={cn(
          "text-sm transition-opacity duration-500",
          isDark ? "text-zinc-500" : "text-zinc-400"
        )}>
          {LOADING_MESSAGES[messageIndex]}
        </p>
      </div>

      {/* Progress bar */}
      <div className={cn(
        "w-full max-w-xs h-2 rounded-full overflow-hidden",
        isDark ? "bg-zinc-800" : "bg-zinc-200"
      )}>
        <div
          className="h-full bg-[hsl(var(--brand))] transition-all duration-500 ease-out rounded-full"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Stats */}
      <div className="flex items-center gap-6">
        {/* Time elapsed */}
        <div className="text-center">
          <p className={cn("text-2xl font-mono", isDark ? "text-zinc-300" : "text-zinc-600")}>
            {Math.floor(elapsedTime / 1000)}s
          </p>
          <p className={cn("text-xs", isDark ? "text-zinc-500" : "text-zinc-400")}>
            elapsed
          </p>
        </div>

        {/* Component count */}
        {componentCount > 0 && (
          <div className="text-center">
            <p className={cn("text-2xl font-mono text-[hsl(var(--brand))]")}>
              {componentCount}
            </p>
            <p className={cn("text-xs", isDark ? "text-zinc-500" : "text-zinc-400")}>
              component{componentCount !== 1 ? 's' : ''}
            </p>
          </div>
        )}

        {/* Progress percentage */}
        <div className="text-center">
          <p className={cn("text-2xl font-mono", isDark ? "text-zinc-300" : "text-zinc-600")}>
            {Math.round(progress)}%
          </p>
          <p className={cn("text-xs", isDark ? "text-zinc-500" : "text-zinc-400")}>
            complete
          </p>
        </div>
      </div>

      {/* Stage dots */}
      <div className="flex items-center gap-2">
        {STAGES.map((stage, index) => {
          const isActive = stage.id === currentStage;
          const isPast = STAGES.findIndex(s => s.id === currentStage) > index;

          return (
            <div
              key={stage.id}
              className={cn(
                "w-2 h-2 rounded-full transition-all duration-300",
                isPast ? "bg-[hsl(var(--brand))]" : "",
                isActive ? "bg-[hsl(var(--brand))] scale-125" : "",
                !isPast && !isActive ? (isDark ? "bg-zinc-700" : "bg-zinc-300") : ""
              )}
            />
          );
        })}
      </div>

      {/* Cancel button */}
      {onCancel && (
        <button
          onClick={onCancel}
          className={cn(
            "mt-4 px-4 py-2 text-sm rounded-sm transition-colors",
            isDark
              ? "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              : "text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100"
          )}
        >
          Cancel generation
        </button>
      )}
    </div>
  );
}

/**
 * Compact version for sidebar/chat area
 */
export function StreamingProgressCompact({
  isGenerating,
  componentCount,
  isDark,
}: {
  isGenerating: boolean;
  componentCount: number;
  isDark: boolean;
}) {
  const [dotCount, setDotCount] = useState(1);

  useEffect(() => {
    if (!isGenerating) return;

    const interval = setInterval(() => {
      setDotCount(prev => (prev % 3) + 1);
    }, 500);

    return () => clearInterval(interval);
  }, [isGenerating]);

  if (!isGenerating) return null;

  return (
    <div className={cn(
      "px-3 py-2 text-sm flex items-center gap-2 rounded-tl-2xl rounded-tr-2xl rounded-br-2xl rounded-bl-sm",
      isDark
        ? "bg-zinc-700 border border-zinc-600"
        : "bg-white border border-zinc-200"
    )}>
      <Loader2 className="h-3 w-3 animate-spin text-[hsl(var(--brand))]" />
      <span className={isDark ? "text-zinc-300" : "text-zinc-600"}>
        {componentCount > 0 ? (
          <>Building interface ({componentCount} component{componentCount !== 1 ? 's' : ''}){'.'.repeat(dotCount)}</>
        ) : (
          <>Creating your interface{'.'.repeat(dotCount)}</>
        )}
      </span>
    </div>
  );
}

export default StreamingProgress;
